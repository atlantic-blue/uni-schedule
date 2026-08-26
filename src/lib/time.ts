// Dates are plain ISO strings, for example 2026-08-25, and never Date objects in
// state. A Date carries a time zone, and a shift on the 25th must stay on the
// 25th for somebody reading it from another country.

const DAY_IN_MS = 86_400_000

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) throw new Error(`not an ISO date: ${iso}`)
  return new Date(Date.UTC(year, month - 1, day))
}

export function addDays(iso: string, days: number): string {
  return toIsoDate(new Date(parseIso(iso).getTime() + days * DAY_IN_MS))
}

/** 1 is Monday, 7 is Sunday, the way the templates store it. */
export function weekdayOf(iso: string): number {
  const day = parseIso(iso).getUTCDay()
  return day === 0 ? 7 : day
}

export function mondayOf(iso: string): string {
  return addDays(iso, 1 - weekdayOf(iso))
}

export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function isoWeekNumber(iso: string): number {
  const date = parseIso(iso)
  const thursday = new Date(date.getTime() + (4 - weekdayOf(iso)) * DAY_IN_MS)
  const firstOfYear = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  return Math.ceil(((thursday.getTime() - firstOfYear.getTime()) / DAY_IN_MS + 1) / 7)
}

export function formatDay(iso: string, locale = 'en-GB'): string {
  return parseIso(iso).toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

export function formatLongDay(iso: string, locale = 'en-GB'): string {
  return parseIso(iso).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })
}

/** 16:00:00 and 16:00 both become 16:00. */
export function formatTime(value: string): string {
  return value.slice(0, 5)
}

export function shiftLengthMinutes(startsAt: string, endsAt: string): number {
  const [startHour = 0, startMinute = 0] = startsAt.split(':').map(Number)
  const [endHour = 0, endMinute = 0] = endsAt.split(':').map(Number)
  return endHour * 60 + endMinute - (startHour * 60 + startMinute)
}

/** 750 becomes "12 h 30". Minus hours keep their sign: -75 becomes "-1 h 15". */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const total = Math.abs(Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${sign}${hours} h` : `${sign}${hours} h ${String(rest).padStart(2, '0')}`
}

export function isPast(iso: string, today: string): boolean {
  return iso < today
}
