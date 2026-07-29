import { cn } from '@/lib/utils'

function CartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={cn('h-5 w-5', className)} aria-hidden="true">
      <path d="M0 0h24v24H0z" fill="none" />
      <g fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" d="m8 16l8.72-.727c2.729-.227 3.341-.823 3.643-3.544L21 6M6 6h16" />
        <circle cx="6" cy="20" r="2" />
        <circle cx="17" cy="20" r="2" />
        <path
          strokeLinecap="round"
          d="M8 20h7M2 2h.966c.945 0 1.768.625 1.997 1.515L7.94 15.076a1.96 1.96 0 0 1-.35 1.686L6.631 18"
        />
      </g>
    </svg>
  )
}

export { CartIcon }
