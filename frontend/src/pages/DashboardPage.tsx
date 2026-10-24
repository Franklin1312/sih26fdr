// Dashboard page
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Link } from 'react-router-dom'
import { casesApi } from '../api'
import { getStatusLabel, getStatusColor, formatCurrency } from '../utils/helpers'
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Plus,
  Search,
  Eye,
  ArrowRight,
} from 'lucide-react'

export function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => casesApi.getDashboardStats(),
  })

  const { data: casesData } = useQuery({
    queryKey: ['cases', { page: 1, page_size: 5 }],
    queryFn: () => casesApi.list({ page: 1, page_size: 5 }),
  })

  const statCards = [
    { title: 'Total Cases', value: stats?.total ?? 0, icon: FileText, color: 'text-primary-600', bgColor: 'bg-primary-50' },
    { title: 'Total Amount', value: formatCurrency(stats?.total_amount ?? 0), icon: TrendingUp, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { title: 'Overdue', value: stats?.overdue_count ?? 0, icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' },
    { title: 'Upcoming Maturity', value: stats?.upcoming_maturity_count ?? 0, icon: Calendar, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your deposit refund cases</p>
        </div>
        <Link to="/wizard/new">
          <Button><Plus className="h-4 w-4 mr-2" />New Submission</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-gray-900">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bgColor}`}><stat.icon className={`h-5 w-5 ${stat.color}`} aria-hidden="true" /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
<Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Cases</CardTitle>
          <Link to="/my-cases" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700">View all <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {casesData?.items.map((caseItem) => (
              <div key={caseItem.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:border-primary-200 hover:bg-primary-50/30 transition-colors duration-200">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center"><FileText className="h-5 w-5 text-primary-600" /></div>
                  <div>
                    <p className="font-medium text-gray-900">{caseItem.case_number}</p>
                    <p className="text-sm text-gray-500">{caseItem.deposit_type} · {formatCurrency(caseItem.amount)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={getStatusColor(caseItem.status)}>{getStatusLabel(caseItem.status)}</Badge>
                  <Link to={`/cases/${caseItem.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/wizard/new" className="group cursor-pointer p-4 border border-gray-200 rounded-xl bg-white hover:border-primary-300 hover:shadow-[var(--shadow-card-hover)] transition-all duration-200">
              <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center mb-3"><FileText className="h-5 w-5 text-primary-600" /></div>
              <h3 className="font-medium text-gray-900">New Submission</h3>
              <p className="text-sm text-gray-500 mt-1">Start a new deposit case</p>
            </Link>
            <Link to="/my-cases" className="group cursor-pointer p-4 border border-gray-200 rounded-xl bg-white hover:border-primary-300 hover:shadow-[var(--shadow-card-hover)] transition-all duration-200">
              <div className="h-10 w-10 rounded-lg bg-sky-50 flex items-center justify-center mb-3"><Search className="h-5 w-5 text-sky-600" /></div>
              <h3 className="font-medium text-gray-900">My Cases</h3>
              <p className="text-sm text-gray-500 mt-1">View and manage your cases</p>
            </Link>
            <Link to="/my-cases" className="group cursor-pointer p-4 border border-gray-200 rounded-xl bg-white hover:border-primary-300 hover:shadow-[var(--shadow-card-hover)] transition-all duration-200">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-3"><Eye className="h-5 w-5 text-emerald-600" /></div>
              <h3 className="font-medium text-gray-900">All Cases</h3>
              <p className="text-sm text-gray-500 mt-1">Browse all cases</p>
            </Link>
            <Link to="/settings" className="group cursor-pointer p-4 border border-gray-200 rounded-xl bg-white hover:border-primary-300 hover:shadow-[var(--shadow-card-hover)] transition-all duration-200">
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center mb-3"><AlertTriangle className="h-5 w-5 text-gray-600" /></div>
              <h3 className="font-medium text-gray-900">Settings</h3>
              <p className="text-sm text-gray-500 mt-1">Manage preferences</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

