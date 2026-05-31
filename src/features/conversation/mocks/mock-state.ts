import type { Conversation, ConversationsListResponse } from '../types/conversation'
import type { Message, MessagesListResponse } from '../types/message'
import type { SendMessageResponse } from '../types/send-message-response'
import { handleIncomingPusherMessage } from '../utils/handle-pusher-message'
import { mockMoreProductsMessage, mockProductMessage } from './mock-product-message'

// Simple in-memory mock database
class MockState {
  private conversations: Conversation[] = []
  private messagesMap: Map<string, Message[]> = new Map()

  getConversations(): ConversationsListResponse {
    return {
      data: this.conversations,
      meta: {
        page: 1,
        limit: 20,
        total: this.conversations.length,
      },
    }
  }

  getMessages(conversationId: string): MessagesListResponse {
    const messages = this.messagesMap.get(conversationId) || []
    return {
      data: messages,
      has_more: false,
    }
  }

  async sendMessage(data: { content: string; conversation_id?: string | null }): Promise<SendMessageResponse> {
    console.log('[Debugging] mockState.sendMessage starting', { data })

    // Simulate prompt sending / message creation delay of 250ms
    await new Promise((resolve) => setTimeout(resolve, 250))
    console.log('[Debugging] mockState.sendMessage delay resolved, creating messages')

    const conversationId = data.conversation_id || 'mock-conv-id'
    const messageId = `mock-msg-${Date.now()}-user`
    const botMessageId = `mock-msg-bot-${Math.random().toString(36).substring(2, 9)}`

    // 1. Create conversation if it doesn't exist
    let conversation = this.conversations.find((c) => c.ulid === conversationId)
    if (!conversation) {
      conversation = {
        ulid: conversationId,
        status: 'open',
        subject: 'Skincare Consultation',
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        last_message_preview: data.content,
        unread_count: 0,
      }
      this.conversations.push(conversation)
      this.messagesMap.set(conversationId, [])
      console.log('[Debugging] mockState created new conversation', conversationId)
    } else {
      conversation.last_message_at = new Date().toISOString()
      conversation.last_message_preview = data.content
      console.log('[Debugging] mockState updated existing conversation', conversationId)
    }

    // 2. Add user message
    const userMessage: Message = {
      ulid: messageId,
      type: 'message',
      content: data.content,
      message_type: 'text',
      sender_type: 'contact',
      sent_at: new Date().toISOString(),
      status: 'sent',
      is_csat_survey: false,
    }
    const currentMessages = this.messagesMap.get(conversationId) || []
    currentMessages.push(userMessage)

    // 3. Immediately add a pending bot message (shimmer)
    const pendingBotMessage: Message = {
      ulid: botMessageId,
      type: 'message',
      content: '',
      message_type: 'widget_message',
      sender_type: 'bot',
      sent_at: new Date().toISOString(),
      status: 'pending',
      is_csat_survey: false,
    }
    currentMessages.push(pendingBotMessage)
    this.messagesMap.set(conversationId, currentMessages)

    console.log('[Debugging] mockState notifying pusher of user and pending bot messages')
    // Notify UI of user message and pending bot message immediately
    handleIncomingPusherMessage(conversationId, {
      message: userMessage,
      conversationUlid: conversationId,
    })
    handleIncomingPusherMessage(conversationId, {
      message: pendingBotMessage,
      conversationUlid: conversationId,
    })

    // 4. Resolve the bot message after 250ms
    console.log('[Debugging] mockState scheduling bot message resolution in 250ms')
    setTimeout(() => {
      console.log('[Debugging] mockState bot resolution timeout fired')

      const isQnaResponse = data.content.startsWith('Q1:')
      const isShowMoreClick = data.content === 'Show more options 🛍️' || data.content.includes('Show more options')
      const isFeedbackClick =
        data.content === 'Best ✨' ||
        data.content === 'Good 👍' ||
        data.content === 'Bad 👎' ||
        data.content.includes('feedback') ||
        data.content.includes('Feedback')

      // Check if there is already a recommended products message in the history
      const msgsBeforeSend = this.messagesMap.get(conversationId) || []
      const hasProductsMessage = msgsBeforeSend.some((m) => {
        if (m.ulid === 'mock-product-msg-id') return true
        if (m.next_messages && m.next_messages.some((nm) => nm.type === 'product_card_set')) return true
        return false
      })

      let resolvedBotMessage: Message

      if (isFeedbackClick) {
        resolvedBotMessage = {
          ulid: botMessageId,
          type: 'message',
          content: 'Thank you for your feedback',
          message_type: 'widget_message',
          sender_type: 'bot',
          sent_at: new Date().toISOString(),
          status: 'sent',
          sender_name: 'Assistant',
          is_csat_survey: false,
        }
        console.log('[Debugging] mockState resolving message to feedback thank you')
      } else if (isShowMoreClick) {
        resolvedBotMessage = {
          ...mockMoreProductsMessage,
          ulid: botMessageId,
          sent_at: new Date().toISOString(),
        }
        console.log('[Debugging] mockState resolving message to mockMoreProductsMessage')
      } else if (isQnaResponse) {
        resolvedBotMessage = {
          ...mockProductMessage,
          ulid: botMessageId,
          sent_at: new Date().toISOString(),
        }
        console.log('[Debugging] mockState resolving message to mockProductMessage')
      } else if (hasProductsMessage) {
        resolvedBotMessage = {
          ulid: botMessageId,
          type: 'message',
          content: 'You are very welcome! Could you please share your feedback with us?',
          message_type: 'widget_message',
          sender_type: 'bot',
          sent_at: new Date().toISOString(),
          status: 'sent',
          sender_name: 'Assistant',
          is_csat_survey: false,
          next_messages: [
            {
              type: 'suggestions',
              options: ['Best ✨', 'Good 👍', 'Bad 👎'],
            },
          ],
        }
        console.log('[Debugging] mockState resolving message to feedback request suggestions')
      } else {
        resolvedBotMessage = {
          ulid: botMessageId,
          type: 'message',
          content: 'Great, let me ask you a few quick questions to personalize your experience.',
          message_type: 'widget_message',
          sender_type: 'bot',
          sent_at: new Date().toISOString(),
          status: 'sent',
          sender_name: 'Assistant',
          is_csat_survey: false,
          next_messages: [
            {
              type: 'question',
              question: "What's your skin type?",
              input_type: 'single',
              options: ['Dry', 'Oily', 'Combination', 'Normal', 'Sensitive', 'Not sure'],
            },
            {
              type: 'question',
              question: 'What are you mainly looking for on offer?',
              input_type: 'multi',
              options: [
                'Face cleanser',
                'Moisturizer',
                'Serum',
                'Eye cream',
                'Acne treatment',
                'Anti-aging',
                'Sunscreen',
              ],
            },
            {
              type: 'question',
              question: 'Do you have a budget range for each product?',
              input_type: 'single',
              options: ['Under 10 KWD', '10–20 KWD', '20–35 KWD', "Doesn't matter, just best value"],
            },
          ],
        }
        console.log('[Debugging] mockState resolving message to onboarding questions')
      }

      // Replace the pending message in local storage
      const msgs = this.messagesMap.get(conversationId) || []
      const idx = msgs.findIndex((m) => m.ulid === botMessageId)
      if (idx !== -1) {
        msgs[idx] = resolvedBotMessage
        console.log('[Debugging] mockState replaced pending bot message in messagesMap')
      } else {
        console.warn('[Debugging] mockState bot message not found in messagesMap!')
      }
      this.messagesMap.set(conversationId, msgs)

      console.log('[Debugging] mockState notifying pusher of resolved bot message')
      // Notify UI of resolved bot message
      handleIncomingPusherMessage(conversationId, {
        message: resolvedBotMessage,
        conversationUlid: conversationId,
      })

      // Update the last message in the conversation representation
      const conv = this.conversations.find((c) => c.ulid === conversationId)
      if (conv) {
        conv.last_message_at = new Date().toISOString()
        conv.last_message_preview = resolvedBotMessage.content
        console.log('[Debugging] mockState updated conversation last_message preview')
      }

      // If user provided feedback, return to intro and reset cycle after 1000ms
      if (isFeedbackClick) {
        console.log('[Debugging] mockState feedback submitted, scheduling return to intro in 1000ms')
        setTimeout(() => {
          if (typeof window !== 'undefined' && (window as any).mockNavigateToIntro) {
            console.log('[Debugging] Returning to intro and resetting mockState')
            ;(window as any).mockNavigateToIntro()
            this.reset()
          }
        }, 1000)
      }
    }, 800)

    console.log('[Debugging] mockState returning sendMessageResponse')
    return {
      message_id: messageId,
      conversation_id: conversationId,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }
  }

  reset() {
    this.conversations = []
    this.messagesMap.clear()
  }
}

export const mockState = new MockState()

