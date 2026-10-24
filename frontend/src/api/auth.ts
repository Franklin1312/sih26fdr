import { apiClient } from './core'
import type { LoginRequest, TokenResponse, UserResponse, UserCreate, UserUpdate, PaginationParams, PaginatedResponse } from '../types/auth'

export const authApi = {
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    const formData = new FormData()
    formData.append('username', credentials.username)
    formData.append('password', credentials.password)

    const response = await apiClient.axios.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await apiClient.axios.post('/auth/refresh', {
      refresh_token: refreshToken,
    })
    return response.data
  },

  async getCurrentUser(): Promise<UserResponse> {
    const response = await apiClient.axios.get('/users/me')
    return response.data
  },
}

export const usersApi = {
  async list(params: PaginationParams = {}): Promise<PaginatedResponse<UserResponse>> {
    const response = await apiClient.axios.get('/users', { params })
    return response.data
  },

  async create(data: UserCreate): Promise<UserResponse> {
    const response = await apiClient.axios.post('/users', data)
    return response.data
  },

  async update(id: string, data: UserUpdate): Promise<UserResponse> {
    const response = await apiClient.axios.patch(`/users/${id}`, data)
    return response.data
  },
}
