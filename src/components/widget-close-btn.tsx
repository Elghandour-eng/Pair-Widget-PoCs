import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetUIContext } from '@/contexts/widget-ui-context'

function WidgetCloseBtn() {
  const { widgetConfig } = useWidgetConfigContext()
  const { setIsOpen, closeWidget } = useWidgetUIContext()

  const handleClose = () => {
    // In SDK mode, notify the SDK to close the widget
    // In standalone mode, just update local state
    if (widgetConfig.sdkMode) {
      closeWidget()
    } else {
      setIsOpen(false)
    }
  }

  // With no launcher at all there is nothing to reopen the panel with, so the
  // close button goes too — the panel simply stays.
  if (widgetConfig.type === 'none') return null

  return (
    <Button variant="ghost" size="icon-sm" onClick={handleClose} className="min-[668px]:hidden">
      <X className="size-5" />
    </Button>
  )
}
export { WidgetCloseBtn }
