export type WizardState =
  | 'step_1'
  | 'step_2'
  | 'step_3'
  | 'step_4'
  | 'completed'

export interface WizardStateResponse {
  case_id: string
  tracking_ref?: string | null
  current_step: WizardState
  step1_completed: boolean
  step2_completed: boolean
  step3_completed: boolean
  step1_data: Record<string, unknown> | null
  step2_data: Record<string, unknown> | null
  step3_data: Record<string, unknown> | null
  can_submit: boolean
  missing_mandatory: string[]
  missing_conditional: Array<{ document: string; condition: string }>
}

export interface WizardStep1Request {
  deposit_type: import('./case').DepositType
  deposit_method: import('./case').DepositMethod
  amount: string
  currency: string
  instrument_number: string
  instrument_date?: string
  issuing_bank: string
  maturity_date?: string
  term_end_date?: string
  aicte_clause_ref?: string
}

export interface WizardStep1Response {
  success: boolean
  errors?: string[]
  warnings?: string[]
}

export interface WizardStep2Request {
  documents: Array<{
    document_type: string
    description?: string
  }>
}

export interface WizardStep2Response {
  success: boolean
  errors?: string[]
  warnings?: string[]
}

export interface WizardStep3Request {
  confirmed: boolean
  terms_accepted: boolean
}

export interface WizardStep3Response {
  success: boolean
  completeness_check: {
    passed: boolean
    missing_mandatory: string[]
    missing_conditional: Array<{ document: string; condition: string }>
    warnings: string[]
  }
  errors?: string[]
  warnings?: string[]
  missing_mandatory: string[]
  missing_conditional: Array<{ document: string; condition: string }>
}

export interface WizardStep4Response {
  success: boolean
  case_id?: string
  tracking_ref?: string
  status?: import('./case').CaseStatus
  errors?: string[]
}

export interface WizardCreateRequest {
  institution_id: string
}

export interface WizardCreateResponse {
  case_id: string
  tracking_ref: string
  current_step: WizardState
  message: string
}

export interface ClarificationRequestCreate {
  case_id: string
  items: Array<{
    document_type: string
    reason: string
    details?: string
  }>
}

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
