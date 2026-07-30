import { describe, it, expect } from 'vitest'
import {
  HISTORY_MIN_REPEAT_DAYS,
  HISTORY_PLACES,
  HISTORY_RUN_LENGTH,
  buildHistoryRun,
  dayIndex,
  historyHand,
} from '@/lib/history'
import { pick, seededRng } from '@/lib/rng'
import { countryAt } from '@/lib/country-lookup'

/** `count` consecutive UTC day keys starting at `from`. */
const daysFrom = (from: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(`${from}T00:00:00.000Z`) + i * 86_400_000).toISOString().slice(0, 10),
  )

describe('history data integrity', () => {
  it('has enough places for several distinct runs', () => {
    expect(HISTORY_PLACES.length).toBeGreaterThanOrEqual(HISTORY_RUN_LENGTH * 4)
  })

  // The rotation (#62) deals day N the Nth window of the deck. A pool that's a
  // whole number of hands keeps every hand inside one deck, so no day is dealt
  // across a reshuffle seam.
  it('holds a whole number of hands, at least a fortnight of them (#62)', () => {
    expect(HISTORY_PLACES.length % HISTORY_RUN_LENGTH).toBe(0)
    expect(HISTORY_PLACES.length / HISTORY_RUN_LENGTH).toBeGreaterThanOrEqual(14)
  })

  it('never leaks the answer: no clue contains its place name', () => {
    for (const place of HISTORY_PLACES) {
      expect(place.clue.toLowerCase(), place.name).not.toContain(place.name.toLowerCase())
    }
  })

  it('every clue is a substantial description', () => {
    for (const place of HISTORY_PLACES) {
      expect(place.clue.length, place.name).toBeGreaterThan(60)
    }
  })

  it('has unique place names and valid coordinates', () => {
    const names = HISTORY_PLACES.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
    for (const p of HISTORY_PLACES) {
      expect(Math.abs(p.lat), p.name).toBeLessThanOrEqual(90)
      expect(Math.abs(p.lng), p.name).toBeLessThanOrEqual(180)
    }
  })

  it('spot-checks coordinates against the country dataset', async () => {
    const at = async (name: string) => {
      const p = HISTORY_PLACES.find((x) => x.name === name)!
      return countryAt({ lat: p.lat, lng: p.lng })
    }
    expect(await at('Rome')).toBe('Italy')
    expect(await at('Machu Picchu')).toBe('Peru')
    expect(await at('Timbuktu')).toBe('Mali')
    expect(await at('Gettysburg')).toBe('United States')
    expect(await at('Waterloo')).toBe('Belgium')
  })
})

describe('buildHistoryRun', () => {
  it('builds a labeled run for the day whose rounds carry clues', () => {
    const run = buildHistoryRun('2026-07-22')
    expect(run.labeled).toBe(true)
    expect(run.mode).toBe('practice')
    expect(run.dateKey).toBe('2026-07-22')
    expect(run.title).toBe('Geography History')
    expect(run.rounds.length).toBe(HISTORY_RUN_LENGTH)
    for (const round of run.rounds) {
      expect(round.clue).toBeTruthy()
      expect(round.fact).toBeNull()
    }
  })

  it('deals everyone the same distinct places on the same day (#59)', () => {
    const a = buildHistoryRun('2026-07-22').rounds.map((r) => r.name)
    const b = buildHistoryRun('2026-07-22').rounds.map((r) => r.name)
    expect(new Set(a).size).toBe(a.length)
    expect(a).toEqual(b)
  })

  it('deals a different hand on a different day', () => {
    const a = buildHistoryRun('2026-07-22').rounds.map((r) => r.name)
    const b = buildHistoryRun('2026-07-23').rounds.map((r) => r.name)
    expect(a).not.toEqual(b)
  })

  it('is seeded independently of the other daily modes', () => {
    // Sharing a raw date seed would deal correlated hands across modes.
    const day = '2026-07-22'
    expect(buildHistoryRun(day).rounds.map((r) => r.name)).not.toEqual(
      pick(HISTORY_PLACES, HISTORY_RUN_LENGTH, seededRng(day)).map((p) => p.name),
    )
  })

  it('sets the map detail from the chosen difficulty (#47)', () => {
    expect(buildHistoryRun('2026-07-22', 5, 'easy').mapDetail).toBe('labeled')
    expect(buildHistoryRun('2026-07-22', 5, 'medium').mapDetail).toBe('borders')
    expect(buildHistoryRun('2026-07-22', 5, 'hard').mapDetail).toBe('plain')
    // Still a History-mode run regardless of difficulty.
    expect(buildHistoryRun('2026-07-22', 5, 'hard').labeled).toBe(true)
  })

  it('keeps the day’s hand when the difficulty changes (#47 + #59)', () => {
    const easy = buildHistoryRun('2026-07-22', 5, 'easy').rounds.map((r) => r.name)
    const hard = buildHistoryRun('2026-07-22', 5, 'hard').rounds.map((r) => r.name)
    expect(easy).toEqual(hard)
  })

  it('defaults to Easy (labeled) when no difficulty is given', () => {
    expect(buildHistoryRun('2026-07-22').mapDetail).toBe('labeled')
  })
})

describe('dayIndex', () => {
  it('counts UTC days from the epoch', () => {
    expect(dayIndex('1970-01-01')).toBe(0)
    expect(dayIndex('1970-01-02')).toBe(1)
    expect(dayIndex('2026-07-30') - dayIndex('2026-07-29')).toBe(1)
  })

  it('deals day zero for pre-epoch or unparseable keys', () => {
    expect(dayIndex('1969-12-25')).toBe(0)
    expect(dayIndex('not-a-day')).toBe(0)
    expect(dayIndex('')).toBe(0)
  })
})

// Issue #62: the day's five used to be an independent reshuffle of a 25-place
// pool, so places came back around every few days. Days now walk a rotating
// deck instead.
describe('daily rotation (#62)', () => {
  const PASS_DAYS = HISTORY_PLACES.length / HISTORY_RUN_LENGTH
  /** The first day of the next full pass through the deck. */
  const passStart = daysFrom('2026-07-30', PASS_DAYS).find((d) => dayIndex(d) % PASS_DAYS === 0)!

  it('uses every place exactly once over a full pass of the pool', () => {
    const dealt = daysFrom(passStart, PASS_DAYS).flatMap((d) => historyHand(d).map((p) => p.name))
    expect(dealt.length).toBe(HISTORY_PLACES.length)
    expect(new Set(dealt).size).toBe(HISTORY_PLACES.length)
  })

  it('keeps every place off the board for at least the seam gap, across two years', () => {
    const lastSeen = new Map<string, number>()
    daysFrom('2026-01-01', 730).forEach((day, i) => {
      for (const place of historyHand(day)) {
        const previous = lastSeen.get(place.name)
        if (previous !== undefined) {
          expect(i - previous, `${place.name} on ${day}`).toBeGreaterThanOrEqual(
            HISTORY_MIN_REPEAT_DAYS,
          )
        }
        lastSeen.set(place.name, i)
      }
    })
  })

  it('reshuffles between passes instead of looping the same order', () => {
    const first = daysFrom(passStart, PASS_DAYS).map((d) =>
      historyHand(d).map((p) => p.name).join(','),
    )
    const second = daysFrom(passStart, PASS_DAYS * 2)
      .slice(PASS_DAYS)
      .map((d) => historyHand(d).map((p) => p.name).join(','))
    expect(second).not.toEqual(first)
  })

  it('deals distinct places even when the hand does not divide the pool', () => {
    for (const day of daysFrom('2026-07-30', 40)) {
      const names = historyHand(day, 7).map((p) => p.name)
      expect(names.length).toBe(7)
      expect(new Set(names).size).toBe(7)
    }
  })

  it('caps an oversized hand at the pool and stays deterministic', () => {
    const hand = historyHand('2026-07-30', HISTORY_PLACES.length + 25)
    expect(hand.length).toBe(HISTORY_PLACES.length)
    expect(new Set(hand.map((p) => p.name)).size).toBe(HISTORY_PLACES.length)
    expect(historyHand('2026-07-30', 0).length).toBe(1)
  })
})
