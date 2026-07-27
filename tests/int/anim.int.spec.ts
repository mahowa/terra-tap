import { describe, it, expect } from 'vitest'
import {
  easeOutCubic,
  greatCirclePath,
  interpolateGreatCircle,
  partialGreatCirclePath,
} from '@/lib/anim'

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

describe('easeOutCubic', () => {
  it('pins the endpoints and clamps out-of-range input', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })
  it('eases out — past the midpoint by t=0.5', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })
})

describe('interpolateGreatCircle', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    const a = { lat: 10, lng: -20 }
    const b = { lat: -30, lng: 40 }
    const p0 = interpolateGreatCircle(a, b, 0)
    const p1 = interpolateGreatCircle(a, b, 1)
    expect(near(p0.lat, a.lat, 1e-6) && near(p0.lng, a.lng, 1e-6)).toBe(true)
    expect(near(p1.lat, b.lat, 1e-6) && near(p1.lng, b.lng, 1e-6)).toBe(true)
  })
  it('midpoint of two equatorial points is the average longitude on the equator', () => {
    const mid = interpolateGreatCircle({ lat: 0, lng: -40 }, { lat: 0, lng: 40 }, 0.5)
    expect(near(mid.lat, 0, 1e-6)).toBe(true)
    expect(near(mid.lng, 0, 1e-6)).toBe(true)
  })
  it('the great-circle midpoint bulges poleward of the flat average', () => {
    // Two points at the same high latitude: the shortest path arcs toward the pole.
    const mid = interpolateGreatCircle({ lat: 60, lng: -60 }, { lat: 60, lng: 60 }, 0.5)
    expect(mid.lat).toBeGreaterThan(60)
  })
  it('handles identical points without NaN', () => {
    const p = interpolateGreatCircle({ lat: 12, lng: 34 }, { lat: 12, lng: 34 }, 0.5)
    expect(Number.isNaN(p.lat) || Number.isNaN(p.lng)).toBe(false)
    expect(near(p.lat, 12) && near(p.lng, 34)).toBe(true)
  })
})

describe('greatCirclePath / partialGreatCirclePath', () => {
  const a = { lat: 48.85, lng: 2.35 } // Paris
  const b = { lat: 35.68, lng: 139.69 } // Tokyo

  it('full path has steps+1 points, endpoints anchored', () => {
    const path = greatCirclePath(a, b, 32)
    expect(path).toHaveLength(33)
    expect(near(path[0][0], a.lng) && near(path[0][1], a.lat)).toBe(true)
    expect(near(path[32][0], b.lng) && near(path[32][1], b.lat)).toBe(true)
  })

  it('grows monotonically: more points as t increases', () => {
    const q = partialGreatCirclePath(a, b, 0.25, 64).length
    const h = partialGreatCirclePath(a, b, 0.5, 64).length
    const full = partialGreatCirclePath(a, b, 1, 64).length
    expect(q).toBeLessThan(h)
    expect(h).toBeLessThan(full)
  })

  it('is empty at t=0 and its tip sits at the interpolated fraction', () => {
    expect(partialGreatCirclePath(a, b, 0)).toEqual([])
    const t = 0.4
    const part = partialGreatCirclePath(a, b, t, 64)
    const tip = interpolateGreatCircle(a, b, t)
    const last = part[part.length - 1]
    expect(near(last[0], tip.lng, 1e-9) && near(last[1], tip.lat, 1e-9)).toBe(true)
  })
})
