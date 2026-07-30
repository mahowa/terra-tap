import { describe, it, expect } from 'vitest'
import {
  MIN_PASSWORD_LENGTH,
  emailProblem,
  isEmailTaken,
  normalizeEmail,
  parseFieldIssues,
  passwordProblem,
  signupErrorMessage,
} from '@/lib/signup'

/**
 * Issue #65: sign-up failed with "The following field is invalid: email" — the
 * summary line Payload puts on top of the real, actionable reason. These bodies
 * are the shape `formatErrors` actually returns (payload 3.85).
 */
const duplicateEmailBody = {
  errors: [
    {
      name: 'ValidationError',
      data: {
        collection: 'users',
        errors: [
          { message: 'A user with the given email is already registered.', path: 'email' },
        ],
      },
      message: 'The following field is invalid: email',
    },
  ],
}

const invalidEmailBody = {
  errors: [
    {
      name: 'ValidationError',
      data: {
        collection: 'users',
        errors: [{ message: 'Please enter a valid email address.', path: 'email' }],
      },
      message: 'The following field is invalid: email',
    },
  ],
}

describe('parseFieldIssues', () => {
  it('digs the field-level reason out of a Payload validation error', () => {
    expect(parseFieldIssues(duplicateEmailBody)).toEqual([
      { path: 'email', message: 'A user with the given email is already registered.' },
    ])
  })

  it('collects every field when more than one failed', () => {
    const issues = parseFieldIssues({
      errors: [
        {
          data: {
            errors: [
              { message: 'Please enter a valid email address.', path: 'email' },
              { message: 'This field is required.', path: 'password' },
            ],
          },
          message: 'The following fields are invalid: email, password',
        },
      ],
    })
    expect(issues.map((i) => i.path)).toEqual(['email', 'password'])
  })

  it('returns nothing for bodies that are not Payload-shaped', () => {
    expect(parseFieldIssues(null)).toEqual([])
    expect(parseFieldIssues('<html>502 Bad Gateway</html>')).toEqual([])
    expect(parseFieldIssues({ errors: [{ message: 'Something went wrong.' }] })).toEqual([])
    expect(parseFieldIssues({ errors: 'nope' })).toEqual([])
  })
})

describe('isEmailTaken', () => {
  it('recognizes the duplicate-address failure', () => {
    expect(isEmailTaken(duplicateEmailBody)).toBe(true)
  })

  it('does not confuse a malformed address for a taken one', () => {
    expect(isEmailTaken(invalidEmailBody)).toBe(false)
    expect(isEmailTaken(null)).toBe(false)
  })
})

describe('signupErrorMessage (#65)', () => {
  it('offers a way forward when the address already has an account', () => {
    const message = signupErrorMessage(duplicateEmailBody)
    expect(message).toMatch(/already has an account/i)
    expect(message).toMatch(/sign in/i)
    // Never the summary line the player was shown before.
    expect(message).not.toMatch(/following field is invalid/i)
  })

  it('passes through the server’s reason for other field failures', () => {
    expect(signupErrorMessage(invalidEmailBody)).toBe('Please enter a valid email address.')
  })

  it('falls back to the top-level message, then to something plain', () => {
    expect(signupErrorMessage({ errors: [{ message: 'Rate limit exceeded.' }] })).toBe(
      'Rate limit exceeded.',
    )
    expect(signupErrorMessage(null)).toMatch(/could not create the account/i)
    expect(signupErrorMessage({})).toMatch(/could not create the account/i)
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases so login matches what sign-up stored', () => {
    expect(normalizeEmail('  Player@Example.COM ')).toBe('player@example.com')
    expect(normalizeEmail('\nplayer@example.com\t')).toBe('player@example.com')
  })

  it('leaves an already-clean address alone', () => {
    expect(normalizeEmail('player@example.com')).toBe('player@example.com')
  })
})

describe('field checks', () => {
  it('names the missing field instead of failing at the server', () => {
    expect(emailProblem('')).toMatch(/enter your email/i)
    expect(emailProblem('howa')).toMatch(/valid email/i)
    expect(emailProblem('player@example.com')).toBeNull()
  })

  it('applies Payload’s password rule up front', () => {
    expect(passwordProblem('')).toMatch(/enter a password/i)
    expect(passwordProblem('short')).toMatch(new RegExp(`${MIN_PASSWORD_LENGTH} characters`))
    expect(passwordProblem('longenough')).toBeNull()
  })
})
