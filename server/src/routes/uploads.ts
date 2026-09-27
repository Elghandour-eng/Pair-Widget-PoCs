import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import express from 'express'
import { env } from '../config/env.js'
import { badRequest, notFound } from '../lib/errors.js'
import { logEvent } from '../lib/mongo.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'

/** Only formats a widget can actually render, so an upload can never become an executable. */
const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
}
const TYPE_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]))
const MAX_BYTES = 3 * 1024 * 1024

export const uploadsDir = () => path.resolve(env.UPLOAD_DIR)
const publicUrl = (file: string) => `/api/public/uploads/${file}`

export const uploadsRouter = Router()
uploadsRouter.use(requireAuth, requireRole('editor'))

uploadsRouter.post(
  '/',
  express.raw({ type: Object.keys(EXT_BY_TYPE), limit: MAX_BYTES }),
  asyncHandler(async (req, res) => {
    const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim()
    const ext = EXT_BY_TYPE[contentType]
    if (!ext) throw badRequest(`Unsupported image type "${contentType || 'none'}". Use PNG, JPEG, WebP, GIF, SVG or ICO.`)
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw badRequest('Empty upload')

    const dir = uploadsDir()
    await mkdir(dir, { recursive: true })
    const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`
    await writeFile(path.join(dir, name), req.body)

    logEvent({
      level: 'info',
      action: 'upload.created',
      actor: req.user!.email,
      message: `Uploaded ${name} (${req.body.length} bytes)`,
      ip: req.ip,
      meta: { type: contentType, bytes: req.body.length },
    })
    res.status(201).json({ name, url: publicUrl(name), size: req.body.length, type: contentType })
  }),
)

/** The media library behind the picker. */
uploadsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const dir = uploadsDir()
    if (!existsSync(dir)) return res.json({ uploads: [] })
    const names = (await readdir(dir)).filter((n) => TYPE_BY_EXT[n.split('.').pop() ?? ''])
    const uploads = await Promise.all(
      names.map(async (name) => {
        const s = await stat(path.join(dir, name))
        return { name, url: publicUrl(name), size: s.size, type: TYPE_BY_EXT[name.split('.').pop()!], at: s.mtime.toISOString() }
      }),
    )
    uploads.sort((a, b) => b.at.localeCompare(a.at))
    res.json({ uploads: uploads.slice(0, 200) })
  }),
)

uploadsRouter.delete(
  '/:name',
  asyncHandler(async (req, res) => {
    // Never let a name escape the upload directory.
    const name = path.basename(req.params.name)
    if (!TYPE_BY_EXT[name.split('.').pop() ?? '']) throw badRequest('Not an uploaded image')
    const file = path.join(uploadsDir(), name)
    if (!existsSync(file)) throw notFound('Upload not found')
    await unlink(file)
    logEvent({ level: 'warn', action: 'upload.deleted', actor: req.user!.email, message: `Deleted upload ${name}`, ip: req.ip })
    res.status(204).end()
  }),
)

/**
 * Public read path. Uploads are user-supplied, and an SVG can carry script,
 * so they are served with a CSP that allows nothing to run and never sniffed.
 */
export const uploadsStatic = express.static(uploadsDir(), {
  index: false,
  dotfiles: 'deny',
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox")
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', 'inline')
  },
})
