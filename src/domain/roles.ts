/**
 * The four roles, and what each one may do.
 *
 * These predicates are the rules themselves, kept away from any database. A
 * PostgreSQL build enforces them again as row level security; a DynamoDB build
 * enforces them in the handler. Either way the answer has to come out the same,
 * so it is written once, here, and tested here.
 */

export type Role = 'head_leiter' | 'leiter' | 'aufsicht' | 'bogianer'

export interface Actor {
  personId: string
  role: Role
  /** The group an Aufsicht supervises. Null for everybody else. */
  groupName: string | null
}

export interface Subject {
  personId: string
  groupName: string | null
}

/** A Leiter or the Head-Leiter. Full reach across the college. */
export function isSupervisor(actor: Actor): boolean {
  return actor.role === 'leiter' || actor.role === 'head_leiter'
}

/** An Aufsicht only reaches their own group, and only when they have one. */
function supervisesGroupOf(actor: Actor, subject: Subject): boolean {
  return actor.role === 'aufsicht'
    && actor.groupName !== null
    && actor.groupName === subject.groupName
}

export function canReadPerson(actor: Actor, subject: Subject): boolean {
  if (isSupervisor(actor)) return true
  if (actor.personId === subject.personId) return true
  return supervisesGroupOf(actor, subject)
}

/** Writing an entry is the Aufsicht's one power beyond reading. */
export function canWriteEntryFor(actor: Actor, subject: Subject): boolean {
  if (isSupervisor(actor)) return true
  return supervisesGroupOf(actor, subject)
}

/** Only a Leiter edits a profile. An Aufsicht records attendance, nothing more. */
export function canEditProfile(actor: Actor): boolean {
  return isSupervisor(actor)
}

/** A pending Leiter registration is approved by an approved Leiter. */
export function canApproveAccounts(actor: Actor): boolean {
  return isSupervisor(actor)
}

/**
 * Minus hours are the number somebody is judged on, so they are the most
 * private thing here. Section 6 says a Bogianer sees only their own and that it
 * is anonymous from everybody else. Section 2 gives an Aufsicht their group.
 * The two collide on exactly this number, and the narrower rule wins: an
 * Aufsicht records the sessions and never sees a running total.
 */
export function canSeeMinusHours(actor: Actor, subject: Subject): boolean {
  if (isSupervisor(actor)) return true
  return actor.personId === subject.personId
}

/** The Head-Leiter never appears in a list, to anybody. */
export function isHiddenFromLists(role: Role): boolean {
  return role === 'head_leiter'
}

export function visiblePeople<T extends Subject & { role: Role }>(
  actor: Actor, people: T[],
): T[] {
  return people
    .filter((person) => !isHiddenFromLists(person.role))
    .filter((person) => canReadPerson(actor, person))
}
