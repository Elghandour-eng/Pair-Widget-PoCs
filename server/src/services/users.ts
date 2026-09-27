import bcrypt from 'bcryptjs'
import { ulid } from 'ulid'
import { z } from 'zod'
import { conflict, notFound } from '../lib/errors.js'
import { keys, redis } from '../lib/redis.js'

export const roleSchema = z.enum(['admin', 'editor', 'viewer'])
export type Role = z.infer<typeof roleSchema>

export interface UserRecord {
  id: string
  email: string
  name: string
  role: Role
  passwordHash: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}
export type PublicUser = Omit<UserRecord, 'passwordHash'>

export const toPublic = ({ passwordHash: _p, ...u }: UserRecord): PublicUser => u

const parse = (raw: string | null): UserRecord | null => (raw ? (JSON.parse(raw) as UserRecord) : null)

export async function getUserById(id: string): Promise<UserRecord | null> {
  return parse(await redis.get(keys.user(id)))
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const id = await redis.get(keys.userByEmail(email))
  return id ? getUserById(id) : null
}

export async function listUsers(): Promise<PublicUser[]> {
  const ids = await redis.smembers(keys.users())
  if (!ids.length) return []
  const raws = await redis.mget(ids.map((id) => keys.user(id)))
  return raws
    .map(parse)
    .filter((u): u is UserRecord => !!u)
    .map(toPublic)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function createUser(input: { email: string; name: string; password: string; role: Role }): Promise<PublicUser> {
  const email = input.email.toLowerCase().trim()
  if (await redis.exists(keys.userByEmail(email))) throw conflict('A user with this email already exists')
  const now = new Date().toISOString()
  const user: UserRecord = {
    id: ulid(),
    email,
    name: input.name.trim(),
    role: input.role,
    passwordHash: await bcrypt.hash(input.password, 12),
    createdAt: now,
    updatedAt: now,
  }
  await redis
    .multi()
    .set(keys.user(user.id), JSON.stringify(user))
    .set(keys.userByEmail(email), user.id)
    .sadd(keys.users(), user.id)
    .exec()
  return toPublic(user)
}

export async function updateUser(
  id: string,
  patch: Partial<{ name: string; role: Role; password: string }>,
): Promise<PublicUser> {
  const user = await getUserById(id)
  if (!user) throw notFound('User not found')
  if (patch.name !== undefined) user.name = patch.name.trim()
  if (patch.role !== undefined) user.role = patch.role
  if (patch.password !== undefined) user.passwordHash = await bcrypt.hash(patch.password, 12)
  user.updatedAt = new Date().toISOString()
  await redis.set(keys.user(id), JSON.stringify(user))
  return toPublic(user)
}

export async function deleteUser(id: string): Promise<void> {
  const user = await getUserById(id)
  if (!user) throw notFound('User not found')
  await redis.multi().del(keys.user(id)).del(keys.userByEmail(user.email)).srem(keys.users(), id).exec()
}

export async function verifyPassword(email: string, password: string): Promise<UserRecord | null> {
  const user = await getUserByEmail(email)
  if (!user) {
    // Constant-time-ish: still run a hash compare so timing does not leak account existence.
    await bcrypt.compare(password, '$2a$12$CwTycUXWue0Thq9StjUM0uJ8Z6Y0iQz0cPq1VJk6l1kZpM5rQ5G2K')
    return null
  }
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return null
  user.lastLoginAt = new Date().toISOString()
  await redis.set(keys.user(user.id), JSON.stringify(user))
  return user
}

export async function countAdmins(): Promise<number> {
  const users = await listUsers()
  return users.filter((u) => u.role === 'admin').length
}
