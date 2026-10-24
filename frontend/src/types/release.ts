import type { PaginatedResponse, DepositCaseResponse, DepositEvidenceResponse, CaseEventResponse } from './case'
import type { ClearanceTaskResponse } from './clearance'

export interface ReleaseRequestCreate {
  case_id: string
  reason: string
}

export interface ReleaseDecisionRequest {
  decision: 'approve' | 'reject'
  rationale: string
}

export interface ReleaseChecklistItem {
  key: string
  label: string
  description: string
  document_type: string
  mandatory: boolean
  satisfied: boolean
}

export interface ReleaseChecklistResponse {
  request_type: string
  deposit_method: string
  deadline_days: number
  review_path: string
  items: ReleaseChecklistItem[]
}

export interface ReleaseQueueResponse extends PaginatedResponse<DepositCaseResponse> {}

export interface ReleaseCaseDetail extends DepositCaseResponse {
  documents: DepositEvidenceResponse[]
  events: CaseEventResponse[]
  clearances: ClearanceTaskResponse[]
  checklist?: ReleaseChecklistItem[]
}