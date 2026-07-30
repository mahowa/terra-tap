import type { LatLng } from '@/lib/scoring'

/**
 * What the globe camera should do after a round-state change.
 * - 'fit-pair': frame the guess + answer together (reveal).
 * - 'stay': leave the camera exactly where it is. Rounds after the first start
 *   from wherever the player left off — zooming back out to a full-globe view
 *   between rounds was disorienting (issue #7).
 */
export type CameraAction = 'fit-pair' | 'stay'

export function cameraActionFor(
  phase: 'guessing' | 'revealed' | 'done',
  guess: LatLng | null,
  answer: LatLng | null,
): CameraAction {
  if (phase === 'revealed' && guess && answer) return 'fit-pair'
  return 'stay'
}

/**
 * Initial globe zoom sized to the viewport (issue #34). The old fixed zoom
 * (0.9) looked right on phones but left the globe a small sphere in ~30% of a
 * desktop viewport. MapLibre's globe renders with a pixel diameter of roughly
 * tileSize·2^zoom/π, so the zoom that fills `fill` of the short viewport side
 * is log2(minSide·fill·π/tileSize). Clamped to sane globe range.
 */
export function initialGlobeZoom(width: number, height: number, fill = 0.78): number {
  const minSide = Math.min(width, height)
  if (!Number.isFinite(minSide) || minSide <= 0) return 0.9
  const zoom = Math.log2((minSide * fill * Math.PI) / 512)
  return Math.min(2.5, Math.max(0.5, zoom))
}

/** A MapLibre fitBounds box: [[west, south], [east, north]]. */
export type Bounds = [[number, number], [number, number]]

/** Bounds ([sw, ne]) framing both points, for MapLibre fitBounds. */
export function pairBounds(a: LatLng, b: LatLng): Bounds {
  return [
    [Math.min(a.lng, b.lng), Math.min(a.lat, b.lat)],
    [Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)],
  ]
}

/** Degrees of breathing room left around a region's outermost places. */
const REGION_PAD_DEG = 8
/** Web Mercator gives out at the poles; MapLibre clamps around here anyway. */
const MAX_LAT = 84
/**
 * Past this longitude span a "region" is really the whole planet with a gap in
 * it (world capitals leave an empty stretch of Pacific). Framing that box would
 * open the globe rolled onto its seam; the plain world view reads better.
 */
const WORLD_SPAN_DEG = 270

/**
 * The box a themed quiz opens on (issue #61): the smallest one containing
 * every place in its pool, padded a little.
 *
 * Longitudes are treated as points on a circle, not a line — the box spans
 * everything *except* the widest empty gap between neighbors. That's what keeps
 * a Pacific pool (Perth → Suva → Honolulu) framed on the Pacific instead of
 * being stretched across the whole planet by the antimeridian. East may come
 * back greater than 180 to express a box that crosses it; MapLibre reads that
 * as an unwrapped span and frames it correctly.
 */
export function regionBounds(
  points: readonly LatLng[],
  padDeg: number = REGION_PAD_DEG,
): Bounds | null {
  if (points.length === 0) return null

  const lats = points.map((p) => p.lat)
  const south = Math.max(-MAX_LAT, Math.min(...lats) - padDeg)
  const north = Math.min(MAX_LAT, Math.max(...lats) + padDeg)

  const lngs = [...new Set(points.map((p) => p.lng))].sort((a, b) => a - b)
  // Widest gap between neighbors, wrapping the last back around to the first.
  let gapStart = lngs.length - 1
  let widest = lngs[0] + 360 - lngs[lngs.length - 1]
  for (let i = 0; i < lngs.length - 1; i++) {
    const gap = lngs[i + 1] - lngs[i]
    if (gap > widest) {
      widest = gap
      gapStart = i
    }
  }
  // The box runs from the far side of that gap all the way around to its near
  // side; a gap ending at the wrap point leaves an ordinary west→east box.
  const west = lngs[(gapStart + 1) % lngs.length]
  const east = lngs[gapStart] + (gapStart === lngs.length - 1 ? 0 : 360)

  if (east - west + padDeg * 2 >= WORLD_SPAN_DEG) return [[-180, south], [180, north]]
  return [[west - padDeg, south], [east + padDeg, north]]
}
