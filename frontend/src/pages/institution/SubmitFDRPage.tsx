import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  FilePlus2,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
  ArrowLeft,
  FileText,
  HelpCircle,
} from 'lucide-react'
import { casesApi } from '../../api/cases'
import { useAuth } from '../../auth/useAuth'
import type { DepositType, DepositMethod } from '../../types/case'
import { formatCurrency } from '../../utils/helpers'

export const SubmitFDRPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const institutionId = user?.institution_id || 'inst_1'

  // Form State
  const [depositType, setDepositType] = useState<DepositType>('fdr')
  const [depositMethod, setDepositMethod] = useState<DepositMethod>('fdr_rpgf')
  const [issuingBank, setIssuingBank] = useState('State Bank of India')
  const [branchName, setBranchName] = useState('')
  const [instrumentNumber, setInstrumentNumber] = useState('')
  const [amount, setAmount] = useState<number | ''>(1500000)
  const [instrumentDate, setInstrumentDate] = useState(() => new Date().toISOString().split('T')[0])
  
  // Default maturity: 8 years from today (Clause 6.46 standard)
  const [maturityDate, setMaturityDate] = useState(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 8)
    return d.toISOString().split('T')[0]
  })

  // Regulatory context
  const [lienMarkedToAicte, setLienMarkedToAicte] = useState(true)
  const [jointEndorsed, setJointEndorsed] = useState(true)
  const [bankConfirmationObtained, setBankConfirmationObtained] = useState(true)

  // Document file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<{ id: string; tracking_ref: string } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!amount || amount <= 0) {
      setErrorMessage('Please provide a valid deposit amount')
      return
    }
    if (!instrumentNumber.trim()) {
      setErrorMessage('FDR / Instrument number is required')
      return
    }
    if (!issuingBank.trim()) {
      setErrorMessage('Issuing bank is required')
      return
    }
    if (!lienMarkedToAicte) {
      setErrorMessage('AICTE Clause 6.46 mandates that the lien must be marked to AICTE')
      return
    }

    try {
      setIsSubmitting(true)

      const payload = {
        institution_id: institutionId,
        deposit_type: depositType,
        deposit_method: depositMethod,
        amount: Number(amount),
        currency: 'INR',
        instrument_number: instrumentNumber.trim(),
        instrument_date: instrumentDate,
        maturity_date: maturityDate,
        issuing_bank: branchName ? `${issuingBank} (${branchName})` : issuingBank,
        regulatory_context: {
          clause_6_46_compliant: lienMarkedToAicte,
          joint_lien_aicte: jointEndorsed,
          bank_confirmation_attached: bankConfirmationObtained,
        },
      }

      const created = await casesApi.create(payload)

      // If a document was attached, upload it
      if (selectedFile) {
        try {
          await casesApi.uploadDocument(
            created.id,
            selectedFile,
            'fdr_receipt',
            `FDR receipt for ${instrumentNumber} - ${issuingBank}`
          )
        } catch (uploadErr) {
          console.warn('Document upload error after case creation', uploadErr)
        }
      }

      setSuccessResult({
        id: created.id,
        tracking_ref: created.tracking_ref ?? created.case_number,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit FDR record. Please verify fields.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            to="/institution/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FilePlus2 className="w-6 h-6 text-indigo-600" />
            Submit Fixed Deposit Receipt (FDR)
          </h1>
          <p className="text-xs text-slate-500">
            Submit new FDR or Security Deposit instrument for AICTE approval compliance verification.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span>{user?.full_name || 'Apex Institute of Technology'}</span>
        </div>
      </div>

      {/* Success Dialog Banner */}
      {successResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-emerald-950">
                FDR Submitted Successfully!
              </h2>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Your instrument has been registered and assigned tracking reference{' '}
                <strong className="font-mono text-emerald-950 px-1.5 py-0.5 bg-emerald-200/60 rounded">
                  {successResult.tracking_ref}
                </strong>
                . It has been routed to the AICTE Scrutiny Officer for verification against bank records.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => navigate(`/cases/${successResult.id}`)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              View Case Details
            </button>
            <Link
              to="/institution/deposits"
              className="px-4 py-2 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100/50 text-emerald-900 text-xs font-semibold transition-colors"
            >
              View Deposit Portfolio
            </Link>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!successResult && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Instrument Information Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
                1. Instrument Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deposit Instrument Type
                  </label>
                  <select
                    value={depositType}
                    onChange={(e) => setDepositType(e.target.value as DepositType)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="fdr">Fixed Deposit Receipt (FDR)</option>
                    <option value="rpgf">RPGF (Reinvestment Plan)</option>
                    <option value="security_deposit">Security Deposit</option>
                    <option value="bank_guarantee">Bank Guarantee</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Compliance Processing Method
                  </label>
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value as DepositMethod)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="fdr_rpgf">FDR/RPGF Joint Lien Route</option>
                    <option value="rtgs">Direct RTGS / Digital Transfer</option>
                    <option value="security_deposit_refund">Security Deposit Refund</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Issuing Bank <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={issuingBank}
                    onChange={(e) => setIssuingBank(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="State Bank of India">State Bank of India (SBI)</option>
                    <option value="Punjab National Bank">Punjab National Bank (PNB)</option>
                    <option value="Canara Bank">Canara Bank</option>
                    <option value="Bank of Baroda">Bank of Baroda</option>
                    <option value="Union Bank of India">Union Bank of India</option>
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="Axis Bank">Axis Bank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bank Branch Name & City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Connaught Place Branch, New Delhi"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    FDR / Instrument Certificate Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FDR-2026-992144"
                    value={instrumentNumber}
                    onChange={(e) => setInstrumentNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Principal Amount (INR) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">
                      ₹
                    </span>
                    <input
                      type="number"
                      required
                      min="1000"
                      step="1000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                      className="w-full pl-7 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deposit Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={instrumentDate}
                    onChange={(e) => setInstrumentDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Maturity Date (8-10 Year Term) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Document Evidence Upload */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
                2. Scanned FDR Document & Bank Confirmation
              </h2>

              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="fdrFile"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="fdrFile" className="cursor-pointer space-y-2 block">
                  <UploadCloud className="w-10 h-10 text-indigo-500 mx-auto" />
                  <div className="text-xs font-semibold text-slate-700">
                    {selectedFile ? (
                      <span className="text-indigo-600 font-bold">{selectedFile.name}</span>
                    ) : (
                      'Click to upload or drag and drop scanned FDR PDF/Image'
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    PDF, JPEG, or PNG up to 15MB. Ensure bank seal and joint lien text are legible.
                  </p>
                </label>
              </div>
            </div>

            {/* Regulatory Declarations */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                3. AICTE Regulatory Declarations (Clause 6.46)
              </h2>

              <div className="space-y-3 text-xs text-slate-700">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lienMarkedToAicte}
                    onChange={(e) => setLienMarkedToAicte(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <strong>Joint Lien to AICTE:</strong> I confirm that this FDR/RPGF has a joint lien marked in favor of <em>"The Member Secretary, AICTE"</em> as required by AICTE regulations.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jointEndorsed}
                    onChange={(e) => setJointEndorsed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <strong>Bank Endorsement:</strong> The issuing branch has stamped and endorsed the original receipt acknowledging the AICTE lien.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bankConfirmationObtained}
                    onChange={(e) => setBankConfirmationObtained(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <strong>Verification Consent:</strong> The institution authorizes AICTE to verify the deposit status directly with the issuing bank branch.
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                to="/institution/dashboard"
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                {isSubmitting ? 'Registering Instrument...' : 'Submit FDR for Verification'}
              </button>
            </div>
          </div>

          {/* Right Column: Live Summary Preview */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 sticky top-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                FDR Summary Preview
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Total Pledged Value</span>
                  <span className="text-xl font-bold text-slate-900">
                    {amount ? formatCurrency(Number(amount)) : '₹ 0'}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-2 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bank:</span>
                    <span className="font-semibold text-slate-800 text-right">{issuingBank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Certificate No:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {instrumentNumber || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Deposit Date:</span>
                    <span className="text-slate-800">{instrumentDate || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Maturity Date:</span>
                    <span className="text-slate-800 font-semibold">{maturityDate || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">AICTE Lien:</span>
                    <span className={lienMarkedToAicte ? 'text-emerald-600 font-semibold' : 'text-rose-600'}>
                      {lienMarkedToAicte ? 'Yes (Clause 6.46)' : 'No'}
                    </span>
                  </div>
                </div>

                {selectedFile && (
                  <div className="rounded-lg bg-indigo-50/60 p-2.5 border border-indigo-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span className="text-[11px] font-medium text-indigo-900 truncate">
                      {selectedFile.name}
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500 space-y-1 border border-slate-200/60">
                <div className="flex items-center gap-1 font-semibold text-slate-700">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                  What happens next?
                </div>
                <p>
                  Upon submission, your case status becomes <strong>SUBMITTED</strong>. An AICTE Scrutiny Officer verifies the joint lien with the bank branch before clearance.
                </p>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
