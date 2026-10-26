import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { casesApi } from '../../api'
import { useAuth } from '../../auth/useAuth'
import {
  getStatusLabel,
  getStatusColor,
  formatCurrency,
  formatDate,
  getDepositTypeLabel,
  getDepositMethodLabel,
} from '../../utils/helpers'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import type { DepositCaseResponse } from '../../types/case'
import {
  FilePlus2,
  FileText,
  Calendar,
  AlertTriangle,
  Clock,
  ChevronRight,
  IndianRupee,
  Search,
  Filter,
  Download,
} from 'lucide-react'
import { exportDepositRegisterCsv } from '../../utils/export'
import { toast } from 'sonner'

const STATUS_FILTERS = [
  { value: 'all', label: 'All Deposits' },
  { value: 'draft', label: 'Drafts' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_scrutiny', label: 'Under Scrutiny' },
  { value: 'clarification_pending', label: 'Clarification Needed' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'released', label: 'Released' },
  { value: 'sanctioned', label: 'Council Sanctioned' },
]

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function MaturityBadge({ maturityDate }: { maturityDate: string | null }) {
  const days = daysUntil(maturityDate)
  if (days === null) return <span className="text-slate-400 text-xs">—</span>
  if (days < 0) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
      <AlertTriangle className="h-3 w-3" /> Overdue ({Math.abs(days)}d)
    </span>
  )
  if (days <= 30) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
      <Clock className="h-3 w-3" /> {days}d left
    </span>
  )
  if (days <= 90) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-700 ring-1 ring-yellow-200">
      <Calendar className="h-3 w-3" /> {days}d left
    </span>
  )
  return (
    <span className="text-xs text-slate-500">{formatDate(maturityDate)}</span>
  )
}

export function MyDepositsPage() {
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['my-deposits', user?.institution_id],
    queryFn: () => casesApi.list({ page: 1, page_size: 100, institution_id: user?.institution_id ?? undefined }),
    enabled: !!user?.institution_id,
  })

  const cases: DepositCaseResponse[] = data?.items ?? []

  const filtered = cases.filter((c) => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const matchSearch =
      !search ||
      c.case_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.instrument_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.issuing_bank?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const totalAmount = cases.reduce((sum, c) => sum + (c.amount || 0), 0)
  const overdueCount = cases.filter((c) => {
    const days = daysUntil(c.maturity_date)
    return days !== null && days < 0 && !['released', 'closed', 'rejected'].includes(c.status)
  }).length
  const expiringSoon = cases.filter((c) => {
    const days = daysUntil(c.maturity_date)
    return days !== null && days >= 0 && days <= 30 && !['released', 'closed'].includes(c.status)
  }).length

  function handleExport() {
    try {
      exportDepositRegisterCsv(cases)
      toast.success('Deposit register exported')
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Deposits</h1>
          <p className="mt-1 text-sm text-slate-500">
            All security deposits and FDRs for your institution
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Link to="/wizard/new">
            <Button size="sm" className="gap-2">
              <FilePlus2 className="h-4 w-4" /> Submit New FDR
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-900">{cases.length}</p>
                <p className="text-xs text-indigo-600 font-medium">Total Deposits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <IndianRupee className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-900">{formatCurrency(totalAmount)}</p>
                <p className="text-xs text-emerald-600 font-medium">Total Portfolio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-sm ${expiringSoon > 0 ? 'bg-gradient-to-br from-amber-50 to-amber-100/50' : 'bg-gradient-to-br from-slate-50 to-slate-100/50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${expiringSoon > 0 ? 'bg-amber-500' : 'bg-slate-400'}`}>
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${expiringSoon > 0 ? 'text-amber-900' : 'text-slate-700'}`}>{expiringSoon}</p>
                <p className={`text-xs font-medium ${expiringSoon > 0 ? 'text-amber-600' : 'text-slate-500'}`}>Expiring in 30d</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-sm ${overdueCount > 0 ? 'bg-gradient-to-br from-red-50 to-red-100/50' : 'bg-gradient-to-br from-slate-50 to-slate-100/50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${overdueCount > 0 ? 'bg-red-600' : 'bg-slate-400'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-900' : 'text-slate-700'}`}>{overdueCount}</p>
                <p className={`text-xs font-medium ${overdueCount > 0 ? 'text-red-600' : 'text-slate-500'}`}>Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by FDR number, instrument number, bank..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cases Table */}
      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-700">No deposits found</h3>
            <p className="mt-1 text-sm text-slate-400">
              {statusFilter !== 'all' ? 'Try changing the filter or ' : ''}
              <Link to="/wizard/new" className="text-indigo-600 hover:underline font-medium">submit your first FDR</Link>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Reference</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Type / Method</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Bank / Instrument</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Amount</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Maturity</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="group hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {c.case_number || c.tracking_ref}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-800 text-xs">{getDepositTypeLabel(c.deposit_type)}</p>
                      <p className="text-slate-500 text-[11px]">{getDepositMethodLabel(c.deposit_method)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-700 text-xs">{c.issuing_bank}</p>
                      <p className="font-mono text-[11px] text-slate-400">{c.instrument_number}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-bold text-slate-800 text-xs">{formatCurrency(c.amount)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <MaturityBadge maturityDate={c.maturity_date} />
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge className={`${getStatusColor(c.status)} text-[11px]`}>
                        {getStatusLabel(c.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        to={`/cases/${c.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
