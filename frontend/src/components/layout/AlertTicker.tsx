import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { casesApi } from '../../api'

/**
 * "LIVE" ribbon (cf. the NIP "Recently Posted" bar). Reads the same alerts query as the
 * header bell (same query key → shared cache, no extra request).
 */
export function AlertTicker() {
  const navigate = useNavigate()
  const { data: alerts = [] } = useQuery({
    queryKey: ['system-alerts'],
    queryFn: () => casesApi.getAlerts(),
    refetchInterval: 30000,
  })

  const visible = alerts.slice(0, 4)

  return (
    <div className="mb-6 flex items-center gap-3 overflow-hidden rounded-full border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-white to-saffron-50 px-3 py-1.5 shadow-[var(--shadow-card)]">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-saffron-700 ring-1 ring-saffron-200">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-saffron-500" />
        LIVE
      </span>
      <span className="hidden shrink-0 text-xs font-semibold text-primary-900 sm:inline">
        Regulatory Alerts
        <ChevronRight className="ml-0.5 inline h-3.5 w-3.5 text-primary-500" aria-hidden="true" />
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.length > 0 ? (
          visible.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate(`/cases/${a.case_id}`)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold ring-1 transition-colors hover:bg-primary-50 ${
                a.severity === 'critical'
                  ? 'text-rose-700 ring-rose-200'
                  : a.severity === 'warning'
                  ? 'text-saffron-800 ring-saffron-200'
                  : 'text-primary-800 ring-primary-200'
              }`}
              title={a.message}
            >
              <span className="font-mono">{a.case_number}</span>
              <span className="max-w-[220px] truncate font-medium text-slate-600">{a.title}</span>
            </button>
          ))
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            All FDR instruments and security deposits are currently compliant
          </span>
        )}
      </div>
    </div>
  )
}
