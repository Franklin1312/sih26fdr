import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clearanceApi } from '../../api/clearance';
import type { ClearanceTaskDetail } from '../../types/clearance';
import { formatDate } from '../../utils/helpers';
import { AlertCircle, Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';

const TASK_STATUS_CONFIG: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
  pending: { variant: 'default', label: 'Pending' },
  claimed: { variant: 'info', label: 'Claimed' },
  in_progress: { variant: 'warning', label: 'In Progress' },
  cleared: { variant: 'success', label: 'Cleared' },
  rejected: { variant: 'danger', label: 'Rejected' },
};

const CLEARANCE_TYPE_LABELS: Record<string, string> = {
  financial: 'Financial',
  legal: 'Legal',
  technical: 'Technical',
  environmental: 'Environmental',
};

export function ClearanceTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ClearanceTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'claim' | 'complete'>('claim');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    const fetchTask = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await clearanceApi.getTaskDetail(taskId);
        setTask(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load task details');
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [taskId]);

  const handleClaim = async () => {
    if (!taskId) return;
    setActionLoading(true);
    try {
      await clearanceApi.claimTask(taskId);
      const data = await clearanceApi.getTaskDetail(taskId);
      setTask(data);
      setActionModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to claim task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!taskId || !task || !notes.trim()) return;
    setActionLoading(true);
    try {
      await clearanceApi.completeTask(task.id, { notes: notes.trim() });
      const data = await clearanceApi.getTaskDetail(taskId);
      setTask(data);
      setActionModalOpen(false);
      setNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to complete task');
    } finally {
      setActionLoading(false);
    }
  };

  const openClaimModal = () => {
    setActionType('claim');
    setActionModalOpen(true);
  };

  const openCompleteModal = () => {
    setActionType('complete');
    setActionModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Unable to load task</h2>
        <p className="text-gray-500 mt-2">{error || 'Task not found'}</p>
        <Button variant="primary" onClick={() => navigate('/clearance')} className="mt-4">
          Back to Queue
        </Button>
      </div>
    );
  }

  const statusConfig = TASK_STATUS_CONFIG[task.status] || { variant: 'default', label: task.status };
  const typeLabel = CLEARANCE_TYPE_LABELS[task.clearance_type] || task.clearance_type;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clearance')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Queue
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clearance Task Detail</h1>
            <p className="text-gray-500">{task.case_number} - {typeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          {task.assigned_to_user && (
            <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
              Assigned to {task.assigned_to_user.full_name}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-gray-500">Clearance Type</p><p className="font-medium text-gray-900">{typeLabel}</p></div>
              <div><p className="text-sm text-gray-500">Status</p><Badge variant={statusConfig.variant}>{statusConfig.label}</Badge></div>
              <div><p className="text-sm text-gray-500">Assigned Officer</p><p className="font-medium text-gray-900">{task.assigned_to_user?.full_name || 'Unassigned'}</p></div>
              <div><p className="text-sm text-gray-500">Created</p><p className="font-medium text-gray-900">{formatDate(task.created_at, 'full')}</p></div>
              {task.completed_at && <div><p className="text-sm text-gray-500">Completed</p><p className="font-medium text-gray-900">{formatDate(task.completed_at, 'full')}</p></div>}
              {task.updated_at && task.updated_at !== task.created_at && <div><p className="text-sm text-gray-500">Last Updated</p><p className="font-medium text-gray-900">{formatDate(task.updated_at, 'full')}</p></div>}
            </div>
            {task.notes && <div className="mt-4 pt-4 border-t border-gray-200"><h3 className="text-sm font-medium text-gray-900 mb-2">Officer Notes</h3><p className="text-gray-700">{task.notes}</p></div>}
            {task.evidence && <div className="mt-4 pt-4 border-t border-gray-200"><h3 className="text-sm font-medium text-gray-900 mb-2">Evidence / completion record</h3><p className="whitespace-pre-wrap text-sm text-gray-700">{task.evidence}</p></div>}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Documents</h2>
            <p className="text-sm text-gray-500 mb-4">Documents from the case for reference</p>
            <div className="space-y-2">{task.case_id && <p className="text-sm text-gray-500">Case ID: {task.case_id}</p>}<p className="text-sm text-gray-500">Use the case detail view to see all documents</p></div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Info</h2>
            <div className="space-y-4">
              <div><p className="text-sm text-gray-500">Case Number</p><p className="font-medium text-gray-900">{task.case_number}</p></div>
              <div><p className="text-sm text-gray-500">Institution</p><p className="font-medium text-gray-900">{task.institution_name}</p></div>
              <div><p className="text-sm text-gray-500">Deposit Type</p><p className="font-medium text-gray-900 capitalize">{task.deposit_type?.replace(/_/g, ' ')}</p></div>
              <div><p className="text-sm text-gray-500">Deposit Method</p><p className="font-medium text-gray-900 capitalize">{task.deposit_method?.replace(/_/g, ' ')}</p></div>
              <div><p className="text-sm text-gray-500">Task Status</p><Badge variant={statusConfig.variant}>{statusConfig.label}</Badge></div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-3">
              {task.status === 'pending' && <Button variant="primary" className="w-full" onClick={openClaimModal}><CheckCircle className="h-4 w-4 mr-2" /> Claim Task</Button>}
              {(task.status === 'claimed' || task.status === 'in_progress') && <Button variant="primary" className="w-full" onClick={openCompleteModal}><CheckCircle className="h-4 w-4 mr-2" /> Complete Task</Button>}
              {task.status === 'claimed' && <Button variant="ghost" className="w-full" onClick={handleClaim}><XCircle className="h-4 w-4 mr-2" /> Unclaim (Re-release)</Button>}
              {task.status === 'cleared' && <Button variant="secondary" className="w-full" disabled><CheckCircle className="h-4 w-4 mr-2" /> Task Cleared</Button>}
              {task.status === 'rejected' && <Button variant="secondary" className="w-full" disabled><XCircle className="h-4 w-4 mr-2" /> Task Rejected</Button>}
            </div>
          </div>
        </div>
      </div>

      <Modal.Root open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <Modal.Content className="max-w-md">
          <Modal.Header><Modal.Title>{actionType === 'claim' ? 'Claim Task' : 'Complete Task'}</Modal.Title></Modal.Header>
          <Modal.Body className="space-y-4">
            {actionType === 'claim' ? <p className="text-gray-600">Are you sure you want to claim this task? You will become the assigned officer.</p> : (
                <Textarea label="Evidence / completion notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Record the evidence reviewed and completion decision..." rows={4} />
            )}
          </Modal.Body>
          <Modal.Footer><Button variant="secondary" onClick={() => { setActionModalOpen(false); setNotes(''); }} disabled={actionLoading}>Cancel</Button><Button variant="primary" onClick={actionType === 'claim' ? handleClaim : handleComplete} disabled={actionLoading || (actionType === 'complete' && !notes.trim())}>{actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (actionType === 'claim' ? 'Claim' : 'Complete')}</Button></Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </div>
  );
}
