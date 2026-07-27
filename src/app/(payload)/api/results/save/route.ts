import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Persists a completed run to the signed-in player's account (issue #49).
 * Trusted write path: the user is resolved from Payload's auth cookie (never
 * from the body), and creation uses the local API with overrideAccess so the
 * public REST surface for `results` can stay locked. Signed-out requests are a
 * no-op — those runs still live in the browser's localStorage as before.
 */

export const dynamic = 'force-dynamic'

const MODES = new Set(['daily', 'speed', 'versus', 'history', 'quiz'])

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: await config })

  const { user } = await payload.auth({ headers: req.headers })
  if (!user) {
    // Not signed in — nothing to attribute. Local play is unaffected.
    return NextResponse.json({ ok: true, saved: false })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const mode = String(body.mode ?? '')
  if (!MODES.has(mode)) {
    return NextResponse.json({ error: 'invalid mode' }, { status: 400 })
  }

  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined

  const maxPossible = num(body.maxPossible)
  const rawTotal = num(body.total)
  if (rawTotal === undefined) {
    return NextResponse.json({ error: 'invalid total' }, { status: 400 })
  }
  // Basic sanity bound (a fuller anti-cheat pass lands with the leaderboard,
  // #50): a score can't be negative or exceed the run's maximum.
  const total = Math.max(0, maxPossible !== undefined ? Math.min(rawTotal, maxPossible) : rawTotal)

  try {
    const doc = await payload.create({
      collection: 'results',
      overrideAccess: true,
      data: {
        user: user.id,
        mode: mode as 'daily' | 'speed' | 'versus' | 'history' | 'quiz',
        dateKey: typeof body.dateKey === 'string' ? body.dateKey : undefined,
        title: typeof body.title === 'string' ? body.title : undefined,
        total,
        maxPossible,
        rounds: Array.isArray(body.rounds) ? body.rounds : undefined,
        elapsedMs: num(body.elapsedMs),
      },
    })
    return NextResponse.json({ ok: true, saved: true, id: doc.id })
  } catch (err) {
    payload.logger.error({ err }, 'failed to save result')
    return NextResponse.json({ error: 'save failed' }, { status: 500 })
  }
}
