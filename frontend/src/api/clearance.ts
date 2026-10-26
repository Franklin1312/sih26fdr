import { apiClient } from './core'
import type {
  ClearanceQueueResponse,
  ClearanceTaskResponse,
  ClearanceTaskDetail,
  ClearanceCompleteRequest,
  ClearanceHistoryResponse,
} from '../types/clearance'

export const clearanceApi = {
  async getQueue(params: {
    page?: number
    page_size?: number
    search?: string
    clearance_type?: string
    status?: string
    my_tasks_only?: boolean
  } = {}): Promise<ClearanceQueueResponse> {
    const response = await apiClient.axios.get('/clearance/queue', {
      params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '')),
    })
    return response.data
  },

  async getTaskDetail(taskId: string): Promise<ClearanceTaskDetail> {
    const response = await apiClient.axios.get(`/clearance/cases/${taskId}`)
    return response.data
  },

  async claimTask(taskId: string): Promise<ClearanceTaskResponse> {
    // FastAPI models, including an empty claim model, still require a JSON
    // body.  Sending {} prevents the request-body validation 422.
    const response = await apiClient.axios.post(`/clearance/cases/${taskId}/claim`, {})
    return response.data
  },

  async completeTask(taskId: string, data: ClearanceCompleteRequest): Promise<ClearanceTaskResponse> {
    const response = await apiClient.axios.post(`/clearance/tasks/${taskId}/complete`, data)
    return response.data
  },

  async getCaseHistory(caseId: string): Promise<ClearanceHistoryResponse> {
    const response = await apiClient.axios.get(`/clearance/cases/${caseId}/history`)
    return response.data
  },

  async getMyTasks(params: {
    page?: number
    page_size?: number
    clearance_type?: string
    status?: string
  } = {}): Promise<ClearanceQueueResponse> {
    const response = await apiClient.axios.get('/clearance/queue', {
      params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '')),
    })
    return response.data
  },
}
