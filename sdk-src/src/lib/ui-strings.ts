/**
 * The widget's own few interface strings — the ones not carried by the config
 * (which brings all designed copy already translated). They follow the config
 * locale, so an Arabic widget never says "Sending…".
 */

const STRINGS = {
  en: {
    sending: 'Sending…',
    sendingPart: 'Sending {c}/{t}…',
    processing: 'Processing audio…',
    csatHeader: 'Customer Satisfaction Survey',
    csatBody: 'How was your experience?',
    csatButton: 'Rate Experience',
    csatChange: 'Change Rating',
    csatSubmit: 'Submit Feedback',
    phEmail: 'name@example.com',
    phName: 'Your full name',
    phPhone: 'Mobile number',
    phText: 'Type here…',
    generating: 'Generating…',
    submitting: 'Submitting…',
    loadingOlder: 'Loading older messages…',
    csatOpt1: 'Very dissatisfied with the service',
    csatOpt2: 'Dissatisfied with the service',
    csatOpt3: 'Neutral about the service',
    csatOpt4: 'Satisfied with the service',
    csatOpt5: 'Very satisfied with the service',
  },
  ar: {
    sending: 'جاري الإرسال…',
    sendingPart: 'جاري إرسال {c}/{t}…',
    processing: 'جاري معالجة الصوت…',
    csatHeader: 'استبيان رضا العملاء',
    csatBody: 'كيف كانت تجربتك؟',
    csatButton: 'قيّم تجربتك',
    csatChange: 'تغيير التقييم',
    csatSubmit: 'إرسال التقييم',
    phEmail: 'بريدك الإلكتروني',
    phName: 'اسمك الكامل',
    phPhone: 'رقم الموبايل',
    phText: 'اكتب هنا…',
    generating: 'جاري الكتابة…',
    submitting: 'جاري الإرسال…',
    loadingOlder: 'جاري تحميل الرسائل الأقدم…',
    csatOpt1: 'غير راضٍ تماماً عن الخدمة',
    csatOpt2: 'غير راضٍ عن الخدمة',
    csatOpt3: 'محايد تجاه الخدمة',
    csatOpt4: 'راضٍ عن الخدمة',
    csatOpt5: 'راضٍ تماماً عن الخدمة',
  },
} as const

export type UiStringKey = keyof (typeof STRINGS)['en']

/** Other spellings the backend uses for the same stock string. */
const ALIASES: Partial<Record<UiStringKey, string[]>> = {
  csatButton: ['submit', 'rate', 'rate experience'],
  csatSubmit: ['submit', 'submit feedback'],
  csatBody: ['how was your experience', 'how was your experience?'],
  csatHeader: ['customer satisfaction survey', 'csat survey'],
  loadingOlder: ['loading older messages...', 'loading older messages'],
  csatOpt1: ['very dissatisfied', 'very unsatisfied', 'very unsatisfied with the service'],
  csatOpt2: ['dissatisfied', 'unsatisfied', 'unsatisfied with the service'],
  csatOpt3: ['neutral', 'neutral about service'],
  csatOpt4: ['satisfied'],
  csatOpt5: ['very satisfied'],
}

/** The backend's own English default, localized when the widget is not in English. */
export function localizeDefault(locale: string | undefined, value: string | undefined, key: UiStringKey): string {
  const v = (value ?? '').trim()
  if (!v) return uiText(locale, key)
  // Only the known stock strings are swapped; anything the channel authored stays.
  if (v === STRINGS.en[key]) return uiText(locale, key)
  if ((ALIASES[key] ?? []).includes(v.toLowerCase())) return uiText(locale, key)
  return v
}

export function uiText(locale: string | undefined, key: UiStringKey, vars?: Record<string, string | number>): string {
  const table = /^ar/i.test(locale ?? 'en') ? STRINGS.ar : STRINGS.en
  let out: string = table[key]
  for (const [k, v] of Object.entries(vars ?? {})) out = out.replace(`{${k}}`, String(v))
  return out
}

/** The "new messages" pill: "1 new message" / "رسالة جديدة", with Arabic's own plural forms. */
export function newMessagesText(locale: string | undefined, count: number): string {
  if (!/^ar/i.test(locale ?? 'en')) return `${count} new ${count === 1 ? 'message' : 'messages'}`
  if (count === 1) return 'رسالة جديدة'
  if (count === 2) return 'رسالتان جديدتان'
  if (count <= 10) return `${count} رسائل جديدة`
  return `${count} رسالة جديدة`
}
