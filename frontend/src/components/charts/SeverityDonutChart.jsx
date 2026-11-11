import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

const SEVERITY_COLORS = {
  Critical: '#a855f7', // purple-500
  High: '#f43f5e',     // rose-500
  Medium: '#f59e0b',   // amber-500
  Low: '#3b82f6',      // blue-500
  Info: '#94a3b8',     // slate-400
};

export function SeverityDonutChart({ findings = {}, isDark = false }) {
  const data = [
    { name: 'Critical', value: Number(findings.critical) || 0, color: SEVERITY_COLORS.Critical },
    { name: 'High', value: Number(findings.high) || 0, color: SEVERITY_COLORS.High },
    { name: 'Medium', value: Number(findings.medium) || 0, color: SEVERITY_COLORS.Medium },
    { name: 'Low', value: Number(findings.low) || 0, color: SEVERITY_COLORS.Low },
    { name: 'Info', value: Number(findings.info) || 0, color: SEVERITY_COLORS.Info },
  ].filter((item) => item.value > 0);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-slate-400">
        <p className="font-medium text-slate-500 dark:text-slate-400">No findings recorded</p>
        <p className="mt-1 text-[11px]">All integrated scanners report 0 vulnerabilities.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = ((item.value / total) * 100).toFixed(1);
      return (
        <div className="rounded-lg border border-slate-200 bg-white/95 p-2.5 text-xs shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.payload.color }}
            />
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {item.name}
            </span>
          </div>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Count: <strong className="font-mono">{item.value}</strong> ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke={isDark ? '#0f172a' : '#ffffff'}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry) => (
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {value} ({entry.payload.value})
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Centered Donut Badge */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-9">
        <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total</span>
        <span className="text-xl font-black text-slate-900 dark:text-slate-100">{total}</span>
      </div>
    </div>
  );
}

export default SeverityDonutChart;
