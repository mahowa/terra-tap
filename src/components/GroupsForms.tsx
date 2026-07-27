'use client'

import { useState } from 'react'

/** Create-a-group and join-by-code forms for /groups (issue #51). */
export default function GroupsForms() {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const post = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Something went wrong.')
      window.location.href = `/groups/${data.slug}`
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="gr-forms">
      <section>
        <h2>Create a group</h2>
        <form
          className="ac-form"
          onSubmit={(e) => {
            e.preventDefault()
            void post({ action: 'create', name, avatarEmoji: emoji })
          }}
        >
          <label>
            Group name
            <input
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Emoji badge (optional)
            <input
              type="text"
              maxLength={8}
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
            />
          </label>
          <button type="submit" className="ac-btn ac-btn-primary" disabled={busy}>
            Create group
          </button>
        </form>
      </section>

      <section>
        <h2>Join a group</h2>
        <form
          className="ac-form"
          onSubmit={(e) => {
            e.preventDefault()
            void post({ action: 'join', code })
          }}
        >
          <label>
            Invite code
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. K7P2QR"
            />
          </label>
          <button type="submit" className="ac-btn" disabled={busy}>
            Join
          </button>
        </form>
      </section>

      {error && (
        <p className="ac-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
