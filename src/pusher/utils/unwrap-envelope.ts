import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Safely parses and unwraps a Pusher event envelope.
 *
 * All Pusher events pass through the notification driver, which wraps the
 * event-specific payload under `envelope.data`. This utility handles both
 * pre-parsed objects and stringified JSON, and extracts the inner `data`.
 *
 * @returns The unwrapped payload of type T, or null if parsing fails
 */
export function unwrapEnvelope<T>(data: unknown): T | null {
  try {
    const parsed: unknown = typeof data === 'string' ? JSON.parse(data) : data

    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return (parsed as { data: T }).data
    }

    logger.debug('unwrapEnvelope', 'Envelope missing "data" field', {
      keys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : [],
    })
    return null
  } catch (error) {
    logger.debug('unwrapEnvelope', 'Failed to parse envelope', {
      error: error instanceof Error ? error.message : String(error),
      dataPreview: typeof data === 'string' ? data.substring(0, 200) : String(data),
    })
    return null
  }
}
