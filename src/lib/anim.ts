import type { LatLng } from './scoring'

/**
 * Reveal animations (issue #46). Pure geometry/easing helpers so the motion is
 * unit-testable; the requestAnimationFrame loop that drives them lives in the
 * component. The guess→answer line grows along the great circle (the shortest
 * path on the globe), not a flat straight segment.
 */

/** How long the guess→answer line takes to draw, in ms. */
export const LINE_ANIM_MS = 700

/** How long the results total counts up, in ms. */
export const COUNTUP_MS = 800

const toRad = (deg: number): number => (deg * Math.PI) / 180
const toDeg = (rad: number): number => (rad * 180) / Math.PI

/** Ease-out cubic, clamped to [0, 1]. */
export function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return 1 - Math.pow(1 - c, 3)
}

/**
 * Slerp between two lat/lng points along their great circle. t=0 → a, t=1 → b.
 * Falls back to a when the points coincide (undefined direction).
 */
export function interpolateGreatCircle(a: LatLng, b: LatLng, t: number): LatLng {
  const phi1 = toRad(a.lat)
  const lam1 = toRad(a.lng)
  const phi2 = toRad(b.lat)
  const lam2 = toRad(b.lng)

  // Unit vectors on the sphere.
  const x1 = Math.cos(phi1) * Math.cos(lam1)
  const y1 = Math.cos(phi1) * Math.sin(lam1)
  const z1 = Math.sin(phi1)
  const x2 = Math.cos(phi2) * Math.cos(lam2)
  const y2 = Math.cos(phi2) * Math.sin(lam2)
  const z2 = Math.sin(phi2)

  const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2))
  const omega = Math.acos(dot)
  if (omega < 1e-9) return { lat: a.lat, lng: a.lng }

  const sinOmega = Math.sin(omega)
  const k1 = Math.sin((1 - t) * omega) / sinOmega
  const k2 = Math.sin(t * omega) / sinOmega
  const x = k1 * x1 + k2 * x2
  const y = k1 * y1 + k2 * y2
  const z = k1 * z1 + k2 * z2

  return {
    lat: toDeg(Math.atan2(z, Math.hypot(x, y))),
    lng: toDeg(Math.atan2(y, x)),
  }
}

/** Full great-circle polyline a→b as [lng, lat] pairs (steps + 1 points). */
export function greatCirclePath(a: LatLng, b: LatLng, steps = 64): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const p = interpolateGreatCircle(a, b, i / steps)
    pts.push([p.lng, p.lat])
  }
  return pts
}

/**
 * The leading portion of the great-circle path drawn "so far" for fraction
 * t ∈ [0, 1] — used to grow the reveal line frame by frame. Always returns at
 * least two points once t > 0 so it renders as a line; [] at t = 0.
 */
export function partialGreatCirclePath(
  a: LatLng,
  b: LatLng,
  t: number,
  steps = 64,
): [number, number][] {
  const clamped = Math.max(0, Math.min(1, t))
  if (clamped <= 0) return []
  const full = greatCirclePath(a, b, steps)
  const count = Math.max(1, Math.ceil(clamped * steps))
  const head = full.slice(0, count + 1)
  // Pin the tip exactly at the interpolated fraction for smooth growth.
  const tip = interpolateGreatCircle(a, b, clamped)
  head[head.length - 1] = [tip.lng, tip.lat]
  return head
}
