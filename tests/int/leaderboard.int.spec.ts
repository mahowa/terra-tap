import { describe, it, expect } from 'vitest'
import {
  filterByScope,
  findEntry,
  rankAllTime,
  rankBoard,
  rankDaily,
  rankStreak,
  type PlayerRow,
} from '@/lib/leaderboard'

const row = (o: Partial<PlayerRow> & Pick<PlayerRow, 'userId' | 'total'>): PlayerRow => ({
  displayName: `U${o.userId}`,
  flag: null,
  mode: 'daily',
  dateKey: '2026-07-23',
  createdAt: '2026-07-23T10:00:00.000Z',
  ...o,
})

describe('rankDaily (#50)', () => {
  it("ranks today's best-per-player, highest first", () => {
    const entries = rankDaily(
      [
        row({ userId: 1, total: 200 }),
        row({ userId: 1, total: 350 }), // player 1's best
        row({ userId: 2, total: 300 }),
      ],
      '2026-07-23',
    )
    expect(entries.map((e) => [e.userId, e.rank, e.score])).toEqual([
      [1, 1, 350],
      [2, 2, 300],
    ])
  })

  it('ignores other days and other modes', () => {
    const entries = rankDaily(
      [
        row({ userId: 1, total: 999, dateKey: '2026-07-22' }),
        row({ userId: 2, total: 999, mode: 'speed' }),
        row({ userId: 3, total: 100 }),
      ],
      '2026-07-23',
    )
    expect(entries).toHaveLength(1)
    expect(entries[0].userId).toBe(3)
  })

  it('breaks ties by earliest completion', () => {
    const entries = rankDaily(
      [
        row({ userId: 1, total: 200, createdAt: '2026-07-23T12:00:00.000Z' }),
        row({ userId: 2, total: 200, createdAt: '2026-07-23T09:00:00.000Z' }),
      ],
      '2026-07-23',
    )
    expect(entries[0].userId).toBe(2) // earlier wins the tie
  })
})

describe('rankAllTime (#50)', () => {
  it('sums every run per player', () => {
    const entries = rankAllTime([
      row({ userId: 1, total: 100, mode: 'daily' }),
      row({ userId: 1, total: 50, mode: 'speed', dateKey: null }),
      row({ userId: 2, total: 120, mode: 'quiz', dateKey: null }),
    ])
    expect(entries.map((e) => [e.userId, e.score])).toEqual([
      [1, 150],
      [2, 120],
    ])
  })
})

describe('rankStreak (#50)', () => {
  it('ranks by best daily streak', () => {
    const rows: PlayerRow[] = [
      // player 1: 3-day streak
      row({ userId: 1, total: 100, dateKey: '2026-07-21' }),
      row({ userId: 1, total: 100, dateKey: '2026-07-22' }),
      row({ userId: 1, total: 100, dateKey: '2026-07-23' }),
      // player 2: 2-day streak (gap breaks it)
      row({ userId: 2, total: 100, dateKey: '2026-07-20' }),
      row({ userId: 2, total: 100, dateKey: '2026-07-22' }),
      row({ userId: 2, total: 100, dateKey: '2026-07-23' }),
    ]
    const entries = rankStreak(rows, '2026-07-23')
    expect(entries[0].userId).toBe(1)
    expect(entries[0].score).toBe(3)
    expect(entries[1].score).toBe(2)
  })
})

describe('filterByScope (#50)', () => {
  const rows: PlayerRow[] = [
    row({ userId: 1, total: 10, flag: '🇫🇷' }),
    row({ userId: 2, total: 10, flag: '🇩🇪' }),
    row({ userId: 3, total: 10, flag: '🇯🇵' }),
  ]
  it('world keeps everyone', () => {
    expect(filterByScope(rows, 'world', '🇫🇷')).toHaveLength(3)
  })
  it('region keeps same-continent players', () => {
    const eu = filterByScope(rows, 'region', '🇫🇷') // Europe
    expect(eu.map((r) => r.userId).sort()).toEqual([1, 2])
  })
  it('country keeps exact-flag players', () => {
    expect(filterByScope(rows, 'country', '🇫🇷').map((r) => r.userId)).toEqual([1])
  })
  it('region/country are empty when the viewer has no flag', () => {
    expect(filterByScope(rows, 'region', null)).toEqual([])
    expect(filterByScope(rows, 'country', null)).toEqual([])
  })
})

describe('rankBoard + findEntry (#50)', () => {
  it('dispatches to the right board and finds a player', () => {
    const rows = [row({ userId: 7, total: 500 }), row({ userId: 8, total: 400 })]
    const entries = rankBoard(rows, 'daily', '2026-07-23')
    expect(findEntry(entries, 8)?.rank).toBe(2)
    expect(findEntry(entries, 999)).toBeNull()
    expect(findEntry(entries, null)).toBeNull()
  })
})
