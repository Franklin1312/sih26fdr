import type { PaginatedResponse, DepositCaseResponse, DepositCaseDetail, CaseStatus } from './case'

export interface ScrutinyStats {
  total_assigned: number
  submitted_unassigned: number
  clarification_pending: number
  total_cases: number
}

export interface ScrutinyQueueResponse extends PaginatedResponse<DepositCaseResponse> {}

export type ScrutinyCaseDetail = DepositCaseDetail

export type { CaseStatus }

export interface TransitionRequest {
  new_status: CaseStatus
  reason?: string
  details?: Record<string, unknown>
}
