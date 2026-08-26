import { describe, expect, it } from 'vitest'
import {
  isSummerTime, isWorkDay, lastSundayOf, suggestedDurationHours, weekdayOf,
} from '../../src/domain/season'

// Every date below was checked against the system calendar, not against this
// code, so the test cannot agree with a bug in the thing it tests.
describe('European summer time', () => {
  it('starts on the last Sunday in March and ends on the last Sunday in October', () => {
    expect(lastSundayOf(2026, 3)).toBe('2026-03-29')
    expect(lastSundayOf(2026, 10)).toBe('2026-10-25')
  })

  it('handles a month whose last day is itself a Sunday', () => {
    expect(lastSundayOf(2027, 10)).toBe('2027-10-31')
    expect(lastSundayOf(2027, 3)).toBe('2027-03-28')
  })

  it('is inclusive at the start and exclusive at the end', () => {
    expect(isSummerTime('2026-03-28')).toBe(false)
    expect(isSummerTime('2026-03-29')).toBe(true)
    expect(isSummerTime('2026-10-24')).toBe(true)
    expect(isSummerTime('2026-10-25')).toBe(false)
  })
})

describe('the work afternoons', () => {
  it('counts Tuesday and Friday, and nothing else', () => {
    expect(weekdayOf('2026-08-25')).toBe(2)
    expect(weekdayOf('2026-08-28')).toBe(5)
    expect(isWorkDay('2026-08-25')).toBe(true)
    expect(isWorkDay('2026-08-28')).toBe(true)
    expect(isWorkDay('2026-08-26')).toBe(false)
    expect(isWorkDay('2026-08-30')).toBe(false)
  })
})

describe('the suggested duration', () => {
  it('gives Tuesday three hours all year', () => {
    expect(suggestedDurationHours('2026-08-25')).toBe(3)
    expect(suggestedDurationHours('2026-11-24')).toBe(3)
    expect(suggestedDurationHours('2026-01-06')).toBe(3)
  })

  it('gives Friday three hours in summer and two and a half in winter', () => {
    expect(suggestedDurationHours('2026-08-28')).toBe(3)
    expect(suggestedDurationHours('2026-11-27')).toBe(2.5)
  })

  it('changes on the Friday either side of each clock change', () => {
    expect(suggestedDurationHours('2026-03-27')).toBe(2.5)
    expect(suggestedDurationHours('2026-04-03')).toBe(3)
    expect(suggestedDurationHours('2026-10-23')).toBe(3)
    expect(suggestedDurationHours('2026-10-30')).toBe(2.5)
  })

  it('is only ever a suggestion, so a caller may ignore it', () => {
    // Nothing here forces the number. The rule for a day that is neither
    // Tuesday nor Friday is three hours, matching the prototype.
    expect(suggestedDurationHours('2026-08-26')).toBe(3)
  })
})
