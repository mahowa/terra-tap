import type { Difficulty } from './scoring'
import type { GameRun, Round } from './game-types'
import {
  DEFAULT_HISTORY_DIFFICULTY,
  mapDetailFor,
  type HistoryDifficulty,
} from './difficulty'
import { seededRng, shuffle } from './rng'

/**
 * Geography History mode (issue #4): the prompt is a historical description
 * instead of a place name — the player has to work out *where* the history
 * happened. The globe shows labels in this mode (the challenge is knowing the
 * history, not reading an unlabeled map), configured via GameRun.labeled.
 *
 * Like the daily and the speed run, the hand is dealt from the UTC day key
 * (issue #59): everyone who plays on a given day reads the same five moments,
 * so results are comparable and the mode is shareable. The deal walks a
 * rotating deck (issue #62) so the day's five are places the recent days
 * haven't already asked about.
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
  h('Nagasaki', 'Japan', 32.75, 129.87, 'medium',
    'Three days after the first atomic strike, a second bomb fell on this southern port — for centuries its harbor was the country’s only window on European trade.'),
  h('Sarajevo', 'Bosnia and Herzegovina', 43.86, 18.41, 'hard',
    'A gunshot on a street corner here in June 1914 killed an Austrian archduke and lit the fuse of the First World War; the city hosted the 1984 Winter Olympics.'),
  h('Hastings', 'United Kingdom', 50.85, 0.57, 'hard',
    'A Norman duke beat a Saxon king near this southern English coastal town in 1066, remaking the island’s rulers and its language.'),
  h('Chernobyl', 'Ukraine', 51.39, 30.1, 'medium',
    'Reactor No. 4 exploded here in April 1986, and the purpose-built town of Pripyat next door has stood empty ever since.'),
  h('Volgograd', 'Russia', 48.71, 44.51, 'hard',
    'A five-month battle along the Volga through the winter of 1942–43 turned the Eastern Front; the city then carried Stalin’s name and was later renamed.'),
  h('Dunkirk', 'France', 51.03, 2.38, 'hard',
    'In 1940 warships and a flotilla of little civilian boats lifted 338,000 trapped Allied soldiers off the beaches of this northern French port.'),
  h('Boston', 'United States', 42.36, -71.06, 'medium',
    'Colonists disguised as Mohawks tipped 342 chests of tea into this New England harbor in 1773; a midnight ride began here two years later.'),
  h('Versailles', 'France', 48.8, 2.13, 'medium',
    'A German empire was proclaimed in this palace’s Hall of Mirrors in 1871, and the treaty ending the First World War was signed in the same room in 1919.'),
  h('Delphi', 'Greece', 38.48, 22.5, 'hard',
    'Ancient Greeks climbed to this mountainside sanctuary to consult a priestess whose riddling answers swayed wars, colonies and kings.'),
  h('Petra', 'Jordan', 30.33, 35.44, 'medium',
    'Nabataean traders carved temple facades straight into rose-red sandstone cliffs at this desert caravan city, entered through a narrow gorge.'),
  h('Angkor', 'Cambodia', 13.41, 103.87, 'medium',
    'Capital of the Khmer Empire and site of the largest religious monument on Earth, this temple city was left to the jungle for centuries.'),
  h('Carthage', 'Tunisia', 36.85, 10.33, 'hard',
    'Hannibal’s home city fought Rome in three wars and was razed to the ground in 146 BC; its ruins look out over a North African gulf.'),
  h('Troy', 'Turkey', 39.96, 26.24, 'hard',
    'Homer sang of a ten-year siege ending with a wooden horse at this Anatolian mound, dug up by Heinrich Schliemann in the 1870s.'),
  h('Great Zimbabwe', 'Zimbabwe', -20.27, 30.93, 'hard',
    'Mortarless stone walls raised by a medieval Shona kingdom, grown rich on gold and Indian Ocean trade, gave the modern nation its name.'),
  h('Hong Kong', 'China', 22.32, 114.17, 'medium',
    'Ceded to Britain after the First Opium War in 1842, this harbor territory returned to Chinese rule in 1997 under “one country, two systems”.'),
  h('Gallipoli', 'Turkey', 40.41, 26.67, 'hard',
    'Allied troops — many Australian and New Zealander — landed on this narrow peninsula in 1915 and were pinned to the cliffs for eight months.'),
  h('Bletchley Park', 'United Kingdom', 52.0, -0.74, 'hard',
    'In wooden huts on an estate north of London, codebreakers led by Alan Turing cracked the German Enigma cipher and shortened the war.'),
  h('Wittenberg', 'Germany', 51.87, 12.65, 'hard',
    'A monk is said to have nailed ninety-five theses to a church door in this Saxon town in 1517, splitting Western Christianity in two.'),
  h('Vienna', 'Austria', 48.21, 16.37, 'medium',
    'Ottoman armies besieged this Danube capital twice, breaking against it decisively in 1683; a congress redrew Europe here after Napoleon fell.'),
  h('Marathon', 'Greece', 38.15, 23.96, 'hard',
    'An outnumbered Athenian army beat the Persians on this coastal plain in 490 BC, and the run carrying the news gave a modern race its name.'),
  h('Sparta', 'Greece', 37.07, 22.43, 'hard',
    'Three hundred warriors from this militarized Peloponnesian city-state held the pass at Thermopylae against the Persians in 480 BC.'),
  h('Kitty Hawk', 'United States', 36.06, -75.7, 'hard',
    'Two bicycle-shop brothers from Ohio made the first powered flights over these windswept Atlantic dunes in December 1903.'),
  h('Cape Canaveral', 'United States', 28.4, -80.6, 'medium',
    'Apollo 11 lifted off from this warm Atlantic coast in July 1969 on its way to the first crewed landing on the Moon.'),
  h('Selma', 'United States', 32.41, -87.02, 'hard',
    'Voting-rights marchers were beaten on a bridge leaving this Alabama town in March 1965, then walked 87 km to the state capital.'),
  h('Dallas', 'United States', 32.78, -96.8, 'medium',
    'President Kennedy was shot as his motorcade passed a book depository in this Texas city in November 1963.'),
  h('Chichén Itzá', 'Mexico', 20.68, -88.57, 'medium',
    'A stepped Maya pyramid here throws a serpent-shaped shadow at the equinoxes, beside a sacred sinkhole used for offerings.'),
  h('Cusco', 'Peru', -13.53, -71.97, 'medium',
    'Capital of the Inca Empire, its stonework fitted so tightly no blade slips between the blocks; Pizarro seized it in 1533.'),
  h('Babylon', 'Iraq', 32.54, 44.42, 'hard',
    'Hammurabi’s law code and legendary terraced gardens belong to this Mesopotamian city, whose blue-tiled gate now stands in a Berlin museum.'),
  h('Baghdad', 'Iraq', 33.31, 44.36, 'medium',
    'Its House of Wisdom made this Abbasid capital the scholarly center of the medieval world until the Mongols sacked it in 1258.'),
  h('Samarkand', 'Uzbekistan', 39.65, 66.96, 'hard',
    'Timur made this Silk Road oasis his capital and ringed its great plaza, the Registan, with tile-fronted madrasas.'),
  h('Lhasa', 'China', 29.65, 91.12, 'hard',
    'The Potala Palace steps up a hillside above this Himalayan city at 3,650 meters, seat of the Dalai Lamas until 1959.'),
  h('Stonehenge', 'United Kingdom', 51.18, -1.83, 'medium',
    'Neolithic builders hauled bluestones from Wales to raise a ring of standing sarsens on this chalk plain around 2500 BC.'),
  h('Luxor', 'Egypt', 25.7, 32.64, 'medium',
    'Ancient Thebes stood here; across the river a valley of rock-cut royal tombs gave up Tutankhamun’s intact burial in 1922.'),
  h('Jamestown', 'United States', 37.21, -76.78, 'hard',
    'England’s first lasting American settlement was planted on a marshy Virginia island in 1607 and nearly starved out within three years.'),
  h('Ellis Island', 'United States', 40.7, -74.04, 'medium',
    'Twelve million immigrants were processed on this harbor islet beside a copper statue between 1892 and 1954.'),
  h('Nuremberg', 'Germany', 49.45, 11.08, 'hard',
    'Nazi leaders were tried before an international military tribunal in this Bavarian city from 1945 to 1946.'),
  h('Yalta', 'Ukraine', 44.5, 34.17, 'hard',
    'Roosevelt, Churchill and Stalin met at this Black Sea resort in February 1945 to settle the shape of postwar Europe.'),
  h('Soweto', 'South Africa', -26.27, 27.86, 'hard',
    'A 1976 student uprising against compulsory Afrikaans schooling began in this sprawling township on the edge of Johannesburg.'),
  h('Amritsar', 'India', 31.63, 74.87, 'hard',
    'Sikhism’s Golden Temple stands here; in 1919 British troops fired on a crowd penned inside a walled garden nearby.'),
  h('Dien Bien Phu', 'Vietnam', 21.39, 103.02, 'hard',
    'French forces were encircled and beaten in this remote northern valley in 1954, ending colonial rule in Indochina.'),
  h('Pearl Harbor', 'United States', 21.35, -157.94, 'medium',
    'A surprise carrier-launched attack on this Pacific naval base in December 1941 brought the United States into the Second World War.'),
  h('Runnymede', 'United Kingdom', 51.44, -0.56, 'hard',
    'King John put his seal to the Magna Carta in this Thames-side meadow west of London in 1215.'),
  h('Trafalgar', 'Spain', 36.18, -6.03, 'hard',
    'Nelson won — and died in — a decisive naval battle off this Andalusian cape in 1805, ending Napoleon’s hopes of invading Britain.'),
  h('Oświęcim', 'Poland', 50.03, 19.21, 'hard',
    'The largest Nazi concentration and extermination camp ran beside this southern Polish town from 1940 until its liberation in January 1945.'),
  h('San Antonio', 'United States', 29.43, -98.49, 'hard',
    'A mission turned fortress in this Texas city fell to Santa Anna’s army in 1836 and gave a rebellion its rallying cry.'),
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

const DAY_MS = 86_400_000

/**
 * Days elapsed since 1970-01-01 for a UTC day key (YYYY-MM-DD). Anything
 * unparseable — or before the epoch — deals day zero.
 */
export function dayIndex(dateKey: string): number {
  const ms = Date.parse(`${dateKey}T00:00:00.000Z`)
  if (Number.isNaN(ms)) return 0
  return Math.max(0, Math.floor(ms / DAY_MS))
}

/**
 * Hands held clear on each side of a deck seam. Without this, a place dealt on
 * the last day of one deck could come straight back near the top of the next.
 */
const SEAM_HANDS = 4

/** No place returns for at least this many days — across seams included. */
export const HISTORY_MIN_REPEAT_DAYS = SEAM_HANDS + 1

/**
 * The deck a cycle deals from: the whole pool shuffled by a cycle-seeded RNG.
 * Consecutive cycles shuffle independently, so the seam between them is
 * repaired here — a place from the last {@link SEAM_HANDS} hands of the
 * previous deck is swapped out of any hand of this one that would bring it back
 * within {@link HISTORY_MIN_REPEAT_DAYS}.
 *
 * The repair only ever swaps within [SEAM_HANDS·handSize, length −
 * SEAM_HANDS·handSize), so a deck's own last hands are always its raw shuffle.
 * That is what lets the previous deck be read back from its raw shuffle instead
 * of chaining the repair all the way to cycle 0.
 */
function deckFor(cycle: number, handSize: number): HistoryPlace[] {
  const deck = shuffle(HISTORY_PLACES, seededRng(`history:deck:${cycle}`))
  const hands = Math.floor(deck.length / handSize)
  if (cycle <= 0 || hands <= SEAM_HANDS * 2) return deck

  // Which hand (day) of the previous deck each place was dealt in.
  const previousHand = new Map(
    shuffle(HISTORY_PLACES, seededRng(`history:deck:${cycle - 1}`)).map(
      (p, i) => [p.name, Math.floor(i / handSize)] as const,
    ),
  )
  // Days between the previous deck's hand for this place and the given hand of
  // this one — only the previous deck's untouched tail can come up short.
  const tooSoon = (place: HistoryPlace, hand: number): boolean => {
    const was = previousHand.get(place.name)
    return was !== undefined && hands - was + hand <= SEAM_HANDS
  }

  const head = SEAM_HANDS * handSize
  const tail = deck.length - head
  for (let i = 0; i < head; i++) {
    const hand = Math.floor(i / handSize)
    if (!tooSoon(deck[i], hand)) continue
    for (let j = head; j < tail; j++) {
      if (tooSoon(deck[j], hand)) continue
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
      break
    }
  }
  return deck
}

/**
 * The five moments for a given UTC day (issue #62). Days walk a rotating deck
 * rather than reshuffling the whole pool every morning: day N takes the Nth
 * window of `handSize` cards, so a place can't come back around until the deck
 * is spent — {@link HISTORY_PLACES}.length / handSize days later — and the deck
 * is reshuffled for every new pass. Independent daily shuffles used to repeat
 * roughly one place a day out of a 25-place pool.
 */
export function historyHand(
  dateKey: string,
  handSize: number = HISTORY_RUN_LENGTH,
): HistoryPlace[] {
  const size = Math.min(Math.max(1, Math.floor(handSize)), HISTORY_PLACES.length)
  const len = HISTORY_PLACES.length
  const hand: HistoryPlace[] = []
  const dealt = new Set<string>()
  // Hands only straddle two decks when the pool isn't a whole number of hands;
  // the `dealt` guard keeps a straddling hand from showing the same place twice.
  for (let i = dayIndex(dateKey) * size; hand.length < size; i++) {
    const place = deckFor(Math.floor(i / len), size)[i % len]
    if (dealt.has(place.name)) continue
    dealt.add(place.name)
    hand.push(place)
  }
  return hand
}

/**
 * The day's history run (issue #59). The hand is dealt from the UTC day key
 * alone, so every player gets the same five moments — and switching difficulty
 * mid-day re-skins the globe without re-dealing the places. The deal rotates
 * through the pool so days don't repeat each other (issue #62).
 *
 * The chosen difficulty (issue #47) sets how much the globe shows: Easy =
 * borders + names, Medium = borders only, Hard = neither.
 */
export function buildHistoryRun(
  dateKey: string,
  count: number = HISTORY_RUN_LENGTH,
  difficulty: HistoryDifficulty = DEFAULT_HISTORY_DIFFICULTY,
): GameRun {
  const rounds = historyHand(dateKey, count).map(toRound)
  return {
    title: 'Geography History',
    rounds,
    mode: 'practice',
    dateKey,
    labeled: true,
    mapDetail: mapDetailFor(difficulty),
  }
}
