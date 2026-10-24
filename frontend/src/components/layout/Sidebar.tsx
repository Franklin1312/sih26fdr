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
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { getRoleLabel } from '../../utils/helpers'

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  roles: string[]
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
    title: 'Deposits',
    items: [
      { label: 'New Submission', path: '/wizard/new', icon: FilePlus2, roles: ['institution_rep'] },
      { label: 'My Cases', path: '/my-cases', icon: FolderOpen, roles: ['institution_rep'] },
    ],
  },
  {
    title: 'Workflow',
    items: [
      { label: 'Scrutiny Queue', path: '/scrutiny', icon: ClipboardCheck, roles: ['scrutiny_officer', 'system_admin'] },
      { label: 'Clearance Queue', path: '/clearance', icon: Gavel, roles: ['clearance_officer', 'system_admin'] },
      { label: 'Release Queue', path: '/release', icon: Send, roles: ['competent_authority', 'system_admin'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', path: '/admin/users', icon: Users, roles: ['system_admin'] },
      { label: 'Institutions', path: '/admin/institutions', icon: Building2, roles: ['system_admin'] },
      { label: 'Settings', path: '/settings', icon: Settings, roles: ['system_admin'] },
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
      <button
        className="fixed left-4 top-3.5 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle menu"
        aria-expanded={isMobileOpen}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300',
          isMobileOpen ? 'translate-x-0 shadow-[var(--shadow-pop)]' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center border-b border-gray-100 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold text-gray-900">SIH26265</p>
              <p className="text-[11px] font-medium text-gray-500">Deposit Refund Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-600" aria-hidden="true" />}
                        <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600')} aria-hidden="true" />
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-3">
          {user && (
            <div className="mb-2 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                {initials(user.full_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{user.full_name}</p>
                <p className="truncate text-xs text-gray-500">{getRoleLabel(user.role)}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-30 bg-gray-900/40 backdrop-blur-[2px] lg:hidden" onClick={() => setIsMobileOpen(false)} aria-hidden="true" />
      )}
    </>
  )
}
