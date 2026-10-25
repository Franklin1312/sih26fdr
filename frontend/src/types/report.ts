export interface ReportCaseRow {
  case_id: string
  case_number: string
  institution_name: string
  instrument_number: string
  amount: number
  status: string
  maturity_date: string | null
  days_to_maturity: number | null
  missing_documents: string[]
  requires_intervention: boolean
  intervention_reason: string | null
}

export interface ReportsSummary {
  generated_at: string
  total_cases: number
  total_amount: number
  pending_verification: number
  upcoming_maturities: number
  missing_documents: number
  requiring_intervention: number
  cases: ReportCaseRow[]
}
