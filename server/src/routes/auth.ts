import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { unauthorized } from '../lib/errors.js'
import { logEvent } from '../lib/mongo.js'
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
    if (!user) {
      logEvent({ level: 'warn', action: 'auth.login.failed', actor: email, message: `Failed sign-in for ${email}`, ip: req.ip })
      throw unauthorized('Invalid email or password')
    }
    const token = signToken({ id: user.id, email: user.email, role: user.role })
    logEvent({ level: 'info', action: 'auth.login', actor: user.email, message: `${user.email} signed in`, ip: req.ip, meta: { role: user.role } })
    res.json({ token, user: toPublic(user) })
  }),
)

/** Tokens are stateless, so this only records the sign-out in the system log. */
authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    logEvent({ level: 'info', action: 'auth.logout', actor: req.user!.email, message: `${req.user!.email} signed out`, ip: req.ip })
    res.status(204).end()
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
