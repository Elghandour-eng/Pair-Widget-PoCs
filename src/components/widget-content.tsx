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
    <CardContent
      className={cn(
        'widget-content-container relative flex flex-1 flex-col bg-[url(/shell.png)] bg-size-[60%_217px] bg-position-[left_1rem_top_1.25rem] bg-no-repeat p-4 pt-8',
        className,
      )}
      {...props}
    >
      {children}
      <Toaster />
    </CardContent>
  )
}
export { WidgetContent }
