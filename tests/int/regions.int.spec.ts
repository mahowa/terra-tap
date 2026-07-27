import { describe, it, expect } from 'vitest'
import { flagToIso, regionForFlag } from '@/lib/regions'

describe('flagToIso (#50)', () => {
  it('decodes a regional-indicator emoji flag', () => {
    expect(flagToIso('🇫🇷')).toBe('FR')
    expect(flagToIso('🇯🇵')).toBe('JP')
    expect(flagToIso('🇺🇸')).toBe('US')
  })
  it('accepts a two-letter code in any case', () => {
    expect(flagToIso('fr')).toBe('FR')
    expect(flagToIso('GB')).toBe('GB')
  })
  it('rejects junk and empty values', () => {
    expect(flagToIso(null)).toBeNull()
    expect(flagToIso('')).toBeNull()
    expect(flagToIso('France')).toBeNull()
    expect(flagToIso('🎉')).toBeNull()
  })
})

describe('regionForFlag (#50)', () => {
  it('maps flags and codes to continents', () => {
    expect(regionForFlag('🇫🇷')).toBe('Europe')
    expect(regionForFlag('NG')).toBe('Africa')
    expect(regionForFlag('🇧🇷')).toBe('South America')
    expect(regionForFlag('JP')).toBe('Asia')
    expect(regionForFlag('AU')).toBe('Oceania')
    expect(regionForFlag('US')).toBe('North America')
  })
  it('is null for unknown or unmappable input', () => {
    expect(regionForFlag(null)).toBeNull()
    expect(regionForFlag('ZZ')).toBeNull()
    expect(regionForFlag('Brazil')).toBeNull()
  })
})
