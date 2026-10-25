import { Landmark } from 'lucide-react'
import { cn } from '../../utils/helpers'

/**
 * Portal mark. Deliberately a neutral emblem-style badge (not the State Emblem,
 * whose use is statutorily restricted). Swap the icon for an approved asset in production.
 */
export function PortalLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-900 text-white ring-2 ring-saffron-500/90 ring-offset-2 ring-offset-white',
        className
      )}
      aria-hidden="true"
    >
      <Landmark className="h-5 w-5" />
    </div>
  )
}
