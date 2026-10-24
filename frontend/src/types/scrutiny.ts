import type { PaginatedResponse, DepositCaseResponse, DepositEvidenceResponse, CaseEventResponse, CaseStatus } from './case'
import type { ClarificationRequestResponse } from './wizard'

export interface ScrutinyStats {
  total_assigned: number
  submitted_unassigned: number
  clarification_pending: number
  total_cases: number
}

export interface ScrutinyQueueResponse extends PaginatedResponse<DepositCaseResponse> {}

export interface ScrutinyCaseDetail extends DepositCaseResponse {
  documents: DepositEvidenceResponse[]
  events: CaseEventResponse[]
  clarifications: ClarificationRequestResponse[]
}

export interface TransitionRequest {
  new_status: CaseStatus
  reason?: string
  details?: Record<string, unknown>
}