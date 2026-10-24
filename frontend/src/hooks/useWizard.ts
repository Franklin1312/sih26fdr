import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { wizardApi } from '../api/wizard';
import type {
  WizardStateResponse,
  WizardStep1Request,
  WizardStep2Request,
  WizardStep3Request,
  WizardCreateResponse,
  WizardStep1Response,
  WizardStep2Response,
  WizardStep3Response,
  WizardStep4Response,
} from '../types/wizard';
import { toast } from 'sonner';

const STORAGE_KEY = 'wizard_form_data';

interface StepFormData {
  step1?: WizardStep1Request;
  step2?: WizardStep2Request;
  step3?: WizardStep3Request;
}

interface UseWizardReturn {
  caseId: string | null;
  wizardState: WizardStateResponse | null;
  isLoading: boolean;
  error: string | null;
  currentStep: number;
  formData: StepFormData;
  createCase: (institutionId: string) => Promise<WizardCreateResponse | null>;
  loadWizardState: (caseId: string) => Promise<void>;
  saveStep1: (data: WizardStep1Request) => Promise<WizardStep1Response | null>;
  saveStep2: (data: WizardStep2Request) => Promise<WizardStep2Response | null>;
  saveStep3: (data: WizardStep3Request) => Promise<WizardStep3Response | null>;
  submitStep4: () => Promise<WizardStep4Response | null>;
  updateFormData: <K extends keyof StepFormData>(step: K, data: StepFormData[K]) => void;
  goToStep: (step: number) => void;
  canProceedToStep: (step: number) => boolean;
  clearStorage: () => void;
}

function getStepNumber(state: WizardStateResponse['current_step']): number {
  switch (state) {
    case 'STEP_1': return 1;
    case 'STEP_2': return 2;
    case 'STEP_3': return 3;
    case 'STEP_4': return 4;
    case 'COMPLETED': return 4;
    default: return 1;
  }
}

function getStepState(step: number): WizardStateResponse['current_step'] {
  switch (step) {
    case 1: return 'STEP_1';
    case 2: return 'STEP_2';
    case 3: return 'STEP_3';
    case 4: return 'STEP_4';
    default: return 'STEP_1';
  }
}

export function useWizard(): UseWizardReturn {
  const navigate = useNavigate();
  const { caseId: urlCaseId } = useParams<{ caseId: string }>();
  
  const [wizardState, setWizardState] = useState<WizardStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<StepFormData>({});
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setFormData(JSON.parse(stored));
    } catch {}
  }, []);
  
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    } catch {}
  }, [formData]);
  
  const caseId = urlCaseId || wizardState?.case_id || null;
  const currentStep = wizardState ? getStepNumber(wizardState.current_step) : 1;

  const canProceedToStep = useCallback((step: number): boolean => {
    if (!wizardState) return step === 1;
    if (step <= currentStep) return true;
    switch (currentStep) {
      case 1: return wizardState.step1_completed && step === 2;
      case 2: return wizardState.step2_completed && step === 3;
      case 3: return wizardState.step3_completed && step === 4;
      default: return false;
    }
  }, [wizardState, currentStep]);

  const loadWizardState = useCallback(async (cid: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const state = await wizardApi.getState(cid);
      setWizardState(state);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load wizard state';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (caseId) loadWizardState(caseId);
  }, [caseId, loadWizardState]);

  const createCase = useCallback(async (institutionId: string): Promise<WizardCreateResponse | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await wizardApi.create({ institution_id: institutionId });
      navigate(`/wizard/${response.case_id}/step1`);
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create case';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const saveStep1 = useCallback(async (data: WizardStep1Request): Promise<WizardStep1Response | null> => {
    if (!caseId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const response = await wizardApi.submitStep1(caseId, data);
      if (response.success) {
        updateFormData('step1', data);
        await loadWizardState(caseId);
        toast.success('Step 1 saved successfully');
      } else {
        toast.error(response.errors?.join(', ') || 'Failed to save step 1');
      }
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save step 1';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [caseId, loadWizardState]);

  const saveStep2 = useCallback(async (data: WizardStep2Request): Promise<WizardStep2Response | null> => {
    if (!caseId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const response = await wizardApi.submitStep2(caseId, data);
      if (response.success) {
        updateFormData('step2', data);
        await loadWizardState(caseId);
        toast.success('Step 2 saved successfully');
      } else {
        toast.error(response.errors?.join(', ') || 'Failed to save step 2');
      }
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save step 2';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [caseId, loadWizardState]);

  const saveStep3 = useCallback(async (data: WizardStep3Request): Promise<WizardStep3Response | null> => {
    if (!caseId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const response = await wizardApi.submitStep3(caseId, data);
      if (response.success) {
        updateFormData('step3', data);
        await loadWizardState(caseId);
        toast.success('Step 3 saved successfully');
      } else {
        toast.error(response.errors?.join(', ') || 'Failed to save step 3');
      }
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save step 3';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [caseId, loadWizardState]);

  const submitStep4 = useCallback(async (): Promise<WizardStep4Response | null> => {
    if (!caseId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const response = await wizardApi.submitStep4(caseId);
      if (response.success) {
        await loadWizardState(caseId);
        toast.success('Case submitted successfully!');
        clearStorage();
      } else {
        toast.error(response.errors?.join(', ') || 'Failed to submit case');
      }
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit case';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [caseId, loadWizardState]);

  const updateFormData = useCallback(<K extends keyof StepFormData>(step: K, data: StepFormData[K]) => {
    setFormData(prev => ({ ...prev, [step]: data }));
  }, []);

  const goToStep = useCallback((step: number) => {
    if (!caseId || !canProceedToStep(step)) return;
    const stepPath = getStepState(step).toLowerCase().replace('_', '');
    navigate(`/wizard/${caseId}/${stepPath}`);
  }, [caseId, canProceedToStep, navigate]);

  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setFormData({});
    } catch {}
  }, []);

  return {
    caseId,
    wizardState,
    isLoading,
    error,
    currentStep,
    formData,
    createCase,
    loadWizardState,
    saveStep1,
    saveStep2,
    saveStep3,
    submitStep4,
    updateFormData,
    goToStep,
    canProceedToStep,
    clearStorage,
  };
}