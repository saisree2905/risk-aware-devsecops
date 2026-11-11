import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Sun, Moon, GitCommit, Activity } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import dashboardService from '../../services/dashboardService';

const ROUTE_NAMES = {
  '/': 'Security Overview',
  '/scans': 'Scan History',
  '/findings': 'Findings Explorer',
  '/risk': 'Risk Assessment Engine',
  '/policies': 'Security Policy Rules',
  '/scanners': 'Scanner Telemetry',
};

export function Header({ onMenuClick = () => {} }) {
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [backendStatus, setBackendStatus] = useState('checking'); // 'connected' | 'error' | 'checking'
  const [latestCommit, setLatestCommit] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function checkHealthAndStats() {
      try {
        const [healthRes, statsRes] = await Promise.allSettled([
          dashboardService.getHealth(),
          dashboardService.getStats(),
        ]);
        if (isMounted) {
          if (healthRes.status === 'fulfilled' && healthRes.value?.status === 'ok') {
            setBackendStatus('connected');
          } else {
            setBackendStatus('error');
          }
          if (statsRes.status === 'fulfilled' && statsRes.value?.data?.latestScan?.commit_hash) {
            setLatestCommit(statsRes.value.data.latestScan.commit_hash.slice(0, 7));
          }
        }
      } catch {
        if (isMounted) {
          setBackendStatus('error');
        }
      }
    }
    checkHealthAndStats();
    const interval = setInterval(checkHealthAndStats, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const pageTitle = ROUTE_NAMES[location.pathname] || (location.pathname.startsWith('/scans/') ? 'Scan Audit Details' : 'Dashboard');

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 md:px-8 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80 transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {pageTitle}
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Automated Risk Evaluation & Enforcement
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Backend Connectivity Status */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs dark:border-slate-800 dark:bg-slate-950/60">
          <span
            className={`h-2 w-2 rounded-full ${
              backendStatus === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : backendStatus === 'checking'
                ? 'bg-amber-500 animate-ping'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
            {backendStatus === 'connected' ? 'Backend Live' : backendStatus === 'checking' ? 'Connecting...' : 'Backend Offline'}
          </span>
        </div>

        {/* Latest Commit Tag */}
        {latestCommit ? (
          <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-mono text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
            <GitCommit className="h-3.5 w-3.5 text-blue-500" />
            <span>{latestCommit}</span>
          </div>
        ) : null}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition-all shadow-sm"
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="h-4 w-4 text-blue-600 transition-transform rotate-0 hover:-rotate-12" />
          )}
        </button>
      </div>
    </header>
  );
}

export default Header;
