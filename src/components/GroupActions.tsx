'use client'

import Link from 'next/link'
import { useState } from 'react'

/**
 * Group membership + owner controls (issue #51): join / leave, copy the invite
 * link, rotate the code, delete. All hit the /api/groups action route and reload.
 */
export default function GroupActions({
  groupId,
  slug,
  isOwner,
  isMember,
  joinCode,
  signedIn,
  inviteCode,
}: {
  groupId: number | string
  slug: string
  isOwner: boolean
  isMember: boolean
  /** Valid invite code from the link when the viewer can join, else null. */
  joinCode: string | null
  signedIn: boolean
  inviteCode: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const act = async (body: Record<string, unknown>, after?: () => void) => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Something went wrong.')
      if (after) after()
      else window.location.reload()
    } catch (err) {
      setMsg((err as Error).message)
      setBusy(false)
    }
  }

  const copyInvite = async () => {
    if (!inviteCode) return
    const url = `${window.location.origin}/groups/${slug}?code=${inviteCode}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMsg(url)
    }
  }

  return (
    <div className="gr-actions">
      {!signedIn && (
        <Link className="ac-btn ac-btn-primary" href="/account">
          Sign in to join
        </Link>
      )}
      {joinCode && (
        <button
          className="ac-btn ac-btn-primary"
          disabled={busy}
          onClick={() => act({ action: 'join', code: joinCode })}
        >
          Join group
        </button>
      )}
      {isMember && !isOwner && (
        <button
          className="ac-btn ac-btn-ghost"
          disabled={busy}
          onClick={() => act({ action: 'leave', groupId })}
        >
          Leave group
        </button>
      )}
      {isOwner && (
        <>
          <button className="ac-btn" disabled={busy} onClick={copyInvite}>
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
          <button
            className="ac-btn"
            disabled={busy}
            onClick={() => act({ action: 'rotate', groupId })}
          >
            Reset invite code
          </button>
          <button
            className="ac-btn ac-btn-ghost"
            disabled={busy}
            onClick={() => {
              if (confirm('Delete this group for everyone?')) act({ action: 'delete', groupId }, () => (window.location.href = '/groups'))
            }}
          >
            Delete
          </button>
        </>
      )}
      {msg && <p className="ac-msg">{msg}</p>}
    </div>
  )
}
