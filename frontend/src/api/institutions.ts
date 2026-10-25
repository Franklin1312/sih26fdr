import { apiClient } from './core'
import type {
  InstitutionResponse,
  InstitutionCreate,
  InstitutionUpdate,
  PaginationParams,
} from '../types/institution'

export const institutionsApi = {
  async list(params: PaginationParams = {}): Promise<{ items: InstitutionResponse[]; total: number; page: number; page_size: number; total_pages: number }> {
    const response = await apiClient.axios.get('/institutions', { params })
    return response.data
  },

  async getById(id: string): Promise<InstitutionResponse> {
    const response = await apiClient.axios.get(`/institutions/${id}`)
    return response.data
  },

  async create(data: InstitutionCreate): Promise<InstitutionResponse> {
    const response = await apiClient.axios.post('/institutions', data)
    return response.data
  },

  async update(id: string, data: InstitutionUpdate): Promise<InstitutionResponse> {
    const response = await apiClient.axios.patch(`/institutions/${id}`, data)
    return response.data
  },

  async delete(id: string): Promise<void> {
    await apiClient.axios.delete(`/institutions/${id}`)
  },

  async getStats(id: string): Promise<{
    total_cases: number
    active_cases: number
    released_cases: number
    total_amount: number
  }> {
    const response = await apiClient.axios.get(`/institutions/${id}/stats`)
    return response.data
  },
}
