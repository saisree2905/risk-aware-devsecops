import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Layers,
  Activity,
  ArrowRight,
  TrendingUp,
  PieChart as PieIcon,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import Card, { CardHeader, CardBody, CardFooter } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import SeverityDonutChart from '../components/charts/SeverityDonutChart';
import RiskTrendChart from '../components/charts/RiskTrendChart';
import { useTheme } from '../hooks/useTheme';
import dashboardService from '../services/dashboardService';
import scanService from '../services/scanService';

export function OverviewPage() {
  const { isDark } = useTheme();
  const [stats, setStats] = useState(null);
  const [historicalScans, setHistoricalScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadOverviewData() {
      try {
        setLoading(true);
        const [statsData, scansData] = await Promise.all([
          dashboardService.getStats(),
          scanService.getScans({ limit: 20 }),
        ]);
        if (isMounted) {
          setStats(statsData?.data || statsData);
          setHistoricalScans(scansData?.scans || []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load dashboard overview data.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadOverviewData();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <Spinner size="lg" message="Loading security metrics from backend..." className="py-24" />;
  }

  if (error) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Could not connect to backend"
        description={error}
        action={
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700 transition"
          >
            Retry Connection
          </button>
        }
      />
    );
  }

  const latestScan = stats?.latestScan;
  const scansTotal = stats?.scans?.total || 0;
  const completedScans = stats?.scans?.completed || 0;
  const runningScans = stats?.scans?.running || 0;
  const failedScans = stats?.scans?.failed || 0;
  const decisions = stats?.decisions || { pass: 0, warn: 0, block: 0 };
  const findings = stats?.findings || { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const activePolicy = stats?.activePolicy;

  // Exact Pass Rate (PASS decisions only)
  const passRate = completedScans > 0 ? Math.round((decisions.pass / completedScans) * 100) : 0;
  // Non-blocking rate (PASS + WARN decisions)
  const nonBlockingRate = completedScans > 0 ? Math.round(((decisions.pass + decisions.warn) / completedScans) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Latest Verified CI Scan Banner */}
      {latestScan ? (
        <Card className="border-blue-200/60 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/30 dark:border-blue-900/40 dark:from-blue-950/20 dark:via-slate-900 dark:to-indigo-950/20">
          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={latestScan.decision?.toLowerCase()} size="md">
                    CI Gate: {latestScan.decision}
                  </Badge>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Latest Ingested Pipeline Scan
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Commit:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {latestScan.commit_hash?.slice(0, 7)}
                  </span>
                  <span className="text-sm font-normal text-slate-500">
                    ({latestScan.branch || 'main'})
                  </span>
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
                  {latestScan.decision_rationale}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-slate-400">Risk Score</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {latestScan.overall_risk_score}
                    <span className="text-xs font-normal text-slate-400"> / 100</span>
                  </div>
                </div>
                <Link
                  to={`/scans/${latestScan.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-blue-700 transition"
                >
                  <span>View Audit</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Scans Ingested"
          value={scansTotal}
          subtitle={`${completedScans} completed, ${runningScans} running, ${failedScans} failed`}
          icon={Layers}
          color="blue"
        />
        <StatCard
          title="Pipeline Gate Pass Rate"
          value={completedScans > 0 ? `${passRate}%` : 'N/A'}
          subtitle={`Non-blocking rate: ${nonBlockingRate}% (${decisions.warn} WARN, ${decisions.block} BLOCK)`}
          icon={ShieldCheck}
          color={passRate > 50 ? 'emerald' : 'amber'}
        />
        <StatCard
          title="Total Findings Tracked"
          value={findings.total}
          subtitle={`${findings.critical} Critical, ${findings.high} High, ${findings.medium} Med`}
          icon={ShieldAlert}
          color="amber"
        />
        <StatCard
          title="Active Security Policy"
          value={activePolicy?.version ? `v${activePolicy.version}` : '1.0.0'}
          subtitle={activePolicy?.name || 'Standard Enterprise Policy'}
          icon={Activity}
          color="purple"
        />
      </div>

      {/* Interactive Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Severity Donut Chart (5 cols) */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <CardHeader
            title="Finding Severity Distribution"
            subtitle="Breakdown of normalized vulnerabilities by severity tier"
            action={
              <Link to="/findings" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Explore Findings &rarr;
              </Link>
            }
          />
          <CardBody className="py-2">
            <SeverityDonutChart findings={findings} isDark={isDark} />
          </CardBody>
          <CardFooter className="flex items-center justify-between text-xs text-slate-500">
            <span>Critical: {findings.critical} | High: {findings.high} | Med: {findings.medium}</span>
            <span className="font-mono text-[11px]">Total: {findings.total}</span>
          </CardFooter>
        </Card>

        {/* Historical Risk Trend Line Chart (7 cols) */}
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <CardHeader
            title="Historical Risk Score Trend"
            subtitle="Pipeline risk progression across completed commits with gating ceilings"
            action={
              <Link to="/scans" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Scan History &rarr;
              </Link>
            }
          />
          <CardBody className="py-2">
            <RiskTrendChart scans={historicalScans} activePolicy={activePolicy} isDark={isDark} />
          </CardBody>
          <CardFooter className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Warn Ceiling ({activePolicy?.warn_risk_score || '40.00'})</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Block Ceiling ({activePolicy?.max_risk_score || '70.00'})</span>
              </span>
            </span>
            <Link to="/risk" className="hover:text-blue-600 font-medium">
              Risk Engine &rarr;
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Severity Breakdown Cards & Policy Ceilings Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Severity Distribution Detailed Cards */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Severity Base Weights & Counts"
            subtitle="Aggregated finding counts across all ingested scanner reports"
            action={
              <Link to="/risk" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Scoring Formula &rarr;
              </Link>
            }
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="rounded-lg border border-purple-200/80 bg-purple-50/50 p-4 dark:border-purple-900/40 dark:bg-purple-950/20 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Critical</span>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{findings.critical}</p>
                <span className="text-[10px] text-slate-400">Weight: 90.0</span>
              </div>
              <div className="rounded-lg border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">High</span>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{findings.high}</p>
                <span className="text-[10px] text-slate-400">Weight: 65.0</span>
              </div>
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Medium</span>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{findings.medium}</p>
                <span className="text-[10px] text-slate-400">Weight: 40.0</span>
              </div>
              <div className="rounded-lg border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Low</span>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{findings.low}</p>
                <span className="text-[10px] text-slate-400">Weight: 15.0</span>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Info</span>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{findings.info}</p>
                <span className="text-[10px] text-slate-400">Weight: 0.0</span>
              </div>
            </div>
          </CardBody>
          <CardFooter className="flex items-center justify-between text-xs text-slate-500">
            <span>Deterministic multi-scanner normalization</span>
            <span className="font-mono text-[11px]">85% CVSS Floor Protected</span>
          </CardFooter>
        </Card>

        {/* Quick Gating Rule Summary */}
        <Card>
          <CardHeader
            title="Gating Policy Ceilings"
            subtitle="Automated CI gate evaluation rules"
            action={
              <Link to="/policies" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Policy &rarr;
              </Link>
            }
          />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-600 dark:text-slate-300">Max Critical Allowed</span>
              <Badge variant="critical">{activePolicy?.max_critical_count ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-600 dark:text-slate-300">Max High Allowed</span>
              <Badge variant="high">{activePolicy?.max_high_count ?? 2}</Badge>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-600 dark:text-slate-300">Warn Threshold</span>
              <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                &ge; {activePolicy?.warn_risk_score ?? '40.00'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-300">Block Ceiling</span>
              <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                &ge; {activePolicy?.max_risk_score ?? '70.00'}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default OverviewPage;
