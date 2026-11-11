import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 shadow-lg shadow-rose-500/10">
        <ShieldX className="h-8 w-8" />
      </div>
      <h1 className="mt-5 text-2xl font-black text-slate-900 dark:text-slate-100">
        404 - Page Not Found
      </h1>
      <p className="mt-2 max-w-sm text-xs text-slate-500 dark:text-slate-400">
        The security dashboard route you requested does not exist or has been relocated.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-blue-700 transition"
      >
        <Home className="h-4 w-4" />
        Return to Overview
      </Link>
    </div>
  );
}

export default NotFoundPage;
