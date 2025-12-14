import { cn } from '@/lib/utils'
import { CardFooter } from './ui/card'

function WidgetFooter({
  className,
  ...props
}: {
  className?: string
  props?: React.ComponentProps<typeof CardFooter>
}) {
  return (
    <CardFooter className={cn('flex items-center justify-center gap-2 py-3', className)} {...props}>
      <div className="bg-muted-foreground size-2 rounded-full" />
      <p className="text-muted-foreground text-xs">Powered by Pair AI</p>
    </CardFooter>
  )
}
export { WidgetFooter }
