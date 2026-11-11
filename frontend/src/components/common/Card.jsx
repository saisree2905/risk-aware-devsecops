import React from 'react';

export function Card({ children, className = '', hover = false, onClick = null }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 dark:border-slate-800/80 dark:bg-slate-900/90 ${
        hover ? 'cursor-pointer hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', title, subtitle, action }) {
  if (title || subtitle || action) {
    return (
      <div className={`flex items-start justify-between border-b border-slate-100 p-5 dark:border-slate-800/60 ${className}`}>
        <div>
          {title && <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
          {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    );
  }
  return <div className={`border-b border-slate-100 p-5 dark:border-slate-800/60 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`border-t border-slate-100 bg-slate-50/50 p-4 rounded-b-xl dark:border-slate-800/60 dark:bg-slate-950/30 ${className}`}>
      {children}
    </div>
  );
}

export default Card;
