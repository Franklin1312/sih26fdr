import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ChevronDown, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { CaseStatusBadge } from '../../components/cases/CaseStatusBadge';
import { getStatusLabel, STATUS_ORDER } from '../../components/cases/caseStatus';
import { casesApi } from '../../api/cases';
import type { DepositCaseResponse, CaseStatus } from '../../types/case';
import { formatDate, formatCurrency } from '../../utils/helpers';

const statusOptions = STATUS_ORDER.map(s => ({ value: s, label: getStatusLabel(s) }));
const depositTypeOptions = [
  { value: 'fixed_deposit', label: 'Fixed Deposit' },
  { value: 'recurring_deposit', label: 'Recurring Deposit' },
  { value: 'savings_deposit', label: 'Savings Deposit' },
  { value: 'other', label: 'Other' },
];

export function MyCasesPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<DepositCaseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | ''>('');
  const [depositTypeFilter, setDepositTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        page_size: pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        deposit_type: depositTypeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };
      const response = await casesApi.list(params);
      setCases(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, depositTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const columns: Column<DepositCaseResponse>[] = [
    {
      key: 'case_number',
      header: 'Case #',
      sortable: true,
      width: '120px',
      render: (row) => (
        <Button variant="ghost" size="sm" className="font-mono text-primary-600 hover:text-primary-800 p-0 h-auto justify-start" onClick={(e) => { e.stopPropagation(); navigate(`/cases/${row.id}`); }}>
          #{row.case_number}
        </Button>
      ),
    },
    {
      key: 'tracking_ref',
      header: 'Tracking Ref',
      sortable: true,
      width: '160px',
      render: (row) => row.tracking_ref || <span className="text-gray-400">—</span>,
    },
    {
      key: 'deposit_type',
      header: 'Deposit Type',
      sortable: true,
      width: '160px',
      render: (row) => (
        <Badge variant="outline" className="text-xs capitalize">{row.deposit_type?.replace(/_/g, ' ')}</Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      width: '140px',
      align: 'right',
      render: (row) => <span className="font-medium">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: '180px',
      render: (row) => <CaseStatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      width: '160px',
      render: (row) => formatDate(row.created_at),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '140px',
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/cases/${row.id}`); }} title="View">
            <ArrowRight className="h-4 w-4" />
          </Button>
          {row.status === 'draft' && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/wizard?caseId=${row.id}`); }} title="Continue">
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleFilterChange = () => {
    setPage(1);
  };

  const hasActiveFilters = statusFilter || depositTypeFilter || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Cases</h1>
          <p className="text-gray-500 mt-1">Manage and track your deposit cases</p>
        </div>
        <Button onClick={() => navigate('/wizard')} className="gap-2">
          <Plus className="h-4 w-4" />
          Create New Case
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search cases..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2">
            <Filter className="h-4 w-4" />
            Filters {hasActiveFilters && <Badge variant="secondary" className="ml-1">Active</Badge>}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-gray-200 mb-4">
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as CaseStatus); handleFilterChange(); }}
              options={[{ value: '', label: 'All Statuses' }, ...statusOptions]}
              placeholder="All Statuses"
            />
            <Select
              value={depositTypeFilter}
              onChange={(e) => { setDepositTypeFilter(e.target.value); handleFilterChange(); }}
              options={[{ value: '', label: 'All Types' }, ...depositTypeOptions]}
              placeholder="All Types"
            />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); handleFilterChange(); }}
              placeholder="Date From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); handleFilterChange(); }}
              placeholder="Date To"
            />
          </div>
        )}

        <DataTable
          data={cases}
          columns={columns}
          keyExtractor={(row) => row.id}
          loading={loading}
          emptyMessage="No cases found. Create your first case to get started."
          onRowClick={(row) => navigate(`/cases/${row.id}`)}
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
        />
      </div>
    </div>
  );
}
