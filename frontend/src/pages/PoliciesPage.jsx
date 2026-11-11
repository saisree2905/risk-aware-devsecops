import React, { useEffect, useState } from 'react';
import { Scale, ShieldCheck, CheckCircle2, AlertOctagon } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import policyService from '../services/policyService';

export function PoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadPolicies() {
      try {
        setLoading(true);
        const res = await policyService.getPolicies();
        if (isMounted) {
          setPolicies(res?.policies || []);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load policy rules.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPolicies();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Security Policy Rules & Thresholds
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Active governance rules evaluated on every CI/CD pull request and commit
        </p>
      </div>

      {loading ? (
        <Spinner message="Loading policies..." className="py-20" />
      ) : error ? (
        <EmptyState title="Failed to load policies" description={error} />
      ) : policies.length === 0 ? (
        <EmptyState title="No policies found" description="No active policies in database." />
      ) : (
        <div className="space-y-6">
          {policies.map((policy) => (
            <Card key={policy.id} className={policy.is_active ? 'border-blue-200 dark:border-blue-900/60' : ''}>
              <CardHeader
                title={
                  <div className="flex items-center gap-3">
                    <span>{policy.name}</span>
                    <span className="font-mono text-xs font-normal text-slate-400">v{policy.version}</span>
                    {policy.is_active && <Badge variant="pass">Active Governance</Badge>}
                  </div>
                }
                subtitle={policy.description}
              />
              <CardBody>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Max Critical Allowed</span>
                    <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{policy.max_critical_count}</p>
                    <span className="text-[10px] text-slate-400">&gt; 0 triggers immediate BLOCK</span>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Max High Allowed</span>
                    <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{policy.max_high_count}</p>
                    <span className="text-[10px] text-slate-400">&gt; 2 triggers immediate BLOCK</span>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Warn Risk Score</span>
                    <p className="mt-1 text-2xl font-bold text-amber-500">{policy.warn_risk_score}</p>
                    <span className="text-[10px] text-slate-400">&ge; 40.00 issues advisory WARN</span>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Block Risk Score</span>
                    <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{policy.max_risk_score}</p>
                    <span className="text-[10px] text-slate-400">&ge; 70.00 triggers immediate BLOCK</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-slate-600 dark:text-slate-300">
                      Enforcement Mode: <strong>fail_on_block = {String(policy.fail_on_block)}</strong> (CI Pipeline fails with exit code 1 on BLOCK)
                    </span>
                  </div>
                  <span className="text-slate-400">Created: {new Date(policy.created_at).toLocaleDateString()}</span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default PoliciesPage;
