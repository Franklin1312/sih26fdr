import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Landmark, FileCheck2, Workflow, ShieldCheck } from 'lucide-react'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../auth/useAuth'
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
    <div className="grid min-h-screen bg-canvas lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-100 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-200/40 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-sky-200/40 blur-3xl" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
            <Landmark className="h-6 w-6" aria-hidden="true" />
          </div>
          <span className="font-display text-lg font-bold text-gray-900">SIH26265</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-extrabold leading-tight text-gray-900">
            Deposit refunds, <span className="text-primary-600">simplified and transparent.</span>
          </h2>
          <p className="mt-4 text-base text-gray-600">
            Submit, scrutinise, clear and release deposit refund cases in one secure workflow with a full audit trail.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: FileCheck2, text: 'Guided submissions with document checks' },
              { icon: Workflow, text: 'Role-based scrutiny, clearance and release' },
              { icon: ShieldCheck, text: 'Secure, auditable case history' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm ring-1 ring-primary-100">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-gray-500">© {new Date().getFullYear()} SIH26265 · Deposit Refund Portal</p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="font-display text-lg font-bold text-gray-900">SIH26265</span>
          </div>

          <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to access the Deposit Refund Portal.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register('email')}
              error={errors.email?.message}
              disabled={isLoading}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
              disabled={isLoading}
            />
            <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
              Sign in
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-primary-100 bg-primary-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Demo accounts</p>
            <dl className="mt-3 space-y-1.5 text-xs">
              {[
                ['Institution Rep', 'inst_rep_1@demo.example'],
                ['Scrutiny Officer', 'scrutiny_1@demo.example'],
                ['Clearance Officer', 'clearance_1@demo.example'],
                ['Competent Authority', 'authority_1@demo.example'],
                ['System Admin', 'admin_1@demo.example'],
              ].map(([role, email]) => (
                <div key={email} className="flex items-baseline justify-between gap-3">
                  <dt className="text-gray-600">{role}</dt>
                  <dd className="font-mono text-gray-900">{email}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-primary-100 pt-3 text-xs text-gray-600">
              Password for all: <span className="font-mono font-semibold text-gray-900">demo</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
