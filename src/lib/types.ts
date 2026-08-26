export type PersonRole = 'admin' | 'student' | 'guest'
export type AttendanceStatus = 'worked' | 'excused' | 'absent'

export interface Person {
  id: string
  fullName: string
  role: PersonRole
  active: boolean
}

export interface Area {
  id: string
  name: string
  description: string | null
  places: number
  sortOrder: number
  active: boolean
}

export interface Assignment {
  id: string
  personId: string
  personName: string
}

export interface Shift {
  id: string
  areaId: string
  areaName: string
  date: string // ISO date, for example 2026-08-25
  startsAt: string // 16:00
  endsAt: string // 20:00
  places: number
  notes: string | null
  assignments: Assignment[]
}

export interface MyShift {
  assignmentId: string
  shiftId: string
  areaName: string
  date: string
  startsAt: string
  endsAt: string
  colleagues: string[]
  status: AttendanceStatus | null
}

export interface HoursBalance {
  personId: string
  fullName: string
  role: PersonRole
  targetMinutes: number
  creditedMinutes: number
  adjustmentMinutes: number
  balanceMinutes: number
  minusMinutes: number
  excusedDays: number
}

export interface Adjustment {
  id: string
  personId: string
  minutes: number
  reason: string
  happenedOn: string
}

export interface AttendanceMark {
  assignmentId: string
  status: AttendanceStatus
}
