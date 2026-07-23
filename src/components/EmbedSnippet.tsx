'use client'

import { useEffect, useState } from 'react'

/**
 * Copy-paste embed snippet for a group's Teams Widget (issue #48). Shown to the
 * owner on the group page. The token (for private groups) is computed
 * server-side and passed in; this only assembles the iframe and copies it.
 */
export default function EmbedSnippet({
  slug,
  isPrivate,
  token,
}: {
  slug: string
  isPrivate: boolean
  token: string
}) {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Absolute origin is only known in the browser (needed for the iframe src).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin)
  }, [])

  const url = `${origin}/embed/group/${slug}${isPrivate ? `?t=${token}` : ''}`
  const snippet = `<iframe src="${url}" width="340" height="460" style="border:0;border-radius:12px" loading="lazy" title="Terra Tap group standings"></iframe>`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the textarea below is selectable as a fallback */
    }
  }

  return (
    <section className="gr-embed" aria-label="Embed widget">
      <h2>Embed the standings</h2>
      <p className="gr-embed-hint">
        Drop this on any site (blog, Notion, wiki) to show a live board.
        {isPrivate && ' The link includes a private access token — reset the invite code to revoke it.'}
      </p>
      <textarea className="gr-embed-code" readOnly rows={3} value={snippet} onFocus={(e) => e.target.select()} />
      <button className="ac-btn" onClick={copy}>
        {copied ? 'Copied!' : 'Copy embed code'}
      </button>
    </section>
  )
}
