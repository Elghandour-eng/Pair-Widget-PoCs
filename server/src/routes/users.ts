import { Router } from 'express'
import { z } from 'zod'
import { badRequest, forbidden } from '../lib/errors.js'
import { logEvent } from '../lib/mongo.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'
import { countAdmins, createUser, deleteUser, getUserById, listUsers, roleSchema, updateUser } from '../services/users.js'

export const usersRouter = Router()
usersRouter.use(requireAuth, requireRole('admin'))

const password = z.string().min(8, 'Password must be at least 8 characters').max(128)
const widgetIds = z.array(z.string().min(3).max(64)).max(500)

usersRouter.get('/', asyncHandler(async (_req, res) => res.json({ users: await listUsers() })))

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({ email: z.string().email(), name: z.string().min(1).max(80), password, role: roleSchema, widgetIds: widgetIds.optional() })
      .parse(req.body)
    const user = await createUser(body)
    const access = user.widgetIds ? `access to ${user.widgetIds.length} widget(s)` : 'access to all widgets'
    logEvent({ level: 'info', action: 'user.created', actor: req.user!.email, message: `Created ${user.email} as ${user.role} (${access})`, ip: req.ip })
    res.status(201).json({ user })
  }),
)

usersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).max(80).optional(),
        role: roleSchema.optional(),
        password: password.optional(),
        widgetIds: widgetIds.nullable().optional(),
      })
      .parse(req.body)
    const target = await getUserById(req.params.id)
    if (target?.role === 'admin' && body.role && body.role !== 'admin' && (await countAdmins()) <= 1) {
      throw badRequest('Cannot demote the last admin')
    }
    const user = await updateUser(req.params.id, body)
    const changed = Object.keys(body).map((k) =>
      k === 'password' ? 'password'
      : k === 'widgetIds' ? (body.widgetIds ? `access=${body.widgetIds.length} widget(s)` : 'access=all widgets')
      : `${k}=${String(body[k as keyof typeof body])}`,
    )
    logEvent({ level: 'info', action: 'user.updated', actor: req.user!.email, message: `Updated ${user.email}: ${changed.join(', ')}`, ip: req.ip })
    res.json({ user })
  }),
)

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) throw forbidden('You cannot delete your own account')
    const target = await getUserById(req.params.id)
    if (target?.role === 'admin' && (await countAdmins()) <= 1) throw badRequest('Cannot delete the last admin')
    await deleteUser(req.params.id)
    logEvent({ level: 'warn', action: 'user.deleted', actor: req.user!.email, message: `Deleted ${target?.email ?? req.params.id}`, ip: req.ip })
    res.status(204).end()
  }),
)
