import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '../../utils/helpers'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'destructive' | 'gray'
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'primary', children, ...props }, ref) => {
    const variants = {
      primary: 'badge-primary',
      success: 'badge-success',
      warning: 'badge-warning',
      destructive: 'badge-destructive',
      gray: 'badge-gray',
    }

    return (
      <span ref={ref} className={cn('badge', variants[variant], className)} {...props}>
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'