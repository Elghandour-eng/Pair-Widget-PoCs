import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'
import { LocationRequestButton } from './location-request-button'
import { useDispatchAction } from '@/features/conversation/hooks/use-dispatch-action'
import { useSendMessage } from '@/features/conversation/hooks/use-send-message'
import type {
  NextMessageItem,
  ProductCardSet,
  SuggestionAction,
  SuggestionsMessage,
} from '@/features/conversation/types/message'
import { ProductSection } from './product-section'
import { toast } from 'sonner'

export function getIconUrl(item: unknown): string | undefined {
  if (!item || typeof item !== 'object') return undefined
  const obj = item as Record<string, unknown>
  if (typeof obj.imageUrl === 'string' && obj.imageUrl) return obj.imageUrl
  if (typeof obj.image_url === 'string' && obj.image_url) return obj.image_url
  if (typeof obj.iconUrl === 'string' && obj.iconUrl) return obj.iconUrl
  if (typeof obj.icon_url === 'string' && obj.icon_url) return obj.icon_url
  return undefined
}

export function getActionLabel(item: unknown, messageContent?: string, locale?: string): string {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return ''

  const obj = item as Record<string, unknown>
  if (typeof obj.label === 'string' && obj.label.trim()) return obj.label.trim()
  if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim()
  if (typeof obj.title === 'string' && obj.title.trim()) return obj.title.trim()
  if (typeof obj.action_title === 'string' && obj.action_title.trim()) return obj.action_title.trim()

  const isArabic = (messageContent && /[\u0600-\u06FF]/.test(messageContent)) || locale?.startsWith('ar')

  if (typeof obj.action_name === 'string' && obj.action_name.trim()) {
    const name = obj.action_name.toLowerCase()
    if (name === 'comparsion_template_add_item' || name === 'comparison_template_add_item' || name === 'add_to_cart') {
      return isArabic ? 'أضفه للسلة' : 'Add to Cart'
    }
    return obj.action_name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  }

  return isArabic ? 'إجراء' : 'Action'
}

interface InteractiveButtonProps {
  option: unknown
  sourceMessageUlid: string
  messageContent?: string
}

export function InteractiveButton({ option, sourceMessageUlid, messageContent }: InteractiveButtonProps) {
  const { widgetConfig, view } = useWidgetConfigContext()
  // chips sit on the messages surface, which follows the VIEW theme — the design's
  // widgetBgColor (a dark header/panel) must not push them into dark styling
  const isDark = view.theme === 'dark'
  const chips = widgetConfig.messagesConfig?.suggestions
  const brand = widgetConfig.primaryColor || '#B3202C'
  const chipStyle: React.CSSProperties & Record<string, string> = {
    background: chips?.background ?? (isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f6'),
    border: chips?.borderColor ? `1px solid ${chips.borderColor}` : 'none',
    color: chips?.textColor ?? (isDark ? '#e8eaf0' : '#3c3d42'),
    borderRadius: chips?.radius != null ? `${chips.radius}px` : '999px',
    fontSize: chips?.fontSize != null ? `${chips.fontSize}px` : undefined,
    fontWeight: 500,
    padding: '9px 16px',
    '--chip-brand': brand,
  }
  const { mutateAsync: sendMessageMutation } = useSendMessage()
  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: dispatchActionMutation } = useDispatchAction()

  const label = getActionLabel(option, messageContent)
  const iconUrl = getIconUrl(option)

  const handleClick = async () => {
    if (typeof option === 'string') {
      try {
        await sendMessageMutation({
          ...(conversationId ? { conversation_id: conversationId } : {}),
          content: option,
          message_type: 'text',
        })
      } catch (err) {
        console.error('Failed to send suggestion response', err)
        toast.error('Failed to send message')
      }
      return
    }

    if (option && typeof option === 'object') {
      const actionObj = option as SuggestionAction & Record<string, unknown>
      const actionUlid = actionObj.id || actionObj.action_ulid
      const actionParams = (actionObj.parameters || actionObj.payload || {}) as Record<string, unknown>

      // Dispatch postMessage to host iframe container if present
      if (typeof window !== 'undefined' && window.parent) {
        window.parent.postMessage(
          {
            event_type: actionObj.action_name || 'action:dispatch',
            action_name: actionObj.action_name,
            payload: actionParams,
            parameters: actionParams,
          },
          '*',
        )

        if (
          actionObj.action_name === 'comparsion_template_add_item' ||
          actionObj.action_name === 'comparison_template_add_item' ||
          actionObj.action_name === 'add_to_cart'
        ) {
          window.parent.postMessage(
            {
              event_type: 'cart:add',
              payload: actionParams,
            },
            '*',
          )
        }
      }

      if (conversationId && actionUlid) {
        try {
          const res = await dispatchActionMutation({
            conversationId,
            actionUlid,
            sourceMessageUlid,
            parameters: actionParams,
          })

          if (res.success) {
            toast.success(res.error_message || `${label} successful!`)
          } else {
            toast.error(res.error_message || 'Action execution failed')
          }
        } catch (error) {
          console.error('Failed to execute action', error)
          toast.error('Failed to execute action')
        }
      } else {
        toast.success(`${label} successful!`)
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      dir="auto"
      className="pair-chip flex cursor-pointer items-center gap-1.5 text-start font-(family-name:--Font-primary,'DM_Sans') text-[13.5px] leading-[130%] font-normal transition-all hover:-translate-y-px focus:outline-none active:translate-y-0"
      style={chipStyle}
    >
      {iconUrl && <img src={iconUrl} alt="" className="h-4 w-4 shrink-0 rounded-xs object-cover" />}
      <span>{label}</span>
    </button>
  )
}

interface ActionSectionProps {
  action: SuggestionAction | Record<string, unknown>
  sourceMessageUlid: string
  messageContent?: string
}

export function ActionSection({ action, sourceMessageUlid, messageContent }: ActionSectionProps) {
  return (
    <div className="flex w-full flex-wrap justify-start gap-2">
      <InteractiveButton option={action} sourceMessageUlid={sourceMessageUlid} messageContent={messageContent} />
    </div>
  )
}

interface SuggestionsSectionProps {
  suggestions: SuggestionsMessage
  sourceMessageUlid: string
  messageContent?: string
}

export function SuggestionsSection({ suggestions, sourceMessageUlid, messageContent }: SuggestionsSectionProps) {
  const { widgetConfig } = useWidgetConfigContext()
  const design = widgetConfig.messagesConfig?.suggestions
  const align = design?.align ?? 'center'
  const justify = align === 'start' ? 'justify-start' : align === 'end' ? 'justify-end' : 'justify-center'
  if (!suggestions.options || suggestions.options.length === 0) return null

  return (
    <div className="flex w-full flex-col gap-2.5">
      {suggestions.text && (
        <p className="text-start text-[14px] leading-[130%] font-normal text-[#1A1A1A]" dir="auto">
          {suggestions.text}
        </p>
      )}
      <div className={`flex w-full flex-wrap gap-2 ${justify}`}>
        {suggestions.options.map((option, idx) => (
          <InteractiveButton
            key={idx}
            option={option}
            sourceMessageUlid={sourceMessageUlid}
            messageContent={messageContent}
          />
        ))}
      </div>
    </div>
  )
}

interface NextMessagesSectionProps {
  nextMessages?: NextMessageItem[]
  suggestions?: SuggestionsMessage
  sourceMessageUlid: string
  messageContent?: string
}

export function NextMessagesSection({
  nextMessages,
  suggestions,
  sourceMessageUlid,
  messageContent,
}: NextMessagesSectionProps) {
  const items: NextMessageItem[] =
    nextMessages && nextMessages.length > 0 ? nextMessages : suggestions ? [suggestions] : []

  if (items.length === 0) return null

  return (
    <div className="flex w-full flex-col gap-3">
      {items.map((item, idx) => {
        if (!item || typeof item !== 'object') return null
        const obj = item as Record<string, unknown>

        if (obj.type === 'location_request') {
          return <LocationRequestButton key={`loc-${idx}`} text={typeof obj.text === 'string' ? obj.text : undefined} />
        }

        if (obj.type === 'product_card_set') {
          return (
            <ProductSection
              key={`prod-${idx}`}
              productSet={item as ProductCardSet}
              sourceMessageUlid={sourceMessageUlid}
            />
          )
        }

        if (obj.type === 'action' || 'action_name' in obj) {
          return (
            <ActionSection
              key={`action-${idx}`}
              action={item as SuggestionAction}
              sourceMessageUlid={sourceMessageUlid}
              messageContent={messageContent}
            />
          )
        }

        if (obj.type === 'suggestions' || ('options' in obj && Array.isArray(obj.options))) {
          return (
            <SuggestionsSection
              key={`sug-${idx}`}
              suggestions={item as SuggestionsMessage}
              sourceMessageUlid={sourceMessageUlid}
              messageContent={messageContent}
            />
          )
        }

        return null
      })}
    </div>
  )
}
