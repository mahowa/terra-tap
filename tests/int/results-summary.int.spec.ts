import { describe, it, expect } from 'vitest'
import {
  isRoundRecorded,
  maxScoreForRounds,
  recordRound,
  reconcileSavedRounds,
} from '@/lib/results-summary'

/**
 * Issue #74: a place showed up twice in the summary when it was played once,
 * and the score ceiling didn't match the rounds listed under it. Both came from
 * the same thing — a round scored twice, because the phase check ran before the
 * country lookups and a second submit (or the speed clock) slipped through
 * during the await.
 */

const row = (name: string, points: number, multiplier = 2) => ({ name, points, multiplier })

describe('recordRound (#74)', () => {
  it('records the round it is given', () => {
    expect(recordRound([], 0, row('Tokyo', 90))).toEqual([row('Tokyo', 90)])
    expect(recordRound([row('Tokyo', 90)], 1, row('Lima', 40))).toEqual([
      row('Tokyo', 90),
      row('Lima', 40),
    ])
  })

  it('ignores a second scoring pass over the same round', () => {
    const first = recordRound([], 0, row('Tokyo', 90))
    const second = recordRound(first, 0, row('Tokyo', 90))
    expect(second).toEqual([row('Tokyo', 90)])
    expect(second).toBe(first) // untouched, so React skips the re-render
  })

  it('ignores the speed clock firing after a submit already scored the round', () => {
    const submitted = recordRound([], 0, row('Tokyo', 90))
    const timedOut = recordRound(submitted, 0, { name: 'Tokyo', points: 0, multiplier: 2 })
    expect(timedOut).toEqual([row('Tokyo', 90)]) // the real guess survives
  })

  it('ignores a result for a round that is out of reach', () => {
    // Round 3 can't be scored before rounds 1 and 2 — there's nowhere to put it.
    expect(recordRound([row('Tokyo', 90)], 3, row('Cairo', 10))).toEqual([row('Tokyo', 90)])
  })

  it('keeps results positional across a full run', () => {
    let results: ReturnType<typeof row>[] = []
    const names = ['Tokyo', 'Lima', 'Cairo', 'Oslo', 'Perth']
    names.forEach((name, i) => {
      results = recordRound(results, i, row(name, 50))
      results = recordRound(results, i, row(name, 50)) // double tap every time
    })
    expect(results.map((r) => r.name)).toEqual(names)
  })
})

describe('isRoundRecorded', () => {
  it('knows which rounds already have a result', () => {
    const results = [row('Tokyo', 90), row('Lima', 40)]
    expect(isRoundRecorded(results, 0)).toBe(true)
    expect(isRoundRecorded(results, 1)).toBe(true)
    expect(isRoundRecorded(results, 2)).toBe(false)
  })
})

describe('maxScoreForRounds (#74)', () => {
  it('is 100 a round times its difficulty multiplier', () => {
    expect(maxScoreForRounds([row('a', 0, 1), row('b', 0, 2), row('c', 0, 3)])).toBe(600)
  })

  it('matches the rows it is shown against — including a duplicated one', () => {
    // A stored result with an extra row is self-consistent — every row it lists
    // is counted — rather than being scored out of one round fewer.
    const stored = [row('Tokyo', 90), row('Tokyo', 90), row('Lima', 40, 3)]
    expect(maxScoreForRounds(stored)).toBe(200 + 200 + 300)
  })

  it('survives a broken multiplier instead of going NaN', () => {
    expect(maxScoreForRounds([row('a', 0, Number.NaN), row('b', 0, 2)])).toBe(200)
  })

  it('is zero for no rounds', () => {
    expect(maxScoreForRounds([])).toBe(0)
  })
})

describe('reconcileSavedRounds (#74)', () => {
  const names = ['Tokyo', 'Lima', 'Cairo', 'Oslo', 'Perth']

  it('leaves a save that already matches the run alone', () => {
    const saved = names.map((n) => row(n, 50))
    expect(reconcileSavedRounds(saved, names)).toEqual(saved)
  })

  it('drops the repeated row a double-scored round left behind', () => {
    const saved = [
      row('Tokyo', 90),
      row('Tokyo', 90), // the same round, recorded twice
      row('Lima', 40),
      row('Cairo', 10),
      row('Oslo', 60),
      row('Perth', 20),
    ]
    expect(reconcileSavedRounds(saved, names).map((r) => r.name)).toEqual(names)
  })

  it('keeps the first stored attempt at each round', () => {
    const saved = [row('Tokyo', 90), row('Tokyo', 0), row('Lima', 40)]
    expect(reconcileSavedRounds(saved, ['Tokyo', 'Lima']).map((r) => r.points)).toEqual([90, 40])
  })

  it('falls back to the next unclaimed row when a name is missing', () => {
    const saved = [row('Tokyo', 90), row('Kyoto', 30), row('Lima', 40)]
    // 'Osaka' isn't in the save, so the first unclaimed row stands in for it.
    expect(reconcileSavedRounds(saved, ['Tokyo', 'Osaka']).map((r) => r.name)).toEqual([
      'Tokyo',
      'Kyoto',
    ])
  })

  it('leaves a short save short rather than inventing rounds', () => {
    const saved = [row('Tokyo', 90)]
    expect(reconcileSavedRounds(saved, names)).toEqual(saved)
  })

  it('handles an empty run without throwing', () => {
    expect(reconcileSavedRounds([row('Tokyo', 90)], [])).toEqual([])
    expect(reconcileSavedRounds([], names)).toEqual([])
  })

  it('re-totals cleanly: kept rows sum to less than the inflated save', () => {
    const saved = [row('Tokyo', 90), row('Tokyo', 90), row('Lima', 40)]
    const kept = reconcileSavedRounds(saved, ['Tokyo', 'Lima'])
    expect(kept.reduce((s, r) => s + r.points, 0)).toBe(130)
    expect(saved.reduce((s, r) => s + r.points, 0)).toBe(220) // what was shown before
  })
})
