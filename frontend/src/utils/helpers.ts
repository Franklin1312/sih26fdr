import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function formatDate(
  dateString: string | null | undefined,
  format: 'short' | 'medium' | 'full' = 'short'
): string {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    if (format === 'full') {
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    if (format === 'medium') {
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    }
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '-'
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'badge-gray',
    submitted: 'badge-primary',
    under_scrutiny: 'badge-warning',
    clarification_pending: 'badge-warning',
    clearance_queue: 'badge-primary',
    cleared: 'badge-success',
    release_requested: 'badge-primary',
    review: 'badge-primary',
    final_decision: 'badge-primary',
    released: 'badge-success',
    rejected: 'badge-destructive',
    closed: 'badge-gray',
  }
  return colors[status] || 'badge-gray'
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    under_scrutiny: 'Under Scrutiny',
    clarification_pending: 'Clarification Pending',
    clearance_queue: 'Clearance Queue',
    cleared: 'Cleared',
    release_requested: 'Release Requested',
    review: 'Under Review',
    final_decision: 'Final Decision',
    released: 'Released',
    rejected: 'Rejected',
    closed: 'Closed',
  }
  return labels[status] || status
}

export function getDepositTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    security_deposit: 'Security Deposit',
    fdr: 'FDR',
    rpgf: 'RPGF',
    bank_guarantee: 'Bank Guarantee',
  }
  return labels[type] || type
}

export function getDepositMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    fdr_rpgf: 'FDR/RPGF',
    rtgs: 'RTGS',
    security_deposit_refund: 'Security Deposit Refund',
  }
  return labels[method] || method
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    INSTITUTION_REP: 'Institution Representative',
    SCRUTINY_OFFICER: 'Scrutiny Officer',
    CLEARANCE_OFFICER: 'Clearance Officer',
    COMPETENT_AUTHORITY: 'Competent Authority',
    SYSTEM_ADMIN: 'System Admin',
  }
  return labels[role] || role
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}