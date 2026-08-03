/**
 * Profile identity bits (issue #67). Signed in, there was nothing on screen
 * saying so — the account link looked the same either way. The corner badge
 * shows who you are as initials, which needs a name reduced to one or two
 * letters. Pure so the reduction is unit-tested.
 */

/** Letters only, so punctuation and emoji in a display name don't become initials. */
const isLetter = (ch: string): boolean => /\p{L}|\p{N}/u.test(ch)

/** First letter-ish character of a word, or '' if it has none. */
function firstLetter(word: string): string {
  for (const ch of word) {
    if (isLetter(ch)) return ch.toUpperCase()
  }
  return ''
}

/** Words of a name, ignoring separators people put between them. */
function words(name: string): string[] {
  return name
    .split(/[\s._\-,]+/)
    .map((w) => w.trim())
    .filter((w) => firstLetter(w) !== '')
}

/**
 * Up to two initials for the badge: first and last word of a display name
 * ("Matt J Howa" → "MH"), a single letter for a one-word name, and the email's
 * local part as a fallback for accounts with no name yet. '?' when there's
 * nothing usable — a badge is still better than a blank corner.
 */
export function initialsFor(
  displayName?: string | null,
  email?: string | null,
): string {
  const parts = words(displayName ?? '')
  if (parts.length >= 2) {
    return firstLetter(parts[0]) + firstLetter(parts[parts.length - 1])
  }
  if (parts.length === 1) return firstLetter(parts[0])

  const local = (email ?? '').split('@')[0] ?? ''
  const emailParts = words(local)
  if (emailParts.length >= 2) {
    return firstLetter(emailParts[0]) + firstLetter(emailParts[emailParts.length - 1])
  }
  if (emailParts.length === 1) return firstLetter(emailParts[0])

  return '?'
}

/** What the badge is called for screen readers and on hover. */
export function profileLabel(displayName?: string | null, email?: string | null): string {
  const name = displayName?.trim() || email?.trim()
  return name ? `Your account — ${name}` : 'Your account'
}
