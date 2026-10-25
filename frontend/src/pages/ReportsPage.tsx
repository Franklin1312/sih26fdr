import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Download, FileCheck2, FileText, RefreshCw } from 'lucide-react'
import { reportsApi } from '../api'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { formatCurrency, formatDate, getStatusLabel } from '../utils/helpers'
import { toast } from 'sonner'

function exportReport(rows: ReportsSummary['cases']) {
  const header = ['Case', 'Institution', 'Instrument', 'Amount', 'Status', 'Maturity', 'Days to maturity', 'Missing documents', 'Intervention']
  const body = rows.map((row) => [
    row.case_number,
    row.institution_name,
    row.instrument_number,
    row.amount,
    row.status,
    row.maturity_date ?? '',
    row.days_to_maturity ?? '',
    row.missing_documents.join('; '),
    row.intervention_reason ?? '',
  ])
  const csv = [header, ...body]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `sih26265-report-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

type ReportsSummary = Awaited<ReturnType<typeof reportsApi.getSummary>>

export function ReportsPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['reports-summary'],
    queryFn: reportsApi.getSummary,
  })

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading operational reports...</div>
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-sm text-rose-700">Reports could not be loaded. Please try again.</CardContent></Card>
      </div>
    )
  }

  const cards = [
    { label: 'Total cases', value: data.total_cases, icon: FileText, color: 'text-indigo-700 bg-indigo-50' },
    { label: 'Pending verification', value: data.pending_verification, icon: FileCheck2, color: 'text-amber-700 bg-amber-50' },
    { label: 'Maturing in 30 days', value: data.upcoming_maturities, icon: CalendarClock, color: 'text-blue-700 bg-blue-50' },
    { label: 'Requires intervention', value: data.requiring_intervention, icon: AlertTriangle, color: 'text-rose-700 bg-rose-50' },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Management Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Operational visibility into verification, maturity, evidence, and intervention work.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button size="sm" onClick={() => { exportReport(data.cases); toast.success('Report exported') }} className="gap-2"><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}><CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{value}</p><p className="text-xs font-medium text-slate-500">{label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Case / Institution</th><th className="px-4 py-3">Instrument</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Maturity</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.cases.map((row) => (
                <tr key={row.case_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Link to={`/cases/${row.case_id}`} className="font-semibold text-primary-700 hover:underline">{row.case_number}</Link><p className="text-xs text-slate-500">{row.institution_name}</p></td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.instrument_number}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(row.amount)}</td>
                  <td className="px-4 py-3 text-xs">{row.maturity_date ? <><p>{formatDate(row.maturity_date)}</p><p className={row.days_to_maturity !== null && row.days_to_maturity < 0 ? 'text-rose-600' : 'text-slate-500'}>{row.days_to_maturity === null ? 'Not set' : `${row.days_to_maturity} days`}</p></> : 'Not set'}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{getStatusLabel(row.status)}</Badge>{row.missing_documents.length > 0 && <p className="mt-1 text-xs text-rose-600">Missing evidence</p>}</td>
                  <td className="px-4 py-3 text-xs">{row.requires_intervention ? <span className="font-semibold text-rose-700">{row.intervention_reason}</span> : <span className="text-emerald-700">No action required</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {isFetching && <p className="p-3 text-center text-xs text-slate-400">Refreshing...</p>}
        </CardContent>
      </Card>
    </div>
  )
}
