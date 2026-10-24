import { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building2,
  FileCheck2,
} from 'lucide-react'
import { casesApi } from '../../api/cases'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { toast } from 'sonner'
import type { DepositEvidenceResponse } from '../../types/case'

interface BankVerificationPanelProps {
  caseId: string
  caseNumber: string
  amount: number
  issuingBank: string
  instrumentNumber: string
  maturityDate?: string
  evidenceList: DepositEvidenceResponse[]
  onVerificationComplete?: () => void
}

export function BankVerificationPanel({
  caseId,
  caseNumber,
  amount,
  issuingBank,
  instrumentNumber,
  maturityDate,
  evidenceList,
  onVerificationComplete,
}: BankVerificationPanelProps) {
  const primaryEvidence = evidenceList[0]

  const [verificationRef, setVerificationRef] = useState(
    `SFMS/AICTE/${caseNumber.replace(/[^a-zA-Z0-9]/g, '')}/${new Date().getFullYear()}`
  )
  const [confirmedAmount, setConfirmedAmount] = useState<number>(amount)
  const [confirmedMaturity, setConfirmedMaturity] = useState<string>(
    maturityDate ? maturityDate.slice(0, 10) : ''
  )
  const [bankNotes, setBankNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<{
    success: boolean
    has_discrepancy: boolean
    discrepancies: string[]
    message: string
  } | null>(null)

  // Check if primary evidence already has discrepancy
  const existingFlags = primaryEvidence?.validation_flags as Record<string, unknown> | undefined
  const isAlreadyVerified = existingFlags?.bank_verified as boolean | undefined
  const existingDiscrepancies = (existingFlags?.discrepancies as string[]) || []

  const handleSimulateDiscrepancy = () => {
    // Under-report by ₹50,000 to demo discrepancy flagging for SIH evaluators
    const mismatchedAmount = Math.max(0, amount - 50000)
    setConfirmedAmount(mismatchedAmount)
    toast.info('Set simulated bank amount to ₹' + mismatchedAmount.toLocaleString('en-IN') + ' for discrepancy demonstration.')
  }

  const handleResetToDeclared = () => {
    setConfirmedAmount(amount)
    if (maturityDate) setConfirmedMaturity(maturityDate.slice(0, 10))
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!primaryEvidence) {
      toast.error('No uploaded deposit evidence found to link verification against.')
      return
    }

    setSubmitting(true)
    try {
      const res = await casesApi.verifyBank(caseId, primaryEvidence.id, {
        verification_ref: verificationRef,
        verified_amount: Number(confirmedAmount),
        verified_maturity_date: confirmedMaturity || undefined,
        bank_notes: bankNotes || undefined,
      })

      setLastResult(res)
      if (res.has_discrepancy) {
        toast.warning(`Discrepancy flagged: ${res.discrepancies.length} discrepancy warning(s) detected.`)
      } else {
        toast.success('Independent bank verification confirmed and recorded in audit ledger.')
      }

      if (onVerificationComplete) {
        onVerificationComplete()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Independent Bank Verification (SFMS / Core Banking)
              </h3>
              {isAlreadyVerified && (
                <Badge
                  variant={existingDiscrepancies.length > 0 ? 'warning' : 'success'}
                  className="text-[10px]"
                >
                  {existingDiscrepancies.length > 0 ? 'Discrepancy Flagged' : 'Bank Confirmed'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Regulatory mandate: AICTE officers must verify institution self-declaration against independent bank confirmation.
            </p>
          </div>
        </div>
      </div>

      {/* Discrepancy Banner (If Detected) */}
      {(lastResult?.has_discrepancy || existingDiscrepancies.length > 0) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-950 space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-rose-800">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>CRITICAL REGULATORY DISCREPANCY IDENTIFIED</span>
          </div>
          <p className="text-rose-700">
            The independent bank records do not match the values self-declared by the institution:
          </p>
          <ul className="list-disc list-inside space-y-1 font-semibold text-rose-900 bg-white/70 p-3 rounded-lg border border-rose-200">
            {(lastResult?.discrepancies || existingDiscrepancies).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
          <p className="text-[11px] text-rose-600 italic">
            Recommendation: Request Clarification from Institution or refer to Vigilance / Finance Cell before granting NOC.
          </p>
        </div>
      )}

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Institution Declaration (Read-only) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Institution Self-Declaration
            </span>
            <span className="text-[10px] text-slate-400 font-medium">As Submitted</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Instrument #:</span>
              <span className="font-mono font-semibold text-slate-900">{instrumentNumber || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Issuing Bank:</span>
              <span className="font-medium text-slate-900">{issuingBank || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Principal Deposit:</span>
              <span className="font-bold text-primary-700 text-sm">{formatCurrency(amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Declared Maturity:</span>
              <span className="font-medium text-slate-900">
                {maturityDate ? formatDate(maturityDate, 'medium') : 'Perpetual / RTGS'}
              </span>
            </div>
          </div>
        </div>

        {/* Bank Independent Confirmation Form */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
            <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
              2. Bank Confirmation Gateway
            </span>
            <span className="text-[10px] text-indigo-600 font-medium">Independent SFMS</span>
          </div>

          <form onSubmit={handleVerify} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                SFMS / Bank Verification Ref No. *
              </label>
              <input
                type="text"
                required
                value={verificationRef}
                onChange={(e) => setVerificationRef(e.target.value)}
                className="w-full text-xs font-mono border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Confirmed Amount (INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={confirmedAmount}
                  onChange={(e) => setConfirmedAmount(Number(e.target.value))}
                  className="w-full text-xs font-mono border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Confirmed Maturity Date
                </label>
                <input
                  type="date"
                  value={confirmedMaturity}
                  onChange={(e) => setConfirmedMaturity(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                Bank Officer / SFMS Remarks
              </label>
              <input
                type="text"
                placeholder="e.g. Lien marked to AICTE Member Secretary confirmed in Finacle"
                value={bankNotes}
                onChange={(e) => setBankNotes(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Demo Quick-Actions for Evaluator Presentation */}
            <div className="pt-2 border-t border-indigo-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSimulateDiscrepancy}
                  className="text-[10px] text-amber-700 border-amber-300 hover:bg-amber-50 h-7 px-2"
                  title="Under-report amount by ₹50,000 to demo discrepancy detection"
                >
                  Demo Mismatch (-₹50k)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToDeclared}
                  className="text-[10px] text-slate-600 h-7 px-2"
                >
                  Reset Match
                </Button>
              </div>

              <Button
                type="submit"
                disabled={submitting || !primaryEvidence}
                size="sm"
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-8 px-3 gap-1 shadow-2xs"
              >
                {submitting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {submitting ? 'Verifying...' : 'Record Bank Confirmation'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
