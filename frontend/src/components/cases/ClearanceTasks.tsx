import { CheckCircle, AlertCircle, Clock, User, ChevronRight, FileText } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { ClearanceTaskResponse } from '../../types/case';

interface ClearanceTasksProps {
  tasks: ClearanceTaskResponse[];
  onClaim?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onViewEvidence?: (evidenceId: string) => void;
  currentUserId?: string;
  currentUserRole?: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'warning' | 'info' | 'success' | 'danger'; icon: typeof Clock }> = {
  pending: { label: 'Pending', variant: 'default' as const, icon: Clock },
  claimed: { label: 'Claimed', variant: 'warning' as const, icon: User },
  in_progress: { label: 'In Progress', variant: 'info' as const, icon: AlertCircle },
  cleared: { label: 'Cleared', variant: 'success' as const, icon: CheckCircle },
  completed: { label: 'Cleared', variant: 'success' as const, icon: CheckCircle },
  flagged: { label: 'Flagged', variant: 'danger' as const, icon: AlertCircle },
  rejected: { label: 'Rejected', variant: 'danger' as const, icon: AlertCircle },
};

const CLEARANCE_TYPE_LABELS: Record<string, string> = {
  pgrc: 'Public Grievance Redressal Cell (PGRC)',
  vigilance: 'Vigilance Cell',
  technical: 'Technical Cell / Bureau',
  financial: 'Financial Clearance',
  legal: 'Legal Clearance',
  environmental: 'Environmental Clearance',
};

export function ClearanceTasks({ tasks, onClaim, onComplete, onViewEvidence, currentUserId, currentUserRole }: ClearanceTasksProps) {
  if (!tasks.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
        <p>No clearance tasks for this case</p>
      </div>
    );
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      pending: 0,
      claimed: 1,
      in_progress: 2,
      cleared: 3,
      completed: 3,
      flagged: 4,
      rejected: 4,
    };
    return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
  });

  return (
    <div className="space-y-3">
      {sortedTasks.map((task) => {
        const config = statusConfig[task.status] || statusConfig.pending;
        const isAssignedToMe = task.assigned_to === currentUserId;
        const isDone = task.status === 'cleared' || task.status === 'completed';
        const canClaim = task.status === 'pending' && currentUserRole === 'clearance_officer';
        const canComplete = (task.status === 'claimed' || task.status === 'in_progress') && isAssignedToMe;
        const typeLabel = CLEARANCE_TYPE_LABELS[task.clearance_type.toLowerCase()] || task.clearance_type.replace(/_/g, ' ');

        return (
          <div key={task.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-900">{typeLabel}</h4>
                  <Badge variant={config.variant} className="capitalize flex items-center gap-1">
                    <config.icon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
                {task.notes && (
                  <p className="text-sm text-gray-600 mb-2 whitespace-pre-line leading-relaxed">
                    {task.notes}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {task.assigned_to_user?.full_name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      Assigned to: {task.assigned_to_user.full_name}
                    </span>
                  )}
                  {task.completed_at && (
                    <span className="text-xs text-gray-400">
                      Completed: {new Date(task.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {Boolean(task.evidence) && onViewEvidence && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewEvidence(Array.isArray(task.evidence) ? task.evidence[0] : (task.evidence as unknown as string))}
                    className="gap-1"
                  >
                    <FileText className="h-3 w-3" />
                    View Evidence
                  </Button>
                )}
                {canClaim && onClaim && (
                  <Button variant="outline" size="sm" onClick={() => onClaim(task.id)} className="gap-1">
                    <User className="h-3 w-3" />
                    Claim
                  </Button>
                )}
                {canComplete && onComplete && (
                  <Button variant="primary" size="sm" onClick={() => onComplete(task.id)} className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Complete
                  </Button>
                )}
                {isDone && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    Cleared
                  </span>
                )}
                {!isDone && isAssignedToMe && (
                  <Button variant="ghost" size="sm" disabled className="gap-1 text-gray-500">
                    <ChevronRight className="h-3 w-3" />
                    My Task
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
