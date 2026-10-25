import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { auditApi, type AuditLogItem, type ChainVerificationResult } from '../../api/audit'
import { formatDate } from '../../utils/helpers'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { toast } from 'sonner'

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<string>('')
  const [entityFilter, setEntityFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  // Verification state
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<ChainVerificationResult | null>(null)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const data = await auditApi.list({
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        page,
        page_size: 20,
      })
      setLogs(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch {
      toast.error('Failed to load audit records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, actionFilter, entityFilter])

  const handleVerifyChain = async () => {
    setVerifying(true)
    try {
      const res = await auditApi.verifyChain()
      setVerifyResult(res)
      if (res.chain_valid) {
        toast.success(`Audit chain verified intact: ${res.verified_records} record(s) checked.`)
      } else {
        toast.error(`Audit chain integrity violation: ${res.tampered_records.length} corrupted record(s)`)
      }
    } catch {
      toast.error('Could not run cryptographic verification')
    } finally {
      setVerifying(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(text)
    toast.success('Hash copied')
    setTimeout(() => setCopiedHash(null), 2000)
  }

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300">CREATE</Badge>
      case 'update':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-300">UPDATE</Badge>
      case 'status_change':
        return <Badge className="bg-purple-50 text-purple-700 border-purple-300">STATUS CHANGE</Badge>
      case 'delete':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-300">DELETE</Badge>
      default:
        return <Badge variant="outline">{action}</Badge>
    }
  }

  // Filter logs by search if needed
  const filteredLogs = logs.filter((l) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      l.entity_id.toLowerCase().includes(term) ||
      l.actor?.full_name?.toLowerCase().includes(term) ||
      l.actor?.email?.toLowerCase().includes(term) ||
      l.hash.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      {/* Top Banner */}
<<<<<<< HEAD
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-primary-950 via-primary-900 to-primary-800 gov-hero-pattern border-b-4 border-saffron-500 p-6 text-white shadow-md">
=======
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md">
>>>>>>> 567dfba31ed8304e11ace21d3a76eee734665438
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-400/30">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              AICTE Compliance & Regulatory Security
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tamper-Evident System Audit Trail</h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Cryptographically sealed ledger. Every creation, modification, verification, and clearance decision is recorded with a SHA-256 hash chaining sequence.
          </p>
        </div>

        <Button
          onClick={handleVerifyChain}
          disabled={verifying}
          className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs gap-2 shrink-0 py-2.5 px-4 shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 ${verifying ? 'animate-spin' : ''}`} />
          {verifying ? 'Validating Hashes...' : 'Verify Ledger Integrity'}
        </Button>
      </div>

      {/* Verification Result Banner */}
      {verifyResult && (
        <div
          className={`rounded-xl border p-4 transition-all ${
            verifyResult.chain_valid
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {verifyResult.chain_valid ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">
                  {verifyResult.chain_valid
                    ? 'Cryptographic Hash-Chain Intact — Zero Tampering Detected'
                    : 'Security Warning: Audit Log Chain Compromised'}
                </span>
                <span className="font-mono text-[11px] bg-white/70 px-2 py-0.5 rounded border border-emerald-300">
                  {verifyResult.verified_records} / {verifyResult.total_records} Verified
                </span>
              </div>
              <p className="text-slate-600">
                {verifyResult.chain_valid
                  ? 'All sequential SHA-256 hashes match their predecessor hashes. No database rows have been altered or deleted.'
                  : `Detected ${verifyResult.tampered_records.length} records failing mathematical hash chain verification.`}
              </p>
              {verifyResult.first_hash && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10px] text-slate-600 pt-2 border-t border-emerald-200">
                  <div>Genesis Hash: {verifyResult.first_hash.slice(0, 16)}...</div>
                  <div>Head Hash: {verifyResult.last_hash.slice(0, 16)}...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-2xs">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, actor, or hash snippet..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Actions</option>
            <option value="create">CREATE</option>
            <option value="update">UPDATE</option>
            <option value="status_change">STATUS CHANGE</option>
            <option value="delete">DELETE</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value)
              setPage(1)
            }}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Entities</option>
            <option value="deposit_case">Deposit Cases</option>
            <option value="deposit_evidence">Deposit Evidence</option>
            <option value="user">Users</option>
            <option value="institution">Institutions</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Seq</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">SHA-256 Hash</th>
                <th className="py-3 px-4 text-center">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary-600" />
                    Loading cryptographically verified records...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isCopied = copiedHash === log.hash
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{log.sequence}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                        {formatDate(log.timestamp, 'full')}
                      </td>
                      <td className="py-3 px-4">{getActionBadge(log.action)}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div>
                          <span className="capitalize">{log.entity_type.replace(/_/g, ' ')}</span>
                          <p className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                            {log.entity_id}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {log.actor?.full_name || log.actor_id}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {log.actor?.role || log.actor?.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-600 truncate max-w-[110px]" title={log.hash}>
                            {log.hash.slice(0, 10)}...{log.hash.slice(-6)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(log.hash)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                            title="Copy full hash"
                          >
                            {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {(log.new_values || log.old_values) ? (
                          <details className="text-left">
                            <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 font-semibold text-[11px]">
                              Inspect
                            </summary>
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                              <div className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 max-h-[80vh] overflow-y-auto">
                                <h3 className="font-bold text-slate-900 text-sm mb-2">
                                  Audit Record #{log.sequence} Details
                                </h3>
                                <p className="text-xs text-slate-500 mb-4">
                                  Action: <strong className="text-slate-800">{log.action}</strong> on{' '}
                                  <strong className="text-slate-800">{log.entity_type}</strong>
                                </p>
                                {log.old_values && (
                                  <div className="mb-3">
                                    <span className="font-semibold text-slate-600 text-xs block mb-1">Previous Values:</span>
                                    <pre className="text-xs font-mono bg-rose-50 text-rose-900 p-2.5 rounded-lg border border-rose-200 overflow-x-auto">
                                      {JSON.stringify(log.old_values, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.new_values && (
                                  <div>
                                    <span className="font-semibold text-slate-600 text-xs block mb-1">Committed Values:</span>
                                    <pre className="text-xs font-mono bg-emerald-50 text-emerald-900 p-2.5 rounded-lg border border-emerald-200 overflow-x-auto">
                                      {JSON.stringify(log.new_values, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                                  <Button size="sm" variant="outline" onClick={(e) => {
                                    const details = (e.target as HTMLElement).closest('details')
                                    if (details) details.open = false
                                  }}>
                                    Close
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </details>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{filteredLogs.length}</strong> of{' '}
            <strong className="text-slate-800">{total}</strong> recorded blocks
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <span className="px-2 font-medium text-slate-700">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="gap-1 text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
