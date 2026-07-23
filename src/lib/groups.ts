/**
 * Pure helpers for friend groups (issue #51). Slug + invite-code generation and
 * validation live here so they're unit-testable; the routes handle DB
 * uniqueness (retry on collision) and membership mutations.
 */

/** URL-safe slug from a group name; always non-empty. */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return base || 'group'
}

// Invite-code alphabet: uppercase + digits, minus easily-confused chars
// (0/O, 1/I/L) so codes are easy to read aloud and type.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** A random invite code from `rng` (injectable so tests are deterministic). */
export function generateCode(rng: () => number, length = 6): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)]
  }
  return out
}

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{4,12}$`)

/** Normalize a user-entered code (trim + uppercase) for lookup. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(normalizeCode(code))
}

/** Distinct member ids for a group (owner always counts as a member). */
export function memberIds(
  owner: string | number,
  members: Array<string | number>,
): string[] {
  return [...new Set([owner, ...members].map(String))]
}
