import { apiClient } from './core'
import type {
  WizardCreateRequest,
  WizardCreateResponse,
  WizardStateResponse,
  WizardStep1Request,
  WizardStep1Response,
  WizardStep2Request,
  WizardStep2Response,
  WizardStep3Request,
  WizardStep3Response,
  WizardStep4Response,
  ClarificationRequestCreate,
  ClarificationRequestResponse,
} from '../types/wizard'

export const wizardApi = {
  async create(data: WizardCreateRequest): Promise<WizardCreateResponse> {
    const response = await apiClient.axios.post('/wizard/create', data)
    return response.data
  },

  async getState(caseId: string): Promise<WizardStateResponse> {
    const response = await apiClient.axios.get(`/wizard/${caseId}/state`)
    return response.data
  },

  async submitStep1(caseId: string, data: WizardStep1Request): Promise<WizardStep1Response> {
    const response = await apiClient.axios.post(`/wizard/${caseId}/step1`, data)
    return response.data
  },

  async submitStep2(caseId: string, data: WizardStep2Request): Promise<WizardStep2Response> {
    const response = await apiClient.axios.post(`/wizard/${caseId}/step2`, data)
    return response.data
  },

  async submitStep3(caseId: string, data: WizardStep3Request): Promise<WizardStep3Response> {
    const response = await apiClient.axios.post(`/wizard/${caseId}/step3`, data)
    return response.data
  },

  async submitStep4(caseId: string): Promise<WizardStep4Response> {
    const response = await apiClient.axios.post(`/wizard/${caseId}/submit`)
    return response.data
  },

  async submitClarification(caseId: string, data: ClarificationRequestCreate): Promise<ClarificationRequestResponse> {
    const response = await apiClient.axios.post('/clarifications', { ...data, case_id: caseId })
    return response.data
  },

  async getClarifications(caseId: string): Promise<ClarificationRequestResponse[]> {
    const response = await apiClient.axios.get(`/clarifications/case/${caseId}`)
    return response.data.items
  },
}
