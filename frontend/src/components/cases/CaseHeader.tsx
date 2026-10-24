import { Download, Edit, FileText, ExternalLink, RefreshCw, GitBranch } from 'lucide-react';
import { CaseStatusBadge } from './CaseStatusBadge';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatDate, formatCurrency } from '../../utils/helpers';
import type { DepositCaseDetail } from '../../types/case';
import { Link } from 'react-router-dom';

interface CaseHeaderProps {
  caseData: DepositCaseDetail;
  onEdit?: () => void;
  onRenew?: () => void;
  onDownloadAll?: () => void;
  onRequestRelease?: () => void;
  currentUserRole: string;
}

export function CaseHeader({ caseData, onEdit, onRenew, onDownloadAll, onRequestRelease, currentUserRole }: CaseHeaderProps) {
  const isDraft = caseData.status === 'draft';
  const canEdit = isDraft && currentUserRole === 'institution_rep' && onEdit;
  const canRenew = currentUserRole === 'institution_rep' && onRenew && caseData.status !== 'rejected' && caseData.status !== 'closed';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center flex-wrap gap-3 mb-4">
            <h1 className="page-title">Case #{caseData.case_number}</h1>
            <CaseStatusBadge status={caseData.status} />
            {caseData.tracking_ref && (
              <Badge variant="outline" className="flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {caseData.tracking_ref}
              </Badge>
            )}
            {caseData.parent_case_id && (
              <Link to={`/cases/${caseData.parent_case_id}`}>
                <Badge variant="outline" className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors">
                  <GitBranch className="h-3 w-3" />
                  Renewed from #{caseData.parent_case?.case_number || caseData.parent_case_id.slice(0, 8)}
                </Badge>
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Deposit Type</p>
              <p className="font-medium capitalize">{caseData.deposit_type?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-gray-500">Instrument Number</p>
              <p className="font-medium font-mono text-gray-900">{caseData.instrument_number || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Issuing Bank</p>
              <p className="font-medium text-gray-900 truncate" title={caseData.issuing_bank}>{caseData.issuing_bank || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Amount</p>
              <p className="font-semibold text-lg text-primary-600">{formatCurrency(caseData.amount)}</p>
            </div>
            <div>
              <p className="text-gray-500">Maturity Date</p>
              <p className="font-medium">{caseData.maturity_date ? formatDate(caseData.maturity_date, 'medium') : 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
          {canEdit && (
            <Button variant="outline" onClick={onEdit} className="gap-1">
              <Edit className="h-4 w-4" />
              Edit Case
            </Button>
          )}
          {canRenew && (
            <Button
              variant="outline"
              onClick={onRenew}
              className="gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
            >
              <RefreshCw className="h-4 w-4" />
              Renew / Replace FDR
            </Button>
          )}
          {caseData.status === 'cleared' && currentUserRole === 'institution_rep' && onRequestRelease && (
            <Button onClick={onRequestRelease} className="gap-1">
              <FileText className="h-4 w-4" />
              Request release/refund
            </Button>
          )}
          {onDownloadAll && (
            <Button variant="outline" onClick={onDownloadAll} className="gap-1">
              <Download className="h-4 w-4" />
              Download All
            </Button>
          )}
          {caseData.status !== 'draft' && caseData.status !== 'rejected' && (
            <Button variant="ghost" className="gap-1 text-gray-600 hover:text-gray-900">
              <FileText className="h-4 w-4" />
              View Timeline
            </Button>
          )}
        </div>
      </div>

      {caseData.institution && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Institution</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-medium text-gray-900">{caseData.institution.name}</span>
            {caseData.institution.code && <span className="text-gray-500">({caseData.institution.code})</span>}
          </div>
        </div>
      )}
    </div>
  );
}
