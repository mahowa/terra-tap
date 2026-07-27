import { getPayloadClient } from '@/lib/auth'
import { BOARDS, rankBoard, type LeaderboardBoard, type PlayerRow } from '@/lib/leaderboard'
import { memberIds } from '@/lib/groups'
import { verifyEmbedToken } from '@/lib/embed'
import type { User } from '@/payload-types'
import './embed.css'

export const dynamic = 'force-dynamic'

const BOARD_LABEL: Record<LeaderboardBoard, string> = {
  daily: 'Daily',
  alltime: 'All-time',
  streak: 'Streak',
}
const scoreText = (b: LeaderboardBoard, s: number) =>
  b === 'streak' ? `${s}d` : s.toLocaleString()

const asUser = (v: unknown): User | null => (v && typeof v === 'object' ? (v as User) : null)

function Shell({
  theme,
  children,
}: {
  theme: string
  children: React.ReactNode
}) {
  const cls = theme === 'light' ? 'emb light' : theme === 'dark' ? 'emb dark' : 'emb'
  return <div className={cls}>{children}</div>
}

export default async function EmbedGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ board?: string; theme?: string; rows?: string; t?: string }>
}) {
  const { slug } = await params
  const { board: rawBoard, theme = 'auto', rows: rawRows, t } = await searchParams
  const board = (BOARDS as string[]).includes(rawBoard ?? '')
    ? (rawBoard as LeaderboardBoard)
    : 'daily'
  const rowLimit = Math.min(25, Math.max(3, Number(rawRows) || 10))

  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'groups',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  const group = found.docs[0]
  if (!group) {
    return (
      <Shell theme={theme}>
        <p className="emb-msg">Group not found.</p>
      </Shell>
    )
  }

  // Private groups require a valid signed token; unlisted are public by slug.
  if (group.visibility === 'private') {
    const ok = verifyEmbedToken(group.id, t, process.env.PAYLOAD_SECRET || '')
    if (!ok) {
      return (
        <Shell theme={theme}>
          <p className="emb-msg">This group is private.</p>
        </Shell>
      )
    }
  }

  const ownerUser = asUser(group.owner)
  const ownerId = ownerUser?.id ?? group.owner
  const ids = memberIds(
    ownerId as string | number,
    (group.members ?? []).map((m) => (asUser(m)?.id ?? m) as string | number),
  )

  const { docs } = await payload.find({
    collection: 'results',
    where: { user: { in: ids } },
    depth: 1,
    limit: 5000,
    sort: '-createdAt',
    overrideAccess: true,
  })
  const playerRows: PlayerRow[] = docs
    .map((d) => ({ d, u: asUser(d.user) }))
    .filter((x): x is { d: (typeof docs)[number]; u: User } => !!x.u)
    .map(({ d, u }) => ({
      userId: u.id,
      displayName: u.displayName || 'Player',
      flag: u.countryFlag ?? null,
      mode: d.mode,
      dateKey: d.dateKey,
      total: d.total,
      createdAt: d.createdAt,
    }))
  const todayKey = new Date().toISOString().slice(0, 10)
  const entries = rankBoard(playerRows, board, todayKey).slice(0, rowLimit)

  return (
    <Shell theme={theme}>
      <div className="emb-head">
        <span className="emb-emoji">{group.avatarEmoji || '👥'}</span>
        <span className="emb-name">{group.name}</span>
        <span className="emb-board">{BOARD_LABEL[board]}</span>
      </div>
      {entries.length === 0 ? (
        <p className="emb-msg">No scores yet.</p>
      ) : (
        <ol className="emb-list">
          {entries.map((e) => (
            <li key={e.userId} className="emb-row">
              <span className="emb-rank">{e.rank}</span>
              <span className="emb-flag">{e.flag || '🌐'}</span>
              <span className="emb-player">{e.displayName}</span>
              <span className="emb-score">{scoreText(board, e.score)}</span>
            </li>
          ))}
        </ol>
      )}
      <a
        className="emb-foot"
        href="/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Terra Tap
      </a>
    </Shell>
  )
}
