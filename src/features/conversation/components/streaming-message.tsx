import { AiThinkingPill } from '@/features/conversation/components/ai-thinking-pill'
import { AiAssistantMessage } from '@/features/conversation/components/conversation-message/ai-assistant-message/ai-assistant-message'
import { AiAssistantMessageHeader } from '@/features/conversation/components/conversation-message/ai-assistant-message/ai-assistant-message-header'
import type { StreamState } from '@/features/conversation/stores/streaming-store'
import type { Message, NextMessageItem, WidgetTemplate } from '@/features/conversation/types/message'

interface StreamingMessageProps {
  stream: StreamState
}

/**
 * Attempts to parse raw JSON or partially completed JSON during streaming.
 */
function tryParsePartialJson(input: string): Record<string, any> | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null
  }

  // 1. Try standard JSON.parse first
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch {
    // Continue to partial repair
  }

  // 2. Attempt repair of unclosed strings, arrays, objects
  try {
    let str = trimmed

    // Check if we are inside an unclosed string
    let inString = false
    let isEscaped = false
    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      if (char === '\\' && !isEscaped) {
        isEscaped = true
      } else {
        if (char === '"' && !isEscaped) {
          inString = !inString
        }
        isEscaped = false
      }
    }

    if (inString) {
      str += '"'
    }

    // Balance braces and brackets
    const stack: string[] = []
    inString = false
    isEscaped = false
    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      if (char === '\\' && !isEscaped) {
        isEscaped = true
      } else {
        if (char === '"' && !isEscaped) {
          inString = !inString
        } else if (!inString) {
          if (char === '{') stack.push('}')
          else if (char === '[') stack.push(']')
          else if (char === '}' || char === ']') {
            if (stack.length > 0 && stack[stack.length - 1] === char) {
              stack.pop()
            }
          }
        }
        isEscaped = false
      }
    }

    // Append matching closing characters in reverse
    while (stack.length > 0) {
      str += stack.pop()
    }

    const parsed = JSON.parse(str)
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch {
    // Return null if repair failed
  }

  return null
}

export function parseStreamingMessage(stream: StreamState): Message {
  const rawText = stream.text.trim()
  const parsedJson = tryParsePartialJson(rawText)

  let content = rawText
  let widgetTemplate: WidgetTemplate | undefined = undefined
  let nextMessages: NextMessageItem[] | undefined = undefined
  let nextMsg: NextMessageItem | undefined = undefined

  if (parsedJson) {
    // Extract text/content field
    if (typeof parsedJson.content === 'string') {
      content = parsedJson.content
    } else if (typeof parsedJson.intro_text === 'string') {
      content = parsedJson.intro_text
    } else if (typeof parsedJson.text === 'string') {
      content = parsedJson.text
    } else if (typeof parsedJson.message === 'string') {
      content = parsedJson.message
    } else {
      content = ''
    }

    // Extract widget_template
    if (parsedJson.widget_template && typeof parsedJson.widget_template === 'object') {
      widgetTemplate = parsedJson.widget_template as WidgetTemplate
    } else if (parsedJson.type && typeof parsedJson.type === 'string') {
      const knownTemplateTypes = [
        'product_comparison',
        'product_collection_suggestions',
        'error_card',
        'informative',
        'order_status',
        'wishlist_products',
        'carousel',
        'product_slots',
      ]
      if (knownTemplateTypes.includes(parsedJson.type)) {
        widgetTemplate = parsedJson as WidgetTemplate
      }
    }

    // Extract next_messages / next_msg / suggestions
    if (Array.isArray(parsedJson.next_messages)) {
      nextMessages = parsedJson.next_messages
    } else if (
      parsedJson.interactive_metadata?.next_messages &&
      Array.isArray(parsedJson.interactive_metadata.next_messages)
    ) {
      nextMessages = parsedJson.interactive_metadata.next_messages
    } else if (parsedJson.suggestions) {
      if (Array.isArray(parsedJson.suggestions)) {
        nextMessages = [{ type: 'suggestions', options: parsedJson.suggestions }]
      } else if (typeof parsedJson.suggestions === 'object') {
        nextMessages = [parsedJson.suggestions]
      }
    }

    if (parsedJson.next_msg && typeof parsedJson.next_msg === 'object') {
      nextMsg = parsedJson.next_msg
    }

    // Handle root-level product_card_set or suggestions if provided as standalone JSON
    if (parsedJson.type === 'product_card_set' || parsedJson.type === 'suggestions') {
      nextMsg = parsedJson as NextMessageItem
    }
  }

  // No trailing caret glyph: it renders as a black tofu box with Arabic fonts,
  // and the growing text plus the thinking line already read as "typing".
  const finalContent = content

  return {
    ulid: `provisional-${stream.streamId}`,
    type: 'message',
    content: finalContent,
    message_type: 'widget_message',
    sender_type: 'ai_agent',
    sent_at: new Date().toISOString(),
    status: 'delivered',
    is_csat_survey: false,
    widget_template: widgetTemplate,
    next_messages: nextMessages,
    next_msg: nextMsg,
  }
}

/**
 * Provisional streaming message bubble.
 *
 * Parses raw text or streamed JSON into UI properties and renders using
 * the standard AiAssistantMessage UI component.
 */
export function StreamingMessage({ stream }: StreamingMessageProps) {
  const hasText = stream.text.trim().length > 0
  const hasThinking = stream.thinking.trim().length > 0

  if (!hasText) {
    return <AiThinkingPill label={stream.thinking || undefined} />
  }

  const message = parseStreamingMessage(stream)

  return (
    <div className="animate-fade-in streaming-live flex w-full flex-col items-start gap-4 bg-transparent">
      <AiAssistantMessage message={message} isLastMessage={true} />
    </div>
  )
}
