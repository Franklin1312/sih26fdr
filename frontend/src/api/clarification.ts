import { apiClient } from './core'
import type { ClarificationRequestResponse } from '../types/case'

export const clarificationApi = {
  // Respond to an open clarification request
  async respond(clarificationId: string, responseText: string): Promise<ClarificationRequestResponse> {
    const res = await apiClient.axios.post(`/clarifications/${clarificationId}/respond`, {
      response: responseText,
    })
    return res.data
  },

  // Get clarification requests for a case
  async listByCase(caseId: string): Promise<{ items: ClarificationRequestResponse[]; total: number }> {
    const res = await apiClient.axios.get(`/clarifications/case/${caseId}`)
    return res.data
  },

  // Update status (resolve/close)
  async updateStatus(clarificationId: string, status: string): Promise<ClarificationRequestResponse> {
    const res = await apiClient.axios.patch(`/clarifications/${clarificationId}`, status)
    return res.data
  },
}
