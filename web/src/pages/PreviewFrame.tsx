import { useEffect, useMemo, useState } from 'react'
import { WidgetPreview } from '@/components/WidgetPreview'
import type { WidgetConfig } from '@/lib/api'
import {
  applyLanguage, applyTheme, isPreviewEventMsg, isPreviewInMsg,
  type PreviewOutMsg, type ThemeName, type WidgetLang,
} from '@/lib/builder'

/**
 * The page the builder embeds in an <iframe>. It renders nothing but the widget
 * and gets its entire design over postMessage — the same way an embedded widget
 * on a customer page would receive live design updates from a host script.
 *
 * Besides full configs, the parent can push runtime events
 * (`pws:event` — set-language / set-theme) that the frame applies on top of the
 * config it holds, without the parent's draft changing.
 *
 * It fetches nothing and needs no auth: whatever config the parent posts is
 * what it renders. Only same-origin parents are listened to.
 */
export function PreviewFrame() {
  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [dark, setDark] = useState(false)
  const [lang, setLang] = useState<WidgetLang | null>(null)
  const [theme, setTheme] = useState<ThemeName | null>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (isPreviewInMsg(e.data)) {
        setConfig(e.data.config)
        setDark(e.data.dark)
        return
      }
      if (isPreviewEventMsg(e.data)) {
        if (e.data.name === 'set-language') setLang(e.data.value)
        if (e.data.name === 'set-theme') setTheme(e.data.value)
      }
    }
    window.addEventListener('message', onMessage)
    // Handshake: tell the builder the frame is live so it sends the current draft.
    window.parent.postMessage({ type: 'pws:ready' } satisfies PreviewOutMsg, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Pushed events layer on top of the latest config without mutating it.
  const rendered = useMemo(() => {
    if (!config) return config
    let next = config
    if (lang) next = applyLanguage(next, lang)
    if (theme) next = applyTheme(next, theme)
    return next
  }, [config, lang, theme])

  return (
    <div className="h-dvh w-dvw overflow-hidden">
      <WidgetPreview config={rendered} dark={dark} frame={false} />
    </div>
  )
}
