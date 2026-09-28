import { useState } from 'react'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useSendChatMessageFlow } from '@/features/conversation/hooks/use-send-chat-message-flow'
import { useConversations } from '@/features/conversation/queries/use-conversations-queries'
import { TrendingPromptItem } from '@/features/intro/components/trending-prompt-item'
import { useCarousel } from '@/hooks/use-carousel'

export function TrendingPrompts() {
  const { widgetConfig } = useWidgetConfigContext()
  const config = widgetConfig.trendingPrompts

  const { data: conversations, isFetching: isConversationsLoading } = useConversations()
  const { sendMessageFlow, isPending: isSendPending } = useSendChatMessageFlow()

  const [loadingPromptId, setLoadingPromptId] = useState<string | null>(null)

  if (!config || !config.show) {
    return null
  }

  const { showIcon, chipStyles, textStyle, prompts, titleStyle, iconStyle } = config
  const title = config.title ?? 'Trending prompts'
  const itemProps = {
    iconStyle,
    showIcon,
    chipStyles,
    textStyle,
    defaultIcon: config.defaultIcon,
    defaultIconUrl: config.defaultIconUrl,
    iconPosition: config.iconPosition,
  }

  const isPending = isConversationsLoading || isSendPending

  const handlePromptClick = async (promptId: string, promptText: string) => {
    if (isPending) return

    setLoadingPromptId(promptId)
    try {
      await sendMessageFlow(promptText, conversations?.data[0]?.ulid)
    } catch (error) {
      console.error('Failed to start conversation with prompt:', error)
    } finally {
      setLoadingPromptId(null)
    }
  }

  const showTitle = config.showTitle ?? true
  const isCardLayout = config.layout === 'card' || chipStyles?.flexDirection === 'column'

  const { containerRef, emblaRef, basisPercentage } = useCarousel({
    itemCount: prompts.length,
    active: isCardLayout,
    loop: config.carouselLoop,
    autoplay: config.carouselLoop,
    rtl: /^(ar|he|fa|ur)/i.test(widgetConfig.locale ?? 'en'),
  })

  if (prompts.length === 0) {
    return null
  }

  return (
    <section className="mt-2 flex flex-col gap-3">
      {showTitle && (
        <h2 className="text-[0.875rem] leading-[150%] font-semibold text-[#616161]" style={titleStyle}>
          {title}
        </h2>
      )}
      <div ref={containerRef} className="w-full">
        {isCardLayout ? (
          <div
            key={/^(ar|he|fa|ur)/i.test(widgetConfig.locale ?? 'en') ? 'rtl' : 'ltr'}
            className="w-full cursor-grab overflow-hidden active:cursor-grabbing"
            ref={emblaRef}
          >
            <div className="-ms-2 flex">
              {prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="animate-scale-up flex min-w-0 ps-2"
                  style={{ flex: `0 0 ${basisPercentage}%` }}
                >
                  <TrendingPromptItem
                    {...itemProps}
                    prompt={prompt}
                    onClick={() => handlePromptClick(prompt.id, prompt.text)}
                    disabled={isPending && loadingPromptId === prompt.id}
                    isLoading={loadingPromptId === prompt.id}
                    isCardLayout={isCardLayout}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          // The chips flow the way the studio laid them out: wrapping, one per
          // row, or one sideways-scrolling row — spaced by the studio's gap.
          <ul
            className={
              config.chipLayout === 'stack'
                ? 'flex flex-col items-start'
                : config.chipLayout === 'scroll'
                  ? 'flex overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                  : 'flex flex-wrap'
            }
            style={{ gap: config.gap ?? 8 }}
          >
            {prompts.map((prompt) => (
              <li key={prompt.id} className="shrink-0">
                <TrendingPromptItem
                  {...itemProps}
                  prompt={prompt}
                  onClick={() => handlePromptClick(prompt.id, prompt.text)}
                  disabled={isPending && loadingPromptId === prompt.id}
                  isLoading={loadingPromptId === prompt.id}
                  isCardLayout={isCardLayout}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
