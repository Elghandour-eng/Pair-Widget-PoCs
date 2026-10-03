import { HeaderActionsRow } from '@/components/header-actions-row'
import { HeaderControls } from '@/components/header-controls'
import { BackIcon } from '@/components/icons/back-icon'
import { CartIcon } from '@/components/icons/cart-icon'
import { FavoritesIcon } from '@/components/icons/favorites-icon'
import { Button } from '@/components/ui/button'
import { WidgetAvatar } from '@/components/widget-avatar'
import { WidgetCloseBtn } from '@/components/widget-close-btn'
import { WidgetHeader } from '@/components/widget-header'
import { REPLY_TIME_MAP } from '@/constants/reply-time'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { isSseTransport } from '@/core/sse-transport'

interface ConversationHeaderProps {
  isHostOnline?: boolean
}

function ConversationHeader({ isHostOnline = true }: ConversationHeaderProps) {
  const { widgetConfig } = useWidgetConfigContext()
  const { navigateToIntro, navigateToConversation } = useWidgetNavigation()
  const replyTimeText = REPLY_TIME_MAP[widgetConfig.reply_time || 'in_a_few_hours']
  const h = widgetConfig.headerConfig

  const handleBack = () => {
    navigateToIntro()
  }

  // Determine header background. The title's colour cascades to every icon in
  // the row (back, controls, cart, close all draw in currentColor), so a dark
  // theme does not leave black glyphs on a black header.
  const headerStyle: React.CSSProperties = {
    color: (h?.titleStyle?.color as string) ?? undefined,
    ...(h && h.backgroundEnabled && h.backgroundColor
      ? { backgroundColor: h.backgroundColor }
      : h && !h.backgroundEnabled && widgetConfig.widgetBgColor
        ? { backgroundColor: widgetConfig.widgetBgColor }
        : {}),
  }

  // Resolve display text + styles. A studio-configured header says exactly what
  // its subtitle is — an empty one means none, not the reply-time fallback.
  const titleText = h?.title || widgetConfig.name
  const subtitleText = h ? h.subtitle : isHostOnline ? replyTimeText : 'We will be back as soon as possible'

  // Use header iconUrl if provided, else fall back to widget avatar
  const useHeaderIcon = !!h?.iconUrl

  return (
    <WidgetHeader className="flex-row items-center gap-2 ps-2 pt-5 pb-5 shadow-xs" style={headerStyle}>
      <Button variant="ghost" size="icon-sm" onClick={handleBack}>
        <BackIcon className="h-3 w-auto" />
      </Button>
      <div className="flex items-center gap-2">
        {useHeaderIcon ? (
          <img
            src={h!.iconUrl!}
            alt="Widget avatar"
            className="h-12.5 w-12.5 rounded-2xl object-cover"
            style={h?.iconStyle}
          />
        ) : (
          <WidgetAvatar showIconFallback={true} style={h?.iconStyle} />
        )}

        <div>
          <h1
            className="align-middle text-[20px] leading-[130%] font-medium tracking-[0%] text-[#1E1E1E]"
            style={h?.titleStyle}
          >
            {titleText}
          </h1>
          {subtitleText && (
            <div className="flex gap-1.5">
              {/* Green online dot */}
              {isHostOnline && <div className="size-1.5 shrink-0 rounded-full bg-[#3AA36B]" />}
              <span
                className="text-[16px] leading-[150%] font-normal tracking-[0%] text-[#85888E]"
                style={h?.subtitleStyle}
              >
                {subtitleText}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right-side actions: Language/Theme → Cart → Favorites → Close */}
      <HeaderActionsRow>
        {isSseTransport() && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New conversation"
            title="محادثة جديدة"
            onClick={() => navigateToConversation(null)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </Button>
        )}
        <HeaderControls />
        {h?.actions?.cart && (
          <Button variant="ghost" size="icon-sm" aria-label="Cart">
            <CartIcon />
          </Button>
        )}
        {h?.actions?.favorites && (
          <Button variant="ghost" size="icon-sm" aria-label="Favorites">
            <FavoritesIcon />
          </Button>
        )}
        <WidgetCloseBtn />
      </HeaderActionsRow>
    </WidgetHeader>
  )
}

export { ConversationHeader }
