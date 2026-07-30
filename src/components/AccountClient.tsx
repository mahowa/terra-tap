'use client'

import { useState } from 'react'

/**
 * Signed-in account controls (issue #49): edit profile and sign out. Calls hit
 * Payload's REST endpoints on the same origin and reload to re-render the
 * server view. Completed runs reach the account from the game itself, so
 * there's no manual import of this device's local history.
 */
export default function AccountClient({
  displayName: initialName,
  countryFlag: initialFlag,
  userId,
}: {
  displayName: string
  countryFlag: string
  userId: number | string
}) {
  const [displayName, setDisplayName] = useState(initialName)
  const [countryFlag, setCountryFlag] = useState(initialFlag)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ displayName, countryFlag }),
      })
      if (!res.ok) throw new Error('Could not save.')
      setMsg('Saved.')
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'same-origin' }).catch(
      () => {},
    )
    window.location.reload()
  }

  return (
    <section className="ac-manage" aria-label="Account settings">
      <h2>Profile</h2>
      <form className="ac-form" onSubmit={saveProfile}>
        <label>
          Display name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
          />
        </label>
        <label>
          Flag (emoji or ISO code)
          <input
            type="text"
            value={countryFlag}
            onChange={(e) => setCountryFlag(e.target.value)}
            maxLength={8}
          />
        </label>
        {msg && <p className="ac-msg">{msg}</p>}
        <button type="submit" className="ac-btn ac-btn-primary" disabled={busy}>
          Save profile
        </button>
      </form>

      <div className="ac-actions">
        <button className="ac-btn ac-btn-ghost" onClick={signOut} disabled={busy}>
          Sign out
        </button>
      </div>
    </section>
  )
}
