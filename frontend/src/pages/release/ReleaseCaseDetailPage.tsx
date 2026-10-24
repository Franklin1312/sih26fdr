import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { releaseApi } from '../../api/release';
import { casesApi } from '../../api/cases';
import type { ReleaseCaseDetail, ReleaseChecklistItem } from '../../types/release';
import type { DepositCaseDetail, DepositEvidenceResponse } from '../../types/case';
import { formatDate } from '../../utils/helpers';
import { AlertCircle, Loader2, CheckCircle, XCircle, Send, ArrowLeft, ClipboardCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { DocumentViewer } from '../../components/cases/DocumentViewer';
import { CaseStatusBadge } from '../../components/cases/CaseStatusBadge';
import { Timeline } from '../../components/cases/Timeline';
import { DocumentCard } from '../../components/cases/DocumentCard';

export function ReleaseCaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<ReleaseCaseDetail | null>(null);
  const [depositCase, setDepositCase] = useState<DepositCaseDetail | null>(null);
  const [checklist, setChecklist] = useState<ReleaseChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [rationale, setRationale] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DepositEvidenceResponse | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'timeline' | 'checklist'>('overview');

  useEffect(() => {
    if (!caseId) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [caseRes, checklistRes, depositCaseRes] = await Promise.all([
          releaseApi.getCaseDetail(caseId),
          releaseApi.getChecklist(caseId),
          casesApi.getById(caseId),
        ]);
        setCaseData(caseRes);
        setChecklist(checklistRes.items || []);
        setDepositCase(depositCaseRes);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load case details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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

  const handleDecision = async () => {
    if (!caseId) return;
    setDecisionLoading(true);
    try {
      await releaseApi.makeDecision(caseId, {
        final_decision: decision === 'approve' ? 'release' : 'reject',
        decision_reasoning: rationale,
      });
      const data = await releaseApi.getCaseDetail(caseId);
      setCaseData(data);
      setDecisionModalOpen(false);
      setRationale('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to make decision');
    } finally {
      setDecisionLoading(false);
    }
  };

  const openDecisionModal = (dec: 'approve' | 'reject') => {
    setDecision(dec);
    setDecisionModalOpen(true);
  };

  const allMandatorySatisfied = checklist
    .filter(item => item.mandatory)
    .every(item => item.completed);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;
  }

  if (error || !caseData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Unable to load case</h2>
        <p className="text-gray-500 mt-2">{error || 'Case not found'}</p>
        <Button variant="primary" onClick={() => navigate('/release')} className="mt-4">Back to Queue</Button>
      </div>
    );
  }

  const canDecide = caseData.status === 'pending';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/release')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Queue
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Send className="h-6 w-6" /> Release Review
            </h1>
            <p className="text-gray-500">{caseData.case_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CaseStatusBadge status={caseData.case_status} />
        </div>
      </div>

      {canDecide && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-900">Action Required</p>
              <p className="text-sm text-blue-700">
                This case is pending release decision. {allMandatorySatisfied ? 'All mandatory checklist items are satisfied.' : 'Some mandatory checklist items are not satisfied.'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="primary" onClick={() => openDecisionModal('approve')} disabled={decisionLoading}><CheckCircle className="h-4 w-4 mr-2" /> Approve Release</Button>
              <Button variant="destructive" onClick={() => openDecisionModal('reject')} disabled={decisionLoading}><XCircle className="h-4 w-4 mr-2" /> Reject</Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]"><p className="text-sm text-gray-500">Institution</p><p className="font-medium text-gray-900">{caseData.institution_name || '—'}</p></div>
          <div className="flex-1 min-w-[200px]"><p className="text-sm text-gray-500">Amount</p><p className="font-medium text-gray-900">{caseData.amount?.toLocaleString() || '0'} {depositCase?.currency || 'INR'}</p></div>
          <div className="flex-1 min-w-[200px]"><p className="text-sm text-gray-500">Deposit Type</p><p className="font-medium text-gray-900 capitalize">{caseData.deposit_type?.replace(/_/g, ' ')}</p></div>
          <div className="flex-1 min-w-[200px]"><p className="text-sm text-gray-500">Deposit Method</p><p className="font-medium text-gray-900 capitalize">{caseData.deposit_method?.replace(/_/g, ' ')}</p></div>
          <div className="flex-1 min-w-[200px]"><p className="text-sm text-gray-500">Maturity Date</p><p className="font-medium text-gray-900">{depositCase?.maturity_date ? formatDate(depositCase?.maturity_date, 'short') : '—'}</p></div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="border-b border-gray-200">
          <nav className="flex gap-4 px-4" aria-label="Tabs">
            <button onClick={() => setActiveTab('overview')} className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Overview</button>
            <button onClick={() => setActiveTab('documents')} className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'documents' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Documents ({depositCase?.documents?.length || 0})</button>
            <button onClick={() => setActiveTab('timeline')} className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'timeline' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Timeline ({depositCase?.events?.length || 0})</button>
            <button onClick={() => setActiveTab('checklist')} className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'checklist' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><ClipboardCheck className="h-4 w-4" /> Checklist</button>
          </nav>
        </div>
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div><p className="text-sm text-gray-500">Case Number</p><p className="font-medium text-gray-900">{caseData.case_number}</p></div>
                <div><p className="text-sm text-gray-500">Tracking Reference</p><p className="font-medium text-gray-900">{depositCase?.tracking_ref || '—'}</p></div>
                <div><p className="text-sm text-gray-500">Created</p><p className="font-medium text-gray-900">{formatDate(caseData.created_at, 'full')}</p></div>
                <div><p className="text-sm text-gray-500">Submitted</p><p className="font-medium text-gray-900">{depositCase?.submitted_at ? formatDate(depositCase?.submitted_at, 'full') : '—'}</p></div>
              </div>
              {caseData.institution_name && <div className="pt-4 border-t border-gray-200"><h3 className="font-semibold text-gray-900 mb-3">Institution Details</h3><p className="text-gray-900">{caseData.institution_name}</p></div>}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              {depositCase?.documents?.length ? depositCase?.documents.map(doc => <DocumentCard key={doc.id} document={doc} onView={handleViewDocument} onDownload={handleDownloadDocument} />) : <div className="text-center py-12 text-gray-500"><p>No documents uploaded for this case</p></div>}
            </div>
          )}

          {activeTab === 'timeline' && <Timeline events={depositCase?.events || []} />}

          {activeTab === 'checklist' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Release Checklist</h3>
                <div className="flex items-center gap-2 text-sm"><span className={`px-2 py-1 rounded-full ${allMandatorySatisfied ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{allMandatorySatisfied ? 'All Mandatory Satisfied' : 'Mandatory Items Pending'}</span></div>
              </div>
              {checklist.length === 0 ? <div className="text-center py-12 text-gray-500"><ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p>No checklist items found for this release type</p></div> : (
                <div className="space-y-3">{checklist.map((item, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{item.label}</span>
                          {item.mandatory && <Badge variant="danger" className="text-xs">Mandatory</Badge>}
                          {!item.mandatory && <Badge variant="default" className="text-xs">Optional</Badge>}
                        </div>
                        <p className="text-sm text-gray-600">{item.condition}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center ${item.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>{item.completed ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}</span>
                        <span className={`text-sm font-medium ${item.completed ? 'text-green-600' : 'text-gray-500'}`}>{item.completed ? 'Satisfied' : 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                ))}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <DocumentViewer document={viewerDoc} isOpen={viewerOpen} onClose={() => setViewerOpen(false)} onDownload={handleDownloadDocument} />

      <Modal.Root open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
        <Modal.Content className="max-w-md">
          <Modal.Header><Modal.Title>{decision === 'approve' ? 'Approve Release' : 'Reject Release'}</Modal.Title></Modal.Header>
          <Modal.Body className="space-y-4">
            <p className="text-gray-600">{decision === 'approve' ? 'Are you sure you want to approve this release? The funds will be released to the institution.' : 'Are you sure you want to reject this release request? The case will remain in the queue.'}</p>
            <Textarea label="Rationale (required)" value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Provide rationale for your decision..." rows={4} required />
          </Modal.Body>
          <Modal.Footer><Button variant="secondary" onClick={() => { setDecisionModalOpen(false); setRationale(''); }} disabled={decisionLoading}>Cancel</Button><Button variant={decision === 'approve' ? 'primary' : 'destructive'} onClick={handleDecision} disabled={decisionLoading || !rationale.trim()}>{decisionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (decision === 'approve' ? 'Approve' : 'Reject')}</Button></Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </div>
  );
}
