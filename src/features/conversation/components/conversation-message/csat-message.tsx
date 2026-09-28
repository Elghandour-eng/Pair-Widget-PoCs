import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { hexToRgba, isDarkBackground } from '@/lib/utils'
import { localizeDefault, uiText } from '@/lib/ui-strings'
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

  // The studio's rating section: text overrides and the compiled design.
  const { widgetConfig } = useWidgetConfigContext()
  const loc = widgetConfig.locale
  const studio = widgetConfig.csat
  const d = (studio?.design ?? {}) as Record<string, any>
  const rs = (c?: string) => (c === '#brand' ? primaryColor : c)

  // With no studio design saved, the survey still matches the widget's theme:
  // the fallbacks follow the widget background's own lightness.
  const dark = isDarkBackground(widgetConfig.widgetBgColor)
  const F = dark
    ? {
        cardBg: '#1C1C1E',
        cardBorder: '#2C2C2E',
        headerColor: '#A1A1A6',
        bodyColor: '#FFFFFF',
        dialogBg: '#141414',
        dialogTitle: '#FFFFFF',
        divider: '#2C2C2E',
        chipBg: '#1C1C1E',
        chipBorder: '#3A3A3C',
        chipText: '#F2F2F2',
        chipSelBg: '#3A3A3C',
        chipSelBorder: '#4A4A4E',
        chipSelText: '#FFFFFF',
        submitBg: '#FFFFFF',
        submitText: '#1A1A1A',
      }
    : {
        cardBg: '#FFFFFF',
        cardBorder: '#ECECED',
        headerColor: '#6E6E73',
        bodyColor: '#1A1A1A',
        dialogBg: '#FFFFFF',
        dialogTitle: '#1A1A1A',
        divider: '#D1CECD',
        chipBg: '#FFFFFF',
        chipBorder: '#E5E4E1',
        chipText: '#1F2937',
        chipSelBg: '#EEECE1',
        chipSelBorder: '#E5E4E1',
        chipSelText: '#1F2937',
        submitBg: '#1A1A1A',
        submitText: '#FFFFFF',
      }

  const headerText =
    studio?.header || localizeDefault(loc, metadata?.header_text || (metadata as any)?.title_text, 'csatHeader')
  const bodyText = studio?.body || localizeDefault(loc, metadata?.body_text || config?.message, 'csatBody')
  const buttonText =
    studio?.buttonText || localizeDefault(loc, listConfig?.button_text || config?.button_text, 'csatButton')
  const submitLabel = studio?.submitText || uiText(loc, 'csatSubmit')
  const displayType = d.forceType && d.forceType !== 'auto' ? d.forceType : config?.display_type || 'text_options'

  const shadowCss = d.card?.shadow
    ? `0 ${d.card.shadow.y ?? 2}px ${d.card.shadow.blur ?? 8}px ${hexToRgba(rs(d.card.shadow.color) ?? '#000000', d.card.shadow.opacity ?? 0.04)}`
    : undefined
  const btnStyle = (b: Record<string, any> | undefined, fallbackBg: string, fallbackColor: string) => ({
    fontFamily: b?.fontFamily || undefined,
    fontSize: b?.textSize ?? 14,
    color: rs(b?.textColor) ?? fallbackColor,
    background: rs(b?.background) ?? fallbackBg,
    borderRadius: b?.radius ?? 10,
    borderWidth: b?.borderWidth ?? 0,
    borderStyle: (b?.borderWidth ?? 0) > 0 ? ('solid' as const) : undefined,
    borderColor: rs(b?.borderColor),
    height: b?.height,
  })

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
      <div
        className="flex w-full max-w-sm min-w-70 flex-col overflow-hidden"
        style={{
          background: rs(d.card?.background) ?? F.cardBg,
          border: `${d.card?.borderWidth ?? 1}px solid ${rs(d.card?.borderColor) ?? F.cardBorder}`,
          borderRadius: d.card?.radius ?? 16,
          padding: d.card?.padding ?? 20,
          boxShadow: shadowCss,
        }}
      >
        {/* Title & Subtitle */}
        <div className="mb-4 flex flex-col gap-1 text-start">
          <div
            className="font-semibold uppercase"
            style={{
              color: rs(d.header?.color) ?? F.headerColor,
              fontSize: d.header?.size ?? 11,
              fontWeight: d.header?.weight,
            }}
          >
            {headerText}
          </div>
          <div
            className="font-semibold"
            style={{
              color: rs(d.body?.color) ?? F.bodyColor,
              fontSize: d.body?.size ?? 15,
              fontWeight: d.body?.weight,
            }}
          >
            {bodyText}
          </div>
        </div>

        {/* Trigger Button */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex w-full items-center justify-center">
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                type="button"
                className="flex cursor-pointer items-center justify-center gap-2 leading-normal transition-opacity duration-200 hover:bg-transparent hover:opacity-80"
                style={{
                  ...btnStyle(d.trigger, 'transparent', primaryColor),
                  width: d.trigger?.fullWidth ? '100%' : undefined,
                  marginInline: d.trigger?.fullWidth ? undefined : 'auto',
                  height: d.trigger?.height ?? 'auto',
                  paddingInline: d.trigger?.background && rs(d.trigger.background) !== 'transparent' ? 16 : 0,
                }}
              >
                <List className="h-4 w-4 shrink-0" />
                <span>{submittedId ? (studio?.buttonText ? buttonText : uiText(loc, 'csatChange')) : buttonText}</span>
              </Button>
            </DialogTrigger>
          </div>

          <DialogContent
            showCloseButton={false}
            aria-describedby={undefined}
            className="data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4 inset-x-0 top-auto bottom-0 max-w-full translate-x-0 translate-y-0 gap-0 rounded-t-2xl rounded-b-none p-0 sm:max-w-full"
            style={{ background: rs(d.dialog?.background) ?? F.dialogBg }}
          >
            <form onSubmit={handleSubmit} className="flex w-full flex-col">
              {/* Custom Header: title left, X button right */}
              <div
                className="flex items-center justify-between border-b px-6 pt-6 pb-4"
                style={{ borderColor: rs(d.dialog?.dividerColor) ?? F.divider }}
              >
                <DialogTitle
                  className="font-['DM_Sans',sans-serif] text-[20px] leading-[120%] font-medium not-italic"
                  style={{ color: rs(d.dialog?.titleColor) ?? F.dialogTitle }}
                >
                  {bodyText}
                </DialogTitle>
                <DialogClose asChild>
                  <button
                    type="button"
                    className="cursor-pointer rounded-sm p-1 transition-opacity hover:opacity-70 focus:outline-none"
                    style={{ color: rs(d.dialog?.titleColor) ?? F.dialogTitle }}
                  >
                    <X size={24} />
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
                        className="flex w-full cursor-pointer items-center justify-between border-b px-6 py-4 text-start transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,currentColor_5%,transparent)]"
                        style={{ borderColor: rs(d.dialog?.dividerColor) ?? F.divider }}
                      >
                        {/* Child 1: Star group + description */}
                        <div className="flex flex-col items-start gap-2">
                          {/* Stars Row */}
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: opt.weight }).map((_, i) => (
                              <Star
                                key={i}
                                size={d.stars?.size ?? 20}
                                style={{
                                  fill: rs(d.stars?.color) ?? '#FFB400',
                                  color: rs(d.stars?.color) ?? '#FFB400',
                                }}
                              />
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
                          className="flex cursor-pointer items-center gap-1.5 border px-3 py-2 transition-colors duration-150 hover:opacity-90"
                          style={{
                            borderRadius: d.chips?.radius ?? 999,
                            fontSize: d.chips?.textSize ?? 13,
                            background: isSelected
                              ? (rs(d.chips?.selectedBackground) ?? F.chipSelBg)
                              : (rs(d.chips?.background) ?? F.chipBg),
                            borderColor: isSelected
                              ? (rs(d.chips?.selectedBorderColor) ?? F.chipSelBorder)
                              : (rs(d.chips?.borderColor) ?? F.chipBorder),
                            color: isSelected
                              ? (rs(d.chips?.selectedTextColor) ?? F.chipSelText)
                              : (rs(d.chips?.textColor) ?? F.chipText),
                          }}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                          <span>{opt.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Footer */}
              <DialogFooter
                className="px-6 py-4 shadow-[0_-2px_12px_0_rgba(0,0,0,0.08)]"
                style={{ background: rs(d.dialog?.background) ?? F.dialogBg }}
              >
                <Button
                  type="submit"
                  disabled={!selectedId || isPending}
                  className="flex flex-1 items-center justify-center gap-2 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-45"
                  style={btnStyle(d.submit, F.submitBg, F.submitText)}
                >
                  {isPending ? uiText(loc, 'submitting') : submitLabel}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MessageLayout>
  )
}
