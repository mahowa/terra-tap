/**
 * Sign-up / sign-in error handling (issue #65).
 *
 * Payload's REST errors are two layers deep: the top-level `message` is only a
 * summary of *which* fields failed ("The following field is invalid: email"),
 * while the reason a player can act on ("A user with the given email is already
 * registered.") sits in `errors[0].data.errors[]`. The account panel used to
 * show the summary, so a duplicate address and a malformed one both read as the
 * same dead end. Pure so the parsing is unit-tested without a server.
 */

/** A single field-level complaint from Payload. */
export type FieldIssue = { path: string; message: string }

type PayloadErrorBody = {
  errors?: {
    message?: unknown
    data?: { errors?: { path?: unknown; message?: unknown }[] } | unknown
  }[]
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * Field-level issues from a Payload error body, in the order the server
 * reported them. Empty when the body isn't Payload-shaped (an HTML error page,
 * a proxy timeout, a parse failure).
 */
export function parseFieldIssues(body: unknown): FieldIssue[] {
  const errors = (body as PayloadErrorBody | null)?.errors
  if (!Array.isArray(errors)) return []
  const issues: FieldIssue[] = []
  for (const error of errors) {
    const nested = (error?.data as { errors?: unknown })?.errors
    if (!Array.isArray(nested)) continue
    for (const issue of nested) {
      const message = str(issue?.message)
      if (message) issues.push({ path: str(issue?.path), message })
    }
  }
  return issues
}

/** Does this failure mean the address already has an account? */
export function isEmailTaken(body: unknown): boolean {
  return parseFieldIssues(body).some(
    (issue) => issue.path === 'email' && /already registered/i.test(issue.message),
  )
}

const GENERIC_SIGNUP_ERROR = 'Could not create the account. Please try again.'

/**
 * What to tell the player when sign-up fails. Prefers Payload's field-level
 * messages; the duplicate-address case gets a way forward instead of a
 * restatement, since that's the one failure the player can fix from here.
 */
export function signupErrorMessage(body: unknown): string {
  if (isEmailTaken(body)) {
    return 'That email already has an account — switch to Sign in, or use another address.'
  }
  const issues = parseFieldIssues(body)
  if (issues.length > 0) return issues.map((issue) => issue.message).join(' ')
  const top = str((body as PayloadErrorBody | null)?.errors?.[0]?.message)
  return top || GENERIC_SIGNUP_ERROR
}

/**
 * Emails are matched exactly on login, so the address is normalized before it's
 * sent: trailing whitespace from a paste, or a capitalized first letter from a
 * phone keyboard, must not create an account the player then can't sign in to.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Client-side check with the same message the server would eventually give. */
export function emailProblem(email: string): string | null {
  if (!email) return 'Enter your email address.'
  // Deliberately loose — the server is the authority; this only catches the
  // obvious "the field never made it here" case (#65).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.'
  return null
}

/** Same, for the password rule Payload's auth enforces. */
export const MIN_PASSWORD_LENGTH = 8

export function passwordProblem(password: string): string | null {
  if (!password) return 'Enter a password.'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return null
}
