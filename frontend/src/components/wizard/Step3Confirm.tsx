import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { cn } from '../../utils/helpers';
import type { WizardStep3Request, WizardStep3Response } from '../../types/wizard';

const step3Schema = z.object({
  confirmed: z.boolean().refine(val => val === true, 'You must confirm the information is accurate'),
  terms_accepted: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
});

type Step3FormData = z.infer<typeof step3Schema>;

interface Step3ConfirmProps {
  completenessCheck?: WizardStep3Response['completeness_check'];
  initialData?: Partial<WizardStep3Request>;
  onSubmit: (data: WizardStep3Request) => Promise<void>;
  isLoading?: boolean;
  errors?: string[];
}

export function Step3Confirm({
  completenessCheck,
  initialData,
  onSubmit,
  isLoading = false,
  errors = [],
}: Step3ConfirmProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors: formErrors },
  } = useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      confirmed: initialData?.confirmed || false,
      terms_accepted: initialData?.terms_accepted || false,
    },
    mode: 'onChange',
  });

  const confirmed = watch('confirmed');
  const termsAccepted = watch('terms_accepted');
  const canSubmit = confirmed && termsAccepted;

  const handleFormSubmit = async (data: Step3FormData) => {
    await onSubmit(data as WizardStep3Request);
  };

  const missingMandatory = completenessCheck?.missing_mandatory || [];

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Completeness Check Results</h3>
        {completenessCheck?.passed ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <div>
              <p className="font-medium text-green-800">All mandatory requirements met</p>
              <p className="text-sm text-green-700">You can proceed with submission</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <p className="font-medium text-red-800">Mandatory items missing</p>
              <p className="text-sm text-red-700">Please review and upload missing documents</p>
            </div>
          </div>
        )}
        {missingMandatory.length > 0 && (
          <ul className="mt-6 space-y-2">
            {missingMandatory.map((item, i) => (
              <li key={i} className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                <FileText className="h-5 w-5 text-red-500" />
                <span className="text-red-700">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Confirmations Required</h3>
        <div className="space-y-4">
          <label className={cn(
            'flex items-start gap-3 cursor-pointer p-4 rounded-lg border-2 transition-colors',
            confirmed ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300'
          )}>
            <input type="checkbox" {...register('confirmed')} className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
            <div>
              <p className="font-medium text-gray-900">I confirm all information provided is accurate and complete</p>
            </div>
          </label>
          <label className={cn(
            'flex items-start gap-3 cursor-pointer p-4 rounded-lg border-2 transition-colors',
            termsAccepted ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300'
          )}>
            <input type="checkbox" {...register('terms_accepted')} className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
            <div>
              <p className="font-medium text-gray-900">I accept the terms and conditions</p>
            </div>
          </label>
        </div>
        {formErrors.confirmed && <p className="text-sm text-red-600">{formErrors.confirmed.message}</p>}
        {formErrors.terms_accepted && <p className="text-sm text-red-600">{formErrors.terms_accepted.message}</p>}
      </Card>

      {errors.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50">
          <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
          <ul className="list-disc list-inside text-red-700 space-y-1">
            {errors.map((error, i) => <li key={i}>{error}</li>)}
          </ul>
        </Card>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={() => window.history.back()} disabled={isLoading}>
          Back
        </Button>
        <Button type="submit" disabled={isLoading || !canSubmit} size="lg">
          {isLoading ? 'Submitting...' : 'Submit Case'}
        </Button>
      </div>
    </form>
  );
}