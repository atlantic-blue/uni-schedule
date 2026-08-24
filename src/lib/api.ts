import type {
  Area, AttendanceMark, HoursBalance, MyShift, Person, Shift,
} from './types'

/**
 * Everything the screens are allowed to do. Two things implement it: Supabase,
 * which is the real one, and a demo store that runs in memory so the app can be
 * shown without an account.
 *
 * The demo store copies the permission rules, but it is not the guarantee. The
 * guarantee is row level security in the database, and tests/rls.test.ts proves
 * it against a real Postgres.
 */
export interface ScheduleApi {
  currentPerson(): Promise<Person | null>
  signIn(email: string): Promise<void>
  signOut(): Promise<void>

  listPeople(): Promise<Person[]>
  listAreas(): Promise<Area[]>

  listWeek(monday: string): Promise<Shift[]>
  generateWeek(monday: string): Promise<number>
  assign(shiftId: string, personId: string): Promise<void>
  unassign(assignmentId: string): Promise<void>

  myShifts(): Promise<MyShift[]>
  markAttendance(marks: AttendanceMark[]): Promise<void>

  hoursBalances(): Promise<HoursBalance[]>
  addAdjustment(personId: string, minutes: number, reason: string): Promise<void>
}

export class NotAllowed extends Error {
  constructor(what: string) {
    super(`You are not allowed to ${what}.`)
    this.name = 'NotAllowed'
  }
}
