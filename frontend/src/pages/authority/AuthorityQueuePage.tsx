import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { releaseApi } from '../../api'
import {
  getStatusLabel,
  getStatusColor,
  formatCurrency,
  formatDate,
  getDepositTypeLabel,
  getDepositMethodLabel,
} from '../../utils/helpers'
import { Badge } from '../../components/ui/Badge'
import { Card, CardContent } from '../../components/ui/Card'
import {
  Award,
  Search,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  IndianRupee,
  Filter,
} from 'lucide-react'
import type { ReleaseQueueItem } from '../../types/release'

const REVIEW_PATH_LABELS: Record<string, string> = {
  fdr_rpgf: 'FDR / RPGF',
  rtgs: 'RTGS',
  sd_refund: 'Security Deposit Refund',
}

const REVIEW_PATH_COLORS: Record<string, string> = {
  fdr_rpgf: 'bg-violet-100 text-violet-700',
  rtgs: 'bg-blue-100 text-blue-700',
  sd_refund: 'bg-teal-100 text-teal-700',
}

function daysUntilDeadline(item: ReleaseQueueItem): number | null {
  if (!item.deadline_at) return null
  return Math.ceil((new Date(item.deadline_at).getTime() - Date.now()) / 86400000)
}

export function AuthorityQueuePage() {
  const [search, setSearch] = useState('')
  const [pathFilter, setPathFilter] = useState('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['release-queue'],
    queryFn: () => releaseApi.getQueue({ page: 1, page_size: 50 }),
    refetchInterval: 30000,
  })

  const items: ReleaseQueueItem[] = data?.items ?? []
  const total = data?.total ?? 0

  const filtered = items.filter((item) => {
    const matchPath = pathFilter === 'all' || item.review_path === pathFilter
    const matchSearch =
      !search ||
      item.case_number?.toLowerCase().includes(search.toLowerCase()) ||
      item.institution_name?.toLowerCase().includes(search.toLowerCase())
    return matchPath && matchSearch
  })

  // Stats
  const urgentCount = items.filter((item) => {
    const days = daysUntilDeadline(item)
    return days !== null && days <= 3
  }).length

  const totalAmount = items.reduce((s, i) => s + (i.amount || 0), 0)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-sm">
              <Award className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Authority Queue</h1>
          </div>
          <p className="text-sm text-slate-500 ml-12">
            Release and refund requests pending competent authority sign-off
          </p>
        </div>
        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 ring-1 ring-red-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              {urgentCount} urgent — deadline within 3 days
            </span>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-violet-900">{total}</p>
              <p className="text-xs font-medium text-violet-600">Pending Decision</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-sm ${urgentCount > 0 ? 'bg-gradient-to-br from-red-50 to-red-100/50' : 'bg-gradient-to-br from-slate-50 to-slate-100/50'}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0 ${urgentCount > 0 ? 'bg-red-600' : 'bg-slate-400'}`}>
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${urgentCount > 0 ? 'text-red-900' : 'text-slate-600'}`}>{urgentCount}</p>
              <p className={`text-xs font-medium ${urgentCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>Urgent (≤3 days)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-900">{formatCurrency(totalAmount)}</p>
              <p className="text-xs font-medium text-emerald-600">Under Review</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by case number or institution..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          {['all', 'fdr_rpgf', 'rtgs', 'sd_refund'].map((p) => (
            <button
              key={p}
              onClick={() => setPathFilter(p)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                pathFilter === p
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p === 'all' ? 'All' : REVIEW_PATH_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Queue Table */}
      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
            <p className="text-sm font-medium text-slate-600">Failed to load queue</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-700">Queue is clear</h3>
            <p className="mt-1 text-sm text-slate-400">No pending release decisions at this time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Case / Institution</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Release Path</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Request Type</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Amount</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Deadline</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((item) => {
                  const deadlineDays = daysUntilDeadline(item)
                  const isUrgent = deadlineDays !== null && deadlineDays <= 3
                  return (
                    <tr key={item.case_id} className={`group transition-colors hover:bg-violet-50/30 ${isUrgent ? 'bg-red-50/20' : ''}`}>
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-xs font-bold text-indigo-700">{item.case_number}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.institution_name}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${REVIEW_PATH_COLORS[item.review_path] ?? 'bg-slate-100 text-slate-600'}`}>
                          {REVIEW_PATH_LABELS[item.review_path] ?? item.review_path}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-slate-600 capitalize">{item.request_type?.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-bold text-slate-800 text-xs">{formatCurrency(item.amount)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge className={`${getStatusColor(item.status)} text-[11px]`}>
                          {getStatusLabel(item.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        {deadlineDays !== null ? (
                          <span className={`text-xs font-semibold ${isUrgent ? 'text-red-600' : 'text-slate-500'}`}>
                            {isUrgent && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                            {deadlineDays <= 0 ? 'Overdue' : `${deadlineDays}d left`}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          to={`/authority/cases/${item.case_id}`}
                          className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                        >
                          Review <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
