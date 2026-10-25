import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { releaseApi } from '../../api'
import {
  formatCurrency,
  getDepositTypeLabel,
} from '../../utils/helpers'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { toast } from 'sonner'
import {
  Award,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Building2,
  IndianRupee,
  FileText,
  ShieldCheck,
  ClipboardList,
  ChevronRight,
  Printer,
} from 'lucide-react'
import type { ReleaseDecisionRequest } from '../../types/release'

const DECISION_OPTIONS = [
  {
    value: 'release' as const,
    label: 'Approve Release',
    description: 'Authorize the release/refund of this security deposit or FDR.',
    icon: CheckCircle2,
    color: 'emerald',
    borderColor: 'border-emerald-400',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  {
    value: 'reject' as const,
    label: 'Reject Request',
    description: 'Decline the release request. The institution must re-apply.',
    icon: XCircle,
    color: 'red',
    borderColor: 'border-red-400',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  {
    value: 'return_for_correction' as const,
    label: 'Return for Correction',
    description: 'Return the case for corrections. The institution can resubmit.',
    icon: RotateCcw,
    color: 'amber',
    borderColor: 'border-amber-400',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
]

export function AuthorityDecisionPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedDecision, setSelectedDecision] = useState<'release' | 'reject' | 'return_for_correction' | null>(null)
  const [reasoning, setReasoning] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: releaseDetail, isLoading, error } = useQuery({
    queryKey: ['release-detail', caseId],
    queryFn: () => releaseApi.getCaseDetail(caseId!),
    enabled: !!caseId,
  })

  const { data: checklist } = useQuery({
    queryKey: ['release-checklist', caseId],
    queryFn: () => releaseApi.getChecklist(caseId!),
    enabled: !!caseId,
  })

  const decideMutation = useMutation({
    mutationFn: (data: ReleaseDecisionRequest) => releaseApi.makeDecision(caseId!, data),
    onSuccess: () => {
      toast.success('Decision recorded successfully')
      queryClient.invalidateQueries({ queryKey: ['release-queue'] })
      queryClient.invalidateQueries({ queryKey: ['release-detail', caseId] })
      navigate('/authority')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to record decision')
    },
  })

  function handleSubmitDecision() {
    if (!selectedDecision || !reasoning.trim()) {
      toast.error('Please select a decision and provide reasoning')
      return
    }
    setConfirmOpen(true)
  }

  function handleConfirm() {
    if (!selectedDecision) return
    decideMutation.mutate({
      final_decision: selectedDecision,
      decision_reasoning: reasoning,
    })
    setConfirmOpen(false)
  }

  function handlePrint() {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
    )
  }

  if (error || !releaseDetail) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <p className="text-base font-semibold text-slate-700">Case not found</p>
        <Link to="/authority" className="mt-3 text-sm text-indigo-600 hover:underline">← Back to queue</Link>
      </div>
    )
  }

  const isAlreadyDecided = !!releaseDetail.final_decision
  const decisionOption = DECISION_OPTIONS.find((d) => d.value === selectedDecision)

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
          .print-order { border: 2px solid #000; padding: 32px; margin: 20px; }
        }
      `}</style>

      <div className="space-y-6 p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 no-print">
          <Link to="/authority" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Queue
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-sm">
                <Award className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Authority Decision</h1>
            </div>
            <p className="text-sm text-slate-500 ml-12">
              Case <span className="font-mono font-bold text-indigo-700">{releaseDetail.case_number}</span> — {releaseDetail.institution_name}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" /> Print Order
            </Button>
          </div>
        </div>

        {/* Printable Release Order */}
        <div className="print-order">
          {/* Case Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print-order">
            {[
              { icon: Building2, label: 'Institution', value: releaseDetail.institution_name, color: 'indigo' },
              { icon: FileText, label: 'Deposit Type', value: getDepositTypeLabel(releaseDetail.deposit_type), color: 'violet' },
              { icon: IndianRupee, label: 'Amount', value: formatCurrency(releaseDetail.amount), color: 'emerald' },
              { icon: ShieldCheck, label: 'Release Path', value: releaseDetail.review_path?.replace('_', ' ').toUpperCase() ?? '—', color: 'blue' },
            ].map(({ icon: Icon, label, value, color }) => (
              <Card key={label} className={`border-0 shadow-sm bg-${color}-50/60`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 text-${color}-600`} />
                    <p className={`text-[11px] font-bold uppercase tracking-wider text-${color}-500`}>{label}</p>
                  </div>
                  <p className="font-bold text-slate-800">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Checklist */}
          {checklist && (
            <Card className="mt-4 border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <ClipboardList className="h-4 w-4 text-slate-500" />
                  Release Checklist
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${checklist.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {checklist.completed_count}/{checklist.mandatory_count} mandatory
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {checklist.items.map((item) => (
                    <div key={item.key} className={`flex items-start gap-2.5 rounded-xl p-3 ${item.completed ? 'bg-emerald-50' : item.mandatory ? 'bg-red-50' : 'bg-slate-50'}`}>
                      {item.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${item.mandatory ? 'text-red-500' : 'text-amber-400'}`} />
                      )}
                      <div>
                        <p className={`text-xs font-semibold ${item.completed ? 'text-emerald-800' : item.mandatory ? 'text-red-800' : 'text-slate-600'}`}>
                          {item.label}
                        </p>
                        {!item.completed && item.mandatory && (
                          <p className="text-[11px] text-red-500 mt-0.5">Missing — mandatory requirement</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {!checklist.passed && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">
                      Checklist incomplete. Authority may still decide, but must record reasoning for any override.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Decision Panel — hide if already decided */}
        {isAlreadyDecided ? (
          <Card className="border-0 shadow-sm bg-slate-50">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-bold text-slate-800">Decision Already Recorded</p>
              <p className="text-sm text-slate-500 mt-1">
                Final decision: <strong className="text-slate-700 capitalize">{releaseDetail.final_decision?.replace('_', ' ')}</strong>
              </p>
              {releaseDetail.decision_reasoning && (
                <p className="mt-2 text-xs text-slate-400 italic">"{releaseDetail.decision_reasoning}"</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200/80 shadow-sm no-print">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Award className="h-4 w-4 text-violet-600" />
                Record Authority Decision
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Decision Options */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {DECISION_OPTIONS.map((opt) => {
                  const isSelected = selectedDecision === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedDecision(opt.value)}
                      className={`rounded-2xl border-2 p-4 text-left transition-all ${
                        isSelected
                          ? `${opt.borderColor} ${opt.bgColor} shadow-sm`
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <opt.icon className={`h-5 w-5 ${isSelected ? opt.textColor : 'text-slate-400'}`} />
                        <p className={`text-sm font-bold ${isSelected ? opt.textColor : 'text-slate-700'}`}>{opt.label}</p>
                      </div>
                      <p className="text-[11px] text-slate-500">{opt.description}</p>
                    </button>
                  )
                })}
              </div>

              {/* Reasoning */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Decision Reasoning <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Record detailed reasoning for the decision. Reference applicable regulations, AICTE clause, or administrative procedures..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                />
                <p className="mt-1 text-[11px] text-slate-400">This reasoning will appear in the audit trail and printed release order.</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500">
                  {!checklist?.passed && (
                    <span className="text-amber-600 font-medium">⚠ Checklist not fully complete — extra justification required</span>
                  )}
                </p>
                <Button
                  onClick={handleSubmitDecision}
                  disabled={!selectedDecision || !reasoning.trim() || decideMutation.isPending}
                  className={`gap-2 ${decisionOption ? decisionOption.buttonClass : ''}`}
                >
                  {decideMutation.isPending ? 'Saving...' : 'Submit Decision'}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Modal.Content>
          <Modal.Header><Modal.Title>Confirm Authority Decision</Modal.Title></Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
          {decisionOption && (
            <div className={`rounded-2xl ${decisionOption.bgColor} p-4 ring-1 ${decisionOption.borderColor}`}>
              <div className="flex items-center gap-2 mb-1">
                <decisionOption.icon className={`h-5 w-5 ${decisionOption.textColor}`} />
                <p className={`font-bold text-sm ${decisionOption.textColor}`}>{decisionOption.label}</p>
              </div>
              <p className="text-xs text-slate-600 mt-1">Case: <strong>{releaseDetail.case_number}</strong> — {releaseDetail.institution_name}</p>
              <p className="text-xs text-slate-600">Amount: <strong>{formatCurrency(releaseDetail.amount)}</strong></p>
            </div>
          )}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-600 mb-1">Reasoning on record:</p>
            <p className="text-xs text-slate-500 italic">"{reasoning}"</p>
          </div>
          <p className="text-xs text-slate-500">
            This action is <strong>final</strong> and will be logged in the audit trail. Are you sure?
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={decideMutation.isPending}
              className={decisionOption?.buttonClass ?? ''}
            >
              {decideMutation.isPending ? 'Submitting...' : 'Confirm Decision'}
            </Button>
          </div>
            </div>
          </Modal.Body>
        </Modal.Content>
      </Modal>
    </>
  )
}
