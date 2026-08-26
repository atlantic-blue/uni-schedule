/**
 * The work areas, assigned once a year at the start of the semester. Taken
 * from the requirements document, in its order, spelled as it spells them.
 *
 * Some Bogianer have an individual task and belong to no area at all, which is
 * why this list is a suggestion for the area field and never a constraint on it.
 */

export const AREAS = [
  'BGM',
  'Bibliothek',
  'Bogi-Zeitung',
  'BH',
  'EDV',
  'Garten',
  'Gemeindezentrum',
  'Hausmeisterei',
  'Hauswirtschaft',
  'Kapelle',
  'Kueche',
  'Mensa',
  'MH',
  'Memory-Buch',
  'Muellaktion',
  'Orchesteraufbau',
  'Park',
  'Pikadeum',
  'Schloss',
  'Speisesaal',
  'Spuelkueche',
  'Turnhalle',
  'Sabbatschule-Aufnahmen',
  'Dekoteam',
  'Technik',
  'Projekt',
] as const

export type Area = (typeof AREAS)[number]

/** Dekoteam and Technik are the Gebetswoche teams. Projekt carries a detail. */
export const AREA_NOTE: Partial<Record<Area, string>> = {
  Dekoteam: 'Gebetswoche',
  Technik: 'Gebetswoche',
  Projekt: 'mit Detail, zum Beispiel Salzburg',
}

export type GroupType = 'shared' | 'individual'
