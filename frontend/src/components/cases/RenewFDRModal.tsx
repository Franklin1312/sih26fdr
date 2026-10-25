import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, RefreshCw, AlertCircle, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { casesApi } from '../../api/cases';
import { formatCurrency, formatDate } from '../../utils/helpers';
import type { DepositCaseDetail, DepositCaseResponse } from '../../types/case';
import { toast } from 'sonner';

interface RenewFDRModalProps {
  caseData: DepositCaseDetail;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newCase: DepositCaseResponse) => void;
}

export function RenewFDRModal({ caseData, isOpen, onClose, onSuccess }: RenewFDRModalProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state pre-populated with parent instrument
  const [instrumentNumber, setInstrumentNumber] = useState('');
  const [issuingBank, setIssuingBank] = useState(caseData.issuing_bank || '');
  const [amount, setAmount] = useState(caseData.amount ? String(caseData.amount) : '');
  const [maturityDate, setMaturityDate] = useState(() => {
    // Default to 3 years from today
    const d = new Date();
    d.setFullYear(d.getFullYear() + 3);
    return d.toISOString().split('T')[0];
  });
  const [instrumentDate, setInstrumentDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [renewalNotes, setRenewalNotes] = useState(
    `Rollover renewal instrument replacing mature FDR #${caseData.instrument_number}`
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!instrumentNumber.trim()) {
      setError('Please enter the new instrument or FDR number');
      return;
    }
    if (!maturityDate) {
      setError('Please provide the new maturity date');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive renewal amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCase = await casesApi.renew(caseData.id, {
        instrument_number: instrumentNumber.trim(),
        issuing_bank: issuingBank.trim(),
        amount: numAmount,
        currency: caseData.currency || 'INR',
        instrument_date: new Date(instrumentDate).toISOString(),
        maturity_date: new Date(maturityDate).toISOString(),
        term_end_date: caseData.term_end_date,
        renewal_notes: renewalNotes.trim(),
      });

      toast.success(`Renewal instrument registered: Ref #${newCase.case_number}`);
      onClose();
      if (onSuccess) {
        onSuccess(newCase);
      } else {
        navigate(`/cases/${newCase.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register renewal instrument');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50/60 to-indigo-50/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">Renew / Replace Deposit Instrument</h2>
                <Badge variant="outline" className="text-xs bg-white">
                  Capability 5
                </Badge>
              </div>
              <p className="text-xs text-gray-500">
                Preserves complete historical custody chain and links to original case record
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Instrument Linkage Box */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-2">
            <p className="font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              Existing Parent Instrument Lineage
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-gray-600">
              <div>
                <span className="text-gray-400 block">Original Ref</span>
                <span className="font-mono font-medium text-gray-900">{caseData.tracking_ref}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Instrument No</span>
                <span className="font-mono font-medium text-gray-900">{caseData.instrument_number}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Current Amount</span>
                <span className="font-semibold text-gray-900">{formatCurrency(caseData.amount)}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Prior Maturity</span>
                <span className="font-medium text-gray-900">
                  {caseData.maturity_date ? formatDate(caseData.maturity_date, 'medium') : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* New Renewal Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                New Instrument / FDR Receipt Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={instrumentNumber}
                onChange={(e) => setInstrumentNumber(e.target.value)}
                placeholder="e.g. FDR-2026-908123"
                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Issuing Bank & Branch <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={issuingBank}
                onChange={(e) => setIssuingBank(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Renewal Principal Amount (INR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Booking / Issue Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={instrumentDate}
                onChange={(e) => setInstrumentDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                New Maturity Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                Must meet AICTE Approval Process Handbook prescribed minimum validity term
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Rollover Remarks & Authorization Reference
              </label>
              <textarea
                rows={2}
                value={renewalNotes}
                onChange={(e) => setRenewalNotes(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Registering Renewal...
                </>
              ) : (
                <>
                  Create Renewal Instrument
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
