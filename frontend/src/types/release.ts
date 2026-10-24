import type { CaseStatus } from './case'

export interface ReleaseRequestCreate {
  case_id: string
  request_type: 'maturity' | 'early_release' | 'replacement' | 'renewal' | 'refund'
  reason?: string
}

export interface ReleaseDecisionRequest {
  final_decision: 'release' | 'reject' | 'return_for_correction'
  decision_reasoning: string
}

export interface ReleaseChecklistItem {
  key: string
  label: string
  mandatory: boolean
  condition?: string | null
  category?: string | null
  document_type?: string | null
  completed: boolean
}

export interface ReleaseChecklistResponse {
  request_type: string
  deposit_method: string
  items: ReleaseChecklistItem[]
  passed: boolean
  mandatory_count: number
  completed_count: number
  missing_items: string[]
}

export interface ReleaseQueueItem {
  case_id: string
  case_number: string
  institution_name: string
  deposit_type: string
  deposit_method: string
  amount: number
  status: CaseStatus
  review_path: string
  request_type: string
  requested_by: string
  requested_at: string
  deadline_days: number
  deadline_at: string | null
  checklist_progress: Record<string, unknown>
}

export interface ReleaseQueueResponse {
  items: ReleaseQueueItem[]
  total: number
  page: number
  page_size: number
}

export interface ReleaseCaseDetail {
  id: string
  case_id: string
  request_type: string
  checklist_data: Record<string, boolean> | null
  created_by: string
  decided_by: string | null
  review_path: string | null
  final_decision: string | null
  decision_reasoning: string | null
  status: string
  decided_at: string | null
  created_at: string
  updated_at: string
  case_number: string
  institution_name: string
  deposit_type: string
  deposit_method: string
  amount: number
  case_status: CaseStatus
  checklist: ReleaseChecklistResponse
}
