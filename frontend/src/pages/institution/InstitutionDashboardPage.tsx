import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PlusCircle,
  Building2,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import { casesApi } from '../../api/cases'
import { useAuth } from '../../contexts/AuthContext'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../utils/helpers'

export const InstitutionDashboardPage: React.FC = () => {
  const { user } = useAuth()
  const institutionId = user?.institution_id || 'inst_1'

  // Fetch deposits for this institution
  const { data: casesData, isLoading } = useQuery({
    queryKey: ['institution-cases', institutionId],
    queryFn: () => casesApi.list({ institution_id: institutionId, page: 1, page_size: 50 }),
  })

  // Fetch alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ['institution-alerts'],
    queryFn: () => casesApi.getAlerts(),
  })

  const cases = casesData?.items || []

  // Compute metrics
  const now = new Date()
  const totalAmount = cases.reduce((sum, c) => sum + (c.amount || 0), 0)
  
  const expiringCases = cases.filter((c) => {
    if (!c.maturity_date || c.status === 'released' || c.status === 'closed') return false
    const maturity = new Date(c.maturity_date)
    const diffDays = Math.ceil((maturity.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= 60
  })

  const overdueCases = cases.filter((c) => {
    if (!c.maturity_date || c.status === 'released' || c.status === 'closed') return false
    const maturity = new Date(c.maturity_date)
    return maturity < now
  })

  const clearedCases = cases.filter((c) => c.status === 'cleared')
  const pendingCases = cases.filter((c) => ['submitted', 'under_scrutiny', 'clarification_pending'].includes(c.status))

  return (
    <div className="space-y-6">
      {/* Institution Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                <Building2 className="w-3 h-3" />
                Institution Portal
              </span>
              <span className="text-xs text-indigo-200">AICTE Regulatory Compliance</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {user?.full_name || 'Institution Representative'}
            </h1>
            <p className="text-sm text-indigo-200/90 max-w-xl">
              Manage security deposits, track Fixed Deposit Receipts (FDR), monitor upcoming maturity schedules, and process AICTE regulatory releases.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/institution/submit"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-900 text-sm font-semibold shadow-sm hover:bg-indigo-50 transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-indigo-600" />
              Submit New FDR
            </Link>
            <Link
              to="/institution/deposits"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-700/60 hover:bg-indigo-700 text-white text-sm font-medium border border-indigo-500/40 transition-colors"
            >
              <FileText className="w-4 h-4" />
              View Portfolio
            </Link>
          </div>
        </div>
        {/* Subtle background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Deposits</span>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <FileText className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{cases.length}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Valued at {formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Expiring Soon (60d)</span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600">{expiringCases.length}</div>
            <div className="mt-1 text-xs text-slate-500">
              Requires renewal or release action
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Overdue / Action Needed</span>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">{overdueCases.length}</div>
            <div className="mt-1 text-xs text-slate-500">
              Past maturity date without action
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Cleared & Active</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">{clearedCases.length}</div>
            <div className="mt-1 text-xs text-slate-500">
              {pendingCases.length} currently in scrutiny
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Notice Banner (Clause 6.46) */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-semibold text-amber-950">
            AICTE Approval Process Handbook (APH) Regulatory Notice:
          </p>
          <p className="text-amber-800 leading-relaxed">
            As per AICTE Chapter I guidelines and Clause 6.46, all Security Deposits and Fixed Deposit Receipts (FDR) must remain with the joint lien marked in favor of <strong>"The Member Secretary, AICTE"</strong>. Failure to maintain or renew valid instruments prior to the maturity date may impact regulatory approval status.
          </p>
        </div>
      </div>

      {/* Main Content Grid: Recent Deposits + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Deposits */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Recent Deposit Cases
            </h2>
            <Link
              to="/institution/deposits"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View All ({cases.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading deposits...</div>
            ) : cases.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-700">No deposit records found</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Submit your first Fixed Deposit Receipt or Security Deposit to track compliance.
                </p>
                <Link
                  to="/institution/submit"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Submit FDR Now
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Tracking Ref</th>
                      <th className="px-4 py-3">Bank / Instrument</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Maturity Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {cases.slice(0, 5).map((c) => {
                      const maturity = c.maturity_date ? new Date(c.maturity_date) : null
                      const diffDays = maturity ? Math.ceil((maturity.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
                      const isOverdue = diffDays !== null && diffDays < 0
                      const isUrgent = diffDays !== null && diffDays >= 0 && diffDays <= 30

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 font-mono font-medium text-indigo-600">
                            {c.tracking_ref}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{c.issuing_bank}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{c.instrument_number}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {formatCurrency(c.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{formatDate(c.maturity_date)}</span>
                            </div>
                            {diffDays !== null && (
                              <span
                                className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                                  isOverdue
                                    ? 'bg-rose-100 text-rose-700'
                                    : isUrgent
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'text-slate-500'
                                }`}
                              >
                                {isOverdue
                                  ? `${Math.abs(diffDays)}d overdue`
                                  : diffDays === 0
                                  ? 'Matures today'
                                  : `${diffDays}d remaining`}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(c.status)}`}>
                              {getStatusLabel(c.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/cases/${c.id}`}
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                            >
                              Details
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Alerts & Quick Steps */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Compliance Alerts
          </h2>

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-xs text-slate-500 shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                All deposits are in compliance. No active alerts.
              </div>
            ) : (
              alerts.slice(0, 4).map((alert, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-1 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{alert.title || 'Maturity Alert'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
                      {alert.severity || 'Notice'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{alert.message}</p>
                  {alert.case_id && (
                    <Link
                      to={`/cases/${alert.case_id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline pt-1"
                    >
                      Resolve Case <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              ))
            )}

            {/* Regulatory Quick Guide */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
              <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                Submission Guidelines
              </h3>
              <ul className="text-xs text-indigo-900/90 space-y-1.5 list-disc list-inside">
                <li>Submit FDR scanned PDF with joint lien endorsement stamp.</li>
                <li>Ensure FDR validity meets standard AICTE 8 or 10-year term.</li>
                <li>Include Nationalized / Scheduled Commercial Bank verification letter.</li>
                <li>Submit renewal at least 30 days before maturity date.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
