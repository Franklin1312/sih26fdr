// Common API types
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PaginationParams {
  page?: number
  page_size?: number
  search?: string
}

export interface ApiError {
  detail: string
  status_code: number
}

// User & Auth types
export interface UserResponse {
  id: string
  email: string
  full_name: string
  role: UserRole
  institution_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type UserRole =
  | 'INSTITUTION_REP'
  | 'SCRUTINY_OFFICER'
  | 'CLEARANCE_OFFICER'
  | 'COMPETENT_AUTHORITY'
  | 'SYSTEM_ADMIN'

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}