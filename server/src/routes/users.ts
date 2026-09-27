import { Router } from 'express'
import { z } from 'zod'
import { badRequest, forbidden } from '../lib/errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'
import { countAdmins, createUser, deleteUser, getUserById, listUsers, roleSchema, updateUser } from '../services/users.js'

export const usersRouter = Router()
usersRouter.use(requireAuth, requireRole('admin'))

const password = z.string().min(8, 'Password must be at least 8 characters').max(128)

usersRouter.get('/', asyncHandler(async (_req, res) => res.json({ users: await listUsers() })))

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z.object({ email: z.string().email(), name: z.string().min(1).max(80), password, role: roleSchema }).parse(req.body)
    res.status(201).json({ user: await createUser(body) })
  }),
)

usersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = z.object({ name: z.string().min(1).max(80).optional(), role: roleSchema.optional(), password: password.optional() }).parse(req.body)
    const target = await getUserById(req.params.id)
    if (target?.role === 'admin' && body.role && body.role !== 'admin' && (await countAdmins()) <= 1) {
      throw badRequest('Cannot demote the last admin')
    }
    res.json({ user: await updateUser(req.params.id, body) })
  }),
)

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) throw forbidden('You cannot delete your own account')
    const target = await getUserById(req.params.id)
    if (target?.role === 'admin' && (await countAdmins()) <= 1) throw badRequest('Cannot delete the last admin')
    await deleteUser(req.params.id)
    res.status(204).end()
  }),
)
