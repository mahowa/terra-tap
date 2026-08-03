import React from 'react'
import './styles.css'
import ProfileCorner from '@/components/ProfileCorner'
import { buildSiteMetadata, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo'

export const metadata = buildSiteMetadata()

// Structured data so search engines understand this is a playable game.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: 'GameApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Who you're signed in as, in the same corner on every page (#67). */}
        <ProfileCorner />
        <main>{children}</main>
      </body>
    </html>
  )
}
