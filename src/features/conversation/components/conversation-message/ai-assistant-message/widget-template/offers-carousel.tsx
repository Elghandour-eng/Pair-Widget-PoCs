import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useDispatchAction } from '@/features/conversation/hooks/use-dispatch-action'
import type { CarouselTemplate } from '@/features/conversation/types/message'
import useEmblaCarousel from 'embla-carousel-react'
import { BadgePercent, Check, Copy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

interface OffersCarouselProps {
  template: CarouselTemplate
  sourceMessageUlid: string
}

export function OffersCarousel({ template, sourceMessageUlid }: OffersCarouselProps) {
  const { content, carousel_type, config } = template
  const { title, intro_text, closing_text, items } = content

  const showDots = config?.layout?.show_pagination_dots !== false

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'start' })
  const [activeIndex, setActiveIndex] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: dispatchActionMutation } = useDispatchAction()

  // Sync active dot with embla scroll
  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setActiveIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  const scrollTo = (index: number) => emblaApi?.scrollTo(index)

  const handleCopyCode = async (code: string, itemId?: string) => {
    // Attempt modern Clipboard API first
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code)
        setCopiedId(itemId ?? code)
        setTimeout(() => setCopiedId(null), 2000)
        return
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback copy mechanism (works inside sandboxed iframes/less privileged contexts)
    try {
      const textArea = document.createElement('textarea')
      textArea.value = code
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '-9999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)

      if (successful) {
        setCopiedId(itemId ?? code)
        setTimeout(() => setCopiedId(null), 2000)
      } else {
        toast.error("Couldn't copy the code. Try again.")
      }
    } catch {
      toast.error("Couldn't copy the code. Try again.")
    }
  }

  const handleAction = async (act: NonNullable<CarouselTemplate['content']['items'][number]['actions']>[number]) => {
    if (!conversationId) {
      toast.error('Conversation ID is missing')
      return
    }
    setLoadingAction(act.type)
    try {
      const res = await dispatchActionMutation({
        conversationId,
        actionUlid: '',
        sourceMessageUlid,
        parameters: act.payload || {},
      })
      if (res.success) {
        toast.success(act.label ? `${act.label} done!` : 'Action succeeded')
      } else {
        toast.error(res.error_message || 'Action failed')
      }
    } catch {
      toast.error('Failed to execute action')
    } finally {
      setLoadingAction(null)
    }
  }

  const renderFormattedText = (text: string) => {
    // Find if the text contains any coupon code from items
    const matchingCode = items.map((item) => item.code).find((code) => text.includes(code))
    if (!matchingCode) {
      return (
        <span className="font-['DM_Sans'] text-[14px] leading-[130%] text-(--Text-Dark-Primary,#1A1A1A) not-italic">
          {text}
        </span>
      )
    }

    const parts = text.split(matchingCode)
    return (
      <span className="font-['DM_Sans'] text-[14px] leading-[130%] text-(--Text-Dark-Primary,#1A1A1A) not-italic">
        {parts.map((part, idx) => (
          <span key={idx}>
            {part}
            {idx < parts.length - 1 && (
              <span className="leading-[150%] font-semibold text-(--Text-Dark-Primary,#1A1A1A)">{matchingCode}</span>
            )}
          </span>
        ))}
      </span>
    )
  }

  const renderDescriptionText = (desc: string) => {
    const regex = /(terms\s*(?:and|&)\s*conditions)/i
    const match = desc.match(regex)
    if (!match) {
      return (
        <span className="font-['DM_Sans'] text-[14px] leading-[130%] text-(--Text-Dark-Secondary,#616161) not-italic">
          {desc}
        </span>
      )
    }

    const parts = desc.split(regex)
    return (
      <span className="font-['DM_Sans'] text-[14px] leading-[130%] not-italic">
        {parts.map((part, idx) => {
          const isTerms = regex.test(part)
          return (
            <span
              key={idx}
              className={
                isTerms
                  ? 'leading-[150%] font-semibold text-(--Text-Dark-Primary,#1A1A1A)'
                  : 'text-(--Text-Dark-Secondary,#616161)'
              }
            >
              {part}
            </span>
          )
        })}
      </span>
    )
  }

  if (carousel_type !== 'offers') return null

  return (
    <section className="flex w-full min-w-0 flex-col gap-5">
      {/* Intro text */}
      {intro_text && <p>{renderFormattedText(intro_text)}</p>}

      {/* Section header */}
      {title && (
        <div className="flex items-center gap-1.5">
          <BadgePercent className="h-5 w-5 shrink-0 text-[#1A1A1A]" strokeWidth={1.8} />
          <h2 className="text-[18px] leading-6.75 font-semibold text-[#1A1A1A]">{title}</h2>
        </div>
      )}

      {/* Embla carousel + dots */}
      <div className="flex flex-col gap-3">
        {/* Embla viewport — overflow hidden, no leakage */}
        <div ref={emblaRef} className="w-full min-w-0 overflow-hidden">
          <div className="flex">
            {items.map((item, idx) => {
              const isCopied = copiedId === (item.id ?? item.code)
              const viewDetailsAct = item.actions?.find((a) => a.type === 'view_details')
              const viewProductsAct = item.actions?.find((a) => a.type === 'view_eligible_products')

              return (
                <div
                  key={item.id ?? idx}
                  /* Each slide: flex-[0_0_100%] + min-w-0 prevents content from dictating slide width */
                  className="relative w-full min-w-0 flex-[0_0_100%]"
                >
                  {/* Card */}
                  <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-white p-4">
                    {/* Fake border to allow masking (works around overflow-hidden container clipping/stacking issue) */}
                    <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl border border-[#E5E4E1]" />

                    {/* Mask to hide the container's left border behind the circles */}
                    <div className="absolute top-1/2 -left-px z-20 h-13.5 w-0.5 -translate-y-1/2 bg-[#FAFAFA]" />

                    {/* Notch cut-outs on left edge */}
                    <div className="pointer-events-none absolute top-1/2 left-0 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-0">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-4.5 w-4.5 rounded-full bg-[#FAFAFA]"
                          style={{ border: '1.5px solid #E5E4E1' }}
                        />
                      ))}
                    </div>

                    {/* Top row: code badge + copy */}
                    <div className="flex items-center justify-between gap-2 pl-3">
                      <div className="relative rounded-lg bg-(--Surface-Pastels-Blue,#E3F1FD) px-2 py-1">
                        {/* Custom dashed border overlay */}
                        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                          <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            rx="4"
                            fill="none"
                            stroke="var(--Alert-Info-Stroke-Blue, #CEE6F2)"
                            strokeWidth="1.5"
                            strokeDasharray="6 3"
                          />
                        </svg>
                        <span className="relative z-10 text-[12px] leading-[150%] font-semibold text-(--Alert-Info-Text-Blue,#195D7F) not-italic">
                          {item.code}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyCode(item.code, item.id)}
                        className="flex items-center gap-1.5 text-[13px] text-[#757575] transition-opacity hover:opacity-70"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-4 w-4 text-[#1E7E34]" />
                            <span className="text-[#1E7E34]">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy Code
                          </>
                        )}
                      </button>
                    </div>

                    {/* Title + description */}
                    <div className="flex flex-col gap-1 pl-3">
                      <h3 className="text-[16px] leading-6 font-semibold text-[#180904]">{item.title}</h3>
                      {item.description && <p>{renderDescriptionText(item.description)}</p>}
                    </div>

                    {/* Action buttons */}
                    {(viewDetailsAct || viewProductsAct) && (
                      <div className="flex gap-3 pl-3">
                        {viewDetailsAct && (
                          <button
                            type="button"
                            disabled={loadingAction !== null}
                            onClick={() => handleAction(viewDetailsAct)}
                            className="flex flex-1 items-center justify-center rounded-xl border border-[#1A1A1A] bg-transparent px-3 py-2.25 text-[14px] text-[#1A1A1A] transition-colors hover:bg-white/60 disabled:opacity-50"
                          >
                            {viewDetailsAct.label}
                          </button>
                        )}
                        {viewProductsAct && (
                          <button
                            type="button"
                            disabled={loadingAction !== null}
                            onClick={() => handleAction(viewProductsAct)}
                            className="flex flex-[1.6] items-center justify-center rounded-xl bg-[#1A1A1A] px-3 py-2.25 text-[14px] text-white transition-colors hover:bg-[#333333] disabled:opacity-50"
                          >
                            {loadingAction === 'view_eligible_products' ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              viewProductsAct.label
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pagination dots */}
        {showDots && items.length > 1 && (
          <div className="flex items-center gap-1">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Go to offer ${idx + 1}`}
                onClick={() => scrollTo(idx)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: idx === activeIndex ? '32px' : '6px',
                  background: idx === activeIndex ? '#CAC8C6' : '#F2F1ED',
                  border: '1px solid #E0DED9',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Closing text */}
      {closing_text && <p>{renderFormattedText(closing_text)}</p>}
    </section>
  )
}
