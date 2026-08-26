import { describe, expect, it } from 'vitest'
import { formatBalance, formatHours, statusLabel, summarise } from '../../src/domain/hours'
import type { EntryType, WorkEntry } from '../../src/domain/entry'

let counter = 0
function entry(partial: Partial<WorkEntry> & { date: string }): WorkEntry {
  counter += 1
  return {
    id: `e${counter}`,
    personId: 'p1',
    entryType: 'regular' as EntryType,
    durationHours: 3,
    present: true,
    excused: false,
    reason: '',
    punctuality: 'on_time',
    comment: '',
    specialStatus: '',
    birthdayExcuse: false,
    ...partial,
  }
}

const TARGET = 131.5 // ts_intern

describe('the three numbers stay apart', () => {
  it('counts hours worked, and a balance against the target', () => {
    const summary = summarise(
      [entry({ date: '2026-08-25' }), entry({ date: '2026-08-28' })], TARGET,
    )
    expect(summary.totalHours).toBe(6)
    expect(summary.targetHours).toBe(131.5)
    expect(summary.balanceHours).toBe(-125.5)
  })

  it('does not turn a shortfall against the target into minus hours', () => {
    // Somebody who has worked nothing yet is 131.5 hours behind and has zero
    // minus hours, because they have missed nothing.
    const summary = summarise([], TARGET)
    expect(summary.balanceHours).toBe(-131.5)
    expect(summary.missedUnexcusedSessions).toBe(0)
    expect(summary.outstandingMinusHours).toBe(0)
  })
})

describe('excused means no minus hours, and that is the whole rule', () => {
  it('gives an excused absence no minus hours and no credit', () => {
    const summary = summarise(
      [entry({ date: '2026-08-25', present: false, excused: true, reason: 'Krank' })], TARGET,
    )
    expect(summary.missedUnexcusedSessions).toBe(0)
    expect(summary.outstandingMinusHours).toBe(0)
    expect(summary.totalHours).toBe(0)
  })

  it('counts one minus session per missed unexcused afternoon', () => {
    const summary = summarise([
      entry({ date: '2026-08-25', present: false, excused: false }),
      entry({ date: '2026-08-28', present: false, excused: false, durationHours: 2.5 }),
    ], TARGET)
    expect(summary.missedUnexcusedSessions).toBe(2)
    expect(summary.owedHours).toBe(5.5)
  })

  it('does not count a missed extra session as a minus session', () => {
    const summary = summarise(
      [entry({ date: '2026-08-26', entryType: 'extra', present: false, excused: false })], TARGET,
    )
    expect(summary.missedUnexcusedSessions).toBe(0)
  })
})

describe('extra hours offset minus hours', () => {
  it('takes extra hours off what is outstanding', () => {
    const summary = summarise([
      entry({ date: '2026-08-25', present: false, excused: false }), // owes 3
      entry({ date: '2026-08-26', entryType: 'extra', durationHours: 2 }), // works 2
    ], TARGET)
    expect(summary.owedHours).toBe(3)
    expect(summary.extraHours).toBe(2)
    expect(summary.outstandingMinusHours).toBe(1)
  })

  it('never lets extra hours push what is outstanding below zero', () => {
    const summary = summarise([
      entry({ date: '2026-08-25', present: false, excused: false }), // owes 3
      entry({ date: '2026-08-26', entryType: 'extra', durationHours: 10 }),
    ], TARGET)
    expect(summary.outstandingMinusHours).toBe(0)
    // The surplus still counts towards the hours worked, so it is not lost.
    expect(summary.totalHours).toBe(10)
  })

  it('keeps the session count even once the hours are worked off', () => {
    const summary = summarise([
      entry({ date: '2026-08-25', present: false, excused: false }),
      entry({ date: '2026-08-26', entryType: 'extra', durationHours: 3 }),
    ], TARGET)
    expect(summary.outstandingMinusHours).toBe(0)
    expect(summary.missedUnexcusedSessions).toBe(1)
  })
})

describe('reading the numbers in German', () => {
  it('writes a decimal comma', () => {
    expect(formatHours(2.5)).toBe('2,5 h')
    expect(formatHours(3)).toBe('3 h')
    expect(formatBalance(-125.5)).toBe('-125,5 h')
    expect(formatBalance(4)).toBe('+4 h')
  })

  it('does not let quarter hours drift', () => {
    const summary = summarise([
      entry({ date: '2026-08-25', durationHours: 0.1 }),
      entry({ date: '2026-08-28', durationHours: 0.2 }),
    ], 0)
    expect(summary.totalHours).toBe(0.3)
    expect(formatHours(summary.totalHours)).toBe('0,3 h')
  })
})

describe('the status column', () => {
  const today = '2026-08-25'

  it('shows the reason when the person is excused today', () => {
    expect(statusLabel(
      [entry({ date: today, present: false, excused: true, reason: 'Projekt Salzburg' })],
      TARGET, today,
    )).toBe('Projekt Salzburg')
  })

  it('says unentschuldigt when the absence today has no excuse', () => {
    expect(statusLabel(
      [entry({ date: today, present: false, excused: false })], TARGET, today,
    )).toBe('unentschuldigt')
  })

  it('shows the balance on any other day', () => {
    expect(statusLabel([entry({ date: '2026-08-21' })], 3, today)).toBe('0 h')
  })
})
