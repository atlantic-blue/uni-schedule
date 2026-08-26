import type { WorkEntry } from './entry'

/**
 * Three separate numbers. The first model in this repository collapsed them
 * into one and was wrong, so they are named apart and never added together.
 *
 *  - total hours: what the person actually worked
 *  - balance: total against the semester target, plus or minus
 *  - minus hours: missed unexcused sessions, counted per session
 *
 * Excused means no minus hours. That is the whole rule. An excused absence does
 * not credit hours either: it simply costs nothing.
 */

export interface HoursSummary {
  totalHours: number
  extraHours: number
  targetHours: number
  /** Total minus target. Positive is ahead, negative is behind. */
  balanceHours: number
  /** How many regular sessions were missed without an excuse. The headline. */
  missedUnexcusedSessions: number
  /** What those sessions were worth, before extra hours are taken off. */
  owedHours: number
  /** What is left to work off or pay once extra hours are applied. */
  outstandingMinusHours: number
}

const isCredited = (entry: WorkEntry): boolean => entry.present

const isMissedUnexcused = (entry: WorkEntry): boolean =>
  !entry.present && !entry.excused && entry.entryType === 'regular'

function sum(entries: WorkEntry[], of: (entry: WorkEntry) => number): number {
  // Durations come in quarter hours, so the total is rounded to two places to
  // keep 0.1 + 0.2 out of the interface.
  return Math.round(entries.reduce((running, entry) => running + of(entry), 0) * 100) / 100
}

export function summarise(entries: WorkEntry[], targetHours: number): HoursSummary {
  const present = entries.filter(isCredited)
  const missed = entries.filter(isMissedUnexcused)

  const totalHours = sum(present, (entry) => entry.durationHours)
  const extraHours = sum(
    present.filter((entry) => entry.entryType === 'extra'), (entry) => entry.durationHours,
  )
  const owedHours = sum(missed, (entry) => entry.durationHours)

  return {
    totalHours,
    extraHours,
    targetHours,
    balanceHours: Math.round((totalHours - targetHours) * 100) / 100,
    missedUnexcusedSessions: missed.length,
    owedHours,
    // Extra hours offset minus hours, and never turn them into credit.
    outstandingMinusHours: Math.max(0, Math.round((owedHours - extraHours) * 100) / 100),
  }
}

/** German writes a decimal comma, so 2.5 hours reads "2,5 h". */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100
  return `${String(rounded).replace('.', ',')} h`
}

export function formatBalance(hours: number): string {
  return hours > 0 ? `+${formatHours(hours)}` : formatHours(hours)
}

/**
 * The Status column on the planning list and the people list. An absence today
 * shows the reason. Otherwise it shows the balance.
 */
export function statusLabel(
  entries: WorkEntry[], targetHours: number, today: string,
): string {
  const absentToday = entries.find((entry) => entry.date === today && !entry.present)
  if (absentToday) {
    if (absentToday.excused) return absentToday.reason || 'entschuldigt'
    return 'unentschuldigt'
  }
  return formatBalance(summarise(entries, targetHours).balanceHours)
}
