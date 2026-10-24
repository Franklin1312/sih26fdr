import type { ReactNode } from 'react';
import { WizardStepper } from './WizardStepper';
import { cn } from '../../utils/helpers';

interface WizardLayoutProps {
  children: ReactNode;
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
  canProceed?: (step: number) => boolean;
  title?: string;
  description?: string;
  className?: string;
}

export function WizardLayout({
  children,
  currentStep,
  completedSteps,
  onStepClick,
  canProceed,
  title = 'Deposit Case Wizard',
  description,
  className,
}: WizardLayoutProps) {
  return (
    <div className={cn('wizard-layout', className)}>
      <div className="mb-6">
        <h1 className="page-title">{title}</h1>
        {description && (
          <p className="page-subtitle">{description}</p>
        )}
      </div>
      
      <WizardStepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={onStepClick}
        canProceed={canProceed}
        className="mb-6"
      />
      
      <div className="wizard-content">
        {children}
      </div>
    </div>
  );
}