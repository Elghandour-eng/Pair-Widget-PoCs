import { createDebugLogger, getFilePathFromUrl } from '../utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

function getEnvVariable(key: keyof ImportMetaEnv): string {
  logger.debug('getEnvVariable', `Retrieving environment variable: ${key}`)
  const value = import.meta.env[key]
  if (typeof value !== 'string' || value === '') {
    logger.debug('getEnvVariable', `Environment variable missing or invalid: ${key}`)
    throw new Error(`Missing or invalid environment variable: ${key}`)
  }

  logger.debug('getEnvVariable', `Environment variable retrieved: ${key}`)
  return value
}

function getOptionalEnvVariable(key: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env[key]
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }
  return value.trim()
}

/**
 * Get backend base URL from window settings, fallback to env
 * Priority: window.PairAiWidgetSettings.beBaseUrl > VITE_BASE_URL
 */
function getBaseURL(): string {
  // Check window settings first (set by inline script in index.html from URL param)
  if (window.PairAiWidgetSettings?.beBaseUrl) {
    logger.debug('getBaseURL', 'Using beBaseUrl from window.PairAiWidgetSettings', {
      beBaseUrl: window.PairAiWidgetSettings.beBaseUrl,
    })
    return window.PairAiWidgetSettings.beBaseUrl
  }

  // Fall back to environment variable
  const envBaseUrl = getEnvVariable('VITE_BASE_URL')
  logger.debug('getBaseURL', 'Using VITE_BASE_URL from environment', { envBaseUrl })
  return envBaseUrl
}

const pusherPortStr = getOptionalEnvVariable('VITE_PUSHER_PORT')
const pusherForceTlsStr = getOptionalEnvVariable('VITE_PUSHER_FORCE_TLS')

export const env = {
  baseURL: getBaseURL(),
  pusherAppKey: getEnvVariable('VITE_PUSHER_APP_KEY'),
  pusherCluster: getOptionalEnvVariable('VITE_PUSHER_CLUSTER'),
  pusherHost: getOptionalEnvVariable('VITE_PUSHER_HOST'),
  pusherPort: pusherPortStr ? Number(pusherPortStr) : undefined,
  pusherForceTls: pusherForceTlsStr !== undefined ? pusherForceTlsStr === 'true' : true,
  hiroWidgetId: getOptionalEnvVariable('VITE_HIRO_WIDGET_ID'),
}

logger.debug('env', 'Environment configuration initialized', {
  baseURL: env.baseURL,
  pusherAppKey: env.pusherAppKey,
  pusherCluster: env.pusherCluster,
  pusherHost: env.pusherHost,
  pusherPort: env.pusherPort,
  pusherForceTls: env.pusherForceTls,
  hiroWidgetId: env.hiroWidgetId,
})
