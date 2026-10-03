import { useState } from 'react'

import type { QuickLinkData } from '@/config/types/widget-config'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useSendChatMessageFlow } from '@/features/conversation/hooks/use-send-chat-message-flow'
import { useConversations } from '@/features/conversation/queries/use-conversations-queries'
import { QuickLinkItem } from '@/features/intro/components/quick-link-item'
import { useCarousel } from '@/hooks/use-carousel'
import { isDarkBackground } from '@/lib/utils'

export function QuickLinksList() {
  const { widgetConfig } = useWidgetConfigContext()
  const quickLinksConfig = widgetConfig.quickLinks

  const { data: conversations, isFetching: isConversationsLoading } = useConversations()
  const { sendMessageFlow, isPending: isSendPending } = useSendChatMessageFlow()
  const [loadingLinkId, setLoadingLinkId] = useState<string | null>(null)

  if (!quickLinksConfig || !quickLinksConfig.show) {
    return null
  }

  // Sort the links by displayOrder. Only a card switched off outright is
  // hidden: one that says nothing about `active` is on, as the studio shows it.
  const sortedLinks = quickLinksConfig.links
    .filter((l) => l.active !== false)
    .sort((a, b) => {
      const orderA = a.displayOrder ?? 9999
      const orderB = b.displayOrder ?? 9999
      return orderA - orderB
    })

  // The studio names the layout outright; without one, a column card style is
  // still how a stacked list used to be expressed.
  const design = quickLinksConfig.design
  const layout = design?.layout ?? (quickLinksConfig.cardStyles?.flexDirection !== 'column' ? 'carousel' : 'stack')
  const isCarousel = layout === 'carousel'

  const rtl = /^(ar|he|fa|ur)/i.test(widgetConfig.locale ?? 'en')
  const { containerRef, emblaRef, basisPercentage } = useCarousel({
    itemCount: sortedLinks.length,
    active: isCarousel,
    rtl,
    loop: design?.loop ?? quickLinksConfig.carouselLoop,
    // Auto-scroll is its own choice now, rather than riding on looping.
    autoplay: design ? design.autoScroll === true : quickLinksConfig.carouselLoop,
    autoplayInterval: design?.intervalMs,
    minCardWidth: design?.cardWidth,
    gap: design?.gap,
  })

  if (sortedLinks.length === 0) {
    return null
  }

  const isPending = isConversationsLoading || isSendPending

  // A tap sends the card's message the way a prompt chip sends its text; a
  // card with no message of its own sends its title.
  const messageOf = (item: QuickLinkData) => item.message?.trim() || item.text?.trim() || ''
  const handleLinkClick = async (item: QuickLinkData) => {
    const text = messageOf(item)
    if (!text || isPending) return

    setLoadingLinkId(item.id)
    try {
      await sendMessageFlow(text, conversations?.data[0]?.ulid)
    } catch (error) {
      console.error('Failed to start conversation with quick link:', error)
    } finally {
      setLoadingLinkId(null)
    }
  }
  const clickProps = (item: QuickLinkData) => ({
    onClick: messageOf(item) ? () => handleLinkClick(item) : undefined,
    disabled: isPending && loadingLinkId === item.id,
  })

  // The studio's gap spaces the carousel track too, not only the stacked
  // layouts; the fixed 8px stays for configs that carry no design.
  const trackGap = design?.gap

  const itemProps = {
    cardStyles: quickLinksConfig.cardStyles,
    textStyle: quickLinksConfig.textStyle,
    subtitleStyle: quickLinksConfig.subtitleStyle,
    showTitle: quickLinksConfig.showTitle,
    showSubtitle: quickLinksConfig.showSubtitle,
    design,
  }

  return (
    <div ref={containerRef} className="w-full">
      {/* Hover colours need a rule, not an inline style; the server compiles it. */}
      {design?.hoverCss && <style>{design.hoverCss}</style>}
      {/* The channel's own heading over the cards, led by a brand chevron —
          the same row the studio's preview draws. */}
      {quickLinksConfig.title && (
        <p
          className="mb-2 flex items-center gap-1 text-[0.875rem] leading-[150%] font-bold"
          // The heading sits straight on the widget background, so its colour
          // follows that background's own lightness — a dark theme keeps it visible.
          style={{ color: isDarkBackground(widgetConfig.widgetBgColor) ? '#F5F5F7' : '#1E1E1E' }}
        >
          <span className="rtl:-scale-x-100" style={{ color: widgetConfig.primaryColor }}>
            ‹
          </span>
          {quickLinksConfig.title}
        </p>
      )}
      {isCarousel ? (
        // Keyed on direction: flipping the widget language re-mounts embla,
        // whose snap positions otherwise go stale and leave blank track.
        <div
          key={rtl ? 'rtl' : 'ltr'}
          className="w-full cursor-grab overflow-hidden active:cursor-grabbing"
          ref={emblaRef}
        >
          <div className="-ms-2 flex" style={trackGap !== undefined ? { marginInlineStart: -trackGap } : undefined}>
            {sortedLinks.map((item) => (
              <div
                key={item.id}
                className="flex min-w-0 ps-2"
                style={{
                  flex: `0 0 ${basisPercentage}%`,
                  ...(trackGap !== undefined ? { paddingInlineStart: trackGap } : {}),
                }}
              >
                <QuickLinkItem item={item} {...itemProps} {...clickProps(item)} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className={layout === 'grid' ? 'grid w-full grid-cols-2' : 'flex w-full flex-col'}
          style={{ gap: design?.gap ?? 8 }}
        >
          {sortedLinks.map((item) => (
            <QuickLinkItem key={item.id} item={item} {...itemProps} {...clickProps(item)} />
          ))}
        </div>
      )}
    </div>
  )
}
