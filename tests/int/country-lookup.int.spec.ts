import { describe, it, expect } from 'vitest'
import {
  pointInRing,
  pointInPolygon,
  countryAt,
  countryFeatureAt,
  describeMiss,
  bordersGeoJSON,
  loadBordersGeoJSON,
  type CountryCollection,
} from '@/lib/country-lookup'

// Unit square ring ([lng, lat] positions, closed)
const SQUARE: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
]
const HOLE: [number, number][] = [
  [4, 4],
  [6, 4],
  [6, 6],
  [4, 6],
  [4, 4],
]

describe('pointInRing', () => {
  it('detects a point inside', () => {
    expect(pointInRing({ lat: 5, lng: 5 }, SQUARE)).toBe(true)
  })
  it('detects a point outside', () => {
    expect(pointInRing({ lat: 15, lng: 5 }, SQUARE)).toBe(false)
    expect(pointInRing({ lat: 5, lng: -3 }, SQUARE)).toBe(false)
  })
})

describe('pointInPolygon', () => {
  it('excludes points inside holes', () => {
    expect(pointInPolygon({ lat: 5, lng: 5 }, [SQUARE, HOLE])).toBe(false)
  })
  it('includes points between the outer ring and the hole', () => {
    expect(pointInPolygon({ lat: 2, lng: 2 }, [SQUARE, HOLE])).toBe(true)
  })
  it('is false for an empty polygon', () => {
    expect(pointInPolygon({ lat: 5, lng: 5 }, [])).toBe(false)
  })
})

describe('countryAt (real dataset)', () => {
  it('finds France for Paris', async () => {
    expect(await countryAt({ lat: 48.8566, lng: 2.3522 })).toBe('France')
  })
  it('finds the United States for Kansas', async () => {
    expect(await countryAt({ lat: 38.5, lng: -98.0 })).toBe('United States')
  })
  it('finds Brazil for Manaus', async () => {
    expect(await countryAt({ lat: -3.1, lng: -60.0 })).toBe('Brazil')
  })
  it('finds Australia for Alice Springs', async () => {
    expect(await countryAt({ lat: -23.7, lng: 133.87 })).toBe('Australia')
  })
  it('handles a MultiPolygon country (Japan, Honshu)', async () => {
    expect(await countryAt({ lat: 36.2, lng: 138.25 })).toBe('Japan')
  })
  it('returns null in the middle of the Pacific', async () => {
    expect(await countryAt({ lat: -10, lng: -140 })).toBeNull()
  })
})

describe('countryFeatureAt', () => {
  it('returns the full feature with drawable geometry for the reveal overlay', async () => {
    const f = await countryFeatureAt({ lat: 48.8566, lng: 2.3522 })
    expect(f?.properties.name).toBe('France')
    expect(['Polygon', 'MultiPolygon']).toContain(f?.geometry.type)
    expect(f && f.geometry.coordinates.length).toBeGreaterThan(0)
  })

  it('returns null for open ocean (no region to draw)', async () => {
    expect(await countryFeatureAt({ lat: -10, lng: -140 })).toBeNull()
  })

  it('agrees with countryAt on the containing country', async () => {
    const p = { lat: 35.68, lng: 139.69 } // Tokyo
    const f = await countryFeatureAt(p)
    expect(f?.properties.name).toBe(await countryAt(p))
  })
})

describe('bordersGeoJSON (#47 Medium map)', () => {
  const sample: CountryCollection = {
    features: [
      { properties: { name: 'A' }, geometry: { type: 'Polygon', coordinates: [SQUARE] } },
      {
        properties: { name: 'B' },
        geometry: { type: 'MultiPolygon', coordinates: [[SQUARE], [HOLE]] },
      },
    ],
  }

  it('produces a FeatureCollection with one feature per country', () => {
    const fc = bordersGeoJSON(sample)
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(2)
  })

  it('keeps geometry but drops names (borders only, no labels)', () => {
    const fc = bordersGeoJSON(sample)
    expect(fc.features[0].geometry).toEqual(sample.features[0].geometry)
    expect(fc.features[0].properties).toEqual({})
    expect(fc.features[1].geometry.type).toBe('MultiPolygon')
  })

  it('loads the real dataset into drawable borders', async () => {
    const fc = await loadBordersGeoJSON()
    expect(fc.features.length).toBeGreaterThan(100)
    for (const f of fc.features.slice(0, 5)) {
      expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type)
    }
  })
})

describe('describeMiss', () => {
  it('says nothing for a perfect hit', () => {
    expect(describeMiss('France', 'France', 100)).toBeNull()
  })
  it('congratulates the right country on a near miss', () => {
    expect(describeMiss('France', 'France', 70)).toBe('Right country — wrong spot.')
  })
  it('names the country the guess landed in', () => {
    expect(describeMiss('Germany', 'France', 40)).toBe('Your guess landed in Germany.')
  })
  it('handles ocean clicks', () => {
    expect(describeMiss(null, 'France', 0)).toBe('Your guess landed in open water.')
  })
  it('names the guess country even when the answer is uncovered water', () => {
    expect(describeMiss('Fiji', null, 20)).toBe('Your guess landed in Fiji.')
  })
})
