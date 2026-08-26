import { describe, expect, it } from 'vitest'
import {
  addDays, formatMinutes, isoWeekNumber, mondayOf, shiftLengthMinutes, weekdayOf,
} from '../src/lib/time'

describe('weeks', () => {
  it('treats Monday as the first day', () => {
    expect(weekdayOf('2026-08-24')).toBe(1)
    expect(weekdayOf('2026-08-30')).toBe(7)
  })

  it('finds the Monday of any day, and leaves a Monday alone', () => {
    expect(mondayOf('2026-08-27')).toBe('2026-08-24')
    expect(mondayOf('2026-08-30')).toBe('2026-08-24')
    expect(mondayOf('2026-08-24')).toBe('2026-08-24')
  })

  it('crosses a month and a year without drifting', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(mondayOf('2027-01-01')).toBe('2026-12-28')
  })

  it('numbers the week the way the calendar on the wall does', () => {
    expect(isoWeekNumber('2026-01-01')).toBe(1)
    expect(isoWeekNumber('2026-08-24')).toBe(35)
  })
})

describe('hours', () => {
  it('measures a shift in minutes', () => {
    expect(shiftLengthMinutes('16:00', '20:00')).toBe(240)
    expect(shiftLengthMinutes('09:30', '12:15')).toBe(165)
  })

  it('writes minutes the way a person reads them', () => {
    expect(formatMinutes(240)).toBe('4 h')
    expect(formatMinutes(750)).toBe('12 h 30')
    expect(formatMinutes(65)).toBe('1 h 05')
    expect(formatMinutes(-75)).toBe('-1 h 15')
    expect(formatMinutes(0)).toBe('0 h')
  })
})
