/**
 * History difficulty (issue #47): how much help the globe gives while you hunt
 * for a place. This is DISTINCT from a Round's scoring `Difficulty` (which only
 * sets the points multiplier in scoring.ts) — this controls what the map draws.
 *
 *   Easy   → borders & names   (Esri reference raster)
 *   Medium → borders, no names (offline vector country outlines)
 *   Hard   → neither           (bare satellite)
 */

export type HistoryDifficulty = 'easy' | 'medium' | 'hard'

/**
 * How much detail the globe renders for a run:
 * - 'labeled' — country borders AND place names
 * - 'borders' — country outlines only, no names
 * - 'plain'   — bare satellite, no borders or names
 */
export type MapDetail = 'labeled' | 'borders' | 'plain'

export const HISTORY_DIFFICULTIES: HistoryDifficulty[] = ['easy', 'medium', 'hard']

export const DEFAULT_HISTORY_DIFFICULTY: HistoryDifficulty = 'easy'

const MAP_DETAIL: Record<HistoryDifficulty, MapDetail> = {
  easy: 'labeled',
  medium: 'borders',
  hard: 'plain',
}

/** Which map layers a given difficulty shows. */
export function mapDetailFor(difficulty: HistoryDifficulty): MapDetail {
  return MAP_DETAIL[difficulty]
}

export function isHistoryDifficulty(value: unknown): value is HistoryDifficulty {
  return value === 'easy' || value === 'medium' || value === 'hard'
}

/** Coerce arbitrary input (a query param, localStorage) to a valid difficulty. */
export function toHistoryDifficulty(value: unknown): HistoryDifficulty {
  return isHistoryDifficulty(value) ? value : DEFAULT_HISTORY_DIFFICULTY
}

/** Short label + one-line hint for the picker UI. */
export const DIFFICULTY_META: Record<HistoryDifficulty, { label: string; hint: string }> = {
  easy: { label: 'Easy', hint: 'Borders & names' },
  medium: { label: 'Medium', hint: 'Borders only' },
  hard: { label: 'Hard', hint: 'No borders or names' },
}
