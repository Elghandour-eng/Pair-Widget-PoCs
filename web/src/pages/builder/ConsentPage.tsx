import { Plus, Trash2 } from 'lucide-react'
import { IconField } from '@/components/IconField'
import { Disclosure, SectionHead } from '@/components/ui'
import { type WidgetConfig } from '@/lib/api'
import { currentLang, type WidgetLang } from '@/lib/builder'
import { FONT_WEIGHTS } from '@/lib/inputDesign'
import { useI18n } from '@/lib/i18n'
import {
  ChoiceField, ColorField, Field, ItemBiInputs, NumField, PlainBiField, ToggleField, type PageProps,
} from './fields'

const CS = 'widget_v2_config.consent_screen'
const CSD = `${CS}.design`

type ConsentPointRow = { icon: string; text: string; i18n?: Partial<Record<WidgetLang, { text?: string }>> }

const CS_DEFAULT_POINTS: ConsentPointRow[] = [
  { icon: 'chat-text', text: 'This assistant helps you discover films, get recommendations and track bookings.' },
  { icon: 'alert', text: 'AI suggestions may occasionally be incorrect. Please review details before purchasing.' },
  { icon: 'shield', text: 'Your interactions may be used to improve recommendations and your experience.' },
]

/**
 * The welcome gate page: the consent sheet's copy, its points (each with an
 * icon), and the design of the sheet, texts and agree button.
 */
export function ConsentPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const live = currentLang(draft)
  const stored = get(`${CS}.points`)
  const points: ConsentPointRow[] = Array.isArray(stored) && stored.length ? stored : CS_DEFAULT_POINTS
  const write = (next: ConsentPointRow[]) => set(`${CS}.points`, next)
  const patchPoint = (i: number, patch: Partial<ConsentPointRow>) =>
    write(points.map((pt, j) => (j === i ? { ...pt, ...patch } : pt)))
  const writePointText = (i: number, lang: WidgetLang, v: string) =>
    write(points.map((pt, j) => {
      if (j !== i) return pt
      const next: ConsentPointRow = { ...pt, i18n: { ...(pt.i18n ?? {}), [lang]: { text: v } } }
      if (live === lang) next.text = v
      return next
    }))

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.section.consent')}</SectionHead>
        <p className="callout mb-4">{t('builder.cs.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.cs.enable')} path={`${CS}.enabled`} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.cs.illustration')} path={`${CSD}.showIllustration`} get={get} set={set} disabled={disabled} />
          <PlainBiField label={t('builder.cs.title')} path={`${CS}.title`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Welcome to your AI Assistant" />
          <PlainBiField label={t('builder.cs.subtitle')} path={`${CS}.subtitle`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="A few things to keep in mind" />
          <PlainBiField label={t('builder.cs.footnote')} path={`${CS}.footnote`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="By continuing, you agree to our" />
          <PlainBiField label={t('builder.cs.buttonText')} path={`${CS}.buttonText`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Agree & Continue" />
        </div>
      </section>

      <section>
        <SectionHead>{t('builder.cs.points')}</SectionHead>
        <div className="space-y-3">
          {points.map((pt, i) => (
            <div key={i} className="card space-y-3 p-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <IconField
                  label={t('builder.pc.field.label')} set="consent"
                  value={pt.icon} url={undefined}
                  onChange={(v) => patchPoint(i, { icon: v })} onUrlChange={() => {}}
                  disabled={disabled}
                />
                <div className="flex items-end gap-2">
                  <button
                    className="btn-ghost btn-sm ms-auto"
                    onClick={() => write(points.filter((_, j) => j !== i))}
                    disabled={disabled || points.length <= 1}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="label">{t('builder.cs.point.text')}</label>
                <ItemBiInputs live={live} textarea value={pt.text} i18n={{ en: pt.i18n?.en?.text, ar: pt.i18n?.ar?.text }}
                  onWrite={(lang, v) => writePointText(i, lang, v)} disabled={disabled} />
              </div>
            </div>
          ))}
          <button className="btn-ghost btn-sm" onClick={() => write([...points, { icon: 'info', text: '' }])} disabled={disabled || points.length >= 6}>
            <Plus className="size-4" />
            {t('builder.cs.addPoint')}
          </button>
        </div>
      </section>

      <Disclosure summary={t('builder.cs.links')}>
        <p className="callout mb-4">{t('builder.cs.links.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={`${t('builder.cs.links.terms')} — ${t('builder.cs.links.show')}`} path={`${CS}.links.terms.show`} get={get} set={set} disabled={disabled} />
          <ToggleField label={`${t('builder.cs.links.privacy')} — ${t('builder.cs.links.show')}`} path={`${CS}.links.privacy.show`} get={get} set={set} disabled={disabled} />
          <PlainBiField label={`${t('builder.cs.links.terms')} — ${t('builder.cs.links.label')}`} path={`${CS}.links.terms.label`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Terms of Use" />
          <Field label={`${t('builder.cs.links.terms')} — ${t('builder.cs.links.url')}`} path={`${CS}.links.terms.url`} get={get} set={set} disabled={disabled} placeholder="https://…" />
          <PlainBiField label={`${t('builder.cs.links.privacy')} — ${t('builder.cs.links.label')}`} path={`${CS}.links.privacy.label`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Privacy Policy" />
          <Field label={`${t('builder.cs.links.privacy')} — ${t('builder.cs.links.url')}`} path={`${CS}.links.privacy.url`} get={get} set={set} disabled={disabled} placeholder="https://…" />
          <ColorField label={t('builder.cs.links.color')} path={`${CS}.links.color`} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.cs.links.underline')} path={`${CS}.links.underline`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cs.design.sheet')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${CSD}.card.background`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${CSD}.card.radius`} min={0} max={60} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.padding')} path={`${CSD}.card.padding`} min={0} max={48} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.cs.overlay')} path={`${CSD}.overlayColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cs.overlayOpacity')} path={`${CSD}.overlayOpacity`} min={0} max={1} step={0.05} fallback={0.45} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cs.design.texts')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.cs.title')} path={`${CSD}.title.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CSD}.title.size`} min={10} max={32} step={0.5} fallback={17} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.cs.subtitle')} path={`${CSD}.subtitle.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CSD}.subtitle.size`} min={8} max={24} step={0.5} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.cs.footnote')} path={`${CSD}.footnote.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CSD}.footnote.size`} min={7} max={18} step={0.5} fallback={10.5} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cs.design.pointsStyle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.msgs.text')} path={`${CSD}.points.textColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CSD}.points.textSize`} min={8} max={20} step={0.5} fallback={12.5} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.chips.iconColor')} path={`${CSD}.points.iconColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.iconSize')} path={`${CSD}.points.iconSize`} min={10} max={32} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.gap')} path={`${CSD}.points.gap`} min={4} max={32} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cs.design.button')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${CSD}.button.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${CSD}.button.textColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${CSD}.button.radius`} min={0} max={999} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.inputHeight')} path={`${CSD}.button.height`} min={30} max={72} step={1} fallback={44} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CSD}.button.textSize`} min={9} max={24} step={0.5} fallback={13.5} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${CSD}.button.weight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="600" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.pc.design.fullWidth')} path={`${CSD}.button.fullWidth`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}
