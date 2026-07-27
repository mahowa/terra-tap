import type { LatLng } from './scoring'

/**
 * Offline reverse-geocode: which country does a lat/lng fall in?
 * Backed by a pruned Natural Earth 110m admin-0 GeoJSON (name + geometry only)
 * so lookups work client-side with no network calls. 110m resolution is coarse
 * but plenty for "your guess landed in France" feedback (issue #2).
 */

type Position = [number, number]
type Ring = Position[]
export type CountryGeometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] }
export type CountryFeature = {
  properties: { name: string }
  geometry: CountryGeometry
}
export type CountryCollection = { features: CountryFeature[] }

/** Ray-cast a point against a single linear ring ([lng, lat] positions). */
export function pointInRing(point: LatLng, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Inside the outer ring and outside every hole. */
export function pointInPolygon(point: LatLng, rings: Ring[]): boolean {
  if (!rings.length || !pointInRing(point, rings[0])) return false
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) return false
  }
  return true
}

/** Full feature (name + geometry) of the country containing the point, or null. */
export function countryFeatureAtSync(
  point: LatLng,
  countries: CountryCollection,
): CountryFeature | null {
  for (const f of countries.features) {
    const g = f.geometry
    if (g.type === 'Polygon') {
      if (pointInPolygon(point, g.coordinates)) return f
    } else {
      for (const poly of g.coordinates) {
        if (pointInPolygon(point, poly)) return f
      }
    }
  }
  return null
}

/** Name of the country containing the point, or null (ocean / uncovered). */
export function countryAtSync(point: LatLng, countries: CountryCollection): string | null {
  const name = countryFeatureAtSync(point, countries)?.properties.name
  return name ? commonCountryName(name) : null
}

/**
 * Natural Earth uses formal names for some countries; the game (and the quiz
 * data) uses everyday short names. Normalize so in-game feedback reads
 * naturally and matches quiz labels ("South Korea", not "Republic of Korea").
 */
const COMMON_NAMES: Record<string, string> = {
  'Russian Federation': 'Russia',
  'Republic of Korea': 'South Korea',
  "Dem. Rep. Korea": 'North Korea',
  'Czech Republic': 'Czechia',
  'Democratic Republic of the Congo': 'DR Congo',
  'Republic of the Congo': 'Congo',
  'Lao PDR': 'Laos',
  'Brunei Darussalam': 'Brunei',
  'Syrian Arab Republic': 'Syria',
  'Iran (Islamic Republic of)': 'Iran',
  'Islamic Republic of Iran': 'Iran',
  "Côte d'Ivoire": 'Ivory Coast',
  'Bolivia (Plurinational State of)': 'Bolivia',
  'Venezuela (Bolivarian Republic of)': 'Venezuela',
  'United Republic of Tanzania': 'Tanzania',
  'Viet Nam': 'Vietnam',
  'Republic of Moldova': 'Moldova',
  'The former Yugoslav Republic of Macedonia': 'North Macedonia',
  'Kingdom of eSwatini': 'Eswatini',
}

/** Everyday display name for a dataset country name. */
export function commonCountryName(name: string): string {
  return COMMON_NAMES[name] ?? name
}

let dataPromise: Promise<CountryCollection> | null = null

/** Lazy-load the country data (kept out of the initial bundle). */
function loadCountries(): Promise<CountryCollection> {
  dataPromise ??= import('./data/countries-110m.json').then((m) => {
    const data = (m.default ?? m) as unknown as CountryCollection
    // Normalize names once at load so every consumer sees everyday names.
    for (const f of data.features) {
      f.properties.name = commonCountryName(f.properties.name)
    }
    return data
  })
  return dataPromise
}

/** Async lookup that lazy-loads the dataset on first use. */
export async function countryAt(point: LatLng): Promise<string | null> {
  return countryAtSync(point, await loadCountries())
}

/** Async feature lookup (for drawing the answer's region on reveal, issue #6). */
export async function countryFeatureAt(point: LatLng): Promise<CountryFeature | null> {
  return countryFeatureAtSync(point, await loadCountries())
}

export type BordersGeoJSON = {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    properties: Record<string, never>
    geometry: CountryGeometry
  }[]
}

/**
 * Borders-only GeoJSON: every country's outline, no names (issue #47, Medium
 * history map). Rendered by a `line` layer so it draws the polygon boundaries
 * without any fill or labels. Pure so it's unit-testable.
 */
export function bordersGeoJSON(countries: CountryCollection): BordersGeoJSON {
  return {
    type: 'FeatureCollection',
    features: countries.features.map((f) => ({
      type: 'Feature',
      properties: {},
      geometry: f.geometry,
    })),
  }
}

/** Async borders GeoJSON with the dataset lazy-loaded on first use. */
export async function loadBordersGeoJSON(): Promise<BordersGeoJSON> {
  return bordersGeoJSON(await loadCountries())
}

/**
 * One-liner telling the player where their miss actually landed (issue #2).
 * Returns null for perfect hits — nothing to explain.
 */
export function describeMiss(
  guessCountry: string | null,
  answerCountry: string | null,
  base: number,
): string | null {
  if (base >= 100) return null
  if (guessCountry && guessCountry === answerCountry) return 'Right country — wrong spot.'
  if (guessCountry) return `Your guess landed in ${guessCountry}.`
  return 'Your guess landed in open water.'
}
