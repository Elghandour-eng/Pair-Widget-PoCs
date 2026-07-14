import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useDispatchAction } from '@/features/conversation/hooks/use-dispatch-action'
import type { InformativeTemplateData } from '@/features/conversation/types/message'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface InformativeTemplateProps {
  template: InformativeTemplateData
  sourceMessageUlid: string
}

export function InformativeTemplate({ template, sourceMessageUlid }: InformativeTemplateProps) {
  const { content, config } = template
  const { intro_text, header, closing_text } = content
  const { title, action, items } = header

  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: dispatchActionMutation } = useDispatchAction()
  const [loadingAction, setLoadingAction] = useState(false)
  const [actionSuccess, setActionSuccess] = useState(false)

  const isCopyCode = action?.type === 'copy_code'
  const showAction = config?.informative_header?.show_action !== false

  const handleAction = async (act: any) => {
    if (!conversationId) {
      toast.error('Conversation ID is missing')
      return
    }

    // For copy_code, handle client-side clipboard copy
    if (act.type === 'copy_code' && act.payload?.code) {
      try {
        await navigator.clipboard.writeText(act.payload.code)
        setActionSuccess(true)
        toast.success('Code copied!')
        setTimeout(() => setActionSuccess(false), 2000)
        return
      } catch {
        // fallback to server dispatch
      }
    }

    setLoadingAction(true)
    try {
      const res = await dispatchActionMutation({
        conversationId,
        actionUlid: act.action_ulid || '',
        sourceMessageUlid,
        parameters: act.payload || {},
      })
      if (res.success) {
        toast.success(act.label ? `${act.label} completed!` : 'Action succeeded')
        if (isCopyCode) {
          setActionSuccess(true)
          setTimeout(() => setActionSuccess(false), 2000)
        }
      } else {
        toast.error(res.error_message || 'Action failed')
      }
    } catch (err) {
      toast.error('Failed to execute action')
    } finally {
      setLoadingAction(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {/* Intro text */}
      {intro_text && <p className="text-[14px] leading-4.5 text-[#1F1F1F]">{intro_text}</p>}

      {/* Informative Card */}
      <div className="overflow-hidden rounded-[10px] border border-[#E5E5E5] bg-white" style={{ padding: '12px' }}>
        {/* Card Header */}
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <h2 className="text-[16px] leading-5.5 font-semibold text-[#1F1F1F]">{title}</h2>

          {action && showAction && (
            <button
              type="button"
              disabled={loadingAction}
              onClick={() => handleAction(action)}
              className="flex shrink-0 items-center gap-1 text-[13px] leading-4.5 font-medium text-[#0066CC] underline underline-offset-2 transition-opacity hover:opacity-70 disabled:opacity-50"
            >
              {actionSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied!
                </>
              ) : isCopyCode ? (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {action.label}
                </>
              ) : (
                action.label
              )}
            </button>
          )}
        </div>

        {/* Items list */}
        <ul className="flex flex-col">
          {items.map((item, idx) => {
            return (
              <li key={item.id || idx}>
                {/* Divider above every item except first */}
                {idx > 0 && <div className="my-2.5 h-px bg-[#EEEEEE]" />}

                <div className="flex flex-col gap-1">
                  {/* Item title */}
                  {item.title && (
                    <span className="text-[13px] leading-4.5 font-semibold text-[#B07D20]">{item.title}</span>
                  )}

                  {/* Description or list */}
                  {item.description_type === 'list' && item.description_items ? (
                    <ul className="flex flex-col gap-1 pl-4" style={{ listStyleType: 'disc' }}>
                      {item.description_items.map((descItem, descIdx) => (
                        <li
                          key={descIdx}
                          className="text-[14px] leading-4.75 text-[#222222]"
                          style={{ display: 'list-item' }}
                        >
                          {descItem}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    item.description && <p className="text-[14px] leading-4.75 text-[#555555]">{item.description}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Closing text */}
      {closing_text && <p className="text-[14px] leading-4.5 text-[#1F1F1F]">{closing_text}</p>}
    </section>
  )
}
