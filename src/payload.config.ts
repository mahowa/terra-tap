import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Locations } from './collections/Locations'
import { DailySets } from './collections/DailySets'
import { PracticeCollections } from './collections/PracticeCollections'
import { NewsItems } from './collections/NewsItems'
import { Results } from './collections/Results'
import { Groups } from './collections/Groups'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const dbConnectionString = process.env.DATABASE_URL || ''
// Enable SSL for any non-local host (Prisma Postgres, Neon, Vercel Postgres, …).
const dbIsRemote = !/(^|@)(localhost|127\.0\.0\.1)/.test(dbConnectionString)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Media,
    Locations,
    DailySets,
    PracticeCollections,
    NewsItems,
    Results,
    Groups,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // Use migrations only (never dev auto-push). Critical: the DB is shared with
    // Prisma-managed tables (Author/Book/_prisma_migrations); auto-push would try
    // to drop them as "drift". Schema changes go through `pnpm migrate:create`.
    push: false,
    pool: {
      connectionString: dbConnectionString,
      // Remote Postgres (e.g. Prisma Postgres) requires SSL; local does not.
      // rejectUnauthorized:false avoids self-signed-chain errors while still encrypting.
      ...(dbIsRemote ? { ssl: { rejectUnauthorized: false } } : {}),
    },
  }),
  sharp,
  localization: {
    locales: ['en'],
    fallback: true,
    defaultLocale: 'en',
  },
  plugins: [],
})
