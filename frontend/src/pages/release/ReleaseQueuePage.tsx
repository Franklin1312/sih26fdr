import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, Send } from 'lucide-react';
import { releaseApi } from '../../api/release';
import type { ReleaseQueueItem, ReleaseQueueResponse } from '../../types/release';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { CaseStatusBadge } from '../../components/cases/CaseStatusBadge';
import { formatDate, formatCurrency } from '../../utils/helpers';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'release_requested', label: 'Release Requested' },
  { value: 'fdr_rpgf_review', label: 'FDR/RPGF Review' },
  { value: 'rtgs_review', label: 'RTGS Review' },
  { value: 'sd_refund_review', label: 'Security Deposit Review' },
];

export function ReleaseQueuePage() {
  const [data, setData] = useState<ReleaseQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ page: 1, page_size: 10, search: '', status: '' });

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await releaseApi.getQueue(filters);
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load release queue');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void fetchQueue(); }, [fetchQueue]);

  const columns: Column<ReleaseQueueItem>[] = [
    { key: 'case_number', header: 'Case Number', sortable: true, render: (row) => <Link to={`/release/cases/${row.case_id}`} className="font-medium text-primary-600 hover:underline">{row.case_number}</Link> },
    { key: 'institution_name', header: 'Institution', sortable: true },
    { key: 'deposit_type', header: 'Deposit Type', render: (row) => row.deposit_type.replace(/_/g, ' ') },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatCurrency(row.amount) },
    { key: 'status', header: 'Status', render: (row) => <CaseStatusBadge status={row.status} /> },
    { key: 'requested_at', header: 'Requested', render: (row) => formatDate(row.requested_at, 'short') },
    { key: 'deadline_days', header: 'Review Period', render: (row) => `${row.deadline_days} days` },
    { key: 'actions', header: 'Actions', render: (row) => <Link to={`/release/cases/${row.case_id}`}><Button variant="ghost" size="sm">Review</Button></Link> },
  ];

  if (loading && !data) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Send className="h-6 w-6" /> Release Queue</h1>
        <p className="mt-1 text-gray-500">Review and decide pending release requests.</p>
      </header>
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input aria-label="Search release cases" placeholder="Search cases..." value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} className="pl-10" />
          </div>
          <Select aria-label="Filter release status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} options={STATUS_OPTIONS} />
        </div>
        {error && <p className="mb-4 text-sm text-red-600" role="alert">{error}</p>}
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(row) => row.case_id}
          loading={loading}
          emptyMessage="No release requests found."
          pagination={{
            page: data?.page ?? filters.page,
            pageSize: data?.page_size ?? filters.page_size,
            total: data?.total ?? 0,
            onPageChange: (page) => setFilters((current) => ({ ...current, page })),
            onPageSizeChange: (page_size) => setFilters((current) => ({ ...current, page_size, page: 1 })),
          }}
        />
      </section>
    </div>
  );
}
