import type { CSSProperties } from 'react'
import { ArrowUp, Mic, Plus } from 'lucide-react'
import type { WidgetConfig } from '@/lib/api'

/**
 * Lightweight visual preview of a Pair widget config.
 * Reads the same fields the real widget reads (widget_v2_config.*), so a designer sees the effect of a change immediately.
 * It is intentionally approximate: the real widget is the source of truth.
 */
type Any = Record<string, any>
const get = (o: unknown, path: string): any => path.split('.').reduce<any>((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), o)

export function WidgetPreview({ config, dark }: { config: WidgetConfig | null; dark?: boolean }) {
  if (!config) return <div className="flex h-full items-center justify-center text-sm text-ink-300">No config to preview</div>
  const c = config as Any
  const v2: Any = c.widget_v2_config ?? {}
  const brand: string = c.widget_color || '#2f80ed'
  const bg = get(v2, 'intro_screen.widgetBackground.background') || (dark ? '#0b0b0d' : '#ffffff')
  const headerEnabled = get(v2, 'header.enabled') !== false
  const headerBg = get(v2, 'header.background.enabled') ? get(v2, 'header.background.color') : 'transparent'
  const title = get(v2, 'header.content.title') || c.name || 'Widget'
  const subtitle = get(v2, 'header.content.subtitle') || ''
  const heroUrl = get(v2, 'intro_screen.heroSection.heroImage.url')
  const heroEnabled = get(v2, 'intro_screen.heroSection.enabled.value') !== false
  const welcomeTitle = get(v2, 'intro_screen.welcomeTitle.text') || c.welcome_title || ''
  const welcomeSub = get(v2, 'intro_screen.welcomeSubtitle.text') || c.welcome_tagline || ''
  const quickLinks: Any[] = get(v2, 'quick_links.showQuickLinks.value') === false ? [] : (get(v2, 'quick_links.quickLinkCards') ?? []).filter((q: Any) => q.active !== false)
  const prompts: Any[] = get(v2, 'trending_prompts.showTrendingPrompts.value') === false ? [] : (get(v2, 'trending_prompts.promptChips') ?? [])
  const promptTitle = get(v2, 'trending_prompts.displaySettings.sectionTitle') || 'Try asking'
  const placeholder = get(v2, 'chat_input.placeholderText.text') || 'Ask me anything…'
  const inputLayout = get(v2, 'chat_input.inputLayout.type') || 'floating_pill'
  const voice = get(v2, 'chat_input.inputActions.voiceMessages') !== false
  const poweredBy = c.powered_by_pair_ai !== false
  const isDark = dark || isDarkColor(bg)
  const fg = isDark ? '#f5f5f5' : '#111'
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)'
  const surface = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const titleStyle: CSSProperties = { ...(get(v2, 'header.titleStyle') ?? {}) }
  const cardStyle: CSSProperties = { ...(get(v2, 'quick_links.cardStyle') ?? {}) }
  const chipStyle: CSSProperties = { ...(get(v2, 'trending_prompts.chipStyle') ?? {}) }

  return (
    <div className="mx-auto flex h-[640px] w-[340px] flex-col overflow-hidden rounded-[28px] shadow-[0_30px_60px_-20px_rgba(15,27,45,0.45)] ring-8 ring-ink-900/90" style={{ background: bg, color: fg, fontFamily: c.styles?.fontFamily }}>
      {headerEnabled && (
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: headerBg }}>
          <span className="text-lg leading-none" style={{ color: muted }}>×</span>
          {c.avatar_url ? <img src={c.avatar_url} alt="" className="size-6 rounded-full object-cover" /> : <span className="size-6 rounded-full" style={{ background: brand }} />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold" style={titleStyle}>{title}</p>
            {subtitle && <p className="truncate text-[10px]" style={{ color: muted }}>{subtitle}</p>}
          </div>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: surface }}>عربي</span>
          <span className="text-base leading-none" style={{ color: muted }}>⋮</span>
        </div>
      )}
      <div className="flex-1 space-y-4 overflow-hidden px-3 pt-2">
        {heroEnabled && (
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl" style={{ background: heroUrl ? undefined : `linear-gradient(135deg, ${brand}, ${shade(brand, -40)})` }}>
            {heroUrl && <img src={heroUrl} alt="" className="absolute inset-0 size-full object-cover" />}
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
              <p className="text-base font-extrabold leading-tight">{welcomeTitle || 'Your assistant, one message away'}</p>
              {welcomeSub && <p className="mt-0.5 line-clamp-2 text-[10px] opacity-90">{welcomeSub}</p>}
            </div>
          </div>
        )}
        {!heroEnabled && welcomeTitle && (
          <div><p className="text-lg font-extrabold leading-tight">{welcomeTitle}</p>{welcomeSub && <p className="text-xs" style={{ color: muted }}>{welcomeSub}</p>}</div>
        )}
        {quickLinks.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-bold"><span style={{ color: brand }}>‹</span>What I can help with</p>
            <div className="flex gap-2 overflow-hidden">
              {quickLinks.slice(0, 3).map((q, i) => (
                <div key={q.id ?? i} className="w-[150px] shrink-0 overflow-hidden rounded-xl" style={{ background: surface, ...cardStyle }}>
                  <div className="h-20" style={{ background: q.url ? `url(${q.url}) center/cover` : `linear-gradient(135deg, ${shade(brand, 20)}, ${brand})` }} />
                  <div className="p-2"><p className="truncate text-[11px] font-bold">{q.title}</p><p className="line-clamp-2 text-[9px]" style={{ color: muted }}>{q.subtitle}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
        {prompts.length > 0 && (
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: muted }}>{promptTitle}</p>
            <div className="flex flex-col items-start gap-1.5">
              {prompts.slice(0, 3).map((p, i) => (
                <span key={i} className="rounded-full border px-3 py-1.5 text-[11px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)', ...chipStyle }}>
                  <span style={{ color: brand }}>✦ </span>{p.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-3 pb-2 pt-2">
        <div className={`flex items-center gap-2 px-3 py-2.5 ${inputLayout === 'full_width_bar' ? 'rounded-xl' : 'rounded-full'}`} style={{ background: surface }}>
          <Plus className="size-4" style={{ color: muted }} />
          <span className="flex-1 truncate text-xs" style={{ color: muted }}>{placeholder}</span>
          {voice && <Mic className="size-4" style={{ color: muted }} />}
          <span className="flex size-7 items-center justify-center rounded-full" style={{ background: brand }}><ArrowUp className="size-3.5 text-white" /></span>
        </div>
        {poweredBy && <p className="mt-1.5 text-center text-[9px]" style={{ color: muted }}>Powered by <b>Pair</b></p>}
      </div>
    </div>
  )
}

function isDarkColor(input: string): boolean {
  const m = /#([0-9a-f]{6})/i.exec(input)
  if (!m) return /black|#000|rgb\(0/i.test(input)
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}
function shade(hex: string, amt: number): string {
  const m = /#([0-9a-f]{6})/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const cl = (v: number) => Math.max(0, Math.min(255, v))
  const r = cl(((n >> 16) & 255) + amt), g = cl(((n >> 8) & 255) + amt), b = cl((n & 255) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
