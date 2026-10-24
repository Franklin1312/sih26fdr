import { forwardRef } from 'react';
import { Check } from 'lucide-react';
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
      <nav
        ref={ref}
        className={cn('w-full rounded-xl border border-gray-200 bg-white px-4 py-5 shadow-[var(--shadow-card)] sm:px-8', className)}
        aria-label="Wizard progress"
      >
        <ol className="flex items-start">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step);
            const isCurrent = step === currentStep;
            const isAvailable = canProceed ? canProceed(step) : step <= currentStep;
            const isLast = index === steps.length - 1;

            return (
              <li key={step} className={cn('relative flex flex-col items-center', !isLast && 'flex-1')}>
                <div className="flex w-full items-center">
                  <button
                    type="button"
                    onClick={() => onStepClick?.(step)}
                    disabled={!isAvailable}
                    className={cn(
                      'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                      'disabled:cursor-not-allowed',
                      isCompleted
                        ? 'bg-primary-600 text-white'
                        : isCurrent
                          ? 'bg-white text-primary-700 ring-2 ring-primary-600'
                          : isAvailable
                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            : 'bg-gray-100 text-gray-400'
                    )}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`Step ${step}: ${stepLabels[step - 1]}`}
                  >
                    {isCompleted ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" /> : step}
                  </button>
                  {!isLast && (
                    <div className="mx-2 h-0.5 flex-1 rounded-full bg-gray-200" aria-hidden="true">
                      <div className={cn('h-full rounded-full bg-primary-600 transition-all duration-500', isCompleted ? 'w-full' : 'w-0')} />
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 w-24 text-center text-xs font-medium sm:w-28',
                    !isLast && 'self-start -ml-7 sm:-ml-9',
                    isCurrent ? 'text-primary-700' : 'text-gray-500'
                  )}
                >
                  {stepLabels[step - 1]}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }
);

WizardStepper.displayName = 'WizardStepper';
