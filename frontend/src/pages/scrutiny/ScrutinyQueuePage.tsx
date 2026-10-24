import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { scrutinyApi } from '../../api/scrutiny';
import type { ScrutinyQueueResponse, ScrutinyStats } from '../../types/scrutiny';
import type { CaseStatus, DepositCaseResponse } from '../../types/case';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Search, Loader2 } from 'lucide-react';
import { formatDate } from '../../utils/helpers';
import { CaseStatusBadge } from '../../components/cases/CaseStatusBadge';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_scrutiny', label: 'Under Scrutiny' },
  { value: 'clarification_pending', label: 'Clarification Pending' },
  { value: 'clearance_queue', label: 'Clearance Queue' },
];

export function ScrutinyQueuePage() {
  const [data, setData] = useState<ScrutinyQueueResponse | null>(null);
  const [stats, setStats] = useState<ScrutinyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    page_size: 10,
    search: '',
    status: '',
  });

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [queueRes, statsRes] = await Promise.all([
        scrutinyApi.getQueue(filters),
        scrutinyApi.getStats(),
      ]);
      setData(queueRes);
      setStats(statsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load scrutiny queue');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const columns: Column<DepositCaseResponse>[] = [
    {
      key: 'case_number',
      header: 'Case Number',
      render: (row) => (
        <Link
          to={`/scrutiny/cases/${row.id}`}
          className="text-primary-600 hover:underline font-medium"
        >
          {row.case_number}
        </Link>
      ),
    },
    {
      key: 'institution_id',
      header: 'Institution',
      render: (row) => row.institution_id,
    },
    {
      key: 'deposit_type',
      header: 'Deposit Type',
      render: (row) => row.deposit_type?.replace(/_/g, ' ') || '—',
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => `${row.amount?.toLocaleString() || '0'} ${row.currency || ''}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <CaseStatusBadge status={row.status as CaseStatus} />,
    },
    {
      key: 'assigned_officer_id',
      header: 'Assigned Officer',
      render: (row) => (row.assigned_officer_id ? 'Assigned' : 'Unassigned'),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (row) => formatDate(row.created_at, 'short'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <Link to={`/scrutiny/cases/${row.id}`}>
            <Button variant="ghost" size="sm">View</Button>
          </Link>
          {row.assigned_officer_id ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleUnassign(row.id)}
              disabled={loading}
            >
              Unassign
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleAssign(row.id)}
              disabled={loading}
            >
              Assign to Me
            </Button>
          )}
        </div>
      ),
    },
  ];

  const handleAssign = async (caseId: string) => {
    try {
      await scrutinyApi.assignCase(caseId);
      fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to assign case');
    }
  };

  const handleUnassign = async (caseId: string) => {
    try {
      await scrutinyApi.unassignCase(caseId);
      fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to unassign case');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scrutiny Workbench</h1>
          <p className="text-gray-500 mt-1">Review and process submitted cases</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500">Total Assigned</p>
            <p className="text-2xl font-bold text-primary-600">{stats.total_assigned}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500">Unassigned</p>
            <p className="text-2xl font-bold text-orange-600">{stats.submitted_unassigned}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500">Clarification Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.clarification_pending}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500">Total Cases</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total_cases}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search cases..."
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
              className="pl-10"
            />
          </div>
          <Select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
            options={STATUS_OPTIONS}
            className="w-full md:w-48"
            placeholder="Filter by status"
          />
        </div>

        {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}

        <DataTable
          columns={columns}
          data={data?.items || []}
          keyExtractor={(row) => row.id}
          loading={loading}
          pagination={{
            page: data?.page || 1,
            pageSize: data?.page_size || 10,
            total: data?.total || 0,
            onPageChange: (page) => setFilters((prev) => ({ ...prev, page })),
            onPageSizeChange: (page_size) => setFilters((prev) => ({ ...prev, page_size, page: 1 })),
          }}
          emptyMessage="No cases found"
        />
      </div>
    </div>
  );
}
