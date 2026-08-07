/**
 * Recording and summarizing a run's rounds (issue #74).
 *
 * A round's result used to be appended unconditionally: check the phase, await
 * the country lookups, then push. Two things could pass that check before the
 * first one finished — a double tap on Submit, or the speed run's clock
 * expiring while a submit was already in flight — and the same place landed in
 * the summary twice. The extra row also broke the score ceiling, which counts
 * the *run's* rounds: five rounds' worth of maximum under six rows of score.
 *
 * Results are positional — `results[i]` is the outcome of `rounds[i]` — so
 * recording is keyed on the round index and is idempotent.
 */

/** Enough of a scored round for the ceiling and the repair below. */
export type ScoredRound = {
  name: string
  multiplier: number
}

/** The most a round can be worth: a perfect 100 times its difficulty multiplier. */
export const PERFECT_BASE = 100

/**
 * Append `result` as the outcome of round `index`, or return `prev` untouched
 * if that round already has one. Out-of-order calls (index beyond the next slot)
 * are ignored too — there's no meaningful place to put them.
 */
export function recordRound<T>(prev: readonly T[], index: number, result: T): T[] {
  if (index !== prev.length) return prev as T[]
  return [...prev, result]
}

/** Has round `index` already been scored? */
export function isRoundRecorded(results: readonly unknown[], index: number): boolean {
  return index < results.length
}

/** Ceiling for a set of scored rounds — the denominator on the results screen. */
export function maxScoreForRounds(rounds: readonly ScoredRound[]): number {
  return rounds.reduce(
    (sum, r) => sum + PERFECT_BASE * (Number.isFinite(r.multiplier) ? r.multiplier : 0),
    0,
  )
}

/**
 * Line a stored result back up with the run it belongs to (#74).
 *
 * Results saved before the guard above can carry a duplicate row, which shows
 * the same place twice against a ceiling that never counted it. Each of the
 * run's rounds takes the first stored row that matches it by name, falling back
 * to the next unclaimed row when a name isn't found (a renamed or re-dealt
 * place). Extra rows are dropped. Saves that already match are returned as-is.
 */
export function reconcileSavedRounds<T extends { name: string }>(
  saved: readonly T[],
  roundNames: readonly string[],
): T[] {
  if (saved.length <= roundNames.length) return [...saved]

  const claimed = new Set<number>()
  const claim = (predicate: (row: T, i: number) => boolean): T | null => {
    for (let i = 0; i < saved.length; i++) {
      if (!claimed.has(i) && predicate(saved[i], i)) {
        claimed.add(i)
        return saved[i]
      }
    }
    return null
  }

  const lined: T[] = []
  for (const name of roundNames) {
    const row = claim((r) => r.name === name) ?? claim(() => true)
    if (row) lined.push(row)
  }
  return lined
}
