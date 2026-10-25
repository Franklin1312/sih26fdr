import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Building2, Check, ChevronDown, Search } from 'lucide-react'
import type { DemoPersona } from '../../constants/demoPersonas'

interface Props {
  personas: DemoPersona[]
  selectedEmail: string
  disabled?: boolean
  onSelect: (persona: DemoPersona) => void
  onLaunch: (persona: DemoPersona) => void
}

/** Institution Representative demo logins grouped into one searchable dropdown + Launch button. */
export function InstitutionPersonaPicker({ personas, selectedEmail, disabled, onSelect, onLaunch }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = personas.find((p) => p.email === selectedEmail) ?? null
  const isActive = selected !== null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return personas
    return personas.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
  }, [personas, query])

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    searchRef.current?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    setOpen((o) => !o)
    setQuery('')
  }

  const pick = (p: DemoPersona) => {
    onSelect(p)
    setOpen(false)
    setQuery('')
  }

  return (
    <div
      ref={rootRef}
      className={`relative rounded-lg bg-white p-3 transition-all duration-200 sm:col-span-2 ${
        isActive ? 'shadow-md ring-2 ring-saffron-500' : 'ring-1 ring-slate-200'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 sm:w-[7.5rem] sm:shrink-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 sm:hidden">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight text-primary-900">Institution Representative</p>
            <p className="mt-0.5 text-[11px] text-gray-600">{personas.length} institutions</p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-xs shadow-sm transition-colors hover:border-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-60"
          >
            <span className={`truncate ${selected ? 'font-semibold text-primary-900' : 'text-gray-500'}`}>
              {selected ? selected.name : 'Select an institution…'}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-primary-600 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 border-t-[3px] border-t-saffron-500 bg-white shadow-[var(--shadow-pop)]">
              <div className="relative border-b border-slate-100 p-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search institution…"
                  aria-label="Search institutions"
                  className="h-9 w-full rounded-md border border-gray-300 bg-white pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <ul role="listbox" aria-label="Institutions" className="max-h-52 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <li className="px-4 py-3 text-xs text-gray-500">No institutions match “{query}”.</li>
                ) : (
                  filtered.map((p) => {
                    const isSel = p.email === selectedEmail
                    return (
                      <li key={p.email} role="option" aria-selected={isSel}>
                        <button
                          type="button"
                          onClick={() => pick(p)}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-primary-50 ${
                            isSel ? 'bg-primary-50 font-semibold text-primary-900' : 'text-gray-700'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{p.name}</span>
                            <span className="block truncate font-mono text-[10px] text-gray-500">{p.email}</span>
                          </span>
                          {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-saffron-600" />}
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={disabled || !selected}
          onClick={() => selected && onLaunch(selected)}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-saffron-600 px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-saffron-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          Launch <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
