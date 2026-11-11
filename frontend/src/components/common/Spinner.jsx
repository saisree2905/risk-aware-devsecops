import React from 'react';

export function Spinner({ size = 'md', message = '', className = '' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-6 ${className}`}>
      <div
        className={`animate-spin rounded-full border-blue-600 border-t-transparent dark:border-blue-400 dark:border-t-transparent ${
          sizeClasses[size] || sizeClasses.md
        }`}
      />
      {message && (
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}

export default Spinner;
