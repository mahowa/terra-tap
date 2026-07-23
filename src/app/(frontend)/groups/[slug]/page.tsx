import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import { BOARDS, rankBoard, type LeaderboardBoard, type PlayerRow } from '@/lib/leaderboard'
import { memberIds, normalizeCode } from '@/lib/groups'
import GroupActions from '@/components/GroupActions'
import type { User } from '@/payload-types'
import '../../styles.css'
import '../../account/account.css'
import '../../leaderboard/leaderboard.css'
import '../groups.css'

export const dynamic = 'force-dynamic'

const BOARD_LABEL: Record<LeaderboardBoard, string> = {
  daily: "Today's Daily",
  alltime: 'All-time',
  streak: 'Streak',
}
const scoreText = (b: LeaderboardBoard, s: number) =>
  b === 'streak' ? `${s} day${s === 1 ? '' : 's'}` : s.toLocaleString()

const asUser = (v: unknown): User | null =>
  v && typeof v === 'object' ? (v as User) : null

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ board?: string; code?: string }>
}) {
  const { slug } = await params
  const { board: rawBoard, code } = await searchParams
  const board = (BOARDS as string[]).includes(rawBoard ?? '')
    ? (rawBoard as LeaderboardBoard)
    : 'daily'

  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'groups',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  const group = found.docs[0]
  if (!group) notFound()

  const viewer = await getCurrentUser()
  const ownerUser = asUser(group.owner)
  const ownerId = ownerUser?.id ?? group.owner
  const memberUsers = [
    ...(ownerUser ? [ownerUser] : []),
    ...(group.members ?? []).map(asUser).filter((u): u is User => !!u),
  ].filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i)
  const ids = memberIds(
    ownerId as string | number,
    (group.members ?? []).map((m) => (asUser(m)?.id ?? m) as string | number),
  )

  const isOwner = !!viewer && String(viewer.id) === String(ownerId)
  const isMember = !!viewer && ids.includes(String(viewer.id))
  const codeMatches = !!code && normalizeCode(code) === group.inviteCode
  const canView = isMember || group.visibility === 'unlisted' || isOwner

  // Member-scoped leaderboard rows.
  let entries: ReturnType<typeof rankBoard> = []
  if (canView && ids.length) {
    const { docs } = await payload.find({
      collection: 'results',
      where: { user: { in: ids } },
      depth: 1,
      limit: 5000,
      sort: '-createdAt',
      overrideAccess: true,
    })
    const rows: PlayerRow[] = docs
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
    entries = rankBoard(rows, board, todayKey)
  }

  return (
    <main className="gr-root">
      <Link href="/groups" className="ac-back">
        ← Your groups
      </Link>
      <h1 className="gr-title">
        <span className="gr-emoji-lg">{group.avatarEmoji || '👥'}</span>
        {group.name}
      </h1>
      <p className="gr-meta">
        {memberUsers.length} member{memberUsers.length === 1 ? '' : 's'}
        {group.visibility === 'private' ? ' · private' : ''}
      </p>

      <GroupActions
        groupId={group.id}
        slug={group.slug}
        isOwner={isOwner}
        isMember={isMember}
        joinCode={!!viewer && !isMember && codeMatches ? group.inviteCode : null}
        signedIn={!!viewer}
        inviteCode={isOwner ? group.inviteCode : null}
      />

      {!canView ? (
        <p className="gr-private">
          This group is private. Ask a member for an invite link to see the standings.
        </p>
      ) : (
        <>
          <nav className="lb-switch" aria-label="Board">
            {BOARDS.map((b) => (
              <Link
                key={b}
                href={`/groups/${slug}?board=${b}`}
                className={`lb-pill${b === board ? ' is-active' : ''}`}
              >
                {BOARD_LABEL[b]}
              </Link>
            ))}
          </nav>

          {entries.length === 0 ? (
            <p className="ac-sub">No scores on this board yet.</p>
          ) : (
            <ol className="lb-list">
              {entries.map((e) => (
                <li
                  key={e.userId}
                  className={`lb-row${viewer && String(e.userId) === String(viewer.id) ? ' is-me' : ''}`}
                >
                  <span className="lb-rank">{e.rank}</span>
                  <span className="lb-flag">{e.flag || '🌐'}</span>
                  <span className="lb-name">{e.displayName}</span>
                  <span className="lb-score">{scoreText(board, e.score)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  )
}
