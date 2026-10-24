import { apiClient } from './core'
import type {
  DepositCaseCreate,
  DepositCaseUpdate,
  DepositCaseResponse,
  DepositCaseDetail,
  DepositCaseStatusUpdate,
  DepositEvidenceResponse,
  DepositEvidenceUploadResponse,
  DepositEvidenceListResponse,
  PaginationParams,
  PaginatedResponse,
  DashboardStats,
} from '../types/case'

export const casesApi = {
  // List cases with pagination and filters
  async list(params: PaginationParams & {
    status?: string
    deposit_type?: string
    deposit_method?: string
    institution_id?: string
    assigned_officer_id?: string
    overdue?: boolean
    upcoming_maturity_days?: number
  } = {}): Promise<PaginatedResponse<DepositCaseResponse>> {
    const response = await apiClient.axios.get('/cases', { params })
    return response.data
  },

  // Get case by ID
  async getById(id: string): Promise<DepositCaseDetail> {
    const response = await apiClient.axios.get(`/cases/${id}`)
    return response.data
  },

  // Get case by tracking reference
  async getByTrackingRef(trackingRef: string): Promise<DepositCaseDetail> {
    const response = await apiClient.axios.get(`/cases/tracking/${trackingRef}`)
    return response.data
  },

  // Create new case
  async create(data: DepositCaseCreate): Promise<DepositCaseResponse> {
    const response = await apiClient.axios.post('/cases', data)
    return response.data
  },

  // Update case
  async update(id: string, data: DepositCaseUpdate): Promise<DepositCaseResponse> {
    const response = await apiClient.axios.patch(`/cases/${id}`, data)
    return response.data
  },

  // Update case status
  async updateStatus(id: string, data: DepositCaseStatusUpdate): Promise<DepositCaseResponse> {
    const response = await apiClient.axios.patch(`/cases/${id}/status`, data)
    return response.data
  },

  // Get dashboard statistics
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await apiClient.axios.get('/cases/stats/dashboard')
    return response.data
  },

  // Upload document
  async uploadDocument(
    caseId: string,
    file: File,
    documentType: string,
    description?: string
  ): Promise<DepositEvidenceUploadResponse> {
    const formData = new FormData()
    formData.append('case_id', caseId)
    formData.append('file', file)
    formData.append('document_type', documentType)
    if (description) {
      formData.append('description', description)
    }

    const response = await apiClient.axios.post(
      '/cases',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return response.data
  },

  // List documents for a case
  async listDocuments(caseId: string, params: PaginationParams = {}): Promise<DepositEvidenceListResponse> {
    const response = await apiClient.axios.get('/cases', { params: { ...params, case_id: caseId } })
    return response.data
  },

  // Get document by ID
  async getDocument(documentId: string): Promise<DepositEvidenceResponse> {
    const response = await apiClient.axios.get(`/cases/${documentId}`)
    return response.data
  },

  // Download document
  async downloadDocument(documentId: string): Promise<Blob> {
    const { data } = await apiClient.axios.get(`/cases/${documentId}/download`)
    const formData = new FormData()
    formData.append('token', data.download_token)
    const response = await apiClient.axios.post(`/cases/${documentId}/download`, formData, {
      responseType: 'blob',
    })
    return response.data
  },

  // Delete document
  async deleteDocument(documentId: string): Promise<void> {
    await apiClient.axios.delete(`/cases/${documentId}`)
  },
}
