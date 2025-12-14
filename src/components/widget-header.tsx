import { cn } from '@/lib/utils'
import { CardHeader } from './ui/card'

function WidgetHeader({
  children,
  className,
  props,
}: {
  children: React.ReactNode
  className?: string
  props?: React.ComponentProps<typeof CardHeader>
}) {
  return (
    <CardHeader className={cn('flex flex-col gap-0 px-5', className)} {...props}>
      {children}
    </CardHeader>
  )
}
export { WidgetHeader }
