import { describe, it, expect } from 'vitest'
import {
  AUTH_COOKIE,
  REMEMBER_ME_SECONDS,
  rememberDurationLabel,
  sessionCookieOptions,
} from '@/lib/session'

/**
 * Issue #73: sign-ins lasted two hours (Payload's default `tokenExpiration`),
 * so a daily game signed you out between sittings. Persistence is now the
 * cookie's job, chosen by the toggle at login.
 */
describe('sessionCookieOptions (#73)', () => {
  it('dates the cookie when the player asks to stay signed in', () => {
    expect(sessionCookieOptions(true, true).maxAge).toBe(REMEMBER_ME_SECONDS)
  })

  it('writes a session cookie otherwise, so the browser drops it on exit', () => {
    const options = sessionCookieOptions(false, true)
    expect(options.maxAge).toBeUndefined()
    expect('maxAge' in options).toBe(false)
  })

  it('keeps the token out of scripts either way', () => {
    for (const remember of [true, false]) {
      const options = sessionCookieOptions(remember, true)
      expect(options.httpOnly).toBe(true)
      expect(options.sameSite).toBe('lax')
      expect(options.path).toBe('/')
    }
  })

  it('passes the secure flag through for production', () => {
    expect(sessionCookieOptions(true, true).secure).toBe(true)
    // ...and off for plain-http local development, or the cookie never sets.
    expect(sessionCookieOptions(true, false).secure).toBe(false)
  })

  it('lasts a month, matching the token Payload signs', () => {
    expect(REMEMBER_ME_SECONDS).toBe(60 * 60 * 24 * 30)
  })

  it('uses the cookie name Payload reads the token from', () => {
    expect(AUTH_COOKIE).toBe('payload-token')
  })
})

describe('rememberDurationLabel', () => {
  it('says how long the sign-in lasts', () => {
    expect(rememberDurationLabel()).toBe('30 days')
    expect(rememberDurationLabel(86_400)).toBe('1 day')
    expect(rememberDurationLabel(86_400 * 7)).toBe('7 days')
  })
})
