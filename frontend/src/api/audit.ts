import { apiClient } from './core'

export interface AuditActor {
  id: string
  full_name?: string
  email?: string
  role?: string
}

export interface AuditLogItem {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor_id: string
  actor?: AuditActor
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  timestamp: string
  hash: string
  prev_hash: string
  sequence: number
  is_checkpoint: boolean
}

export interface AuditListResponse {
  items: AuditLogItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ChainVerificationResult {
  chain_valid: boolean
  total_records: number
  verified_records: number
  first_hash: string
  last_hash: string
  tampered_records: string[]
  message: string
}

export const auditApi = {
  // Get audit trail for a single case
  async getCaseAudit(caseId: string): Promise<AuditLogItem[]> {
    const response = await apiClient.axios.get(`/audit/cases/${caseId}`)
    return response.data
  },

  // Get system-wide audit records with pagination & filters
  async list(params: {
    entity_type?: string
    entity_id?: string
    action?: string
    actor_id?: string
    page?: number
    page_size?: number
  } = {}): Promise<AuditListResponse> {
    const response = await apiClient.axios.get('/audit', { params })
    return response.data
  },

  // Verify the entire cryptographic hash-chain
  async verifyChain(): Promise<ChainVerificationResult> {
    const response = await apiClient.axios.get('/audit/verify')
    return response.data
  },
}
