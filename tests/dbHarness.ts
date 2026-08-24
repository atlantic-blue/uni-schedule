import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

/**
 * Runs the real migrations against a real Postgres, compiled to WebAssembly, so
 * the policy tests exercise the policies themselves rather than a copy of them.
 *
 * Supabase supplies the auth schema in production. Here the harness supplies a
 * stand in with the same shape: a users table and an auth.uid() that reads the
 * current request. Everything below public is the file that ships.
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

export interface TestDatabase {
  db: PGlite
  /** Runs a query as a signed in person, with row level security applied. */
  as<T>(userId: string, sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  /** Runs as the database owner, for setting a scene the app could not set. */
  root<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  addUser(id: string, email: string, role?: 'admin' | 'student' | 'guest', targetHours?: number): Promise<void>
  close(): Promise<void>
}

export async function startDatabase(): Promise<TestDatabase> {
  const db = new PGlite()
  await db.exec(AUTH_SHIM)

  for (const file of MIGRATIONS) {
    const sql = readFileSync(file, 'utf8')
    try {
      await db.exec(sql)
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

  async function addUser(
    id: string,
    email: string,
    role: 'admin' | 'student' | 'guest' = 'student',
    targetHours = 40,
  ) {
    await root('insert into auth.users (id, email) values ($1, $2)', [id, email])
    await root('update public.profiles set role = $2, target_hours = $3 where id = $1', [
      id, role, targetHours,
    ])
  }

  return { db, as, root, addUser, close: () => db.close() }
}

/** Reads the one row a test expects, and fails loudly when there is none. */
export function firstRow<T>(rows: T[]): T {
  const row = rows[0]
  if (row === undefined) throw new Error('expected at least one row, got none')
  return row
}

export const ADMIN = '00000000-0000-0000-0000-0000000000a1'
export const STUDENT = '00000000-0000-0000-0000-0000000000b2'
export const OTHER = '00000000-0000-0000-0000-0000000000c3'
