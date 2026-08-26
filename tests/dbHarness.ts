import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

/**
 * Runs the real migrations against a real Postgres, compiled to WebAssembly, so
 * the policy tests exercise the policies themselves rather than a copy of them.
 *
 * Supabase supplies the auth schema in production. Here the harness supplies a
 * stand in with the same shape. Everything below public is the file that ships.
 */
const MIGRATIONS = [
  'supabase/migrations/0001_schema.sql',
  'supabase/migrations/0002_functions.sql',
  'supabase/migrations/0003_policies.sql',
]

const AUTH_SHIM = `
  create role authenticated nologin;
  create schema auth;
  grant usage on schema auth to authenticated;
  create table auth.users (
    id uuid primary key,
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`

export interface NewPerson {
  firstName: string
  lastName: string
  classYear?: string | null
  guestType?: string | null
  birthday?: string | null
  targetHours?: number
}

export interface TestDatabase {
  db: PGlite
  /** Runs a query as a signed in person, with row level security applied. */
  as<T>(userId: string, sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  /** Runs as the database owner, for setting a scene the app could not set. */
  root<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  addPerson(person: NewPerson): Promise<string>
  addArea(name: string): Promise<string>
  /** Makes an account the way a sign in would, then sets what it became. */
  addAccount(
    id: string,
    email: string,
    role?: 'student' | 'supervisor',
    status?: 'pending' | 'approved',
    personId?: string | null,
  ): Promise<void>
  close(): Promise<void>
}

export function firstRow<T>(rows: T[]): T {
  const row = rows[0]
  if (row === undefined) throw new Error('expected at least one row, got none')
  return row
}

export async function startDatabase(): Promise<TestDatabase> {
  const db = new PGlite()
  await db.exec(AUTH_SHIM)

  for (const file of MIGRATIONS) {
    try {
      await db.exec(readFileSync(file, 'utf8'))
    } catch (problem) {
      throw new Error(`${file} failed to apply: ${(problem as Error).message}`)
    }
  }

  async function root<T>(sql: string, params: unknown[] = []) {
    await db.exec('reset role')
    if (params.length > 0) return db.query<T>(sql, params)
    // exec takes several statements in one string, query takes exactly one.
    const results = await db.exec(sql)
    return { rows: (results.at(-1)?.rows ?? []) as T[] }
  }

  async function as<T>(userId: string, sql: string, params: unknown[] = []) {
    await db.exec('reset role')
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userId])
    await db.exec('set role authenticated')
    try {
      return await db.query<T>(sql, params)
    } finally {
      await db.exec('reset role')
    }
  }

  async function addPerson(person: NewPerson): Promise<string> {
    const { rows } = await root<{ id: string }>(
      `insert into public.people
         (first_name, last_name, class_year, guest_type, birthday, target_hours)
       values ($1, $2, $3, $4::public.guest_type, $5, $6) returning id`,
      [
        person.firstName, person.lastName, person.classYear ?? null,
        person.guestType ?? null, person.birthday ?? null, person.targetHours ?? 0,
      ],
    )
    return firstRow(rows).id
  }

  async function addArea(name: string): Promise<string> {
    const { rows } = await root<{ id: string }>(
      'insert into public.areas (name) values ($1) returning id', [name],
    )
    return firstRow(rows).id
  }

  async function addAccount(
    id: string,
    email: string,
    role: 'student' | 'supervisor' = 'student',
    status: 'pending' | 'approved' = 'approved',
    personId: string | null = null,
  ) {
    await root('insert into auth.users (id, email) values ($1, $2)', [id, email])
    await root(
      `update public.profiles
       set role = $2::public.account_role, status = $3::public.account_status, person_id = $4
       where id = $1`,
      [id, role, status, personId],
    )
  }

  return { db, as, root, addPerson, addArea, addAccount, close: () => db.close() }
}

export const SUPERVISOR = '00000000-0000-0000-0000-0000000000a1'
export const STUDENT    = '00000000-0000-0000-0000-0000000000b2'
export const OTHER      = '00000000-0000-0000-0000-0000000000c3'
export const PENDING    = '00000000-0000-0000-0000-0000000000d4'
