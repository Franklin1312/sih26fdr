import { Bell, ChevronDown, LogOut, Sparkles, Building2, Search, Scale, Award, Shield, Check, Info } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../auth/useAuth'
import { getRoleLabel } from '../../utils/helpers'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

const ROLES_LIST = [
  { role: 'institution_rep', title: 'Institution Rep', email: 'inst_rep_1@demo.example', icon: Building2, desc: 'Apex Institute of Tech' },
  { role: 'scrutiny_officer', title: 'Scrutiny Officer', email: 'scrutiny_1@demo.example', icon: Search, desc: 'Review & Deficiencies' },
  { role: 'clearance_officer', title: 'Clearance Officer', email: 'clearance_1@demo.example', icon: Scale, desc: 'PGRC, Vigilance & Finance' },
  { role: 'competent_authority', title: 'Competent Authority', email: 'authority_1@demo.example', icon: Award, desc: 'Approval Bureau NOC / Council' },
  { role: 'system_admin', title: 'System Admin', email: 'admin_1@demo.example', icon: Shield, desc: 'Config & Audit Trail' },
]

export function Header() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const roleRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
        setShowRoleSwitcher(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleQuickSwitch = async (email: string, title: string) => {
    try {
      setShowRoleSwitcher(false)
      await login(email, 'demo')
      toast.success(`Switched role to ${title}`)
      navigate('/dashboard')
    } catch {
      toast.error('Could not switch role')
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Side: Context & Regulatory Badge */}
        <div className="ml-12 flex items-center gap-3 lg:ml-0">
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-display text-sm font-bold text-slate-900 tracking-tight">SIH26265</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-medium text-slate-600">Deposit & FDR Portal</span>
          </div>

          <div className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700 ring-1 ring-primary-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-600" />
            AICTE Clause 6.46
          </div>
        </div>

        {/* Right Side: Quick Role Switcher, Notifications & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Role Switcher (Crucial for Demo Judges) */}
          <div className="relative" ref={roleRef}>
            <button
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-100 hover:border-indigo-300 shadow-2xs"
              title="Instant Role Switcher for Demos"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
              <span className="hidden sm:inline">Role:</span>
              <span className="max-w-[120px] truncate">{user ? getRoleLabel(user.role) : 'Switch'}</span>
              <ChevronDown className={`h-3 w-3 text-indigo-500 transition-transform ${showRoleSwitcher ? 'rotate-180' : ''}`} />
            </button>

            {showRoleSwitcher && (
              <div className="animate-slide-in absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--shadow-pop)]">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Instant Role Switcher</p>
                  <p className="text-[11px] text-slate-500">Switch personas without re-logging in</p>
                </div>
                <div className="space-y-1">
                  {ROLES_LIST.map((item) => {
                    const Icon = item.icon
                    const isCurrent = user?.role === item.role
                    return (
                      <button
                        key={item.role}
                        onClick={() => handleQuickSwitch(item.email, item.title)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                          isCurrent
                            ? 'bg-primary-50 text-primary-800 font-semibold ring-1 ring-primary-200'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isCurrent ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
                        </div>
                        {isCurrent && <Check className="h-3.5 w-3.5 text-primary-600 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                3
              </span>
            </button>

            {showNotifications && (
              <div className="animate-slide-in absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-pop)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Regulatory Alerts</p>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">3 New</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  <div className="p-3 text-left hover:bg-slate-50 transition-colors">
                    <p className="text-xs font-semibold text-slate-800">FDR-2024-0001</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">Maturity notice: 30 days remaining on term.</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">Scheduled reminder</span>
                  </div>
                  <div className="p-3 text-left hover:bg-slate-50 transition-colors">
                    <p className="text-xs font-semibold text-slate-800">Scrutiny Deficiency Flagged</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">Case RTGS-2024-0002 requires Affidavit 6 upload.</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">1 hour ago</span>
                  </div>
                  <div className="p-3 text-left hover:bg-slate-50 transition-colors">
                    <p className="text-xs font-semibold text-slate-800">PGRC Clearance Issued</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">Clearance granted for Case FDR-2024-0001.</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">3 hours ago</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200" aria-hidden="true" />

          {/* User Profile */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2.5 rounded-xl p-1.5 pr-2 transition-colors hover:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-xs font-bold text-white shadow-2xs">
                {initials(user?.full_name)}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-xs font-bold text-slate-900 truncate max-w-[130px]">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500 font-medium">{user ? getRoleLabel(user.role) : ''}</p>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
              <div className="animate-slide-in absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-[var(--shadow-pop)]">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-bold text-slate-900">{user?.full_name}</p>
                  <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    <Info className="h-3 w-3 text-slate-400" />
                    Role: {user ? getRoleLabel(user.role) : ''}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4 text-rose-500" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
