import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { forbidden, unauthorized } from '../lib/errors.js'
import type { Role } from '../services/users.js'

export interface AuthUser {
  id: string
  email: string
  role: Role
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return next(unauthorized())
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload
    req.user = { id: String(payload.sub), email: String(payload.email), role: payload.role as Role }
    next()
  } catch {
    next(unauthorized('Invalid or expired token'))
  }
}

const rank: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 }

export const requireRole =
  (min: Role): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    if (rank[req.user.role] < rank[min]) return next(forbidden(`Requires ${min} role`))
    next()
  }
