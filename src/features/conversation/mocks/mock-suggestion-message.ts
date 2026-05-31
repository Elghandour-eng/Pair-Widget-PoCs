import type { Message } from '@/features/conversation/types/message'

export const mockSuggestionMessage: Message = {
  ulid: 'mock-suggestion-msg-id',
  type: 'message',
  content:
    "I see you're looking for alternatives to the Vital C Hydrating Intense Moisturizer. It's a great choice for brightening and hydration. Here are some good matches for you:\n\nI see you're looking for alternatives to the **Vital C Hydrating Intense Moisturizer**. It's a great choice for brightening and hydration. Here are some good matches for you:selected based on ratings.",
  message_type: 'widget_message',
  sender_type: 'bot',
  sent_at: new Date().toISOString(),
  status: 'sent',
  sender_name: 'Assistant',
  is_csat_survey: false,
  next_messages: [
    {
      type: 'suggestions',
      options: [
        'Track my order 📦',
        {
          type: 'action',
          label: 'Search for products 🔍',
          action_name: 'product_search',
          parameters: { query: '' },
        },
        'Speak to a human 💬',
      ],
    },
  ],
}
