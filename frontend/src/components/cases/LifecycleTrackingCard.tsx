import { Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { formatDate } from '../../utils/helpers';
import type { DepositCaseDetail } from '../../types/case';

interface LifecycleTrackingCardProps {
  caseData: DepositCaseDetail;
}

export function LifecycleTrackingCard({ caseData }: LifecycleTrackingCardProps) {
  const dates = caseData.lifecycle_dates || [];

  // Helper to calculate days remaining
  const getDaysRemaining = (targetDateStr: string | null | undefined): { text: string; isPast: boolean; days: number } => {
    if (!targetDateStr) return { text: 'N/A', isPast: false, days: 0 };
    const target = new Date(targetDateStr).getTime();
    const now = new Date().getTime();
    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Matured (${Math.abs(diffDays)}d ago)`, isPast: true, days: diffDays };
    } else if (diffDays === 0) {
      return { text: 'Matures Today', isPast: false, days: 0 };
    } else {
      return { text: `${diffDays} days remaining`, isPast: false, days: diffDays };
    }
  };

  const maturityInfo = getDaysRemaining(caseData.maturity_date);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-base">Deposit Lifecycle & Validity Dates</h3>
            <p className="text-xs text-gray-500">Autonomous timeline tracking for maturity, term end, and renewal alerts</p>
          </div>
        </div>

        {caseData.maturity_date && (
          <Badge
            variant={maturityInfo.isPast ? 'danger' : maturityInfo.days <= 30 ? 'warning' : 'outline'}
            className="text-xs font-medium"
          >
            <Clock className="h-3 w-3 mr-1 inline" />
            {maturityInfo.text}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Maturity Card */}
        <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">FDR Maturity Date</p>
          <p className="text-base font-semibold text-gray-900">
            {caseData.maturity_date ? formatDate(caseData.maturity_date, 'medium') : 'Not applicable / RTGS'}
          </p>
          <p className="text-xs text-gray-500">
            {maturityInfo.isPast ? 'Instrument past maturity date' : 'Scheduled release/rollover horizon'}
          </p>
        </div>

        {/* AICTE Term End Card */}
        <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">AICTE Term End</p>
          <p className="text-base font-semibold text-gray-900">
            {caseData.term_end_date ? formatDate(caseData.term_end_date, 'medium') : '5-Year Regulatory Period'}
          </p>
          <p className="text-xs text-gray-500">Full compliance horizon under APH</p>
        </div>

        {/* Renewal Due Card */}
        <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Renewal Due Alert</p>
          <p className="text-base font-semibold text-gray-900">
            {caseData.maturity_date
              ? formatDate(new Date(new Date(caseData.maturity_date).getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), 'medium')
              : 'Auto-renewal / N/A'}
          </p>
          <p className="text-xs text-amber-700">Advance notification lead: 60 days</p>
        </div>
      </div>

      {dates.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-semibold text-gray-700 mb-2">Tracked Regulatory Milestones ({dates.length})</p>
          <div className="space-y-2">
            {dates.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-2.5 rounded border border-gray-100 bg-white text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-medium text-gray-900 capitalize">{d.date_type.replace(/_/g, ' ')}</span>
                  {d.description && <span className="text-gray-500">— {d.description}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">Alert lead: {d.alert_lead_days}d</span>
                  <span className="font-semibold text-gray-900">{formatDate(d.date_value, 'medium')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
