import type { Message } from '@/features/conversation/types/message'

/**
 * Check if message is from a contact (user message)
 */
export function isUserMessage(message: Message): boolean {
  return message.sender_type === 'contact'
}

/**
 * Check if message is outgoing (not from contact - agent, system, human_agent, etc.)
 */
export function isOutgoingMessage(message: Message): boolean {
  return !isUserMessage(message)
}

/**
 * Check if message is from an AI Assistant
 */
export function isAiMessage(message: Message): boolean {
  if (message.message_type === 'widget_message') return true
  if (message.sender_type === 'bot' || message.sender_type === 'ai_agent' || message.sender_type === 'agent') {
    if (message.message_type === 'text' && !message.is_csat_survey) {
      return true
    }
  }
  return false
}

/**
 * Check if message is pending (optimistic message)
 */
export function isPendingMessage(message: Message): boolean {
  return message.status === 'pending' || (message.ulid.startsWith('temp-') && message.status !== 'failed')
}

/**
 * Check if message failed to send
 */
export function isFailedMessage(message: Message): boolean {
  return message.status === 'failed'
}

/**
 * Format message timestamp to time string
 */
export function formatMessageTime(sentAt: string): string {
  const sentAtDate = new Date(sentAt)
  return sentAtDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Convert hex color to rgba with opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '')

  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
