import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { generateCode, isValidCode, normalizeCode, slugify } from '@/lib/groups'

/**
 * Group mutations (issue #51): create, join, leave, rotate the invite code, and
 * delete. One action-dispatched route; the acting user is always resolved from
 * the auth cookie, and ownership is enforced server-side. Writes use the local
 * API with overrideAccess so membership lookups by invite code work regardless
 * of the member-scoped read rule.
 */

export const dynamic = 'force-dynamic'

const rand = () => Math.random()

async function uniqueSlug(
  payload: Awaited<ReturnType<typeof getPayload>>,
  name: string,
): Promise<string> {
  const base = slugify(name)
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${generateCode(rand, 4).toLowerCase()}`
    const existing = await payload.find({
      collection: 'groups',
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.totalDocs === 0) return slug
  }
  return `${base}-${Date.now()}`
}

async function uniqueCode(payload: Awaited<ReturnType<typeof getPayload>>): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode(rand)
    const existing = await payload.find({
      collection: 'groups',
      where: { inviteCode: { equals: code } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.totalDocs === 0) return code
  }
  return generateCode(rand, 10)
}

const idList = (rel: unknown): number[] =>
  Array.isArray(rel)
    ? rel.map((m) => (typeof m === 'object' && m ? Number((m as { id: number }).id) : Number(m)))
    : []

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ error: 'sign in first' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const action = String(body.action ?? '')

  try {
    if (action === 'create') {
      const name = String(body.name ?? '').trim()
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
      const slug = await uniqueSlug(payload, name)
      const inviteCode = await uniqueCode(payload)
      const doc = await payload.create({
        collection: 'groups',
        overrideAccess: true,
        data: {
          name: name.slice(0, 60),
          slug,
          owner: user.id,
          members: [user.id],
          inviteCode,
          visibility: body.visibility === 'private' ? 'private' : 'unlisted',
          avatarEmoji: typeof body.avatarEmoji === 'string' ? body.avatarEmoji.slice(0, 8) : undefined,
        },
      })
      return NextResponse.json({ ok: true, slug: doc.slug })
    }

    if (action === 'join') {
      const code = normalizeCode(String(body.code ?? ''))
      if (!isValidCode(code)) return NextResponse.json({ error: 'invalid code' }, { status: 400 })
      const found = await payload.find({
        collection: 'groups',
        where: { inviteCode: { equals: code } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const group = found.docs[0]
      if (!group) return NextResponse.json({ error: 'no such group' }, { status: 404 })
      const members = idList(group.members)
      if (!members.map(String).includes(String(user.id))) {
        await payload.update({
          collection: 'groups',
          id: group.id,
          overrideAccess: true,
          data: { members: [...members, user.id] },
        })
      }
      return NextResponse.json({ ok: true, slug: group.slug })
    }

    // The remaining actions target a group the caller must own (or, for leave,
    // belong to). Load it first.
    const groupId = Number(body.groupId)
    if (!Number.isFinite(groupId)) {
      return NextResponse.json({ error: 'groupId required' }, { status: 400 })
    }
    const group = await payload.findByID({
      collection: 'groups',
      id: groupId,
      depth: 0,
      overrideAccess: true,
    })
    const ownerId = typeof group.owner === 'object' ? group.owner.id : group.owner
    const isOwner = String(ownerId) === String(user.id)

    if (action === 'leave') {
      if (isOwner) {
        return NextResponse.json(
          { error: 'the owner cannot leave — delete the group instead' },
          { status: 400 },
        )
      }
      const members = idList(group.members).filter((m) => String(m) !== String(user.id))
      await payload.update({
        collection: 'groups',
        id: group.id,
        overrideAccess: true,
        data: { members },
      })
      return NextResponse.json({ ok: true })
    }

    if (!isOwner) return NextResponse.json({ error: 'owner only' }, { status: 403 })

    if (action === 'rotate') {
      const inviteCode = await uniqueCode(payload)
      await payload.update({
        collection: 'groups',
        id: group.id,
        overrideAccess: true,
        data: { inviteCode },
      })
      return NextResponse.json({ ok: true, inviteCode })
    }

    if (action === 'delete') {
      await payload.delete({ collection: 'groups', id: group.id, overrideAccess: true })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err) {
    payload.logger.error({ err }, 'group action failed')
    return NextResponse.json({ error: 'action failed' }, { status: 500 })
  }
}
