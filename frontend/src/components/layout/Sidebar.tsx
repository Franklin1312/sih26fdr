import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/helpers'
import {
  LayoutDashboard,
  FilePlus2,
  FolderOpen,
  ClipboardCheck,
  Gavel,
  Send,
  Users,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  FileText,
  Award,
<<<<<<< HEAD
=======
  Landmark,
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
  BarChart3,
} from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/useAuth'
import { getRoleLabel } from '../../utils/helpers'
import { casesApi } from '../../api'
import { scrutinyApi } from '../../api'

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  roles: string[]
  badgeKey?: keyof BadgeCounts
  staticBadge?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

interface BadgeCounts {
  scrutiny: number
  clearance: number
  release: number
  clarifications: number
  myDrafts: number
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        roles: ['institution_rep', 'scrutiny_officer', 'clearance_officer', 'competent_authority', 'approval_bureau', 'council', 'system_admin'],
      },
      {
        label: 'Reports',
        path: '/reports',
        icon: BarChart3,
        roles: ['institution_rep', 'scrutiny_officer', 'clearance_officer', 'competent_authority', 'approval_bureau', 'council', 'system_admin'],
      },
    ],
  },
  {
    title: 'My Institution',
    items: [
      { label: 'My Dashboard', path: '/institution/dashboard', icon: LayoutDashboard, roles: ['institution_rep'] },
      { label: 'My Deposits', path: '/institution/deposits', icon: FileText, roles: ['institution_rep'] },
      { label: 'Submit FDR', path: '/institution/submit', icon: FilePlus2, roles: ['institution_rep'] },
      { label: 'Submission Wizard', path: '/wizard/new', icon: FolderOpen, roles: ['institution_rep'] },
    ],
  },
  {
    title: 'Statutory Workflow',
    items: [
      { label: 'Scrutiny Queue', path: '/scrutiny', icon: ClipboardCheck, roles: ['scrutiny_officer', 'system_admin'], badgeKey: 'scrutiny' },
      { label: 'Clearance Queue', path: '/clearance', icon: Gavel, roles: ['clearance_officer', 'system_admin'], badgeKey: 'clearance' },
      { label: 'Release Queue', path: '/release', icon: Send, roles: ['competent_authority', 'approval_bureau', 'council', 'system_admin'], badgeKey: 'release' },
      { label: 'Authority Queue', path: '/authority', icon: Award, roles: ['competent_authority', 'system_admin'], badgeKey: 'release' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Audit Trail', path: '/audit', icon: ShieldCheck, roles: ['system_admin'] },
      { label: 'Users', path: '/admin/users', icon: Users, roles: ['system_admin'] },
      { label: 'Institutions', path: '/admin/institutions', icon: Building2, roles: ['system_admin'] },
      { label: 'System Settings', path: '/settings', icon: Settings, roles: ['system_admin'] },
    ],
  },
]

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Live badge counts from dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => casesApi.getDashboardStats(),
    refetchInterval: 60000, // refresh every minute
    staleTime: 30000,
  })

  const { data: scrutinyStats } = useQuery({
    queryKey: ['scrutiny-stats'],
    queryFn: () => scrutinyApi.getStats(),
    refetchInterval: 60000,
    staleTime: 30000,
    enabled: !!user && ['scrutiny_officer', 'system_admin'].includes(user.role),
  })

  const badgeCounts: BadgeCounts = {
    scrutiny: (scrutinyStats as { queue_size?: number })?.queue_size ?? (stats?.by_status?.['submitted'] ?? 0),
    clearance: stats?.by_status?.['clearance_queue'] ?? 0,
    release: (stats?.by_status?.['fdr_rpgf_review'] ?? 0) + (stats?.by_status?.['rtgs_review'] ?? 0) + (stats?.by_status?.['sd_refund_review'] ?? 0) + (stats?.by_status?.['final_decision'] ?? 0),
    clarifications: stats?.by_status?.['clarification_pending'] ?? 0,
    myDrafts: stats?.by_status?.['draft'] ?? 0,
  }

  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => (user ? i.roles.includes(user.role) : false)) }))
    .filter((g) => g.items.length > 0)

  const getBadge = (item: NavItem): string | null => {
    if (item.badgeKey) {
      const count = badgeCounts[item.badgeKey]
      return count > 0 ? String(count) : null
    }
    return item.staticBadge ?? null
  }

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
<<<<<<< HEAD
        className="fixed left-4 top-[calc(var(--gov-strip-offset)+16px)] z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-primary-200 bg-white text-primary-800 shadow-sm transition-colors hover:bg-primary-50 lg:hidden"
=======
        className="fixed left-4 top-3.5 z-50 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle menu"
        aria-expanded={isMobileOpen}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Main Sidebar */}
      <aside
        className={cn(
<<<<<<< HEAD
          'fixed bottom-0 left-0 top-[calc(var(--gov-strip-offset)+var(--gov-header-h))] z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300',
          isMobileOpen ? 'translate-x-0 shadow-[var(--shadow-pop)]' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Navigation heading */}
        <div className="border-b border-slate-100 bg-primary-900 px-5 py-2.5">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-100">Navigation</p>
=======
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-md transition-transform duration-300',
          isMobileOpen ? 'translate-x-0 shadow-[var(--shadow-pop)]' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Area */}
        <div className="flex h-16 items-center border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white shadow-md shadow-primary-900/20">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-[15px] font-extrabold text-slate-900">SIH26265</span>
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                  AICTE
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500">Security Deposit Portal</p>
            </div>
          </div>
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group.title}>
<<<<<<< HEAD
              <p className="mb-2 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-primary-800 font-display"><span className="h-px w-3 bg-saffron-500" aria-hidden="true" />{group.title}</p>
=======
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-display">{group.title}</p>
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
              <div className="space-y-1">
                {group.items.map((item) => {
                  const badge = getBadge(item)
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
<<<<<<< HEAD
                          'group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all duration-200',
                          isActive
                            ? 'bg-primary-50 text-primary-900 ring-1 ring-inset ring-primary-100 font-bold'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-primary-900'
=======
                          'group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200',
                          isActive
                            ? 'bg-gradient-to-r from-primary-50 to-indigo-50/50 text-primary-700 shadow-2xs font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-3">
                            {isActive && (
<<<<<<< HEAD
                              <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-saffron-500" aria-hidden="true" />
=======
                              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-600 shadow-sm" aria-hidden="true" />
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
                            )}
                            <item.icon
                              className={cn(
                                'h-[18px] w-[18px] shrink-0 transition-colors',
<<<<<<< HEAD
                                isActive ? 'text-primary-800' : 'text-slate-400 group-hover:text-primary-700'
=======
                                isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
                              )}
                              aria-hidden="true"
                            />
                            <span>{item.label}</span>
                          </div>
                          {badge && (
                            <span className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                              isActive
<<<<<<< HEAD
                                ? 'bg-saffron-100 text-saffron-800'
                                : parseInt(badge) > 0
                                  ? 'bg-rose-100 text-rose-700'
=======
                                ? 'bg-primary-100 text-primary-700'
                                : parseInt(badge) > 0
                                  ? 'bg-rose-100 text-rose-600'
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
                                  : 'bg-slate-100 text-slate-500'
                            )}>
                              {badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Quick Regulatory Card in Sidebar */}
<<<<<<< HEAD
          <div className="mx-1 overflow-hidden rounded-xl border border-primary-800 bg-primary-900 p-3.5 text-white">
            <div className="mb-2 h-0.5 w-8 rounded-full bg-saffron-500" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-saffron-400" />
              <p className="text-xs font-bold">Clause 6.46 Rules</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-primary-100/90">
=======
          <div className="mx-1 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-primary-50/30 p-3.5">
            <div className="flex items-center gap-2 text-primary-800">
              <ShieldCheck className="h-4 w-4 text-primary-600" />
              <p className="text-xs font-bold">Clause 6.46 Rules</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
              FDR releases require Approval Bureau NOC; RTGS requires Council Sanction Order.
            </p>
          </div>
        </nav>

        {/* User Card & Logout Footer */}
        <div className="border-t border-slate-100 p-3">
          {user && (
<<<<<<< HEAD
            <div className="mb-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-800 text-xs font-bold text-white ring-2 ring-saffron-400/80">
=======
            <div className="mb-2 flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-slate-50/80 p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-xs font-bold text-white shadow-2xs">
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
                {initials(user.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900">{user.full_name}</p>
<<<<<<< HEAD
                <p className="truncate text-[10px] text-primary-700 font-semibold">{getRoleLabel(user.role)}</p>
=======
                <p className="truncate text-[10px] text-primary-600 font-semibold">{getRoleLabel(user.role)}</p>
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
              </div>
            </div>
          )}
          <button
            onClick={logout}
<<<<<<< HEAD
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
=======
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
          >
            <LogOut className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-rose-600" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
<<<<<<< HEAD
          className="fixed inset-0 z-30 bg-primary-950/50 backdrop-blur-xs lg:hidden"
=======
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs lg:hidden"
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
