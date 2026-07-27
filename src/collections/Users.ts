import type { CollectionConfig } from 'payload'
import { adminOnly, adminOnlyField, adminOrSelf, isAdmin } from '@/lib/access'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'displayName',
  },
  auth: true,
  access: {
    // Real accounts (#49): users are no longer world-readable. A player sees and
    // edits only their own record; admins manage everyone and reach /admin.
    admin: ({ req: { user } }) => isAdmin(user),
    create: () => true, // public sign-up
    read: adminOrSelf(),
    update: adminOrSelf(),
    delete: adminOnly,
  },
  fields: [
    // Email + auth fields added by default
    {
      name: 'displayName',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'player',
      options: [
        { label: 'Player', value: 'player' },
        { label: 'Admin', value: 'admin' },
      ],
      // Kept on the JWT so access checks can read it without a DB round-trip;
      // only admins may change it (a player can't promote themselves).
      saveToJWT: true,
      access: {
        update: adminOnlyField,
      },
      admin: { description: 'Admins can manage all content and reach /admin.' },
    },
    {
      name: 'countryFlag',
      type: 'text',
      admin: { description: 'ISO country code / emoji flag shown on the profile.' },
    },
    {
      name: 'prefs',
      type: 'group',
      label: 'Gameplay preferences',
      fields: [
        { name: 'tapAssist', type: 'checkbox', defaultValue: false },
        { name: 'confirmTap', type: 'checkbox', defaultValue: false },
        { name: 'showPreviousGuess', type: 'checkbox', defaultValue: true },
        {
          name: 'scrollSensitivity',
          type: 'number',
          defaultValue: 1,
          min: 0.25,
          max: 4,
        },
        { name: 'useUtc', type: 'checkbox', defaultValue: true },
      ],
    },
  ],
  versions: false,
}
