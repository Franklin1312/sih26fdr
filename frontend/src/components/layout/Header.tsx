import { Bell, ChevronDown, LogOut, Sparkles, Check, Info, CheckCircle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/useAuth'
import { getRoleLabel } from '../../utils/helpers'
import { casesApi } from '../../api'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { DEMO_PERSONAS } from '../../constants/demoPersonas'
import { PortalLogo } from './PortalLogo'

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

export function Header() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const roleRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const { data: alerts = [] } = useQuery({
    queryKey: ['system-alerts'],
    queryFn: () => casesApi.getAlerts(),
    refetchInterval: 30000,
  })

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

  const handleQuickSwitch = async (persona: (typeof DEMO_PERSONAS)[number]) => {
    try {
      setShowRoleSwitcher(false)
      await login(persona.email, 'demo')
      toast.success(`Switched to ${persona.title}`)
      navigate(persona.landingPath)
    } catch {
      toast.error(`Could not switch to ${persona.title}`)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-[0_1px_0_rgb(15_33_80/0.04),0_6px_16px_-12px_rgb(15_33_80/0.25)]">
      <div className="flex h-[var(--gov-header-h)] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Left Side: Portal identity (logo + ministry lockup) */}
        <div className="ml-12 flex min-w-0 flex-1 items-center gap-3 lg:ml-0">
          <PortalLogo className="h-9 w-9 sm:h-11 sm:w-11" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[15px] font-bold tracking-tight text-primary-900 sm:text-base">
              <span className="sm:hidden">FDR Portal</span>
              <span className="hidden sm:inline">Deposit &amp; FDR Portal</span>
            </p>
            <p className="hidden truncate text-[11px] font-medium text-slate-600 sm:block">
              All India Council for Technical Education · Ministry of Education
            </p>
          </div>

          <span className="hidden h-8 w-px bg-slate-200 xl:block" aria-hidden="true" />
          <div className="hidden xl:inline-flex items-center gap-1.5 rounded-full bg-saffron-50 px-2.5 py-1 text-[11px] font-semibold text-saffron-800 ring-1 ring-saffron-200">
            <span className="h-1.5 w-1.5 rounded-full bg-saffron-500" />
            AICTE Clause 6.46
          </div>
        </div>

        {/* Right Side: Quick Role Switcher, Notifications & User Menu */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Quick Role Switcher (Crucial for Demo Judges) */}
          <div className="relative" ref={roleRef}>
            <button
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3.5 py-1.5 text-xs font-semibold text-primary-800 transition-all hover:bg-primary-100 hover:border-primary-300"
              title="Instant Role Switcher for Demos"
            >
              <Sparkles className="h-3.5 w-3.5 text-saffron-600" />
              <span className="hidden sm:inline">Role:</span>
              <span className="hidden max-w-[120px] truncate sm:inline">{user ? getRoleLabel(user.role) : 'Switch'}</span>
              <ChevronDown className={`h-3 w-3 text-primary-500 transition-transform ${showRoleSwitcher ? 'rotate-180' : ''}`} />
            </button>

            {showRoleSwitcher && (
              <div className="animate-slide-in absolute right-0 z-50 mt-2 max-h-[calc(100vh-5rem)] w-80 overflow-y-auto rounded-xl border border-slate-200 border-t-[3px] border-t-saffron-500 bg-white p-2 shadow-[var(--shadow-pop)]">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Instant Role Switcher</p>
                  <p className="text-[11px] text-slate-500">One click changes the active demo account</p>
                </div>
                <div className="space-y-1">
                  {DEMO_PERSONAS.map((item) => {
                    const Icon = item.icon
                    const isCurrent = user?.email === item.email
                    return (
                      <button
                        key={item.email}
                        onClick={() => void handleQuickSwitch(item)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                          isCurrent
                            ? 'bg-primary-50 text-primary-900 font-semibold ring-1 ring-primary-200'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isCurrent ? 'bg-primary-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{item.title} · {item.description}</p>
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
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-primary-800 transition-colors hover:bg-primary-50 border border-slate-200"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {alerts.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {alerts.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="animate-slide-in absolute right-0 z-50 mt-2 w-84 sm:w-96 overflow-hidden rounded-xl border border-slate-200 border-t-[3px] border-t-saffron-500 bg-white shadow-[var(--shadow-pop)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-primary-50/60">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary-900">Regulatory Alerts</p>
                    <span className="text-[10px] text-slate-400">APH 6.46</span>
                  </div>
                  {alerts.length > 0 ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      {alerts.length} Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> All Compliant
                    </span>
                  )}
                </div>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {alerts.length > 0 ? (
                    alerts.map((alert) => (
                      <div
                        key={alert.id}
                        onClick={() => {
                          setShowNotifications(false)
                          navigate(`/cases/${alert.case_id}`)
                        }}
                        className={`p-3 text-left hover:bg-slate-50 cursor-pointer transition-colors border-l-3 ${
                          alert.severity === 'critical'
                            ? 'border-l-rose-500 bg-rose-50/15'
                            : alert.severity === 'warning'
                            ? 'border-l-amber-500 bg-amber-50/10'
                            : 'border-l-blue-500'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold font-mono text-slate-900">
                            {alert.case_number}
                          </span>
                          {alert.days_left !== null && (
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                alert.days_left <= 0
                                  ? 'bg-rose-100 text-rose-700'
                                  : alert.days_left <= 30
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {alert.days_left <= 0 ? 'Expired' : `${alert.days_left}d left`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-1">{alert.title}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{alert.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium truncate">
                          {alert.institution_name}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-2">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">No Pending Expiries or Actions</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        All FDR instruments and security deposits are currently valid and compliant.
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 bg-slate-50/60 p-2.5 text-center">
                  <button
                    onClick={() => {
                      setShowNotifications(false)
                      navigate('/my-cases')
                    }}
                    className="text-xs font-bold text-primary-700 hover:text-saffron-700"
                  >
                    View All Registered Cases &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200" aria-hidden="true" />

          {/* User Profile */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2.5 rounded-full p-1 pr-2.5 transition-colors hover:bg-primary-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-800 text-xs font-bold text-white ring-2 ring-saffron-400/80">
                {initials(user?.full_name)}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-xs font-bold text-slate-900 truncate max-w-[130px]">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500 font-medium">{user ? getRoleLabel(user.role) : ''}</p>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
              <div className="animate-slide-in absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 border-t-[3px] border-t-saffron-500 bg-white py-1.5 shadow-[var(--shadow-pop)]">
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
