import { describe, it, expect } from 'vitest'
import { bestPerSlot, runSlot, totalPoints } from '@/lib/runs'

/**
 * Issue #69: the all-time board added up every stored row, so a player whose
 * daily was saved twice scored double for one day's play.
 */

const run = (
  mode: string,
  dateKey: string | null,
  total: number,
  createdAt = '2026-07-01T00:00:00.000Z',
) => ({ mode, dateKey, total, createdAt })

describe('runSlot', () => {
  it('gives a dated run one slot per mode per day', () => {
    expect(runSlot(run('daily', '2026-07-30', 300), 0)).toBe('daily:2026-07-30')
    expect(runSlot(run('daily', '2026-07-30', 250), 7)).toBe('daily:2026-07-30')
  })

  it('keeps the modes apart on the same day', () => {
    expect(runSlot(run('daily', '2026-07-30', 300), 0)).not.toBe(
      runSlot(run('speed', '2026-07-30', 300), 1),
    )
  })

  it('gives every undated run its own slot', () => {
    expect(runSlot(run('quiz', '', 200), 0)).not.toBe(runSlot(run('quiz', '', 200), 1))
    expect(runSlot(run('versus', null, 200), 0)).not.toBe(runSlot(run('versus', null, 200), 1))
    // Whitespace is not a date.
    expect(runSlot(run('daily', '   ', 200), 3)).toBe('#3')
  })
})

describe('bestPerSlot', () => {
  it('collapses a day saved twice down to its best attempt', () => {
    const counted = bestPerSlot([
      run('daily', '2026-07-30', 240),
      run('daily', '2026-07-30', 310),
      run('daily', '2026-07-30', 180),
    ])
    expect(counted.map((r) => r.total)).toEqual([310])
  })

  it('keeps genuinely different days and modes', () => {
    const counted = bestPerSlot([
      run('daily', '2026-07-29', 200),
      run('daily', '2026-07-30', 210),
      run('speed', '2026-07-30', 220),
    ])
    expect(counted.length).toBe(3)
  })

  it('counts every quiz and versus run', () => {
    const counted = bestPerSlot([run('quiz', '', 100), run('quiz', '', 100), run('versus', '', 90)])
    expect(counted.length).toBe(3)
  })

  it('breaks score ties toward the earlier attempt', () => {
    const counted = bestPerSlot([
      run('daily', '2026-07-30', 300, '2026-07-30T18:00:00.000Z'),
      run('daily', '2026-07-30', 300, '2026-07-30T06:00:00.000Z'),
    ])
    expect(counted[0].createdAt).toBe('2026-07-30T06:00:00.000Z')
  })

  it('holds its ground with no timestamps at all', () => {
    const counted = bestPerSlot([
      { mode: 'daily', dateKey: '2026-07-30', total: 100 },
      { mode: 'daily', dateKey: '2026-07-30', total: 400 },
    ])
    expect(counted.map((r) => r.total)).toEqual([400])
  })
})

describe('totalPoints', () => {
  it('is the sum of each slot’s best', () => {
    expect(
      totalPoints([
        run('daily', '2026-07-29', 300),
        run('daily', '2026-07-30', 200),
        run('daily', '2026-07-30', 250), // same day again
        run('quiz', '', 90),
      ]),
    ).toBe(300 + 250 + 90)
  })

  it('ignores rows with a broken total', () => {
    expect(totalPoints([{ mode: 'quiz', dateKey: '', total: Number.NaN }])).toBe(0)
  })

  it('is zero for a player with nothing', () => {
    expect(totalPoints([])).toBe(0)
  })
})
