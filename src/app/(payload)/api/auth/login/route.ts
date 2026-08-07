import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { normalizeEmail } from '@/lib/signup'
import { AUTH_COOKIE, sessionCookieOptions } from '@/lib/session'

/**
 * Sign-in that can outlive the browser session (issue #73).
 *
 * Payload's own login endpoint always dates the cookie to `tokenExpiration`.
 * This one mints the same token through the local API and sets the cookie
 * itself, so the "stay signed in" toggle decides: dated for a month, or a
 * session cookie that goes when the browser does. The token is identical either
 * way — Payload reads it from the same cookie, and `/api/users/logout` still
 * clears it and revokes the session.
 */

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const email = normalizeEmail(String(body.email ?? ''))
  const password = String(body.password ?? '')
  const remember = body.remember === true
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })
  try {
    const { token, user } = await payload.login({
      collection: 'users',
      data: { email, password },
    })
    if (!token || !user) {
      return NextResponse.json({ error: 'login failed' }, { status: 500 })
    }
    const res = NextResponse.json({
      ok: true,
      remember,
      user: { id: user.id, displayName: user.displayName ?? null },
    })
    res.cookies.set(
      AUTH_COOKIE,
      token,
      sessionCookieOptions(remember, process.env.NODE_ENV === 'production'),
    )
    return res
  } catch {
    // Payload throws on bad credentials, a locked account, and unverified
    // users alike; none of those should tell an attacker which one it was.
    return NextResponse.json({ error: 'invalid email or password' }, { status: 401 })
  }
}
