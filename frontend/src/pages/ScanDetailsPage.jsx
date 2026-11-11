import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  GitCommit,
  Clock,
  Shield,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  FileText,
  AlertTriangle,
  Info,
} from 'lucide-react';
import Card, { CardHeader, CardBody } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import scanService from '../services/scanService';

export function ScanDetailsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadScan() {
      try {
        setLoading(true);
        const res = await scanService.getFullScan(id);
        if (isMounted) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to retrieve scan audit details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadScan();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return <Spinner size="lg" message="Retrieving scan audit record from backend..." className="py-24" />;
  }

  if (error || !data?.scan) {
    return (
      <EmptyState
        title="Scan record not found"
        description={error || 'The requested scan ID does not exist in the audit database.'}
        action={
          <Link
            to="/scans"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Scan History
          </Link>
        }
      />
    );
  }

  const { scan, scannerExecutions = [], findingsSummary = [], totalFindings = 0 } = data;

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/scans"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Scan History</span>
        </Link>
        <Link
          to={`/findings?scanId=${scan.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <span>Explore Findings ({totalFindings})</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Audit Banner Card */}
      <Card className="border-blue-200/60 dark:border-blue-900/40">
        <div className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={scan.decision?.toLowerCase() || 'neutral'} size="lg">
                  CI Gate: {scan.decision || 'PENDING'}
                </Badge>
                <Badge variant={scan.status?.toLowerCase()}>{scan.status}</Badge>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    scan.is_blocking
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                  }`}
                >
                  {scan.is_blocking ? 'Enforcement: ACTIVE (Job Failed)' : 'Enforcement: NON-BLOCKING (Advisory)'}
                </span>
              </div>

              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Commit</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 break-all">
                  {scan.commit_hash}
                </span>
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span>Branch: <strong className="text-slate-700 dark:text-slate-200">{scan.branch}</strong></span>
                <span>Initiated by: <strong className="text-slate-700 dark:text-slate-200">{scan.initiated_by || 'ci-pipeline'}</strong></span>
                <span>Trigger: <strong className="text-slate-700 dark:text-slate-200">{scan.trigger_event}</strong></span>
                <span>Timestamp: <strong className="text-slate-700 dark:text-slate-200">{new Date(scan.created_at).toLocaleString()}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Risk Score</span>
                <p className="text-3xl font-black text-slate-900 dark:text-slate-100">
                  {scan.overall_risk_score !== null && scan.overall_risk_score !== undefined ? scan.overall_risk_score : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-400">/ 100.00</span>
              </div>
              <div className="h-10 w-px bg-slate-200 dark:bg-slate-800" />
              <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Findings</span>
                <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{totalFindings}</p>
                <span className="text-[10px] text-slate-400">Recorded</span>
              </div>
            </div>
          </div>

          {/* Rationale Callout */}
          {scan.decision_rationale && (
            <div className="mt-5 rounded-lg border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              <span className="font-bold">Gating Decision Rationale: </span>
              {scan.decision_rationale}
            </div>
          )}

          {scan.assessment_rationale && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-slate-100">Risk Assessment Rationale: </span>
              {scan.assessment_rationale}
            </div>
          )}
        </div>
      </Card>

      {/* Detail Panels Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Scanner Executions */}
        <Card>
          <CardHeader
            title="Scanner Execution Telemetry"
            subtitle="Pipeline scanners executed for this scan evaluation"
          />
          <CardBody>
            {scannerExecutions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No scanner telemetry records recorded.</p>
            ) : (
              <div className="space-y-3">
                {scannerExecutions.map((exec, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        <Cpu className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 uppercase">
                          {exec.scanner_name}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Version: {exec.scanner_version}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {exec.execution_time_ms} ms
                      </span>
                      <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">
                        Exit {exec.exit_code}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Severity Breakdown for Scan */}
        <Card>
          <CardHeader
            title="Vulnerability Severity Distribution"
            subtitle={`${totalFindings} total findings recorded for this commit`}
            action={
              <Link
                to={`/findings?scanId=${scan.id}`}
                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                Inspect Findings &rarr;
              </Link>
            }
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-lg border border-purple-200/80 bg-purple-50/40 p-3 text-center dark:border-purple-900/40 dark:bg-purple-950/20">
                <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">Critical</span>
                <p className="mt-1 text-xl font-bold">{scan.critical_count ?? 0}</p>
                <span className="text-[9px] text-slate-400">Weight: 90.0</span>
              </div>
              <div className="rounded-lg border border-rose-200/80 bg-rose-50/40 p-3 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
                <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">High</span>
                <p className="mt-1 text-xl font-bold">{scan.high_count ?? 0}</p>
                <span className="text-[9px] text-slate-400">Weight: 65.0</span>
              </div>
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
                <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Medium</span>
                <p className="mt-1 text-xl font-bold">{scan.medium_count ?? 0}</p>
                <span className="text-[9px] text-slate-400">Weight: 40.0</span>
              </div>
              <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 p-3 text-center dark:border-blue-900/40 dark:bg-blue-950/20">
                <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">Low</span>
                <p className="mt-1 text-xl font-bold">{scan.low_count ?? 0}</p>
                <span className="text-[9px] text-slate-400">Weight: 15.0</span>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-3 text-center dark:border-slate-800 dark:bg-slate-800/20">
                <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Info</span>
                <p className="mt-1 text-xl font-bold">{scan.info_count ?? 0}</p>
                <span className="text-[9px] text-slate-400">Weight: 0.0</span>
              </div>
            </div>

            {/* Applied Policy Thresholds Table */}
            <div className="mt-5 rounded-lg border border-slate-100 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Evaluated Policy: {scan.policy_name || 'Standard Enterprise Policy'} (v{scan.policy_version || '1.0.0'})
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 sm:grid-cols-4">
                <div>Max Critical: <strong className="text-slate-900 dark:text-slate-100">{scan.max_critical_count ?? 0}</strong></div>
                <div>Max High: <strong className="text-slate-900 dark:text-slate-100">{scan.max_high_count ?? 2}</strong></div>
                <div>Warn Threshold: <strong className="text-amber-600 dark:text-amber-400">&ge; {scan.warn_risk_score ?? '40.00'}</strong></div>
                <div>Block Ceiling: <strong className="text-rose-600 dark:text-rose-400">&ge; {scan.max_risk_score ?? '70.00'}</strong></div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default ScanDetailsPage;
