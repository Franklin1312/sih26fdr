import { CheckCircle, FileText, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { WizardStep4Response } from '../../types/wizard';
import type { CaseStatus } from '../../types/case';

interface Step4SuccessProps {
  response?: WizardStep4Response;
  onNewCase: () => void;
  onViewCase: () => void;
  onGoDashboard: () => void;
}

const statusColors: Record<CaseStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  under_scrutiny: 'bg-yellow-100 text-yellow-800',
  clarification_pending: 'bg-orange-100 text-orange-800',
  clearance_queue: 'bg-purple-100 text-purple-800',
  cleared: 'bg-green-100 text-green-800',
  release_requested: 'bg-indigo-100 text-indigo-800',
  fdr_rpgf_review: 'bg-blue-100 text-blue-800',
  rtgs_review: 'bg-blue-100 text-blue-800',
  sd_refund_review: 'bg-blue-100 text-blue-800',
  final_decision: 'bg-indigo-100 text-indigo-800',
  released: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-800',
};

export function Step4Success({ response, onNewCase, onViewCase, onGoDashboard }: Step4SuccessProps) {
  if (!response?.success) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Submission Failed</h3>
        <p className="text-gray-600 mb-4">
          {response?.errors?.join(', ') || 'An error occurred while submitting the case.'}
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={onGoDashboard}>Go to Dashboard</Button>
          <Button onClick={onNewCase}>Try Again</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 text-center bg-green-50 border-green-200">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Case Submitted Successfully!</h3>
        <p className="text-gray-600">
          Your deposit case has been submitted for processing.
        </p>
      </Card>

      <Card className="p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Case Details</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Case ID</p>
            <p className="font-mono text-lg font-medium text-gray-900">{response.case_id || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tracking Reference</p>
            <p className="font-mono text-lg font-medium text-gray-900">{response.tracking_ref || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <Badge className={statusColors[response.status as CaseStatus] || 'bg-gray-100 text-gray-800'} style={{ display: 'inline-block' }}>
              {response.status || 'submitted'}
            </Badge>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h4 className="font-semibold text-gray-900 mb-4">What happens next?</h4>
        <ol className="space-y-3">
          {[
            'Your case will be assigned to a scrutiny officer for initial review',
            'The officer will verify all documents and deposit details',
            'If any clarifications are needed, you will be notified',
            'Once cleared, the case moves to clearance and release stages',
            'You can track progress using the tracking reference above',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                {i + 1}
              </div>
              <span className="text-gray-600">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button onClick={onViewCase} className="flex-1 sm:flex-none">
          <FileText className="h-4 w-4 mr-2" />
          View Case Details
        </Button>
        <Button onClick={onNewCase} variant="secondary" className="flex-1 sm:flex-none">
          <RefreshCw className="h-4 w-4 mr-2" />
          Create Another Case
        </Button>
        <Button onClick={onGoDashboard} variant="outline" className="flex-1 sm:flex-none">
          <ArrowRight className="h-4 w-4 mr-2" />
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
