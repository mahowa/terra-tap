import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatDailyShare,
  formatRunShare,
  formatShareDate,
  playUrlFromLocation,
  scoreEmoji,
  sharePlan,
  shareHeading,
  shareUrlFromLocation,
  PLAY_URL,
} from '@/lib/share'

describe('formatShareDate', () => {
  it('formats an ISO day as "Month D"', () => {
    expect(formatShareDate('2026-06-23')).toBe('June 23')
    expect(formatShareDate('2026-01-01')).toBe('January 1')
    expect(formatShareDate('2026-12-09')).toBe('December 9')
  })
})

describe('scoreEmoji', () => {
  it('gives a bullseye only for near-perfect scores', () => {
    expect(scoreEmoji(100)).toBe('🎯')
    expect(scoreEmoji(95)).toBe('🎯')
  })
  it('never gives a bullseye to a bad score', () => {
    expect(scoreEmoji(1)).toBe('📍')
    expect(scoreEmoji(0)).toBe('📍')
    expect(scoreEmoji(49)).toBe('📍')
  })
  it('steps down with score', () => {
    expect(scoreEmoji(90)).toBe('🏅')
    expect(scoreEmoji(75)).toBe('🏆')
    expect(scoreEmoji(60)).toBe('🎓')
  })
})

describe('formatDailyShare', () => {
  it('badges each round by its score, best to worst', () => {
    const text = formatDailyShare('2026-06-23', [100, 88, 72, 55, 1], 316)
    expect(text).toBe(
      'Terra Tap — June 23\n100🎯 88🏅 72🏆 55🎓 1📍\nFinal score: 316\nhttps://map-clicky.vercel.app/play',
    )
  })

  it('uses the caller-provided play URL when given', () => {
    const text = formatDailyShare('2026-06-23', [100], 100, 'https://terratap.example/play')
    expect(text.endsWith('\nhttps://terratap.example/play')).toBe(true)
  })
})

describe('shareHeading (#31)', () => {
  it('dates the daily, the speed run and history', () => {
    expect(shareHeading('daily', 'Daily — x', '2026-07-22')).toBe('Terra Tap — July 22')
    expect(shareHeading('speed', 'Speed Run', '2026-07-22')).toBe(
      'Terra Tap Speed Run — July 22',
    )
    expect(shareHeading('history', 'Geography History', '2026-07-22')).toBe(
      'Terra Tap History — July 22',
    )
  })

  it('titles undated speed practice runs instead of dating them (#33)', () => {
    expect(shareHeading('speed', 'Speed Run Practice', '')).toBe(
      'Terra Tap — Speed Run Practice',
    )
  })

  it('titles quizzes, and any undated run', () => {
    expect(shareHeading('quiz', 'US State Capitals', '')).toBe('Terra Tap — US State Capitals')
    expect(shareHeading('history', 'Geography History', '')).toBe(
      'Terra Tap — Geography History',
    )
  })
})

describe('formatRunShare (#31)', () => {
  it('matches the daily format when no time is given', () => {
    expect(
      formatRunShare('Terra Tap — June 23', [100, 88, 72, 55, 1], 316, PLAY_URL),
    ).toBe(formatDailyShare('2026-06-23', [100, 88, 72, 55, 1], 316))
  })

  it('includes the run time for speed runs', () => {
    const text = formatRunShare('Terra Tap Speed Run — July 22', [50], 50, 'u', '0:22.1')
    expect(text).toContain('Final score: 50\nTime: 0:22.1\nu')
  })

  it('omits the time line when null', () => {
    expect(formatRunShare('H', [50], 50, 'u', null)).not.toContain('Time:')
  })
})

describe('sharePlan (#31)', () => {
  it('uses the native sheet only on touch devices that have the API', () => {
    expect(sharePlan(true, true)).toBe('native')
  })
  it('uses the clipboard on desktop even when the API exists', () => {
    expect(sharePlan(true, false)).toBe('clipboard')
  })
  it('uses the clipboard when the API is missing', () => {
    expect(sharePlan(false, true)).toBe('clipboard')
    expect(sharePlan(false, false)).toBe('clipboard')
  })
})

describe('shareUrlFromLocation (#31)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('links to the page being played', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://terratap.example', pathname: '/quiz/us-state-capitals' },
    })
    expect(shareUrlFromLocation()).toBe('https://terratap.example/quiz/us-state-capitals')
  })

  it('falls back to the play URL without a DOM', () => {
    vi.stubGlobal('window', undefined)
    expect(shareUrlFromLocation()).toBe(PLAY_URL)
  })
})

describe('playUrlFromLocation', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("builds the play URL from the browser's own origin", () => {
    vi.stubGlobal('window', { location: { origin: 'https://terratap.example' } })
    expect(playUrlFromLocation()).toBe('https://terratap.example/play')
  })

  it('falls back to the canonical URL without a DOM', () => {
    vi.stubGlobal('window', undefined)
    expect(playUrlFromLocation()).toBe(PLAY_URL)
  })
})
