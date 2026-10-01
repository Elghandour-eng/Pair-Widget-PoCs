import { MediaInput } from '@/components/MediaInput'
import { Disclosure, SectionHead } from '@/components/ui'
import { type WidgetConfig } from '@/lib/api'
import { currentLang, type WidgetLang } from '@/lib/builder'
import { FONT_WEIGHTS, IMAGE_FITS, TEXT_ALIGNS } from '@/lib/inputDesign'
import { useI18n } from '@/lib/i18n'
import {
  ChoiceField, ColorField, ItemBiInputs, NumField, PlainBiField, ShadowFields, ToggleField, type PageProps,
} from './fields'

const PC = 'widget_v2_config.pre_chat_form'
const PCD = `${PC}.design`

type PreChatFieldRow = {
  name: string; type: string; label: string; placeholder: string
  required: boolean; enabled: boolean; order: number; field_type: string
  /** Hand-typed translations, applied by the language switch. */
  i18n?: Partial<Record<WidgetLang, { label?: string; placeholder?: string }>>
}

const PC_DEFAULT_FIELDS: PreChatFieldRow[] = [
  { name: 'emailAddress', type: 'email', label: 'Email Id', placeholder: 'emailAddress', required: true, enabled: true, order: 1, field_type: 'standard' },
  { name: 'fullName', type: 'text', label: 'Full name', placeholder: 'fullName', required: false, enabled: true, order: 2, field_type: 'standard' },
  { name: 'phoneNumber', type: 'text', label: 'Phone number', placeholder: 'phoneNumber', required: true, enabled: true, order: 3, field_type: 'standard' },
]

/**
 * The pre-chat form page: whether the form gates the conversation, the copy it
 * opens with, the three contact fields, and the design of every part of it.
 * Fields are edited as whole rows and written back as one array, so the shape
 * stays a real array whatever path arithmetic would have made of it.
 */
export function PreChatPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const live = currentLang(draft)
  const stored = get(`${PC}.fields`)
  const fields: PreChatFieldRow[] = Array.isArray(stored) && stored.length ? stored : PC_DEFAULT_FIELDS
  const patchField = (i: number, patch: Partial<PreChatFieldRow>) =>
    set(`${PC}.fields`, fields.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  // One language of a field's label/placeholder: the translation is stored on
  // the item, and the live value follows the widget's current language.
  const writeFieldText = (i: number, key: 'label' | 'placeholder', lang: WidgetLang, v: string) =>
    set(`${PC}.fields`, fields.map((f, j) => {
      if (j !== i) return f
      const next: PreChatFieldRow = { ...f, i18n: { ...(f.i18n ?? {}), [lang]: { ...((f.i18n ?? {})[lang] ?? {}), [key]: v } } }
      if (live === lang) next[key] = v
      return next
    }))

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.section.prechat')}</SectionHead>
        <p className="callout mb-4">{t('builder.pc.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.pc.enable')} path={`${PC}.enabled`} get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.pc.placement')} path={`${PC}.placement`} options={['after_intro', 'before_intro']} keyPrefix="builder.pc.placement" fallback="after_intro" get={get} set={set} disabled={disabled} />
          <PlainBiField label={t('builder.pc.message')} path={`${PC}.message`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Share your queries or comments here." />
        </div>
      </section>

      <section>
        <SectionHead>{t('builder.pc.fields')}</SectionHead>
        <div className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.name} className="card space-y-3 p-3.5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="mono text-[11px] font-bold text-ink">{f.name}</span>
                <span className="badge">{f.type}</span>
                <span className="ms-auto flex gap-4">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-muted">
                    <input type="checkbox" checked={f.enabled !== false} disabled={disabled} onChange={(e) => patchField(i, { enabled: e.target.checked })} />
                    {t('builder.pc.field.enabled')}
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-muted">
                    <input type="checkbox" checked={!!f.required} disabled={disabled} onChange={(e) => patchField(i, { required: e.target.checked })} />
                    {t('builder.pc.field.required')}
                  </label>
                </span>
              </div>
              <div className="grid gap-3">
                <div>
                  <label className="label">{t('builder.pc.field.label')}</label>
                  <ItemBiInputs live={live} value={f.label} i18n={{ en: f.i18n?.en?.label, ar: f.i18n?.ar?.label }}
                    onWrite={(lang, v) => writeFieldText(i, 'label', lang, v)} disabled={disabled} />
                </div>
                <div>
                  <label className="label">{t('builder.pc.field.placeholder')}</label>
                  <ItemBiInputs live={live} value={f.placeholder ?? ''} i18n={{ en: f.i18n?.en?.placeholder, ar: f.i18n?.ar?.placeholder }}
                    onWrite={(lang, v) => writeFieldText(i, 'placeholder', lang, v)} disabled={disabled} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Disclosure summary={t('builder.pc.design.message')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.msgs.text')} path={`${PCD}.message.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${PCD}.message.size`} min={9} max={28} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${PCD}.message.weight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.chips.align')} path={`${PCD}.message.align`} options={[...TEXT_ALIGNS]} keyPrefix="builder.align" fallback="start" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.labels')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.pc.design.labelsShow')} path={`${PCD}.labels.show`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${PCD}.labels.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${PCD}.labels.size`} min={8} max={24} step={0.5} fallback={13} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${PCD}.labels.weight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="600" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.pc.design.requiredColor')} path={`${PCD}.labels.requiredColor`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.inputs')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${PCD}.field.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${PCD}.field.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${PCD}.field.borderWidth`} min={0} max={8} step={1} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${PCD}.field.radius`} min={0} max={999} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.inputHeight')} path={`${PCD}.field.height`} min={28} max={72} step={1} fallback={40} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.gap')} path={`${PCD}.field.gap`} min={4} max={40} step={1} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${PCD}.field.textColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${PCD}.field.textSize`} min={9} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.pc.design.placeholderColor')} path={`${PCD}.field.placeholderColor`} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.pc.design.focus')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.pc.design.focusBorder')} path={`${PCD}.field.focusBorderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.ring')} path={`${PCD}.field.focusRingWidth`} min={0} max={12} step={1} fallback={3} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.pc.design.ringColor')} path={`${PCD}.field.focusRingColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.ringOpacity')} path={`${PCD}.field.focusRingOpacity`} min={0} max={1} step={0.02} fallback={0.18} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.messageBox')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.pc.design.messageBoxOn')} path={`${PCD}.showMessage`} get={get} set={set} disabled={disabled} />
          <div />
          <PlainBiField label={t('builder.pc.design.messageLabel')} path={`${PCD}.messageLabel`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Message" />
          <PlainBiField label={t('builder.pc.design.messagePh')} path={`${PCD}.messagePlaceholder`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Type your message here..." />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.button')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <PlainBiField label={t('builder.pc.design.buttonText')} path={`${PCD}.buttonText`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Start Chat" />
          <ToggleField label={t('builder.pc.design.fullWidth')} path={`${PCD}.button.fullWidth`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.input.fieldBg')} path={`${PCD}.button.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${PCD}.button.textColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${PCD}.button.radius`} min={0} max={999} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.inputHeight')} path={`${PCD}.button.height`} min={30} max={72} step={1} fallback={44} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${PCD}.button.textSize`} min={9} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${PCD}.button.weight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="600" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.input.hoverBg')} path={`${PCD}.button.hoverBackground`} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={`${PCD}.button.shadow`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.media')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.pc.design.bannerOn')} path={`${PCD}.banner.show`} get={get} set={set} disabled={disabled} />
          <div />
          <MediaInput label={t('builder.pc.design.banner')} value={get(`${PCD}.banner.url`) ?? ''} onChange={(v) => set(`${PCD}.banner.url`, v)} disabled={disabled} />
          <div className="grid gap-4">
            <NumField label={t('builder.pc.design.bannerH')} path={`${PCD}.banner.height`} min={32} max={280} step={2} fallback={96} unit="px" get={get} set={set} disabled={disabled} />
            <ChoiceField label={t('builder.cards.imageFit')} path={`${PCD}.banner.fit`} options={[...IMAGE_FITS]} keyPrefix="builder.fit" fallback="cover" get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.msgs.radius')} path={`${PCD}.banner.radius`} min={0} max={60} step={1} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          </div>
          <MediaInput label={t('builder.pc.design.backdrop')} value={get(`${PCD}.backdrop.url`) ?? ''} onChange={(v) => set(`${PCD}.backdrop.url`, v)} disabled={disabled} />
          <div className="grid gap-4">
            <NumField label={t('builder.pc.design.backdropOpacity')} path={`${PCD}.backdrop.opacity`} min={0} max={1} step={0.02} fallback={0.06} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.pc.design.backdropSize')} path={`${PCD}.backdrop.size`} min={40} max={800} step={10} fallback={220} unit="px" get={get} set={set} disabled={disabled} />
          </div>
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.card')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.pc.design.cardOn')} path={`${PCD}.card.enabled`} get={get} set={set} disabled={disabled} />
          <div />
          <ColorField label={t('builder.input.fieldBg')} path={`${PCD}.card.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${PCD}.card.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${PCD}.card.borderWidth`} min={0} max={8} step={1} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${PCD}.card.radius`} min={0} max={60} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.padding')} path={`${PCD}.card.padding`} min={0} max={48} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={`${PCD}.card.shadow`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}
