import { describe, expect, it } from 'vitest'
import { BIRTHDAY_REASON, birthdayExcuse, isBirthday } from '../../src/domain/birthday'

describe('the birthday exception', () => {
  it('matches on month and day, so it fires every year', () => {
    expect(isBirthday('2004-08-25', '2026-08-25')).toBe(true)
    expect(isBirthday('2004-08-25', '2027-08-25')).toBe(true)
    expect(isBirthday('2004-08-25', '2026-08-26')).toBe(false)
    expect(isBirthday(null, '2026-08-25')).toBe(false)
  })

  it('excuses an absence on a birthday that falls on a work afternoon', () => {
    // 2026-08-25 is a Tuesday.
    expect(birthdayExcuse('2004-08-25', '2026-08-25')).toEqual({
      excused: true, reason: BIRTHDAY_REASON,
    })
  })

  it('writes the reason in German, because the college does', () => {
    expect(BIRTHDAY_REASON).toBe('Geburtstag')
  })

  it('does not fire on a birthday that is not a work afternoon', () => {
    // 2026-08-26 is a Wednesday. The document ties the rule to Tuesday and
    // Friday; the prototype fires on any day, and the document wins.
    expect(birthdayExcuse('2004-08-26', '2026-08-26')).toBeNull()
  })

  it('does not fire for somebody with no birthday recorded', () => {
    expect(birthdayExcuse(null, '2026-08-25')).toBeNull()
  })
})
