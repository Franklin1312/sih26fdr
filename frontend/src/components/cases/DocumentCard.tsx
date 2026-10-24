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
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-gray-500" />
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{document.original_filename}</p>
          <p className="text-sm text-gray-500">{formatFileSize(document.file_size)} · {formatDate(document.created_at)}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {onView && <Button variant="ghost" size="sm" onClick={() => onView(document)} aria-label="View document"><Eye className="h-4 w-4" /></Button>}
        {onDownload && <Button variant="ghost" size="sm" onClick={() => onDownload(document)} aria-label="Download document"><Download className="h-4 w-4" /></Button>}
      </div>
    </div>
  );
}
