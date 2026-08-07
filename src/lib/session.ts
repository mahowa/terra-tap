/**
 * Session persistence (issue #73).
 *
 * Payload signs a JWT and hands it back in a `payload-token` cookie whose
 * lifetime comes from the collection's `tokenExpiration` — two hours by
 * default, which is why a player was signed out again by their next sitting.
 *
 * Whether a sign-in survives closing the browser is a property of the *cookie*,
 * not the token, so the login route sets it: "stay signed in" writes a dated
 * cookie, and leaving it off writes a session cookie the browser drops on exit.
 * Payload keeps server-side sessions (`useSessions`), so signing out still
 * revokes the token itself rather than just forgetting it here.
 */

/** Name Payload reads the token from (`${cookiePrefix}-token`, default prefix). */
export const AUTH_COOKIE = 'payload-token'

/** How long a remembered sign-in lasts. Also the token's own lifetime. */
export const REMEMBER_ME_SECONDS = 60 * 60 * 24 * 30 // 30 days

export type SessionCookieOptions = {
  httpOnly: true
  sameSite: 'lax'
  path: '/'
  secure: boolean
  /** Absent for a session cookie — the browser drops it when it closes. */
  maxAge?: number
}

/**
 * Cookie attributes for a sign-in. `remember` dates the cookie; without it the
 * cookie has no lifetime of its own and lasts the browser session.
 */
export function sessionCookieOptions(remember: boolean, secure: boolean): SessionCookieOptions {
  const base = { httpOnly: true, sameSite: 'lax', path: '/', secure } as const
  return remember ? { ...base, maxAge: REMEMBER_ME_SECONDS } : base
}

/** How long a sign-in lasts, in words, for the toggle's hint. */
export function rememberDurationLabel(seconds: number = REMEMBER_ME_SECONDS): string {
  const days = Math.round(seconds / 86_400)
  return days === 1 ? '1 day' : `${days} days`
}
