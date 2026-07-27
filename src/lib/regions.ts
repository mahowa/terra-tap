/**
 * Region mapping for the leaderboard's "top in your region / country" cuts
 * (issue #50). A user's `countryFlag` is stored as either an emoji flag (🇫🇷)
 * or an ISO 3166-1 alpha-2 code ("FR"); both normalize to an ISO code here, and
 * ISO codes map to a continent-level region. Pure so it's unit-tested.
 */

export type Region =
  | 'Africa'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Oceania'
  | 'Antarctica'

export const REGIONS: Region[] = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Antarctica',
]

/**
 * Decode a stored flag value to an uppercase ISO alpha-2 code, or null.
 * Accepts a two-letter code ("fr"/"FR") or a regional-indicator emoji (🇫🇷).
 */
export function flagToIso(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()

  // Regional-indicator symbols (U+1F1E6..U+1F1FF) → A..Z.
  const points = [...trimmed].map((c) => c.codePointAt(0) ?? 0)
  const indicators = points.filter((p) => p >= 0x1f1e6 && p <= 0x1f1ff)
  if (indicators.length === 2) {
    return indicators.map((p) => String.fromCharCode(p - 0x1f1e6 + 65)).join('')
  }

  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase()
  return null
}

// ISO alpha-2 → continent. Covers UN members + common territories; anything
// unlisted returns null (shown only on the World board).
const ISO_REGION: Record<string, Region> = {
  // Africa
  DZ: 'Africa', AO: 'Africa', BJ: 'Africa', BW: 'Africa', BF: 'Africa', BI: 'Africa',
  CV: 'Africa', CM: 'Africa', CF: 'Africa', TD: 'Africa', KM: 'Africa', CG: 'Africa',
  CD: 'Africa', DJ: 'Africa', EG: 'Africa', GQ: 'Africa', ER: 'Africa', SZ: 'Africa',
  ET: 'Africa', GA: 'Africa', GM: 'Africa', GH: 'Africa', GN: 'Africa', GW: 'Africa',
  CI: 'Africa', KE: 'Africa', LS: 'Africa', LR: 'Africa', LY: 'Africa', MG: 'Africa',
  MW: 'Africa', ML: 'Africa', MR: 'Africa', MU: 'Africa', MA: 'Africa', MZ: 'Africa',
  NA: 'Africa', NE: 'Africa', NG: 'Africa', RW: 'Africa', ST: 'Africa', SN: 'Africa',
  SC: 'Africa', SL: 'Africa', SO: 'Africa', ZA: 'Africa', SS: 'Africa', SD: 'Africa',
  TZ: 'Africa', TG: 'Africa', TN: 'Africa', UG: 'Africa', ZM: 'Africa', ZW: 'Africa',
  // Asia
  AF: 'Asia', AM: 'Asia', AZ: 'Asia', BH: 'Asia', BD: 'Asia', BT: 'Asia', BN: 'Asia',
  KH: 'Asia', CN: 'Asia', CY: 'Asia', GE: 'Asia', IN: 'Asia', ID: 'Asia', IR: 'Asia',
  IQ: 'Asia', IL: 'Asia', JP: 'Asia', JO: 'Asia', KZ: 'Asia', KW: 'Asia', KG: 'Asia',
  LA: 'Asia', LB: 'Asia', MY: 'Asia', MV: 'Asia', MN: 'Asia', MM: 'Asia', NP: 'Asia',
  KP: 'Asia', OM: 'Asia', PK: 'Asia', PS: 'Asia', PH: 'Asia', QA: 'Asia', SA: 'Asia',
  SG: 'Asia', KR: 'Asia', LK: 'Asia', SY: 'Asia', TW: 'Asia', TJ: 'Asia', TH: 'Asia',
  TL: 'Asia', TR: 'Asia', TM: 'Asia', AE: 'Asia', UZ: 'Asia', VN: 'Asia', YE: 'Asia',
  // Europe
  AL: 'Europe', AD: 'Europe', AT: 'Europe', BY: 'Europe', BE: 'Europe', BA: 'Europe',
  BG: 'Europe', HR: 'Europe', CZ: 'Europe', DK: 'Europe', EE: 'Europe', FI: 'Europe',
  FR: 'Europe', DE: 'Europe', GR: 'Europe', HU: 'Europe', IS: 'Europe', IE: 'Europe',
  IT: 'Europe', XK: 'Europe', LV: 'Europe', LI: 'Europe', LT: 'Europe', LU: 'Europe',
  MT: 'Europe', MD: 'Europe', MC: 'Europe', ME: 'Europe', NL: 'Europe', MK: 'Europe',
  NO: 'Europe', PL: 'Europe', PT: 'Europe', RO: 'Europe', RU: 'Europe', SM: 'Europe',
  RS: 'Europe', SK: 'Europe', SI: 'Europe', ES: 'Europe', SE: 'Europe', CH: 'Europe',
  UA: 'Europe', GB: 'Europe', VA: 'Europe',
  // North America
  AG: 'North America', BS: 'North America', BB: 'North America', BZ: 'North America',
  CA: 'North America', CR: 'North America', CU: 'North America', DM: 'North America',
  DO: 'North America', SV: 'North America', GD: 'North America', GT: 'North America',
  HT: 'North America', HN: 'North America', JM: 'North America', MX: 'North America',
  NI: 'North America', PA: 'North America', KN: 'North America', LC: 'North America',
  VC: 'North America', TT: 'North America', US: 'North America',
  // South America
  AR: 'South America', BO: 'South America', BR: 'South America', CL: 'South America',
  CO: 'South America', EC: 'South America', GY: 'South America', PY: 'South America',
  PE: 'South America', SR: 'South America', UY: 'South America', VE: 'South America',
  // Oceania
  AU: 'Oceania', FJ: 'Oceania', KI: 'Oceania', MH: 'Oceania', FM: 'Oceania',
  NR: 'Oceania', NZ: 'Oceania', PW: 'Oceania', PG: 'Oceania', WS: 'Oceania',
  SB: 'Oceania', TO: 'Oceania', TV: 'Oceania', VU: 'Oceania',
  // Antarctica
  AQ: 'Antarctica',
}

/** Continent-level region for a stored flag value, or null if unknown. */
export function regionForFlag(flag: string | null | undefined): Region | null {
  const iso = flagToIso(flag)
  return iso ? (ISO_REGION[iso] ?? null) : null
}
