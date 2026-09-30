import { PairWordmark } from '@/components/pair-wordmark'
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
      {/* Brand lockup: strictly LTR in both languages — "Powered by PAIR"
          must never reorder under an RTL document. */}
      <p dir="ltr" className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-semibold">
        Powered by
        {/* The real wordmark rather than the word set in the UI font, which is
            what made the mark look wrong next to the rest of the brand. */}
        <PairWordmark className="h-[11px] text-[#4D98E2]" />
      </p>
    </CardFooter>
  )
}
export { WidgetFooter }
