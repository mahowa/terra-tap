import Link from 'next/link'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import {
  BOARDS,
  SCOPES,
  filterByScope,
  findEntry,
  rankBoard,
  type LeaderboardBoard,
  type LeaderboardEntry,
  type LeaderboardScope,
  type PlayerRow,
} from '@/lib/leaderboard'
import type { User } from '@/payload-types'
import '../styles.css'
import './leaderboard.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Leaderboard',
  description: 'See who tops Terra Tap — worldwide, in your region, and in your country.',
}

const BOARD_LABEL: Record<LeaderboardBoard, string> = {
  daily: "Today's Daily",
  alltime: 'All-time',
  streak: 'Streak',
}
const SCOPE_LABEL: Record<LeaderboardScope, string> = {
  world: 'World',
  region: 'My region',
  country: 'My country',
}

const scoreText = (board: LeaderboardBoard, score: number): string =>
  board === 'streak'
    ? `${score} day${score === 1 ? '' : 's'}`
    : score.toLocaleString()

function Row({
  entry,
  board,
  isMe,
}: {
  entry: LeaderboardEntry
  board: LeaderboardBoard
  isMe: boolean
}) {
  return (
    <li className={`lb-row${isMe ? ' is-me' : ''}`}>
      <span className="lb-rank">{entry.rank}</span>
      <span className="lb-flag">{entry.flag || '🌐'}</span>
      <span className="lb-name">
        {entry.displayName}
        {isMe && <span className="lb-you"> you</span>}
      </span>
      <span className="lb-score">{scoreText(board, entry.score)}</span>
    </li>
  )
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; scope?: string }>
}) {
  const { board: rawBoard, scope: rawScope } = await searchParams
  const board = (BOARDS as string[]).includes(rawBoard ?? '')
    ? (rawBoard as LeaderboardBoard)
    : 'daily'
  const scope = (SCOPES as string[]).includes(rawScope ?? '')
    ? (rawScope as LeaderboardScope)
    : 'world'

  const viewer = await getCurrentUser()
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'results',
    overrideAccess: true, // public aggregate view, not per-user reads
    depth: 1,
    limit: 5000,
    sort: '-createdAt',
  })

  const rows: PlayerRow[] = docs
    .filter((d) => d.user && typeof d.user === 'object')
    .map((d) => {
      const u = d.user as User
      return {
        userId: u.id,
        displayName: u.displayName || 'Player',
        flag: u.countryFlag ?? null,
        mode: d.mode,
        dateKey: d.dateKey,
        total: d.total,
        createdAt: d.createdAt,
      }
    })

  const todayKey = new Date().toISOString().slice(0, 10)
  const needsFlag = scope !== 'world' && !viewer?.countryFlag
  const scoped = filterByScope(rows, scope, viewer?.countryFlag ?? null)
  const entries = rankBoard(scoped, board, todayKey)
  const top = entries.slice(0, 50)
  const mine = findEntry(entries, viewer?.id)
  const mineInTop = !!mine && top.some((e) => String(e.userId) === String(mine.userId))

  return (
    <main className="lb-root">
      <header className="lb-head">
        <Link href="/" className="lb-back">
          ← Terra Tap
        </Link>
        <h1>Leaderboard</h1>
      </header>

      <nav className="lb-switch" aria-label="Board">
        {BOARDS.map((b) => (
          <Link
            key={b}
            href={`/leaderboard?board=${b}&scope=${scope}`}
            className={`lb-pill${b === board ? ' is-active' : ''}`}
          >
            {BOARD_LABEL[b]}
          </Link>
        ))}
      </nav>
      <nav className="lb-switch lb-switch-scope" aria-label="Scope">
        {SCOPES.map((s) => (
          <Link
            key={s}
            href={`/leaderboard?board=${board}&scope=${s}`}
            className={`lb-pill${s === scope ? ' is-active' : ''}`}
          >
            {SCOPE_LABEL[s]}
          </Link>
        ))}
      </nav>

      {needsFlag ? (
        <p className="lb-empty">
          Set a country flag on your <Link href="/account">account</Link> to see region and
          country boards.
        </p>
      ) : entries.length === 0 ? (
        <p className="lb-empty">
          No scores yet on this board. <Link href="/play">Play the daily</Link> to be the first!
        </p>
      ) : (
        <>
          <ol className="lb-list">
            {top.map((e) => (
              <Row
                key={e.userId}
                entry={e}
                board={board}
                isMe={!!viewer && String(e.userId) === String(viewer.id)}
              />
            ))}
          </ol>
          {mine && !mineInTop && (
            <ol className="lb-list lb-list-me">
              <Row entry={mine} board={board} isMe />
            </ol>
          )}
        </>
      )}

      {!viewer && (
        <p className="lb-note">
          <Link href="/account">Sign in</Link> to appear on the leaderboard.
        </p>
      )}
    </main>
  )
}
