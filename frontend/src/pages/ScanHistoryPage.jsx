import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  GitCommit,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import Card, { CardHeader, CardBody } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import scanService from '../services/scanService';

export function ScanHistoryPage() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters and Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [decisionFilter, setDecisionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchInput, setBranchInput] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Handle branch search debounce or trigger
  const handleBranchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setBranchFilter(branchInput.trim());
  };

  const handleResetFilters = () => {
    setDecisionFilter('');
    setStatusFilter('');
    setBranchInput('');
    setBranchFilter('');
    setPage(1);
  };

  useEffect(() => {
    let isMounted = true;
    async function loadScans() {
      try {
        setLoading(true);
        const params = { page, limit };
        if (decisionFilter) params.decision = decisionFilter;
        if (statusFilter) params.status = statusFilter;
        if (branchFilter) params.branch = branchFilter;

        const res = await scanService.getScans(params);
        if (isMounted) {
          setScans(res?.scans || []);
          setPagination(res?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load scans.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadScans();
    return () => {
      isMounted = false;
    };
  }, [page, limit, decisionFilter, statusFilter, branchFilter]);

  const hasActiveFilters = Boolean(decisionFilter || statusFilter || branchFilter);

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Pipeline Scan History
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete server-paginated audit trail of all security evaluations ingested from CI/CD runners
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-12 md:items-center">
          {/* Branch Search Box */}
          <form onSubmit={handleBranchSubmit} className="relative md:col-span-4">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={branchInput}
              onChange={(e) => setBranchInput(e.target.value)}
              placeholder="Filter by branch (e.g. main)..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
            />
          </form>

          {/* Decision Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto md:col-span-5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">Decision:</span>
            {[
              { label: 'All', value: '' },
              { label: 'PASS', value: 'PASS' },
              { label: 'WARN', value: 'WARN' },
              { label: 'BLOCK', value: 'BLOCK' },
            ].map((d) => (
              <button
                key={d.label}
                onClick={() => {
                  setDecisionFilter(d.value);
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  decisionFilter === d.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Status Dropdown Filter */}
          <div className="flex items-center gap-2 md:col-span-3 md:justify-end">
            <label className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="RUNNING">RUNNING</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <Card>
        {loading ? (
          <Spinner message="Loading scan records..." className="py-20" />
        ) : error ? (
          <EmptyState
            title="Failed to load scans"
            description={error}
            action={
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Retry
              </button>
            }
          />
        ) : scans.length === 0 ? (
          <EmptyState
            title="No scan records found"
            description={
              hasActiveFilters
                ? 'No pipeline scans match the current filter selection.'
                : 'No pipeline scans have been ingested into the system yet.'
            }
            action={
              hasActiveFilters ? (
                <button
                  onClick={handleResetFilters}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow"
                >
                  Clear Filters
                </button>
              ) : null
            }
          />
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Commit & Branch</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Gate Decision</th>
                    <th className="px-5 py-3">Risk Score</th>
                    <th className="px-5 py-3">Findings</th>
                    <th className="px-5 py-3">Trigger / Initiator</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {scans.map((scan) => (
                    <tr
                      key={scan.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <GitCommit className="h-4 w-4 text-blue-500 shrink-0" />
                          <div>
                            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                              {scan.commit_hash?.slice(0, 7) || 'unknown'}
                            </span>
                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {scan.branch || 'main'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={scan.status?.toLowerCase()}>{scan.status}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        {scan.decision ? (
                          <Badge variant={scan.decision?.toLowerCase()}>{scan.decision}</Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {scan.overall_risk_score !== null && scan.overall_risk_score !== undefined ? (
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {scan.overall_risk_score}
                            <span className="text-[10px] text-slate-400 font-normal"> / 100</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {scan.total_findings ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-[11px]">
                        <div>{scan.trigger_event || 'push'}</div>
                        <div className="text-slate-400 truncate max-w-[120px]">{scan.initiated_by || 'ci'}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                        {scan.created_at ? new Date(scan.created_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/scans/${scan.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition"
                        >
                          <span>Audit</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col gap-3 border-t border-slate-200/80 px-5 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Showing{' '}
                <strong className="font-medium text-slate-700 dark:text-slate-200">
                  {scans.length > 0 ? (page - 1) * limit + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong className="font-medium text-slate-700 dark:text-slate-200">
                  {Math.min(page * limit, pagination.total)}
                </strong>{' '}
                of{' '}
                <strong className="font-medium text-slate-700 dark:text-slate-200">
                  {pagination.total}
                </strong>{' '}
                scans
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Prev</span>
                </button>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 px-1">
                  Page {page} of {pagination.totalPages || 1}
                </span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default ScanHistoryPage;
