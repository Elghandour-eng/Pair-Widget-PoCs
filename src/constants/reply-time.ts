export type ReplyTime = 'in_a_few_hours' | 'in_a_few_minutes' | 'in_a_day'

export const REPLY_TIME_MAP: Record<ReplyTime, string> = {
  in_a_few_hours: 'Typically replies in a few hours',
  in_a_few_minutes: 'Typically replies in a few minutes',
  in_a_day: 'Typically replies in a day',
} as const

export const replyTimeMap = REPLY_TIME_MAP
