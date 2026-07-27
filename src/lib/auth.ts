import 'server-only'
import { headers as nextHeaders } from 'next/headers'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'

/**
 * Server-side auth helpers for accounts (issue #49). Payload already issues an
 * HTTP-only `payload-token` cookie on login; these read the current user from
 * it in React Server Components and resolve the shared Payload instance.
 */

export async function getPayloadClient(): Promise<Payload> {
  return getPayload({ config: await config })
}

/** The signed-in user for the current request, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await nextHeaders() })
  return (user as User | null) ?? null
}
