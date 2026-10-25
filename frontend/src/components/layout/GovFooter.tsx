import { ShieldCheck } from 'lucide-react'

export function GovFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="gov-tricolor" aria-hidden="true" />
      <div className="bg-primary-950 text-primary-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-saffron-400" aria-hidden="true" />
            <div>
              <p className="font-semibold text-white">Deposit &amp; FDR Portal · SIH26265</p>
              <p className="text-primary-200/80">
                Designed for AICTE APH Clause 6.46 · Synthetic demonstration environment
              </p>
            </div>
          </div>
          <div className="text-primary-200/80 sm:text-right">
            <p>Smart India Hackathon 2026 prototype</p>
            <p className="font-mono text-[11px]">v1.0.0 · Synthetic Mode</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
