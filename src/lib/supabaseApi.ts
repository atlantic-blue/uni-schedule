import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NotAllowed, type ScheduleApi } from './api'
import { addDays } from './time'
import type {
  Area, AttendanceMark, AttendanceStatus, HoursBalance, MyShift, Person, Shift,
} from './types'

export function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing. Copy .env.example to .env.local.',
    )
  }
  return createClient(url, key)
}

function fail(error: { message: string; code?: string } | null, what: string): void {
  if (!error) return
  // 42501 is the code Postgres returns when a policy refuses the row.
  if (error.code === '42501' || error.code === 'PGRST301') throw new NotAllowed(what)
  throw new Error(`Could not ${what}: ${error.message}`)
}

interface ShiftRow {
  id: string; area_id: string; shift_date: string; starts_at: string
  ends_at: string; places: number; notes: string | null
  areas: { name: string } | null
}

export class SupabaseApi implements ScheduleApi {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async currentPerson(): Promise<Person | null> {
    const { data: auth } = await this.client.auth.getUser()
    if (!auth.user) return null
    const { data, error } = await this.client
      .from('people_directory')
      .select('id, full_name, role, active')
      .eq('id', auth.user.id)
      .maybeSingle()
    fail(error, 'read your profile')
    if (!data) return null
    return { id: data.id, fullName: data.full_name, role: data.role, active: data.active }
  }

  async signIn(email: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    fail(error, 'send the sign in link')
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut()
  }

  async listPeople(): Promise<Person[]> {
    const { data, error } = await this.client
      .from('people_directory')
      .select('id, full_name, role, active')
      .eq('active', true)
      .order('full_name')
    fail(error, 'read the list of people')
    return (data ?? []).map((row) => ({
      id: row.id, fullName: row.full_name, role: row.role, active: row.active,
    }))
  }

  async listAreas(): Promise<Area[]> {
    const { data, error } = await this.client
      .from('areas')
      .select('id, name, description, places, sort_order, active')
      .eq('active', true)
      .order('sort_order')
    fail(error, 'read the work areas')
    return (data ?? []).map((row) => ({
      id: row.id, name: row.name, description: row.description,
      places: row.places, sortOrder: row.sort_order, active: row.active,
    }))
  }

  async listWeek(monday: string): Promise<Shift[]> {
    const { data: shiftRows, error } = await this.client
      .from('shifts')
      .select('id, area_id, shift_date, starts_at, ends_at, places, notes, areas(name)')
      .gte('shift_date', monday)
      .lt('shift_date', addDays(monday, 7))
      .order('shift_date')
    fail(error, 'read the week')

    const shifts = (shiftRows ?? []) as unknown as ShiftRow[]
    if (shifts.length === 0) return []

    const [assignments, people] = await Promise.all([
      this.client
        .from('assignments')
        .select('id, shift_id, person_id')
        .in('shift_id', shifts.map((s) => s.id)),
      this.listPeople(),
    ])
    fail(assignments.error, 'read who is assigned')
    const nameOf = new Map(people.map((p) => [p.id, p.fullName]))

    return shifts.map((row) => ({
      id: row.id,
      areaId: row.area_id,
      areaName: row.areas?.name ?? 'Unknown area',
      date: row.shift_date,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      places: row.places,
      notes: row.notes,
      assignments: (assignments.data ?? [])
        .filter((a) => a.shift_id === row.id)
        .map((a) => ({
          id: a.id,
          personId: a.person_id,
          personName: nameOf.get(a.person_id) ?? 'Unknown',
        }))
        .sort((a, b) => a.personName.localeCompare(b.personName)),
    }))
  }

  async generateWeek(monday: string): Promise<number> {
    const { data, error } = await this.client.rpc('generate_week', { p_monday: monday })
    fail(error, 'create the shifts for that week')
    return data ?? 0
  }

  async assign(shiftId: string, personId: string): Promise<void> {
    const { error } = await this.client
      .from('assignments')
      .insert({ shift_id: shiftId, person_id: personId })
    // 23505 means the person already holds a place on that shift, which is not a failure.
    if (error && error.code !== '23505') fail(error, 'assign that person')
  }

  async unassign(assignmentId: string): Promise<void> {
    const { error } = await this.client.from('assignments').delete().eq('id', assignmentId)
    fail(error, 'remove that person')
  }

  async myShifts(): Promise<MyShift[]> {
    const person = await this.currentPerson()
    if (!person) return []

    const { data: mine, error } = await this.client
      .from('assignments')
      .select('id, shift_id, shifts(id, shift_date, starts_at, ends_at, areas(name))')
      .eq('person_id', person.id)
    fail(error, 'read your shifts')

    const rows = (mine ?? []) as unknown as {
      id: string; shift_id: string
      shifts: { shift_date: string; starts_at: string; ends_at: string; areas: { name: string } | null } | null
    }[]
    if (rows.length === 0) return []

    const [others, attendance, people] = await Promise.all([
      this.client.from('assignments').select('shift_id, person_id')
        .in('shift_id', rows.map((r) => r.shift_id)),
      this.client.from('attendance').select('assignment_id, status')
        .in('assignment_id', rows.map((r) => r.id)),
      this.listPeople(),
    ])
    fail(others.error, 'read who else is on your shifts')
    fail(attendance.error, 'read your attendance')
    const nameOf = new Map(people.map((p) => [p.id, p.fullName]))
    const statusOf = new Map<string, AttendanceStatus>(
      (attendance.data ?? []).map((a) => [a.assignment_id, a.status as AttendanceStatus]),
    )

    return rows
      .map((row) => ({
        assignmentId: row.id,
        shiftId: row.shift_id,
        areaName: row.shifts?.areas?.name ?? 'Unknown area',
        date: row.shifts?.shift_date ?? '',
        startsAt: row.shifts?.starts_at ?? '',
        endsAt: row.shifts?.ends_at ?? '',
        colleagues: (others.data ?? [])
          .filter((o) => o.shift_id === row.shift_id && o.person_id !== person.id)
          .map((o) => nameOf.get(o.person_id) ?? '')
          .filter(Boolean)
          .sort(),
        status: statusOf.get(row.id) ?? null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  async markAttendance(marks: AttendanceMark[]): Promise<void> {
    if (marks.length === 0) return
    // credited_minutes is left out on purpose. The database trigger fills it, so
    // the browser never decides what a shift was worth.
    const { error } = await this.client
      .from('attendance')
      .upsert(
        marks.map((mark) => ({ assignment_id: mark.assignmentId, status: mark.status })),
        { onConflict: 'assignment_id' },
      )
    fail(error, 'record attendance')
  }

  async hoursBalances(): Promise<HoursBalance[]> {
    const { data, error } = await this.client
      .from('hours_balance')
      .select('*')
      .order('balance_minutes')
    fail(error, 'read the hours')
    return (data ?? []).map((row) => ({
      personId: row.person_id,
      fullName: row.full_name,
      role: row.role,
      targetMinutes: row.target_minutes,
      creditedMinutes: row.credited_minutes,
      adjustmentMinutes: row.adjustment_minutes,
      balanceMinutes: row.balance_minutes,
      minusMinutes: row.minus_minutes,
      excusedDays: row.excused_days,
    }))
  }

  async addAdjustment(personId: string, minutes: number, reason: string): Promise<void> {
    const { error } = await this.client
      .from('adjustments')
      .insert({ person_id: personId, minutes, reason })
    fail(error, 'save that correction')
  }
}
