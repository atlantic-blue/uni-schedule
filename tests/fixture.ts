import { DemoApi, type DemoState } from '../src/lib/demoApi'

export const TODAY = '2026-08-25' // a Tuesday
export const YESTERDAY = '2026-08-24'
export const THURSDAY = '2026-08-27'

/**
 * A group small enough to read in a failure message: one administrator, two
 * students, one area with two places, one shift behind and one ahead.
 */
export function smallGroup(): DemoState {
  return {
    people: [
      { id: 'ada', fullName: 'Ada Ostrowski', role: 'admin', active: true, email: 'ada@example.edu', targetHours: 0 },
      { id: 'sam', fullName: 'Sam Weber', role: 'student', active: true, email: 'sam@example.edu', targetHours: 8 },
      { id: 'oli', fullName: 'Oli Novak', role: 'student', active: true, email: 'oli@example.edu', targetHours: 8 },
    ],
    areas: [
      { id: 'kitchen', name: 'Kitchen', description: 'Preparation', places: 2, sortOrder: 1, active: true },
    ],
    shifts: [
      { id: 'past', areaId: 'kitchen', date: YESTERDAY, startsAt: '16:00', endsAt: '20:00', places: 2, notes: null },
      { id: 'soon', areaId: 'kitchen', date: THURSDAY, startsAt: '16:00', endsAt: '20:00', places: 2, notes: null },
    ],
    assignments: [
      { id: 'a1', shiftId: 'past', personId: 'sam' },
      { id: 'a2', shiftId: 'soon', personId: 'sam' },
    ],
    attendance: [],
    adjustments: [],
    signedInAs: null,
  }
}

export function apiFor(personId: string): DemoApi {
  return new DemoApi(smallGroup(), personId)
}
