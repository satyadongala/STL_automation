import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Folder, ClipboardList, Play, Percent, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const CHART_HEIGHT = 180;

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getExecutions()])
      .then(([statsData, runsData]) => {
        setStats(statsData);
        setExecutions(runsData || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin"></div>
      </div>
    );
  }

  const counters = stats?.counters || { projects: 0, testCases: 0, runs: 0, successRate: 0 };

  // Last 10 runs, oldest → newest left to right on the chart
  const chartRuns = executions
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      id: r.id,
      createdAt: r.startedAt || r.createdAt,
      summaryPassed: r.summaryPassed ?? 0,
      summaryFailed: r.summaryFailed ?? 0,
      status: r.status,
    }));

  const maxRuns =
    chartRuns.length > 0
      ? Math.max(...chartRuns.map((r) => r.summaryPassed + r.summaryFailed), 1)
      : 1;

  const statusLabel = (status: string) => {
    if (status === 'RUNNING') return { text: 'Running', className: 'text-amber-700 bg-amber-50 border-amber-200' };
    if (status === 'FAILED') return { text: 'Failed', className: 'text-rose-700 bg-rose-50 border-rose-200' };
    if (status === 'PENDING') return { text: 'Pending', className: 'text-brand-700 bg-brand-50 border-brand-200' };
    if (status === 'COMPLETED') return { text: 'Passed', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    return { text: status, className: 'text-text-secondary bg-white border-brand-200' };
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-gradient-aqua">Automation Hub</h2>
          <p className="text-text-muted mt-1">Real-time low-code UI & API test automation — execution platform and statistics.</p>
        </div>
      </div>

      {/* Stats Counter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <Folder className="w-32 h-32 text-brand-800" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <Folder className="w-6 h-6 text-brand-800" />
            </div>
            <div>
              <div className="text-label text-sm font-medium">Projects</div>
              <div className="text-3xl font-bold mt-1 text-text-primary">{counters.projects}</div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <ClipboardList className="w-32 h-32 text-indigo-700" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <div className="text-label text-sm font-medium">Total Test Cases</div>
              <div className="text-3xl font-bold mt-1 text-text-primary">{counters.testCases}</div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <Play className="w-32 h-32 text-violet-700" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Play className="w-6 h-6 text-violet-700" />
            </div>
            <div>
              <div className="text-label text-sm font-medium">Total Test Runs</div>
              <div className="text-3xl font-bold mt-1 text-text-primary">{counters.runs}</div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <Percent className="w-32 h-32 text-emerald-700" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Percent className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="text-label text-sm font-medium">Success Rate</div>
              <div className="text-3xl font-bold mt-1 text-text-primary">{counters.successRate}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Graph and Recent History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SVG Custom Graph */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-text-primary">Execution Frequency & History</h3>
            <span className="text-xs text-text-muted font-medium">Last 10 runs</span>
          </div>
          <div className="w-full h-72 flex items-end gap-2 px-2 pb-10 relative border-b border-brand-200/60 border-l border-brand-200/60">
            {chartRuns.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-sm">
                No runs recorded recently
              </div>
            ) : (
              chartRuns.map((r, idx) => {
                const total = r.summaryPassed + r.summaryFailed;
                const percentPassed = total > 0 ? (r.summaryPassed / total) * 100 : 0;
                const percentFailed = total > 0 ? (r.summaryFailed / total) * 100 : 0;
                const barHeight = total > 0 ? Math.max(20, (total / maxRuns) * CHART_HEIGHT) : 16;
                const when = new Date(r.createdAt);

                return (
                  <div key={r.id} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end group relative">
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-white border border-brand-200 text-xs text-text-primary rounded-lg p-2 shadow-lg transition-opacity pointer-events-none z-10 whitespace-nowrap">
                      <div className="font-semibold mb-1">Run {idx + 1} · {when.toLocaleString()}</div>
                      <div>Pass: <span className="text-emerald-700 font-bold">{r.summaryPassed}</span></div>
                      <div>Fail: <span className="text-rose-700 font-bold">{r.summaryFailed}</span></div>
                      <div className="text-text-muted capitalize">{r.status?.toLowerCase()}</div>
                    </div>
                    <div
                      className="w-full max-w-[40px] rounded-t-md overflow-hidden flex flex-col justify-end shrink-0 mx-auto"
                      style={{ height: barHeight }}
                    >
                      {percentFailed > 0 && (
                        <div className="bg-rose-500 w-full" style={{ height: `${percentFailed}%` }} />
                      )}
                      {percentPassed > 0 && (
                        <div className="bg-emerald-500 w-full" style={{ height: `${percentPassed}%` }} />
                      )}
                      {total === 0 && (
                        <div className={`w-full h-full ${r.status === 'RUNNING' ? 'bg-amber-400' : 'bg-brand-300'}`} />
                      )}
                    </div>
                    <span className="absolute -bottom-8 text-[9px] leading-tight text-text-secondary text-center w-full px-0.5">
                      {when.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      <br />
                      {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent summary */}
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="text-lg font-bold mb-4 text-text-primary">Quick Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-brand-100">
              <span className="text-text-secondary">Total runs</span>
              <span className="font-semibold text-text-primary">{counters.runs}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-brand-100">
              <span className="text-text-secondary">Success rate</span>
              <span className="font-semibold text-emerald-700">{counters.successRate}%</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-text-secondary">Latest run</span>
              <span className="font-semibold text-text-primary">
                {executions[0]
                  ? new Date(executions[0].startedAt || executions[0].createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Execution history table */}
      <div className="mt-8 glass-card rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-brand-200/50">
          <h3 className="text-lg font-bold text-text-primary">Execution History</h3>
          <p className="text-sm text-text-muted mt-1">All test runs with status, results, and report links.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-50/80 text-left">
                <th className="px-6 py-3 font-semibold text-label">Project</th>
                <th className="px-6 py-3 font-semibold text-label">Date & Time</th>
                <th className="px-6 py-3 font-semibold text-label">Status</th>
                <th className="px-6 py-3 font-semibold text-label text-center">Passed</th>
                <th className="px-6 py-3 font-semibold text-label text-center">Failed</th>
                <th className="px-6 py-3 font-semibold text-label text-center">Total</th>
                <th className="px-6 py-3 font-semibold text-label">Duration</th>
                <th className="px-6 py-3 font-semibold text-label text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-secondary">
                    No executions triggered yet
                  </td>
                </tr>
              ) : (
                executions.map((run: any) => {
                  const st = statusLabel(run.status);
                  return (
                    <tr key={run.id} className="border-t border-brand-100/80 hover:bg-white/60 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-primary">{run.project?.name || '—'}</td>
                      <td className="px-6 py-4 text-text-secondary">
                        {new Date(run.startedAt || run.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${st.className}`}>
                          {run.status === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {run.status === 'FAILED' && <XCircle className="w-3.5 h-3.5" />}
                          {(run.status === 'RUNNING' || run.status === 'PENDING') && <Clock className="w-3.5 h-3.5" />}
                          {st.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-emerald-700">{run.summaryPassed ?? 0}</td>
                      <td className="px-6 py-4 text-center font-semibold text-rose-700">{run.summaryFailed ?? 0}</td>
                      <td className="px-6 py-4 text-center font-semibold text-text-primary">{run.summaryTotal ?? 0}</td>
                      <td className="px-6 py-4 text-text-secondary">{formatDuration(run.durationMs)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={run.status === 'RUNNING' ? `/execution/${run.id}` : `/report/${run.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-brand-200 text-brand-800 hover:bg-brand-50 text-xs font-semibold transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
