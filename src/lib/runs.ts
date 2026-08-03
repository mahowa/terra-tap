/**
 * Counting completed runs (issue #69).
 *
 * A `results` row is written every time a run is finished, and the one-play
 * lock that guards the dated modes lives in the browser. Finish today's daily
 * on a phone and a laptop — or after clearing site data — and the same day
 * lands in the table two or three times. Summing those rows raw handed a player
 * with three copies of one day more points than a player with three real days,
 * which is what the all-time board was showing.
 *
 * So: a dated run (daily, speed, history) occupies **one slot per mode per UTC
 * day** and only its best attempt counts. Undated runs (quizzes, versus,
 * practice) are genuinely separate games and each keep their own slot.
 */

export type CountedRun = {
  mode: string
  dateKey?: string | null
  total: number
  /** ISO timestamp; ties on score go to whoever got there first. */
  createdAt?: string
}

/**
 * The slot a run occupies. Dated modes share a slot per day, so repeats of the
 * same day collapse; undated runs fall back to their position, which is unique.
 */
export function runSlot(run: CountedRun, index: number): string {
  const dateKey = run.dateKey?.trim()
  return dateKey ? `${run.mode}:${dateKey}` : `#${index}`
}

/** Is `candidate` the better run for a slot than `held`? */
function beats(candidate: CountedRun, held: CountedRun): boolean {
  if (candidate.total !== held.total) return candidate.total > held.total
  if (!candidate.createdAt || !held.createdAt) return false
  return candidate.createdAt < held.createdAt
}

/**
 * One run per slot — the best attempt — in first-seen slot order. Feed this a
 * single player's runs; the leaderboard groups by player first.
 */
export function bestPerSlot<T extends CountedRun>(runs: readonly T[]): T[] {
  const bySlot = new Map<string, T>()
  runs.forEach((run, index) => {
    const slot = runSlot(run, index)
    const held = bySlot.get(slot)
    if (!held || beats(run, held)) bySlot.set(slot, run)
  })
  return [...bySlot.values()]
}

/** Points a player has actually earned: the best of each slot, summed. */
export function totalPoints(runs: readonly CountedRun[]): number {
  return bestPerSlot(runs).reduce(
    (sum, run) => sum + (Number.isFinite(run.total) ? run.total : 0),
    0,
  )
}
