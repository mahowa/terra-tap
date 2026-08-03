import { computeStats, type DailyStats } from './stats'
import { bestPerSlot } from './runs'

/**
 * Lifetime account stats (issue #49), aggregated from server-side `results`
 * rows instead of the browser's per-day localStorage. Pure so it's unit-tested;
 * the daily streak reuses the same computeStats core the on-device stats use.
 *
 * Counting matches the leaderboard (issue #69): a day finished twice — second
 * device, cleared site data — is one game at its best score, not two.
 */

export type AccountResult = {
  mode: string
  dateKey?: string | null
  total: number
  /** ISO timestamp; ties on score go to the earlier attempt. */
  createdAt?: string
}

export type AccountSummary = {
  totalGames: number
  totalPoints: number
  /** Streak/best/average over the daily mode (the retention loop). */
  daily: DailyStats
  /** Games played per mode. */
  byMode: Record<string, number>
}

export function summarizeResults(results: AccountResult[], todayKey: string): AccountSummary {
  const counted = bestPerSlot(results)
  const byMode: Record<string, number> = {}
  let totalPoints = 0
  // Best daily score per day, so replays/imports don't inflate the streak.
  const bestPerDay = new Map<string, number>()

  for (const r of counted) {
    byMode[r.mode] = (byMode[r.mode] ?? 0) + 1
    totalPoints += Number.isFinite(r.total) ? r.total : 0
    if (r.mode === 'daily' && r.dateKey) {
      bestPerDay.set(r.dateKey, Math.max(bestPerDay.get(r.dateKey) ?? 0, r.total))
    }
  }

  const daily = computeStats(
    [...bestPerDay].map(([dateKey, total]) => ({ dateKey, total })),
    todayKey,
  )

  return { totalGames: counted.length, totalPoints, daily, byMode }
}
