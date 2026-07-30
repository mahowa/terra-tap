import { describe, it, expect } from 'vitest'
import { cameraActionFor, initialGlobeZoom, pairBounds, regionBounds } from '@/lib/camera'

const PARIS = { lat: 48.8566, lng: 2.3522 }
const LONDON = { lat: 51.5074, lng: -0.1278 }

describe('cameraActionFor', () => {
  it('frames the guess/answer pair on reveal', () => {
    expect(cameraActionFor('revealed', PARIS, LONDON)).toBe('fit-pair')
  })

  it('stays put at the start of a new round (no zoom-out reset, issue #7)', () => {
    expect(cameraActionFor('guessing', null, LONDON)).toBe('stay')
  })

  it('stays put while the player is placing/adjusting a guess', () => {
    expect(cameraActionFor('guessing', PARIS, LONDON)).toBe('stay')
  })

  it('stays put on reveal if either point is missing', () => {
    expect(cameraActionFor('revealed', null, LONDON)).toBe('stay')
    expect(cameraActionFor('revealed', PARIS, null)).toBe('stay')
  })

  it('stays put on the results screen', () => {
    expect(cameraActionFor('done', PARIS, LONDON)).toBe('stay')
  })
})

describe('pairBounds', () => {
  it('returns [sw, ne] covering both points', () => {
    const [sw, ne] = pairBounds(PARIS, LONDON)
    expect(sw).toEqual([-0.1278, 48.8566])
    expect(ne).toEqual([2.3522, 51.5074])
  })

  it('is order-independent', () => {
    expect(pairBounds(PARIS, LONDON)).toEqual(pairBounds(LONDON, PARIS))
  })
})

describe('regionBounds (#61)', () => {
  const CAIRO = { lat: 30.04, lng: 31.24 }
  const LAGOS = { lat: 6.52, lng: 3.38 }
  const JOHANNESBURG = { lat: -26.2, lng: 28.05 }

  it('returns null for an empty pool', () => {
    expect(regionBounds([])).toBeNull()
  })

  it('boxes the pool with padding on every side', () => {
    const [[west, south], [east, north]] = regionBounds([CAIRO, LAGOS, JOHANNESBURG], 5)!
    expect(west).toBeCloseTo(3.38 - 5, 5)
    expect(east).toBeCloseTo(31.24 + 5, 5)
    expect(south).toBeCloseTo(-26.2 - 5, 5)
    expect(north).toBeCloseTo(30.04 + 5, 5)
  })

  it('frames a single place as a small box around it', () => {
    const [[west, south], [east, north]] = regionBounds([CAIRO], 4)!
    expect(east - west).toBeCloseTo(8, 5)
    expect(north - south).toBeCloseTo(8, 5)
  })

  it('crosses the antimeridian instead of wrapping the long way (Pacific pool)', () => {
    const perth = { lat: -31.95, lng: 115.86 }
    const suva = { lat: -18.14, lng: 178.44 }
    const honolulu = { lat: 21.31, lng: -157.86 }
    const [[west, south], [east, north]] = regionBounds([perth, suva, honolulu], 5)!
    expect(west).toBeCloseTo(115.86 - 5, 5)
    // Honolulu, unwrapped past 180 — a naive min/max would have spanned 273°.
    expect(east).toBeCloseTo(-157.86 + 360 + 5, 5)
    expect(east - west).toBeLessThan(120)
    expect(south).toBeLessThan(-31)
    expect(north).toBeGreaterThan(21)
  })

  it('collapses a globe-spanning pool to the whole world', () => {
    const everywhere = [-170, -90, -10, 10, 90, 170].map((lng) => ({ lat: 0, lng }))
    expect(regionBounds(everywhere)).toEqual([
      [-180, -8],
      [180, 8],
    ])
  })

  it('keeps latitudes inside the projection', () => {
    const [[, south], [, north]] = regionBounds([
      { lat: 78, lng: 15 },
      { lat: -78, lng: 20 },
    ])!
    expect(south).toBeGreaterThanOrEqual(-84)
    expect(north).toBeLessThanOrEqual(84)
  })

  it('is order-independent', () => {
    expect(regionBounds([CAIRO, LAGOS, JOHANNESBURG])).toEqual(
      regionBounds([JOHANNESBURG, CAIRO, LAGOS]),
    )
  })
})

describe('initialGlobeZoom (#34)', () => {
  it('zooms a desktop viewport well past the old fixed 0.9', () => {
    const z = initialGlobeZoom(1516, 936)
    expect(z).toBeGreaterThan(1.8)
    expect(z).toBeLessThanOrEqual(2.5)
  })

  it('keeps phones near the old framing that already looked right', () => {
    const z = initialGlobeZoom(390, 844)
    expect(z).toBeGreaterThan(0.7)
    expect(z).toBeLessThan(1.1)
  })

  it('scales with the SHORT side (landscape phone ≈ portrait phone)', () => {
    expect(initialGlobeZoom(844, 390)).toBeCloseTo(initialGlobeZoom(390, 844), 5)
  })

  it('monotonically increases with viewport size', () => {
    expect(initialGlobeZoom(800, 800)).toBeGreaterThan(initialGlobeZoom(400, 400))
  })

  it('clamps to the sane globe range', () => {
    expect(initialGlobeZoom(50, 50)).toBe(0.5)
    expect(initialGlobeZoom(10000, 10000)).toBe(2.5)
  })

  it('falls back to the classic zoom for degenerate dimensions', () => {
    expect(initialGlobeZoom(0, 0)).toBe(0.9)
    expect(initialGlobeZoom(NaN, 500)).toBe(0.9)
    expect(initialGlobeZoom(-10, 500)).toBe(0.9)
  })
})
