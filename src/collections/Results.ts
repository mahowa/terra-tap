import type { CollectionConfig } from 'payload'
import { adminOnly, adminOrSelf } from '@/lib/access'

/**
 * A completed run, persisted server-side (issue #49). Until now every result
 * lived only in the browser's localStorage; an account needs its history to
 * follow it across devices, and the leaderboard (#50) / groups (#51) read from
 * here. Rows are written by the trusted /api/results/save route (which resolves
 * the signed-in user from the auth cookie), never by the public REST API.
 */
export const Results: CollectionConfig = {
  slug: 'results',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'user', 'mode', 'total', 'createdAt'],
  },
  access: {
    // A player reads only their own results; the leaderboard reads via a
    // dedicated aggregate endpoint (#50) with overrideAccess, not this rule.
    read: adminOrSelf('user'),
    // Writes go through the server route (local API, overrideAccess). Block the
    // public REST surface so scores can't be forged by unauthenticated POSTs.
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      index: true,
      admin: { description: 'Null for a run completed while signed out.' },
    },
    {
      name: 'mode',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Daily', value: 'daily' },
        { label: 'Speed', value: 'speed' },
        { label: 'Versus', value: 'versus' },
        { label: 'History', value: 'history' },
        { label: 'Quiz', value: 'quiz' },
      ],
    },
    {
      name: 'dateKey',
      type: 'text',
      index: true,
      admin: { description: 'UTC day (YYYY-MM-DD) for dated modes; empty otherwise.' },
    },
    { name: 'title', type: 'text' },
    { name: 'total', type: 'number', required: true },
    { name: 'maxPossible', type: 'number' },
    {
      name: 'rounds',
      type: 'json',
      admin: { description: 'Per-round breakdown: name, base, multiplier, points, distanceKm.' },
    },
    { name: 'elapsedMs', type: 'number', admin: { description: 'Play time for timed modes.' } },
  ],
  timestamps: true,
}
