import { createContext } from 'react'
import type { AuthenticatedUser } from '../types/auth'

export interface AuthContextType {
  user: AuthenticatedUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
