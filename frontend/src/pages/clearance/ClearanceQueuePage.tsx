import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Loader2, Search } from 'lucide-react';
import { clearanceApi } from '../../api/clearance';
import type { ClearanceQueueResponse, ClearanceQueueItem, ClearanceStatus } from '../../types/clearance';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../utils/helpers';

const CLEARANCE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'financial', label: 'Financial' },
  { value: 'legal', label: 'Legal' },
  { value: 'technical', label: 'Technical' },
  { value: 'environmental', label: 'Environmental' },
];

const TASK_STATUSES: Record<ClearanceStatus, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Pending', variant: 'default' },
  claimed: { label: 'Claimed', variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  cleared: { label: 'Cleared', variant: 'success' },
  completed: { label: 'Cleared', variant: 'success' },
  flagged: { label: 'Flagged', variant: 'danger' },
  rejected: { label: 'Rejected', variant: 'danger' },
};

export function ClearanceQueuePage() {
  const [data, setData] = useState<ClearanceQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  const [filters, setFilters] = useState({ page: 1, page_size: 10, search: '', clearance_type: '', status: '' });

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await clearanceApi.getQueue({ ...filters, my_tasks_only: activeTab === 'mine' });
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load clearance queue');
    } finally {
      setLoading(false);
    }
  }, [filters, activeTab]);

  useEffect(() => {
    // Refresh the queue when its filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchQueue();
  }, [fetchQueue]);

  const columns: Column<ClearanceQueueItem>[] = [
    {
      key: 'case_number',
      header: 'Case Number',
      sortable: true,
      render: (row) => <span className="font-medium text-primary-700">{row.case_number}</span>,
    },
    { key: 'institution_name', header: 'Institution', sortable: true },
    { key: 'deposit_type', header: 'Deposit Type', render: (row) => row.deposit_type.replace(/_/g, ' ') },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatCurrency(row.amount) },
    { key: 'submitted_at', header: 'Submitted', render: (row) => row.submitted_at ? formatDate(row.submitted_at, 'short') : '—' },
    {
      key: 'tasks',
      header: 'Tasks',
      render: (row) => <div className="flex flex-wrap gap-1">{row.clearance_tasks.map((task) => {
        const status = TASK_STATUSES[task.status];
        return <Badge key={task.id} variant={status.variant}>{status.label}</Badge>;
      })}</div>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => row.clearance_tasks[0]
        ? <Link to={`/clearance/tasks/${row.case_id}`}><Button variant="ghost" size="sm">Open task</Button></Link>
        : <span className="text-sm text-gray-500">No tasks</span>,
    },
  ];

  if (loading && !data) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Briefcase className="h-6 w-6" /> Clearance Queue</h1>
        <p className="mt-1 text-gray-500">Review and complete clearance tasks.</p>
      </header>
      <Tabs.Root value={activeTab} defaultValue="all" onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <Tabs.List>
          <Tabs.Trigger value="all">All cases</Tabs.Trigger>
          <Tabs.Trigger value="mine">My tasks</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value={activeTab}>
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 md:flex-row">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input aria-label="Search clearance cases" placeholder="Search cases..." value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} className="pl-10" />
              </div>
              <Select aria-label="Filter clearance type" value={filters.clearance_type} onChange={(event) => setFilters((current) => ({ ...current, clearance_type: event.target.value, page: 1 }))} options={CLEARANCE_TYPES} />
              <Select aria-label="Filter task status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} options={[{ value: '', label: 'All Statuses' }, ...Object.entries(TASK_STATUSES).map(([value, status]) => ({ value, label: status.label }))]} />
            </div>
            {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
            <DataTable
              data={data?.items ?? []}
              columns={columns}
              keyExtractor={(row) => row.case_id}
              loading={loading}
              emptyMessage="No clearance cases found."
              pagination={{
                page: data?.page ?? filters.page,
                pageSize: data?.page_size ?? filters.page_size,
                total: data?.total ?? 0,
                onPageChange: (page) => setFilters((current) => ({ ...current, page })),
                onPageSizeChange: (page_size) => setFilters((current) => ({ ...current, page_size, page: 1 })),
              }}
            />
          </section>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
