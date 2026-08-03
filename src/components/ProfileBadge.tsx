import Link from 'next/link'
import { initialsFor, profileLabel } from '@/lib/profile'

/**
 * The top-right corner badge (issue #67): initials when you're signed in, a
 * "Sign in" pill when you're not — so which one you are is readable at a
 * glance from any page. Presentational and prop-driven; `ProfileCorner`
 * resolves the current user for it.
 */
export default function ProfileBadge({
  displayName,
  email,
  flag,
}: {
  /** Null/undefined for a signed-out visitor. */
  displayName?: string | null
  email?: string | null
  flag?: string | null
}) {
  const signedIn = !!(displayName || email)

  if (!signedIn) {
    return (
      <Link className="tt-profile tt-profile-out" href="/account">
        Sign in
      </Link>
    )
  }

  const label = profileLabel(displayName, email)
  return (
    <Link className="tt-profile" href="/account" aria-label={label} title={label}>
      <span className="tt-profile-initials" aria-hidden="true">
        {initialsFor(displayName, email)}
      </span>
      {flag && (
        <span className="tt-profile-flag" aria-hidden="true">
          {flag}
        </span>
      )}
    </Link>
  )
}
