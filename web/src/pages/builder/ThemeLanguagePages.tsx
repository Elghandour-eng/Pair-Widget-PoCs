import { Moon, Sun } from 'lucide-react'
import { SectionHead } from '@/components/ui'
import { type WidgetConfig } from '@/lib/api'
import { applyLanguage, applyTheme, currentLang, currentTheme, type ThemeName, type WidgetLang } from '@/lib/builder'
import { useI18n } from '@/lib/i18n'
import { ColorField, Field, FontField, type PageProps } from './fields'

export function ThemePage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const active = currentTheme(draft)
  const apply = (theme: ThemeName) => setDraft((d) => (d ? applyTheme(d, theme) : d))

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.theme.presets')}</SectionHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <ThemeCard name="dark" active={active === 'dark'} onClick={() => apply('dark')} disabled={disabled} label={t('builder.theme.dark')} note={t('builder.theme.darkNote')} />
          <ThemeCard name="light" active={active === 'light'} onClick={() => apply('light')} disabled={disabled} label={t('builder.theme.light')} note={t('builder.theme.lightNote')} />
        </div>
        <p className="callout mt-3.5">{t('builder.theme.note')}</p>
      </section>
      <section>
        <SectionHead>{t('form.brand')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('form.name')} path="name" get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.color')} path="widget_color" get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.widgetBg')} path="widget_v2_config.intro_screen.widgetBackground.background" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.theme.fontPreset')} path="styles.fontFamily" get={get} set={set} disabled={disabled} />
        </div>
      </section>
    </div>
  )
}

function ThemeCard({ name, active, onClick, disabled, label, note }: { name: ThemeName; active: boolean; onClick: () => void; disabled: boolean; label: string; note: string }) {
  const darkChip = name === 'dark'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`card lift flex items-center gap-3.5 p-4 text-start transition-all duration-200 ${active ? 'ring-2 ring-accent' : ''}`}
    >
      <span
        className="grid size-12 shrink-0 place-items-center rounded-xl border"
        style={{ background: darkChip ? '#000000' : '#FFFFFF', borderColor: darkChip ? '#2C2C2E' : '#E5E5EA', color: darkChip ? '#FFFFFF' : '#000000' }}
      >
        {darkChip ? <Moon className="size-5" /> : <Sun className="size-5" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-ink">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-[1.5] text-muted">{note}</span>
      </span>
    </button>
  )
}

export function LanguagePage({ draft, setDraft, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void; disabled: boolean }) {
  const { t } = useI18n()
  const active = currentLang(draft)
  const apply = (lang: WidgetLang) => setDraft((d) => (d ? applyLanguage(d, lang) : d))

  return (
    <div className="space-y-5">
      <section>
        <SectionHead>{t('builder.lang.title')}</SectionHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <LangCard flag="🇺🇸" label={t('locale.en')} note={t('builder.lang.enNote')} active={active === 'en'} onClick={() => apply('en')} disabled={disabled} />
          <LangCard flag="🇰🇼" label={t('locale.ar')} note={t('builder.lang.arNote')} active={active === 'ar'} onClick={() => apply('ar')} disabled={disabled} />
        </div>
      </section>
      <p className="callout">{t('builder.lang.note')}</p>
    </div>
  )
}

function LangCard({ flag, label, note, active, onClick, disabled }: { flag: string; label: string; note: string; active: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={active} className={`card lift flex items-center gap-3.5 p-4 text-start transition-all duration-200 ${active ? 'ring-2 ring-accent' : ''}`}>
      <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-[22px]" aria-hidden>{flag}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-ink">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-[1.5] text-muted">{note}</span>
      </span>
    </button>
  )
}
