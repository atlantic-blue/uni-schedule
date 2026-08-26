import type { RoleType } from './targetHours'

export type EntryType = 'regular' | 'extra'
export type Punctuality = 'on_time' | 'late'

/** One record per person per session. */
export interface WorkEntry {
  id: string
  personId: string
  /** ISO date. */
  date: string
  entryType: EntryType
  /** Hours. Suggested from the season and then editable. */
  durationHours: number
  present: boolean
  /** Only meaningful when absent. Excused means no minus hours. */
  excused: boolean
  /** Free text, autocompleted from what has been typed before. */
  reason: string
  /** Only meaningful when present. */
  punctuality: Punctuality | null
  comment: string
  /** Overrides the person's default special status for this entry alone. */
  specialStatus: string
  /** True when the birthday rule excused this absence. */
  birthdayExcuse: boolean
}

export interface Person {
  id: string
  firstName: string
  lastName: string
  className: string | null
  year: string | null
  department: string | null
  /** ISO date. Drives the birthday rule. */
  birthday: string | null
  groupType: 'shared' | 'individual'
  /** The area name, or null for an individual task. */
  groupName: string | null
  roleType: RoleType
  targetHours: number
  /** Fills the reason on a new entry, for example "Projekt Salzburg". */
  defaultSpecialStatus: string
  isAufsicht: boolean
}
