import React, { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, Shield, Layers, Clock, AlertTriangle, Info, Terminal } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import dashboardService from '../services/dashboardService';
import scanService from '../services/scanService';

export function ScannerTelemetryPage() {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadTelemetry() {
      try {
        setLoading(true);
        const stats = await dashboardService.getStats();
        const latestId = stats?.data?.latestScan?.id || stats?.latestScan?.id;
        if (latestId) {
          const full = await scanService.getFullScan(latestId);
          setTelemetry(full);
        }
      } catch (err) {
        console.error('Failed to load scanner telemetry:', err);
        setError(err.message || 'Failed to retrieve telemetry records.');
      } finally {
        setLoading(false);
      }
    }
    loadTelemetry();
  }, []);

  const TOOLS = [
    {
      id: 'semgrep',
      name: 'Semgrep SAST',
      type: 'Static Application Security Testing',
      scope: 'Source code analysis (JavaScript/Express, Python, Go, Java)',
      description: 'Pattern-matching and AST parsing detecting injection, insecure paths, XSS and cryptographic weaknesses without compiling code.',
      config: 'semgrep scan --config auto --json',
      target: 'backend/src/, security-tests/',
      runnerImage: 'returntocorp/semgrep:latest',
    },
    {
      id: 'trivy_fs',
      name: 'Trivy Filesystem',
      type: 'Software Composition Analysis (SCA)',
      scope: 'Application dependencies (package.json, package-lock.json)',
      description: 'Scans third-party open-source libraries for published CVEs and outdated package versions.',
      config: 'trivy fs --format json --output trivy-fs-report.json .',
      target: 'Repository root & lockfiles',
      runnerImage: 'aquasec/trivy:latest',
    },
    {
      id: 'trivy_image',
      name: 'Trivy Container Image',
      type: 'Container Image Security',
      scope: 'Production Docker runtime image (Alpine Linux packages + Node.js runtime)',
      description: 'Inspects base image OS packages and binary dependencies. Remediated in Phase 4 via npm removal and Alpine zlib patch.',
      config: 'trivy image --format json --output trivy-image-report.json risk-aware-backend:ci',
      target: 'Docker runtime container',
      runnerImage: 'aquasec/trivy:latest',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Scanner Orchestration & Telemetry
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Integrated multi-scanner pipelines executing in parallel on hardened GitHub Actions runners
        </p>
      </div>

      {/* Tool Specifications Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Card key={tool.name} className="flex flex-col justify-between">
            <div>
              <CardHeader
                title={tool.name}
                subtitle={tool.type}
              />
              <CardBody className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {tool.description}
                </p>
                <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/60 font-mono text-[11px] text-blue-600 dark:text-blue-400 overflow-x-auto">
                  {tool.config}
                </div>
              </CardBody>
            </div>
            <div className="border-t border-slate-100 p-4 dark:border-slate-800/60 text-[11px] text-slate-500 space-y-1">
              <div>Scope: <strong className="text-slate-700 dark:text-slate-300">{tool.scope}</strong></div>
              <div>Target: <span className="font-mono text-slate-600 dark:text-slate-400">{tool.target}</span></div>
            </div>
          </Card>
        ))}
      </div>

      {/* Telemetry Transparency Banner */}
      <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-200">
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Scanner Version & Telemetry Ingestion Audit Note</p>
            <p className="text-blue-800 dark:text-blue-300 text-[11px] leading-relaxed">
              When scanner reports are ingested via the automated CI runner evaluation pipeline (e.g. <code>ci-evaluate.js</code>), scanner execution metadata is recorded into the <code>scanner_metadata</code> table. Entries displaying <code>fixture-mock</code> denote synthetic test runs or development test fixtures, whereas actual GitHub Actions runner executions report live scanner versions and runner latencies.
            </p>
          </div>
        </div>
      </div>

      {/* Live Scanner Telemetry from Latest Scan */}
      {loading ? (
        <Spinner message="Loading telemetry records..." className="py-16" />
      ) : telemetry?.scannerExecutions && telemetry.scannerExecutions.length > 0 ? (
        <Card>
          <CardHeader
            title="Ingested CI Execution Audit Records"
            subtitle={`Telemetry recorded from scan ${telemetry.scan?.id?.slice(0, 8)}... (Commit ${telemetry.scan?.commit_hash?.slice(0, 7)})`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Scanner Name</th>
                  <th className="px-5 py-3">Version / Telemetry Source</th>
                  <th className="px-5 py-3">Execution Latency</th>
                  <th className="px-5 py-3">Exit Code</th>
                  <th className="px-5 py-3">Classification</th>
                  <th className="px-5 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {telemetry.scannerExecutions.map((exec, idx) => {
                  const isMock = exec.scanner_version?.includes('mock') || exec.scanner_version === 'fixture-mock';
                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="px-5 py-3.5 font-bold uppercase text-slate-900 dark:text-slate-100">
                        {exec.scanner_name}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`font-mono px-2 py-0.5 rounded text-[11px] ${
                          isMock
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {exec.scanner_version}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        {exec.execution_time_ms} ms
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {exec.exit_code}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {isMock ? (
                          <Badge variant="warn">TEST FIXTURE</Badge>
                        ) : (
                          <Badge variant="pass">PRODUCTION CI</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                        {exec.created_at ? new Date(exec.created_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No scanner execution records"
          description="No execution telemetry found for the latest scan."
        />
      )}
    </div>
  );
}

export default ScannerTelemetryPage;
