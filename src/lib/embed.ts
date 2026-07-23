import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signed tokens for embedding a private group's standings (issue #48). An
 * unlisted group's widget is public by slug; a private group's widget requires
 * `?t=<token>`, an HMAC over the group id keyed by the server secret. Rotating
 * the secret (or, in practice, the group's invite code path) revokes old embeds.
 * Deterministic → unit-testable.
 */

export function embedToken(groupId: string | number, secret: string): string {
  return createHmac('sha256', secret).update(`group:${groupId}`).digest('hex').slice(0, 24)
}

export function verifyEmbedToken(
  groupId: string | number,
  token: string | null | undefined,
  secret: string,
): boolean {
  if (!token) return false
  const expected = embedToken(groupId, secret)
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
