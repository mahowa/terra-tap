'use client'

import { useState } from 'react'

/**
 * Sign-in / sign-up panel (issue #49). Talks to Payload's built-in auth REST
 * endpoints on the same origin so Payload manages the HTTP-only session cookie;
 * on success we reload so the server components re-render as the signed-in user.
 */
export default function AuthPanel() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.errors?.[0]?.message || 'Could not create the account.')
        }
      }
      const login = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      })
      if (!login.ok) throw new Error('Wrong email or password.')
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <section className="ac-auth">
      <div className="ac-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === 'signin'}
          className={`ac-tab${mode === 'signin' ? ' is-active' : ''}`}
          onClick={() => setMode('signin')}
        >
          Sign in
        </button>
        <button
          role="tab"
          aria-selected={mode === 'signup'}
          className={`ac-tab${mode === 'signup' ? ' is-active' : ''}`}
          onClick={() => setMode('signup')}
        >
          Create account
        </button>
      </div>

      <form className="ac-form" onSubmit={submit}>
        {mode === 'signup' && (
          <label>
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              maxLength={40}
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </label>
        {error && (
          <p className="ac-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="ac-btn ac-btn-primary" disabled={busy}>
          {busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </section>
  )
}
