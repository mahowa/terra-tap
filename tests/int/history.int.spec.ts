import { describe, it, expect } from 'vitest'
import { HISTORY_PLACES, HISTORY_RUN_LENGTH, buildHistoryRun } from '@/lib/history'
import { pick, seededRng } from '@/lib/rng'
import { countryAt } from '@/lib/country-lookup'

describe('history data integrity', () => {
  it('has enough places for several distinct runs', () => {
    expect(HISTORY_PLACES.length).toBeGreaterThanOrEqual(HISTORY_RUN_LENGTH * 4)
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
