import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useSubmitCsat } from '@/features/conversation/hooks/use-submit-csat'
import type { InteractiveMetadata, Message } from '@/features/conversation/types/message'
import { cn } from '@/lib/utils'
import { getWidgetId } from '@/utils/widget-id'
import { Check, List, Star, X } from 'lucide-react'
import { useState } from 'react'
import { MessageLayout } from './message-layout'

interface CsatMessageProps {
  message: Message
  isUnread: boolean
  primaryColor: string
  websiteName: string
}

interface OptionItem {
  id: string
  title: string
  weight: number
  description?: string
}

export function CsatMessage({ message, isUnread, primaryColor, websiteName }: CsatMessageProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  const metadata = message.interactive_metadata as InteractiveMetadata | undefined
  const config = metadata?.csat_config
  const listConfig = metadata?.list_config

  const headerText = metadata?.header_text || (metadata as any)?.title_text || 'Customer Satisfaction Survey'
  const bodyText = metadata?.body_text || config?.message || 'How was your experience?'
  const buttonText = listConfig?.button_text || config?.button_text || 'Rate Experience'
  const displayType = config?.display_type || 'text_options'

  // Build normalized options with weight
  const rows = listConfig?.sections?.[0]?.rows || []
  const configOptions = config?.options || []

  const options: OptionItem[] = rows.length
    ? rows.map((row, idx) => {
        let weight = idx + 1
        const parsedId = parseInt(row.id.replace('rating_', ''), 10)
        if (!isNaN(parsedId) && parsedId >= 1 && parsedId <= 5) weight = parsedId
        const matched = configOptions.find((o) => o.text.toLowerCase() === row.title.toLowerCase())
        if (matched?.weight) weight = matched.weight
        return { id: row.id, title: row.title, weight, description: row.description }
      })
    : configOptions.map((opt, idx) => ({
        id: `opt-${opt.weight ?? idx + 1}`,
        title: opt.text,
        weight: opt.weight ?? idx + 1,
      }))

  const { conversationId } = useWidgetNavigation()
  const { mutate: submitCsat, isPending } = useSubmitCsat()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return

    const widgetId = getWidgetId()
    if (!widgetId || !conversationId) return

    const selected = options.find((o) => o.id === selectedId)
    if (!selected) return

    submitCsat(
      { widgetId, conversationId, rating: selected.weight, survey_message_ulid: message.ulid },
      {
        onSuccess: () => {
          setSubmittedId(selectedId)
          setIsOpen(false)
        },
      },
    )
  }

  const sortedOptions = [...options].sort((a, b) => a.weight - b.weight)

  return (
    <MessageLayout message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName}>
      <div className="dark:bg-card flex w-full max-w-sm min-w-70 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800">
        {/* Title & Subtitle */}
        <div className="mb-4 flex flex-col gap-1 text-left">
          <div className="text-muted-foreground text-xs font-semibold uppercase">{headerText}</div>
          <div className="text-foreground text-base font-semibold">{bodyText}</div>
        </div>

        {/* Trigger Button */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex w-full items-center justify-center">
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                type="button"
                className="mx-auto flex h-auto cursor-pointer items-center justify-center gap-2 p-0 font-['Outfit',sans-serif] text-[14px] leading-normal text-(--BLUE-Pair,#4D98E2) not-italic transition-colors duration-200 hover:bg-transparent hover:text-[#1a6bbf]"
              >
                <List className="h-4 w-4 shrink-0" />
                <span>{submittedId ? 'Change Rating' : buttonText}</span>
              </Button>
            </DialogTrigger>
          </div>

          <DialogContent
            showCloseButton={false}
            aria-describedby={undefined}
            className="data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4 inset-x-0 top-auto bottom-0 max-w-full translate-x-0 translate-y-0 gap-0 rounded-t-2xl rounded-b-none p-0 sm:max-w-full"
          >
            <form onSubmit={handleSubmit} className="flex w-full flex-col">
              {/* Custom Header: title left, X button right */}
              <div className="flex items-center justify-between border-b border-[#D1CECD] px-6 pt-6 pb-4">
                <DialogTitle className="font-['DM_Sans',sans-serif] text-[20px] leading-[120%] font-medium text-[#1A1A1A] not-italic">
                  {bodyText}
                </DialogTitle>
                <DialogClose asChild>
                  <button
                    type="button"
                    className="cursor-pointer rounded-sm p-1 text-[#474747] transition-opacity hover:opacity-70 focus:outline-none"
                  >
                    <X size={24} color="#474747" />
                  </button>
                </DialogClose>
              </div>

              {/* Body: chips or stars */}
              {displayType === 'star' ? (
                <div className="flex flex-col p-0">
                  {sortedOptions.map((opt) => {
                    const isSelected = selectedId === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedId(opt.id)}
                        className="flex w-full cursor-pointer items-center justify-between border-b border-[#D1CECD] px-6 py-4 text-left transition-colors last:border-b-0 hover:bg-gray-50/50"
                      >
                        {/* Child 1: Star group + description */}
                        <div className="flex flex-col items-start gap-2">
                          {/* Stars Row */}
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: opt.weight }).map((_, i) => (
                              <Star key={i} size={20} className="fill-[#FFB400] text-[#FFB400]" />
                            ))}
                          </div>
                          {/* Description */}
                          {opt.description && (
                            <p className="font-['Outfit',sans-serif] text-[12px] leading-normal font-normal text-[#797B86] not-italic">
                              {opt.description}
                            </p>
                          )}
                        </div>

                        {/* Child 2: Custom Radio Button */}
                        <div
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#D0D5DD] transition-colors duration-150',
                            isSelected && 'border-(--BLUE-Pair,#4D98E2)',
                          )}
                        >
                          {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-(--BLUE-Pair,#4D98E2)" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="px-6 pt-6 pb-6">
                  <div className="flex flex-wrap gap-2">
                    {options.map((opt) => {
                      const isSelected = selectedId === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelectedId(opt.id)}
                          className={cn(
                            'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors duration-150',
                            isSelected ? 'border-[#E5E4E1] bg-[#EEECE1]' : 'border-[#E5E4E1] bg-white hover:bg-gray-50',
                          )}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-gray-700" />}
                          <span className="text-gray-800">{opt.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Footer */}
              <DialogFooter className="bg-[#FFF] px-6 py-4 shadow-[0_-2px_12px_0_rgba(0,0,0,0.08)]">
                <Button
                  type="submit"
                  disabled={!selectedId || isPending}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[#1A1A1A] px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-[#F0F0F0] disabled:text-[#A0A0A0] disabled:opacity-100"
                >
                  {isPending ? 'Submitting…' : 'Submit Feedback'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MessageLayout>
  )
}
