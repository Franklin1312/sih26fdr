import { Download, Edit, FileText, ExternalLink } from 'lucide-react';
import { CaseStatusBadge } from './CaseStatusBadge';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatDate, formatCurrency } from '../../utils/helpers';
import type { DepositCaseDetail } from '../../types/case';

interface CaseHeaderProps {
  caseData: DepositCaseDetail;
  onEdit?: () => void;
  onDownloadAll?: () => void;
  currentUserRole: string;
}

export function CaseHeader({ caseData, onEdit, onDownloadAll, currentUserRole }: CaseHeaderProps) {
  const isDraft = caseData.status === 'draft';
  const canEdit = isDraft && currentUserRole === 'institution_rep' && onEdit;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center flex-wrap gap-3 mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Case #{caseData.case_number}</h1>
            <CaseStatusBadge status={caseData.status} />
            {caseData.tracking_ref && (
              <Badge variant="outline" className="flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {caseData.tracking_ref}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Deposit Type</p>
              <p className="font-medium capitalize">{caseData.deposit_type?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-gray-500">Deposit Method</p>
              <p className="font-medium capitalize">{caseData.deposit_method?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-gray-500">Amount</p>
              <p className="font-medium text-lg text-primary-600">{formatCurrency(caseData.amount)}</p>
            </div>
            <div>
              <p className="text-gray-500">Created</p>
              <p className="font-medium">{formatDate(caseData.created_at, 'full')}</p>
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
