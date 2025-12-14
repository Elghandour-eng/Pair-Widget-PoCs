import axios from 'axios'

import { env } from '@/core/env'
import { createDebugLogger, getFilePathFromUrl } from '../utils/logger'
import { getWidgetId } from '../utils/widget-id'
import { tokenStorage } from './token-storage'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export const apiClient = axios.create({
  baseURL: env.baseURL,
  // withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

logger.debug('apiClient', 'API client created', { baseURL: env.baseURL })

apiClient.interceptors.request.use((config) => {
  logger.debug('requestInterceptor', 'Processing API request', { url: config.url, method: config.method })
  const widgetId = getWidgetId()
  const token = tokenStorage.get(widgetId)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    logger.debug('requestInterceptor', 'Authorization token attached to request')
  } else {
    logger.debug('requestInterceptor', 'No token found, request sent without authorization')
  }
  return config
})

// Public client (login, signup)
export const publicApiClient = axios.create({
  baseURL: env.baseURL,
  headers: { 'Content-Type': 'application/json' },
})

logger.debug('publicApiClient', 'Public API client created', { baseURL: env.baseURL })
