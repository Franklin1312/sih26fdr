import { apiClient } from './core'
import type { ReportsSummary } from '../types/report'

export const reportsApi = {
  async getSummary(): Promise<ReportsSummary> {
    const response = await apiClient.axios.get('/reports/summary')
    return response.data
  },
}
