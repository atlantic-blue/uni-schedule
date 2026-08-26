import { describe, expect, it } from 'vitest'
import { AREAS, AREA_NOTE } from '../../src/domain/areas'
import {
  DEFAULT_TARGET_HOURS, ROLE_TYPES, defaultTargetHours,
} from '../../src/domain/targetHours'
import { RATINGS, isComplete, type Evaluation } from '../../src/domain/evaluation'

describe('target hours by role type', () => {
  it('carries the four numbers the document gives, exactly', () => {
    expect(defaultTargetHours('ts_intern')).toBe(131.5)
    expect(defaultTargetHours('ts_extern')).toBe(79)
    expect(defaultTargetHours('org_intern')).toBe(146.5)
    expect(defaultTargetHours('org_extern')).toBe(94)
  })

  it('has a number for every role type and no extra ones', () => {
    expect(ROLE_TYPES).toHaveLength(4)
    expect(Object.keys(DEFAULT_TARGET_HOURS).sort()).toEqual([...ROLE_TYPES].sort())
  })

  it('does not treat a target as a source of minus hours', () => {
    // Kept as a reminder in code: the target drives the balance, never the
    // minus count. The arithmetic for that lives in hours.test.ts.
    expect(defaultTargetHours('ts_extern')).toBeLessThan(defaultTargetHours('org_extern'))
  })
})

describe('the areas', () => {
  it('holds the twenty six the document lists', () => {
    expect(AREAS).toHaveLength(26)
  })

  it('names no area twice', () => {
    expect(new Set(AREAS).size).toBe(AREAS.length)
  })

  it('keeps the document order, first and last', () => {
    expect(AREAS[0]).toBe('BGM')
    expect(AREAS[AREAS.length - 1]).toBe('Projekt')
  })

  it('marks the two Gebetswoche teams', () => {
    expect(AREA_NOTE.Dekoteam).toBe('Gebetswoche')
    expect(AREA_NOTE.Technik).toBe('Gebetswoche')
  })
})

describe('an evaluation', () => {
  const full: Evaluation = {
    entryId: 'e1', thoroughness: 4, motivation: 3,
    interpersonalConduct: 5, taskCompliance: true,
  }

  it('is complete when all four are filled in', () => {
    expect(isComplete(full)).toBe(true)
  })

  it('is incomplete while any one is missing', () => {
    for (const key of ['thoroughness', 'motivation', 'interpersonalConduct', 'taskCompliance']) {
      const partial: Record<string, unknown> = { ...full }
      delete partial[key]
      expect(isComplete(partial)).toBe(false)
    }
  })

  it('refuses a rating outside the scale', () => {
    expect(isComplete({ ...full, thoroughness: 0 as never })).toBe(false)
    expect(isComplete({ ...full, motivation: 6 as never })).toBe(false)
  })

  it('takes task compliance as yes or no, never a rating', () => {
    expect(isComplete({ ...full, taskCompliance: 3 as never })).toBe(false)
    expect(isComplete({ ...full, taskCompliance: false })).toBe(true)
  })

  it('offers five steps, a guess that is written down as open', () => {
    expect(RATINGS).toEqual([1, 2, 3, 4, 5])
  })
})
