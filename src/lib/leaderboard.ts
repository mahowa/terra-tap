import { computeStats } from './stats'
import { flagToIso, regionForFlag } from './regions'

/**
 * Leaderboard ranking (issue #50). Pure functions over in-memory result rows so
 * every board and scope is unit-testable; the page feeds them rows read from the
 * `results` collection. Boards: today's Daily, All-time points, and best daily
 * Streak. Scopes: World / your Region / your Country (from the profile flag).
 */

export type LeaderboardBoard = 'daily' | 'alltime' | 'streak'
export type LeaderboardScope = 'world' | 'region' | 'country'

export const BOARDS: LeaderboardBoard[] = ['daily', 'alltime', 'streak']
export const SCOPES: LeaderboardScope[] = ['world', 'region', 'country']

/** A single result row projected with its player's public identity. */
export type PlayerRow = {
  userId: string | number
  displayName: string
  flag: string | null
  mode: string
  dateKey?: string | null
  total: number
  /** ISO timestamp; used for deterministic tie-breaking (earliest wins). */
  createdAt: string
}

export type LeaderboardEntry = {
  rank: number
  userId: string | number
  displayName: string
  flag: string | null
  score: number
}

type Agg = {
  userId: string | number
  displayName: string
  flag: string | null
  score: number
  /** Earliest relevant timestamp — ties resolve in favour of who got there first. */
  tiebreak: string
}

function rank(aggs: Agg[]): LeaderboardEntry[] {
  return [...aggs]
    .sort((a, b) => b.score - a.score || a.tiebreak.localeCompare(b.tiebreak))
    .map((a, i) => ({
      rank: i + 1,
      userId: a.userId,
      displayName: a.displayName,
      flag: a.flag,
      score: a.score,
    }))
}

/** Restrict rows to the viewer's region or country before ranking. */
export function filterByScope(
  rows: PlayerRow[],
  scope: LeaderboardScope,
  viewerFlag: string | null,
): PlayerRow[] {
  if (scope === 'world') return rows
  if (scope === 'country') {
    const iso = flagToIso(viewerFlag)
    return iso ? rows.filter((r) => flagToIso(r.flag) === iso) : []
  }
  const region = regionForFlag(viewerFlag)
  return region ? rows.filter((r) => regionForFlag(r.flag) === region) : []
}

/** Today's daily: each player's best score for `todayKey`, highest first. */
export function rankDaily(rows: PlayerRow[], todayKey: string): LeaderboardEntry[] {
  const byUser = new Map<string, Agg>()
  for (const r of rows) {
    if (r.mode !== 'daily' || r.dateKey !== todayKey) continue
    const key = String(r.userId)
    const prev = byUser.get(key)
    if (
      !prev ||
      r.total > prev.score ||
      (r.total === prev.score && r.createdAt < prev.tiebreak)
    ) {
      byUser.set(key, {
        userId: r.userId,
        displayName: r.displayName,
        flag: r.flag,
        score: r.total,
        tiebreak: r.createdAt,
      })
    }
  }
  return rank([...byUser.values()])
}

/** All-time: sum of every completed run's points per player. */
export function rankAllTime(rows: PlayerRow[]): LeaderboardEntry[] {
  const byUser = new Map<string, Agg>()
  for (const r of rows) {
    const key = String(r.userId)
    const prev = byUser.get(key)
    if (prev) {
      prev.score += r.total
      if (r.createdAt < prev.tiebreak) prev.tiebreak = r.createdAt
    } else {
      byUser.set(key, {
        userId: r.userId,
        displayName: r.displayName,
        flag: r.flag,
        score: r.total,
        tiebreak: r.createdAt,
      })
    }
  }
  return rank([...byUser.values()])
}

/** Best daily streak per player (reuses the on-device streak core). */
export function rankStreak(rows: PlayerRow[], todayKey: string): LeaderboardEntry[] {
  const byUser = new Map<
    string,
    { meta: Omit<Agg, 'score' | 'tiebreak'>; days: Map<string, number>; first: string }
  >()
  for (const r of rows) {
    if (r.mode !== 'daily' || !r.dateKey) continue
    const key = String(r.userId)
    let entry = byUser.get(key)
    if (!entry) {
      entry = {
        meta: { userId: r.userId, displayName: r.displayName, flag: r.flag },
        days: new Map(),
        first: r.createdAt,
      }
      byUser.set(key, entry)
    }
    entry.days.set(r.dateKey, Math.max(entry.days.get(r.dateKey) ?? 0, r.total))
    if (r.createdAt < entry.first) entry.first = r.createdAt
  }
  const aggs: Agg[] = [...byUser.values()].map((e) => {
    const stats = computeStats(
      [...e.days].map(([dateKey, total]) => ({ dateKey, total })),
      todayKey,
    )
    return { ...e.meta, score: stats.maxStreak, tiebreak: e.first }
  })
  return rank(aggs)
}

export function rankBoard(
  rows: PlayerRow[],
  board: LeaderboardBoard,
  todayKey: string,
): LeaderboardEntry[] {
  if (board === 'daily') return rankDaily(rows, todayKey)
  if (board === 'streak') return rankStreak(rows, todayKey)
  return rankAllTime(rows)
}

/** The viewer's own entry (so their rank shows even outside the top N). */
export function findEntry(
  entries: LeaderboardEntry[],
  userId: string | number | null | undefined,
): LeaderboardEntry | null {
  if (userId == null) return null
  const key = String(userId)
  return entries.find((e) => String(e.userId) === key) ?? null
}
