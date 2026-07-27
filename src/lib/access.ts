import type { Access, FieldAccess } from 'payload'

/**
 * Shared access helpers for the account-driven collections (issue #49). Until
 * now every collection was public; introducing real accounts means user data
 * (and their results) must be scoped to the owner, with an `admin` role able to
 * see everything and reach the Payload admin panel.
 */

type MaybeUser = { id: number | string; role?: string } | null | undefined

export const isAdmin = (user: MaybeUser): boolean => user?.role === 'admin'

/**
 * Admins get everything; any other signed-in user is constrained to their own
 * documents via a where-clause on `ownerField` ('id' for the users collection
 * itself, 'user' for collections that reference a user). Signed-out → denied.
 */
export const adminOrSelf =
  (ownerField = 'id'): Access =>
  ({ req: { user } }) => {
    if (!user) return false
    if (isAdmin(user)) return true
    return { [ownerField]: { equals: user.id } }
  }

export const adminOnly: Access = ({ req: { user } }) => isAdmin(user)

/** Field-level: only admins may set/change the value (e.g. the role field). */
export const adminOnlyField: FieldAccess = ({ req: { user } }) => isAdmin(user)
