import Link from 'next/link'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import { summarizeResults } from '@/lib/account'
import AuthPanel from '@/components/AuthPanel'
import AccountClient from '@/components/AccountClient'
import '../styles.css'
import './account.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Your account',
  description: 'Sign in to keep your Terra Tap progress across devices.',
}

export default async function AccountPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <main className="ac-root">
        <header className="ac-head">
          <Link href="/" className="ac-back">
            ← Terra Tap
          </Link>
          <h1>Your account</h1>
          <p className="ac-sub">
            A free account keeps your streaks and scores across every device — and puts you on
            the leaderboard.
          </p>
        </header>
        <AuthPanel />
      </main>
    )
  }

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'results',
    where: { user: { equals: user.id } },
    sort: '-createdAt',
    limit: 200,
    depth: 0,
    overrideAccess: false,
    user,
  })

  const todayKey = new Date().toISOString().slice(0, 10)
  const summary = summarizeResults(
    docs.map((d) => ({ mode: d.mode, dateKey: d.dateKey, total: d.total })),
    todayKey,
  )
  const recent = docs.slice(0, 10)

  return (
    <main className="ac-root">
      <header className="ac-head">
        <Link href="/" className="ac-back">
          ← Terra Tap
        </Link>
        <h1>
          {user.countryFlag ? <span className="ac-flag">{user.countryFlag}</span> : null}
          {user.displayName || user.email}
        </h1>
        <p className="ac-sub">{user.email}</p>
      </header>

      <section className="ac-stats" aria-label="Lifetime stats">
        <div className="ac-stat">
          <strong>{summary.totalGames}</strong>
          <span>games</span>
        </div>
        <div className="ac-stat">
          <strong>{summary.totalPoints.toLocaleString()}</strong>
          <span>total points</span>
        </div>
        <div className="ac-stat">
          <strong>{summary.daily.currentStreak}</strong>
          <span>daily streak 🔥</span>
        </div>
        <div className="ac-stat">
          <strong>{summary.daily.maxStreak}</strong>
          <span>best streak</span>
        </div>
        <div className="ac-stat">
          <strong>{summary.daily.best}</strong>
          <span>best daily</span>
        </div>
      </section>

      <section className="ac-recent" aria-label="Recent games">
        <h2>Recent games</h2>
        {recent.length === 0 ? (
          <p className="ac-empty">
            No games yet — <Link href="/play">play today’s daily</Link> and it’ll show up here.
          </p>
        ) : (
          <ul>
            {recent.map((r) => (
              <li key={r.id}>
                <span className="ac-recent-mode">{r.mode}</span>
                <span className="ac-recent-title">{r.title || r.dateKey || '—'}</span>
                <span className="ac-recent-score">{r.total}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AccountClient
        displayName={user.displayName ?? ''}
        countryFlag={user.countryFlag ?? ''}
        userId={user.id}
      />
    </main>
  )
}
