import { WidgetContent } from '@/components/widget-content'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { QuickLinksList } from '@/features/intro/components/quick-links-list'
import { TrendingPrompts } from '@/features/intro/components/trending-prompts'

export function IntroContent() {
  const { widgetConfig } = useWidgetConfigContext()
  const config = widgetConfig.introScreen

  // Welcome Content
  const welcomeTitleText = config?.welcomeTitle?.text ?? widgetConfig.welcomeTitle ?? 'No title'
  const welcomeTitleStyles = config?.welcomeTitle?.styles ?? {}
  const welcomeSubtitleText = config?.welcomeSubtitle?.text ?? widgetConfig.welcomeTagline ?? 'No subtitle'
  const welcomeSubtitleStyles = config?.welcomeSubtitle?.styles ?? {}

  // Welcome Image
  const heroEnabled = config?.heroSection?.enabled?.value ?? false
  const heroImageConfig = config?.heroSection?.heroImage
  const heroImageStyles = heroImageConfig?.styles ?? {}
  const heroImageUrl = heroImageConfig?.url
  const heroPosition = heroImageConfig?.position ?? 'top'

  // Welcome Image JSX
  const heroImage = heroEnabled && heroImageUrl && (
    <div className="w-full" style={config?.heroSection?.enabled?.styles}>
      <img
        src={heroImageUrl}
        alt="Hero image"
        className="max-h-31 w-full rounded object-cover"
        style={heroImageStyles}
      />
    </div>
  )

  return (
    <WidgetContent className="flex h-full flex-col gap-6 overflow-auto">
      {heroPosition === 'top' && heroImage}

      <div>
        <h1
          className="mb-2 max-w-[85%] font-['DM_Sans'] text-[1.5rem] leading-[120%] font-semibold text-[#1A1A1A]"
          style={welcomeTitleStyles}
        >
          {welcomeTitleText}
        </h1>

        <p
          className="max-w-[85%] font-['DM_Sans'] text-[0.875rem] leading-[130%] font-normal text-[#1A1A1A]"
          style={welcomeSubtitleStyles}
        >
          {welcomeSubtitleText}
        </p>
      </div>

      {/* {heroPosition === 'bottom' && heroImage} */}

      <QuickLinksList />
      <TrendingPrompts />
    </WidgetContent>
  )
}
