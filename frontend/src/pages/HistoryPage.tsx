import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { History, Search, Play, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HistoryPage: React.FC = () => {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  const { projects, setProjects, addToast } = useStore();

  const fetchRuns = () => {
    setLoading(true);
    api.getExecutions(selectedProjectId || undefined)
      .then((data) => {
        setRuns(data);
        setLoading(false);
      })
      .catch((err) => {
        addToast(err.message, 'error');
        setLoading(false);
      });
  };

  useEffect(() => {
    api.getProjects()
      .then((data) => setProjects(data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [selectedProjectId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Passed
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      case 'RUNNING':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Running
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-100 text-text-secondary border border-brand-300/40">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-brand-200/50 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold text-gradient-aqua">Execution History</h2>
          <p className="text-text-muted mt-1">Review historical reports, latency records, and assertion logs.</p>
        </div>

        {/* Filter tools */}
        <div className="flex items-center gap-3 bg-white/50 p-4 border border-brand-200/50 rounded-xl">
          <span className="text-xs font-semibold text-label uppercase tracking-wider">Filter Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-white/85 border border-brand-200/50 rounded-lg px-3 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-brand-500 transition-colors"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin"></div>
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl max-w-md mx-auto p-8 border border-brand-200/60 flex flex-col items-center justify-center">
          <History className="w-12 h-12 text-brand-800 mb-4" />
          <h3 className="text-lg font-bold text-text-secondary">No History Records Found</h3>
          <p className="text-text-secondary text-xs mt-1">Select another filter or launch new automation test runs.</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-brand-300/50 text-label text-[10px] font-bold uppercase tracking-wider text-left">
                  <th className="py-3 px-6">Project Name</th>
                  <th className="py-3 px-6">Environment</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-center">Score (Passed/Total)</th>
                  <th className="py-3 px-6 text-center">Duration</th>
                  <th className="py-3 px-6">Triggered At</th>
                  <th className="py-3 px-6 text-center">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60 font-medium">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-brand-50/10 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-text-primary">{run.project?.name || 'Unknown'}</div>
                      <div className="text-[10px] text-text-secondary mt-0.5 font-mono">{run.id.slice(0, 8)}...</div>
                    </td>
                    <td className="py-4 px-6 text-sm text-text-secondary">
                      {run.environment?.name || <span className="text-brand-700">Default</span>}
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(run.status)}</td>
                    <td className="py-4 px-6 text-center text-sm">
                      <span className="text-emerald-700 font-bold">{run.summaryPassed}</span>
                      <span className="text-brand-700"> / </span>
                      <span className="text-text-primary font-bold">{run.summaryTotal}</span>
                    </td>
                    <td className="py-4 px-6 text-center text-sm text-text-secondary">
                      {run.durationMs ? `${(run.durationMs / 1000).toFixed(2)}s` : '0.00s'}
                    </td>
                    <td className="py-4 px-6 text-xs text-text-secondary">
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <Link
                        to={run.status === 'RUNNING' ? `/execution/${run.id}` : `/report/${run.id}`}
                        className="inline-flex p-1.5 rounded-lg bg-white/85 border border-brand-200/50 text-text-secondary hover:text-brand-700 hover:border-brand-300/40 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
