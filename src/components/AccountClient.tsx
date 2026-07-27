'use client'

import { useState } from 'react'

/**
 * Signed-in account controls (issue #49): edit profile, import this device's
 * local history into the account, and sign out. All calls hit Payload's REST /
 * the app's own routes on the same origin and reload to re-render the server view.
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

  // Push completed daily/speed runs saved on this device up to the account, so a
  // player who logged in after playing doesn't lose their history.
  const importLocal = async () => {
    setBusy(true)
    setMsg(null)
    let imported = 0
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        const m = key?.match(/^terratap:(daily|speed):(\d{4}-\d{2}-\d{2})$/)
        if (!key || !m) continue
        const raw = window.localStorage.getItem(key)
        if (!raw) continue
        const saved = JSON.parse(raw) as {
          total?: number
          rounds?: unknown[]
          elapsedMs?: number
        }
        if (typeof saved.total !== 'number') continue
        const res = await fetch('/api/results/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            mode: m[1],
            dateKey: m[2],
            title: m[1] === 'daily' ? 'Daily' : 'Speed Run',
            total: saved.total,
            rounds: saved.rounds,
            elapsedMs: saved.elapsedMs,
          }),
        })
        if (res.ok) imported += 1
      }
      setMsg(imported ? `Imported ${imported} game${imported === 1 ? '' : 's'}.` : 'Nothing to import.')
      if (imported) window.location.reload()
    } catch {
      setMsg('Import failed.')
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
        <button className="ac-btn" onClick={importLocal} disabled={busy}>
          Import this device’s history
        </button>
        <button className="ac-btn ac-btn-ghost" onClick={signOut} disabled={busy}>
          Sign out
        </button>
      </div>
    </section>
  )
}
