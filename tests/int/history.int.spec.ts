import { describe, it, expect } from 'vitest'
import { HISTORY_PLACES, HISTORY_RUN_LENGTH, buildHistoryRun } from '@/lib/history'
import { seededRng } from '@/lib/rng'
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
  it('builds a labeled practice run whose rounds carry clues', () => {
    const run = buildHistoryRun(seededRng('history-test'))
    expect(run.labeled).toBe(true)
    expect(run.mode).toBe('practice')
    expect(run.title).toBe('Geography History')
    expect(run.rounds.length).toBe(HISTORY_RUN_LENGTH)
    for (const round of run.rounds) {
      expect(round.clue).toBeTruthy()
      expect(round.fact).toBeNull()
    }
  })

  it('samples distinct places, deterministic per seed', () => {
    const a = buildHistoryRun(seededRng('s1')).rounds.map((r) => r.name)
    const b = buildHistoryRun(seededRng('s1')).rounds.map((r) => r.name)
    const c = buildHistoryRun(seededRng('s2')).rounds.map((r) => r.name)
    expect(new Set(a).size).toBe(a.length)
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it('sets the map detail from the chosen difficulty (#47)', () => {
    expect(buildHistoryRun(seededRng('d'), 5, 'easy').mapDetail).toBe('labeled')
    expect(buildHistoryRun(seededRng('d'), 5, 'medium').mapDetail).toBe('borders')
    expect(buildHistoryRun(seededRng('d'), 5, 'hard').mapDetail).toBe('plain')
    // Still a History-mode run regardless of difficulty.
    expect(buildHistoryRun(seededRng('d'), 5, 'hard').labeled).toBe(true)
  })

  it('defaults to Easy (labeled) when no difficulty is given', () => {
    expect(buildHistoryRun(seededRng('d')).mapDetail).toBe('labeled')
  })
})
