import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import { CaseHeader } from '../../components/cases/CaseHeader';
import { DocumentCard } from '../../components/cases/DocumentCard';
import { Timeline } from '../../components/cases/Timeline';
import { ClarificationThread } from '../../components/cases/ClarificationThread';
import { ClearanceTasks } from '../../components/cases/ClearanceTasks';
import { DocumentViewer } from '../../components/cases/DocumentViewer';
import { casesApi } from '../../api/cases';
import { releaseApi } from '../../api/release';
import { useAuth } from '../../auth/useAuth';
import { toast } from 'sonner';
import type { DepositCaseDetail, DepositEvidenceResponse } from '../../types/case';
import type { ReleaseChecklistResponse } from '../../types/release';
import { formatDate } from '../../utils/helpers';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<DepositCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'timeline' | 'clarifications' | 'clearances'>('overview');
  const [viewerDoc, setViewerDoc] = useState<DepositEvidenceResponse | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [releaseChecklist, setReleaseChecklist] = useState<ReleaseChecklistResponse | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const { user } = useAuth();
  const currentUserRole = user?.role ?? 'institution_rep';
  const currentUserId = user?.user_id ?? '';

  useEffect(() => {
    if (!id) return;
    const fetchCase = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await casesApi.getById(id);
        setCaseData(data);
        if (data.status.startsWith('fdr_rpgf_review') || data.status.startsWith('rtgs_review') || data.status.startsWith('sd_refund_review') || data.status === 'release_requested') {
          try { setReleaseChecklist(await releaseApi.getChecklist(id)); } catch { setReleaseChecklist(null); }
        } else {
          setReleaseChecklist(null);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load case details');
      } finally {
        setLoading(false);
      }
    };
    fetchCase();
  }, [id]);

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
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleEdit = () => {
    navigate(`/wizard/${id}/step1`);
  };

  const handleRequestRelease = async () => {
    if (!caseData) return;
    try {
      const response = await releaseApi.requestRelease({
        case_id: caseData.id,
        request_type: caseData.deposit_method === 'security_deposit_refund' ? 'refund' : 'maturity',
      });
      setReleaseChecklist(response.checklist);
      toast.success('Release request submitted to its configured authority route.');
      const refreshed = await casesApi.getById(caseData.id);
      setCaseData(refreshed);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not submit the release request');
    }
  };

  const handleChecklistUpload = async (documentType: string, file?: File) => {
    if (!file || !caseData) return;
    setUploadingType(documentType);
    try {
      await casesApi.uploadDocument(caseData.id, file, documentType);
      const [refreshed, checklist] = await Promise.all([
        casesApi.getById(caseData.id),
        releaseApi.getChecklist(caseData.id),
      ]);
      setCaseData(refreshed);
      setReleaseChecklist(checklist);
      toast.success('Document uploaded');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not upload document');
    } finally {
      setUploadingType(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Unable to load case</h2>
        <p className="text-gray-500 mt-2">{error || 'Case not found'}</p>
        <Button variant="primary" onClick={() => navigate('/my-cases')} className="mt-4">
          Back to Cases
        </Button>
      </div>
    );
  }

  const canViewClarifications = caseData.clarifications && caseData.clarifications.length > 0;
  const canViewClearances = caseData.clearances && caseData.clearances.length > 0;

  return (
    <div className="space-y-6">
      <CaseHeader caseData={caseData} onEdit={handleEdit} onRequestRelease={handleRequestRelease} currentUserRole={currentUserRole} />
      <Tabs.Root defaultValue={activeTab} value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <Tabs.List className="bg-white border border-gray-200 rounded-lg p-1 w-fit">
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="documents">Documents ({caseData.documents?.length || 0})</Tabs.Trigger>
          <Tabs.Trigger value="timeline">Timeline ({caseData.events?.length || 0})</Tabs.Trigger>
          {canViewClarifications && (
            <Tabs.Trigger value="clarifications">Clarifications ({caseData.clarifications?.length || 0})</Tabs.Trigger>
          )}
          {canViewClearances && (
            <Tabs.Trigger value="clearances">Clearances ({caseData.clearances?.length || 0})</Tabs.Trigger>
          )}
        </Tabs.List>

        <Tabs.Content value="overview">
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-500">Deposit Type</p>
                <p className="font-medium text-gray-900 capitalize">{caseData.deposit_type?.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Deposit Method</p>
                <p className="font-medium text-gray-900 capitalize">{caseData.deposit_method?.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className="font-medium text-xl text-primary-600">{caseData.amount?.toLocaleString() || '0'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium text-gray-900">{formatDate(caseData.created_at, 'full')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Updated</p>
                <p className="font-medium text-gray-900">{formatDate(caseData.updated_at, 'full')}</p>
              </div>
              {caseData.submitted_at && (
                <div>
                  <p className="text-sm text-gray-500">Submitted</p>
                  <p className="font-medium text-gray-900">{formatDate(caseData.submitted_at, 'full')}</p>
                </div>
              )}
            </div>

            {caseData.institution && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Institution Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium text-gray-900">{caseData.institution.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Code</p>
                    <p className="font-medium text-gray-900">{caseData.institution.code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Type</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="documents">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            {releaseChecklist && !releaseChecklist.passed && (
              <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="font-semibold text-gray-900">Release documents needed</h3>
                <div className="mt-3 space-y-3">
                  {releaseChecklist.items.filter((item) => item.mandatory && !item.completed && item.document_type).map((item) => (
                    <label key={item.key} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span>{item.label}</span>
                      <input type="file" accept="application/pdf,image/*" disabled={uploadingType === item.document_type}
                        onChange={(event) => handleChecklistUpload(item.document_type!, event.target.files?.[0])} />
                    </label>
                  ))}
                </div>
              </section>
            )}
            {caseData.documents?.length ? (
              <div className="space-y-4">
                {caseData.documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onView={handleViewDocument}
                    onDownload={handleDownloadDocument}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No documents uploaded for this case</p>
              </div>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="timeline">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <Timeline events={caseData.events || []} />
          </div>
        </Tabs.Content>

        {canViewClarifications && (
          <Tabs.Content value="clarifications">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <ClarificationThread
                clarifications={caseData.clarifications || []}
                currentUserRole={currentUserRole as any}
                caseId={id!}
              />
            </div>
          </Tabs.Content>
        )}

        {canViewClearances && (
          <Tabs.Content value="clearances">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <ClearanceTasks
                tasks={caseData.clearances || []}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
              />
            </div>
          </Tabs.Content>
        )}
      </Tabs.Root>

      <DocumentViewer
        document={viewerDoc}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        onDownload={handleDownloadDocument}
      />
    </div>
  );
}
