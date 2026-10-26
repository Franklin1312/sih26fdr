import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  FileText,
  Calendar,
  Users,
  Bell,
  ArrowRight,
  ShieldCheck,
  Check,
  Building2,
  ChevronDown,
  Sparkles,
  Search,
  Scale,
  Award,
  Landmark,
  Settings,
  Lock,
  ExternalLink,
  HelpCircle,
  Megaphone,
  CheckCircle2,
  BarChart3,
  Layers,
  History,
  FileCheck2,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { DEMO_PERSONAS, type DemoPersona } from '../constants/demoPersonas'
import { toast } from 'sonner'

export function LandingPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'submission' | 'scrutiny' | 'clearance' | 'release' | 'audit'>('submission')
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false)
  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false)
  const [workflowDropdownOpen, setWorkflowDropdownOpen] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [updatesModalOpen, setUpdatesModalOpen] = useState(false)
  const [loggingInEmail, setLoggingInEmail] = useState<string | null>(null)
  const workflowSectionRef = useRef<HTMLDivElement>(null)
  const personasSectionRef = useRef<HTMLDivElement>(null)

  const handleQuickLogin = async (persona: DemoPersona) => {
    setLoggingInEmail(persona.email)
    try {
      await login(persona.email, 'demo12345')
      toast.success(`Logged in as ${persona.title} (${persona.name})`)
      navigate(persona.landingPath)
    } catch {
      // fallback for dev environments
      try {
        await login(persona.email, 'demo')
        toast.success(`Logged in as ${persona.title}`)
        navigate(persona.landingPath)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Login failed')
      }
    } finally {
      setLoggingInEmail(null)
    }
  }

  const scrollToWorkflows = () => {
    workflowSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToPersonas = () => {
    personasSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-slate-800 font-sans selection:bg-amber-200 selection:text-amber-900">
      {/* 1. TOP UTILITY STRIP (Gov of India / Tricolor line) */}
      <div className="bg-white border-b border-slate-200">
        <div className="h-1 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">🇮🇳</span>
            <span className="font-semibold text-slate-900">AICTE Nexus</span>
            <span className="text-slate-300">|</span>
            <span className="font-medium text-slate-700">Approval Workflow & Compliance Portal</span>
            <span className="hidden md:inline text-slate-400">· Ministry of Education, Govt. of India</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setUpdatesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60 font-medium transition-colors"
            >
              <Megaphone className="h-3 w-3 text-rose-600" />
              <span>Important updates</span>
            </button>

            <button
              onClick={() => setHelpModalOpen(true)}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              <HelpCircle className="h-3 w-3 text-slate-400" />
              <span>Help & Support</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            <span className="h-3.5 w-px bg-slate-200" />
            <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 bg-slate-50">
              EN
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo & Portal Identity */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="h-11 w-11 rounded-full bg-[#1b2b48] flex items-center justify-center text-amber-400 shadow-sm border border-slate-700 group-hover:scale-105 transition-transform">
              <Landmark className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-amber-700 transition-colors">
                  AICTE 
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  FDR Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-tight hidden sm:block">
                Approval Workflow Automation, Compliance Monitoring & Alert Management
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-[13.5px] font-medium text-slate-700">
            <a
              href="#home"
              className="px-3.5 py-2 text-amber-700 font-semibold border-b-2 border-amber-600 transition-colors"
            >
              Home
            </a>

            {/* Explore Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setExploreDropdownOpen(!exploreDropdownOpen)
                  setWorkflowDropdownOpen(false)
                }}
                className="flex items-center gap-1 px-3 py-2 text-slate-700 hover:text-amber-700 hover:bg-slate-50 rounded-md transition-colors"
              >
                <span>Explore</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {exploreDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Deposit Frameworks
                  </div>
                  <button
                    onClick={() => {
                      setExploreDropdownOpen(false)
                      scrollToWorkflows()
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900 flex items-center justify-between"
                  >
                    <span>Security Deposits & FDR</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                  </button>
                  <button
                    onClick={() => {
                      setExploreDropdownOpen(false)
                      scrollToWorkflows()
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900 flex items-center justify-between"
                  >
                    <span>Clause 6.46 Compliance Rules</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                  </button>
                  <button
                    onClick={() => {
                      setExploreDropdownOpen(false)
                      scrollToWorkflows()
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900 flex items-center justify-between"
                  >
                    <span>Cryptographic Audit Trail</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                  </button>
                </div>
              )}
            </div>

            {/* Approval Workflow Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setWorkflowDropdownOpen(!workflowDropdownOpen)
                  setExploreDropdownOpen(false)
                }}
                className="flex items-center gap-1 px-3 py-2 text-slate-700 hover:text-amber-700 hover:bg-slate-50 rounded-md transition-colors"
              >
                <span>Approval Workflow</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {workflowDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Workflow Stages
                  </div>
                  <button
                    onClick={() => {
                      setWorkflowDropdownOpen(false)
                      setActiveTab('submission')
                      scrollToWorkflows()
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                  >
                    1. Deposit Case Registration
                  </button>
                  <button
                    onClick={() => {
                      setWorkflowDropdownOpen(false)
                      setActiveTab('scrutiny')
                      scrollToWorkflows()
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                  >
                    2. Scrutiny & Bank Verification
                  </button>
                  <button
                    onClick={() => {
                      setWorkflowDropdownOpen(false)
                      setActiveTab('clearance')
                      scrollToWorkflows()
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                  >
                    3. Multi-Cell Clearance (PGRC/Vigilance)
                  </button>
                  <button
                    onClick={() => {
                      setWorkflowDropdownOpen(false)
                      setActiveTab('release')
                      scrollToWorkflows()
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                  >
                    4. Authority Release & Sanction
                  </button>
                </div>
              )}
            </div>

            <a
              href="#compliance"
              onClick={(e) => {
                e.preventDefault()
                scrollToWorkflows()
              }}
              className="px-3 py-2 text-slate-700 hover:text-amber-700 hover:bg-slate-50 rounded-md transition-colors"
            >
              Compliance
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={scrollToWorkflows}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all shadow-2xs"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Explore portal</span>
            </button>

            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1b2b48] text-white hover:bg-[#253b64] text-xs font-semibold shadow-sm transition-all"
              >
                <span>Dashboard ({(user as any).full_name?.split(' ')[0] || (user as any).name?.split(' ')[0] || user.email?.split('@')[0] || 'User'})</span>
                <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
              </Link>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1b2b48] text-white hover:bg-[#253b64] text-xs font-semibold shadow-sm transition-all"
                >
                  <Lock className="h-3 w-3 text-amber-400" />
                  <span>Login</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>

                {loginDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                      <span className="text-xs font-semibold text-slate-900">Quick Persona Login</span>
                      <Link
                        to="/login"
                        className="text-[11px] text-amber-700 font-semibold hover:underline"
                        onClick={() => setLoginDropdownOpen(false)}
                      >
                        Standard Login →
                      </Link>
                    </div>
                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                      {DEMO_PERSONAS.slice(0, 6).map((persona) => {
                        const Icon = persona.icon
                        return (
                          <button
                            key={persona.email}
                            onClick={() => {
                              setLoginDropdownOpen(false)
                              handleQuickLogin(persona)
                            }}
                            disabled={loggingInEmail === persona.email}
                            className="w-full text-left p-2 rounded-lg hover:bg-amber-50/80 border border-transparent hover:border-amber-200 transition-all flex items-center gap-2.5 group"
                          >
                            <div className="p-1.5 rounded-md bg-slate-100 text-slate-600 group-hover:bg-amber-100 group-hover:text-amber-800">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">{persona.title}</p>
                              <p className="text-[10px] text-slate-500 truncate">{persona.name}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <div className="pt-2 border-t border-slate-100 mt-2 text-center">
                      <button
                        onClick={() => {
                          setLoginDropdownOpen(false)
                          scrollToPersonas()
                        }}
                        className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center justify-center gap-1 w-full"
                      >
                        <span>View all 9 demo accounts</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 3. CAPABILITIES SUBHEADER TICKER (Matching reference layout) */}
      <div className="bg-[#fcf8f2] border-b border-[#ebdcc8]/80 py-2.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fbe7d5] text-[#b4480d] text-[11px] font-bold uppercase tracking-wider border border-[#f3cca8]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e06216]" />
              Workflow
            </span>

            <span className="font-semibold text-slate-700 hidden sm:inline">
              Platform capabilities →
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => {
                  setActiveTab('submission')
                  scrollToWorkflows()
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-amber-300 text-slate-700 font-medium hover:bg-amber-50/50 transition-colors shadow-2xs"
              >
                <FileText className="h-3.5 w-3.5 text-emerald-600" />
                <span>Application Workflow</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('scrutiny')
                  scrollToWorkflows()
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-amber-300 text-slate-700 font-medium hover:bg-amber-50/50 transition-colors shadow-2xs"
              >
                <Calendar className="h-3.5 w-3.5 text-amber-600" />
                <span>Compliance Monitoring</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('clearance')
                  scrollToWorkflows()
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-amber-300 text-slate-700 font-medium hover:bg-amber-50/50 transition-colors shadow-2xs"
              >
                <Users className="h-3.5 w-3.5 text-blue-600" />
                <span>Multi-Cell Clearance</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('release')
                  scrollToWorkflows()
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-amber-300 text-slate-700 font-medium hover:bg-amber-50/50 transition-colors shadow-2xs"
              >
                <Bell className="h-3.5 w-3.5 text-rose-600" />
                <span>Alerts & Escalations</span>
              </button>
            </div>
          </div>

          <button
            onClick={scrollToWorkflows}
            className="hidden lg:inline-flex items-center gap-1 text-slate-600 hover:text-amber-800 font-semibold"
          >
            <span>Explore all capabilities</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* 4. HERO SECTION (Direct replica of reference image with Rashtrapati Bhavan architecture & flowing tricolor silk drapes) */}
      <section
        id="home"
        className="relative bg-cover bg-center bg-no-repeat overflow-hidden pt-12 pb-24 lg:pt-16 lg:pb-32"
        style={{
          backgroundImage: `url('/landing-hero-bg.jpg')`,
        }}
      >
        {/* Soft atmospheric overlay for high readability while keeping the architecture visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/55 to-white/90 backdrop-blur-[1px]" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Pill Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 border border-slate-200/90 shadow-2xs mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              APPROVAL WORKFLOW | COMPLIANCE MONITORING
            </span>
          </div>

          {/* Main Hero Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-slate-900 mb-5">
            Streamlined Approvals.
            <br />
            <span className="text-[#e06216] drop-shadow-2xs">
              Stronger Higher Education.
            </span>
          </h1>

          {/* Subtitle & Explanatory Description */}
          <p className="text-base sm:text-lg font-semibold text-slate-800 max-w-3xl mx-auto mb-3 leading-relaxed">
            A unified workspace for AICTE approval workflows, institutional compliance, pendency monitoring and alert management.
          </p>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto mb-8 leading-normal font-medium">
            Track application stages, coordinate scrutiny and multi-cell clearance activities, monitor compliance milestones under Clause 6.46, and keep administrative follow-ups visible in one workspace.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-8">
            <button
              onClick={scrollToWorkflows}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#e06216] to-[#f57c00] text-white font-bold text-sm shadow-md hover:shadow-lg hover:from-[#c85410] hover:to-[#e06216] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <FileCheck2 className="h-4 w-4 text-amber-100" />
              <span>Explore Workflows</span>
            </button>

            <button
              onClick={scrollToPersonas}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#1b2b48] text-white font-bold text-sm shadow-md hover:bg-[#253b64] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <span>Access Workspace</span>
            </button>
          </div>

          {/* Trust Row with Checkmarks */}
          <div className="flex items-center justify-center flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">
                <Check className="h-3 w-3" />
              </span>
              Role-based access
            </span>

            <span className="inline-flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">
                <Check className="h-3 w-3" />
              </span>
              Deadline visibility
            </span>

            <span className="inline-flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">
                <Check className="h-3 w-3" />
              </span>
              Traceable actions
            </span>

            <span className="inline-flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">
                <Check className="h-3 w-3" />
              </span>
              Cryptographic audit log
            </span>
          </div>
        </div>
      </section>

      {/* 5. FLOATING BOTTOM FEATURE CARDS ROW (Matching bottom of reference layout) */}
      <div className="relative -mt-10 sm:-mt-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-5 sm:p-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {/* Card 1: Application workflow */}
            <div
              onClick={() => {
                setActiveTab('submission')
                scrollToWorkflows()
              }}
              className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                    Application workflow
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Section-by-section form submission with instant schema validation and evidence uploads.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Compliance monitoring */}
            <div
              onClick={() => {
                setActiveTab('scrutiny')
                scrollToWorkflows()
              }}
              className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-amber-300 hover:bg-amber-50/30 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                    Compliance monitoring
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Real-time tracking of institutional compliance requirements and Clause 6.46 milestones.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Multi-Cell Clearance */}
            <div
              onClick={() => {
                setActiveTab('clearance')
                scrollToWorkflows()
              }}
              className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-800 transition-colors">
                    Multi-Cell Clearance
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Independent PGRC, Vigilance & Technical clearances coordinated in parallel with SLA tracking.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Alerts & escalations */}
            <div
              onClick={() => {
                setActiveTab('release')
                scrollToWorkflows()
              }}
              className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-rose-300 hover:bg-rose-50/30 transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-rose-100/80 text-rose-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-rose-800 transition-colors">
                    Alerts & escalations
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Maturity warnings, SLA tracking and automated reminder notifications across personas.
                  </p>
                </div>
              </div>

              <div className="h-9 w-9 rounded-full bg-gradient-to-r from-[#e06216] to-[#f57c00] text-white flex items-center justify-center shrink-0 shadow-sm ml-2 group-hover:scale-110 transition-transform">
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. INTERACTIVE WORKFLOW VISUALIZER SECTION */}
      <section ref={workflowSectionRef} className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100/80 px-3 py-1 rounded-full border border-amber-200">
            End-to-End Governance
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
            How the FDR & Security Deposit Lifecycle Works
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Every step is protected by role-gated permissions, OCR verification, and an immutable cryptographic audit trail.
          </p>
        </div>

        {/* Workflow Tabs */}
        <div className="flex items-center justify-center flex-wrap gap-2 mb-8">
          {[
            { id: 'submission', label: '1. Deposit Registration', icon: FileText },
            { id: 'scrutiny', label: '2. Scrutiny & OCR', icon: Search },
            { id: 'clearance', label: '3. Multi-Cell Clearance', icon: Scale },
            { id: 'release', label: '4. Release & Sanctions', icon: Award },
            { id: 'audit', label: '5. Cryptographic Audit', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#1b2b48] text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Detail Cards */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-10">
          {activeTab === 'submission' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Step 01</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">Multi-Step Deposit Registration Wizard</h3>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Institutions register their Security Deposit, Fixed Deposit Receipt (FDR), RPGF, or RTGS payment using a structured, 4-step wizard.
                </p>
                <ul className="mt-4 space-y-2.5 text-xs text-slate-700 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Real-time bank receipt validation and FDR maturity date verification</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Clause 6.46 circumstances declarations (progressive closure, deemed university)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Evidence upload with in-browser preview, zoom, rotation, and SHA-256 integrity check</span>
                  </li>
                </ul>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => {
                      const rep = DEMO_PERSONAS.find((p) => p.role === 'institution_rep')!
                      handleQuickLogin(rep)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors"
                  >
                    <span>Test as Institution Rep</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <span className="text-xs font-bold text-slate-700">Submission Checklist</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Validated</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>FDR Certificate / Bank Receipt</span>
                    <span className="text-emerald-600 font-bold">Uploaded & Hashed</span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>Statutory AICTE Joint Account Declaration</span>
                    <span className="text-emerald-600 font-bold">Verified</span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>Clause 6.46 Clean Record Attestation</span>
                    <span className="text-emerald-600 font-bold">Confirmed</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scrutiny' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Step 02</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">Scrutiny Review & OCR Metadata Extraction</h3>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Designated scrutiny officers verify the submitted instruments, check OCR-extracted data against institutional claims, and initiate clarification workflows when needed.
                </p>
                <ul className="mt-4 space-y-2.5 text-xs text-slate-700 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Automated OCR parsing of FDR receipt numbers, dates, and amounts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Simulated SFMS / Bank confirmation checks for discrepancies</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Two-way clarification messaging with document version replacements</span>
                  </li>
                </ul>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => {
                      const scrutiny = DEMO_PERSONAS.find((p) => p.role === 'scrutiny_officer')!
                      handleQuickLogin(scrutiny)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 transition-colors"
                  >
                    <span>Test as Scrutiny Officer</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <span className="text-xs font-bold text-slate-700">OCR Extraction Verification</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">98.4% Confidence</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Extracted Instrument Number:</span>
                    <span className="font-mono font-semibold text-slate-900">FDR/2026/89410</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Issuing Bank:</span>
                    <span className="font-semibold text-slate-900">State Bank of India</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Maturity Date:</span>
                    <span className="font-semibold text-slate-900">10 Years Term (Active)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Bank Verification Match:</span>
                    <span className="text-emerald-700 font-bold">Confirmed Consistent</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clearance' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Step 03</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">Multi-Cell Independent Clearance</h3>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Before any deposit can be cleared for release, three independent regulatory bodies must conduct separate investigations and file clear reports with evidence:
                </p>
                <div className="mt-4 space-y-2.5 text-xs text-slate-700 font-medium">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="font-semibold">1. Public Grievance Redressal Cell (PGRC)</span>
                    <span className="text-blue-700 font-bold">Independent Officer</span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="font-semibold">2. Vigilance Bureau</span>
                    <span className="text-blue-700 font-bold">Independent Officer</span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="font-semibold">3. Technical Cell / Bureau</span>
                    <span className="text-blue-700 font-bold">Independent Officer</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => {
                      const cl1 = DEMO_PERSONAS.find((p) => p.email === 'clearance_1@demo.example')!
                      handleQuickLogin(cl1)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 transition-colors"
                  >
                    <span>Test as Clearance Officer (PGRC)</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <span className="text-xs font-bold text-slate-700">Clearance Status Progression</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">All Required</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The system enforces strict gatekeeping: only when <strong>all three</strong> cells have cleared their respective tasks does the case state transition to <code>CLEARED</code> and become eligible for release requests.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'release' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Step 04</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">Authority Release & Sanction Order</h3>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  The Competent Authority evaluates release requests against statutory checklists and Clause 6.46 conditions, generating official output documents.
                </p>
                <ul className="mt-4 space-y-2.5 text-xs text-slate-700 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>FDR/RPGF releases issue simulated <strong>Approval Bureau NOC</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>RTGS direct refunds issue simulated <strong>Council Sanction Orders</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Clear disclaimer: the portal never claims funds have moved automatically</span>
                  </li>
                </ul>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => {
                      const auth = DEMO_PERSONAS.find((p) => p.role === 'competent_authority')!
                      handleQuickLogin(auth)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1b2b48] text-white text-xs font-bold hover:bg-[#253b64] transition-colors"
                  >
                    <span>Test as Competent Authority</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <span className="text-xs font-bold text-slate-700">Clause 6.46 Checklist Gates</span>
                  <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded">Configurable</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex justify-between">
                    <span>External Financial Embezzlement Check</span>
                    <span className="text-emerald-600 font-bold">Passed</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex justify-between">
                    <span>Progressive Closure Audit</span>
                    <span className="text-emerald-600 font-bold">Passed</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex justify-between">
                    <span>Deemed University Transition Check</span>
                    <span className="text-emerald-600 font-bold">Passed</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Step 05</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">Cryptographic Hash Chaining & Audit Log</h3>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Every user interaction, state transition, and document upload computes a SHA-256 cryptographic hash chained to the preceding log record.
                </p>
                <ul className="mt-4 space-y-2.5 text-xs text-slate-700 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>Deterministic hashing (prev_hash + entity + action + actor + timestamp)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>Automated tamper detection: any database modification breaks hash continuity</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>Periodic checkpoint signing for institutional legal non-repudiation</span>
                  </li>
                </ul>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => {
                      const admin = DEMO_PERSONAS.find((p) => p.role === 'system_admin')!
                      handleQuickLogin(admin)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-700 text-white text-xs font-bold hover:bg-indigo-800 transition-colors"
                  >
                    <span>Inspect as System Admin</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 font-mono text-xs overflow-x-auto border border-slate-800">
                <div className="text-emerald-400 font-bold mb-2"># Cryptographic Hash Chain Block</div>
                <div className="text-slate-400 text-[11px] mb-2">Sequence: #4812 · Action: CLEARANCE_ALL_CLEARED</div>
                <div className="text-[11px] text-amber-300 break-all mb-2">
                  Hash: 7a8f192b03c89e21...e549d8c0b29a14
                </div>
                <div className="text-[11px] text-slate-400 break-all mb-4">
                  Prev: 3b1a82e99d45f012...890aef432176bc
                </div>
                <div className="text-[11px] text-emerald-400">✓ Chain Integrity: 100% Validated (0 Tampered)</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 7. ALL 9 DEMO PERSONAS QUICK ACCESS SECTION */}
      <section ref={personasSectionRef} className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Interactive Demonstration
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
              Access the Workspace by Persona
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Select any role below to launch the simulated workflow environment with dedicated permissions and test datasets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_PERSONAS.map((persona) => {
              const Icon = persona.icon
              const isLoggingIn = loggingInEmail === persona.email
              return (
                <div
                  key={persona.email}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all bg-[#faf8f5]/60 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-amber-700 group-hover:border-amber-300 transition-colors shadow-2xs">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                        {persona.role.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm">{persona.title}</h3>
                    <p className="text-xs text-amber-800 font-semibold mt-0.5">{persona.name}</p>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">{persona.description}</p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-400 truncate max-w-[170px]">
                      {persona.email}
                    </span>
                    <button
                      onClick={() => handleQuickLogin(persona)}
                      disabled={isLoggingIn}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1b2b48] text-white hover:bg-[#253b64] text-xs font-semibold shadow-2xs transition-colors shrink-0"
                    >
                      <span>{isLoggingIn ? 'Logging in...' : 'Enter Portal'}</span>
                      <ArrowRight className="h-3 w-3 text-amber-400" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 8. OFFICIAL FOOTER */}
      <footer className="bg-[#1b2b48] text-slate-300 pt-12 pb-8 border-t-4 border-[#e06216]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-700/80">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 border border-slate-600">
                  <Landmark className="h-5 w-5 text-amber-400" />
                </div>
                <span className="text-lg font-bold text-white tracking-tight">AICTE Portal</span>
              </div>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                All India Council for Technical Education (AICTE) — Statutory body under Ministry of Education, Government of India. Modelling digital security deposit workflows, FDR verification, and Clause 6.46 compliance.
              </p>
              <div className="mt-4 text-[11px] text-amber-400/90 font-medium">
                Synthetic Demonstration Portal · Smart India Hackathon (SIH 2026)
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Quick Navigation</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <button onClick={scrollToWorkflows} className="hover:text-amber-400 transition-colors">
                    Application Workflow
                  </button>
                </li>
                <li>
                  <button onClick={scrollToWorkflows} className="hover:text-amber-400 transition-colors">
                    Compliance Monitoring
                  </button>
                </li>
                <li>
                  <button onClick={scrollToWorkflows} className="hover:text-amber-400 transition-colors">
                    Multi-Cell Clearance
                  </button>
                </li>
                <li>
                  <button onClick={scrollToPersonas} className="hover:text-amber-400 transition-colors">
                    Demo Accounts
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Governance & Support</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>AICTE Regulations 2026</li>
                <li>Approval Process Handbook (APH)</li>
                <li>Clause 6.46 Guidelines</li>
                <li>Cryptographic Audit Verification</li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
            <div>
              © 2026 AICTE · Ministry of Education, Government of India. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Audit Disclosures</span>
            </div>
          </div>
        </div>
      </footer>

      {/* UPDATES MODAL */}
      {updatesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 mb-3 text-rose-700">
              <Megaphone className="h-5 w-5" />
              <h3 className="font-bold text-slate-900 text-base">Important Portal Updates</h3>
            </div>
            <div className="space-y-3 text-xs text-slate-600 mb-6">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900">Clause 6.46 Checklist Active</span>
                <p className="mt-1">All FDR and RTGS release applications must pass the 4 statutory checklist conditions before NOC generation.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900">Tri-Cell Clearance Separation</span>
                <p className="mt-1">PGRC, Vigilance, and Technical bureaus now operate independently with dedicated officer queues.</p>
              </div>
            </div>
            <button
              onClick={() => setUpdatesModalOpen(false)}
              className="w-full py-2 bg-[#1b2b48] text-white rounded-lg text-xs font-bold hover:bg-[#253b64] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* HELP MODAL */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 mb-3 text-blue-700">
              <HelpCircle className="h-5 w-5" />
              <h3 className="font-bold text-slate-900 text-base">Help & Support Desk</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              For assistance regarding security deposit submissions, FDR verification, or scrutiny reviews, consult the demo personas or trigger an audit chain verification test.
            </p>
            <div className="space-y-2 text-xs mb-6">
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500">Helpline:</span>
                <span className="font-semibold text-slate-800">1800-11-AICTE</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500">Email:</span>
                <span className="font-semibold text-slate-800">support-fdr@aicte-india.org</span>
              </div>
            </div>
            <button
              onClick={() => setHelpModalOpen(false)}
              className="w-full py-2 bg-[#1b2b48] text-white rounded-lg text-xs font-bold hover:bg-[#253b64] transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
