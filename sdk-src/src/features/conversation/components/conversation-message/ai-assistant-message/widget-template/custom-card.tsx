import { useCallback, useEffect, useRef, useState } from 'react'
import type { CustomCardTemplate } from '@/features/conversation/types/message'
import { useTemplateDesign } from './use-template-design'

interface CustomCardProps {
  template: CustomCardTemplate
  sourceMessageUlid: string
}

/**
 * The one renderer every studio template uses.
 *
 * Templates made in the dashboard arrive already filled in: the server put the
 * agent's values into the operator's markup and sent finished HTML, so there is
 * nothing here to switch on and nothing about any particular card to know. That
 * is what makes a new card a dashboard task rather than an SDK release.
 *
 * It is drawn in a frame with no script permission, so markup a model wrote and
 * data an agent sent can style a card and can do nothing else — and the card's
 * CSS cannot leak into the host page either. The design knobs cross as custom
 * properties, which is the contract the studio prompt tells the model to use.
 */
export function CustomCard({ template }: CustomCardProps) {
  const design = useTemplateDesign(template.content)
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(0)
  const html = template.content?.html ?? ''

  const doc = `<!doctype html><html dir="${design.isArabic ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>
  :root {
    --accent: ${design.accent};
    --surface: ${design.surface};
    --border: ${design.border};
    --radius: ${design.radius}px;
    --padding: ${design.padding}px;
    --title-size: ${design.titleSize}px;
    --text: ${design.text};
    --muted: ${design.muted};
    color-scheme: ${design.isDark ? 'dark' : 'light'};
  }
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    color: ${design.text};
    font-family: inherit;
    font: inherit;
    -webkit-text-size-adjust: 100%;
  }
  img { max-width: 100%; }
</style></head><body>${html}</body></html>`

  // The frame has no script of its own, so its height is measured from here —
  // once on load, and again whenever an image finishing its download changes it.
  const measure = useCallback(() => {
    const body = frame.current?.contentDocument?.body
    if (body) setHeight(Math.ceil(body.scrollHeight))
  }, [])

  useEffect(() => {
    const body = frame.current?.contentDocument?.body
    if (!body || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    return () => observer.disconnect()
  }, [measure, doc])

  if (!html) return null

  return (
    <iframe
      ref={frame}
      title={template.content?.title ?? 'card'}
      srcDoc={doc}
      onLoad={measure}
      sandbox="allow-same-origin"
      style={{
        display: 'block',
        width: '100%',
        height: height || 120,
        border: 'none',
        colorScheme: design.isDark ? 'dark' : 'light',
      }}
    />
  )
}
