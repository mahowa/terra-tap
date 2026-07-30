import { describe, it, expect } from 'vitest'
import { QUIZZES, QUIZ_RUN_LENGTH, buildQuizRun, getQuiz, quizBounds } from '@/lib/quizzes'
import { seededRng } from '@/lib/rng'
import { countryAt } from '@/lib/country-lookup'

describe('quiz data integrity', () => {
  it('has unique, url-safe slugs', () => {
    const slugs = QUIZZES.map((q) => q.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/)
  })

  it('every quiz has enough places for a full run', () => {
    for (const q of QUIZZES) {
      expect(q.pool.length, q.slug).toBeGreaterThanOrEqual(QUIZ_RUN_LENGTH)
    }
  })

  it('covers both themes from the issue: regions and continents', () => {
    const themes = new Set(QUIZZES.map((q) => q.theme))
    expect(themes).toEqual(new Set(['Regions', 'Continents']))
    // one quiz per continent
    const continentSlugs = QUIZZES.filter((q) => q.theme === 'Continents').map((q) => q.slug)
    expect(continentSlugs).toEqual(
      expect.arrayContaining([
        'africa',
        'europe',
        'asia',
        'north-america',
        'south-america',
        'oceania',
      ]),
    )
  })

  it('includes all 50 US state capitals', () => {
    const us = getQuiz('us-state-capitals')
    expect(us?.pool.length).toBe(50)
    expect(new Set(us?.pool.map((p) => p.country)).size).toBe(50) // one per state
  })

  it('has valid coordinates and difficulties everywhere', () => {
    for (const q of QUIZZES) {
      for (const place of q.pool) {
        expect(place.lat, `${q.slug}:${place.name}`).toBeGreaterThanOrEqual(-90)
        expect(place.lat, `${q.slug}:${place.name}`).toBeLessThanOrEqual(90)
        expect(place.lng, `${q.slug}:${place.name}`).toBeGreaterThanOrEqual(-180)
        expect(place.lng, `${q.slug}:${place.name}`).toBeLessThanOrEqual(180)
        expect(['easy', 'medium', 'hard']).toContain(place.difficulty)
      }
    }
  })

  it('spot-checks coordinates against the country dataset', async () => {
    // A wrong-hemisphere typo in the data would fail these.
    expect(await countryAt({ lat: 30.27, lng: -97.74 })).toBe('United States') // Austin
    expect(await countryAt({ lat: 48.86, lng: 2.35 })).toBe('France') // Paris
    expect(await countryAt({ lat: -33.87, lng: 151.21 })).toBe('Australia') // Sydney
    expect(await countryAt({ lat: -23.55, lng: -46.63 })).toBe('Brazil') // São Paulo
  })
})

describe('buildQuizRun', () => {
  it('returns null for an unknown slug', () => {
    expect(buildQuizRun('nope', seededRng('x'))).toBeNull()
  })

  it('builds a practice run of distinct places from the pool', () => {
    const run = buildQuizRun('europe', seededRng('test-seed'))
    expect(run?.mode).toBe('practice')
    expect(run?.dateKey).toBe('')
    expect(run?.title).toBe('Europe')
    expect(run?.rounds.length).toBe(QUIZ_RUN_LENGTH)
    const names = run!.rounds.map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
    const poolNames = new Set(getQuiz('europe')!.pool.map((p) => p.name))
    for (const n of names) expect(poolNames.has(n)).toBe(true)
  })

  it('is deterministic for the same rng seed and varies across seeds', () => {
    const a = buildQuizRun('big-cities', seededRng('seed-a'))!.rounds.map((r) => r.name)
    const b = buildQuizRun('big-cities', seededRng('seed-a'))!.rounds.map((r) => r.name)
    const c = buildQuizRun('big-cities', seededRng('seed-b'))!.rounds.map((r) => r.name)
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it('caps the sample at the pool size', () => {
    const run = buildQuizRun('oceania', seededRng('x'), 999)
    expect(run?.rounds.length).toBe(getQuiz('oceania')!.pool.length)
  })
})

// Issue #61: a themed quiz used to open on the same neutral full globe as every
// other mode, leaving the player to spin the planet to their region first.
describe('quiz opening frame (#61)', () => {
  /** Does the box contain the point? East may run past 180 (antimeridian). */
  const contains = (
    [[west, south], [east, north]]: [[number, number], [number, number]],
    { lat, lng }: { lat: number; lng: number },
  ): boolean => {
    const unwrapped = lng < west ? lng + 360 : lng
    return unwrapped >= west && unwrapped <= east && lat >= south && lat <= north
  }

  it('frames every regional quiz around its whole pool', () => {
    for (const quiz of QUIZZES) {
      const bounds = quizBounds(quiz)
      if (!bounds) continue // globe-spanning: keeps the neutral start
      for (const place of quiz.pool) {
        expect(contains(bounds, place), `${quiz.slug}:${place.name}`).toBe(true)
      }
    }
  })

  it('frames each continent quiz and the US capitals', () => {
    for (const slug of [
      'us-state-capitals',
      'africa',
      'europe',
      'asia',
      'north-america',
      'south-america',
      'oceania',
    ]) {
      expect(quizBounds(getQuiz(slug)!), slug).not.toBeNull()
    }
  })

  it('opens a continent quiz on that continent, not the whole globe', () => {
    const [[west, south], [east, north]] = quizBounds(getQuiz('africa')!)!
    expect(east - west).toBeLessThan(120)
    expect(north - south).toBeLessThan(120)
    // Roughly Africa: west of Dakar, east of Madagascar, spanning the equator.
    expect(west).toBeLessThan(-10)
    expect(east).toBeGreaterThan(47)
    expect(south).toBeLessThan(-18)
    expect(north).toBeGreaterThan(33)
  })

  it('frames the Pacific for Oceania rather than stretching around the world', () => {
    const [[west, south], [east, north]] = quizBounds(getQuiz('oceania')!)!
    expect(east).toBeGreaterThan(180) // crosses the antimeridian
    expect(east - west).toBeLessThan(180)
    expect(south).toBeLessThan(-41)
    expect(north).toBeGreaterThan(21)
  })

  it('leaves globe-spanning quizzes on the neutral full-globe start', () => {
    for (const slug of ['world-capitals', 'big-cities']) {
      expect(quizBounds(getQuiz(slug)!), slug).toBeNull()
      expect(buildQuizRun(slug, seededRng('x'))!.startBounds, slug).toBeUndefined()
    }
  })

  it('carries the frame on the run, derived from the pool not the deal', () => {
    const a = buildQuizRun('south-america', seededRng('seed-a'))!
    const b = buildQuizRun('south-america', seededRng('seed-b'))!
    expect(a.rounds.map((r) => r.name)).not.toEqual(b.rounds.map((r) => r.name))
    // Same frame whatever five came up — the opening view is never a hint.
    expect(a.startBounds).toEqual(quizBounds(getQuiz('south-america')!))
    expect(a.startBounds).toEqual(b.startBounds)
  })
})
