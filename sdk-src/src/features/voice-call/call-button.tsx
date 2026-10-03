import { AudioLines, Headset, Mic, Phone, PhoneCall } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useConsentPending } from '@/core/consent'
import { requestCall, useVoiceCall } from './voice-call-controller'

const CALL_GLYPHS = {
  phone: Phone,
  'phone-call': PhoneCall,
  headset: Headset,
  mic: Mic,
  'audio-lines': AudioLines,
} as const

export function CallGlyph({ className }: { className?: string }) {
  const { widgetConfig } = useWidgetConfigContext()
  const vc = widgetConfig.voiceCall
  if (vc?.icon === 'custom' && vc.iconUrl)
    return <img src={vc.iconUrl} alt="" className={`${className} object-contain`} />
  const Glyph = CALL_GLYPHS[(vc?.icon ?? 'phone') as keyof typeof CALL_GLYPHS] ?? Phone
  return <Glyph className={className} />
}

/** Starts a call the way the design asks: confirm first, or dial straight away. */
export function useStartCall() {
  const { widgetConfig, view } = useWidgetConfigContext()
  const vc = widgetConfig.voiceCall
  return () => {
    if (!vc?.available) return
    const lang = vc.language === 'widget' ? (view.lang ?? widgetConfig.locale ?? 'en') : vc.language
    requestCall({ lang, maxDurationSec: vc.maxDurationSec, confirm: vc.confirm })
  }
}

/**
 * The phone button in the header. While a call runs it stays lit and brings
 * the folded call screen back; it never starts a second call.
 */
export function CallButton({ className }: { className?: string }) {
  const { widgetConfig } = useWidgetConfigContext()
  const consentPending = useConsentPending()
  const call = useVoiceCall()
  const start = useStartCall()
  const vc = widgetConfig.voiceCall
  if (!vc?.available || !vc.entry.header || consentPending) return null
  const active = call.status === 'connecting' || call.status === 'live'

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={vc.texts.headerButton}
      title={vc.texts.headerButton}
      onClick={start}
      style={active ? { color: vc.design.endColor, background: vc.design.endBackground } : undefined}
    >
      <CallGlyph className="size-4" />
    </Button>
  )
}

/** The call button on the intro screen, under the welcome copy. */
export function IntroCallButton() {
  const { widgetConfig } = useWidgetConfigContext()
  const consentPending = useConsentPending()
  const start = useStartCall()
  const vc = widgetConfig.voiceCall
  if (!vc?.available || !vc.entry.intro || consentPending) return null
  return (
    <button
      type="button"
      onClick={start}
      className="flex w-fit cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
      style={{ background: vc.design.accent, color: vc.design.endColor, fontFamily: vc.design.fontFamily || undefined }}
    >
      <CallGlyph className="size-4" />
      {vc.texts.introButton}
    </button>
  )
}
