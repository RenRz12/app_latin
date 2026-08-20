import { User } from '../models/User.js'

export const DEFAULT_LOCAL_USER_ID = 1

export async function ensureDefaultLocalUser(options = {}) {
  const [user] = await User.findOrCreate({
    where: { id: DEFAULT_LOCAL_USER_ID },
    defaults: { displayName: 'Estudiante local' },
    transaction: options.transaction,
  })

  return user
}
