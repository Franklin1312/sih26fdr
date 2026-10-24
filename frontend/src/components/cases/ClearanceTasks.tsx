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
  completed: { label: 'Completed', variant: 'success' as const, icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'danger' as const, icon: AlertCircle },
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
    const statusOrder: Record<string, number> = { pending: 0, claimed: 1, in_progress: 2, completed: 3, rejected: 4 };
    return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
  });

  return (
    <div className="space-y-3">
      {sortedTasks.map((task) => {
        const config = statusConfig[task.status] || statusConfig.pending;
        const isAssignedToMe = task.assigned_to === currentUserId;
        const canClaim = task.status === 'pending' && currentUserRole === 'clearance_officer';
        const canComplete = (task.status === 'claimed' || task.status === 'in_progress') && isAssignedToMe;

        return (
          <div key={task.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-gray-900">{task.clearance_type.replace(/_/g, ' ')}</h4>
                  <Badge variant={config.variant}>{config.label}</Badge>
                </div>
                {task.notes && <p className="text-sm text-gray-600 mb-2">{task.notes}</p>}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {task.assigned_to_user?.full_name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Assigned to: {task.assigned_to_user.full_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {task.evidence?.length && onViewEvidence && (
                  <Button variant="outline" size="sm" onClick={() => onViewEvidence(task.evidence![0])} className="gap-1">
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
                {(isAssignedToMe || task.status === 'completed') && (
                  <Button variant="ghost" size="sm" disabled className="gap-1">
                    <ChevronRight className="h-3 w-3" />
                    {task.status === 'completed' ? 'Done' : 'My Task'}
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
