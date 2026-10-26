import { apiClient } from './core'
import type {
  ReleaseQueueResponse,
  ReleaseCaseDetail,
  ReleaseRequestCreate,
  ReleaseDecisionRequest,
  ReleaseChecklistResponse,
} from '../types/release'

export const releaseApi = {
  async getQueue(params: {
    page?: number
    page_size?: number
    search?: string
    status?: string
  } = {}): Promise<ReleaseQueueResponse> {
    const response = await apiClient.axios.get('/release/queue', {
      params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '')),
    })
    return response.data
  },

  async getCaseDetail(caseId: string): Promise<ReleaseCaseDetail> {
    const response = await apiClient.axios.get(`/release/cases/${caseId}`)
    return response.data
  },

  async requestRelease(data: ReleaseRequestCreate): Promise<ReleaseCaseDetail> {
    const response = await apiClient.axios.post('/release/request', data)
    return response.data
  },

  async getChecklist(caseId: string): Promise<ReleaseChecklistResponse> {
    const response = await apiClient.axios.get(`/release/cases/${caseId}/checklist`)
    return response.data
  },

  async makeDecision(caseId: string, data: ReleaseDecisionRequest): Promise<{ message: string }> {
    const response = await apiClient.axios.post(`/release/cases/${caseId}/decide`, data)
    return response.data
  },

  async getMyRequests(params: {
    page?: number
    page_size?: number
    status?: string
  } = {}): Promise<ReleaseQueueResponse> {
    const response = await apiClient.axios.get('/release/my-requests', {
      params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '')),
    })
    return response.data
  },
}
