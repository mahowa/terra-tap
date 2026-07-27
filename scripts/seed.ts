/**
 * Dev seed: creates a first admin user, a handful of locations, a practice
 * collection, and today's daily set. Idempotent-ish (skips if data exists).
 *
 * Run with: pnpm exec tsx scripts/seed.ts
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const LOCATIONS = [
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, difficulty: 'easy', tags: ['capital', 'city'], fact: 'On this day in 1889, the Eiffel Tower officially opened to the public.' },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, difficulty: 'easy', tags: ['capital', 'city'], fact: 'Tokyo was formerly known as Edo until it was renamed in 1868.' },
  { name: 'Reykjavik', country: 'Iceland', lat: 64.1466, lng: -21.9426, difficulty: 'medium', tags: ['capital', 'city'], fact: 'Reykjavik is the northernmost capital of a sovereign state.' },
  { name: 'Ulaanbaatar', country: 'Mongolia', lat: 47.8864, lng: 106.9057, difficulty: 'hard', tags: ['capital', 'city'], fact: 'Ulaanbaatar is the coldest capital city in the world by average temperature.' },
  { name: 'La Paz', country: 'Bolivia', lat: -16.5, lng: -68.15, difficulty: 'hard', tags: ['capital', 'city'], fact: 'La Paz is the highest administrative capital in the world at ~3,640m.' },
] as const

async function run() {
  const payload = await getPayload({ config: await config })

  // First admin user
  const existingUsers = await payload.count({ collection: 'users' })
  if (existingUsers.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: {
        email: 'admin@terratap.test',
        password: 'changeme123',
        displayName: 'Admin',
        role: 'admin',
      },
    })
    payload.logger.info('Created admin user admin@terratap.test / changeme123')
  }

  // Locations
  const existingLocations = await payload.count({ collection: 'locations' })
  const createdIds: number[] = []
  if (existingLocations.totalDocs === 0) {
    for (const loc of LOCATIONS) {
      const doc = await payload.create({
        collection: 'locations',
        data: {
          name: loc.name,
          country: loc.country,
          lat: loc.lat,
          lng: loc.lng,
          difficulty: loc.difficulty,
          tags: [...loc.tags],
          facts: [{ text: loc.fact }],
        },
      })
      createdIds.push(doc.id as number)
    }
    payload.logger.info(`Created ${createdIds.length} locations`)

    // Practice collection
    await payload.create({
      collection: 'practice-collections',
      data: {
        title: 'World Capitals',
        theme: 'Capitals',
        description: 'A starter set of world capital cities.',
        locations: createdIds,
      },
    })

    // Today's daily set (5 rounds, ramping difficulty)
    const today = new Date().toISOString().slice(0, 10)
    const diffByRound = ['easy', 'easy', 'medium', 'hard', 'hard'] as const
    await payload.create({
      collection: 'daily-sets',
      data: {
        date: today,
        rounds: createdIds.map((id, i) => ({ location: id, difficulty: diffByRound[i] })),
      },
    })
    payload.logger.info(`Created practice collection + daily set for ${today}`)
  } else {
    payload.logger.info('Locations already exist, skipping content seed')
  }

  payload.logger.info('Seed complete')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
