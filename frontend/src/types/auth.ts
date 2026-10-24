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

export interface AuthenticatedUser {
  user_id: string
  email: string
  full_name: string
  role: UserRole
  institution_id: string | null
  institution_name?: string | null
  is_authenticated: boolean
}

export type UserRole =
  | 'institution_rep'
  | 'scrutiny_officer'
  | 'clearance_officer'
  | 'competent_authority'
  | 'system_admin'

export type User = UserResponse

export interface UserCreate {
  email: string
  full_name: string
  role: UserRole
  institution_id?: string | null
  password: string
}

export interface UserUpdate {
  full_name?: string
  role?: UserRole
  institution_id?: string | null
  is_active?: boolean
  password?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}
