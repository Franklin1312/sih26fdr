import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import {
  CaseHeader,
  DocumentCard,
  Timeline,
  ClarificationThread,
  ClearanceTasks,
  DocumentViewer,
  BankVerificationCard,
  LifecycleTrackingCard,
  RenewFDRModal,
  RenewalLineageCard,
  AuditTimeline,
} from '../../components/cases';
import { casesApi } from '../../api/cases';
import { releaseApi } from '../../api/release';
import { clarificationApi } from '../../api/clarification';
import { useAuth } from '../../auth/useAuth';
import { toast } from 'sonner';
import type { DepositCaseDetail, DepositEvidenceResponse } from '../../types/case';
import type { ReleaseChecklistResponse } from '../../types/release';
import { formatDate, formatCurrency } from '../../utils/helpers';
import {
  AlertCircle,
  Loader2,
  Building2,
  Calendar,
  ShieldCheck,
  FileText,
  GitBranch,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<DepositCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'verification' | 'lifecycle' | 'documents' | 'timeline' | 'clarifications' | 'clearances'
  >('overview');
  const [viewerDoc, setViewerDoc] = useState<DepositEvidenceResponse | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
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
        if (
          data.status.startsWith('fdr_rpgf_review') ||
          data.status.startsWith('rtgs_review') ||
          data.status.startsWith('sd_refund_review') ||
          data.status === 'release_requested'
        ) {
          try {
            setReleaseChecklist(await releaseApi.getChecklist(id));
          } catch {
            setReleaseChecklist(null);
          }
        } else {
          setReleaseChecklist(null);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load case details');
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

  const handleRespondClarification = async (clarificationId: string, response: string) => {
    try {
      await clarificationApi.respond(clarificationId, response);
      toast.success('Clarification response submitted to scrutiny officer.');
      if (caseData) {
        const refreshed = await casesApi.getById(caseData.id);
        setCaseData(refreshed);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit clarification response');
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

  // Regulatory context booleans
  const regContext = caseData.regulatory_context || {};
  const activeRegKeys = Object.entries(regContext).filter(([, val]) => val === true);

  return (
    <div className="space-y-6">
      <CaseHeader
        caseData={caseData}
        onEdit={handleEdit}
        onRenew={() => setRenewModalOpen(true)}
        onRequestRelease={handleRequestRelease}
        currentUserRole={currentUserRole}
      />

      <Tabs.Root
        defaultValue={activeTab}
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <Tabs.List className="bg-white border border-gray-200 rounded-lg p-1 w-fit flex flex-wrap gap-1">
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="lineage" className="gap-1.5 flex items-center">
            <GitBranch className="h-4 w-4 text-indigo-600" />
            Renewal Lineage
          </Tabs.Trigger>
          <Tabs.Trigger value="verification" className="gap-1.5 flex items-center">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Bank Verification
          </Tabs.Trigger>
          <Tabs.Trigger value="lifecycle" className="gap-1.5 flex items-center">
            <Calendar className="h-4 w-4 text-blue-600" />
            Lifecycle & Alerts
          </Tabs.Trigger>
          <Tabs.Trigger value="documents">Documents ({caseData.documents?.length || 0})</Tabs.Trigger>
          <Tabs.Trigger value="timeline">Timeline ({caseData.events?.length || 0})</Tabs.Trigger>
          {canViewClarifications && (
            <Tabs.Trigger value="clarifications">Clarifications ({caseData.clarifications?.length || 0})</Tabs.Trigger>
          )}
          {canViewClearances && (
            <Tabs.Trigger value="clearances">Clearances ({caseData.clearances?.length || 0})</Tabs.Trigger>
          )}
        </Tabs.List>

        {/* 1. OVERVIEW TAB */}
        <Tabs.Content value="overview" className="space-y-6 mt-4">
          {/* Financial Instrument Details */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary-50 text-primary-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-base">FDR & Financial Instrument Specifics</h3>
                  <p className="text-xs text-gray-500">Record maintained for AICTE Regulation Bureau compliance</p>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                Ref: {caseData.tracking_ref || caseData.case_number}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Instrument Number</p>
                <p className="font-semibold font-mono text-base text-gray-900 mt-1">{caseData.instrument_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Issuing Bank</p>
                <p className="font-semibold text-base text-gray-900 mt-1">{caseData.issuing_bank || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Principal Amount</p>
                <p className="font-semibold text-xl text-primary-600 mt-1">{formatCurrency(caseData.amount)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Maturity Date</p>
                <p className="font-semibold text-base text-gray-900 mt-1">
                  {caseData.maturity_date ? formatDate(caseData.maturity_date, 'medium') : 'N/A (Perpetual / RTGS)'}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Deposit Type</p>
                <p className="font-medium text-gray-900 capitalize mt-1">{caseData.deposit_type?.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Deposit Method</p>
                <p className="font-medium text-gray-900 capitalize mt-1">{caseData.deposit_method?.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">AICTE Clause Ref</p>
                <p className="font-medium text-gray-900 mt-1">{caseData.aicte_clause_ref || 'Clause 6.46 (Standard Approval)'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">AICTE Term End</p>
                <p className="font-medium text-gray-900 mt-1">
                  {caseData.term_end_date ? formatDate(caseData.term_end_date, 'medium') : '5-Year Cycle'}
                </p>
              </div>
            </div>

            {/* AICTE Regulatory Context / Clause 6.46 Facts */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Clause 6.46 Circumstances & Regulatory Gates
              </p>
              {activeRegKeys.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeRegKeys.map(([k]) => (
                    <Badge key={k} variant="secondary" className="bg-amber-50 text-amber-800 border-amber-200 text-xs">
                      {k.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Standard regulatory path — No exceptional Clause 6.46 circumstances (progressive closure, embezzlement, etc.) flagged.
                </p>
              )}
            </div>
          </div>

          {/* Instrument Renewal & Replacement Lineage */}
          <RenewalLineageCard
            caseData={caseData}
            onOpenRenewModal={() => setRenewModalOpen(true)}
            currentUserRole={currentUserRole}
          />

          {/* Quick Bank Verification Summary Card */}
          <BankVerificationCard caseData={caseData} currentUserRole={currentUserRole} />

          {/* Quick Lifecycle Milestones Card */}
          <LifecycleTrackingCard caseData={caseData} />

          {/* Institution Particulars */}
          {caseData.institution && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-base">Institution Particulars</h3>
                  <p className="text-xs text-gray-500">Official AICTE institution profile and registry details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Institution Name</p>
                  <p className="font-semibold text-gray-900 mt-1">{caseData.institution.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">AICTE Institution Code</p>
                  <p className="font-semibold font-mono text-gray-900 mt-1">{caseData.institution.code}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Institution Type</p>
                  <p className="font-medium text-gray-900 capitalize mt-1">
                    {caseData.institution.institution_type?.replace(/_/g, ' ') || 'Technical / Engineering'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Email</p>
                  <p className="font-medium text-gray-900 mt-1">{caseData.institution.contact_email || '—'}</p>
                </div>
                {caseData.institution.address && (
                  <div className="md:col-span-2 lg:col-span-4 pt-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Registered Campus Address</p>
                    <p className="text-gray-700 mt-0.5">{caseData.institution.address}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Tabs.Content>

        {/* 2. DEDICATED LINEAGE & RENEWAL TAB */}
        <Tabs.Content value="lineage" className="space-y-6 mt-4">
          <RenewalLineageCard
            caseData={caseData}
            onOpenRenewModal={() => setRenewModalOpen(true)}
            currentUserRole={currentUserRole}
          />
        </Tabs.Content>

        {/* 3. DEDICATED BANK VERIFICATION TAB */}
        <Tabs.Content value="verification" className="space-y-6 mt-4">
          <BankVerificationCard caseData={caseData} currentUserRole={currentUserRole} />
        </Tabs.Content>

        {/* 4. DEDICATED LIFECYCLE & ALERTS TAB */}
        <Tabs.Content value="lifecycle" className="space-y-6 mt-4">
          <LifecycleTrackingCard caseData={caseData} />
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

        <Tabs.Content value="timeline" className="space-y-6 mt-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900 text-base">Lifecycle Event Timeline</h3>
                <p className="text-xs text-gray-500">Business transitions, reviews, and case milestones</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {caseData.events?.length || 0} Milestone Events
              </Badge>
            </div>
            <Timeline events={caseData.events || []} />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900 text-base">Cryptographic Audit Trail (SHA-256)</h3>
                <p className="text-xs text-gray-500">Tamper-evident sequential hash chain verifying compliance</p>
              </div>
              <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                Immutable Ledger
              </Badge>
            </div>
            <AuditTimeline caseId={caseData.id} />
          </div>
        </Tabs.Content>

        {canViewClarifications && (
          <Tabs.Content value="clarifications">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <ClarificationThread
                clarifications={caseData.clarifications || []}
                onRespond={handleRespondClarification}
                currentUserRole={currentUserRole as import('../../types/auth').UserRole}
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

      <RenewFDRModal
        caseData={caseData}
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        onSuccess={async () => {
          setRenewModalOpen(false);
          const refreshed = await casesApi.getById(id!);
          setCaseData(refreshed);
        }}
      />
    </div>
  );
}
