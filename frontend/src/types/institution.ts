import type { PaginationParams, PaginatedResponse } from './case'

export interface InstitutionResponse {
  id: string
  name: string
  code: string
  contact_email: string
  address: string
  is_active: boolean
  created_at: string
  updated_at: string
  total_cases?: number
  active_cases?: number
  released_cases?: number
}

export type Institution = InstitutionResponse

export interface InstitutionFormData extends InstitutionCreate {
  is_active: boolean
}

export interface InstitutionCreate {
  name: string
  code: string
  contact_email: string
  address: string
}

export interface InstitutionUpdate {
  name?: string
  contact_email?: string
  address?: string
  is_active?: boolean
}

export type InstitutionListResponse = PaginatedResponse<InstitutionResponse>
export type InstitutionPaginationParams = PaginationParams

// Re-export for convenience
export type { PaginationParams, PaginatedResponse }
