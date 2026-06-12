import { useState } from 'react'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useSendChatMessageFlow } from '@/features/conversation/hooks/use-send-chat-message-flow'
import { useConversations } from '@/features/conversation/queries/use-conversations-queries'
import { TrendingPromptItem } from '@/features/intro/components/trending-prompt-item'

export function TrendingPrompts() {
  const { widgetConfig } = useWidgetConfigContext()
  const config = widgetConfig.trendingPrompts

  const { data: conversations, isFetching: isConversationsLoading } = useConversations()
  const { sendMessageFlow, isPending: isSendPending } = useSendChatMessageFlow()

  const [loadingPromptId, setLoadingPromptId] = useState<string | null>(null)

  if (!config || !config.show) {
    return null
  }

  const { showIcon, chipStyles, textStyle, prompts } = config
  const title = config.title ?? 'Trending prompts'

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

  return (
    <section className="mt-2 flex flex-col gap-3">
      <h2 className="text-[0.875rem] leading-[150%] font-semibold text-[#616161]" style={chipStyles}>
        {title}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <li key={prompt.id}>
            <TrendingPromptItem
              prompt={prompt}
              showIcon={showIcon}
              chipStyles={chipStyles}
              textStyle={textStyle}
              onClick={() => handlePromptClick(prompt.id, prompt.text)}
              disabled={isPending && loadingPromptId === prompt.id}
              isLoading={loadingPromptId === prompt.id}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
