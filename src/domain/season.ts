/**
 * How long a work afternoon is.
 *
 * Tuesday is three hours all year. Friday is three hours while European summer
 * time is running and two and a half hours while it is not, because the light
 * goes. The number is a suggestion and every entry may change it, for a late
 * arrival, an early leave or illness.
 */

const DAY_IN_MS = 86_400_000

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) throw new Error(`not an ISO date: ${iso}`)
  return new Date(Date.UTC(year, month - 1, day))
}

/** The last Sunday of a month, as an ISO date. `month` is 1 for January. */
export function lastSundayOf(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0))
  lastDay.setUTCDate(lastDay.getUTCDate() - lastDay.getUTCDay())
  return lastDay.toISOString().slice(0, 10)
}

/**
 * European summer time: from the last Sunday in March to the last Sunday in
 * October. The clocks move at 01:00 co-ordinated universal time, and this works
 * a whole day at a time, which is the granularity a work afternoon needs.
 */
export function isSummerTime(iso: string): boolean {
  const year = parseIso(iso).getUTCFullYear()
  return iso >= lastSundayOf(year, 3) && iso < lastSundayOf(year, 10)
}

/** 1 is Monday and 7 is Sunday. */
export function weekdayOf(iso: string): number {
  const day = parseIso(iso).getUTCDay()
  return day === 0 ? 7 : day
}

export const TUESDAY = 2
export const FRIDAY = 5

/** Tuesday and Friday afternoons are the programme. Anything else is extra. */
export function isWorkDay(iso: string): boolean {
  const weekday = weekdayOf(iso)
  return weekday === TUESDAY || weekday === FRIDAY
}

export function suggestedDurationHours(iso: string): number {
  if (weekdayOf(iso) === FRIDAY && !isSummerTime(iso)) return 2.5
  return 3
}

export function addDays(iso: string, days: number): string {
  return new Date(parseIso(iso).getTime() + days * DAY_IN_MS).toISOString().slice(0, 10)
}
