import { Download, Eye, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatFileSize, formatDate } from '../../utils/helpers';
import type { DepositEvidenceResponse } from '../../types/case';

interface DocumentCardProps {
  document: DepositEvidenceResponse;
  onView?: (document: DepositEvidenceResponse) => void;
  onDownload?: (document: DepositEvidenceResponse) => void;
}

export function DocumentCard({ document, onView, onDownload }: DocumentCardProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4 hover:border-primary-200 hover:shadow-xs transition-all bg-white">
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 text-primary-600">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="truncate font-medium text-gray-900">{document.original_filename}</p>
            {document.document_type && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                {document.document_type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{formatFileSize(document.file_size)} · {formatDate(document.created_at)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onView && (
          <Button variant="outline" size="sm" onClick={() => onView(document)} className="flex items-center gap-1.5" aria-label="View document">
            <Eye className="h-4 w-4" />
            <span>View</span>
          </Button>
        )}
        {onDownload && (
          <Button variant="ghost" size="sm" onClick={() => onDownload(document)} aria-label="Download document" title="Download">
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
