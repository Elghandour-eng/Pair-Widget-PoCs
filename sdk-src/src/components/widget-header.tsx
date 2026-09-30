import { cn } from '@/lib/utils'
import { CardHeader } from './ui/card'

function WidgetHeader({
  children,
  className,
  style,
  props,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  props?: React.ComponentProps<typeof CardHeader>
}) {
  return (
    <CardHeader className={cn('flex flex-col gap-0 px-5', className)} style={style} {...props}>
      {children}
    </CardHeader>
  )
}
export { WidgetHeader }
