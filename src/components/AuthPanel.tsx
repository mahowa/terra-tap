'use client'

import { useState } from 'react'
import {
  MIN_PASSWORD_LENGTH,
  emailProblem,
  isEmailTaken,
  normalizeEmail,
  passwordProblem,
  signupErrorMessage,
} from '@/lib/signup'
import { rememberDurationLabel } from '@/lib/session'

/**
 * Sign-in / sign-up panel (issue #49). Talks to Payload's built-in auth REST
 * endpoints on the same origin so Payload manages the HTTP-only session cookie;
 * on success we reload so the server components re-render as the signed-in user.
 *
 * The fields are uncontrolled and read from the form on submit (issue #65).
 * Browsers fill saved credentials straight into the DOM without firing React's
 * change event, so a controlled mirror could hold a different address — or
 * nothing — than the one on screen, and the player would be told "the following
 * field is invalid: email" about an email they never typed.
 */
export default function AuthPanel() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set when sign-up fails because the address is taken: the fix is a tab away.
  const [emailTaken, setEmailTaken] = useState(false)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = normalizeEmail(String(form.get('email') ?? ''))
    const password = String(form.get('password') ?? '')
    const displayName = String(form.get('displayName') ?? '').trim()
    // Off means a session cookie: signed out when the browser closes (#73).
    const remember = form.get('remember') === 'on'

    const problem = emailProblem(email) ?? passwordProblem(password)
    if (problem) {
      setEmailTaken(false)
      setError(problem)
      return
    }

    setBusy(true)
    setError(null)
    setEmailTaken(false)
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          setEmailTaken(isEmailTaken(data))
          throw new Error(signupErrorMessage(data))
        }
      }
      const login = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, remember }),
      })
      if (!login.ok) {
        throw new Error(
          mode === 'signup'
            ? 'Account created, but signing in failed. Try signing in.'
            : 'Wrong email or password.',
        )
      }
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const switchTo = (next: 'signin' | 'signup') => {
    setMode(next)
    setError(null)
    setEmailTaken(false)
  }

  return (
    <section className="ac-auth">
      <div className="ac-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={`ac-tab${mode === 'signin' ? ' is-active' : ''}`}
          onClick={() => switchTo('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={`ac-tab${mode === 'signup' ? ' is-active' : ''}`}
          onClick={() => switchTo('signup')}
        >
          Create account
        </button>
      </div>

      <form className="ac-form" onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <label>
            Display name
            <input type="text" name="displayName" autoComplete="nickname" maxLength={40} />
          </label>
        )}
        <label>
          Email
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </label>
        {/* Stay signed in (#73): on by default, because a daily game you're
            signed out of by tomorrow isn't much of a streak. */}
        <label className="ac-check">
          <input type="checkbox" name="remember" defaultChecked />
          <span>
            Stay signed in
            <small> — for {rememberDurationLabel()} on this device</small>
          </span>
        </label>
        {error && (
          <p className="ac-error" role="alert">
            {error}
            {emailTaken && (
              <>
                {' '}
                <button type="button" className="ac-error-action" onClick={() => switchTo('signin')}>
                  Sign in instead
                </button>
              </>
            )}
          </p>
        )}
        <button type="submit" className="ac-btn ac-btn-primary" disabled={busy}>
          {busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </section>
  )
}
