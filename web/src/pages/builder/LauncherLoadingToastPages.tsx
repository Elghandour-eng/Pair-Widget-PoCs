import { IconField } from '@/components/IconField'
import { Disclosure, SectionHead } from '@/components/ui'
import { type WidgetConfig } from '@/lib/api'
import { FONT_WEIGHTS, LAUNCHER_ATTENTION, LAUNCHER_ENTRANCES, LOADING_TYPES, TOAST_POSITIONS } from '@/lib/inputDesign'
import { useI18n } from '@/lib/i18n'
import {
  BrandColorField, ChoiceField, Field, FontField, NumField, PlainBiField, ShadowFields, ToggleField, type PageProps,
} from './fields'

const LAUNCHER = 'launcher_design'

export function LauncherPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${LAUNCHER}.${k}`
  const m = (k: string) => `${LAUNCHER}.message.${k}`
  const icon = get(p('icon')) ?? 'bubble'
  const type = get(p('type')) ?? 'standard'
  const expanded = type === 'expanded_bubble'

  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('builder.section.launcher')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('form.launcherStyle')} path={p('type')} options={['standard', 'expanded_bubble', 'chat_icon', 'icon_only', 'none']} keyPrefix="builder.launcher.type" fallback="standard" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('form.launcherPosition')} path={p('position')} options={['right', 'left']} keyPrefix="builder.launcher.pos" fallback="right" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.offsetX')} path={p('offsetX')} min={0} max={120} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.offsetY')} path={p('offsetY')} min={0} max={120} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('form.poweredBy')} path="powered_by_pair_ai" get={get} set={set} disabled={disabled} />
        </div>
        <p className="callout mt-4">{t(get(p('type')) === 'none' ? 'builder.launcher.openHint.none' : 'builder.launcher.openHint')}</p>
      </section>

      <Disclosure summary={t('builder.launcher.shape')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label={t('builder.launcher.size')} path={p('size')} min={32} max={96} step={1} fallback={56} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={p('radius')} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.launcher.gradient')} path={p('useGradient')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.launcher.bg')} path={p('background')} get={get} set={set} disabled={disabled} />
          {get(p('useGradient')) === true && (
            <>
              <BrandColorField label={t('builder.hero.bg.to')} path={p('gradientTo')} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.bg.angle')} path={p('gradientAngle')} min={0} max={360} step={5} fallback={135} unit="°" get={get} set={set} disabled={disabled} />
            </>
          )}
          <NumField label={t('builder.input.borderWidth')} path={p('borderWidth')} min={0} max={12} step={0.5} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={p('borderColor')} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.launcher.icon')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <IconField
            label={t('builder.launcher.icon')} set="launcher" allowNone
            value={get(p('icon'))} url={get(p('iconUrl'))}
            onChange={(v) => set(p('icon'), v)} onUrlChange={(v) => set(p('iconUrl'), v)}
            disabled={disabled}
          />
          {icon !== 'none' && (
            <>
              <NumField label={t('builder.input.iconSize')} path={p('iconSize')} min={8} max={64} step={1} fallback={22} unit="px" get={get} set={set} disabled={disabled} />
              {icon !== 'custom' && <BrandColorField label={t('builder.launcher.iconColor')} path={p('iconColor')} get={get} set={set} disabled={disabled} />}
            </>
          )}
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.launcher.label')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.launcher.labelShow')} path={p('label.show')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.launcher.title')} path="launcher_title" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.launcher.labelColor')} path={p('label.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={p('label.size')} min={9} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.textWeight')} path={p('label.weight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="500" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.input.font')} path={p('label.fontFamily')} get={get} set={set} disabled={disabled} allowInherit />
        </div>
        <p className="fine mt-2">{t(expanded ? 'builder.launcher.labelSizeHint' : 'builder.launcher.labelHint')}</p>
      </Disclosure>

      {/* The line that sits above the closed launcher and opens the chat when tapped. */}
      <Disclosure summary={t('builder.launcher.message')}>
        <p className="callout mb-3">{t(type === 'none' ? 'builder.launcher.messageNone' : 'builder.launcher.messageHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.launcher.messageShow')} path={m('show')} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.launcher.messageDismiss')} path={m('dismissible')} fallback get={get} set={set} disabled={disabled} />
          <PlainBiField label={t('builder.launcher.messageText')} path={m('text')} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Need a hand? Chat with us" />
          <BrandColorField label={t('builder.toast.bg')} path={m('background')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.textColor')} path={m('color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={m('size')} min={10} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.textWeight')} path={m('weight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="500" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.input.font')} path={m('fontFamily')} get={get} set={set} disabled={disabled} allowInherit />
          <NumField label={t('builder.input.radius')} path={m('radius')} min={0} max={40} step={1} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.messageWidth')} path={m('maxWidth')} min={120} max={360} step={4} fallback={240} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.messageGap')} path={m('gap')} min={0} max={40} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.messagePadX')} path={m('paddingX')} min={4} max={32} step={1} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.messagePadY')} path={m('paddingY')} min={2} max={24} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.borderWidth')} path={m('borderWidth')} min={0} max={6} step={0.5} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={m('borderColor')} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.launcher.messageTail')} path={m('tail')} fallback get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.messageDelay')} path={m('delayMs')} min={0} max={20000} step={100} fallback={800} unit="ms" get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={m('shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.panel.head')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label={t('builder.panel.width')} path={p('panel.width')} min={260} max={720} step={4} fallback={400} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.panel.maxHeight')} path={p('panel.maxHeight')} min={320} max={1200} step={10} fallback={700} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.panel.minHeight')} path={p('panel.minHeight')} min={200} max={800} step={10} fallback={250} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.panel.bottom')} path={p('panel.bottom')} min={0} max={220} step={2} fallback={104} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={p('panel.radius')} min={0} max={48} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.panel.hint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.launcher.motion')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.launcher.entrance')} path={p('entrance')} options={[...LAUNCHER_ENTRANCES]} keyPrefix="builder.launcher.entrance" fallback="pop" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.launcher.attention')} path={p('attention')} options={[...LAUNCHER_ATTENTION]} keyPrefix="builder.launcher.attention" fallback="none" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.hoverScale')} path={p('hoverScale')} min={1} max={1.3} step={0.01} fallback={1.04} unit="×" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.launcher.motionHint')}</p>
      </Disclosure>
    </div>
  )
}

/* ------------------------------ loading & toast ----------------------------- */

const LOADING = 'widget_v2_config.intro_screen.loadingState.design'
const TOAST = 'toast_design'

/** The placeholder shown while the first reply is still loading. */
export function LoadingPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${LOADING}.${k}`
  const type = get(p('type')) ?? get('widget_v2_config.intro_screen.loadingState.type') ?? 'shimmer'
  const skeleton = type === 'shimmer' || type === 'pulse'

  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('builder.load.head')}</SectionHead>
        <p className="callout mb-3">{t('builder.load.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.load.type')} path={p('type')} options={[...LOADING_TYPES]} keyPrefix="builder.load.type" fallback="shimmer" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.load.speed')} path={p('speedMs')} min={300} max={6000} step={50} fallback={1600} unit="ms" get={get} set={set} disabled={disabled} />
        </div>
      </section>

      {skeleton && (
        <Disclosure summary={t('builder.load.skeleton')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <BrandColorField label={t('builder.load.base')} path={p('baseColor')} get={get} set={set} disabled={disabled} />
            <BrandColorField label={t('builder.load.highlight')} path={p('highlightColor')} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.input.radius')} path={p('radius')} min={0} max={60} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.lines')} path={p('lines')} min={0} max={8} step={1} fallback={3} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.lineHeight')} path={p('lineHeight')} min={2} max={40} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.cards')} path={p('cards')} min={0} max={6} step={1} fallback={3} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.cardHeight')} path={p('cardHeight')} min={20} max={400} step={4} fallback={220} unit="px" get={get} set={set} disabled={disabled} />
          </div>
        </Disclosure>
      )}

      {!skeleton && (
        <Disclosure summary={t('builder.load.spinner')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <BrandColorField label={t('builder.load.spinnerColor')} path={p('spinnerColor')} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.spinnerSize')} path={p('spinnerSize')} min={8} max={72} step={1} fallback={22} unit="px" get={get} set={set} disabled={disabled} />
            {type === 'spinner' && (
              <NumField label={t('builder.load.spinnerThickness')} path={p('spinnerThickness')} min={1} max={10} step={0.5} fallback={2.5} unit="px" get={get} set={set} disabled={disabled} />
            )}
          </div>
        </Disclosure>
      )}

      <Disclosure summary={t('builder.load.label')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.load.labelShow')} path={p('labelShow')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.load.labelText')} path={p('labelText')} get={get} set={set} disabled={disabled} placeholder="Thinking…" />
          <BrandColorField label={t('builder.launcher.labelColor')} path={p('labelColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={p('labelSize')} min={8} max={24} step={0.5} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}

/** The confirmation that slides in after an action. */
export function ToastPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${TOAST}.${k}`
  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('builder.toast.head')}</SectionHead>
        <p className="callout mb-3">{t('builder.toast.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.toast.position')} path={p('position')} options={[...TOAST_POSITIONS]} keyPrefix="builder.toast.pos" fallback="bottom-center" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.toast.offset')} path={p('offset')} min={0} max={80} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.toast.duration')} path={p('durationMs')} min={800} max={15000} step={100} fallback={3000} unit="ms" get={get} set={set} disabled={disabled} />
          <Field label={t('builder.toast.text')} path="widget_v2_config.messages.feedback.toastMessage" get={get} set={set} disabled={disabled} placeholder="Thanks for your feedback." />
        </div>
      </section>

      <Disclosure summary={t('builder.toast.look')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.toast.bg')} path={p('background')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.toast.fg')} path={p('textColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={p('radius')} min={0} max={999} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.borderWidth')} path={p('borderWidth')} min={0} max={8} step={0.5} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={p('borderColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padX')} path={p('paddingX')} min={0} max={40} step={1} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padY')} path={p('paddingY')} min={0} max={40} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={p('fontSize')} min={9} max={24} step={0.5} fallback={13} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.textWeight')} path={p('fontWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="500" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.toast.icon')} path={p('showIcon')} get={get} set={set} disabled={disabled} />
          {get(p('showIcon')) !== false && (
            <BrandColorField label={t('builder.toast.iconColor')} path={p('iconColor')} get={get} set={set} disabled={disabled} />
          )}
          <ToggleField label={t('builder.toast.fullWidth')} path={p('fullWidth')} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}
