export type DepositType =
  | 'security_deposit'
  | 'fdr'
  | 'rpgf'
  | 'bank_guarantee'

export type DepositMethod =
  | 'fdr_rpgf'
  | 'rtgs'
  | 'security_deposit_refund'

export type CaseStatus =
  | 'draft'
  | 'submitted'
  | 'under_scrutiny'
  | 'clarification_pending'
  | 'clearance_queue'
  | 'cleared'
  | 'release_requested'
  | 'fdr_rpgf_review'
  | 'rtgs_review'
  | 'sd_refund_review'
  | 'final_decision'
  | 'released'
  | 'rejected'
  | 'closed'

// Common pagination types
export interface PaginationParams {
  page?: number
  page_size?: number
  search?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface DepositCaseCreate {
  institution_id: string
  deposit_type: DepositType
  deposit_method: DepositMethod
  amount: number
  currency: string
  maturity_date: string | null
  instrument_number: string
  instrument_date: string
  issuing_bank: string
  term_end_date?: string | null
  regulatory_context?: Record<string, boolean>
}

export interface DepositCaseUpdate {
  deposit_type?: DepositType
  deposit_method?: DepositMethod
  amount?: number
  currency?: string
  maturity_date?: string | null
  instrument_number?: string
  instrument_date?: string
  issuing_bank?: string
  term_end_date?: string | null
  regulatory_context?: Record<string, boolean>
}

export interface DepositCaseRenewalCreate {
  instrument_number: string
  instrument_date?: string
  issuing_bank: string
  amount: number
  currency?: string
  maturity_date: string
  term_end_date?: string | null
  renewal_notes?: string
}

export interface DepositCaseStatusUpdate {
  new_status: CaseStatus
  reason?: string
  details?: Record<string, unknown>
}

export interface DepositCaseResponse {
  id: string
  case_number: string
  tracking_ref: string | null
  institution_id: string
  deposit_type: DepositType
  deposit_method: DepositMethod
  amount: number
  currency: string
  maturity_date: string | null
  instrument_number: string
  instrument_date: string
  issuing_bank: string
  status: CaseStatus
  created_at: string
  updated_at: string
  submitted_at: string | null
  assigned_officer_id: string | null
  term_end_date: string | null
  aicte_clause_ref?: string | null
  parent_case_id?: string | null
  regulatory_context: Record<string, boolean>
}

export interface LifecycleDateResponse {
  id: string
  case_id: string
  date_type: 'fdr_maturity' | 'aicte_term_end' | 'admin_deadline' | 'renewal_due'
  date_value: string
  alert_lead_days: number
  description?: string
  is_active: boolean
  created_at: string
}

export interface DepositCaseDetail extends DepositCaseResponse {
  institution: import('./institution').InstitutionResponse | null
  assigned_officer: import('./auth').UserResponse | null
  documents: DepositEvidenceResponse[]
  events: CaseEventResponse[]
  clarifications: ClarificationRequestResponse[]
  clearances: ClearanceTaskResponse[]
  lifecycle_dates?: LifecycleDateResponse[]
  parent_case?: DepositCaseResponse | null
  child_cases?: DepositCaseResponse[]
  dashboard_stats?: DashboardStats
}

export interface DepositEvidenceResponse {
  id: string
  case_id: string
  document_type: string
  file_path: string
  original_filename: string
  file_size: number
  mime_type: string
  uploaded_by: string
  file_hash: string
  version: number
  ocr_text: string | null
  ocr_confidence: number | null
  validation_flags: Record<string, unknown> | null
  extracted_data: Record<string, unknown> | null
  replaced_by_id: string | null
  created_at: string
  uploaded_by_user?: import('./auth').UserResponse
}

export interface DepositEvidenceUploadResponse {
  id: string
  case_id: string
  document_type: string
  original_filename: string
  file_size: number
  mime_type: string
  version: number
  file_hash: string
  uploaded_by: string
  created_at: string
  replaced_id: string | null
  ocr_text: string | null
  ocr_confidence: number | null
  validation_flags: Record<string, unknown> | null
  extracted_data: Record<string, unknown> | null
}

export type DepositEvidenceListResponse = PaginatedResponse<DepositEvidenceResponse>

export interface DashboardStats {
  total: number
  by_status: Record<string, number>
  by_type: Record<string, number>
  by_method: Record<string, number>
  total_amount: number
  overdue_count: number
  upcoming_maturity_count: number
  pending_my_action: number
  overdue_clearances: number
  upcoming_maturities: number
}

export type DepositCaseDashboardStats = DashboardStats

export interface CaseEventResponse {
  id: string
  case_id: string
  event_type: string
  old_status: string | null
  new_status: string | null
  details: Record<string, unknown> | null
  actor_id: string
  created_at: string
  actor?: import('./auth').UserResponse
}

// Forward reference types
export interface ClarificationRequestResponse {
  id: string
  case_id: string
  requested_by: string
  status: 'pending' | 'responded' | 'resolved'
  items: Array<{
    id: string
    document_type: string
    reason: string
    details?: string
    response?: string
    responded_at?: string
    responded_by?: string
  }>
  created_at: string
  updated_at: string
  requested_by_user?: import('./auth').UserResponse
  responded_by_user?: import('./auth').UserResponse
}

export interface ClearanceTaskResponse {
  id: string
  case_id: string
  clearance_type: string
  assigned_to: string | null
  status: string
  evidence: string[] | null
  notes: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  assigned_to_user?: import('./auth').UserResponse
  case_number?: string
  institution_name?: string
  deposit_type?: DepositType
  deposit_method?: DepositMethod
}

export interface SystemAlertResponse {
  id: string
  case_id: string
  case_number: string
  institution_name: string
  alert_type: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  due_date: string | null
  days_left: number | null
  created_at: string
}
