import { Badge } from '../ui/Badge';
import { getStatusConfig } from './caseStatus';
import type { CaseStatus } from '../../types/case';

export function CaseStatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const config = getStatusConfig(status);
  return <Badge variant={config.variant} className={className}>{config.label}</Badge>;
}
