import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { cn } from '@/lib/utils'
import { CardContent } from './ui/card'

function WidgetContent({
  children,
  props,
  className,
}: {
  children: React.ReactNode
  props?: React.ComponentProps<typeof CardContent>
  className?: string
}) {
  const { widgetConfig } = useWidgetConfigContext()
  const hasQuickLinks = !!widgetConfig?.quickLinks?.show && (widgetConfig.quickLinks.links || []).length > 0
  // The dotted shell decoration, unless the design turned it off.
  const pattern = widgetConfig?.introScreen?.showPattern !== false

  return (
    <CardContent
      className={cn(
        'widget-content-container relative flex flex-1 flex-col p-4 pt-8',
        pattern && 'bg-[url(/shell.png)] bg-size-[60%_217px] bg-no-repeat',
        pattern && (hasQuickLinks ? 'bg-position-[left_1rem_top_1.25rem]' : 'bg-position-[center_calc(50%-1.5rem)]'),
        className,
      )}
      {...props}
    >
      {children}
    </CardContent>
  )
}
export { WidgetContent }
