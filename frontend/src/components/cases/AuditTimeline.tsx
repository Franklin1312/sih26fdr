import { useState, useEffect } from 'react'
import { ShieldCheck, ShieldAlert, Key, Clock, User, ArrowRight, CheckCircle2, Copy, Check } from 'lucide-react'
import { auditApi, type AuditLogItem } from '../../api/audit'
import { formatDate } from '../../utils/helpers'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { toast } from 'sonner'

interface AuditTimelineProps {
  caseId: string
}

export function AuditTimeline({ caseId }: AuditTimelineProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAudit() {
      setLoading(true)
      try {
        const data = await auditApi.getCaseAudit(caseId)
        setLogs(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not fetch case audit logs')
      } finally {
        setLoading(false)
      }
    }
    fetchAudit()
  }, [caseId])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(text)
    toast.success('SHA-256 hash copied to clipboard')
    setTimeout(() => setCopiedHash(null), 2000)
  }

  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'update':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'status_change':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'delete':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent mb-3" />
        <span className="text-xs font-medium">Verifying tamper-evident audit trail...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
        <span>{error}</span>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
        <ShieldCheck className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <p className="font-semibold text-slate-700">No cryptographic audit records found for this case.</p>
        <p className="mt-1">Audit log records are generated on instrument creation, updates, and reviews.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Integrity Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                Tamper-Evident SHA-256 Ledger
              </h4>
              <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                Cryptographically Chained
              </Badge>
            </div>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Each action is sealed with sequential SHA-256 hash chains referencing prior state per AICTE regulatory auditing norms.
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-mono font-semibold text-emerald-900 bg-emerald-100/80 px-2.5 py-1 rounded-md">
            {logs.length} Recorded Block{logs.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Timeline List */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
        {logs.map((log) => {
          const isCopied = copiedHash === log.hash
          return (
            <div key={log.id} className="relative group">
              {/* Dot */}
              <div className="absolute -left-6 top-3 h-3 w-3 rounded-full border-2 border-white bg-indigo-600 ring-2 ring-indigo-200 group-hover:scale-125 transition-transform" />

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                      #{log.sequence}
                    </span>
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getActionBadgeColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {log.entity_type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(log.timestamp, 'full')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-500">Actor:</span>
                    <span className="font-semibold text-slate-900">
                      {log.actor?.full_name || log.actor_id}
                    </span>
                    {log.actor?.role && (
                      <span className="text-[10px] text-slate-400 font-mono">({log.actor.role})</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                    <Key className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-400 font-sans">Hash:</span>
                    <span className="truncate max-w-[140px] text-slate-800" title={log.hash}>
                      {log.hash.slice(0, 10)}...{log.hash.slice(-8)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(log.hash)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      title="Copy full SHA-256 hash"
                    >
                      {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* Values Diff (if any) */}
                {(log.new_values || log.old_values) && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <details className="text-xs">
                      <summary className="text-[11px] font-semibold text-indigo-600 cursor-pointer hover:text-indigo-800">
                        View state changes / parameters
                      </summary>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/80 font-mono text-[10px]">
                        {log.old_values && (
                          <div>
                            <span className="font-bold text-slate-500 block mb-1">Previous Values:</span>
                            <pre className="overflow-x-auto text-rose-700 bg-white p-2 rounded border border-slate-200">
                              {JSON.stringify(log.old_values, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_values && (
                          <div>
                            <span className="font-bold text-slate-500 block mb-1">Committed Values:</span>
                            <pre className="overflow-x-auto text-emerald-700 bg-white p-2 rounded border border-slate-200">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
