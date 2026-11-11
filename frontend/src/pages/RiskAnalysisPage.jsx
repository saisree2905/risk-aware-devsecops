import React from 'react';
import {
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Layers,
  HelpCircle,
  Calculator,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import Card, { CardHeader, CardBody } from '../components/common/Card';
import Badge from '../components/common/Badge';

export function RiskAnalysisPage() {
  const SEVERITY_SPECIFICATIONS = [
    {
      severity: 'CRITICAL',
      baseWeight: 90.0,
      compoundBonus: 5.0,
      floor: '76.50 (85%)',
      range: '76.50 – 100.00',
      description: 'Remote code execution, arbitrary shell injection, unauthenticated write',
    },
    {
      severity: 'HIGH',
      baseWeight: 70.0,
      compoundBonus: 3.0,
      floor: '59.50 (85%)',
      range: '59.50 – 79.00',
      description: 'Authentication bypass, privilege escalation, credential leakage',
    },
    {
      severity: 'MEDIUM',
      baseWeight: 40.0,
      compoundBonus: 1.5,
      floor: '34.00 (85%)',
      range: '34.00 – 58.00',
      description: 'Path traversal, reflected XSS, missing CSRF protection, insecure defaults',
    },
    {
      severity: 'LOW',
      baseWeight: 15.0,
      compoundBonus: 0.5,
      floor: '12.75 (85%)',
      range: '12.75 – 40.50',
      description: 'Informational header omissions, verbose debug flags, minor cipher suites',
    },
    {
      severity: 'INFO',
      baseWeight: 0.0,
      compoundBonus: 0.0,
      floor: '0.00',
      range: '0.00 – 30.00',
      description: 'Informational audit notices, workflow references, migration logs',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Deterministic Risk Assessment Engine
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Mathematical specification of the discrete, bounded compound risk scoring model with guaranteed floor protections
        </p>
      </div>

      {/* Formula Explanation Card */}
      <Card className="border-blue-200/80 bg-gradient-to-r from-blue-50/40 via-white to-indigo-50/20 dark:border-blue-900/40 dark:from-blue-950/20 dark:via-slate-900 dark:to-indigo-950/10">
        <CardBody className="space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Approved Risk Engine Mathematical Architecture
            </h3>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 font-mono text-xs dark:border-slate-800 dark:bg-slate-950/80 text-slate-800 dark:text-slate-200 overflow-x-auto">
            <div>
              <span className="text-blue-600 dark:text-blue-400 font-bold">1. Individual Finding Score Formula (r_i):</span>
              <p className="mt-1 text-slate-700 dark:text-slate-300">
                r_i = max(0.85 &times; w_severity, 0.70 &times; w_severity + 0.30 &times; s_CVSS)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                where s_CVSS = validCvss &times; 10 (scaled to 100). If CVSS is missing, invalid, or out-of-range, r_i falls back to w_severity.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-blue-600 dark:text-blue-400 font-bold">2. Aggregate Pipeline Score Formula (S):</span>
              <p className="mt-1 text-slate-700 dark:text-slate-300">
                S = 0 when N = 0; otherwise min(100.0, r_max + B_compound)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                where r_max is the score of the single dominant finding, and B_compound = min(100.0 - r_max, &Sigma; w_bonus(severity_j)) for all remaining findings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
            <div className="rounded-lg border border-slate-100 bg-white/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
              <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Dominant Finding Anchor (r_max)
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Isolates the single most severe finding as the base score using deterministic tie-breaking (highest score &rarr; highest severity rank &rarr; stable key).
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
              <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-blue-500" />
                85% Floor Protection
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Guarantees an anomalous or conflicting low CVSS can never suppress a CRITICAL finding below 76.50 or a HIGH finding below 59.50.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
              <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                Discrete Compound Bonus (B_compound)
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Applies discrete compound bonus weights for remaining findings: CRITICAL (+5.0), HIGH (+3.0), MEDIUM (+1.5), LOW (+0.5), INFO (+0.0).
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Severity Base Weights & Compound Bonus Table */}
      <Card>
        <CardHeader
          title="Severity Base Weights, Floor Protections & Compound Bonus"
          subtitle="Exact parameter values implemented in backend/src/risk-engine/index.js"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">Severity Tier</th>
                <th className="px-5 py-3">Base Weight (w_sev)</th>
                <th className="px-5 py-3">85% Floor (0.85 &times; w_sev)</th>
                <th className="px-5 py-3">Compound Bonus (w_bonus)</th>
                <th className="px-5 py-3">Score Range (r_i)</th>
                <th className="px-5 py-3">Common Vulnerability Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {SEVERITY_SPECIFICATIONS.map((row) => (
                <tr key={row.severity} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-3.5">
                    <Badge variant={row.severity.toLowerCase()}>{row.severity}</Badge>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {row.baseWeight.toFixed(1)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-blue-600 dark:text-blue-400 font-semibold">
                    {row.floor}
                  </td>
                  <td className="px-5 py-3.5 font-mono font-semibold text-purple-600 dark:text-purple-400">
                    +{row.compoundBonus.toFixed(1)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-700 dark:text-slate-300">
                    {row.range}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {row.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default RiskAnalysisPage;
