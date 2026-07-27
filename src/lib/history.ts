import type { Difficulty } from './scoring'
import type { GameRun, Round } from './game-types'
import {
  DEFAULT_HISTORY_DIFFICULTY,
  mapDetailFor,
  type HistoryDifficulty,
} from './difficulty'
import { pick } from './rng'

/**
 * Geography History mode (issue #4): the prompt is a historical description
 * instead of a place name — the player has to work out *where* the history
 * happened. The globe shows labels in this mode (the challenge is knowing the
 * history, not reading an unlabeled map), configured via GameRun.labeled.
 */

export type HistoryPlace = {
  name: string
  country: string | null
  lat: number
  lng: number
  difficulty: Difficulty
  /** The historical description shown as the prompt. Must not name the place. */
  clue: string
}

export const HISTORY_RUN_LENGTH = 5

const h = (
  name: string,
  country: string | null,
  lat: number,
  lng: number,
  difficulty: Difficulty,
  clue: string,
): HistoryPlace => ({ name, country, lat, lng, difficulty, clue })

export const HISTORY_PLACES: HistoryPlace[] = [
  h('Istanbul', 'Turkey', 41.01, 28.98, 'easy',
    'Founded as Byzantium and later renamed Constantinople, this city straddling two continents was the capital of the Byzantine and Ottoman empires.'),
  h('Rome', 'Italy', 41.9, 12.5, 'easy',
    'Legend says twin brothers raised by a she-wolf founded this city on seven hills in 753 BC; it grew into an empire spanning three continents.'),
  h('Athens', 'Greece', 37.98, 23.73, 'easy',
    'Birthplace of democracy in the 5th century BC, where Socrates taught in the agora and the Parthenon still crowns the acropolis.'),
  h('Cairo', 'Egypt', 30.04, 31.24, 'easy',
    'On this capital’s outskirts stand the last surviving wonder of the ancient world — great stone tombs raised for pharaohs 4,500 years ago.'),
  h('Beijing', 'China', 39.9, 116.4, 'easy',
    'Emperors ruled from its Forbidden City for five centuries, and a great defensive wall winds through the mountains just to its north.'),
  h('Kyoto', 'Japan', 35.01, 135.77, 'medium',
    'This city was its country’s imperial capital for over a thousand years and was famously spared from bombing in 1945 for its cultural treasures.'),
  h('Machu Picchu', 'Peru', -13.16, -72.55, 'medium',
    'A 15th-century Incan citadel perched 2,400 meters up in the Andes, unknown to the outside world until 1911.'),
  h('Berlin', 'Germany', 52.52, 13.4, 'easy',
    'A wall split this city in two for 28 years during the Cold War; its most famous crossing was called Checkpoint Charlie.'),
  h('Hiroshima', 'Japan', 34.39, 132.46, 'medium',
    'On 6 August 1945 this port city became the first ever struck by an atomic bomb; a preserved dome still marks the hypocenter.'),
  h('Venice', 'Italy', 45.44, 12.34, 'easy',
    'A maritime republic built across 118 lagoon islands, whose merchants — including Marco Polo — dominated medieval Mediterranean trade.'),
  h('Moscow', 'Russia', 55.76, 37.62, 'easy',
    'Napoleon captured this city in 1812 only to find it burning around him; its walled riverside citadel remains the seat of power today.'),
  h('Cape Town', 'South Africa', -33.92, 18.42, 'medium',
    'Founded in 1652 as a Dutch resupply station beneath a flat-topped mountain; a prison island in its bay held Nelson Mandela for 18 years.'),
  h('Philadelphia', 'United States', 39.95, -75.17, 'medium',
    'The Declaration of Independence and the US Constitution were both signed in this city’s Independence Hall.'),
  h('Timbuktu', 'Mali', 16.77, -3.01, 'hard',
    'A fabled center of Islamic scholarship and the gold-salt trade on the Sahara’s southern edge, home to ancient manuscript libraries.'),
  h('St. Petersburg', 'Russia', 59.93, 30.34, 'medium',
    'A tsar built this Baltic city on a swamp in 1703 as his “window to Europe”; it was later called Petrograd, then Leningrad.'),
  h('Xi’an', 'China', 34.34, 108.94, 'hard',
    'Ancient eastern terminus of the Silk Road, where a buried army of thousands of terracotta soldiers guards a first emperor’s tomb.'),
  h('Mexico City', 'Mexico', 19.43, -99.13, 'easy',
    'Built atop the lake city the Aztecs founded where an eagle perched on a cactus; Cortés conquered it in 1521.'),
  h('London', 'United Kingdom', 51.51, -0.13, 'easy',
    'This capital on the Thames survived a great fire in 1666 that destroyed 13,000 houses — one year after a devastating plague.'),
  h('Normandy Beaches', 'France', 49.37, -0.88, 'medium',
    'On D-Day, 6 June 1944, Allied troops stormed five code-named beaches along this stretch of French coastline.'),
  h('Pompeii', 'Italy', 40.75, 14.49, 'medium',
    'A Roman town frozen in time when Vesuvius buried it in ash in AD 79, rediscovered remarkably intact 1,700 years later.'),
  h('Alexandria', 'Egypt', 31.2, 29.92, 'medium',
    'Founded by a Macedonian conqueror in 331 BC, it housed the ancient world’s greatest library and a towering lighthouse.'),
  h('Gettysburg', 'United States', 39.82, -77.23, 'hard',
    'The bloodiest battle of the American Civil War raged for three days near this small Pennsylvania town in July 1863.'),
  h('Waterloo', 'Belgium', 50.68, 4.4, 'hard',
    'Napoleon met his final defeat near this village south of Brussels on 18 June 1815.'),
  h('Easter Island', 'Chile', -27.11, -109.35, 'medium',
    'Nearly 1,000 monolithic stone figures called moai stand watch on this remote Pacific island, carved centuries before Europeans arrived.'),
  h('Jerusalem', null, 31.78, 35.22, 'easy',
    'Holy to three faiths and besieged dozens of times across three millennia, this hilltop old city is ringed by 16th-century Ottoman walls.'),
]

const toRound = (place: HistoryPlace): Round => ({
  name: place.name,
  country: place.country,
  lat: place.lat,
  lng: place.lng,
  difficulty: place.difficulty,
  fact: null,
  clue: place.clue,
})

/**
 * A clue-driven practice run sampled from the history pool. The chosen
 * difficulty (issue #47) sets how much the globe shows: Easy = borders + names,
 * Medium = borders only, Hard = neither.
 */
export function buildHistoryRun(
  rng: () => number,
  count: number = HISTORY_RUN_LENGTH,
  difficulty: HistoryDifficulty = DEFAULT_HISTORY_DIFFICULTY,
): GameRun {
  const rounds = pick(HISTORY_PLACES, count, rng).map(toRound)
  return {
    title: 'Geography History',
    rounds,
    mode: 'practice',
    dateKey: '',
    labeled: true,
    mapDetail: mapDetailFor(difficulty),
  }
}
