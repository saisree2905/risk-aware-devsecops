import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export function RiskTrendChart({ scans = [], activePolicy = null, isDark = false }) {
  // Scans from /api/scans are newest first; for trend we reverse to show chronological progression
  const completedScans = [...scans]
    .filter(
      (s) =>
        s.status === 'COMPLETED' &&
        s.overall_risk_score !== null &&
        s.overall_risk_score !== undefined
    )
    .reverse()
    .map((s) => ({
      id: s.id,
      commit: s.commit_hash ? s.commit_hash.slice(0, 7) : 'unknown',
      fullCommit: s.commit_hash,
      branch: s.branch || 'main',
      score: parseFloat(s.overall_risk_score) || 0,
      decision: s.decision || 'N/A',
      date: s.created_at ? new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '',
      timestamp: s.created_at ? new Date(s.created_at).toLocaleString() : '',
    }));

  if (completedScans.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-slate-400">
        <p className="font-medium text-slate-500 dark:text-slate-400">No completed scans for trend line</p>
        <p className="mt-1 text-[11px]">Historical risk progression will display as pipeline evaluations finish.</p>
      </div>
    );
  }

  const warnThreshold = activePolicy?.warn_risk_score ? parseFloat(activePolicy.warn_risk_score) : 40.0;
  const blockThreshold = activePolicy?.max_risk_score ? parseFloat(activePolicy.max_risk_score) : 70.0;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
              {data.commit}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                data.decision === 'PASS'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : data.decision === 'WARN'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
              }`}
            >
              {data.decision}
            </span>
          </div>
          <p className="text-slate-700 dark:text-slate-200">
            Risk Score: <strong className="font-mono text-sm">{data.score.toFixed(2)}</strong> / 100
          </p>
          <p className="text-[11px] text-slate-400">
            Branch: {data.branch} | {data.timestamp}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={completedScans} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? '#1e293b' : '#f1f5f9'}
          />
          <XAxis
            dataKey="commit"
            stroke={isDark ? '#64748b' : '#94a3b8'}
            fontSize={11}
            tickLine={false}
            tick={{ fill: isDark ? '#94a3b8' : '#64748b' }}
          />
          <YAxis
            domain={[0, 100]}
            stroke={isDark ? '#64748b' : '#94a3b8'}
            fontSize={11}
            tickLine={false}
            tick={{ fill: isDark ? '#94a3b8' : '#64748b' }}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Policy Threshold Reference Lines */}
          <ReferenceLine
            y={warnThreshold}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: `WARN (${warnThreshold})`,
              fill: '#f59e0b',
              fontSize: 10,
              position: 'insideTopRight',
            }}
          />
          <ReferenceLine
            y={blockThreshold}
            stroke="#f43f5e"
            strokeDasharray="4 4"
            label={{
              value: `BLOCK (${blockThreshold})`,
              fill: '#f43f5e',
              fontSize: 10,
              position: 'insideTopRight',
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#3b82f6', stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#2563eb' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RiskTrendChart;
