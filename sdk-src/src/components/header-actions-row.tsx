import { useConsentPending } from '@/core/consent'
import { cn } from '@/lib/utils'

/**
 * The end-side button row every screen's header shares: language, theme, close
 * and whatever else that screen adds. While the consent sheet is up the sheet
 * draws its own language / theme / close above the overlay, so this row keeps
 * its place but steps out of sight instead of ghosting underneath them.
 */
function HeaderActionsRow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const consentPending = useConsentPending()
  return (
    <div className={cn('flex flex-1 items-center justify-end gap-1', consentPending && 'invisible')} style={style}>
      {children}
    </div>
  )
}
export { HeaderActionsRow }
