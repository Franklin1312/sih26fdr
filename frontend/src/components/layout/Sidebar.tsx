import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/helpers'
import {
  LayoutDashboard,
  FileText,
  Search,
  ClipboardCheck,
  Gavel,
  Send,
  Users,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { getRoleLabel } from '../../utils/helpers'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles: string[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['INSTITUTION_REP', 'SCRUTINY_OFFICER', 'CLEARANCE_OFFICER', 'COMPETENT_AUTHORITY', 'SYSTEM_ADMIN'] },
  { label: 'New Submission', path: '/wizard/new', icon: <FileText className="h-5 w-5" />, roles: ['INSTITUTION_REP'] },
  { label: 'My Cases', path: '/my-cases', icon: <Search className="h-5 w-5" />, roles: ['INSTITUTION_REP'] },
  { label: 'Scrutiny Queue', path: '/scrutiny', icon: <ClipboardCheck className="h-5 w-5" />, roles: ['SCRUTINY_OFFICER', 'SYSTEM_ADMIN'] },
  { label: 'Clearance Queue', path: '/clearance', icon: <Gavel className="h-5 w-5" />, roles: ['CLEARANCE_OFFICER', 'SYSTEM_ADMIN'] },
  { label: 'Release Queue', path: '/release', icon: <Send className="h-5 w-5" />, roles: ['COMPETENT_AUTHORITY', 'SYSTEM_ADMIN'] },
  { label: 'Users', path: '/admin/users', icon: <Users className="h-5 w-5" />, roles: ['SYSTEM_ADMIN'] },
  { label: 'Institutions', path: '/admin/institutions', icon: <Building2 className="h-5 w-5" />, roles: ['SYSTEM_ADMIN'] },
  { label: 'Settings', path: '/settings', icon: <Settings className="h-5 w-5" />, roles: ['SYSTEM_ADMIN'] },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const filteredNavItems = navItems.filter((item) =>
    user ? item.roles.includes(user.role) : false
  )

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 btn-primary"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center h-16 px-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-gray-900">SIH26265</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive: active }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
              onClick={() => setIsMobileOpen(false)}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          {user && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{getRoleLabel(user.role).toLowerCase()}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}