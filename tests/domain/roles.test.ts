import { describe, expect, it } from 'vitest'
import {
  canApproveAccounts, canEditProfile, canReadPerson, canSeeMinusHours,
  canWriteEntryFor, isHiddenFromLists, visiblePeople, type Actor, type Role,
} from '../../src/domain/roles'

const kueche = 'Kueche'
const park = 'Park'

const actor = (role: Role, personId: string, groupName: string | null = null): Actor =>
  ({ role, personId, groupName })

const head = actor('head_leiter', 'head')
const leiter = actor('leiter', 'ada')
const aufsicht = actor('aufsicht', 'sam', kueche)
const bogianer = actor('bogianer', 'oli', kueche)

const sam = { personId: 'sam', groupName: kueche }
const oli = { personId: 'oli', groupName: kueche }
const noah = { personId: 'noah', groupName: park }

describe('a Leiter reaches the whole college', () => {
  it('reads and writes anybody', () => {
    for (const supervisor of [leiter, head]) {
      expect(canReadPerson(supervisor, noah)).toBe(true)
      expect(canWriteEntryFor(supervisor, noah)).toBe(true)
      expect(canEditProfile(supervisor)).toBe(true)
      expect(canApproveAccounts(supervisor)).toBe(true)
    }
  })
})

describe('an Aufsicht reaches their own group and stops there', () => {
  it('reads and writes an entry for somebody in their group', () => {
    expect(canReadPerson(aufsicht, oli)).toBe(true)
    expect(canWriteEntryFor(aufsicht, oli)).toBe(true)
  })

  it('reaches nobody in another group', () => {
    expect(canReadPerson(aufsicht, noah)).toBe(false)
    expect(canWriteEntryFor(aufsicht, noah)).toBe(false)
  })

  it('may not edit a profile or approve an account', () => {
    expect(canEditProfile(aufsicht)).toBe(false)
    expect(canApproveAccounts(aufsicht)).toBe(false)
  })

  it('supervises nobody while they hold no group', () => {
    const spare = actor('aufsicht', 'sam', null)
    expect(canWriteEntryFor(spare, oli)).toBe(false)
  })
})

describe('a Bogianer sees themselves and writes nothing', () => {
  it('reads their own record', () => {
    expect(canReadPerson(bogianer, oli)).toBe(true)
  })

  it('does not read somebody else in the same group', () => {
    expect(canReadPerson(bogianer, sam)).toBe(false)
  })

  it('writes no entry, not even their own', () => {
    expect(canWriteEntryFor(bogianer, oli)).toBe(false)
    expect(canEditProfile(bogianer)).toBe(false)
  })
})

describe('minus hours are anonymous from everybody else', () => {
  it('shows a person their own number', () => {
    expect(canSeeMinusHours(bogianer, oli)).toBe(true)
  })

  it('shows a Leiter every number', () => {
    expect(canSeeMinusHours(leiter, oli)).toBe(true)
    expect(canSeeMinusHours(head, oli)).toBe(true)
  })

  it('hides a group member’s number from their own Aufsicht', () => {
    // The Aufsicht records the sessions and never sees the running total.
    expect(canWriteEntryFor(aufsicht, oli)).toBe(true)
    expect(canSeeMinusHours(aufsicht, oli)).toBe(false)
  })

  it('hides one student’s number from another', () => {
    expect(canSeeMinusHours(bogianer, sam)).toBe(false)
  })
})

describe('the Head-Leiter is invisible', () => {
  it('is hidden from lists and no other role is', () => {
    expect(isHiddenFromLists('head_leiter')).toBe(true)
    for (const role of ['leiter', 'aufsicht', 'bogianer'] as Role[]) {
      expect(isHiddenFromLists(role)).toBe(false)
    }
  })

  it('is left out of a list even for a Leiter', () => {
    const people = [
      { personId: 'head', groupName: null, role: 'head_leiter' as Role },
      { personId: 'oli', groupName: kueche, role: 'bogianer' as Role },
      { personId: 'noah', groupName: park, role: 'bogianer' as Role },
    ]
    expect(visiblePeople(leiter, people).map((p) => p.personId)).toEqual(['oli', 'noah'])
  })

  it('gives an Aufsicht only their own group', () => {
    const people = [
      { personId: 'head', groupName: null, role: 'head_leiter' as Role },
      { personId: 'oli', groupName: kueche, role: 'bogianer' as Role },
      { personId: 'noah', groupName: park, role: 'bogianer' as Role },
    ]
    expect(visiblePeople(aufsicht, people).map((p) => p.personId)).toEqual(['oli'])
  })
})
