import type { RequestHandler } from 'express'
import { forbidden } from '../lib/errors.js'
import { getUserById } from '../services/users.js'

declare global {
  namespace Express {
    interface Request {
      /** Widget IDs this user may see; null means unrestricted (admins, or no list set). */
      allowedWidgets?: Set<string> | null
    }
  }
}

/**
 * Loads the caller's widget restriction fresh from Redis on every request, so an
 * admin's change to a user's access applies immediately — tokens are stateless and
 * only carry the role.
 */
export const loadWidgetAccess: RequestHandler = (req, _res, next) => {
  if (!req.user || req.user.role === 'admin') {
    req.allowedWidgets = null
    return next()
  }
  getUserById(req.user.id)
    .then((record) => {
      req.allowedWidgets = record?.widgetIds ? new Set(record.widgetIds) : null
      next()
    })
    .catch(next)
}

export function assertWidgetAccess(req: Express.Request, widgetId: string): void {
  if (req.allowedWidgets && !req.allowedWidgets.has(widgetId)) {
    throw forbidden('You do not have access to this widget')
  }
}
