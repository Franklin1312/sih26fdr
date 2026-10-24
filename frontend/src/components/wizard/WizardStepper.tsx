import { forwardRef } from 'react';
import { cn } from '../../utils/helpers';

interface WizardStepperProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
  canProceed?: (step: number) => boolean;
  className?: string;
}

const stepLabels = ['Deposit Details', 'Documents', 'Review & Confirm', 'Submit'];

export const WizardStepper = forwardRef<HTMLDivElement, WizardStepperProps>(
  ({ currentStep, completedSteps, onStepClick, canProceed, className }, ref) => {
    const steps = [1, 2, 3, 4];
    
    return (
      <div 
        ref={ref}
        className={cn(
          'w-full overflow-x-auto',
          className
        )}
        role="navigation"
        aria-label="Wizard progress"
      >
        <div className="flex items-center min-w-max px-4 py-4">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step);
            const isCurrent = step === currentStep;
            const isAvailable = canProceed ? canProceed(step) : step <= currentStep;
            const isLast = index === steps.length - 1;
            
            return (
              <div key={step} className="flex items-center flex-1 min-w-[120px] max-w-[200px]">
                <div className="flex flex-col items-center flex-1">
                  {/* Connecting line */}
                  {!isLast && (
                    <div className="absolute left-1/2 top-5 w-full h-1 z-0" aria-hidden="true">
                      <div 
                        className={cn(
                          'h-full',
                          isCompleted ? 'bg-primary-600' : 'bg-gray-200'
                        )}
                      />
                    </div>
                  )}
                  
                  {/* Step circle */}
                  <button
                    type="button"
                    onClick={() => onStepClick?.(step)}
                    disabled={!isAvailable}
                    className={cn(
                      'relative z-10 w-10 h-10 rounded-full flex items-center justify-center',
                      'text-sm font-medium transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      isCompleted 
                        ? 'bg-primary-600 text-white' 
                        : isCurrent 
                          ? 'bg-primary-600 text-white ring-2 ring-primary-600 ring-offset-2' 
                          : isAvailable 
                            ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' 
                            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    )}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`Step ${step}: ${stepLabels[step - 1]}`}
                    aria-disabled={!isAvailable}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{step}</span>
                    )}
                  </button>
                  
                  {/* Step label */}
                  <span 
                    className={cn(
                      'mt-2 text-xs font-medium text-center max-w-[120px]',
                      isCurrent ? 'text-primary-600' : 'text-gray-600'
                    )}
                  >
                    {stepLabels[step - 1]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

WizardStepper.displayName = 'WizardStepper';