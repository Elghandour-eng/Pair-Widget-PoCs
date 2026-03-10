import { EmojiIcon } from '@/components/icons/emoji-icon'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useSubmitCsat } from '@/features/conversation/hooks/use-submit-csat'
import type { InteractiveMetadata, Message } from '@/features/conversation/types/message'
import { cn } from '@/lib/utils'
import { getWidgetId } from '@/utils/widget-id'
import { ChevronDown, Star } from 'lucide-react'
import { useState } from 'react'
import { MessageLayout } from './message-layout'

interface CsatMessageProps {
  message: Message
  isUnread: boolean
  primaryColor: string
  websiteName: string
}

export function CsatMessage({ message, isUnread, primaryColor, websiteName }: CsatMessageProps) {
  const [expanded, setExpanded] = useState(false)
  const [submittedRatingId, setSubmittedRatingId] = useState<string | null>(null)

  const metadata = message.interactive_metadata as InteractiveMetadata | undefined
  const config = metadata?.csat_config
  const listConfig = metadata?.list_config

  const section = listConfig?.sections?.[0]
  const rows = section?.rows || []

  // Extract display type to customize icons if needed
  const displayType = config?.display_type

  const { conversationId } = useWidgetNavigation()
  const { mutate: submitCsat } = useSubmitCsat()

  const handleRating = (ratingId: string) => {
    const widgetId = getWidgetId()

    if (!widgetId) {
      console.error('Widget ID not found')
      return
    }

    if (!conversationId) {
      console.error('Conversation ID not found')
      return
    }

    submitCsat(
      {
        widgetId,
        conversationId,
        rating: Number(ratingId),
        survey_message_ulid: message.ulid,
      },
      {
        onSuccess: () => {
          console.log(`Rating submitted: ${ratingId}`)
          setSubmittedRatingId(ratingId)
          // Keep expanded for a moment to show feedback, or collapse?
          // UX: Better to show "Thanks" feedback or highlight selection.
          // We'll keep it expanded but locked? Or just highlight.
          setTimeout(() => setExpanded(false), 300)
        },
      },
    )
  }

  const headerText = metadata?.header_text || (metadata as any)?.title_text
  const bodyText = metadata?.body_text
  const footerText = metadata?.footer_text
  const buttonText = listConfig?.button_text || 'Rate Experience'

  if (!rows.length) return null

  // Find selected option text for display when collapsed
  const selectedOption = rows.find((r) => r.id === submittedRatingId)

  return (
    <MessageLayout message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName}>
      <div
        className="dark:bg-card flex w-full max-w-sm min-w-70 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-800"
        style={{ '--primary-color': primaryColor } as React.CSSProperties}
      >
        {/* Card Header Content */}
        <div className="flex flex-col gap-1.5 p-5 pb-3">
          {headerText && (
            <div className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">{headerText}</div>
          )}
          {bodyText && <div className="text-foreground text-lg leading-relaxed font-semibold">{bodyText}</div>}
        </div>

        {/* Action Area */}
        <div className="px-5 pb-5">
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              'group focus:ring-primary/20 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 focus:ring-2 focus:outline-none',
              {
                'border-primary bg-primary/5 text-primary': expanded || submittedRatingId,
                'dark:bg-muted/30 border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200':
                  !expanded && !submittedRatingId,
              },
            )}
          >
            <div className="flex items-center gap-2">
              {/* Show icon based on state */}
              {submittedRatingId && displayType === 'star' ? <Star className="h-4 w-4 fill-current" /> : null}
              {submittedRatingId && displayType === 'emoji' ? <EmojiIcon className="h-4 w-4" /> : null}

              <span>{selectedOption ? `You rated: ${selectedOption.title}` : buttonText}</span>
            </div>
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-300', { 'rotate-180': expanded })} />
          </button>

          {/* Accordion Content */}
          <div
            className={cn('grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out', {
              'mt-2 grid-rows-[1fr] opacity-100': expanded,
              'mt-0 grid-rows-[0fr] opacity-0': !expanded,
            })}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2 pt-1">
                {rows.map((row) => {
                  const isSelected = submittedRatingId === row.id
                  return (
                    <button
                      key={row.id}
                      onClick={() => handleRating(row.id)}
                      className={cn(
                        'group flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
                        {
                          'bg-primary scale-[1.02] transform text-white shadow-md': isSelected,
                          'dark:hover:bg-muted/50 text-foreground bg-transparent hover:bg-gray-100': !isSelected,
                        },
                      )}
                    >
                      <span
                        className={cn('text-2xl transition-transform duration-200 group-hover:scale-110', {
                          'scale-110': isSelected,
                        })}
                      >
                        {row.title}
                      </span>
                      <div className="flex flex-col overflow-hidden">
                        <span
                          className={cn('truncate text-sm font-medium', {
                            'text-white': isSelected,
                            'text-gray-900 dark:text-gray-100': !isSelected,
                          })}
                        >
                          {row.description}
                        </span>
                      </div>

                      {/* Selection Checkmark Indicator (optional, explicit feedback) */}
                      {isSelected && (
                        <div className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                          <div className="h-2 w-2 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {footerText && <div className="text-muted-foreground/60 mt-3 text-center text-xs">{footerText}</div>}
        </div>
      </div>
    </MessageLayout>
  )
}
