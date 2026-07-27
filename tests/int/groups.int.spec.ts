import { describe, it, expect } from 'vitest'
import {
  CODE_ALPHABET,
  generateCode,
  isValidCode,
  memberIds,
  normalizeCode,
  slugify,
} from '@/lib/groups'
import { seededRng } from '@/lib/rng'

describe('slugify (#51)', () => {
  it('lowercases and dashes a name', () => {
    expect(slugify('The Howa Family')).toBe('the-howa-family')
    expect(slugify('  Trivia Night!!  ')).toBe('trivia-night')
  })
  it('collapses punctuation and never returns empty', () => {
    expect(slugify('!!!')).toBe('group')
    expect(slugify('')).toBe('group')
    expect(slugify('A—B')).toBe('a-b')
  })
  it('caps length', () => {
    expect(slugify('x'.repeat(80)).length).toBeLessThanOrEqual(40)
  })
})

describe('invite codes (#51)', () => {
  it('generates codes from the safe alphabet', () => {
    const code = generateCode(seededRng('seed'), 6)
    expect(code).toHaveLength(6)
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch)
    // No ambiguous characters.
    expect(/[01OIL]/.test(code)).toBe(false)
  })
  it('is deterministic per seed', () => {
    expect(generateCode(seededRng('s'))).toBe(generateCode(seededRng('s')))
  })
  it('validates and normalizes', () => {
    expect(isValidCode('k7p2qr')).toBe(true)
    expect(normalizeCode(' k7p2qr ')).toBe('K7P2QR')
    expect(isValidCode('ab')).toBe(false) // too short
    expect(isValidCode('has spaces')).toBe(false)
    expect(isValidCode('LOL01')).toBe(false) // ambiguous chars excluded
  })
})

describe('memberIds (#51)', () => {
  it('includes the owner and dedupes', () => {
    expect(memberIds(1, [2, 3])).toEqual(['1', '2', '3'])
    expect(memberIds(1, [1, 2, 2])).toEqual(['1', '2'])
  })
})
