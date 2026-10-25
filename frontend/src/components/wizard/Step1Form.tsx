import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { WizardStep1Request } from '../../types/wizard';
import type { DepositType, DepositMethod } from '../../types/case';

const depositTypeOptions: { value: DepositType; label: string }[] = [
  { value: 'security_deposit', label: 'Security Deposit' },
  { value: 'fdr', label: 'Fixed Deposit Receipt (FDR)' },
  { value: 'rpgf', label: 'Revenue Performance Guarantee Fund (RPGF)' },
  { value: 'bank_guarantee', label: 'Bank Guarantee' },
];

const depositMethodOptions: { value: DepositMethod; label: string }[] = [
  { value: 'fdr_rpgf', label: 'FDR/RPGF' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'security_deposit_refund', label: 'Security Deposit Refund' },
];

const currencyOptions = [
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
];

const step1Schema = z.object({
  deposit_type: z.enum(['security_deposit', 'fdr', 'rpgf', 'bank_guarantee']),
  deposit_method: z.enum(['fdr_rpgf', 'rtgs', 'security_deposit_refund']),
  amount: z.string().min(1).refine(val => parseFloat(val) > 0, 'Amount must be > 0'),
  currency: z.string().min(1),
  instrument_number: z.string().min(1),
  instrument_date: z.string().min(1),
  issuing_bank: z.string().min(1),
  maturity_date: z.string().optional(),
  term_end_date: z.string().optional(),
}).refine(data => {
  if (['fdr', 'rpgf'].includes(data.deposit_type) && !data.maturity_date) return false;
  return true;
}, { message: 'Maturity date required for FDR/RPGF', path: ['maturity_date'] });

type Step1FormData = z.infer<typeof step1Schema>;

interface Step1FormProps {
  initialData?: Partial<WizardStep1Request>;
  onSubmit: (data: WizardStep1Request) => Promise<void>;
  isLoading?: boolean;
  errors?: string[];
  warnings?: string[];
}

export function Step1Form({ 
  initialData, 
  onSubmit, 
  isLoading = false,
  errors = [],
  warnings = [],
}: Step1FormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: formErrors },
  } = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      deposit_type: initialData?.deposit_type || 'fdr',
      deposit_method: initialData?.deposit_method || 'fdr_rpgf',
      amount: initialData?.amount || '',
      currency: initialData?.currency || 'INR',
      instrument_number: initialData?.instrument_number || '',
      instrument_date: initialData?.instrument_date || '',
      issuing_bank: initialData?.issuing_bank || '',
      maturity_date: initialData?.maturity_date || '',
      term_end_date: initialData?.term_end_date || '',
    },
    mode: 'onChange',
  });

  const depositType = watch('deposit_type');
  const depositMethod = watch('deposit_method');
  const showMaturityDate = ['fdr', 'rpgf'].includes(depositType);
  const showTermEndDate = depositMethod === 'security_deposit_refund';

  useEffect(() => {
    if (!showMaturityDate) setValue('maturity_date', '');
    if (!showTermEndDate) setValue('term_end_date', '');
  }, [depositType, depositMethod, showMaturityDate, showTermEndDate, setValue]);

  const handleFormSubmit = async (data: Step1FormData) => {
    await onSubmit(data as WizardStep1Request);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      {/* Deposit Type & Method */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="deposit_type" className="label">Deposit Type *</label>
          <Select
            id="deposit_type"
            options={depositTypeOptions}
            placeholder="Select deposit type"
            {...register('deposit_type')}
            error={formErrors.deposit_type?.message}
          />
        </div>
        <div>
          <label htmlFor="deposit_method" className="label">Deposit Method *</label>
          <Select
            id="deposit_method"
            options={depositMethodOptions}
            placeholder="Select deposit method"
            {...register('deposit_method')}
            error={formErrors.deposit_method?.message}
          />
        </div>
      </div>

      {/* Amount & Currency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="amount" className="label">Amount *</label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Enter amount"
            {...register('amount')}
            error={formErrors.amount?.message}
          />
        </div>
        <div>
          <label htmlFor="currency" className="label">Currency *</label>
          <Select
            id="currency"
            options={currencyOptions}
            placeholder="Select currency"
            {...register('currency')}
            error={formErrors.currency?.message}
          />
        </div>
      </div>

      {/* Instrument Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="instrument_number" className="label">Instrument Number *</label>
          <Input
            id="instrument_number"
            placeholder="Enter instrument number"
            {...register('instrument_number')}
            error={formErrors.instrument_number?.message}
          />
        </div>
        <div>
          <label htmlFor="instrument_date" className="label">Instrument Date *</label>
          <Input
            id="instrument_date"
            type="date"
            {...register('instrument_date')}
            error={formErrors.instrument_date?.message}
          />
        </div>
        <div>
          <label htmlFor="issuing_bank" className="label">Issuing Bank *</label>
          <Input
            id="issuing_bank"
            placeholder="Enter bank name"
            {...register('issuing_bank')}
            error={formErrors.issuing_bank?.message}
          />
        </div>
      </div>

      {/* Conditional Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showMaturityDate && (
          <div>
            <label htmlFor="maturity_date" className="label">Maturity Date *</label>
            <Input
              id="maturity_date"
              type="date"
              {...register('maturity_date')}
              error={formErrors.maturity_date?.message}
            />
            <p className="mt-1 text-xs text-gray-500">Required for FDR and RPGF deposits</p>
          </div>
        )}
        {showTermEndDate && (
          <div>
            <label htmlFor="term_end_date" className="label">Term End Date</label>
            <Input
              id="term_end_date"
              type="date"
              {...register('term_end_date')}
            />
            <p className="mt-1 text-xs text-gray-500">Optional for security deposit refund</p>
          </div>
        )}
      </div>

      {/* Errors & Warnings */}
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
          <ul className="list-disc list-inside text-red-700 space-y-1">
            {errors.map((error, i) => <li key={i}>{error}</li>)}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <h4 className="font-medium text-yellow-800 mb-2">Warnings:</h4>
          <ul className="list-disc list-inside text-yellow-700 space-y-1">
            {warnings.map((warning, i) => <li key={i}>{warning}</li>)}
          </ul>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <Button type="submit" className="w-full md:w-auto" disabled={isLoading} size="lg">
          {isLoading ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>
    </form>
  );
}