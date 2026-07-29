/**
 * Pure helpers for the Wordle-style daily share text. No DOM / Date / storage,
 * so it's unit-testable and reused by the UI.
 *
 * Example output:
 *   Terra Tap — June 23
 *   99🎯 100🎯 94🏅 93🏆 86🎓
 *   Final score: 924
 *   https://map-clicky.vercel.app/play
 */

/**
 * Fallback play URL appended to shared results so it spreads with a
 * click-through. Callers with a DOM should pass the live origin instead
 * (see playUrlFromLocation) so shares always point at the site being played.
 */
export const PLAY_URL = 'https://map-clicky.vercel.app/play'

/** Play URL derived from the browser's own origin; falls back to PLAY_URL on SSR. */
export function playUrlFromLocation(): string {
  if (typeof window === 'undefined' || !window.location?.origin) return PLAY_URL
  return `${window.location.origin}/play`
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Performance badge for a round's base score (0–100). Better score = better badge.
 * 🎯 is a bullseye (near-perfect); a low score gets a "way off" pin.
 */
export function scoreEmoji(base: number): string {
  if (base >= 95) return '🎯' // bullseye — nailed it
  if (base >= 85) return '🏅' // very close
  if (base >= 70) return '🏆' // good
  if (base >= 50) return '🎓' // in the area
  return '📍' // way off
}

/** "2026-06-23" -> "June 23". Returns the input unchanged if it can't parse. */
export function formatShareDate(dateKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!m) return dateKey
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${month} ${Number(m[3])}` : dateKey
}

/** Build the share text block from per-round base scores and the final total. */
export function formatDailyShare(
  dateKey: string,
  bases: number[],
  total: number,
  playUrl: string = PLAY_URL,
): string {
  return formatRunShare(`Terra Tap — ${formatShareDate(dateKey)}`, bases, total, playUrl)
}

/**
 * Share URL for the page being played (#31): quiz shares link to that quiz,
 * speed to /speed, history to /history. Falls back to the play URL on SSR.
 */
export function shareUrlFromLocation(): string {
  if (typeof window === 'undefined' || !window.location?.origin) return PLAY_URL
  return `${window.location.origin}${window.location.pathname}`
}

/**
 * Share heading for any run (#31). Dated modes carry the date; named modes
 * (quizzes) carry their title.
 */
export function shareHeading(
  kind: 'daily' | 'speed' | 'versus' | 'history' | 'quiz',
  title: string,
  dateKey: string,
): string {
  if (kind === 'daily' && dateKey) return `Terra Tap — ${formatShareDate(dateKey)}`
  // Undated speed runs are practice (#33) and share under their title instead.
  if (kind === 'speed' && dateKey) return `Terra Tap Speed Run — ${formatShareDate(dateKey)}`
  // History is dealt per day too (#59), so the date is what makes it comparable.
  if (kind === 'history' && dateKey) return `Terra Tap History — ${formatShareDate(dateKey)}`
  return `Terra Tap — ${title}`
}

/**
 * Generic share block for a completed run (#31): emoji score line, total,
 * optional run time (speed), and the link back in.
 */
export function formatRunShare(
  heading: string,
  bases: number[],
  total: number,
  url: string,
  timeText?: string | null,
  /** Streak brag line, e.g. "🔥 3-day streak" (#32). */
  streakLine?: string | null,
): string {
  const line = bases.map((b) => `${b}${scoreEmoji(b)}`).join(' ')
  const time = timeText ? `\nTime: ${timeText}` : ''
  const streak = streakLine ? `\n${streakLine}` : ''
  return `${heading}\n${line}\nFinal score: ${total}${time}${streak}\n${url}`
}

/**
 * How to deliver a share (#31): the native sheet where it's the norm
 * (touch devices with the Web Share API), the clipboard everywhere else.
 */
export function sharePlan(hasShareApi: boolean, coarsePointer: boolean): 'native' | 'clipboard' {
  return hasShareApi && coarsePointer ? 'native' : 'clipboard'
}
