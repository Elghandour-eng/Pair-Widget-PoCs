import { useTemplateDesign } from './use-template-design'
import type {
  ImageCardTemplate,
  LinkCardTemplate,
  TicketCardTemplate,
  TicketListTemplate,
} from '@/features/conversation/types/message'

/**
 * The Pair plugin's components: what a plugin tool call looks like to the
 * customer. The server builds each one from the call itself — a ticket from
 * pair_create_ticket, a link from pair_send_link — so nothing here is typed by
 * the model, and a card can be trusted to say what actually happened.
 */

const PRIORITY: Record<string, { ar: string; en: string; color: string }> = {
  low: { ar: 'منخفضة', en: 'Low', color: '#6b7280' },
  medium: { ar: 'متوسطة', en: 'Medium', color: '#d97706' },
  high: { ar: 'عالية', en: 'High', color: '#dc2626' },
  urgent: { ar: 'عاجلة', en: 'Urgent', color: '#b91c1c' },
}
const STATUS: Record<string, { ar: string; en: string; color: string }> = {
  open: { ar: 'مفتوحة', en: 'Open', color: '#16a34a' },
  pending: { ar: 'قيد الإنشاء', en: 'Pending', color: '#d97706' },
  in_progress: { ar: 'قيد المعالجة', en: 'In progress', color: '#2563eb' },
  resolved: { ar: 'تم الحل', en: 'Resolved', color: '#6b7280' },
  closed: { ar: 'مغلقة', en: 'Closed', color: '#6b7280' },
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-none font-semibold"
      style={{ color, background: `${color}1f` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

const TicketIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
    <path d="M14 5v14" strokeDasharray="2 3" />
  </svg>
)

/** One ticket: the number is the thing a customer quotes later, so it leads. */
export function TicketCard({ template }: { template: TicketCardTemplate; sourceMessageUlid?: string }) {
  const d = useTemplateDesign(template.content)
  const c = template.content ?? ({} as TicketCardTemplate['content'])
  if (!c.title) return null
  const lang = d.isArabic ? 'ar' : 'en'
  const status = STATUS[c.status ?? 'open'] ?? STATUS.open
  const priority = PRIORITY[c.priority ?? '']
  return (
    <div className="mt-2 flex w-full max-w-[320px] flex-col gap-2.5 shadow-sm" dir={d.isArabic ? 'rtl' : 'ltr'} style={{ ...d.cardStyle, padding: d.padding }}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${d.accent}1a` }}>
          <TicketIcon color={d.accent} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] leading-tight" style={{ color: d.muted }}>
            {d.isArabic ? 'تذكرة دعم' : 'Support ticket'}
          </span>
          <span className="truncate text-[13px] leading-tight font-bold tabular-nums" dir="ltr" style={{ color: d.text, textAlign: d.isArabic ? 'right' : 'left' }}>
            {c.ticket_id ? `#${c.ticket_id}` : d.isArabic ? 'جاري الإنشاء…' : 'Being created…'}
          </span>
        </div>
        <Pill label={status[lang]} color={status.color} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="leading-snug font-semibold" style={{ color: d.text, fontSize: d.titleSize }}>
          {c.title}
        </span>
        {c.description && (
          <span className="text-[12.5px] leading-snug" style={{ color: d.muted }}>
            {c.description}
          </span>
        )}
      </div>
      {priority && (
        <div className="flex items-center justify-between pt-2 text-[11.5px]" style={{ borderTop: `1px solid ${d.border}`, color: d.muted }}>
          <span>{d.isArabic ? 'الأولوية' : 'Priority'}</span>
          <Pill label={priority[lang]} color={priority.color} />
        </div>
      )}
    </div>
  )
}

/** The tickets on this conversation, newest first as Pair returns them. */
export function TicketList({ template }: { template: TicketListTemplate; sourceMessageUlid?: string }) {
  const d = useTemplateDesign(template.content)
  const items = template.content?.items ?? []
  if (items.length === 0) return null
  const lang = d.isArabic ? 'ar' : 'en'
  return (
    <div className="mt-2 flex w-full max-w-[320px] flex-col shadow-sm" dir={d.isArabic ? 'rtl' : 'ltr'} style={{ ...d.cardStyle, padding: d.padding }}>
      <span className="pb-2 font-bold" style={{ color: d.text, fontSize: d.titleSize }}>
        {d.isArabic ? 'تذاكرك' : 'Your tickets'}
      </span>
      {items.map((t, i) => {
        const status = STATUS[t.status ?? 'open'] ?? STATUS.open
        return (
          <div
            key={`${t.ticket_id}-${i}`}
            className="flex items-center gap-2.5 py-2"
            style={{ borderTop: i === 0 || d.divider === 'none' ? undefined : `1px ${d.divider} ${d.border}` }}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] leading-snug font-semibold" style={{ color: d.text }}>
                {t.title || (d.isArabic ? 'تذكرة' : 'Ticket')}
              </span>
              {t.ticket_id && (
                <span className="text-[11px] tabular-nums" dir="ltr" style={{ color: d.muted, textAlign: d.isArabic ? 'right' : 'left' }}>
                  #{t.ticket_id}
                </span>
              )}
            </div>
            <Pill label={status[lang]} color={status.color} />
          </div>
        )
      })}
    </div>
  )
}

/** One link as a button, instead of a URL pasted into a sentence. */
export function LinkCard({ template }: { template: LinkCardTemplate; sourceMessageUlid?: string }) {
  const d = useTemplateDesign(template.content)
  const c = template.content ?? ({} as LinkCardTemplate['content'])
  if (!c.url) return null
  const outline = d.buttonStyle === 'outline'
  return (
    <div className="mt-2 flex w-full max-w-[320px] flex-col gap-2.5 shadow-sm" dir={d.isArabic ? 'rtl' : 'ltr'} style={{ ...d.cardStyle, padding: d.padding }}>
      {c.header && (
        <span className="leading-snug font-bold" style={{ color: d.text, fontSize: d.titleSize }}>
          {c.header}
        </span>
      )}
      {c.text && (
        <span className="text-[13px] leading-snug" style={{ color: d.muted }}>
          {c.text}
        </span>
      )}
      <a
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold transition-all hover:-translate-y-px hover:opacity-90 active:translate-y-0"
        style={{
          borderRadius: Math.max(0, d.radius - 4),
          background: outline ? 'transparent' : d.accent,
          color: outline ? d.accent : '#fff',
          border: `1px solid ${d.accent}`,
        }}
      >
        {c.cta_text || (d.isArabic ? 'افتح الرابط' : 'Open link')}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </a>
    </div>
  )
}

/** A picture with an optional caption. */
export function ImageCard({ template }: { template: ImageCardTemplate; sourceMessageUlid?: string }) {
  const d = useTemplateDesign(template.content)
  const c = template.content ?? ({} as ImageCardTemplate['content'])
  if (!c.url) return null
  return (
    <figure className="mt-2 w-full max-w-[320px] overflow-hidden shadow-sm" dir={d.isArabic ? 'rtl' : 'ltr'} style={{ ...d.cardStyle, padding: d.padding, margin: 0 }}>
      <a href={c.url} target="_blank" rel="noopener noreferrer">
        <img src={c.url} alt={c.caption ?? ''} loading="lazy" className="block w-full object-cover" style={{ aspectRatio: d.aspect }} />
      </a>
      {c.caption && (
        <figcaption className="px-3 py-2 text-[12.5px] leading-snug" style={{ color: d.text }}>
          {c.caption}
        </figcaption>
      )}
    </figure>
  )
}
