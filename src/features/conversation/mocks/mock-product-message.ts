import type { Message } from '@/features/conversation/types/message'

export const mockProductMessage: Message = {
  ulid: 'mock-product-msg-id',
  type: 'message',
  content: 'Based on your preferences, here are the top recommended products for your skin type:',
  message_type: 'widget_message',
  sender_type: 'bot',
  sent_at: new Date(Date.now() + 1000).toISOString(),
  status: 'sent',
  sender_name: 'Assistant',
  is_csat_survey: false,
  next_messages: [
    {
      type: 'product_card_set',
      header: {
        title: 'Recommended Products',
        action_text: 'View all',
      },
      view_all: {},
      cards: [
        {
          image_url: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=300&q=80',
          title: 'Vital C Hydrating Intense Moisturizer',
          sub_text: 'Intense hydration and brightening cream.',
          old_price: '$52.00',
          current_price: '$42.00',
          tag: 'Best Seller',
          buttons: [
            {
              type: 'button',
              label: 'Add to Cart',
              action_name: 'add_to_cart',
              action_ulid: 'action-1',
              parameters: {
                product_id: 'prod_vital_c',
                quantity: 1,
              },
            },
          ],
        },
        {
          image_url: 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=300&q=80',
          title: 'Hydrating Facial Mist',
          sub_text: 'Refreshing mist with aloe vera and chamomile.',
          current_price: '$24.00',
          buttons: [
            {
              type: 'button',
              label: 'Add to Cart',
              action_name: 'add_to_cart',
              action_ulid: 'action-2',
              parameters: {
                product_id: 'prod_facial_mist',
                quantity: 1,
              },
            },
          ],
        },
        {
          image_url: 'https://images.unsplash.com/photo-1556229010-aa3f7ff66b24?auto=format&fit=crop&w=300&q=80',
          title: 'Gentle Gel Cleanser',
          sub_text: 'Daily mild cleanser for sensitive skin.',
          old_price: '$28.00',
          current_price: '$20.00',
          tag: 'New',
          buttons: [
            {
              type: 'button',
              label: 'Add to Cart',
              action_name: 'add_to_cart',
              action_ulid: 'action-3',
              parameters: {
                product_id: 'prod_gel_cleanser',
                quantity: 1,
              },
            },
          ],
        },
      ],
    },
    {
      type: 'suggestions',
      text: 'Not finding the perfect match? I can help you narrow these options down, or connect you with our team.',
      options: ['Show more options 🛍️'],
    },
  ],
}

export const mockMoreProductsMessage: Message = {
  ulid: 'mock-more-products-msg-id',
  type: 'message',
  content: 'Here are some additional premium skincare options that fit your profile:',
  message_type: 'widget_message',
  sender_type: 'bot',
  sent_at: new Date(Date.now() + 2000).toISOString(),
  status: 'sent',
  sender_name: 'Assistant',
  is_csat_survey: false,
  next_messages: [
    {
      type: 'product_card_set',
      header: {
        title: 'More Options',
        action_text: 'View all',
      },
      view_all: {},
      cards: [
        {
          image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=300&q=80',
          title: 'Ageless Total Pure Hyaluronic Filler',
          sub_text: 'Formulated with six forms of hyaluronic acid to smooth skin.',
          old_price: '$68.00',
          current_price: '$58.00',
          tag: 'Popular',
          buttons: [
            {
              type: 'button',
              label: 'Add to Cart',
              action_name: 'add_to_cart',
              action_ulid: 'action-more-1',
              parameters: {
                product_id: 'prod_hyaluronic_filler',
                quantity: 1,
              },
            },
          ],
        },
        {
          image_url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=300&q=80',
          title: 'Prevention+ Daily Matte Moisturizer SPF 30',
          sub_text: 'Oil-free, broad-spectrum UVA/UVB protection.',
          current_price: '$38.00',
          buttons: [
            {
              type: 'button',
              label: 'Add to Cart',
              action_name: 'add_to_cart',
              action_ulid: 'action-more-2',
              parameters: {
                product_id: 'prod_matte_spf',
                quantity: 1,
              },
            },
          ],
        },
      ],
    },
  ],
}
