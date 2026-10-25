import { useEffect, useState } from 'react'

type FontScale = 'sm' | 'md' | 'lg'

const SCALE_PCT: Record<FontScale, string> = { sm: '90%', md: '100%', lg: '112.5%' }

/** Tricolour line + "Government of India" utility strip (cf. NIP / india.gov.in). */
export function GovTopBar() {
  // Initialise from the live <html> size so the choice survives login → app navigation
  const [scale, setScale] = useState<FontScale>(() => {
    const current = document.documentElement.style.fontSize
    return (Object.keys(SCALE_PCT) as FontScale[]).find((k) => SCALE_PCT[k] === current) ?? 'md'
  })

  useEffect(() => {
    document.documentElement.style.fontSize = SCALE_PCT[scale]
  }, [scale])

  const applyScale = (next: FontScale) => setScale(next)

  const scaleBtn = (key: FontScale, label: string, aria: string) => (
    <button
      type="button"
      onClick={() => applyScale(key)}
      aria-label={aria}
      aria-pressed={scale === key}
      className={`flex h-5 min-w-5 items-center justify-center rounded px-1 text-[11px] font-bold leading-none transition-colors ${
        scale === key
          ? 'bg-primary-900 text-white'
          : 'text-primary-900 ring-1 ring-primary-300 hover:bg-primary-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="h-[var(--gov-strip-h)] bg-white">
      <div className="gov-tricolor" aria-hidden="true" />
      <div className="mx-auto flex h-8 items-center justify-between border-b border-slate-200 bg-[#fbf8f4] px-4 text-[11px] text-slate-700 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary-900">भारत सरकार</span>
          <span className="text-slate-300">|</span>
          <span className="font-medium">Government of India</span>
          <span className="hidden text-slate-300 sm:inline">·</span>
          <span className="hidden sm:inline">AICTE · Ministry of Education</span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="#main-content"
            className="hidden font-medium text-primary-800 underline-offset-2 hover:underline sm:inline"
          >
            Skip to main content
          </a>
          <span className="hidden h-3.5 w-px bg-slate-300 sm:block" aria-hidden="true" />
          <div className="flex items-center gap-1" role="group" aria-label="Text size">
            {scaleBtn('sm', 'A-', 'Decrease text size')}
            {scaleBtn('md', 'A', 'Default text size')}
            {scaleBtn('lg', 'A+', 'Increase text size')}
          </div>
          <span className="hidden h-3.5 w-px bg-slate-300 sm:block" aria-hidden="true" />
          <span className="hidden rounded border border-slate-300 px-1.5 py-px text-[10px] font-bold tracking-wide text-slate-600 sm:inline">
            EN
          </span>
        </div>
      </div>
    </div>
  )
}
