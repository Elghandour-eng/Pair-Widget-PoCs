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

interface ConversationHeaderProps {
  isHostOnline?: boolean
}

function ConversationHeader({ isHostOnline = true }: ConversationHeaderProps) {
  const { widgetConfig } = useWidgetConfigContext()
  const { navigateToIntro } = useWidgetNavigation()
  const replyTimeText = REPLY_TIME_MAP[widgetConfig.reply_time || 'in_a_few_hours']
  const h = widgetConfig.headerConfig

  const handleBack = () => {
    navigateToIntro()
  }

  // Determine header background
  const headerStyle: React.CSSProperties | undefined =
    h && h.backgroundEnabled && h.backgroundColor
      ? { backgroundColor: h.backgroundColor }
      : h && !h.backgroundEnabled && widgetConfig.widgetBgColor
        ? { backgroundColor: widgetConfig.widgetBgColor }
        : undefined

  // Resolve display text + styles
  const titleText = h?.title || widgetConfig.name
  const subtitleText = h?.subtitle || (isHostOnline ? replyTimeText : 'We will be back as soon as possible')

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
        </div>
      </div>

      {/* Right-side actions: Cart → Favorites → Close */}
      <div className="flex flex-1 items-center justify-end gap-1 self-start">
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
      </div>
    </WidgetHeader>
  )
}

export { ConversationHeader }
