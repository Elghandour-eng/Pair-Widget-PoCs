import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useDispatchAction } from '@/features/conversation/hooks/use-dispatch-action'
import type { ErrorCardTemplate } from '@/features/conversation/types/message'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface ErrorCardProps {
  template: ErrorCardTemplate
  sourceMessageUlid: string
}

export function ErrorCard({ template, sourceMessageUlid }: ErrorCardProps) {
  const { content, config } = template
  const { title, actions } = content

  const variant = config?.style?.variant ?? 'error'
  const isWarning = variant === 'warning'

  // Color scheme: error = red, warning = amber
  const colors = isWarning
    ? { bg: '#FFFBF0', border: '#F5E0A0', icon: '#B07D20', text: '#7A5200' }
    : { bg: '#FFF7F5', border: '#F2D6CE', icon: '#B20000', text: '#B20000' }

  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: dispatchActionMutation } = useDispatchAction()
  const [loadingAction, setLoadingAction] = useState(false)

  const handleAction = async (act: any) => {
    if (!conversationId) {
      toast.error('Conversation ID is missing')
      return
    }
    setLoadingAction(true)
    try {
      const res = await dispatchActionMutation({
        conversationId,
        actionUlid: act.id || act.action_ulid || '',
        sourceMessageUlid,
        parameters: act.payload || {},
      })
      if (res.success) {
        toast.success(act.label ? `${act.label} completed!` : 'Action succeeded')
      } else {
        toast.error(res.error_message || 'Action failed')
      }
    } catch {
      toast.error('Failed to execute action')
    } finally {
      setLoadingAction(false)
    }
  }

  const allowedActions = config?.actions?.allowed_actions ?? []
  const visibleActions = config?.actions?.enabled
    ? (actions ?? []).filter((a) => {
        const actionType = a.id || a.type
        return allowedActions.length === 0 || allowedActions.includes(actionType)
      })
    : []

  return (
    <div
      className="flex w-full items-start gap-2 rounded-xl border px-3 py-2"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      {/* Warning triangle icon */}
      <div className="mt-0.5 shrink-0">
        <TriangleAlert className="h-5 w-5" style={{ color: colors.icon }} strokeWidth={1.8} />
      </div>

      {/* Text content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[14px] leading-4.5 font-normal" style={{ color: colors.text }}>
          {title}
        </p>

        {/* Retry / action buttons */}
        {visibleActions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {visibleActions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                disabled={loadingAction}
                onClick={() => handleAction(act)}
                className="flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[12px] font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                {loadingAction ? (
                  <span
                    className="h-3 w-3 animate-spin rounded-full border-2 border-t-transparent"
                    style={{ borderColor: colors.icon }}
                  />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {act.label || 'Retry'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
