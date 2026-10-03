import { apiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Resolves (closes) an AI-agent conversation on the platform:
 * POST /v1/ai-agent/conversations/{conversationId}/resolve
 * Fire-and-forget from the widget's point of view — a failure never blocks
 * the visitor from starting over.
 */
export async function resolveConversation(conversationId: string): Promise<void> {
  try {
    await apiClient.post(`/v1/ai-agent/conversations/${conversationId}/resolve`)
    logger.debug('resolveConversation', 'Conversation resolved', { conversationId })
  } catch (error) {
    logger.debug('resolveConversation', 'Resolve failed (ignored)', { conversationId, error })
  }
}
