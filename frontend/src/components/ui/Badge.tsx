import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '../../utils/helpers'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'destructive' | 'gray' | 'outline' | 'secondary' | 'default' | 'danger' | 'info'
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'primary', children, ...props }, ref) => {
    const variants = {
      primary: 'badge-primary',
      success: 'badge-success',
      warning: 'badge-warning',
      destructive: 'badge-destructive',
      gray: 'badge-gray',
      outline: 'bg-white text-gray-700 ring-gray-300',
      secondary: 'bg-gray-100 text-gray-700 ring-gray-200',
      default: 'bg-gray-100 text-gray-700 ring-gray-200',
      danger: 'badge-destructive',
      info: 'bg-sky-50 text-sky-700 ring-sky-200',
    }

    return (
      <span ref={ref} className={cn('badge', variants[variant], className)} {...props}>
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'
