import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import { CaseHeader } from '../../components/cases/CaseHeader';
import { DocumentCard } from '../../components/cases/DocumentCard';
import { Timeline } from '../../components/cases/Timeline';
import { ClarificationThread } from '../../components/cases/ClarificationThread';
import { DocumentViewer } from '../../components/cases/DocumentViewer';
import { scrutinyApi } from '../../api/scrutiny';
import { casesApi } from '../../api/cases';
import type { ScrutinyCaseDetail } from '../../types/scrutiny';
import type { DepositEvidenceResponse, CaseStatus } from '../../types/case';
import { formatDate } from '../../utils/helpers';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { CaseStatusBadge } from '../../components/cases/CaseStatusBadge';
import { StatusTransitionModal } from '../../components/scrutiny/StatusTransitionModal';
import { ClarificationRequestModal } from '../../components/scrutiny/ClarificationRequestModal';

export function ScrutinyCaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<ScrutinyCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'timeline' | 'clarifications'>('overview');
  const [viewerDoc, setViewerDoc] = useState<DepositEvidenceResponse | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [clarificationModalOpen, setClarificationModalOpen] = useState(false);

  const currentUserRole = 'scrutiny_officer';

  useEffect(() => {
    if (!caseId) return;
    const fetchCase = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await scrutinyApi.getCaseDetail(caseId);
        setCaseData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load case details');
      } finally {
        setLoading(false);
      }
    };
    fetchCase();
  }, [caseId]);

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

  const handleTransition = async (newStatus: string, reason?: string, details?: Record<string, unknown>) => {
    try {
      await scrutinyApi.transitionStatus(caseId!, { new_status: newStatus as CaseStatus, reason, details });
      const data = await scrutinyApi.getCaseDetail(caseId!);
      setCaseData(data);
      setTransitionModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to transition status');
    }
  };

  const handleRequestClarification = async (items: Array<{ document_type: string; reason: string; details?: string }>) => {
    try {
      await scrutinyApi.requestClarification(caseId!, items);
      const data = await scrutinyApi.getCaseDetail(caseId!);
      setCaseData(data);
      setClarificationModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to request clarification');
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
        <Button variant="primary" onClick={() => navigate('/scrutiny')} className="mt-4">
          Back to Queue
        </Button>
      </div>
    );
  }

  const canViewClarifications = caseData.clarifications && caseData.clarifications.length > 0;

  return (
    <div className="space-y-6">
      <CaseHeader caseData={caseData} currentUserRole={currentUserRole} />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CaseStatusBadge status={caseData.status} />
          {caseData.assigned_officer_id && (
            <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">Assigned to You</span>
          )}
        </div>
      </div>

      <Tabs.Root defaultValue={activeTab} value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <Tabs.List className="bg-white border border-gray-200 rounded-lg p-1 w-fit">
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="documents">Documents ({caseData.documents?.length || 0})</Tabs.Trigger>
          <Tabs.Trigger value="timeline">Timeline ({caseData.events?.length || 0})</Tabs.Trigger>
          {canViewClarifications && (
            <Tabs.Trigger value="clarifications">Clarifications ({caseData.clarifications?.length || 0})</Tabs.Trigger>
          )}
        </Tabs.List>

        <Tabs.Content value="overview">
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div><p className="text-sm text-gray-500">Case Number</p><p className="font-medium text-gray-900">{caseData.case_number}</p></div>
              <div><p className="text-sm text-gray-500">Tracking Reference</p><p className="font-medium text-gray-900">{caseData.tracking_ref || '—'}</p></div>
              <div><p className="text-sm text-gray-500">Status</p><p className="font-medium text-gray-900">{caseData.status}</p></div>
              <div><p className="text-sm text-gray-500">Deposit Type</p><p className="font-medium text-gray-900">{caseData.deposit_type}</p></div>
              <div className="md:col-span-2"><p className="text-sm text-gray-500">Amount</p><p className="font-medium text-gray-900">{caseData.amount.toLocaleString()} {caseData.currency}</p></div>
              <div className="md:col-span-2"><p className="text-sm text-gray-500">Instrument Number</p><p className="font-medium text-gray-900">{caseData.instrument_number}</p></div>
              <div className="md:col-span-2"><p className="text-sm text-gray-500">Issuing Bank</p><p className="font-medium text-gray-900">{caseData.issuing_bank}</p></div>
              <div><p className="text-sm text-gray-500">Created</p><p className="font-medium text-gray-900">{formatDate(caseData.created_at, 'full')}</p></div>
              <div><p className="text-sm text-gray-500">Updated</p><p className="font-medium text-gray-900">{formatDate(caseData.updated_at, 'full')}</p></div>
              {caseData.submitted_at && <div><p className="text-sm text-gray-500">Submitted</p><p className="font-medium text-gray-900">{formatDate(caseData.submitted_at, 'full')}</p></div>}
            </div>
            {caseData.institution && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Institution Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><p className="text-sm text-gray-500">Name</p><p className="font-medium text-gray-900">{caseData.institution.name}</p></div>
                  <div><p className="text-sm text-gray-500">Code</p><p className="font-medium text-gray-900">{caseData.institution.code}</p></div>
                  <div><p className="text-sm text-gray-500">Type</p></div>
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" onClick={() => setTransitionModalOpen(true)}>Transition Status</Button>
                <Button variant="secondary" onClick={() => setClarificationModalOpen(true)}>Request Clarification</Button>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="documents">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            {caseData.documents?.length ? (
              <div className="space-y-4">{caseData.documents.map(doc => <DocumentCard key={doc.id} document={doc} onView={handleViewDocument} onDownload={handleDownloadDocument} />)}</div>
            ) : <div className="text-center py-12 text-gray-500"><p>No documents uploaded for this case</p></div>}
          </div>
        </Tabs.Content>

        <Tabs.Content value="timeline">
          <div className="bg-white border border-gray-200 rounded-xl p-6"><Timeline events={caseData.events || []} /></div>
        </Tabs.Content>

        {canViewClarifications && (
          <Tabs.Content value="clarifications">
            <div className="bg-white border border-gray-200 rounded-xl p-6"><ClarificationThread clarifications={caseData.clarifications || []} currentUserRole={currentUserRole} caseId={caseId!} /></div>
          </Tabs.Content>
        )}
      </Tabs.Root>

      <DocumentViewer document={viewerDoc} isOpen={viewerOpen} onClose={() => setViewerOpen(false)} onDownload={handleDownloadDocument} />
      <StatusTransitionModal isOpen={transitionModalOpen} onClose={() => setTransitionModalOpen(false)} onTransition={handleTransition} currentStatus={caseData.status} />
      <ClarificationRequestModal isOpen={clarificationModalOpen} onClose={() => setClarificationModalOpen(false)} onSubmit={handleRequestClarification} />
    </div>
  );
}
