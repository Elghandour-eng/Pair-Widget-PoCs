import { IconField } from '@/components/IconField'
import { MediaInput } from '@/components/MediaInput'
import { Select } from '@/components/Select'
import { SEND_ICONS, SendIcon, asSendIcon } from '@/components/sendIcons'
import { Disclosure, SectionHead } from '@/components/ui'
import { type WidgetConfig } from '@/lib/api'
import { BORDER_STYLES, BUTTON_SHAPES, FONT_WEIGHTS, INPUT_LAYOUTS, SEND_POSITIONS, sendIconSizeDefault } from '@/lib/inputDesign'
import { useI18n } from '@/lib/i18n'
import {
  BrandColorField, ChoiceField, FontField, NumField, PlainBiField, ShadowFields, ToggleField, type PageProps,
} from './fields'

const INPUT = 'widget_v2_config.chat_input.design'

export function InputPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${INPUT}.${k}`
  const sendIcon = asSendIcon(get(p('send.icon')))
  // A full-width bar is docked to the panel's edges, so its corner radius and
  // the padding beside and under it have nothing to act on.
  const isBar = get(p('layout')) === 'full_width_bar'
  // Both actions are on until switched off. An older config's own attach flag
  // still decides while the toggle here has never been touched.
  const voiceOn = get(p('actions.voice')) ?? true
  const attachFallback = get('widget_v2_config.chat_input.inputActions.fileUpload') ?? true
  const attachOn = get(p('actions.attach')) ?? attachFallback

  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('form.input')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('form.inputLayout')} path={p('layout')} options={[...INPUT_LAYOUTS]} keyPrefix="builder.input.layout" fallback="floating_pill" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.direction')} path={p('direction')} options={['auto', 'ltr', 'rtl']} keyPrefix="builder.input.dir" fallback="auto" get={get} set={set} disabled={disabled} />
        </div>
      </section>

      <Disclosure summary={t('builder.input.field')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.input.fieldBg')} path={p('field.background')} get={get} set={set} disabled={disabled} />
          {!isBar && (
            <NumField label={t('builder.input.radius')} path={p('field.radius')} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          )}
          <NumField label={t('builder.input.minHeight')} path={p('field.minHeight')} min={28} max={120} step={1} fallback={46} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.gap')} path={p('field.gap')} min={0} max={32} step={1} fallback={8} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padX')} path={p('field.paddingX')} min={0} max={40} step={1} fallback={5} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padY')} path={p('field.paddingY')} min={0} max={40} step={1} fallback={5} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.borderStyle')} path={p('field.borderStyle')} options={[...BORDER_STYLES]} keyPrefix="builder.input.borderStyle" fallback="solid" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.borderWidth')} path={p('field.borderWidth')} min={0} max={12} step={0.5} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={p('field.borderColor')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.focus')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.input.focusBorder')} path={p('field.focusBorderColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.ringWidth')} path={p('field.focusRingWidth')} min={0} max={12} step={0.5} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          {(get(p('field.focusRingWidth')) ?? 0) > 0 && (
            <>
              <BrandColorField label={t('builder.input.ringColor')} path={p('field.focusRingColor')} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.input.ringOpacity')} path={p('field.focusRingOpacity')} min={0} max={1} step={0.02} fallback={0.18} get={get} set={set} disabled={disabled} />
            </>
          )}
        </div>
        <p className="fine mt-2">{t('builder.input.focusHint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.input.shadow')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('field.shadow')} defaults={{ y: 8, blur: 16, opacity: 0.08 }} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.typing')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FontField label={t('builder.input.font')} path={p('text.fontFamily')} get={get} set={set} disabled={disabled} allowInherit />
          <NumField label={t('builder.input.textSize')} path={p('text.size')} min={9} max={28} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.textWeight')} path={p('text.weight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.textColor')} path={p('text.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.lineHeight')} path={p('text.lineHeight')} min={1} max={2.4} step={0.05} fallback={1.5} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.placeholder')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <PlainBiField label={t('form.placeholder')} path="widget_v2_config.chat_input.placeholderText.text" draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Ask me Anything..." />
          <BrandColorField label={t('builder.input.phColor')} path={p('placeholder.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.phSize')} path={p('placeholder.size')} min={9} max={28} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.phWeight')} path={p('placeholder.weight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.input.phItalic')} path={p('placeholder.italic')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.send')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t('builder.input.sendIcon')}</label>
            <Select
              label={t('builder.input.sendIcon')}
              value={sendIcon}
              onChange={(v) => set(p('send.icon'), v)}
              disabled={disabled}
              options={SEND_ICONS.map((name) => ({ value: name, label: t(`builder.input.sendIcon.${name}`), icon: <SendIcon name={name} className="size-3.5" /> }))}
            />
          </div>
          <ChoiceField label={t('builder.input.shape')} path={p('send.shape')} options={[...BUTTON_SHAPES]} keyPrefix="builder.shape" fallback="circle" get={get} set={set} disabled={disabled} />
          {sendIcon === 'custom' && (
            <div className="sm:col-span-2">
              <MediaInput label={t('builder.input.sendIcon.customImage')} value={get(p('send.url')) ?? ''} onChange={(v) => set(p('send.url'), v)} disabled={disabled} />
            </div>
          )}
          <NumField label={t('builder.input.btnSize')} path={p('send.size')} min={20} max={72} step={1} fallback={36} unit="px" get={get} set={set} disabled={disabled} />
          {get(p('send.shape')) === 'rounded' && (
            <NumField label={t('builder.input.radius')} path={p('send.radius')} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          )}
          <NumField label={t('builder.input.iconSize')} path={p('send.iconSize')} min={6} max={40} step={0.5} fallback={sendIconSizeDefault(sendIcon)} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.sendBg')} path={p('send.background')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.sendFg')} path={p('send.iconColor')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.hoverBg')} path={p('send.hoverBackground')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.disabledOpacity')} path={p('send.disabledOpacity')} min={0} max={1} step={0.05} fallback={0.4} get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.sendPos')} path={p('send.position')} options={[...SEND_POSITIONS]} keyPrefix="builder.input.sendPos" fallback="inside" get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('send.shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.actions')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('form.voice')} path={p('actions.voice')} fallback get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.input.attach')} path={p('actions.attach')} fallback={attachFallback !== false} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.input.emoji')} path={p('actions.emoji')} get={get} set={set} disabled={disabled} />
          <div />
          {voiceOn !== false && (
            <IconField
              label={t('builder.input.voiceIcon')} set="voice"
              value={get(p('actions.voiceIcon'))} url={get(p('actions.voiceUrl'))}
              onChange={(v) => set(p('actions.voiceIcon'), v)} onUrlChange={(v) => set(p('actions.voiceUrl'), v)}
              disabled={disabled}
            />
          )}
          {attachOn !== false && (
            <IconField
              label={t('builder.input.attachIcon')} set="attach"
              value={get(p('actions.attachIcon'))} url={get(p('actions.attachUrl'))}
              onChange={(v) => set(p('actions.attachIcon'), v)} onUrlChange={(v) => set(p('actions.attachUrl'), v)}
              disabled={disabled}
            />
          )}
          {get(p('actions.emoji')) === true && (
            <IconField
              label={t('builder.input.emojiIcon')} set="emoji"
              value={get(p('actions.emojiIcon'))} url={get(p('actions.emojiUrl'))}
              onChange={(v) => set(p('actions.emojiIcon'), v)} onUrlChange={(v) => set(p('actions.emojiUrl'), v)}
              disabled={disabled}
            />
          )}
          <ChoiceField label={t('builder.input.shape')} path={p('actions.shape')} options={[...BUTTON_SHAPES]} keyPrefix="builder.shape" fallback="circle" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.btnSize')} path={p('actions.size')} min={20} max={72} step={1} fallback={36} unit="px" get={get} set={set} disabled={disabled} />
          {get(p('actions.shape')) === 'rounded' && (
            <NumField label={t('builder.input.radius')} path={p('actions.radius')} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          )}
          <NumField label={t('builder.input.iconSize')} path={p('actions.iconSize')} min={6} max={40} step={0.5} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.actionBg')} path={p('actions.background')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.actionColor')} path={p('actions.iconColor')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.hoverBg')} path={p('actions.hoverBackground')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.gap')} path={p('actions.gap')} min={0} max={24} step={1} fallback={2} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.container')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.input.containerBg')} path={p('container.background')} get={get} set={set} disabled={disabled} />
          {!isBar && (
            <NumField label={t('builder.input.padX')} path={p('container.paddingX')} min={0} max={48} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          )}
          <NumField label={t('builder.input.padTop')} path={p('container.paddingTop')} min={0} max={48} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          {!isBar && (
            <NumField label={t('builder.input.padBottom')} path={p('container.paddingBottom')} min={0} max={48} step={1} fallback={24} unit="px" get={get} set={set} disabled={disabled} />
          )}
        </div>
      </Disclosure>
    </div>
  )
}
