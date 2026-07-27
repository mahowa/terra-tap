import { describe, it, expect } from 'vitest'
import {
  DEFAULT_HISTORY_DIFFICULTY,
  DIFFICULTY_META,
  HISTORY_DIFFICULTIES,
  isHistoryDifficulty,
  mapDetailFor,
  toHistoryDifficulty,
} from '@/lib/difficulty'

describe('history difficulty (#47)', () => {
  it('maps each difficulty to the right map detail', () => {
    expect(mapDetailFor('easy')).toBe('labeled')
    expect(mapDetailFor('medium')).toBe('borders')
    expect(mapDetailFor('hard')).toBe('plain')
  })

  it('defaults to easy (borders + names)', () => {
    expect(DEFAULT_HISTORY_DIFFICULTY).toBe('easy')
    expect(mapDetailFor(DEFAULT_HISTORY_DIFFICULTY)).toBe('labeled')
  })

  it('recognises valid difficulties and rejects junk', () => {
    expect(isHistoryDifficulty('medium')).toBe(true)
    expect(isHistoryDifficulty('extreme')).toBe(false)
    expect(isHistoryDifficulty(undefined)).toBe(false)
    expect(isHistoryDifficulty(3)).toBe(false)
  })

  it('coerces arbitrary input to a valid difficulty', () => {
    expect(toHistoryDifficulty('hard')).toBe('hard')
    expect(toHistoryDifficulty('nonsense')).toBe(DEFAULT_HISTORY_DIFFICULTY)
    expect(toHistoryDifficulty(undefined)).toBe(DEFAULT_HISTORY_DIFFICULTY)
  })

  it('has label + hint metadata for every difficulty', () => {
    for (const d of HISTORY_DIFFICULTIES) {
      expect(DIFFICULTY_META[d].label).toBeTruthy()
      expect(DIFFICULTY_META[d].hint).toBeTruthy()
    }
  })
})
