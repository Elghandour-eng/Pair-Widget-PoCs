import { WidgetContent } from '@/components/widget-content'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { QuickLinksList } from '@/features/intro/components/quick-links-list'
import { TrendingPrompts } from '@/features/intro/components/trending-prompts'
import { cn } from '@/lib/utils'

export function IntroContent() {
  const { widgetConfig } = useWidgetConfigContext()
  const introConfig = widgetConfig.introScreen
  const quickLinksConfig = widgetConfig.quickLinks

  const hasQuickLinks = !!quickLinksConfig?.show && (quickLinksConfig.links || []).length > 0

  const heroImageStyles = introConfig?.heroImage?.styles as Record<string, unknown> | undefined
  const hasExplicitHeight = !!(heroImageStyles?.height || heroImageStyles?.maxHeight || heroImageStyles?.['max-height'])

  const heroImage = introConfig?.heroImage && (
    <div
      className={cn('w-full', !hasQuickLinks && 'flex justify-center')}
      style={introConfig.heroImage.containerStyles}
    >
      <img
        src={introConfig.heroImage.url}
        alt="Hero image"
        className={cn(!hasExplicitHeight && 'max-h-31', 'w-full rounded object-cover', !hasQuickLinks && 'mx-auto')}
        style={introConfig.heroImage.styles}
      />
    </div>
  )

  const showQuickLinksAbove = hasQuickLinks && quickLinksConfig?.position === 'above_welcome'
  const showQuickLinksUnder = hasQuickLinks && quickLinksConfig?.position !== 'above_welcome'

  return (
    <WidgetContent className="flex h-full flex-col gap-6 overflow-auto">
      {widgetConfig.widgetTitle?.text && (
        <div className="text-start text-[1.25rem] font-bold text-[#1E1E1E]" style={widgetConfig.widgetTitle.styles}>
          {widgetConfig.widgetTitle.text}
        </div>
      )}
      {hasQuickLinks ? (
        <>
          {introConfig?.heroImage?.position === 'top' && heroImage}
          {showQuickLinksAbove && <QuickLinksList />}
          <div>
            <h1
              className="mb-2 font-['DM_Sans'] text-[1.5rem] leading-[120%] font-semibold text-[#1A1A1A]"
              style={introConfig?.welcomeTitleStyles}
            >
              {introConfig?.welcomeTitle ?? 'Please add a title'}
            </h1>

            <p
              className="font-['DM_Sans'] text-[0.875rem] leading-[130%] font-normal text-[#1A1A1A]"
              style={introConfig?.welcomeSubtitleStyles}
            >
              {introConfig?.welcomeSubtitle ?? 'Please add a subtitle'}
            </p>
          </div>
          {introConfig?.heroImage?.position === 'bottom' && heroImage}
          {showQuickLinksUnder && <QuickLinksList />}
          <TrendingPrompts />
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-between">
          {/* Centered Hero Section */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            {introConfig?.heroImage?.position === 'top' && heroImage}
            <div className="flex w-full flex-col items-center text-center">
              <h1
                className="mb-2 text-center font-['DM_Sans'] text-[1.5rem] leading-[120%] font-semibold text-[#1A1A1A]"
                style={introConfig?.welcomeTitleStyles}
              >
                {introConfig?.welcomeTitle ?? 'Please add a title'}
              </h1>
              <p
                className="text-center font-['DM_Sans'] text-[0.875rem] leading-[130%] font-normal text-[#1A1A1A]"
                style={introConfig?.welcomeSubtitleStyles}
              >
                {introConfig?.welcomeSubtitle ?? 'Please add a subtitle'}
              </p>
            </div>
            {introConfig?.heroImage?.position === 'bottom' && heroImage}
          </div>
          {/* Trending Prompts at the very bottom */}
          <div className="mt-auto w-full">
            <TrendingPrompts />
          </div>
        </div>
      )}
    </WidgetContent>
  )
}
