import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
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
import { GovTopBar } from '../../components/layout/GovTopBar'
import { PortalLogo } from '../../components/layout/PortalLogo'
import { InstitutionPersonaPicker } from './InstitutionPersonaPicker'

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
    <div className="flex min-h-screen flex-col bg-canvas">
      <GovTopBar />

      <div className="grid flex-1 lg:grid-cols-12">
        {/* Brand Hero Panel (5 cols) */}
        <aside className="gov-hero-pattern relative hidden overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 p-12 text-white lg:col-span-5 lg:flex lg:flex-col lg:justify-between">
          {/* Soft tricolour glows (saffron top-right, green bottom-left) */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-saffron-500/20 blur-[110px]" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-emerald-500/15 blur-[110px]" aria-hidden="true" />

          {/* Top Header */}
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <PortalLogo className="bg-white text-primary-900 ring-offset-primary-900" />
              <div>
                <span className="font-display text-lg font-bold tracking-tight text-white">SIH 2026 · SIH26265</span>
                <p className="text-xs text-primary-200 font-medium">Security Deposit / FDR Portal</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-white/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AICTE APH Compliant
            </div>
          </div>

          {/* Center Pitch */}
          <div className="relative z-10 my-auto py-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-saffron-500/15 px-3 py-1.5 text-xs font-semibold text-saffron-200 ring-1 ring-saffron-400/40">
              <Sparkles className="h-3.5 w-3.5 text-saffron-300" />
              Smart Automation Architecture
            </div>

            <h2 className="font-display text-4xl font-extrabold leading-[1.15] tracking-tight text-white">
              Statutory Deposit &amp; FDR Management,{' '}
              <span className="text-saffron-400">Made Transparent.</span>
            </h2>

            <p className="mt-4 text-base leading-relaxed text-primary-100">
              A unified digital governance lifecycle strictly aligned with <strong className="font-semibold text-white">Clause 6.46</strong>. From automated submission and evidence validation to multi-bureau clearances and final NOC sanctioning.
            </p>

            <div className="mt-8 space-y-3">
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
                <div key={title} className="flex items-start gap-3.5 rounded-xl bg-white/[0.06] p-3.5 ring-1 ring-white/15 transition-all hover:bg-white/[0.1]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-saffron-500/20 text-saffron-300 ring-1 ring-saffron-400/30">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{title}</h4>
                    <p className="mt-0.5 text-xs text-primary-200">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-4 text-xs text-primary-200">
            <span>Smart India Hackathon 2026 Prototype</span>
            <span className="font-mono">v1.0.0 · Synthetic Mode</span>
          </div>
        </aside>

        {/* Main Interaction Area (7 cols) */}
        <main id="main-content" className="flex flex-col justify-center px-4 py-8 sm:px-10 lg:col-span-7 xl:px-16">
          <div className="mx-auto w-full max-w-xl animate-fade-up">
            {/* Mobile Brand Banner */}
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-3">
                <PortalLogo className="h-10 w-10" />
                <div>
                  <span className="font-display text-base font-bold text-primary-900">SIH26265 Portal</span>
                  <p className="text-[11px] text-gray-600 font-medium">FDR & Deposit Management</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                Live Demo
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 border-t-4 border-t-saffron-500 bg-white p-6 shadow-[var(--shadow-card-hover)] sm:p-8">
              <div>
                <h1 className="page-title">Sign In to Portal</h1>
                <p className="page-subtitle">
                  Select a statutory demo role for instant 1-click access, or enter credentials manually.
                </p>
              </div>

              {/* Interactive 1-Click Role Switcher Deck */}
              <div className="mt-6 rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-saffron-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-saffron-600" />
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-primary-900">
                      1-Click Role Personas
                    </span>
                  </div>
                  <span className="rounded-md bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-800">
                    Click to Auto-Login
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <InstitutionPersonaPicker
                    personas={DEMO_PERSONAS.filter((p) => p.role === 'institution_rep')}
                    selectedEmail={activePersonaEmail}
                    disabled={isLoading}
                    onSelect={(p) => handleSelectPersona(p, false)}
                    onLaunch={(p) => handleSelectPersona(p, true)}
                  />
                  {DEMO_PERSONAS.filter((p) => p.role !== 'institution_rep').map((persona) => {
                    const Icon = persona.icon
                    const isSelected = activePersonaEmail === persona.email
                    return (
                      <button
                        key={persona.email}
                        type="button"
                        onClick={() => handleSelectPersona(persona, true)}
                        className={`group relative flex items-start gap-3 rounded-lg p-3 text-left transition-all duration-200 ${
                          isSelected
                            ? 'bg-white shadow-md ring-2 ring-saffron-500'
                            : 'bg-white hover:shadow-sm ring-1 ring-slate-200 hover:ring-primary-300'
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary-800 group-hover:text-white">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold leading-tight text-primary-900">{persona.title}</p>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-saffron-600" />}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-gray-600">{persona.name}</p>
                          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-saffron-700 transition-transform group-hover:translate-x-0.5">
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

                <Button type="submit" size="lg" className="mt-2 w-full" isLoading={isLoading}>
                  <Lock className="mr-2 h-4 w-4" />
                  Sign in with Selected Account
                </Button>
              </form>

              {/* Regulatory Note Card */}
              <div className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-slate-600">
                <div className="shrink-0 rounded-md bg-white p-1.5 text-slate-500 shadow-xs ring-1 ring-emerald-200">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Synthetic Demo Environment</p>
                  <p className="mt-0.5 leading-relaxed text-slate-600">
                    All records, institution profiles, and deposit instruments are synthetic demonstrator models with watermarked documents in compliance with hackathon guidelines.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <div className="gov-tricolor" aria-hidden="true" />
    </div>
  )
}
