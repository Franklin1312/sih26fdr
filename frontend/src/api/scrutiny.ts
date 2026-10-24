import { apiClient } from './core'
import type {
  ScrutinyStats,
  ScrutinyQueueResponse,
  ScrutinyCaseDetail,
  TransitionRequest,
} from '../types/scrutiny'

export const scrutinyApi = {
  async getStats(): Promise<ScrutinyStats> {
    const response = await apiClient.axios.get('/scrutiny/stats')
    return response.data
  },

  async getQueue(params: {
    page?: number
    page_size?: number
    search?: string
    status?: string
  } = {}): Promise<ScrutinyQueueResponse> {
    const response = await apiClient.axios.get('/scrutiny/queue', { params })
    return response.data
  },

  async getCaseDetail(caseId: string): Promise<ScrutinyCaseDetail> {
    const response = await apiClient.axios.get(`/scrutiny/cases/${caseId}`)
    return response.data
  },

  async transitionStatus(caseId: string, data: TransitionRequest): Promise<ScrutinyCaseDetail> {
    const response = await apiClient.axios.post(`/scrutiny/cases/${caseId}/transition`, data)
    return response.data
  },

  async requestClarification(caseId: string, items: Array<{
    document_type: string
    reason: string
    details?: string
  }>): Promise<{ success: boolean }> {
    const response = await apiClient.axios.post(`/scrutiny/cases/${caseId}/clarification`, { items })
    return response.data
  },

  async assignCase(caseId: string): Promise<ScrutinyCaseDetail> {
    const response = await apiClient.axios.post(`/scrutiny/cases/${caseId}/assign`)
    return response.data
  },

  async unassignCase(caseId: string): Promise<ScrutinyCaseDetail> {
    const response = await apiClient.axios.post(`/scrutiny/cases/${caseId}/unassign`)
    return response.data
  },
}