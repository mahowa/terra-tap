import React from 'react'

export const metadata = {
  robots: { index: false, follow: false },
}

/**
 * Standalone layout for embeddable widgets (issue #48) — no app chrome, no
 * global styles, transparent background so the iframe blends into the host page.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'transparent' }}>{children}</body>
    </html>
  )
}
