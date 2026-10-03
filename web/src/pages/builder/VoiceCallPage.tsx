import { MediaInput } from '@/components/MediaInput'
import { Disclosure, SectionHead } from '@/components/ui'
import { type WidgetConfig } from '@/lib/api'
import { useI18n, type MsgKey } from '@/lib/i18n'
import {
  VOICE_CALL_ICONS, VOICE_CALL_LANGUAGES, VOICE_CALL_VISUALIZERS, voiceCallTextDefaults, type VoiceCallTexts,
} from '@/lib/voiceCall'
import {
  BrandColorField, ChoiceField, Field, FontField, NumField, PlainBiField, ToggleField, type PageProps,
} from './fields'

const VC = 'widget_v2_config.voice_call'

/** The copy, grouped the way a visitor meets it. */
const TEXT_GROUPS: Array<{ head: MsgKey; keys: Array<keyof VoiceCallTexts> }> = [
  { head: 'builder.call.textsEntry', keys: ['headerButton', 'introButton', 'title', 'subtitle'] },
  { head: 'builder.call.textsConfirm', keys: ['confirmTitle', 'confirmBody', 'startButton', 'cancelButton'] },
  { head: 'builder.call.textsLive', keys: ['connecting', 'listening', 'thinking', 'speaking', 'endButton', 'mute', 'unmute'] },
  { head: 'builder.call.textsAfter', keys: ['ended', 'timeLimit', 'failed', 'micDenied', 'unavailable', 'callAgain', 'closeButton'] },
]

/**
 * Voice calls: the phone button, who it reaches, what the visitor sees during
 * the call, and every line of copy in both languages. The routing (the agent's
 * number) never reaches the widget; the server places the call by it.
 */
export function VoiceCallPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${VC}.${k}`
  const g = (k: string) => `${VC}.design.${k}`
  const enabled = get(p('enabled')) === true
  const icon = get(p('icon')) ?? 'phone'
  const stock = voiceCallTextDefaults('en')
  const stockAr = voiceCallTextDefaults('ar')

  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('builder.section.call')}</SectionHead>
        <p className="callout mb-4">{t('builder.call.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.call.enabled')} path={p('enabled')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.call.agentNumber')} path={p('agentNumber')} placeholder="+9001" get={get} set={set} disabled={disabled} />
        </div>
        {enabled && !String(get(p('agentNumber')) ?? '').trim() && <p className="fine mt-2 text-[#B42318]">{t('builder.call.agentMissing')}</p>}
      </section>

      <Disclosure summary={t('builder.call.entry')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.call.entryHeader')} path={p('entry.header')} fallback get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.call.entryIntro')} path={p('entry.intro')} get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.call.icon')} path={p('icon')} options={[...VOICE_CALL_ICONS]} keyPrefix="builder.call.icon" fallback="phone" get={get} set={set} disabled={disabled} />
          {icon === 'custom' && (
            <div className="sm:col-span-2">
              <MediaInput label={t('builder.call.iconUrl')} value={get(p('iconUrl')) ?? ''} onChange={(v) => set(p('iconUrl'), v)} disabled={disabled} />
            </div>
          )}
        </div>
        <p className="fine mt-2">{t('builder.call.entryHint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.call.behaviour')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.call.confirm')} path={p('confirm')} fallback get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.call.keepAlive')} path={p('keepAliveWhenClosed')} fallback get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.call.showTimer')} path={p('showTimer')} fallback get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.call.showMute')} path={p('showMute')} fallback get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.call.showCaptions')} path={p('showCaptions')} fallback get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.call.language')} path={p('language')} options={[...VOICE_CALL_LANGUAGES]} keyPrefix="builder.call.language" fallback="widget" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.call.maxDuration')} path={p('maxDurationSec')} min={0} max={3600} step={30} fallback={600} unit="s" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.call.behaviourHint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.call.screen')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.call.background')} path={g('background')} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.launcher.gradient')} path={g('useGradient')} fallback get={get} set={set} disabled={disabled} />
          {get(g('useGradient')) !== false && (
            <>
              <BrandColorField label={t('builder.hero.bg.to')} path={g('gradientTo')} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.bg.angle')} path={g('gradientAngle')} min={0} max={360} step={5} fallback={160} unit="°" get={get} set={set} disabled={disabled} />
            </>
          )}
          <BrandColorField label={t('builder.input.textColor')} path={g('textColor')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.call.mutedColor')} path={g('mutedColor')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.call.accent')} path={g('accent')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.call.titleSize')} path={g('titleSize')} min={14} max={32} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.input.font')} path={g('fontFamily')} get={get} set={set} disabled={disabled} allowInherit />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.call.avatarHead')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.call.showAvatar')} path={g('showAvatar')} fallback get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.call.visualizer')} path={g('visualizer')} options={[...VOICE_CALL_VISUALIZERS]} keyPrefix="builder.call.visualizer" fallback="orb" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.call.avatarSize')} path={g('avatarSize')} min={40} max={160} step={2} fallback={88} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={g('avatarRadius')} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          <div className="sm:col-span-2">
            <MediaInput label={t('builder.call.avatarUrl')} value={get(g('avatarUrl')) ?? ''} onChange={(v) => set(g('avatarUrl'), v)} disabled={disabled} />
          </div>
        </div>
        <p className="fine mt-2">{t('builder.call.avatarHint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.call.controls')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label={t('builder.call.controlSize')} path={g('controlSize')} min={40} max={80} step={1} fallback={56} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.call.controlBackground')} path={g('controlBackground')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.call.controlColor')} path={g('controlColor')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.call.endBackground')} path={g('endBackground')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.call.endColor')} path={g('endColor')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.call.captions')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.call.captionBackground')} path={g('captionBackground')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.call.captionColor')} path={g('captionColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={g('captionSize')} min={10} max={22} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.call.captionsHint')}</p>
      </Disclosure>

      {TEXT_GROUPS.map((group) => (
        <Disclosure key={group.head} summary={t(group.head)}>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.keys.map((k) => (
              <PlainBiField
                key={k}
                label={t(`builder.call.text.${k}` as MsgKey)}
                path={`${VC}.texts.${k}`}
                draft={draft}
                setDraft={setDraft}
                disabled={disabled}
                placeholder={stock[k]}
                placeholderAr={stockAr[k]}
              />
            ))}
          </div>
          <p className="fine mt-2">{t('builder.call.textsHint')}</p>
        </Disclosure>
      ))}

      <Disclosure summary={t('builder.call.advanced')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('builder.call.agentName')} path={p('agentName')} placeholder="pair-voice-agent" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.call.agentNameHint')}</p>
      </Disclosure>
    </div>
  )
}
