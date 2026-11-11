import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Tag,
  FileCode,
  Shield,
  Layers,
} from 'lucide-react';
import Card, { CardHeader, CardBody } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import scanService from '../services/scanService';

export function FindingsExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scanIdFromUrl = searchParams.get('scanId');

  const [scans, setScans] = useState([]);
  const [selectedScanId, setSelectedScanId] = useState(scanIdFromUrl || '');
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [severityFilter, setSeverityFilter] = useState('');
  const [scannerFilter, setScannerFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // 1. Load available scans for the scan selector dropdown
  useEffect(() => {
    async function loadScans() {
      try {
        const res = await scanService.getScans({ limit: 50 });
        const scanList = res?.scans || [];
        setScans(scanList);
        // If no scan selected, or selected not in list, default to latest completed scan or first
        if (!selectedScanId && scanList.length > 0) {
          const defaultScan = scanList.find((s) => s.status === 'COMPLETED') || scanList[0];
          setSelectedScanId(defaultScan.id);
        }
      } catch (err) {
        console.error('Failed to load scan selector options:', err);
      }
    }
    loadScans();
  }, []);

  // Update selectedScanId if URL changes
  useEffect(() => {
    if (scanIdFromUrl && scanIdFromUrl !== selectedScanId) {
      setSelectedScanId(scanIdFromUrl);
      setPage(1);
    }
  }, [scanIdFromUrl]);

  // Handle Search Submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchTerm(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSeverityFilter('');
    setScannerFilter('');
    setSearchInput('');
    setSearchTerm('');
    setPage(1);
  };

  // 2. Load findings for the selected scan with server-side pagination & filtering
  useEffect(() => {
    if (!selectedScanId) return;
    let isMounted = true;

    async function loadFindings() {
      try {
        setLoading(true);
        const params = { page, limit };
        if (severityFilter) params.severity = severityFilter;
        if (scannerFilter) params.scanner = scannerFilter;
        if (searchTerm) params.search = searchTerm;

        const res = await scanService.getScanFindings(selectedScanId, params);
        if (isMounted) {
          setFindings(res?.findings || []);
          setPagination(res?.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
        }
      } catch (err) {
        console.error('Failed to load findings:', err);
        if (isMounted) {
          setFindings([]);
          setPagination({ page: 1, limit: 25, total: 0, totalPages: 1 });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFindings();
    return () => {
      isMounted = false;
    };
  }, [selectedScanId, page, limit, severityFilter, scannerFilter, searchTerm]);

  const hasActiveFilters = Boolean(severityFilter || scannerFilter || searchTerm);
  const activeScan = scans.find((s) => s.id === selectedScanId);

  return (
    <div className="space-y-6">
      {/* Page Title & Scan Run Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Vulnerability Explorer
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Unified multi-scanner findings with vulnerability IDs, affected components, and remediation guidance
          </p>
        </div>

        {/* Scan Selector Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Audit Run:
          </label>
          <select
            value={selectedScanId}
            onChange={(e) => {
              setSelectedScanId(e.target.value);
              setSearchParams({ scanId: e.target.value });
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            {scans.map((s) => (
              <option key={s.id} value={s.id}>
                {s.commit_hash?.slice(0, 7)} ({s.branch || 'main'}) - {s.decision || s.status} [Score: {s.overall_risk_score || 'N/A'}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter and Search Controls Bar */}
      <Card>
        <div className="p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input Box */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search rule title, CWE/CVE, or file path..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </form>

            {/* Scanner Tool Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">Scanner:</label>
              <select
                value={scannerFilter}
                onChange={(e) => {
                  setScannerFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
              >
                <option value="">All Tools</option>
                <option value="semgrep">Semgrep SAST</option>
                <option value="trivy_fs">Trivy Filesystem</option>
                <option value="trivy_image">Trivy Image</option>
              </select>

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition"
                  title="Reset all filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Severity Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Severity:</span>
            {['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((sev) => (
              <button
                key={sev || 'ALL'}
                onClick={() => {
                  setSeverityFilter(sev);
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  severityFilter === sev
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {sev || 'All'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Findings Table Card */}
      <Card>
        {loading ? (
          <Spinner message="Querying security findings..." className="py-20" />
        ) : findings.length === 0 ? (
          <EmptyState
            title="No findings found"
            description={
              hasActiveFilters
                ? 'No vulnerabilities match the current filter selection.'
                : 'All clear! Zero vulnerabilities reported for this scan run.'
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
                    <th className="px-5 py-3">Severity</th>
                    <th className="px-5 py-3">Scanner</th>
                    <th className="px-5 py-3">Finding Title / Vulnerability</th>
                    <th className="px-5 py-3">Affected Component</th>
                    <th className="px-5 py-3">CVSS</th>
                    <th className="px-5 py-3">Fixed In</th>
                    <th className="px-5 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {findings.map((f) => {
                    const isExpanded = expandedRow === f.id;
                    return (
                      <React.Fragment key={f.id}>
                        <tr
                          onClick={() => setExpandedRow(isExpanded ? null : f.id)}
                          className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <Badge variant={f.severity?.toLowerCase()}>{f.severity}</Badge>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] uppercase text-slate-500">
                            {f.scanner_name}
                          </td>
                          <td className="px-5 py-3.5 max-w-sm">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {f.title}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {f.vuln_id || f.finding_id || 'N/A'}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 max-w-xs font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            {f.affected_component || 'N/A'}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px]">
                            {f.cvss_score ? (
                              <span className="font-bold text-amber-600 dark:text-amber-400">{f.cvss_score}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                            {f.fixed_version || <span className="text-slate-400 font-normal">-</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Remediation and Details Drawer */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-slate-950/40">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-slate-100">Full Title: </span>
                                  <span className="text-slate-700 dark:text-slate-300">{f.title}</span>
                                </div>
                                {f.description && (
                                  <div>
                                    <span className="font-bold text-slate-900 dark:text-slate-100">Description: </span>
                                    <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                                      {f.description}
                                    </p>
                                  </div>
                                )}
                                {f.remediation && (
                                  <div className="rounded-md bg-blue-50/60 p-3 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
                                    <span className="font-bold text-blue-900 dark:text-blue-300">Remediation Guidance: </span>
                                    <p className="mt-1 text-blue-800 dark:text-blue-200 leading-relaxed break-words">
                                      {f.remediation}
                                    </p>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                                  <span>
                                    Component: <strong className="font-mono text-slate-700 dark:text-slate-300">{f.affected_component || 'N/A'}</strong>
                                  </span>
                                  {f.affected_version && (
                                    <span>
                                      Installed: <strong className="font-mono text-slate-700 dark:text-slate-300">{f.affected_version}</strong>
                                    </span>
                                  )}
                                  {f.fixed_version && (
                                    <span>
                                      Fixed In: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{f.fixed_version}</strong>
                                    </span>
                                  )}
                                  {f.vuln_id && (
                                    <span>
                                      CVE/CWE: <strong className="font-mono text-slate-700 dark:text-slate-300">{f.vuln_id}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col gap-3 border-t border-slate-200/80 px-5 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Showing{' '}
                <strong className="font-medium text-slate-700 dark:text-slate-200">
                  {findings.length > 0 ? (page - 1) * limit + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong className="font-medium text-slate-700 dark:text-slate-200">
                  {Math.min(page * limit, pagination.total)}
                </strong>{' '}
                of{' '}
                <strong className="font-medium text-slate-700 dark:text-slate-200">
                  {pagination.total}
                </strong>{' '}
                findings
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

export default FindingsExplorerPage;
