import { describe, it, expect } from 'vitest'
import { summarizeResults } from '@/lib/account'

describe('summarizeResults (#49)', () => {
  it('is empty for no results', () => {
    const s = summarizeResults([], '2026-07-23')
    expect(s.totalGames).toBe(0)
    expect(s.totalPoints).toBe(0)
    expect(s.daily.currentStreak).toBe(0)
    expect(s.byMode).toEqual({})
  })

  it('counts games per mode and sums points', () => {
    const s = summarizeResults(
      [
        { mode: 'daily', dateKey: '2026-07-23', total: 300 },
        { mode: 'speed', dateKey: '2026-07-23', total: 120 },
        { mode: 'quiz', total: 80 },
      ],
      '2026-07-23',
    )
    expect(s.totalGames).toBe(3)
    expect(s.totalPoints).toBe(500)
    expect(s.byMode).toEqual({ daily: 1, speed: 1, quiz: 1 })
  })

  it('computes a daily streak ending today', () => {
    const s = summarizeResults(
      [
        { mode: 'daily', dateKey: '2026-07-21', total: 200 },
        { mode: 'daily', dateKey: '2026-07-22', total: 250 },
        { mode: 'daily', dateKey: '2026-07-23', total: 300 },
      ],
      '2026-07-23',
    )
    expect(s.daily.currentStreak).toBe(3)
    expect(s.daily.maxStreak).toBe(3)
    expect(s.daily.best).toBe(300)
  })

  it('keeps only the best score per day so replays do not break the streak', () => {
    const s = summarizeResults(
      [
        { mode: 'daily', dateKey: '2026-07-22', total: 100 },
        { mode: 'daily', dateKey: '2026-07-22', total: 400 }, // replay/import same day
        { mode: 'daily', dateKey: '2026-07-23', total: 300 },
      ],
      '2026-07-23',
    )
    expect(s.daily.currentStreak).toBe(2)
    expect(s.daily.best).toBe(400)
    // Two days played, so two games — the repeated day is one game at its best
    // score, matching the leaderboard's counting (#69).
    expect(s.totalGames).toBe(2)
    expect(s.totalPoints).toBe(700)
    expect(s.byMode.daily).toBe(2)
  })

  it('does not inflate lifetime points when a day is stored twice (#69)', () => {
    const s = summarizeResults(
      [
        { mode: 'daily', dateKey: '2026-07-23', total: 300 },
        { mode: 'daily', dateKey: '2026-07-23', total: 300 }, // second device
        { mode: 'quiz', dateKey: '', total: 90 },
        { mode: 'quiz', dateKey: '', total: 90 }, // a genuinely separate quiz
      ],
      '2026-07-23',
    )
    expect(s.totalPoints).toBe(300 + 90 + 90)
    expect(s.totalGames).toBe(3)
  })

  it('ignores non-daily modes and missing dateKeys in the streak', () => {
    const s = summarizeResults(
      [
        { mode: 'speed', dateKey: '2026-07-23', total: 100 },
        { mode: 'quiz', total: 100 },
        { mode: 'daily', dateKey: null, total: 100 },
      ],
      '2026-07-23',
    )
    expect(s.daily.currentStreak).toBe(0)
    expect(s.daily.played).toBe(0)
  })
})
