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
    <CardFooter
      className={cn('flex items-center justify-center gap-2 py-3', className)}
      style={{ borderBottom: '1px solid var(--colors-gray-light-mode-200, #E4E7EC)' }}
      {...props}
    >
      {/* <div className="bg-muted-foreground size-2 rounded-full" /> */}
      <p className="text-muted-foreground text-xs font-semibold">
        Powered by <span className="text-[#4D98E2]">Pair AI</span>
      </p>
    </CardFooter>
  )
}
export { WidgetFooter }
