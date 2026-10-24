import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWizard } from '../../hooks/useWizard';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { Step1Form } from '../../components/wizard/Step1Form';
import { Step2Documents } from '../../components/wizard/Step2Documents';
import { Step3Confirm } from '../../components/wizard/Step3Confirm';
import { Step4Success } from '../../components/wizard/Step4Success';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';

interface WizardPageProps {
  isNew?: boolean;
}

export function WizardPage({ isNew = false }: WizardPageProps) {
  const { caseId } = useParams<{ caseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const {
    wizardState,
    caseId: wizardCaseId,
    isLoading,
    currentStep,
    formData,
    saveStep1,
    saveStep2,
    saveStep3,
    submitStep4,
    createCase,
    goToStep,
    canProceedToStep,
    clearStorage,
  } = useWizard();

  const isNewCase = isNew || searchParams.get('new') === 'true';

  const completedSteps = wizardState
    ? [
        wizardState.step1_completed && 1,
        wizardState.step2_completed && 2,
        wizardState.step3_completed && 3,
      ].filter(Boolean) as number[]
    : [];

  const handleStep1Submit = async (data: any) => {
    await saveStep1(data);
  };

  const handleStep2Submit = async (data: any) => {
    await saveStep2(data);
  };

  const handleStep3Submit = async (data: any) => {
    const result = await saveStep3(data);
    if (result?.success) await submitStep4();
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleNewCase = () => {
    clearStorage();
    navigate('/wizard/new');
  };

  const handleViewCase = () => {
    if (caseId) navigate(`/cases/${caseId}`);
  };

  const handleGoDashboard = () => {
    navigate('/dashboard');
  };

  const renderStep = () => {
    if (isLoading && !wizardState) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
        </div>
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <Step1Form
            initialData={formData.step1}
            onSubmit={handleStep1Submit}
            isLoading={isLoading}
          />
        );
      case 2:
        return (
          <Step2Documents
            caseId={wizardCaseId}
            depositType={formData.step1?.deposit_type || ''}
            depositMethod={formData.step1?.deposit_method}
            initialDocuments={formData.step2?.documents}
            onSubmit={handleStep2Submit}
            isLoading={isLoading}
          />
        );
      case 3:
        return (
          <Step3Confirm
            completenessCheck={wizardState ? {
              passed: wizardState.can_submit,
              missing_mandatory: wizardState.missing_mandatory,
              missing_conditional: wizardState.missing_conditional,
              warnings: [],
            } : undefined}
            initialData={formData.step3}
            onSubmit={handleStep3Submit}
            isLoading={isLoading}
          />
        );
      case 4:
        return (
          <Step4Success
            response={wizardState ? {
              success: wizardState.current_step === 'completed',
              case_id: wizardState.case_id,
              tracking_ref: wizardState.tracking_ref ?? '',
              status: 'submitted',
            } : undefined}
            onNewCase={handleNewCase}
            onViewCase={handleViewCase}
            onGoDashboard={handleGoDashboard}
          />
        );
      default:
        return null;
    }
  };

  if (isNewCase) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Create New Deposit Case</h1>
          <p className="text-gray-600 mt-1">Start a deposit case for your authorized institution.</p>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Demo Engineering College</h3>
          <p className="text-gray-600 mb-4">Synthetic demo institution · inst_1</p>
          <Button
            className="w-full"
            disabled={isLoading}
            onClick={() => createCase(user?.institution_id ?? 'inst_1')}
          >
            Create deposit case
          </Button>
        </Card>
      </div>
    );
  }

  if (!caseId && !wizardState) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading wizard...</p>
      </div>
    );
  }

  return (
    <WizardLayout
      currentStep={currentStep}
      completedSteps={completedSteps}
      onStepClick={goToStep}
      canProceed={canProceedToStep}
      title="Deposit Case Wizard"
      description={`Step ${currentStep} of 4`}
    >
      {renderStep()}
    </WizardLayout>
  );
}
