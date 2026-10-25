import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Landmark,
  FileCheck2,
  Workflow,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
} from 'lucide-react'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../auth/useAuth'
import { toast } from 'sonner'
import { DEMO_PERSONAS, type DemoPersona } from '../../constants/demoPersonas'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>


export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [activePersonaEmail, setActivePersonaEmail] = useState<string>('inst_rep_1@demo.example')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'inst_rep_1@demo.example',
      password: 'demo',
    },
  })

  const handleSelectPersona = async (persona: DemoPersona, autoLogin = false) => {
    setActivePersonaEmail(persona.email)
    setValue('email', persona.email)
    setValue('password', 'demo')
    if (autoLogin) {
      setIsLoading(true)
      try {
        await login(persona.email, 'demo')
        toast.success(`Signed in as ${persona.title}`)
        navigate(persona.landingPath)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Login failed'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    }
  }

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
    <div className="grid min-h-screen bg-canvas lg:grid-cols-12">
      {/* Brand Hero Panel (5 cols) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-12 text-white lg:col-span-5 lg:flex lg:flex-col lg:justify-between">
        {/* Ambient background glow orbs */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary-600/20 blur-[100px]" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-cyan-600/15 blur-[100px]" aria-hidden="true" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 text-white shadow-lg shadow-primary-900/40 ring-1 ring-white/20">
              <Landmark className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight text-white">SIH 2026 · SIH26265</span>
              <p className="text-xs text-indigo-200/70 font-mono">Security Deposit / FDR Portal</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-white/15 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AICTE APH Compliant
          </div>
        </div>

        {/* Center Pitch */}
        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/20 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Smart Automation Architecture
          </div>

          <h2 className="font-display text-4xl font-extrabold leading-[1.15] tracking-tight text-white">
            Statutory Deposit & FDR Management, <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">Reimagined.</span>
          </h2>

          <p className="mt-4 text-base leading-relaxed text-slate-300">
            A unified digital governance lifecycle strictly aligned with <strong className="text-white font-medium">Clause 6.46</strong>. From automated submission and evidence validation to multi-bureau clearances and final NOC sanctioning.
          </p>

          <div className="mt-8 space-y-3.5">
            {[
              {
                icon: FileCheck2,
                title: 'Clause 6.46 Dual Release Engine',
                desc: 'Independent Approval Bureau NOC (FDR) & Council Sanction (RTGS)',
              },
              {
                icon: Workflow,
                title: 'Multi-Bureau Clearance Tracking',
                desc: 'Independent sign-offs by PGRC, Vigilance & Financial Cells',
              },
              {
                icon: ShieldCheck,
                title: 'Cryptographic Audit Trail',
                desc: 'Tamper-evident SHA-256 hash chains with attributable events',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3.5 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10 backdrop-blur-sm transition-all hover:bg-white/[0.07]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
          <span>Smart India Hackathon 2026 Prototype</span>
          <span className="font-mono text-slate-400">v1.0.0 · Synthetic Mode</span>
        </div>
      </aside>

      {/* Main Interaction Area (7 cols) */}
      <main className="flex flex-col justify-center px-4 py-8 sm:px-10 lg:col-span-7 xl:px-16">
        <div className="mx-auto w-full max-w-xl animate-fade-up">
          {/* Mobile Brand Banner */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
                <Landmark className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <span className="font-display text-base font-bold text-gray-900">SIH26265 Portal</span>
                <p className="text-[11px] text-gray-500 font-mono">FDR & Deposit Management</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Live Demo
            </span>
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Sign In to Portal
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Select a statutory demo role for instant 1-click access, or enter credentials manually.
            </p>
          </div>

          {/* Interactive 1-Click Role Switcher Deck */}
          <div className="mt-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary-900 font-display">
                  1-Click Role Personas
                </span>
              </div>
              <span className="text-[11px] font-medium text-primary-700 bg-primary-100/60 px-2 py-0.5 rounded-md">
                Click to Auto-Login
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {DEMO_PERSONAS.map((persona) => {
                const Icon = persona.icon
                const isSelected = activePersonaEmail === persona.email
                return (
                  <button
                    key={persona.email}
                    type="button"
                    onClick={() => handleSelectPersona(persona, true)}
                    className={`group relative flex items-start gap-3 rounded-xl p-3 text-left transition-all duration-200 ${
                      isSelected
                        ? 'bg-white shadow-md ring-2 ring-primary-500'
                        : 'bg-white/80 hover:bg-white hover:shadow-sm ring-1 ring-slate-200/80'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-900 truncate">{persona.title}</p>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-600 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{persona.name}</p>
                      <p className="text-[10px] text-primary-600 font-medium flex items-center gap-1 mt-1 group-hover:translate-x-0.5 transition-transform">
                        Launch <ArrowRight className="h-2.5 w-2.5" />
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Manual Credentials Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="user@example.com"
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

            <Button type="submit" size="lg" className="w-full mt-2" isLoading={isLoading}>
              <Lock className="h-4 w-4 mr-2" />
              Sign in with Selected Account
            </Button>
          </form>

          {/* Regulatory Note Card */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-600 flex items-start gap-3">
            <div className="rounded-lg bg-white p-1.5 shadow-xs ring-1 ring-slate-200 text-slate-500 shrink-0">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Synthetic Demo Environment</p>
              <p className="mt-0.5 text-slate-500 leading-relaxed">
                All records, institution profiles, and deposit instruments are synthetic demonstrator models with watermarked documents in compliance with hackathon guidelines.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
