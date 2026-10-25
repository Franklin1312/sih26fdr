import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Link } from 'react-router-dom'
import { casesApi } from '../api'
import { useAuth } from '../auth/useAuth'
import { getStatusLabel, getStatusColor, formatCurrency, getRoleLabel } from '../utils/helpers'
import {
  exportDepositRegisterCsv,
  exportMaturityScheduleCsv,
  exportPortfolioSummaryCsv,
} from '../utils/export'
import { toast } from 'sonner'
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Plus,
  Eye,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Send,
  FileCheck2,
  Search,
  Sparkles,
  Download,
  Building,
  Clock,
  PieChart,
  Layers,
} from 'lucide-react'

export function DashboardPage() {
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => casesApi.getDashboardStats(),
  })

  const { data: casesData } = useQuery({
    queryKey: ['cases', { page: 1, page_size: 50 }],
    queryFn: () => casesApi.list({ page: 1, page_size: 50 }),
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => casesApi.getAlerts(),
  })

  const statCards = [
    {
      title: 'Total Active Deposits',
      value: stats?.total ?? 0,
      subtitle: 'Managed across all schemes',
      icon: FileText,
      gradient: 'from-blue-600 to-indigo-600',
      bgGlow: 'bg-blue-500/10',
      textColor: 'text-blue-600',
    },
    {
      title: 'Total Portfolio Value',
      value: formatCurrency(stats?.total_amount ?? 0),
      subtitle: 'FDR & Security Deposits',
      icon: TrendingUp,
      gradient: 'from-emerald-600 to-teal-600',
      bgGlow: 'bg-emerald-500/10',
      textColor: 'text-emerald-600',
    },
    {
      title: 'Upcoming Maturity (30d)',
      value: stats?.upcoming_maturity_count ?? 0,
      subtitle: 'Requires renewal/release action',
      icon: Calendar,
      gradient: 'from-amber-500 to-orange-500',
      bgGlow: 'bg-amber-500/10',
      textColor: 'text-amber-600',
    },
    {
      title: 'Pending Action / Overdue',
      value: stats?.overdue_count ?? 0,
      subtitle: 'Deficiencies or clearances pending',
      icon: AlertTriangle,
      gradient: 'from-rose-500 to-red-600',
      bgGlow: 'bg-rose-500/10',
      textColor: 'text-rose-600',
    },
  ]

  const byStatus = stats?.by_status ?? {}
  const workflowStages = [
    { name: '1. Registration', count: (byStatus.draft ?? 0) + (byStatus.submitted ?? 0), icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100' },
    { name: '2. Scrutiny & Review', count: (byStatus.under_scrutiny ?? 0) + (byStatus.clarification_pending ?? 0), icon: Search, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: '3. Multi-Bureau Clearance', count: byStatus.clearance_queue ?? 0, icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50' },
    { name: '4. Authority Approval', count: (byStatus.fdr_rpgf_review ?? 0) + (byStatus.rtgs_review ?? 0) + (byStatus.sd_refund_review ?? 0), icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
    { name: '5. Decision Recorded', count: (byStatus.final_decision ?? 0) + (byStatus.released ?? 0), icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ]

  const filteredCases = casesData?.items.filter((item) => {
    const matchesSearch =
      searchTerm === '' ||
      item.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.deposit_type.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'scrutiny' && (item.status.includes('scrutiny') || item.status.includes('clarification'))) ||
      (statusFilter === 'clearance' && item.status.includes('clearance')) ||
      (statusFilter === 'released' && item.status.includes('release'))
    return matchesSearch && matchesStatus
  })

  // Bank portfolio breakdown
  const bankStats = (casesData?.items || []).reduce<Record<string, { count: number; totalAmount: number }>>((acc, item) => {
    const bank = item.issuing_bank?.trim() || 'Other Scheduled Bank'
    if (!acc[bank]) acc[bank] = { count: 0, totalAmount: 0 }
    acc[bank].count += 1
    acc[bank].totalAmount += Number(item.amount) || 0
    return acc
  }, {})

  // Maturity ageing schedule
  const now = new Date()
  const ageingStats = (casesData?.items || []).reduce(
    (acc, item) => {
      const amt = Number(item.amount) || 0
      if (!item.maturity_date) {
        acc.longTerm.count += 1
        acc.longTerm.amount += amt
        return acc
      }
      const mat = new Date(item.maturity_date)
      const diffDays = Math.ceil((mat.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays < 0) {
        acc.overdue.count += 1
        acc.overdue.amount += amt
      } else if (diffDays <= 30) {
        acc.critical.count += 1
        acc.critical.amount += amt
      } else if (diffDays <= 90) {
        acc.nearTerm.count += 1
        acc.nearTerm.amount += amt
      } else {
        acc.longTerm.count += 1
        acc.longTerm.amount += amt
      }
      return acc
    },
    {
      overdue: { label: 'Expired / Overdue', count: 0, amount: 0, badge: 'bg-rose-50 text-rose-700' },
      critical: { label: 'Critical (< 30d)', count: 0, amount: 0, badge: 'bg-amber-50 text-amber-700' },
      nearTerm: { label: 'Action Due (31-90d)', count: 0, amount: 0, badge: 'bg-blue-50 text-blue-700' },
      longTerm: { label: 'Compliant (> 90d)', count: 0, amount: 0, badge: 'bg-emerald-50 text-emerald-700' },
    }
  )

  const handleExportRegister = () => {
    if (!casesData?.items?.length) {
      toast.error('No deposit cases found to export')
      return
    }
    exportDepositRegisterCsv(casesData.items)
    toast.success('AICTE Deposit Register CSV exported')
  }

  const handleExportMaturity = () => {
    if (!alerts.length) {
      toast.info('No pending maturity alerts to export')
      return
    }
    exportMaturityScheduleCsv(alerts)
    toast.success('Maturity & Expiry Schedule CSV exported')
  }

  const handleExportSummary = () => {
    if (!stats) {
      toast.error('Dashboard metrics not loaded')
      return
    }
    exportPortfolioSummaryCsv(stats, bankStats)
    toast.success('Executive MIS Summary CSV exported')
  }

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Hero Welcome Banner */}
<<<<<<< HEAD
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-950 via-primary-900 to-primary-800 gov-hero-pattern border-b-4 border-saffron-500 p-6 sm:p-8 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-saffron-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
=======
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-white/15 backdrop-blur-md mb-3">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              AICTE Approval Process Handbook (2024–27) · Clause 6.46
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl text-white">
              {user?.full_name ? `Welcome, ${user.full_name}` : 'Security Deposit Management'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Role: <span className="font-semibold text-white">{user ? getRoleLabel(user.role) : 'Officer'}</span> · Managing statutory security deposits, FDR instruments, multi-bureau clearances, and refund workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {user?.role === 'institution_rep' && (
              <Link to="/wizard/new">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 shadow-md">
                  <Plus className="h-4 w-4 mr-2 text-primary-600" />
                  New Deposit Registration
                </Button>
              </Link>
            )}
            <Link to="/my-cases">
              <Button variant="outline" size="lg" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                Track Cases
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card
              key={stat.title}
              className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-slate-200/80"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
                      {stat.title}
                    </p>
                    <p className="mt-2 font-display text-2xl font-black tracking-tight text-slate-900">
                      {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400 font-medium">{stat.subtitle}</p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.bgGlow}`}>
                    <Icon className={`h-6 w-6 ${stat.textColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Visual Workflow Pipeline Banner */}
      <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/40 via-white to-blue-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <FileCheck2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">Statutory Lifecycle Pipeline</CardTitle>
                <p className="text-xs text-slate-500">Live distribution of deposit cases across regulatory checkpoints</p>
              </div>
            </div>
            <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-bold text-primary-800">
              {stats?.total ?? 0} Cases in Flow
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {workflowStages.map((stage) => {
              const Icon = stage.icon
              return (
                <div
                  key={stage.name}
                  className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-2xs transition-all hover:border-primary-300"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stage.bg} ${stage.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 truncate">{stage.name}</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{stage.count} Case{stage.count > 1 ? 's' : ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Executive MIS Reports & Statutory Reconciliation (Capability 8) */}
      <Card className="border-slate-200/90 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-primary-600 text-white shadow-sm">
                <PieChart className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Executive MIS & Statutory Compliance Reports
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                    Capability 8
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Portfolio aggregation, bank distribution, validity schedules, and audit-ready data export
                </CardDescription>
              </div>
            </div>

            {/* Quick Export Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportRegister}
                className="h-8 text-xs font-semibold border-slate-200 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              >
                <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
                Deposit Register (CSV)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMaturity}
                className="h-8 text-xs font-semibold border-slate-200 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
              >
                <Clock className="h-3.5 w-3.5 mr-1 text-amber-500" />
                Maturity Schedule (CSV)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSummary}
                className="h-8 text-xs font-semibold border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <Layers className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                Portfolio Summary (CSV)
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Col: Bank-wise Portfolio Allocation */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-slate-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Bank-Wise Portfolio Allocation
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {Object.keys(bankStats).length} Scheduled Banks
                </span>
              </div>

              <div className="space-y-3">
                {Object.keys(bankStats).length > 0 ? (
                  Object.entries(bankStats)
                    .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
                    .slice(0, 5)
                    .map(([bankName, data]) => {
                      const totalPortfolio = stats?.total_amount || 1
                      const pct = Math.min(100, Math.round((data.totalAmount / totalPortfolio) * 100))
                      return (
                        <div key={bankName} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={bankName}>
                              {bankName}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 text-[11px]">{data.count} FDR{data.count > 1 ? 's' : ''}</span>
                              <span className="font-bold text-slate-900">{formatCurrency(data.totalAmount)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary-600 to-indigo-500 transition-all duration-500"
                                style={{ width: `${Math.max(5, pct)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                      )
                    })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    No bank-allocated instruments recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Maturity & Expiry Ageing Brackets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Maturity & Validity Ageing Schedule
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  Clause 6.46 Statutory Timelines
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(ageingStats).map(([key, item]) => (
                  <div
                    key={key}
                    className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${item.badge}`}>
                          {item.label}
                        </span>
                      </div>
                      <p className="font-display text-xl font-black text-slate-900 mt-2">
                        {item.count}
                        <span className="text-xs font-normal text-slate-400 ml-1">Case{item.count !== 1 ? 's' : ''}</span>
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Locked Value</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(item.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Alert Status Callout */}
              <div className="mt-3.5 flex items-center justify-between rounded-xl bg-amber-50/70 border border-amber-200/60 p-3">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-900">
                      {alerts.length} Regulatory Alert{alerts.length !== 1 ? 's' : ''} Active
                    </p>
                    <p className="text-[11px] text-amber-700">
                      Requires renewal or scrutiny action before expiry deadline
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportMaturity}
                  className="h-7 text-[11px] border-amber-200 bg-white hover:bg-amber-100/60 text-amber-900"
                >
                  Export Alerts
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clause 6.46 Architecture Summary Card */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-600 via-primary-700 to-indigo-800 p-6 text-white shadow-md lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Clause 6.46 Dual Routes
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">Regulatory Release Protocol</h3>
            <p className="mt-2 text-xs leading-relaxed text-indigo-100">
              AICTE separates deposit release into two non-overlapping legal pathways:
            </p>
            <div className="mt-4 space-y-2.5">
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-xs ring-1 ring-white/10">
                <p className="text-xs font-bold text-emerald-300">1. FDR / RPGF Route</p>
                <p className="text-[11px] text-indigo-100 mt-0.5">
                  Approval Bureau issues official <strong>NOC</strong> only after multi-bureau clearances (Vigilance, PGRC, Finance).
                </p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-xs ring-1 ring-white/10">
                <p className="text-xs font-bold text-sky-300">2. RTGS / Electronic Route</p>
                <p className="text-[11px] text-indigo-100 mt-0.5">
                  Direct refund requires formal <strong>Council Sanction Order</strong> with audit compliance.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-indigo-200">
            <span>Mandatory AICTE APH</span>
            <span className="font-mono">P0 Guardrail</span>
          </div>
        </div>

        {/* Recent Cases Interactive Table Card (2 Cols) */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200/80">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Recent Deposit Cases</CardTitle>
              <CardDescription>Live status of registered instruments and refund requests</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by ref / type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 pl-8 pr-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500 w-40 sm:w-48"
                />
              </div>
              <Link to="/my-cases" className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mb-4 border-b border-slate-100 pb-3">
              {[
                { id: 'all', label: 'All Cases' },
                { id: 'scrutiny', label: 'Scrutiny Stage' },
                { id: 'clearance', label: 'Clearance Queue' },
                { id: 'released', label: 'Released / Sanctioned' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setStatusFilter(pill.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    statusFilter === pill.id
                      ? 'bg-primary-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Cases List */}
            <div className="space-y-2.5">
              {filteredCases && filteredCases.length > 0 ? (
                filteredCases.slice(0, 5).map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/60 bg-white hover:border-primary-300 hover:bg-indigo-50/20 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0 text-primary-600 font-mono text-xs font-bold">
                        {caseItem.deposit_type.substring(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs text-slate-900 font-mono">{caseItem.case_number}</p>
                          <span className="text-[10px] text-slate-400 font-medium">#{caseItem.instrument_number || 'N/A'}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {caseItem.deposit_type} · <span className="font-bold text-slate-800">{formatCurrency(caseItem.amount)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <Badge className={getStatusColor(caseItem.status)}>
                        {getStatusLabel(caseItem.status)}
                      </Badge>
                      <Link to={`/cases/${caseItem.id}`}>
                        <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  No cases match the selected filter.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
