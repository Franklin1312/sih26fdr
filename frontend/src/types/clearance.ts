import type { PaginatedResponse, DepositType, DepositMethod, CaseStatus } from './case'

export type ClearanceStatus = 'pending' | 'claimed' | 'in_progress' | 'cleared' | 'rejected'

export type ClearanceType = 'financial' | 'legal' | 'technical' | 'environmental'

export interface ClearanceTaskResponse {
  id: string
  case_id: string
  clearance_type: ClearanceType
  assigned_to: string | null
  status: ClearanceStatus
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

export interface ClearanceQueueItem {
  case_id: string
  case_number: string
  institution_name: string
  deposit_type: DepositType
  deposit_method: DepositMethod
  amount: number
  maturity_date: string | null
  status: CaseStatus
  tasks: Array<{
    id: string
    clearance_type: ClearanceType
    status: ClearanceStatus
  }>
}

export interface ClearanceQueueResponse extends PaginatedResponse<ClearanceQueueItem> {}

export interface ClearanceClaimRequest {
  task_id: string
}

export interface ClearanceCompleteRequest {
  evidence: string[]
  notes?: string
}

export interface ClearanceTaskDetail {
  id: string
  case_id: string
  clearance_type: ClearanceType
  assigned_to: string
  status: ClearanceStatus
  evidence: string[] | null
  notes: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  assigned_to_user?: import('./auth').UserResponse
  case_number: string
  institution_name: string
  deposit_type: DepositType
  deposit_method: DepositMethod
}

export interface ClearanceHistoryResponse {
  case_id: string
  case_number: string
  current_status: CaseStatus
  tasks: Array<{
    task_id: string
    clearance_type: ClearanceType
    status: ClearanceStatus
    evidence: string[] | null
    notes: string | null
    completed_at: string | null
    officer_name: string | null
  }>
  all_cleared: boolean
}