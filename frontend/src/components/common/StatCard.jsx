import React from 'react';
import Card from './Card';

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  badge,
  className = '',
}) {
  const colorSchemes = {
    blue: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
    amber: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
    rose: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60',
    purple: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/60',
    slate: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/60',
  };

  const scheme = colorSchemes[color] || colorSchemes.blue;

  return (
    <Card className={`overflow-hidden transition-all duration-200 hover:shadow-md ${className}`}>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          {Icon && (
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${scheme}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <h4 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {value}
          </h4>
          {badge && <div>{badge}</div>}
        </div>
        {(subtitle || trend) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {trend}
            <span>{subtitle}</span>
          </p>
        )}
      </div>
    </Card>
  );
}

export default StatCard;
