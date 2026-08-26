import { describe, expect, it } from 'vitest'
import { AREAS } from '../../src/domain/areas'
import { DEFAULT_TARGET_HOURS, ROLE_TYPES, defaultTargetHours } from '../../src/domain/targetHours'
import { RATINGS, THOROUGHNESS_ENDS, isComplete } from '../../src/domain/evaluation'
import { de } from '../../src/i18n/de'

describe('the areas', () => {
  it('carries every area the document names, in its order', () => {
    expect(AREAS).toHaveLength(26)
    expect(AREAS[0]).toBe('BGM')
    expect(AREAS.at(-1)).toBe('Projekt')
    for (const area of ['Kueche', 'Speisesaal', 'Park', 'Spuelkueche', 'Turnhalle',
      'Sabbatschule-Aufnahmen', 'Dekoteam', 'Technik']) {
      expect(AREAS).toContain(area)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(AREAS).size).toBe(AREAS.length)
  })
})

describe('target hours by role type', () => {
  it('uses the four numbers from the document', () => {
    expect(DEFAULT_TARGET_HOURS).toEqual({
      ts_intern: 131.5, ts_extern: 79, org_intern: 146.5, org_extern: 94,
    })
  })

  it('gives every role type a default', () => {
    expect(ROLE_TYPES).toHaveLength(4)
    for (const roleType of ROLE_TYPES) expect(defaultTargetHours(roleType)).toBeGreaterThan(0)
  })
})

describe('evaluation', () => {
  it('names the ends of the thoroughness scale in German', () => {
    expect(THOROUGHNESS_ENDS.low).toBe('oberflaechlich')
    expect(THOROUGHNESS_ENDS.high).toBe('gruendlich')
  })

  it('is incomplete until all four are answered', () => {
    expect(isComplete({ entryId: 'e1', thoroughness: 3, motivation: 3 })).toBe(false)
    expect(isComplete({
      entryId: 'e1', thoroughness: 3, motivation: 4, interpersonalConduct: 5,
      taskCompliance: false,
    })).toBe(true)
  })

  it('rejects a rating outside the scale', () => {
    expect(isComplete({
      entryId: 'e1', thoroughness: 9 as never, motivation: 4,
      interpersonalConduct: 5, taskCompliance: true,
    })).toBe(false)
    expect(RATINGS).toEqual([1, 2, 3, 4, 5])
  })
})

describe('the interface language', () => {
  it('is German', () => {
    expect(de.nav.home).toBe('Startseite')
    expect(de.nav.planning).toBe('Planung')
    expect(de.nav.list).toBe('Liste')
    expect(de.entry.excused).toContain('Minusstunden')
    expect(de.roles.aufsicht).toBe('Aufsicht')
  })

  it('names the two work days in the warning, in German', () => {
    expect(de.entry.notAWorkDay).toContain('Dienstag')
    expect(de.entry.notAWorkDay).toContain('Freitag')
  })
})
