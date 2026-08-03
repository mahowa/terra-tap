import { describe, it, expect, afterEach } from 'vitest'
import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, cleanup } from '@testing-library/react'
import { initialsFor, profileLabel } from '@/lib/profile'
import ProfileBadge from '@/components/ProfileBadge'

afterEach(cleanup)

/**
 * Issue #67: signed in, nothing on screen said so. The corner badge shows the
 * player's initials on every page.
 */
describe('initialsFor (#67)', () => {
  it('takes the first and last word of a name', () => {
    expect(initialsFor('Matt Howa')).toBe('MH')
    expect(initialsFor('Matt J Howa')).toBe('MH')
  })

  it('gives a one-word name a single initial', () => {
    expect(initialsFor('howa')).toBe('H')
  })

  it('ignores the separators people put in names', () => {
    expect(initialsFor('matt.howa')).toBe('MH')
    expect(initialsFor('matt_howa')).toBe('MH')
    expect(initialsFor('matt-howa')).toBe('MH')
    expect(initialsFor('   Matt   Howa  ')).toBe('MH')
  })

  it('skips punctuation and emoji rather than showing them', () => {
    expect(initialsFor('🌍 matt howa')).toBe('MH')
    expect(initialsFor('!!!')).toBe('?')
  })

  it('handles names that are not Latin', () => {
    // First character of the first and last part — 松本 行弘 → 松行.
    expect(initialsFor('松本 行弘')).toBe('松行')
    expect(initialsFor('Ана Петровић')).toBe('АП')
  })

  it('falls back to the email when there is no display name', () => {
    expect(initialsFor('', 'matt.howa@example.com')).toBe('MH')
    expect(initialsFor(null, 'howa@example.com')).toBe('H')
    expect(initialsFor(undefined, 'HOWA@example.com')).toBe('H')
  })

  it('always yields something to draw', () => {
    expect(initialsFor(null, null)).toBe('?')
    expect(initialsFor('', '')).toBe('?')
    expect(initialsFor('  ', '@example.com')).toBe('?')
  })

  it('never returns more than two characters', () => {
    for (const name of ['Matt Howa', 'A B C D E', 'x', '松本 行弘']) {
      expect([...initialsFor(name)].length, name).toBeLessThanOrEqual(2)
    }
  })
})

describe('profileLabel', () => {
  it('names the account for screen readers', () => {
    expect(profileLabel('Matt Howa', 'm@example.com')).toBe('Your account — Matt Howa')
    expect(profileLabel(null, 'm@example.com')).toBe('Your account — m@example.com')
    expect(profileLabel(null, null)).toBe('Your account')
  })
})

describe('ProfileBadge (#67)', () => {
  it('shows initials linking to the account when signed in', () => {
    render(React.createElement(ProfileBadge, { displayName: 'Matt Howa', email: 'm@example.com' }))
    const link = screen.getByRole('link', { name: /your account — matt howa/i })
    expect(link.getAttribute('href')).toBe('/account')
    expect(link.textContent).toBe('MH')
  })

  it('shows a sign-in pill when signed out', () => {
    render(React.createElement(ProfileBadge, {}))
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link.getAttribute('href')).toBe('/account')
    expect(screen.queryByText('?')).toBeNull()
  })

  it('falls back to the email for an account with no name yet', () => {
    render(React.createElement(ProfileBadge, { email: 'howa@example.com' }))
    expect(screen.getByRole('link').textContent).toBe('H')
  })

  it('carries the profile flag alongside the initials', () => {
    render(React.createElement(ProfileBadge, { displayName: 'Matt Howa', flag: '🇺🇸' }))
    expect(screen.getByRole('link').textContent).toContain('🇺🇸')
  })

  it('keeps the initials out of the accessible name (the label carries it)', () => {
    render(React.createElement(ProfileBadge, { displayName: 'Matt Howa' }))
    // aria-hidden on the glyphs, so screen readers read the label, not "MH".
    expect(screen.getByRole('link', { name: 'Your account — Matt Howa' })).toBeTruthy()
  })
})

describe('corner clearance (#67)', () => {
  // The badge is fixed to the same corner the home links and the in-game
  // round/score line already use, so both have to reserve room for it — and the
  // signed-out pill is wider than the initials circle, which is how they
  // collided the first time.
  const css = readFileSync(join(process.cwd(), 'src/app/(frontend)/styles.css'), 'utf8')

  it('reserves corner space for the signed-in badge', () => {
    expect(css).toMatch(/body:has\(\.tt-profile\) \.gg-top/)
    expect(css).toMatch(/body:has\(\.tt-profile\) \.mc-corner-links/)
  })

  it('reserves wider corner space for the signed-out pill', () => {
    expect(css).toMatch(/body:has\(\.tt-profile-out\) \.gg-top/)
    expect(css).toMatch(/body:has\(\.tt-profile-out\) \.mc-corner-links/)
  })
})
