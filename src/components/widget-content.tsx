import { cn } from '@/lib/utils'
import { CardContent } from './ui/card'
import { Toaster } from './ui/sonner'

function WidgetContent({
  children,
  props,
  className,
}: {
  children: React.ReactNode
  props?: React.ComponentProps<typeof CardContent>
  className?: string
}) {
  return (
    <CardContent className={cn('widget-content-container relative flex flex-1 flex-col p-4', className)} {...props}>
      {children}
      <Toaster />
    </CardContent>
  )
}
export { WidgetContent }
