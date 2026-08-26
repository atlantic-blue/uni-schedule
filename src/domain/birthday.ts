import { isWorkDay } from './season'

/** The reason the college writes. It is German and it is not translated. */
export const BIRTHDAY_REASON = 'Geburtstag'

/** Matches on month and day, so it fires every year. */
export function isBirthday(birthday: string | null, iso: string): boolean {
  if (!birthday) return false
  return birthday.slice(5, 10) === iso.slice(5, 10)
}

/**
 * An absence on a birthday that falls on a work afternoon is excused
 * automatically, with the reason "Geburtstag". A supervisor cannot take it
 * away, which is why this returns the whole decision rather than a hint.
 *
 * The document ties the rule to Tuesday and Friday. The prototype applies it on
 * any date. The document wins.
 */
export function birthdayExcuse(
  birthday: string | null, iso: string,
): { excused: true; reason: string } | null {
  if (!isBirthday(birthday, iso) || !isWorkDay(iso)) return null
  return { excused: true, reason: BIRTHDAY_REASON }
}
