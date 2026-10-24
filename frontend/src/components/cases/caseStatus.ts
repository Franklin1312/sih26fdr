import type { CaseStatus } from '../../types/case';

const statusConfig: Record<CaseStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  draft: { label: 'Draft', variant: 'default' },
  submitted: { label: 'Submitted', variant: 'info' },
  under_scrutiny: { label: 'Under Scrutiny', variant: 'warning' },
  clarification_pending: { label: 'Clarification Pending', variant: 'warning' },
  clearance_queue: { label: 'Clearance Queue', variant: 'info' },
  cleared: { label: 'Cleared', variant: 'success' },
  release_requested: { label: 'Release Requested', variant: 'info' },
  review: { label: 'In Review', variant: 'warning' },
  final_decision: { label: 'Final Decision', variant: 'info' },
  released: { label: 'Released', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  closed: { label: 'Closed', variant: 'default' },
};

export function getStatusConfig(status: CaseStatus) {
  return statusConfig[status];
}

export function getStatusLabel(status: CaseStatus): string {
  return getStatusConfig(status)?.label ?? status;
}

export function getStatusVariant(status: CaseStatus) {
  return getStatusConfig(status)?.variant ?? 'default';
}

export const STATUS_ORDER = Object.keys(statusConfig) as CaseStatus[];
