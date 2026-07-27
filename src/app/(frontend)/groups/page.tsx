import Link from 'next/link'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import GroupsForms from '@/components/GroupsForms'
import '../styles.css'
import '../account/account.css'
import './groups.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Groups',
  description: 'Create a group and see how you stack up against your friends.',
}

export default async function GroupsPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <main className="ac-root">
        <Link href="/" className="ac-back">
          ← Terra Tap
        </Link>
        <h1>Groups</h1>
        <p className="ac-sub">
          <Link href="/account">Sign in</Link> to create a group and compare scores with your
          friends.
        </p>
      </main>
    )
  }

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'groups',
    overrideAccess: false,
    user,
    depth: 0,
    limit: 100,
    sort: '-createdAt',
  })

  return (
    <main className="ac-root">
      <Link href="/" className="ac-back">
        ← Terra Tap
      </Link>
      <h1>Your groups</h1>

      {docs.length === 0 ? (
        <p className="ac-sub">You’re not in any groups yet. Create one or join with a code.</p>
      ) : (
        <ul className="gr-list">
          {docs.map((g) => (
            <li key={g.id}>
              <Link href={`/groups/${g.slug}`}>
                <span className="gr-emoji">{g.avatarEmoji || '👥'}</span>
                <span className="gr-name">{g.name}</span>
                <span className="gr-arrow">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <GroupsForms />
    </main>
  )
}
