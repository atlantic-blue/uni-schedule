/**
 * One evaluation per entry, filled by a Leiter.
 *
 * The document names the four things and the ends of the first scale,
 * "oberflaechlich" to "gruendlich", but never says how many steps a scale has.
 * One to five is this build's guess and is written down as open.
 */

export type Rating = 1 | 2 | 3 | 4 | 5

export const RATINGS: Rating[] = [1, 2, 3, 4, 5]

export interface Evaluation {
  entryId: string
  /** Oberflaechlich to gruendlich. */
  thoroughness: Rating
  motivation: Rating
  interpersonalConduct: Rating
  taskCompliance: boolean
}

export const THOROUGHNESS_ENDS = { low: 'oberflaechlich', high: 'gruendlich' } as const

export function isComplete(evaluation: Partial<Evaluation>): evaluation is Evaluation {
  return typeof evaluation.entryId === 'string'
    && RATINGS.includes(evaluation.thoroughness as Rating)
    && RATINGS.includes(evaluation.motivation as Rating)
    && RATINGS.includes(evaluation.interpersonalConduct as Rating)
    && typeof evaluation.taskCompliance === 'boolean'
}
