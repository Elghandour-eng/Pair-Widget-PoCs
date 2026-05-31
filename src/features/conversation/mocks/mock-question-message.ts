import type { Message } from '@/features/conversation/types/message'

export const mockQuestionMessage: Message = {
  ulid: 'mock-question-msg-id',
  type: 'message',
  content: 'Great, let me ask you a few quick questions to personalize your experience.',
  message_type: 'widget_message',
  sender_type: 'bot',
  sent_at: new Date(Date.now() + 2000).toISOString(),
  status: 'sent',
  sender_name: 'Assistant',
  is_csat_survey: false,
  next_messages: [
    {
      type: 'question',
      question: 'What is your primary skin goal?',
      input_type: 'single',
      options: ['Hydration', 'Brightening', 'Anti-aging', 'Acne Control'],
    },
    {
      type: 'question',
      question: 'What is your skin type?',
      input_type: 'single',
      options: ['Dry', 'Oily', 'Combination', 'Sensitive'],
    },
    {
      type: 'question',
      question: 'Do you have any specific concerns?',
      input_type: 'multi',
      options: ['Dark Circles', 'Acne & Breakouts', 'Redness', 'Fine Lines'],
    },
  ],
}
