import { NotAllowed, type ScheduleApi } from './api'
import { addDays, mondayOf, shiftLengthMinutes, toIsoDate } from './time'
import type {
  Area, AttendanceMark, AttendanceStatus, HoursBalance, MyShift, Person, Shift,
} from './types'

/** A small predictable generator, so the demo looks the same on every machine. */
function makeRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

const FIRST_NAMES = [
  'Amelie', 'Ben', 'Clara', 'David', 'Elif', 'Finn', 'Greta', 'Hannes', 'Ida',
  'Jonas', 'Katja', 'Lukas', 'Mira', 'Noah', 'Olga', 'Paul', 'Quentin', 'Rosa',
  'Sami', 'Tessa', 'Ulrich', 'Vera', 'Wanda', 'Xenia', 'Yusuf', 'Zoe',
]
const LAST_NAMES = [
  'Bauer', 'Christensen', 'Dubois', 'Eriksen', 'Fischer', 'Garcia', 'Hoffmann',
  'Ivanov', 'Jansen', 'Keller', 'Lange', 'Meyer', 'Novak', 'Olsen', 'Peters',
  'Richter', 'Schmidt', 'Toth', 'Ulrich', 'Vogel', 'Weber', 'Zimmermann',
]

function pick(list: readonly string[], random: () => number): string {
  const chosen = list[Math.floor(random() * list.length)]
  if (!chosen) throw new Error('the list of names is empty')
  return chosen
}

interface DemoAssignment { id: string; shiftId: string; personId: string }
interface DemoAttendance { assignmentId: string; status: AttendanceStatus; minutes: number }
export interface DemoShift {
  id: string; areaId: string; date: string; startsAt: string; endsAt: string
  places: number; notes: string | null
}

export interface DemoState {
  people: (Person & { email: string; targetHours: number })[]
  areas: Area[]
  shifts: DemoShift[]
  assignments: DemoAssignment[]
  attendance: DemoAttendance[]
  adjustments: { personId: string; minutes: number; reason: string; happenedOn: string }[]
  signedInAs: string | null
}

const AREA_NAMES: [string, string, number][] = [
  ['Kitchen', 'Preparation and service', 4],
  ['Bar', 'Drinks and till', 3],
  ['Front desk', 'Reception and guest questions', 2],
  ['Cleaning', 'Rooms and shared spaces', 3],
  ['Stock', 'Deliveries and store room', 2],
]

/** Tuesday and Friday, the two days the paper sheet uses. */
const SHIFT_DAYS = [1, 4] // offsets from Monday

export function buildDemoState(today = toIsoDate(new Date())): DemoState {
  const random = makeRandom(20_260_823)
  const areas: Area[] = AREA_NAMES.map(([name, description, places], index) => ({
    id: `area-${index + 1}`, name, description, places, sortOrder: index + 1, active: true,
  }))

  const people: DemoState['people'] = [
    {
      id: 'person-1', fullName: 'Ada Ostrowski', role: 'admin', active: true,
      email: 'admin@example.edu', targetHours: 0,
    },
  ]
  for (let index = 2; index <= 118; index += 1) {
    const first = pick(FIRST_NAMES, random)
    const last = pick(LAST_NAMES, random)
    const isGuest = random() < 0.12
    people.push({
      id: `person-${index}`,
      fullName: `${first} ${last}`,
      role: isGuest ? 'guest' : 'student',
      active: true,
      email: `${first}.${last}.${index}@example.edu`.toLowerCase(),
      targetHours: isGuest ? 0 : 40,
    })
  }

  const shifts: DemoShift[] = []
  const assignments: DemoAssignment[] = []
  const attendance: DemoAttendance[] = []
  const thisMonday = mondayOf(today)

  // Two weeks behind and one ahead, so hours and the empty week both have data.
  for (const weekOffset of [-2, -1, 0, 1]) {
    const monday = addDays(thisMonday, weekOffset * 7)
    for (const dayOffset of SHIFT_DAYS) {
      const date = addDays(monday, dayOffset)
      for (const area of areas) {
        const shiftId = `shift-${date}-${area.id}`
        shifts.push({
          id: shiftId, areaId: area.id, date,
          startsAt: '16:00', endsAt: '20:00', places: area.places, notes: null,
        })
        if (weekOffset === 1) continue // next week is left empty on purpose
        const wanted = area.places
        for (let place = 0; place < wanted; place += 1) {
          const person = people[1 + Math.floor(random() * (people.length - 1))]
          if (!person) continue
          if (assignments.some((x) => x.shiftId === shiftId && x.personId === person.id)) continue
          const assignmentId = `assignment-${assignments.length + 1}`
          assignments.push({ id: assignmentId, shiftId, personId: person.id })
          if (date < today) {
            const roll = random()
            const status: AttendanceStatus =
              roll < 0.86 ? 'worked' : roll < 0.95 ? 'excused' : 'absent'
            attendance.push({
              assignmentId, status,
              minutes: status === 'absent' ? 0 : shiftLengthMinutes('16:00', '20:00'),
            })
          }
        }
      }
    }
  }

  return { people, areas, shifts, assignments, attendance, adjustments: [], signedInAs: null }
}

/**
 * The demo store. It holds everything in memory and forgets it on reload. The
 * permission checks here mirror the database policies so the screens behave the
 * same way, but the database is what actually enforces them.
 */
export class DemoApi implements ScheduleApi {
  private state: DemoState

  constructor(state: DemoState = buildDemoState(), signedInAs: string | null = 'person-1') {
    this.state = { ...state, signedInAs }
  }

  private me(): Person {
    const person = this.state.people.find((p) => p.id === this.state.signedInAs)
    if (!person) throw new NotAllowed('do this while signed out')
    return person
  }

  private requireAdmin(what: string): void {
    if (this.me().role !== 'admin') throw new NotAllowed(what)
  }

  async currentPerson(): Promise<Person | null> {
    const person = this.state.people.find((p) => p.id === this.state.signedInAs)
    return person ? { ...person } : null
  }

  async signIn(email: string): Promise<void> {
    const person = this.state.people.find((p) => p.email === email.trim().toLowerCase())
    if (!person) throw new NotAllowed(`sign in as ${email}. Try admin@example.edu`)
    this.state.signedInAs = person.id
  }

  async signOut(): Promise<void> {
    this.state.signedInAs = null
  }

  async listPeople(): Promise<Person[]> {
    return this.state.people
      .filter((p) => p.active)
      .map(({ id, fullName, role, active }) => ({ id, fullName, role, active }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }

  async listAreas(): Promise<Area[]> {
    return this.state.areas.filter((a) => a.active).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async listWeek(monday: string): Promise<Shift[]> {
    const end = addDays(monday, 7)
    return this.state.shifts
      .filter((s) => s.date >= monday && s.date < end)
      .map((s) => this.decorate(s))
      .sort((a, b) => a.date.localeCompare(b.date) || a.areaName.localeCompare(b.areaName))
  }

  private decorate(shift: DemoShift): Shift {
    const area = this.state.areas.find((a) => a.id === shift.areaId)
    return {
      ...shift,
      areaName: area?.name ?? 'Unknown area',
      assignments: this.state.assignments
        .filter((a) => a.shiftId === shift.id)
        .map((a) => ({
          id: a.id,
          personId: a.personId,
          personName: this.state.people.find((p) => p.id === a.personId)?.fullName ?? 'Unknown',
        }))
        .sort((a, b) => a.personName.localeCompare(b.personName)),
    }
  }

  async generateWeek(monday: string): Promise<number> {
    this.requireAdmin('create shifts')
    let created = 0
    for (const dayOffset of SHIFT_DAYS) {
      const date = addDays(monday, dayOffset)
      for (const area of this.state.areas.filter((a) => a.active)) {
        const id = `shift-${date}-${area.id}`
        if (this.state.shifts.some((s) => s.id === id)) continue
        this.state.shifts.push({
          id, areaId: area.id, date, startsAt: '16:00', endsAt: '20:00',
          places: area.places, notes: null,
        })
        created += 1
      }
    }
    return created
  }

  async assign(shiftId: string, personId: string): Promise<void> {
    this.requireAdmin('assign people to shifts')
    const shift = this.state.shifts.find((s) => s.id === shiftId)
    if (!shift) throw new Error('That shift no longer exists.')
    if (this.state.assignments.some((a) => a.shiftId === shiftId && a.personId === personId)) return
    this.state.assignments.push({
      id: `assignment-${this.state.assignments.length + 1}-${personId}`, shiftId, personId,
    })
  }

  async unassign(assignmentId: string): Promise<void> {
    this.requireAdmin('remove people from shifts')
    this.state.assignments = this.state.assignments.filter((a) => a.id !== assignmentId)
    this.state.attendance = this.state.attendance.filter((a) => a.assignmentId !== assignmentId)
  }

  async myShifts(): Promise<MyShift[]> {
    const me = this.me()
    return this.state.assignments
      .filter((a) => a.personId === me.id)
      .map((a) => {
        const shift = this.state.shifts.find((s) => s.id === a.shiftId)
        if (!shift) return null
        const area = this.state.areas.find((x) => x.id === shift.areaId)
        return {
          assignmentId: a.id,
          shiftId: shift.id,
          areaName: area?.name ?? 'Unknown area',
          date: shift.date,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          colleagues: this.state.assignments
            .filter((other) => other.shiftId === shift.id && other.personId !== me.id)
            .map((other) => this.state.people.find((p) => p.id === other.personId)?.fullName ?? '')
            .filter(Boolean)
            .sort(),
          status: this.state.attendance.find((at) => at.assignmentId === a.id)?.status ?? null,
        } satisfies MyShift
      })
      .filter((s): s is MyShift => s !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  async markAttendance(marks: AttendanceMark[]): Promise<void> {
    this.requireAdmin('record attendance')
    for (const mark of marks) {
      const assignment = this.state.assignments.find((a) => a.id === mark.assignmentId)
      if (!assignment) continue
      const shift = this.state.shifts.find((s) => s.id === assignment.shiftId)
      const minutes = mark.status === 'absent' || !shift
        ? 0
        : shiftLengthMinutes(shift.startsAt, shift.endsAt)
      const existing = this.state.attendance.find((a) => a.assignmentId === mark.assignmentId)
      if (existing) {
        existing.status = mark.status
        existing.minutes = minutes
      } else {
        this.state.attendance.push({ assignmentId: mark.assignmentId, status: mark.status, minutes })
      }
    }
  }

  async hoursBalances(): Promise<HoursBalance[]> {
    const me = this.me()
    const visible = me.role === 'admin'
      ? this.state.people
      : this.state.people.filter((p) => p.id === me.id)

    return visible
      .map((person) => {
        const mine = this.state.assignments.filter((a) => a.personId === person.id).map((a) => a.id)
        const marks = this.state.attendance.filter((a) => mine.includes(a.assignmentId))
        const credited = marks.reduce((sum, a) => sum + a.minutes, 0)
        const adjustment = this.state.adjustments
          .filter((a) => a.personId === person.id)
          .reduce((sum, a) => sum + a.minutes, 0)
        const target = Math.round(person.targetHours * 60)
        return {
          personId: person.id,
          fullName: person.fullName,
          role: person.role,
          targetMinutes: target,
          creditedMinutes: credited,
          adjustmentMinutes: adjustment,
          balanceMinutes: credited + adjustment - target,
          minusMinutes: Math.max(0, target - credited - adjustment),
          excusedDays: marks.filter((a) => a.status === 'excused').length,
        } satisfies HoursBalance
      })
      .sort((a, b) => a.balanceMinutes - b.balanceMinutes)
  }

  async addAdjustment(personId: string, minutes: number, reason: string): Promise<void> {
    this.requireAdmin('correct hours')
    this.state.adjustments.push({
      personId, minutes, reason, happenedOn: toIsoDate(new Date()),
    })
  }
}
