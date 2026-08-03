import { getCurrentUser } from '@/lib/auth'
import type { User } from '@/payload-types'
import ProfileBadge from './ProfileBadge'

/**
 * Resolves the signed-in player for the corner badge (issue #67). Rendered from
 * the frontend layout, so it appears on every page.
 *
 * A failure here must never take a page down with it: the game is playable
 * signed out, and the database being unreachable should cost the corner badge,
 * not the globe. Any error reads as "signed out".
 */
export default async function ProfileCorner() {
  let user: User | null = null
  try {
    user = await getCurrentUser()
  } catch {
    user = null
  }
  return (
    <ProfileBadge displayName={user?.displayName} email={user?.email} flag={user?.countryFlag} />
  )
}
