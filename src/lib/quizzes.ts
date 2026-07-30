import type { Difficulty } from './scoring'
import type { GameRun, Round } from './game-types'
import { regionBounds, type Bounds } from './camera'
import { pick } from './rng'

/**
 * Built-in "pop quiz" definitions (issue #3): themed pools of places the
 * player can practice against — regional tests (US state capitals, world
 * capitals, big cities) and one quiz per continent. Pure data + pure
 * builders so the list and runs are unit-testable; pages sample rounds
 * from a pool with an injected rng.
 */

export type QuizPlace = {
  name: string
  /** Display context — country, or state for US quizzes. */
  country: string | null
  lat: number
  lng: number
  difficulty: Difficulty
}

export type Quiz = {
  slug: string
  title: string
  theme: 'Regions' | 'Continents'
  description: string
  pool: QuizPlace[]
}

/** Rounds per quiz run (matches the daily's length). */
export const QUIZ_RUN_LENGTH = 5

const p = (
  name: string,
  country: string | null,
  lat: number,
  lng: number,
  difficulty: Difficulty,
): QuizPlace => ({ name, country, lat, lng, difficulty })

const US_STATE_CAPITALS: QuizPlace[] = [
  p('Montgomery', 'Alabama', 32.38, -86.3, 'hard'),
  p('Juneau', 'Alaska', 58.3, -134.42, 'hard'),
  p('Phoenix', 'Arizona', 33.45, -112.07, 'easy'),
  p('Little Rock', 'Arkansas', 34.75, -92.29, 'hard'),
  p('Sacramento', 'California', 38.58, -121.49, 'medium'),
  p('Denver', 'Colorado', 39.74, -104.99, 'easy'),
  p('Hartford', 'Connecticut', 41.77, -72.67, 'hard'),
  p('Dover', 'Delaware', 39.16, -75.52, 'hard'),
  p('Tallahassee', 'Florida', 30.44, -84.28, 'hard'),
  p('Atlanta', 'Georgia', 33.75, -84.39, 'easy'),
  p('Honolulu', 'Hawaii', 21.31, -157.86, 'medium'),
  p('Boise', 'Idaho', 43.62, -116.2, 'medium'),
  p('Springfield', 'Illinois', 39.8, -89.65, 'hard'),
  p('Indianapolis', 'Indiana', 39.77, -86.16, 'medium'),
  p('Des Moines', 'Iowa', 41.59, -93.62, 'medium'),
  p('Topeka', 'Kansas', 39.05, -95.68, 'hard'),
  p('Frankfort', 'Kentucky', 38.2, -84.87, 'hard'),
  p('Baton Rouge', 'Louisiana', 30.45, -91.19, 'medium'),
  p('Augusta', 'Maine', 44.31, -69.78, 'hard'),
  p('Annapolis', 'Maryland', 38.98, -76.49, 'hard'),
  p('Boston', 'Massachusetts', 42.36, -71.06, 'easy'),
  p('Lansing', 'Michigan', 42.73, -84.55, 'hard'),
  p('St. Paul', 'Minnesota', 44.95, -93.09, 'medium'),
  p('Jackson', 'Mississippi', 32.3, -90.18, 'hard'),
  p('Jefferson City', 'Missouri', 38.58, -92.17, 'hard'),
  p('Helena', 'Montana', 46.59, -112.04, 'hard'),
  p('Lincoln', 'Nebraska', 40.81, -96.68, 'medium'),
  p('Carson City', 'Nevada', 39.16, -119.77, 'hard'),
  p('Concord', 'New Hampshire', 43.21, -71.54, 'hard'),
  p('Trenton', 'New Jersey', 40.22, -74.76, 'hard'),
  p('Santa Fe', 'New Mexico', 35.69, -105.94, 'medium'),
  p('Albany', 'New York', 42.65, -73.75, 'medium'),
  p('Raleigh', 'North Carolina', 35.78, -78.64, 'medium'),
  p('Bismarck', 'North Dakota', 46.81, -100.78, 'hard'),
  p('Columbus', 'Ohio', 39.96, -83.0, 'medium'),
  p('Oklahoma City', 'Oklahoma', 35.47, -97.52, 'medium'),
  p('Salem', 'Oregon', 44.94, -123.04, 'hard'),
  p('Harrisburg', 'Pennsylvania', 40.27, -76.88, 'hard'),
  p('Providence', 'Rhode Island', 41.82, -71.41, 'medium'),
  p('Columbia', 'South Carolina', 34.0, -81.03, 'hard'),
  p('Pierre', 'South Dakota', 44.37, -100.35, 'hard'),
  p('Nashville', 'Tennessee', 36.16, -86.78, 'easy'),
  p('Austin', 'Texas', 30.27, -97.74, 'easy'),
  p('Salt Lake City', 'Utah', 40.76, -111.89, 'medium'),
  p('Montpelier', 'Vermont', 44.26, -72.58, 'hard'),
  p('Richmond', 'Virginia', 37.54, -77.44, 'medium'),
  p('Olympia', 'Washington', 47.04, -122.9, 'hard'),
  p('Charleston', 'West Virginia', 38.35, -81.63, 'hard'),
  p('Madison', 'Wisconsin', 43.07, -89.4, 'medium'),
  p('Cheyenne', 'Wyoming', 41.14, -104.82, 'hard'),
]

const WORLD_CAPITALS: QuizPlace[] = [
  p('London', 'United Kingdom', 51.51, -0.13, 'easy'),
  p('Paris', 'France', 48.86, 2.35, 'easy'),
  p('Washington, D.C.', 'United States', 38.9, -77.04, 'easy'),
  p('Tokyo', 'Japan', 35.68, 139.69, 'easy'),
  p('Beijing', 'China', 39.9, 116.4, 'easy'),
  p('Moscow', 'Russia', 55.76, 37.62, 'easy'),
  p('Berlin', 'Germany', 52.52, 13.4, 'easy'),
  p('Rome', 'Italy', 41.9, 12.5, 'easy'),
  p('Madrid', 'Spain', 40.42, -3.7, 'easy'),
  p('Ottawa', 'Canada', 45.42, -75.7, 'medium'),
  p('Canberra', 'Australia', -35.28, 149.13, 'medium'),
  p('Brasília', 'Brazil', -15.79, -47.88, 'medium'),
  p('Cairo', 'Egypt', 30.04, 31.24, 'easy'),
  p('New Delhi', 'India', 28.61, 77.21, 'easy'),
  p('Seoul', 'South Korea', 37.57, 126.98, 'easy'),
  p('Mexico City', 'Mexico', 19.43, -99.13, 'easy'),
  p('Buenos Aires', 'Argentina', -34.6, -58.38, 'easy'),
  p('Nairobi', 'Kenya', -1.29, 36.82, 'medium'),
  p('Bangkok', 'Thailand', 13.76, 100.5, 'easy'),
  p('Ankara', 'Turkey', 39.93, 32.86, 'medium'),
  p('Oslo', 'Norway', 59.91, 10.75, 'medium'),
  p('Wellington', 'New Zealand', -41.29, 174.78, 'medium'),
  p('Reykjavik', 'Iceland', 64.15, -21.94, 'medium'),
  p('Ulaanbaatar', 'Mongolia', 47.89, 106.91, 'hard'),
]

const BIG_CITIES: QuizPlace[] = [
  p('New York', 'United States', 40.71, -74.01, 'easy'),
  p('Los Angeles', 'United States', 34.05, -118.24, 'easy'),
  p('São Paulo', 'Brazil', -23.55, -46.63, 'easy'),
  p('Shanghai', 'China', 31.23, 121.47, 'easy'),
  p('Mumbai', 'India', 19.08, 72.88, 'easy'),
  p('Istanbul', 'Turkey', 41.01, 28.98, 'easy'),
  p('Lagos', 'Nigeria', 6.52, 3.38, 'medium'),
  p('Karachi', 'Pakistan', 24.86, 67.01, 'medium'),
  p('Jakarta', 'Indonesia', -6.21, 106.85, 'medium'),
  p('Dhaka', 'Bangladesh', 23.81, 90.41, 'medium'),
  p('Rio de Janeiro', 'Brazil', -22.91, -43.17, 'easy'),
  p('Sydney', 'Australia', -33.87, 151.21, 'easy'),
  p('Toronto', 'Canada', 43.65, -79.38, 'easy'),
  p('Chicago', 'United States', 41.88, -87.63, 'easy'),
  p('Singapore', 'Singapore', 1.35, 103.82, 'easy'),
  p('Hong Kong', 'China', 22.32, 114.17, 'easy'),
  p('Lahore', 'Pakistan', 31.55, 74.34, 'hard'),
  p('Chengdu', 'China', 30.57, 104.07, 'hard'),
  p('Johannesburg', 'South Africa', -26.2, 28.05, 'medium'),
  p('Ho Chi Minh City', 'Vietnam', 10.82, 106.63, 'medium'),
]

const AFRICA: QuizPlace[] = [
  p('Cairo', 'Egypt', 30.04, 31.24, 'easy'),
  p('Lagos', 'Nigeria', 6.52, 3.38, 'medium'),
  p('Nairobi', 'Kenya', -1.29, 36.82, 'medium'),
  p('Johannesburg', 'South Africa', -26.2, 28.05, 'medium'),
  p('Casablanca', 'Morocco', 33.57, -7.59, 'medium'),
  p('Addis Ababa', 'Ethiopia', 9.03, 38.75, 'medium'),
  p('Accra', 'Ghana', 5.6, -0.19, 'medium'),
  p('Dakar', 'Senegal', 14.72, -17.47, 'hard'),
  p('Kinshasa', 'DR Congo', -4.32, 15.31, 'hard'),
  p('Khartoum', 'Sudan', 15.5, 32.56, 'hard'),
  p('Antananarivo', 'Madagascar', -18.88, 47.51, 'hard'),
  p('Marrakesh', 'Morocco', 31.63, -7.99, 'medium'),
]

const EUROPE: QuizPlace[] = [
  p('London', 'United Kingdom', 51.51, -0.13, 'easy'),
  p('Paris', 'France', 48.86, 2.35, 'easy'),
  p('Berlin', 'Germany', 52.52, 13.4, 'easy'),
  p('Rome', 'Italy', 41.9, 12.5, 'easy'),
  p('Madrid', 'Spain', 40.42, -3.7, 'easy'),
  p('Amsterdam', 'Netherlands', 52.37, 4.9, 'easy'),
  p('Vienna', 'Austria', 48.21, 16.37, 'medium'),
  p('Prague', 'Czechia', 50.08, 14.44, 'medium'),
  p('Athens', 'Greece', 37.98, 23.73, 'easy'),
  p('Lisbon', 'Portugal', 38.72, -9.14, 'medium'),
  p('Stockholm', 'Sweden', 59.33, 18.07, 'medium'),
  p('Warsaw', 'Poland', 52.23, 21.01, 'medium'),
]

const ASIA: QuizPlace[] = [
  p('Tokyo', 'Japan', 35.68, 139.69, 'easy'),
  p('Beijing', 'China', 39.9, 116.4, 'easy'),
  p('Seoul', 'South Korea', 37.57, 126.98, 'easy'),
  p('Bangkok', 'Thailand', 13.76, 100.5, 'easy'),
  p('Mumbai', 'India', 19.08, 72.88, 'easy'),
  p('Singapore', 'Singapore', 1.35, 103.82, 'easy'),
  p('Jakarta', 'Indonesia', -6.21, 106.85, 'medium'),
  p('Hanoi', 'Vietnam', 21.03, 105.85, 'medium'),
  p('Kathmandu', 'Nepal', 27.72, 85.32, 'medium'),
  p('Riyadh', 'Saudi Arabia', 24.71, 46.68, 'medium'),
  p('Tashkent', 'Uzbekistan', 41.3, 69.24, 'hard'),
  p('Manila', 'Philippines', 14.6, 120.98, 'medium'),
]

const NORTH_AMERICA: QuizPlace[] = [
  p('New York', 'United States', 40.71, -74.01, 'easy'),
  p('Mexico City', 'Mexico', 19.43, -99.13, 'easy'),
  p('Toronto', 'Canada', 43.65, -79.38, 'easy'),
  p('Chicago', 'United States', 41.88, -87.63, 'easy'),
  p('Havana', 'Cuba', 23.11, -82.37, 'medium'),
  p('Vancouver', 'Canada', 49.28, -123.12, 'medium'),
  p('Guatemala City', 'Guatemala', 14.63, -90.51, 'hard'),
  p('Panama City', 'Panama', 8.98, -79.52, 'medium'),
  p('San Francisco', 'United States', 37.77, -122.42, 'easy'),
  p('Miami', 'United States', 25.76, -80.19, 'easy'),
  p('Kingston', 'Jamaica', 17.97, -76.79, 'hard'),
  p('Montreal', 'Canada', 45.5, -73.57, 'medium'),
]

const SOUTH_AMERICA: QuizPlace[] = [
  p('São Paulo', 'Brazil', -23.55, -46.63, 'easy'),
  p('Buenos Aires', 'Argentina', -34.6, -58.38, 'easy'),
  p('Rio de Janeiro', 'Brazil', -22.91, -43.17, 'easy'),
  p('Bogotá', 'Colombia', 4.71, -74.07, 'medium'),
  p('Lima', 'Peru', -12.05, -77.04, 'medium'),
  p('Santiago', 'Chile', -33.45, -70.67, 'medium'),
  p('Quito', 'Ecuador', -0.18, -78.47, 'medium'),
  p('Caracas', 'Venezuela', 10.48, -66.9, 'medium'),
  p('La Paz', 'Bolivia', -16.5, -68.15, 'hard'),
  p('Montevideo', 'Uruguay', -34.9, -56.16, 'medium'),
  p('Asunción', 'Paraguay', -25.26, -57.58, 'hard'),
  p('Cusco', 'Peru', -13.53, -71.97, 'medium'),
]

const OCEANIA: QuizPlace[] = [
  p('Sydney', 'Australia', -33.87, 151.21, 'easy'),
  p('Melbourne', 'Australia', -37.81, 144.96, 'easy'),
  p('Canberra', 'Australia', -35.28, 149.13, 'medium'),
  p('Brisbane', 'Australia', -27.47, 153.03, 'medium'),
  p('Perth', 'Australia', -31.95, 115.86, 'medium'),
  p('Auckland', 'New Zealand', -36.85, 174.76, 'medium'),
  p('Wellington', 'New Zealand', -41.29, 174.78, 'medium'),
  p('Suva', 'Fiji', -18.14, 178.44, 'hard'),
  p('Port Moresby', 'Papua New Guinea', -9.44, 147.18, 'hard'),
  p('Honolulu', 'United States', 21.31, -157.86, 'medium'),
]

export const QUIZZES: Quiz[] = [
  {
    slug: 'us-state-capitals',
    title: 'US State Capitals',
    theme: 'Regions',
    description: 'All fifty of them — from Montgomery to Cheyenne.',
    pool: US_STATE_CAPITALS,
  },
  {
    slug: 'world-capitals',
    title: 'World Capitals',
    theme: 'Regions',
    description: 'Capitals across every continent.',
    pool: WORLD_CAPITALS,
  },
  {
    slug: 'big-cities',
    title: 'Big Cities',
    theme: 'Regions',
    description: "The world's megacities.",
    pool: BIG_CITIES,
  },
  {
    slug: 'africa',
    title: 'Africa',
    theme: 'Continents',
    description: 'Cities across the African continent.',
    pool: AFRICA,
  },
  {
    slug: 'europe',
    title: 'Europe',
    theme: 'Continents',
    description: 'From Lisbon to Warsaw.',
    pool: EUROPE,
  },
  {
    slug: 'asia',
    title: 'Asia',
    theme: 'Continents',
    description: 'The biggest continent, corner to corner.',
    pool: ASIA,
  },
  {
    slug: 'north-america',
    title: 'North America',
    theme: 'Continents',
    description: 'From Vancouver to Panama City.',
    pool: NORTH_AMERICA,
  },
  {
    slug: 'south-america',
    title: 'South America',
    theme: 'Continents',
    description: 'Andes, Amazon, and everything between.',
    pool: SOUTH_AMERICA,
  },
  {
    slug: 'oceania',
    title: 'Oceania',
    theme: 'Continents',
    description: 'Australia, New Zealand, and the Pacific.',
    pool: OCEANIA,
  },
]

/** Find a quiz by its URL slug. */
export function getQuiz(slug: string): Quiz | null {
  return QUIZZES.find((q) => q.slug === slug) ?? null
}

/**
 * The frame a quiz opens on (issue #61): the box around its whole pool, so an
 * Africa run starts over Africa rather than on a full globe the player has to
 * spin. Computed from the pool — not the five dealt places — so the opening
 * view can't be read as a hint.
 *
 * Null for the globe-spanning quizzes (world capitals, big cities): their box
 * is the whole world, and the neutral globe start is already sized to the
 * viewport for that (issue #34).
 */
export function quizBounds(quiz: Quiz): Bounds | null {
  const bounds = regionBounds(quiz.pool.map((p) => ({ lat: p.lat, lng: p.lng })))
  if (!bounds) return null
  const [[west], [east]] = bounds
  return west <= -180 && east >= 180 ? null : bounds
}

const toRound = (place: QuizPlace): Round => ({
  name: place.name,
  country: place.country,
  lat: place.lat,
  lng: place.lng,
  difficulty: place.difficulty,
  fact: null,
})

/**
 * Build a playable practice run from a quiz: `count` distinct places sampled
 * from its pool with the supplied rng (inject a seeded rng in tests,
 * Math.random in pages). The run opens framed on the quiz's region (#61).
 */
export function buildQuizRun(
  slug: string,
  rng: () => number,
  count: number = QUIZ_RUN_LENGTH,
): GameRun | null {
  const quiz = getQuiz(slug)
  if (!quiz) return null
  const rounds = pick(quiz.pool, Math.min(count, quiz.pool.length), rng).map(toRound)
  const bounds = quizBounds(quiz)
  return {
    title: quiz.title,
    rounds,
    mode: 'practice',
    dateKey: '',
    ...(bounds ? { startBounds: bounds } : {}),
  }
}
