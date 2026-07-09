import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { reportUrl } from '../config';
import { useStore } from '../store/useStore';
import { Square, Loader, FileText, ChevronRight, Monitor } from 'lucide-react';
import { ExecutionSpanTree, type ExecutionSpan } from '../components/ExecutionSpanTree';

const stripAnsi = (text: string) =>
  text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');

const splitLogLines = (raw: string) =>
  stripAnsi(raw)
    .split('\n')
    .filter((line, i, arr) => line.length > 0 || i < arr.length - 1);

const logLineClass = (log: string) => {
  const t = log.toLowerCase();
  if (t.includes('error') || t.includes('failed') || t.includes('timeout')) return 'console-line console-line-error';
  if (t.includes('[sys]') || t.includes('passed:')) return 'console-line console-line-sys';
  if (t.includes('passed') && !t.includes('failed')) return 'console-line console-line-ok';
  return 'console-line';
};

export const ExecutionConsole: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { activeRun, startActiveRun, clearActiveRun, setActiveLogs, updateActiveRunStatus, addToast } = useStore();
  const [stopping, setStopping] = useState(false);
  const [spans, setSpans] = useState<ExecutionSpan[]>([]);
  const [executionMode, setExecutionMode] = useState<string>('LINEAR');
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [runHeaded, setRunHeaded] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (runId) {
      startActiveRun(runId);
    }
    return () => {
      clearActiveRun();
    };
  }, [runId]);

  // Autoscroll logs
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeRun.logs]);

  useEffect(() => {
    api.getLiveBrowserView().then((v) => {
      if (v?.enabled && v?.url) setLiveViewUrl(v.url);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!runId) return;
    const loadRun = () => {
      api.getExecution(runId).then((run) => {
        setExecutionMode(run.executionMode || 'LINEAR');
        setRunHeaded(Boolean(run.headed));
        if (run.spans?.length) setSpans(run.spans);
        if (run.status) updateActiveRunStatus(run.status);
        if (run.rawLogs) {
          const serverText = stripAnsi(run.rawLogs);
          const localText = useStore.getState().activeRun.logs.join('');
          if (serverText.length > localText.length) {
            setActiveLogs(splitLogLines(run.rawLogs));
          }
        }
      }).catch(() => undefined);
    };
    loadRun();
    const interval = setInterval(loadRun, 2000);
    return () => clearInterval(interval);
  }, [runId, activeRun.status, setActiveLogs, updateActiveRunStatus]);

  useEffect(() => {
    if (activeRun.status === 'COMPLETED' || activeRun.status === 'FAILED') {
      addToast(`Execution completed with status: ${activeRun.status}`);
      if (runId) {
        api.getExecutionSpans(runId).then(setSpans).catch(() => undefined);
      }
    }
  }, [activeRun.status]);

  const handleAbort = () => {
    if (!runId) return;
    setStopping(true);
    api.stopExecution(runId)
      .then(() => {
        addToast('Execution abort request sent');
        setStopping(false);
      })
      .catch((err) => {
        addToast(err.message, 'error');
        setStopping(false);
      });
  };

  const isRunning = activeRun.status === 'RUNNING' || activeRun.status === 'PENDING';

  const isHeadedRun =
    runHeaded ||
    activeRun.logs.some((l) => l.includes('Headed mode requested: true')) ||
    activeRun.logs.some((l) => l.includes('Browser mode: headed'));
  const showLiveView = isRunning && isHeadedRun && liveViewUrl;
  const showHeadlessNote =
    isRunning && activeRun.logs.some((l) => l.includes('Browser mode: headless'));

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col min-h-0">

      {showHeadlessNote && (
        <div className="glass-card p-4 rounded-2xl mb-4 border border-amber-300/50 text-sm text-amber-900">
          Running in <strong>headless</strong> mode. Enable &quot;Headed Mode&quot; on the project page before clicking Run to watch the browser live.
        </div>
      )}

      {showLiveView && (
        <div className="glass-card p-4 rounded-2xl mb-4 border border-brand-300/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-text-primary">
            <Monitor className="w-5 h-5 text-brand-700" />
            <span>Headed test running — watch Chrome live in your browser</span>
          </div>
          <a
            href={liveViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 btn-primary rounded-lg text-xs font-semibold"
          >
            Open Live Browser View
          </a>
        </div>
      )}
      
      {/* Header Info */}
      <div className="glass-card p-6 rounded-2xl mb-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
            {isRunning ? (
              <Loader className="w-6 h-6 text-brand-700 animate-spin" />
            ) : (
              <FileText className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-label uppercase tracking-widest">Active Execution</span>
              <span className="text-[10px] text-brand-700 font-mono">ID: {runId}</span>
            </div>
            <h3 className="text-xl font-bold text-text-primary mt-0.5">
              {executionMode === 'WORKFLOW' ? 'Workflow Interpreter' : 'Playwright Testing Engine'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRunning ? (
            <button
              onClick={handleAbort}
              disabled={stopping}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 rounded-lg text-xs font-semibold active:scale-95 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-rose-400/20" />
              <span>{stopping ? 'Stopping...' : 'Abort Execution'}</span>
            </button>
          ) : (
            <>
              <a
                href={reportUrl(`/api/reports/allure/${runId}/index.html`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-500/20 hover:border-amber-500/30 rounded-lg text-xs font-semibold transition-all"
              >
                <span>Allure Report</span>
              </a>
              <button
                onClick={() => navigate(`/report/${runId}`)}
                className="flex items-center gap-1.5 px-5 py-2.5 btn-primary text-white rounded-lg text-xs font-semibold active:scale-95 shadow-lg shadow-brand-500/10 transition-all"
              >
                <span>View Full Report</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {executionMode === 'WORKFLOW' && (
        <div className="glass-card p-6 rounded-2xl mb-6">
          <h4 className="text-xs font-bold text-label uppercase tracking-wider mb-3">Execution Trace</h4>
          <ExecutionSpanTree spans={spans} />
        </div>
      )}

      <div className="flex-1 console-panel rounded-2xl p-6 flex flex-col overflow-hidden mb-6 h-[400px]">
        <div className="console-header flex items-center justify-between pb-3 mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider">Console Log Output</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-amber-400 animate-pulse' : activeRun.status === 'FAILED' ? 'bg-rose-400' : activeRun.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{activeRun.status || 'IDLE'}</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-2 select-text">
          {activeRun.logs.length === 0 ? (
            <div className="console-line-sys animate-pulse">Initializing runner environments...</div>
          ) : (
            activeRun.logs.map((log, idx) => {
              const clean = stripAnsi(log);
              return (
                <pre key={idx} className={logLineClass(clean)}>
                  {clean}
                </pre>
              );
            })
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>

    </div>
  );
};
