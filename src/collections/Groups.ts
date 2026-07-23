import type { Access, CollectionConfig, Where } from 'payload'
import { isAdmin } from '@/lib/access'

/**
 * Friend groups (issue #51): a private circle whose members see how they stack
 * up against just each other (a member-filtered leaderboard, reusing #50).
 * Reads are limited to the owner + members; group pages for prospective members
 * (invite links) are rendered server-side with overrideAccess.
 */

const memberOrOwner: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true
  const or: Where[] = [{ owner: { equals: user.id } }, { members: { in: [user.id] } }]
  return { or }
}

const ownerOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true
  return { owner: { equals: user.id } }
}

export const Groups: CollectionConfig = {
  slug: 'groups',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'owner'],
  },
  access: {
    read: memberOrOwner,
    create: ({ req: { user } }) => !!user,
    update: ownerOrAdmin,
    delete: ownerOrAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'URL identifier; generated from the name.' },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    { name: 'members', type: 'relationship', relationTo: 'users', hasMany: true },
    {
      name: 'inviteCode',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Share to invite; rotate to revoke old links.' },
    },
    {
      name: 'visibility',
      type: 'select',
      defaultValue: 'unlisted',
      options: [
        { label: 'Unlisted (anyone with the link)', value: 'unlisted' },
        { label: 'Private (members only)', value: 'private' },
      ],
    },
    { name: 'avatarEmoji', type: 'text', admin: { description: 'Optional emoji badge.' } },
  ],
  timestamps: true,
}
