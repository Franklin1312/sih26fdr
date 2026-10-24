import type { DepositCaseResponse, SystemAlertResponse, DashboardStats } from '../types/case'
import { formatDate } from './helpers'

/**
 * Trigger browser download of CSV string.
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const sanitizeCell = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return '""'
    const str = String(cell).replace(/"/g, '""')
    return `"${str}"`
  }

  const csvContent = [
    headers.map(sanitizeCell).join(','),
    ...rows.map((row) => row.map(sanitizeCell).join(',')),
  ].join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export complete institutional deposit register to CSV.
 */
export function exportDepositRegisterCsv(cases: DepositCaseResponse[]): void {
  const headers = [
    'Case Number',
    'Deposit Type',
    'Method',
    'Status',
    'Amount (INR)',
    'Instrument / FDR Number',
    'Issuing Bank',
    'Instrument Date',
    'Maturity Date',
    'Parent Case (Lineage)',
    'Created At',
  ]

  const rows = cases.map((c) => [
    c.case_number,
    c.deposit_type,
    c.deposit_method,
    c.status,
    c.amount,
    c.instrument_number || 'N/A',
    c.issuing_bank || 'N/A',
    c.instrument_date ? formatDate(c.instrument_date, 'medium') : 'N/A',
    c.maturity_date ? formatDate(c.maturity_date, 'medium') : 'N/A',
    c.parent_case_id || 'Original Instrument',
    formatDate(c.created_at, 'medium'),
  ])

  exportToCsv('AICTE_Deposit_Register', headers, rows)
}

/**
 * Export upcoming validity & maturity schedule to CSV.
 */
export function exportMaturityScheduleCsv(alerts: SystemAlertResponse[]): void {
  const headers = [
    'Alert ID',
    'Case Number',
    'Institution Name',
    'Severity',
    'Alert Title',
    'Details / Notice',
    'Due Date',
    'Days Remaining',
    'Generated At',
  ]

  const rows = alerts.map((a) => [
    a.id,
    a.case_number,
    a.institution_name,
    a.severity.toUpperCase(),
    a.title,
    a.message,
    a.due_date ? formatDate(a.due_date, 'medium') : 'N/A',
    a.days_left !== null ? a.days_left : 'N/A',
    formatDate(a.created_at, 'medium'),
  ])

  exportToCsv('AICTE_Maturity_Expiry_Schedule', headers, rows)
}

/**
 * Export executive portfolio MIS reconciliation summary.
 */
export function exportPortfolioSummaryCsv(
  stats: DashboardStats,
  bankBreakdown: Record<string, { count: number; totalAmount: number }>
): void {
  const headers = ['Portfolio Metric / Bank', 'Total Instruments', 'Total Amount (INR)', 'Share (%)']

  const totalAmount = stats.total_amount || 1
  const rows: (string | number)[][] = [
    ['Total Portfolio Register', stats.total, stats.total_amount, '100%'],
    ['Upcoming 30d Maturities', stats.upcoming_maturity_count, 'N/A', 'N/A'],
    ['Overdue / Pending Clearances', stats.overdue_count, 'N/A', 'N/A'],
    ['--- BANK BREAKDOWN ---', '', '', ''],
  ]

  Object.entries(bankBreakdown).forEach(([bank, data]) => {
    const share = ((data.totalAmount / totalAmount) * 100).toFixed(1)
    rows.push([bank, data.count, data.totalAmount, `${share}%`])
  })

  exportToCsv('AICTE_Executive_MIS_Summary', headers, rows)
}
