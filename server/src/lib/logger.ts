import pino from 'pino'
import { env } from '../config/env.js'

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.isProd ? 'info' : 'debug',
  ...(env.isProd || env.NODE_ENV === 'test' ? {} : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
})
