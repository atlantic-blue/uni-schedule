/**
 * Target hours for a semester. The number follows the role type and stays
 * editable, because the document says it varies by role and by holidays.
 *
 * What TS and Org stand for is not written down anywhere in the source
 * material. The names are kept exactly as the document gives them rather than
 * expanded into a guess.
 */

export type RoleType = 'ts_intern' | 'ts_extern' | 'org_intern' | 'org_extern'

export const ROLE_TYPES: RoleType[] = ['ts_intern', 'ts_extern', 'org_intern', 'org_extern']

export const DEFAULT_TARGET_HOURS: Record<RoleType, number> = {
  ts_intern: 131.5,
  ts_extern: 79,
  org_intern: 146.5,
  org_extern: 94,
}

/** What the interface calls each one. The interface is German. */
export const ROLE_TYPE_LABEL: Record<RoleType, string> = {
  ts_intern: 'TS intern',
  ts_extern: 'TS extern',
  org_intern: 'Org intern',
  org_extern: 'Org extern',
}

export function defaultTargetHours(roleType: RoleType): number {
  return DEFAULT_TARGET_HOURS[roleType]
}
