import React, { useState } from 'react'
import {
  Settings as SettingsIcon,
  Bell,
  Database,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Server,
  RefreshCw,
  KeyRound,
  FileCheck2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getRoleLabel } from '../../utils/helpers'

export const SettingsPage: React.FC = () => {
  const { user } = useAuth()
  const [schedulerTriggered, setSchedulerTriggered] = useState(false)
  const [notificationPreference, setNotificationPreference] = useState({
    emailMaturity60d: true,
    emailMaturity30d: true,
    emailOverdue: true,
    inAppAlerts: true,
  })

  const [termYears, setTermYears] = useState(8)
  const [lienHolder, setLienHolder] = useState('The Member Secretary, AICTE, New Delhi')
  const [savedNotice, setSavedNotice] = useState(false)

  const handleTriggerScheduler = () => {
    setSchedulerTriggered(true)
    setTimeout(() => {
      setSchedulerTriggered(false)
    }, 3000)
  }

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault()
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 2500)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-indigo-600" />
            Portal Settings & System Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure AICTE regulatory parameters, validity alert schedules, and system preferences.
          </p>
        </div>

        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Server className="w-3.5 h-3.5" />
            System Healthy
          </span>
        </div>
      </div>

      {savedNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Settings successfully updated.
        </div>
      )}

      {/* Grid: Settings Sections */}
      <div className="grid grid-cols-1 gap-6">
        {/* Section 1: Regulatory Policy & APH Defaults */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              AICTE Clause 6.46 & Approval Process Handbook Rules
            </h2>
          </div>

          <form onSubmit={handleSavePolicy} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Default Security Deposit / FDR Lock-in Term
                </label>
                <select
                  value={termYears}
                  onChange={(e) => setTermYears(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value={8}>8 Years (Standard Technical Institution)</option>
                  <option value={10}>10 Years (Standalone / Specialized Institution)</option>
                  <option value={5}>5 Years (Special Dispensation Category)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Joint Lien Beneficiary
                </label>
                <input
                  type="text"
                  value={lienHolder}
                  onChange={(e) => setLienHolder(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                Save Policy Configuration
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Automated Alert Scheduler Controls */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Maturity Alert Scheduler
              </h2>
            </div>
            <button
              onClick={handleTriggerScheduler}
              disabled={schedulerTriggered}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${schedulerTriggered ? 'animate-spin' : ''}`} />
              {schedulerTriggered ? 'Scheduler Executing...' : 'Trigger Alert Check Now'}
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            The automated scheduler scans all active FDRs and Security Deposits daily at 00:00 UTC. It generates automated alerts for instruments approaching maturity within 60 days, 30 days, or overdue status without release requests.
          </p>

          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Last Scan:</span>
              <span className="font-semibold text-slate-700">Today at 00:00 UTC</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Active Monitored Cases:</span>
              <span className="font-semibold text-slate-700">6 Cases Across 4 Institutions</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Alert Engine:</span>
              <span className="font-semibold text-emerald-600">Active (Async Background)</span>
            </div>
          </div>
        </div>

        {/* Section 3: Notification Channels */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Notification Preferences
            </h2>
          </div>

          <div className="space-y-3 text-xs text-slate-700">
            <label className="flex items-center justify-between cursor-pointer py-1">
              <div>
                <span className="font-semibold text-slate-900 block">60-Day Renewal Warning</span>
                <span className="text-slate-500 text-[11px]">Send notification when deposit enters the 60-day renewal window</span>
              </div>
              <input
                type="checkbox"
                checked={notificationPreference.emailMaturity60d}
                onChange={(e) => setNotificationPreference(p => ({ ...p, emailMaturity60d: e.target.checked }))}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1">
              <div>
                <span className="font-semibold text-slate-900 block">30-Day Critical Expiry Notice</span>
                <span className="text-slate-500 text-[11px]">Escalate notification to institution representative and approval bureau</span>
              </div>
              <input
                type="checkbox"
                checked={notificationPreference.emailMaturity30d}
                onChange={(e) => setNotificationPreference(p => ({ ...p, emailMaturity30d: e.target.checked }))}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1">
              <div>
                <span className="font-semibold text-slate-900 block">Overdue Maturity Alert</span>
                <span className="text-slate-500 text-[11px]">Immediate alert when deposit is past maturity without verified renewal</span>
              </div>
              <input
                type="checkbox"
                checked={notificationPreference.emailOverdue}
                onChange={(e) => setNotificationPreference(p => ({ ...p, emailOverdue: e.target.checked }))}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        </div>

        {/* Section 4: Current Session & Security */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Account & Security Environment
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[11px]">Logged In User</span>
              <span className="font-semibold text-slate-900">{user?.full_name} ({user?.email})</span>
              <div className="mt-1 text-[11px] text-indigo-600 font-semibold">
                Role: {getRoleLabel(user?.role || '')}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[11px]">Deployment Mode</span>
              <span className="font-semibold text-slate-900">Demonstration Mode (SIH 26265)</span>
              <div className="mt-1 text-[11px] text-slate-500">
                Idempotent in-memory / SQLite async backend
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
