import React from 'react'
import Link from 'next/link'
import './styles.css'
import './home.css'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  return (
    <div className="mc-home">
      <Link className="mc-account-link" href="/account">
        Account
      </Link>
      <div className="mc-hero">
        <h1 className="mc-logo">
          Terra<span>Tap</span>
        </h1>
        <p className="mc-tag">
          Find the world on a 3D globe. Race the clock, then battle head-to-head.
        </p>
        <div className="mc-actions">
          <Link className="mc-cta mc-cta-primary" href="/play">
            Play the Daily
          </Link>
          <Link className="mc-cta" href="/quizzes">
            Pop Quizzes
          </Link>
          <Link className="mc-cta" href="/speed">
            Speed Run
          </Link>
          <Link className="mc-cta" href="/history">
            Geography History
          </Link>
          <Link className="mc-cta" href="/versus">
            Versus
          </Link>
        </div>
        <p className="mc-note">Tap where you think each place is. Closer = more points.</p>
      </div>
      <footer className="mc-footer">
        <a href="https://github.com/mahowa/map_clicky" target="_blank" rel="noopener noreferrer">
          Open source — contribute on GitHub
        </a>
      </footer>
    </div>
  )
}
