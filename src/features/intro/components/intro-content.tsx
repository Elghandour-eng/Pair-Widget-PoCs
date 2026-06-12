import { WidgetContent } from '@/components/widget-content'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { QuickLinksList } from '@/features/intro/components/quick-links-list'
import { TrendingPrompts } from '@/features/intro/components/trending-prompts'

export function IntroContent() {
  const { widgetConfig } = useWidgetConfigContext()
  const introConfig = widgetConfig.introScreen
  const quickLinksConfig = widgetConfig.quickLinks

  const heroImage = introConfig?.heroImage && (
    <div className="w-full" style={introConfig.heroImage.containerStyles}>
      <img
        src={introConfig.heroImage.url}
        alt="Hero image"
        className="max-h-31 w-full rounded object-cover"
        style={introConfig.heroImage.styles}
      />
    </div>
  )

  const showQuickLinksAbove = quickLinksConfig?.show && quickLinksConfig?.position === 'above_welcome'
  const showQuickLinksUnder = quickLinksConfig?.show && quickLinksConfig?.position !== 'above_welcome'

  return (
    <WidgetContent className="flex h-full flex-col gap-6 overflow-auto">
      {introConfig?.heroImage?.position === 'top' && heroImage}

      {showQuickLinksAbove && <QuickLinksList />}

      <div>
        <h1
          className="mb-2 max-w-[85%] font-['DM_Sans'] text-[1.5rem] leading-[120%] font-semibold text-[#1A1A1A]"
          style={introConfig?.welcomeTitleStyles}
        >
          {introConfig?.welcomeTitle ?? 'Please add a title'}
        </h1>

        <p
          className="max-w-[85%] font-['DM_Sans'] text-[0.875rem] leading-[130%] font-normal text-[#1A1A1A]"
          style={introConfig?.welcomeSubtitleStyles}
        >
          {introConfig?.welcomeSubtitle ?? 'Please add a subtitle'}
        </p>
      </div>

      {introConfig?.heroImage?.position === 'bottom' && heroImage}

      {showQuickLinksUnder && <QuickLinksList />}
      <TrendingPrompts />
    </WidgetContent>
  )
}
