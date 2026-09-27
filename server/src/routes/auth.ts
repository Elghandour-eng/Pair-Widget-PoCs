import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { unauthorized } from '../lib/errors.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'
import { getUserById, toPublic, verifyPassword } from '../services/users.js'

export const authRouter = Router()

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false })

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body)
    const user = await verifyPassword(email, password)
    if (!user) throw unauthorized('Invalid email or password')
    const token = signToken({ id: user.id, email: user.email, role: user.role })
    res.json({ token, user: toPublic(user) })
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.user!.id)
    if (!user) throw unauthorized()
    res.json({ user: toPublic(user) })
  }),
)
