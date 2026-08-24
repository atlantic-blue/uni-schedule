import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ADMIN, OTHER, STUDENT, firstRow, startDatabase, type TestDatabase } from './dbHarness'

let database: TestDatabase
let shiftId: string
let studentAssignment: string
let otherAssignment: string

beforeAll(async () => {
  database = await startDatabase()
  await database.addUser(ADMIN, 'ada@example.edu', 'admin', 0)
  await database.addUser(STUDENT, 'sam@example.edu', 'student', 40)
  await database.addUser(OTHER, 'oli@example.edu', 'student', 40)

  await database.root(`
    insert into public.areas (id, name, places, sort_order)
    values ('11111111-1111-1111-1111-111111111111', 'Kitchen', 4, 1);
    insert into public.shifts (id, area_id, shift_date, starts_at, ends_at, places)
    values ('22222222-2222-2222-2222-222222222222',
            '11111111-1111-1111-1111-111111111111', date '2026-08-25', '16:00', '20:00', 4);
    insert into public.shift_templates (area_id, weekday, starts_at, ends_at, places)
    values ('11111111-1111-1111-1111-111111111111', 2, '16:00', '20:00', 4),
           ('11111111-1111-1111-1111-111111111111', 5, '16:00', '20:00', 4);
  `)
  shiftId = '22222222-2222-2222-2222-222222222222'

  const mine = await database.root<{ id: string }>(
    'insert into public.assignments (shift_id, person_id) values ($1, $2) returning id',
    [shiftId, STUDENT],
  )
  studentAssignment = firstRow(mine.rows).id
  const theirs = await database.root<{ id: string }>(
    'insert into public.assignments (shift_id, person_id) values ($1, $2) returning id',
    [shiftId, OTHER],
  )
  otherAssignment = firstRow(theirs.rows).id
})

afterAll(async () => {
  await database.close()
})

describe('the roster is group knowledge', () => {
  it('lets a student see every name and role', async () => {
    const { rows } = await database.as<{ full_name: string }>(
      STUDENT, 'select full_name from public.people_directory order by full_name',
    )
    expect(rows.map((row) => row.full_name)).toEqual(['ada', 'oli', 'sam'])
  })

  it('lets a student see who else is on a shift', async () => {
    const { rows } = await database.as(STUDENT, 'select id from public.assignments')
    expect(rows).toHaveLength(2)
  })

  it('hides the target hours and the address behind the directory view', async () => {
    const { rows } = await database.as(STUDENT, 'select id from public.profiles')
    expect(rows).toHaveLength(1)
  })
})

describe('absence is private', () => {
  beforeAll(async () => {
    await database.root(
      `insert into public.attendance (assignment_id, status) values ($1, 'excused'), ($2, 'worked')`,
      [studentAssignment, otherAssignment],
    )
  })

  it('shows a student their own attendance', async () => {
    const { rows } = await database.as<{ status: string }>(
      STUDENT, 'select status from public.attendance',
    )
    expect(rows).toEqual([{ status: 'excused' }])
  })

  it('refuses to show one student the absence of another', async () => {
    const { rows } = await database.as(
      STUDENT, 'select status from public.attendance where assignment_id = $1', [otherAssignment],
    )
    expect(rows).toHaveLength(0)
  })

  it('shows an administrator both', async () => {
    const { rows } = await database.as(ADMIN, 'select status from public.attendance')
    expect(rows).toHaveLength(2)
  })
})

describe('only an administrator writes the plan', () => {
  it('refuses an assignment made by a student', async () => {
    await expect(
      database.as(STUDENT, 'insert into public.assignments (shift_id, person_id) values ($1, $2)',
        [shiftId, STUDENT]),
    ).rejects.toThrow(/row-level security/i)
  })

  it('accepts an assignment made by an administrator', async () => {
    const before = await database.root<{ count: string }>('select count(*) from public.assignments')
    await database.as(ADMIN, 'insert into public.assignments (shift_id, person_id) values ($1, $2)',
      [shiftId, ADMIN])
    const after = await database.root<{ count: string }>('select count(*) from public.assignments')
    expect(Number(firstRow(after.rows).count)).toBe(Number(firstRow(before.rows).count) + 1)
  })

  it('refuses a student who tries to remove somebody from a shift', async () => {
    await database.as(STUDENT, 'delete from public.assignments where id = $1', [otherAssignment])
    const { rows } = await database.root('select id from public.assignments where id = $1',
      [otherAssignment])
    expect(rows).toHaveLength(1)
  })

  it('refuses a student who calls generate_week', async () => {
    await expect(
      database.as(STUDENT, "select public.generate_week(date '2026-08-24')"),
    ).rejects.toThrow(/row-level security/i)
  })
})

describe('a student cannot promote themselves', () => {
  it('refuses a change of role', async () => {
    await expect(
      database.as(STUDENT, "update public.profiles set role = 'admin' where id = $1", [STUDENT]),
    ).rejects.toThrow(/only an administrator/i)
  })

  it('refuses a change of target hours', async () => {
    await expect(
      database.as(STUDENT, 'update public.profiles set target_hours = 0 where id = $1', [STUDENT]),
    ).rejects.toThrow(/only an administrator/i)
  })

  it('allows a student to correct their own name', async () => {
    await database.as(STUDENT, 'update public.profiles set full_name = $2 where id = $1',
      [STUDENT, 'Sam Weber'])
    const { rows } = await database.root<{ full_name: string }>(
      'select full_name from public.profiles where id = $1', [STUDENT],
    )
    expect(firstRow(rows).full_name).toBe('Sam Weber')
  })
})

describe('hours', () => {
  it('shows a student one row, their own', async () => {
    const { rows } = await database.as<{ person_id: string }>(
      STUDENT, 'select person_id from public.hours_balance',
    )
    expect(rows.map((row) => row.person_id)).toEqual([STUDENT])
  })

  it('shows an administrator everybody', async () => {
    const { rows } = await database.as(ADMIN, 'select person_id from public.hours_balance')
    expect(rows).toHaveLength(3)
  })

  it('counts an excused absence towards the target, and a missed shift not at all', async () => {
    const { rows } = await database.as<{ credited_minutes: number; minus_minutes: number }>(
      STUDENT, 'select credited_minutes, minus_minutes from public.hours_balance',
    )
    // Four hours excused against a target of forty leaves thirty six behind.
    expect(firstRow(rows).credited_minutes).toBe(240)
    expect(firstRow(rows).minus_minutes).toBe(40 * 60 - 240)
  })
})

describe('the database decides what a shift was worth', () => {
  it('fills the credit from the length of the shift', async () => {
    await database.root('update public.attendance set status = $2, credited_minutes = null where assignment_id = $1',
      [studentAssignment, 'worked'])
    const { rows } = await database.root<{ credited_minutes: number }>(
      'select credited_minutes from public.attendance where assignment_id = $1', [studentAssignment],
    )
    expect(firstRow(rows).credited_minutes).toBe(240)
  })

  it('takes the hours back when a mark is corrected, without being told the new number', async () => {
    await database.root("update public.attendance set status = 'worked', credited_minutes = null where assignment_id = $1",
      [studentAssignment])
    // This is exactly what the app sends: the status, and nothing else.
    await database.as(ADMIN, "update public.attendance set status = 'absent' where assignment_id = $1",
      [studentAssignment])
    const { rows } = await database.root<{ credited_minutes: number }>(
      'select credited_minutes from public.attendance where assignment_id = $1', [studentAssignment],
    )
    expect(firstRow(rows).credited_minutes).toBe(0)
  })

  it('credits nothing for a missed shift', async () => {
    await database.root('update public.attendance set status = $2, credited_minutes = null where assignment_id = $1',
      [studentAssignment, 'absent'])
    const { rows } = await database.root<{ credited_minutes: number }>(
      'select credited_minutes from public.attendance where assignment_id = $1', [studentAssignment],
    )
    expect(firstRow(rows).credited_minutes).toBe(0)
  })
})

describe('generate_week', () => {
  it('creates one shift per template and refuses a second run', async () => {
    const first = await database.as<{ generate_week: number }>(
      ADMIN, "select public.generate_week(date '2026-09-07') as generate_week",
    )
    expect(firstRow(first.rows).generate_week).toBe(2)
    const again = await database.as<{ generate_week: number }>(
      ADMIN, "select public.generate_week(date '2026-09-07') as generate_week",
    )
    expect(firstRow(again.rows).generate_week).toBe(0)
  })

  it('refuses a date that is not a Monday', async () => {
    await expect(
      database.as(ADMIN, "select public.generate_week(date '2026-09-09')"),
    ).rejects.toThrow(/expects a Monday/i)
  })
})
