import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { clearanceApi } from '../../api/clearance';
import { casesApi } from '../../api/cases';
import type { ClearanceTaskDetail } from '../../types/clearance';
import type { DepositEvidenceResponse } from '../../types/case';
import { formatDate } from '../../utils/helpers';
import { AlertCircle, Loader2, CheckCircle, XCircle, ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { DocumentCard } from '../../components/cases/DocumentCard';
import { DocumentViewer } from '../../components/cases/DocumentViewer';

const TASK_STATUS_CONFIG: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
  pending: { variant: 'default', label: 'Pending' },
  claimed: { variant: 'info', label: 'Claimed' },
  in_progress: { variant: 'warning', label: 'In Progress' },
  cleared: { variant: 'success', label: 'Cleared' },
  rejected: { variant: 'danger', label: 'Rejected' },
};

const CLEARANCE_TYPE_LABELS: Record<string, string> = {
  pgrc: 'PGRC (Public Grievance)',
  vigilance: 'Vigilance',
  financial: 'Financial',
  legal: 'Legal',
  technical: 'Technical Cell',
  environmental: 'Environmental',
};

export function ClearanceTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ClearanceTaskDetail | null>(null);
  const [documents, setDocuments] = useState<DepositEvidenceResponse[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DepositEvidenceResponse | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
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
        if (data.documents && data.documents.length > 0) {
          setDocuments(data.documents);
        } else if (data.case_id) {
          // Fallback fetch if documents were not embedded
          try {
            setDocsLoading(true);
            const docsRes = await casesApi.listDocuments(data.case_id);
            setDocuments(docsRes.items || []);
          } catch (e) {
            console.warn('Fallback document fetch error:', e);
          } finally {
            setDocsLoading(false);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load task details');
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [taskId]);

  const handleViewDocument = (doc: DepositEvidenceResponse) => {
    setViewerDoc(doc);
    setViewerOpen(true);
  };

  const handleDownloadDocument = async (doc: DepositEvidenceResponse) => {
    try {
      const blob = await casesApi.downloadDocument(doc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to download document');
    }
  };

  const handleClaim = async () => {
    if (!taskId) return;
    setActionLoading(true);
    try {
      await clearanceApi.claimTask(taskId);
      const data = await clearanceApi.getTaskDetail(taskId);
      setTask(data);
      if (data.documents) setDocuments(data.documents);
      setActionModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to claim task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!taskId || !task || !notes.trim()) return;
    setActionLoading(true);
    try {
      await clearanceApi.completeTask(task.id, { evidence: notes.trim(), notes: notes.trim() });
      const data = await clearanceApi.getTaskDetail(taskId);
      setTask(data);
      if (data.documents) setDocuments(data.documents);
      setActionModalOpen(false);
      setNotes('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setActionLoading(false);
    }
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
            <h1 className="page-title">Clearance Task Detail</h1>
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
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Case Documents</h2>
                <Badge variant={documents.length > 0 ? 'info' : 'default'}>
                  {documents.length} {documents.length === 1 ? 'Document' : 'Documents'}
                </Badge>
              </div>
              {task.case_id && (
                <Link
                  to={`/cases/${task.case_id}`}
                  className="inline-flex items-center text-xs font-medium text-primary-600 hover:text-primary-800"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>View Full Case Details</span>
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Review all uploaded deposit certificates, receipts, and statutory undertakings submitted for this case before recording clearance.
            </p>

            {docsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                <span className="ml-2 text-sm text-gray-500">Loading documents...</span>
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onView={handleViewDocument}
                    onDownload={handleDownloadDocument}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
                <FileText className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-600">No documents found for this case</p>
                <p className="text-xs text-gray-400 mt-1">Case ID: {task.case_id}</p>
              </div>
            )}
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
              {task.status === 'pending' && <Button variant="primary" className="w-full" onClick={openCompleteModal}><CheckCircle className="h-4 w-4 mr-2" /> Complete Clearance</Button>}
              {(task.status === 'claimed' || task.status === 'in_progress') && <Button variant="primary" className="w-full" onClick={openCompleteModal}><CheckCircle className="h-4 w-4 mr-2" /> Complete Task</Button>}
              {task.status === 'claimed' && <Button variant="ghost" className="w-full" onClick={handleClaim}><XCircle className="h-4 w-4 mr-2" /> Unclaim (Re-release)</Button>}
              {task.status === 'cleared' && <Button variant="secondary" className="w-full" disabled><CheckCircle className="h-4 w-4 mr-2" /> Task Cleared</Button>}
              {task.status === 'rejected' && <Button variant="secondary" className="w-full" disabled><XCircle className="h-4 w-4 mr-2" /> Task Rejected</Button>}
            </div>
          </div>
        </div>
      </div>

      <Modal.Root open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <Modal.Content className="max-w-lg">
          <Modal.Header><Modal.Title>{actionType === 'claim' ? 'Claim Task' : 'Complete Clearance'}</Modal.Title></Modal.Header>
          <Modal.Body className="space-y-4">
            {actionType === 'claim' ? (
              <p className="text-gray-600">Are you sure you want to claim this task? You will become the assigned officer.</p>
            ) : (
              <div className="space-y-4">
                {documents.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Quickly reference verified documents:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {documents.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            const refText = `Verified against ${doc.original_filename}`;
                            if (!notes.includes(refText)) {
                              setNotes((prev) => (prev ? `${prev}\n${refText}` : refText));
                            }
                          }}
                          className="inline-flex items-center text-xs bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-700 px-2 py-1 rounded transition-colors cursor-pointer"
                          title="Click to insert into notes"
                        >
                          <FileText className="h-3 w-3 mr-1 text-gray-500" />
                          <span className="truncate max-w-[180px]">{doc.original_filename}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Textarea
                  label="Evidence / completion notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record the documents and evidence reviewed, along with your clearance decision..."
                  rows={4}
                />
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setActionModalOpen(false); setNotes(''); }} disabled={actionLoading}>Cancel</Button>
            <Button variant="primary" onClick={actionType === 'claim' ? handleClaim : handleComplete} disabled={actionLoading || (actionType === 'complete' && !notes.trim())}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (actionType === 'claim' ? 'Claim' : 'Complete Clearance')}
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      <DocumentViewer
        document={viewerDoc}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        onDownload={handleDownloadDocument}
      />
    </div>
  );
}
