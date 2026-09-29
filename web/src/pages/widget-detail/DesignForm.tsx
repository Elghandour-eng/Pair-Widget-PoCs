import { Download } from 'lucide-react'
import { Select } from '@/components/Select'
import { MediaInput } from '@/components/MediaInput'
import { SectionHead } from '@/components/ui'
import { type WidgetConfig } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

/** Structured editor for the most-used design fields. Everything else stays untouched in the JSON. */
export function DesignForm({
  value,
  onChange,
  disabled,
  onSeedFromLive,
  invalid,
}: {
  value: WidgetConfig | null
  onChange: (v: WidgetConfig) => void
  disabled: boolean
  onSeedFromLive?: () => void
  invalid: string | null
}) {
  const { t } = useI18n()

  if (invalid) return <p className="callout border-alert text-alert">{t('form.invalid', { error: invalid })}</p>
  if (!value || Object.keys(value).length === 0) {
    return (
      <div className="anim-rise rounded-lg border border-dashed border-line p-8 text-center">
        <p className="font-bold text-ink">{t('form.empty.title')}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-[1.6] text-muted">{t('form.empty.hint')}</p>
        {onSeedFromLive && (
          <button className="btn-ghost mt-4" onClick={onSeedFromLive} disabled={disabled}>
            <Download className="size-4" />
            {t('form.empty.seed')}
          </button>
        )}
      </div>
    )
  }

  const v = value as Record<string, any>
  const set = (path: string, val: unknown) => {
    const next = structuredClone(v)
    const parts = path.split('.')
    let cur: any = next
    for (const p of parts.slice(0, -1)) {
      if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}
      cur = cur[p]
    }
    cur[parts.at(-1)!] = val
    onChange(next)
  }
  const get = (path: string): any => path.split('.').reduce<any>((a, k) => (a && typeof a === 'object' ? a[k] : undefined), v)

  const F = ({ label, path, type = 'text', placeholder }: { label: string; path: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        {type === 'color' && (
          <input
            type="color"
            className="h-[42px] w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1 transition-colors duration-200 hover:border-accent-300"
            value={/^#[0-9a-f]{6}$/i.test(get(path) ?? '') ? get(path) : '#4d98e2'}
            onChange={(e) => set(path, e.target.value)}
            disabled={disabled}
            aria-label={label}
          />
        )}
        <input className={`input ${type === 'color' ? 'mono' : ''}`} dir={type === 'color' || placeholder?.startsWith('http') ? 'ltr' : undefined} placeholder={placeholder} value={get(path) ?? ''} onChange={(e) => set(path, e.target.value)} disabled={disabled} />
      </div>
    </div>
  )

  const Toggle = ({ label, path }: { label: string; path: string }) => (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface/60 px-3.5 py-2.5 text-[12.5px] font-bold text-ink transition-all duration-200 hover:border-accent-300 hover:bg-white">
      {label}
      <input type="checkbox" className="size-4 shrink-0 accent-[#4d98e2]" checked={get(path) !== false && get(path) !== undefined ? !!get(path) : false} onChange={(e) => set(path, e.target.checked)} disabled={disabled} />
    </label>
  )

  const Sel = ({ label, path, options }: { label: string; path: string; options: string[] }) => (
    <div>
      <label className="label">{label}</label>
      <Select
        label={label}
        value={get(path) ?? ''}
        onChange={(v) => set(path, v)}
        disabled={disabled}
        placeholder={t('common.none')}
        options={options.map((o) => ({ value: o, label: o.replace(/_/g, ' ') }))}
      />
    </div>
  )

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('form.brand')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.name')} path="name" />
          <F label={t('form.color')} path="widget_color" type="color" placeholder="#E50914" />
          <LocaleToggle value={get('locale')} onChange={(l) => set('locale', l)} disabled={disabled} />
          <div className="sm:col-span-2">
            <MediaInput label={t('form.avatar')} value={get('avatar_url') ?? ''} onChange={(v) => set('avatar_url', v)} disabled={disabled} />
          </div>
          <div className="sm:col-span-2">
            <MediaInput label={t('form.launcherIcon')} value={get('launcher_icon_url') ?? ''} onChange={(v) => set('launcher_icon_url', v)} disabled={disabled} />
          </div>
        </div>
      </section>

      <section>
        <SectionHead>{t('form.header')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.headerTitle')} path="widget_v2_config.header.content.title" />
          <F label={t('form.headerSubtitle')} path="widget_v2_config.header.content.subtitle" />
          <F label={t('form.headerBg')} path="widget_v2_config.header.background.color" type="color" />
          <div className="grid content-end gap-2">
            <Toggle label={t('form.headerShow')} path="widget_v2_config.header.enabled" />
            <Toggle label={t('form.headerBgOn')} path="widget_v2_config.header.background.enabled" />
          </div>
          <div className="sm:col-span-2">
            <MediaInput label={t('form.headerLogo')} value={get('widget_v2_config.header.icon') ?? ''} onChange={(v) => set('widget_v2_config.header.icon', v)} disabled={disabled} />
          </div>
        </div>
      </section>

      <section>
        <SectionHead>{t('form.intro')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.welcomeTitle')} path="widget_v2_config.intro_screen.welcomeTitle.text" />
          <F label={t('form.welcomeSubtitle')} path="widget_v2_config.intro_screen.welcomeSubtitle.text" />
          <F label={t('form.widgetBg')} path="widget_v2_config.intro_screen.widgetBackground.background" type="color" />
          <div className="sm:col-span-2">
            <MediaInput
              label={t('form.heroUrl')}
              value={get('widget_v2_config.intro_screen.heroSection.heroImage.url') ?? ''}
              onChange={(v) => set('widget_v2_config.intro_screen.heroSection.heroImage.url', v)}
              disabled={disabled}
            />
          </div>
          <Toggle label={t('form.heroShow')} path="widget_v2_config.intro_screen.heroSection.enabled.value" />
          <Toggle label={t('form.introShow')} path="widget_v2_config.intro_screen.showIntroScreen.value" />
        </div>
      </section>

      <section>
        <SectionHead>{t('form.input')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.placeholder')} path="widget_v2_config.chat_input.placeholderText.text" />
          <Sel label={t('form.inputLayout')} path="widget_v2_config.chat_input.inputLayout.type" options={['floating_pill', 'full_width_bar']} />
          <Sel label={t('form.launcherStyle')} path="launcher_style" options={['standard', 'expanded_bubble', 'chat_icon', 'icon_only']} />
          <Sel label={t('form.launcherPosition')} path="launcher_position" options={['right', 'left']} />
          <Toggle label={t('form.voice')} path="widget_v2_config.chat_input.inputActions.voiceMessages" />
          <Toggle label={t('form.poweredBy')} path="powered_by_pair_ai" />
        </div>
      </section>

      <section>
        <SectionHead>{t('form.sections')}</SectionHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label={t('form.quickLinks')} path="widget_v2_config.quick_links.showQuickLinks.value" />
          <Toggle label={t('form.trending')} path="widget_v2_config.trending_prompts.showTrendingPrompts.value" />
          <div className="sm:col-span-2">
            <F label={t('form.promptsTitle')} path="widget_v2_config.trending_prompts.displaySettings.sectionTitle" />
          </div>
        </div>
        <p className="callout mt-3.5">{t('form.sectionsNote')}</p>
      </section>

      <section>
        <SectionHead>{t('form.messages')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.userBubbleBg')} path="widget_v2_config.messages.userBubble.background" type="color" />
          <F label={t('form.userBubbleText')} path="widget_v2_config.messages.userBubble.color" type="color" />
          <F label={t('form.agentText')} path="widget_v2_config.messages.agentMessage.color" type="color" />
          <F label={t('form.bubbleRadius')} path="widget_v2_config.messages.userBubble.borderRadius" placeholder="10px" />
          <div className="sm:col-span-2">
            <MediaInput label={t('form.agentIcon')} value={get('widget_v2_config.messages.aiMessages.iconUrl') ?? ''} onChange={(v) => set('widget_v2_config.messages.aiMessages.iconUrl', v)} disabled={disabled} />
          </div>
        </div>
      </section>

      <section>
        <SectionHead>{t('form.typography')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.fontFamily')} path="styles.fontFamily" placeholder="Montserrat, sans-serif" />
          <F label={t('form.fontSize')} path="styles.fontSize" placeholder="14px" />
          <F label={t('form.radius')} path="styles.borderRadius" placeholder="10px" />
          <F label={t('form.launcherSize')} path="launcher_size" placeholder="56" />
        </div>
      </section>
    </div>
  )
}

/** Widget language: Kuwaiti flag for Arabic, US flag for English, or both. */
const LOCALE_CHOICES = [
  { value: 'en', flag: '🇺🇸', key: 'locale.en' },
  { value: 'ar', flag: '🇰🇼', key: 'locale.ar' },
  { value: 'both', flag: '🇺🇸🇰🇼', key: 'locale.both' },
] as const

function LocaleToggle({ value, onChange, disabled }: { value: unknown; onChange: (v: string) => void; disabled: boolean }) {
  const { t } = useI18n()
  const raw = typeof value === 'string' ? value : 'en'
  const current = raw === 'both' ? 'both' : /^ar/i.test(raw) ? 'ar' : 'en'

  return (
    <div>
      <label className="label">{t('form.locale')}</label>
      <div className="flex h-[42px] rounded-lg border border-line bg-code p-0.5" role="group" aria-label={t('form.locale')}>
        {LOCALE_CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            disabled={disabled}
            aria-pressed={current === c.value}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[12px] font-bold transition-all duration-200 disabled:cursor-not-allowed ${
              current === c.value ? 'bg-white text-accent-deep shadow-[0_1px_2px_rgba(15,18,22,0.06)]' : 'text-muted hover:text-ink disabled:opacity-40'
            }`}
          >
            <span aria-hidden>{c.flag}</span>
            {t(c.key)}
          </button>
        ))}
      </div>
    </div>
  )
}
