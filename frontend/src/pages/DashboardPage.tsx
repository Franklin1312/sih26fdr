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
    { title: 'Total Cases', value: stats?.total ?? 0, icon: FileText, color: 'text-primary-600', bgColor: 'bg-primary-100' },
    { title: 'Total Amount', value: formatCurrency(stats?.total_amount ?? 0), icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-100' },
    { title: 'Overdue', value: stats?.overdue_count ?? 0, icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
    { title: 'Upcoming Maturity', value: stats?.upcoming_maturity_count ?? 0, icon: Calendar, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your deposit refund cases</p>
        </div>
        <Link to="/wizard/new">
          <Button><Plus className="h-4 w-4 mr-2" />New Submission</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bgColor}`}><stat.icon className={`h-6 w-6 ${stat.color}`} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
<Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Cases</CardTitle>
          <Link to="/my-cases" className="text-sm text-primary-600 hover:underline">View all <Search className="h-4 w-4 ml-1 inline" /></Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {casesData?.items.map((caseItem) => (
              <div key={caseItem.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center"><FileText className="h-5 w-5 text-primary-600" /></div>
                  <div>
                    <p className="font-medium text-gray-900">{caseItem.case_number}</p>
                    <p className="text-sm text-gray-500">{caseItem.deposit_type} \u2022 {formatCurrency(caseItem.amount)}</p>
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
            <Link to="/wizard/new" className="p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center mb-3"><FileText className="h-5 w-5 text-primary-600" /></div>
              <h3 className="font-medium text-gray-900">New Submission</h3>
              <p className="text-sm text-gray-500 mt-1">Start a new deposit case</p>
            </Link>
            <Link to="/my-cases" className="p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3"><Search className="h-5 w-5 text-blue-600" /></div>
              <h3 className="font-medium text-gray-900">My Cases</h3>
              <p className="text-sm text-gray-500 mt-1">View and manage your cases</p>
            </Link>
            <Link to="/cases" className="p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center mb-3"><Eye className="h-5 w-5 text-green-600" /></div>
              <h3 className="font-medium text-gray-900">All Cases</h3>
              <p className="text-sm text-gray-500 mt-1">Browse all cases</p>
            </Link>
            <Link to="/settings" className="p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors">
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

