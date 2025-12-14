import { Spinner } from '@/components/ui/spinner'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'

function LoadMore() {
  const { widgetConfig } = useWidgetConfigContext()

  return (
    <div className="from-background/95 absolute top-0 right-0 left-0 z-10 flex items-center justify-center bg-linear-to-b to-transparent py-3 backdrop-blur-[0.5px] transition-opacity duration-200">
      <div className="bg-background/80 flex items-center gap-2 rounded-full px-4 py-2 shadow-sm">
        <Spinner className="size-4" style={{ color: widgetConfig.primaryColor }} />
        <span className="text-muted-foreground text-xs">Loading older messages...</span>
      </div>
    </div>
  )
}

export { LoadMore }
