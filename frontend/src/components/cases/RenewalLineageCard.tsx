import { Link } from 'react-router-dom';
import { GitBranch, ArrowUpRight, ArrowDownLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/helpers';
import type { DepositCaseDetail } from '../../types/case';

interface RenewalLineageCardProps {
  caseData: DepositCaseDetail;
  onOpenRenewModal?: () => void;
  currentUserRole?: string;
}

export function RenewalLineageCard({ caseData, onOpenRenewModal, currentUserRole }: RenewalLineageCardProps) {
  const hasParent = Boolean(caseData.parent_case || caseData.parent_case_id);
  const childCases = caseData.child_cases || [];
  const hasChildren = childCases.length > 0;
  const isInstitutionRep = currentUserRole === 'institution_rep';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-base">Instrument Lineage & Renewal Chain</h3>
              <Badge variant="outline" className="text-xs bg-indigo-50/50 text-indigo-700 border-indigo-200">
                Preserves Full Audit History
              </Badge>
            </div>
            <p className="text-xs text-gray-500">
              Tracks continuity across rollover, replacement, and extension lifecycle events
            </p>
          </div>
        </div>

        {isInstitutionRep && onOpenRenewModal && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenRenewModal}
            className="gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Renew / Replace Instrument
          </Button>
        )}
      </div>

      {/* 1. Parent Lineage (If this case is a renewal) */}
      {hasParent && (
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 uppercase tracking-wider">
              <ArrowDownLeft className="h-4 w-4 text-blue-600" />
              Preceding (Parent) Instrument
            </div>
            {caseData.parent_case_id && (
              <Link
                to={`/cases/${caseData.parent_case_id}`}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
              >
                Open Original Case
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-700 pt-1">
            <div>
              <span className="text-gray-500 block">Original Reference</span>
              <span className="font-mono font-medium text-gray-900">
                {caseData.parent_case?.case_number || caseData.parent_case_id}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Original Instrument</span>
              <span className="font-mono font-medium text-gray-900">
                {caseData.parent_case?.instrument_number || 'Historical FDR'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Original Amount</span>
              <span className="font-semibold text-gray-900">
                {caseData.parent_case ? formatCurrency(caseData.parent_case.amount) : 'Recorded'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Lineage Status</span>
              <Badge variant="success" className="text-xs mt-0.5">
                Rolled Over & Replaced
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* 2. Subsequent Children (If this case was renewed into newer instruments) */}
      {hasChildren && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 uppercase tracking-wider">
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            Subsequent Renewal Instruments ({childCases.length})
          </div>

          <div className="space-y-2">
            {childCases.map((child) => (
              <div
                key={child.id}
                className="p-3 bg-white rounded-lg border border-emerald-200/80 flex items-center justify-between text-xs flex-wrap gap-2 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-mono font-semibold text-gray-900">{child.case_number}</span>
                    <span className="text-gray-500 ml-2">FDR #{child.instrument_number}</span>
                    <span className="text-gray-500 ml-2">({child.issuing_bank})</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-semibold text-emerald-700">{formatCurrency(child.amount)}</span>
                  <Badge variant="outline" className="capitalize text-xs">
                    {child.status.replace(/_/g, ' ')}
                  </Badge>
                  <Link
                    to={`/cases/${child.id}`}
                    className="p-1 rounded text-emerald-700 hover:text-emerald-900 font-medium inline-flex items-center"
                  >
                    View <ArrowUpRight className="h-3 w-3 ml-0.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Base Case (No parent or children yet) */}
      {!hasParent && !hasChildren && (
        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 flex items-center justify-between text-xs text-gray-500 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              Primary Root Instrument: Active under initial term. When maturity approaches, renew to preserve continuity.
            </span>
          </div>
          {isInstitutionRep && onOpenRenewModal && (
            <button
              onClick={onOpenRenewModal}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
            >
              Initiate Renewal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
