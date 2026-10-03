import { IconField } from '@/components/IconField'
import { Disclosure, SectionHead } from '@/components/ui'
import { type WidgetConfig } from '@/lib/api'
import {
  FONT_WEIGHTS, LAUNCHER_ATTENTION, LAUNCHER_ENTRANCES, LOADING_DEFAULTS, LOADING_TYPES, TOAST_BUILT_IN, TOAST_DEFAULTS,
  TOAST_POSITIONS, builtInLoading,
} from '@/lib/inputDesign'
import { useI18n } from '@/lib/i18n'
import {
  BrandColorField, ChoiceField, Field, FontField, NumField, PlainBiField, ShadowFields, ToggleField,
  type Get, type PageProps, type Set,
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
          <ToggleField label={t('form.poweredBy')} path="powered_by_pair_ai" fallback get={get} set={set} disabled={disabled} />
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
          <ShadowFields base={p('shadow')} defaults={{ y: 8, blur: 24, opacity: 0.22 }} get={get} set={set} disabled={disabled} />
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
          <ShadowFields base={m('shadow')} defaults={{ y: 6, blur: 20, opacity: 0.16 }} get={get} set={set} disabled={disabled} />
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

/**
 * Reads and writes one design block against a baseline. A field the block does
 * not store shows the baseline's value: the studio's default once a design
 * exists (the server fills the gaps with those), or — while nothing is stored
 * at all — what the live widget draws by itself. The first change then stores
 * that whole baseline with it, so setting one value does not swing every other
 * one over to the studio's defaults.
 */
function againstBaseline(root: string, base: object, stored: boolean, get: Get, set: Set): { get: Get; set: Set } {
  const rel = (path: string) => (path.startsWith(`${root}.`) ? path.slice(root.length + 1).split('.') : null)
  return {
    get: (path) => {
      const value = get(path)
      const keys = rel(path)
      if (value != null || !keys) return value
      return keys.reduce<any>((o, k) => (o == null ? undefined : o[k]), base)
    },
    set: (path, val) => {
      const keys = rel(path)
      if (stored || !keys) return set(path, val)
      const seeded = structuredClone(base) as Record<string, any>
      let cur = seeded
      for (const k of keys.slice(0, -1)) {
        if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
        cur = cur[k]
      }
      cur[keys.at(-1)!] = val
      set(root, seeded)
    },
  }
}

const isStored = (v: unknown) => !!v && typeof v === 'object'

/** The placeholder shown while a conversation's messages are being fetched. */
export function LoadingPage({ get: rawGet, set: rawSet, disabled }: PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${LOADING}.${k}`
  const stored = isStored(rawGet(LOADING))
  // With no design the widget follows the config's older two-way switch.
  const base = stored ? LOADING_DEFAULTS : builtInLoading(rawGet('widget_v2_config.intro_screen.loadingState.type'))
  const { get, set } = againstBaseline(LOADING, base, stored, rawGet, rawSet)
  const type = get(p('type'))
  const skeleton = type === 'shimmer' || type === 'pulse'

  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('builder.load.head')}</SectionHead>
        <p className="callout mb-3">{t('builder.load.hint')}</p>
        {!stored && <p className="fine mb-3">{t('builder.load.builtIn')}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.load.type')} path={p('type')} options={[...LOADING_TYPES]} keyPrefix="builder.load.type" fallback={base.type} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.load.speed')} path={p('speedMs')} min={300} max={6000} step={50} fallback={base.speedMs} unit="ms" get={get} set={set} disabled={disabled} />
        </div>
      </section>

      {skeleton && (
        <Disclosure summary={t('builder.load.skeleton')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <BrandColorField label={t('builder.load.base')} path={p('baseColor')} get={get} set={set} disabled={disabled} />
            {/* A pulse fades the blocks themselves; only the shimmer has a sweep to colour. */}
            {type !== 'pulse' && (
              <BrandColorField label={t('builder.load.highlight')} path={p('highlightColor')} get={get} set={set} disabled={disabled} />
            )}
            <NumField label={t('builder.input.radius')} path={p('radius')} min={0} max={60} step={1} fallback={base.radius} unit="px" get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.lines')} path={p('lines')} min={0} max={8} step={1} fallback={base.lines} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.lineHeight')} path={p('lineHeight')} min={2} max={40} step={1} fallback={base.lineHeight} unit="px" get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.cards')} path={p('cards')} min={0} max={6} step={1} fallback={base.cards} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.cardHeight')} path={p('cardHeight')} min={20} max={400} step={4} fallback={base.cardHeight} unit="px" get={get} set={set} disabled={disabled} />
          </div>
        </Disclosure>
      )}

      {!skeleton && (
        <Disclosure summary={t('builder.load.spinner')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <BrandColorField label={t('builder.load.spinnerColor')} path={p('spinnerColor')} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.spinnerSize')} path={p('spinnerSize')} min={8} max={72} step={1} fallback={base.spinnerSize} unit="px" get={get} set={set} disabled={disabled} />
            {type === 'spinner' && (
              <NumField label={t('builder.load.spinnerThickness')} path={p('spinnerThickness')} min={1} max={10} step={0.5} fallback={base.spinnerThickness} unit="px" get={get} set={set} disabled={disabled} />
            )}
          </div>
        </Disclosure>
      )}

      <Disclosure summary={t('builder.load.label')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.load.labelShow')} path={p('labelShow')} fallback={base.labelShow} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.load.labelText')} path={p('labelText')} get={get} set={set} disabled={disabled} placeholder="Loading messages..." />
          <BrandColorField label={t('builder.launcher.labelColor')} path={p('labelColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={p('labelSize')} min={8} max={24} step={0.5} fallback={base.labelSize} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}

/** The confirmation, warning or error that slides in after an action. */
export function ToastPage({ draft, setDraft, get: rawGet, set: rawSet, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${TOAST}.${k}`
  const stored = isStored(rawGet(TOAST))
  const base = stored ? TOAST_DEFAULTS : TOAST_BUILT_IN
  const { get, set } = againstBaseline(TOAST, base, stored, rawGet, rawSet)
  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('builder.toast.head')}</SectionHead>
        <p className="callout mb-3">{t('builder.toast.hint')}</p>
        {!stored && <p className="fine mb-3">{t('builder.toast.builtIn')}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.toast.position')} path={p('position')} options={[...TOAST_POSITIONS]} keyPrefix="builder.toast.pos" fallback={base.position} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.toast.offset')} path={p('offset')} min={0} max={80} step={1} fallback={base.offset} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.toast.duration')} path={p('durationMs')} min={800} max={15000} step={100} fallback={base.durationMs} unit="ms" get={get} set={set} disabled={disabled} />
          <PlainBiField label={t('builder.toast.text')} path="widget_v2_config.messages.feedback.toastMessage" draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Thanks for your feedback." />
        </div>
      </section>

      <Disclosure summary={t('builder.toast.look')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.toast.bg')} path={p('background')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.toast.fg')} path={p('textColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={p('radius')} min={0} max={999} step={1} fallback={base.radius} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.borderWidth')} path={p('borderWidth')} min={0} max={8} step={0.5} fallback={base.borderWidth} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={p('borderColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padX')} path={p('paddingX')} min={0} max={40} step={1} fallback={base.paddingX} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padY')} path={p('paddingY')} min={0} max={40} step={1} fallback={base.paddingY} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={p('fontSize')} min={9} max={24} step={0.5} fallback={base.fontSize} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.textWeight')} path={p('fontWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback={base.fontWeight} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.toast.icon')} path={p('showIcon')} fallback={base.showIcon} get={get} set={set} disabled={disabled} />
          {get(p('showIcon')) !== false && (
            <BrandColorField label={t('builder.toast.iconColor')} path={p('iconColor')} get={get} set={set} disabled={disabled} />
          )}
          <ToggleField label={t('builder.toast.fullWidth')} path={p('fullWidth')} fallback={base.fullWidth} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('shadow')} defaults={base.shadow} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}
