import { useEffect } from 'react'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetUIContext } from '@/contexts/widget-ui-context'
import { useStartCall } from './call-button'
import { CallScreen } from './call-screen'
import { endCall, getCallState, requestCall } from './voice-call-controller'

/**
 * Mounted once over the panel: draws the call screen, takes the host page's
 * startCall / endCall, and ends the call when the panel closes if the design
 * says a call does not outlive the panel.
 */
export function VoiceCallHost() {
  const { widgetConfig, view } = useWidgetConfigContext()
  const { isOpen } = useWidgetUIContext()
  const start = useStartCall()
  const vc = widgetConfig.voiceCall

  useEffect(() => {
    if (!isOpen && vc && !vc.keepAliveWhenClosed) endCall()
  }, [isOpen, vc])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const type = e.data && typeof e.data === 'object' ? e.data.type : null
      if (type === 'sdk:endCall') endCall()
      if (type !== 'sdk:startCall' || !vc?.available) return
      // The host page's own button is the visitor's consent to call: no second question.
      const lang = vc.language === 'widget' ? (view.lang ?? widgetConfig.locale ?? 'en') : vc.language
      requestCall({ lang, maxDurationSec: vc.maxDurationSec, confirm: false })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [vc, view.lang, widgetConfig.locale, start])

  // A design that turns calls off mid-call (a republish) ends the call it no longer offers.
  useEffect(() => {
    const s = getCallState().status
    if (!vc?.available && (s === 'connecting' || s === 'live')) endCall()
  }, [vc?.available])

  return <CallScreen />
}
