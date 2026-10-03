import { WidgetContent } from '@/components/widget-content'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { HeroCarousel } from '@/features/intro/components/hero-carousel'
import { IntroCallButton } from '@/features/voice-call/call-button'
import { QuickLinksList } from '@/features/intro/components/quick-links-list'
import { TrendingPrompts } from '@/features/intro/components/trending-prompts'
import { cn } from '@/lib/utils'

export function IntroContent() {
  const { widgetConfig } = useWidgetConfigContext()
  const introConfig = widgetConfig.introScreen
  const quickLinksConfig = widgetConfig.quickLinks

  // Cards switched off do not count: a list of only those draws nothing.
  const hasQuickLinks = !!quickLinksConfig?.show && (quickLinksConfig.links || []).some((link) => link.active !== false)

  const heroImageStyles = introConfig?.heroImage?.styles as Record<string, unknown> | undefined
  // An aspect ratio sizes the hero as much as a height does; `height: 'auto'`
  // alongside one is not "no height", so it must not trigger the fallback cap.
  const hasExplicitHeight = !!(
    (heroImageStyles?.height && heroImageStyles.height !== 'auto') ||
    heroImageStyles?.maxHeight ||
    heroImageStyles?.['max-height'] ||
    heroImageStyles?.aspectRatio ||
    heroImageStyles?.['aspect-ratio']
  )

  // The hero is a slide list. `heroImage` remains the single-slide fallback for
  // configs written before the list existed.
  const heroSlides = introConfig?.heroSlides?.length
    ? introConfig.heroSlides
    : introConfig?.heroImage
      ? [introConfig.heroImage.url]
      : []

  const heroImage = heroSlides.length > 0 && introConfig?.heroCarousel && (
    <HeroCarousel
      slides={heroSlides}
      carousel={introConfig.heroCarousel}
      containerStyle={introConfig.heroImage?.containerStyles}
      style={introConfig.heroImage?.styles}
      className={cn(!hasExplicitHeight && 'max-h-31', !hasQuickLinks && 'mx-auto')}
      centered={!hasQuickLinks}
    />
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
            <div className="mt-4 empty:hidden">
              <IntroCallButton />
            </div>
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
              <div className="mt-4 empty:hidden">
                <IntroCallButton />
              </div>
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
