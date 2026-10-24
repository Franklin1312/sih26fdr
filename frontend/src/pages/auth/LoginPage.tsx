import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../auth/AuthContext'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'inst_rep_1@demo.example',
      password: 'demo',
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      await login(data.email, data.password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid credentials'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary-600 flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <CardTitle className="text-2xl">Sign in to your account</CardTitle>
          <CardDescription>
            Enter your credentials to access the SIH26265 Portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              error={errors.email?.message}
              disabled={isLoading}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
              disabled={isLoading}
            />
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign in
            </Button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-2">
            <p className="font-medium text-gray-900">Demo Accounts:</p>
            <div className="space-y-1 text-xs font-mono">
              <p>Institution Rep: inst_rep_1@demo.example</p>
              <p>Scrutiny Officer: scrutiny_1@demo.example</p>
              <p>Clearance Officer: clearance_1@demo.example</p>
              <p>Competent Authority: authority_1@demo.example</p>
              <p>System Admin: admin_1@demo.example</p>
              <p className="text-primary-600">Password for all: demo</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}