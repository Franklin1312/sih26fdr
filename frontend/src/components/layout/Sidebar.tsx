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
  Landmark,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { getRoleLabel } from '../../utils/helpers'

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  roles: string[]
  badge?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['institution_rep', 'scrutiny_officer', 'clearance_officer', 'competent_authority', 'system_admin'] },
    ],
  },
  {
    title: 'Deposit Management',
    items: [
      { label: 'New Submission', path: '/wizard/new', icon: FilePlus2, roles: ['institution_rep'] },
      { label: 'My Cases', path: '/my-cases', icon: FolderOpen, roles: ['institution_rep'] },
    ],
  },
  {
    title: 'Statutory Workflow',
    items: [
      { label: 'Scrutiny Queue', path: '/scrutiny', icon: ClipboardCheck, roles: ['scrutiny_officer', 'system_admin'], badge: '3' },
      { label: 'Clearance Queue', path: '/clearance', icon: Gavel, roles: ['clearance_officer', 'system_admin'], badge: '2' },
      { label: 'Release Queue', path: '/release', icon: Send, roles: ['competent_authority', 'system_admin'], badge: 'Clause 6.46' },
    ],
  },
  {
    title: 'Administration',
    items: [
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

  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => (user ? i.roles.includes(user.role) : false)) }))
    .filter((g) => g.items.length > 0)

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        className="fixed left-4 top-3.5 z-50 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle menu"
        aria-expanded={isMobileOpen}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Main Sidebar */}
      <aside
        className={cn(
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
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-display">{group.title}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200',
                        isActive
                          ? 'bg-gradient-to-r from-primary-50 to-indigo-50/50 text-primary-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-3">
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-600 shadow-sm" aria-hidden="true" />
                          )}
                          <item.icon
                            className={cn(
                              'h-[18px] w-[18px] shrink-0 transition-colors',
                              isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'
                            )}
                            aria-hidden="true"
                          />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className={cn(
                            'rounded-md px-1.5 py-0.5 text-[10px] font-bold',
                            isActive ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          {/* Quick Regulatory Card in Sidebar */}
          <div className="mx-1 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-primary-50/30 p-3.5">
            <div className="flex items-center gap-2 text-primary-800">
              <ShieldCheck className="h-4 w-4 text-primary-600" />
              <p className="text-xs font-bold">Clause 6.46 Rules</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              FDR releases require Approval Bureau NOC; RTGS requires Council Sanction Order.
            </p>
          </div>
        </nav>

        {/* User Card & Logout Footer */}
        <div className="border-t border-slate-100 p-3">
          {user && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-slate-50/80 p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-xs font-bold text-white shadow-2xs">
                {initials(user.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900">{user.full_name}</p>
                <p className="truncate text-[10px] text-primary-600 font-semibold">{getRoleLabel(user.role)}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-rose-600" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
