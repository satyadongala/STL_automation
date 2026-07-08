import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { reportUrl } from '../config';
import { useStore } from '../store/useStore';
import {
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Terminal, ShieldAlert, Check, AlertCircle, Database,
  Clock, Zap
} from 'lucide-react';

// Safe JSON formatter — handles strings, objects, null, undefined
const formatJSON = (value: any): string => {
  try {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    const str = String(value).trim();
    if (!str || str === '{}' || str === '[]' || str === 'null') return str;
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return String(value ?? '');
  }
};

// Safe JSON parser — always returns a value, never throws
const safeParseJSON = (value: any, fallback: any = null): any => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};

const getMethodColor = (method: string = '') => {
  switch (method.toUpperCase()) {
    case 'UI':     return 'text-indigo-800';
    case 'GET':    return 'text-sky-800';
    case 'POST':   return 'text-emerald-800';
    case 'PUT':    return 'text-amber-800';
    case 'DELETE': return 'text-rose-800';
    case 'PATCH':  return 'text-purple-800';
    default:       return 'text-text-primary';
  }
};

const isUiTest = (result: any, request: any) =>
  result?.testCase?.testType === 'UI' ||
  result?.testCase?.method === 'UI' ||
  String(request?.method ?? '').toUpperCase() === 'UI';

const parseUiSteps = (body: any): any[] => {
  const raw = typeof body === 'string' ? safeParseJSON(body, []) : body;
  return Array.isArray(raw) ? raw : [];
};

const parsePageState = (body: any): { url?: string; title?: string } =>
  safeParseJSON(body, {});

const formatUiStep = (step: any, idx: number) => {
  const action = step.action || 'step';
  const selector = step.selector ? ` → ${step.selector}` : '';
  const value = step.value ? ` = "${step.value}"` : '';
  return `${idx + 1}. ${action}${selector}${value}`;
};

const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'text-emerald-700';
  if (status >= 300 && status < 400) return 'text-amber-700';
  if (status >= 400) return 'text-rose-700';
  return 'text-text-primary';
};

export const ReportViewer: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [showFullLogs, setShowFullLogs] = useState(false);
  const { addToast } = useStore();

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    api.getExecution(runId)
      .then((data) => {
        setRun(data);
        if (data?.results?.length > 0) {
          setSelectedResultId(data.results[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        const msg = err?.response?.data?.error || err.message || 'Failed to load report';
        setError(msg);
        addToast(msg, 'error');
        setLoading(false);
      });
  }, [runId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin" />
          <p className="text-text-secondary text-sm">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500/60 mb-4" />
        <h3 className="text-xl font-bold text-text-primary">Report Not Found</h3>
        <p className="text-text-secondary text-sm mt-2">{error || 'The requested run could not be found.'}</p>
        <Link to="/history" className="mt-6 px-5 py-2 bg-brand-600 rounded-xl text-sm text-white hover:bg-brand-500 transition-colors">
          Back to History
        </Link>
      </div>
    );
  }

  const selectedResult = run.results?.find((r: any) => r.id === selectedResultId) ?? null;

  // Pre-parse all JSON fields for the selected result to avoid crashes in JSX
  const parsedRequest  = safeParseJSON(selectedResult?.requestSent, {});
  const parsedResponse = safeParseJSON(selectedResult?.responseReceived, {});
  const assertions     = safeParseJSON(selectedResult?.assertionResults, []);
  const uiTest         = selectedResult ? isUiTest(selectedResult, parsedRequest) : false;
  const uiSteps        = uiTest ? parseUiSteps(parsedRequest.body) : [];
  const pageState      = uiTest ? parsePageState(parsedResponse.body) : {};

  const passedCount = run.summaryPassed ?? 0;
  const totalCount  = run.summaryTotal ?? 0;
  const passRate    = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
  const reportsReady = run.status === 'COMPLETED' || run.status === 'FAILED';

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 max-w-full min-h-0">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-5 flex-shrink-0">
        <Link
          to={`/projects/${run.projectId}`}
          className="p-2 rounded-xl bg-white border border-brand-200 text-brand-800 hover:text-brand-900 hover:border-brand-400 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>

        <div className="min-w-0">
          <h2 className="text-xl font-bold text-text-primary">Execution Report</h2>
          <div className="text-xs text-text-muted mt-0.5 flex items-center gap-2 flex-wrap">
            <span>Project: <span className="font-semibold text-text-primary">{run.project?.name ?? '—'}</span></span>
            <span>•</span>
            <span>Env: <span className="font-semibold text-text-primary">{run.environment?.name ?? 'Default'}</span></span>
            <span>•</span>
            <span>{new Date(run.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Summary chips */}
        <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0">
          {reportsReady && (
            <>
              <a
                href={reportUrl(`/api/reports/allure/${run.id}/index.html`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-bold text-xs rounded-xl px-4 py-2.5 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" />
                Allure Report
              </a>
              <a
                href={reportUrl(`/api/reports/html/${run.id}/index.html`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-800 font-bold text-xs rounded-xl px-4 py-2.5 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" />
                Playwright HTML Report
              </a>
            </>
          )}
          <div className="flex items-center gap-2 bg-white border border-brand-200 rounded-xl px-4 py-2 shadow-sm">
            <Zap className="w-4 h-4 text-brand-700" />
            <div>
              <div className="text-[10px] text-label font-bold uppercase tracking-wider">Score</div>
              <div className="text-sm font-bold mt-0.5 text-text-primary">
                <span className="text-emerald-700">{passedCount}</span>
                <span className="text-text-muted"> / </span>
                <span className="text-text-primary">{totalCount}</span>
                <span className="text-text-muted ml-1">({passRate}%)</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white border border-brand-200 rounded-xl px-4 py-2 shadow-sm">
            <Clock className="w-4 h-4 text-brand-700" />
            <div>
              <div className="text-[10px] text-label font-bold uppercase tracking-wider">Duration</div>
              <div className="text-sm font-bold text-text-primary mt-0.5">{(run.durationMs / 1000).toFixed(2)}s</div>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
            run.status === 'COMPLETED'
              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
              : run.status === 'RUNNING'
              ? 'bg-brand-100 border-brand-300 text-brand-800'
              : 'bg-rose-100 border-rose-300 text-rose-800'
          }`}>
            {run.status}
          </div>
        </div>

      </div>

      {/* ── Main Split Pane ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-5 overflow-hidden min-h-0">

        {/* Left: Step List */}
        <div className="lg:col-span-1 glass-card rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-brand-200 font-bold text-text-primary text-sm flex-shrink-0">
            Executed Steps ({run.results?.length ?? 0})
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-brand-100">
            {(run.results ?? []).map((res: any) => {
              const isActive  = res.id === selectedResultId;
              const isPassed  = res.status === 'PASSED';
              const method    = res.testCase?.method ?? '';
              const path      = res.testCase?.path ?? '';
              const name      = res.testCase?.name ?? 'Unnamed';
              return (
                <div
                  key={res.id}
                  onClick={() => { setSelectedResultId(res.id); setShowFullLogs(false); }}
                  className={`p-4 cursor-pointer transition-all flex items-center justify-between gap-2 ${
                    isActive ? 'bg-brand-100 border-l-2 border-brand-600' : 'hover:bg-brand-50 border-l-2 border-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] font-bold uppercase font-mono ${getMethodColor(method)}`}>
                        {method}
                      </span>
                      <span className="text-xs text-text-muted truncate font-mono">{path}</span>
                    </div>
                    <div className="font-semibold text-sm text-text-primary truncate">{name}</div>
                    <div className="text-[10px] text-brand-700 mt-0.5">{res.durationMs}ms</div>
                  </div>
                  <div className="flex-shrink-0">
                    {isPassed
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                      : <XCircle className="w-5 h-5 text-rose-700" />
                    }
                  </div>
                </div>
              );
            })}

            {/* Raw Logs trigger */}
            <div
              onClick={() => { setSelectedResultId(null); setShowFullLogs(true); }}
              className={`p-4 cursor-pointer transition-colors flex items-center justify-between border-t border-brand-200 ${
                showFullLogs ? 'bg-brand-100 border-l-2 border-brand-600' : 'hover:bg-brand-50 border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-brand-700" />
                <span className="font-bold text-sm text-text-primary">Playwright Stdout</span>
              </div>
              <ChevronRight className="w-4 h-4 text-brand-700" />
            </div>
          </div>
        </div>

        {/* Right: Detail Pane */}
        <div className="lg:col-span-2 glass-card rounded-2xl flex flex-col overflow-hidden">

          {showFullLogs ? (
            <div className="flex-1 flex flex-col overflow-hidden p-6">
              <h3 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2 border-b border-slate-900 pb-3 flex-shrink-0">
                <Terminal className="w-5 h-5 text-brand-700" />
                Playwright Console Output
              </h3>
              <pre className="flex-1 console-panel rounded-xl p-4 overflow-auto console-line">
                {(run.rawLogs || 'No logs captured.').replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')}
              </pre>
            </div>

          ) : selectedResult ? (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Banner */}
              <div className="p-5 border-b border-brand-200 flex justify-between items-start gap-4 flex-shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-text-primary truncate">
                    {selectedResult.testCase?.name ?? 'Test Case'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-text-primary mt-1 flex-wrap">
                    <span className={`font-bold ${getMethodColor(selectedResult.testCase?.method)}`}>
                      {selectedResult.testCase?.method}
                    </span>
                    <span className="truncate text-text-muted">{selectedResult.testCase?.path}</span>
                    <span className="text-text-muted">•</span>
                    <span className="font-semibold">{selectedResult.durationMs}ms</span>
                    {!uiTest && parsedResponse.status != null && parsedResponse.status !== 0 && (
                      <>
                        <span className="text-text-muted">•</span>
                        <span className={`font-bold ${getStatusColor(parsedResponse.status)}`}>
                          HTTP {parsedResponse.status}
                        </span>
                      </>
                    )}
                    {uiTest && pageState.title && (
                      <>
                        <span className="text-text-muted">•</span>
                        <span className="font-semibold text-indigo-800">Page: {pageState.title}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {selectedResult.status === 'PASSED' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Check className="w-3.5 h-3.5" /> Passed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                      <AlertCircle className="w-3.5 h-3.5" /> Failed
                    </span>
                  )}
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* Error Banner */}
                {selectedResult.errorMessage && (
                  <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex gap-3 text-xs text-rose-900">
                    <ShieldAlert className="w-5 h-5 text-rose-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold mb-1 text-rose-900">Execution Error</div>
                      <pre className="whitespace-pre-wrap font-mono break-all text-rose-800">{selectedResult.errorMessage}</pre>
                    </div>
                  </div>
                )}

                {/* Assertions / UI steps */}
                <Section title={uiTest ? 'UI Steps Outcome' : 'Assertions Outcome'}>
                  {assertions.length === 0 ? (
                    <div className="text-xs text-text-muted italic p-3 bg-white border border-brand-200 rounded-xl">
                      {uiTest ? 'No UI steps recorded.' : 'No custom assertions configured.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assertions.map((ass: any, idx: number) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${
                            ass.passed
                              ? 'bg-emerald-50 border-emerald-300'
                              : 'bg-rose-50 border-rose-300'
                          }`}
                        >
                          {ass.passed
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                            : <XCircle className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
                          }
                          <div className="space-y-1 min-w-0 text-text-primary">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-brand-900 uppercase tracking-wider text-[10px] bg-white border border-brand-300 px-1.5 py-0.5 rounded">
                                {ass.type === 'ui_step'
                                  ? String(ass.action ?? 'step').replace(/_/g, ' ')
                                  : String(ass.type ?? ass.label ?? 'step').replace(/_/g, ' ')}
                              </span>
                              {ass.label && ass.type === 'ui_step' && (
                                <span className="font-semibold text-text-primary">{ass.label}</span>
                              )}
                              {ass.type === 'json_path' && (
                                <span className="font-mono text-text-primary">{ass.path} <span className="text-brand-800 font-semibold">{ass.operator}</span></span>
                              )}
                              {ass.type === 'header' && ass.headerName && (
                                <span className="font-mono text-text-primary">{ass.headerName}</span>
                              )}
                              {ass.label && ass.type !== 'ui_step' && ass.type !== ass.label && (
                                <span className="font-semibold text-text-primary">{ass.label}</span>
                              )}
                              {ass.selector && (
                                <span className="font-mono text-text-muted truncate">{ass.selector}</span>
                              )}
                            </div>
                            <div className="flex items-start gap-4 flex-wrap">
                              {(ass.expected !== undefined && ass.expected !== '') && (
                                <div>
                                  <span className="font-semibold text-text-muted">{uiTest || ass.type === 'ui_step' ? 'Value: ' : 'Expected: '}</span>
                                  <span className="font-mono font-semibold text-text-primary">
                                    {String(ass.expected ?? ass.value ?? '')}
                                    {ass.resolvedExpected && ass.resolvedExpected !== ass.expected && (
                                      <span className="text-text-muted text-[10px] ml-1 italic">
                                        → {String(ass.resolvedExpected)}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              {ass.actual !== undefined && ass.actual !== null && ass.actual !== '' && (
                                <div>
                                  <span className="font-semibold text-text-muted">Actual: </span>
                                  <span className={`font-mono font-semibold ${ass.passed ? 'text-emerald-800' : 'text-rose-800'}`}>
                                    {String(ass.actual)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {uiTest ? (
                  <>
                    <Section title="Browser Session">
                      <div className="space-y-3">
                        <CodeBlock label="Start URL">
                          {parsedRequest.url ?? '—'}
                        </CodeBlock>
                        {uiSteps.length > 0 ? (
                          <div className="bg-white border border-brand-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="text-[10px] font-bold text-label uppercase px-3 py-1.5 border-b border-brand-200 bg-brand-50">
                              UI Steps Executed ({uiSteps.length})
                            </div>
                            <div className="p-3 space-y-1.5 max-h-72 overflow-auto">
                              {uiSteps.map((step: any, idx: number) => (
                                <div key={idx} className="text-xs font-mono text-text-primary py-1 border-b border-brand-50 last:border-0">
                                  {formatUiStep(step, idx)}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <CodeBlock label="UI Steps">
                            {formatJSON(parsedRequest.body)}
                          </CodeBlock>
                        )}
                      </div>
                    </Section>

                    <Section title="Page Result">
                      <div className="space-y-3">
                        <CodeBlock label="Final URL">
                          {pageState.url ?? parsedResponse.url ?? '—'}
                        </CodeBlock>
                        <CodeBlock label="Page Title">
                          {pageState.title ?? '—'}
                        </CodeBlock>
                        <CodeBlock label="Test Result">
                          <span className={selectedResult.status === 'PASSED' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                            {selectedResult.status === 'PASSED' ? 'All UI steps passed' : 'One or more UI steps failed'}
                          </span>
                        </CodeBlock>
                      </div>
                    </Section>
                  </>
                ) : (
                  <>
                    <Section title="Request Details">
                      <div className="space-y-3">
                        <CodeBlock label="URL">
                          {parsedRequest.url ?? '—'}
                        </CodeBlock>
                        <CodeBlock label="Headers">
                          {formatJSON(parsedRequest.headers)}
                        </CodeBlock>
                        {parsedRequest.body != null && parsedRequest.body !== '' && parsedRequest.body !== 'null' && (
                          <CodeBlock label="Body">
                            {formatJSON(parsedRequest.body)}
                          </CodeBlock>
                        )}
                      </div>
                    </Section>

                    <Section title="Response Details">
                      <div className="space-y-3">
                        <CodeBlock label="Status">
                          <span className={getStatusColor(parsedResponse.status)}>
                            {parsedResponse.status ?? '—'}
                          </span>
                        </CodeBlock>
                        <CodeBlock label="Headers">
                          {formatJSON(parsedResponse.headers)}
                        </CodeBlock>
                        <CodeBlock label="Body" maxH="max-h-72">
                          {formatJSON(parsedResponse.body)}
                        </CodeBlock>
                      </div>
                    </Section>
                  </>
                )}

              </div>
            </div>

          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-secondary">
              <Database className="w-10 h-10 text-brand-800 mb-3" />
              <h4 className="text-sm">Select a test step on the left to view {run.project?.projectType === 'UI' ? 'UI step details and page results' : 'HTTP details and assertion outcomes'}.</h4>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ── Small sub-components ────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="text-[11px] font-bold text-label uppercase tracking-widest mb-3">{title}</h4>
    {children}
  </div>
);

const CodeBlock: React.FC<{ label: string; children: React.ReactNode; maxH?: string }> = ({
  label, children, maxH = 'max-h-48'
}) => (
  <div className="bg-white border border-brand-200 rounded-xl overflow-hidden shadow-sm">
    <div className="text-[10px] font-bold text-label uppercase px-3 py-1.5 border-b border-brand-200 bg-brand-50">
      {label}
    </div>
    <pre className={`text-xs font-mono text-text-primary p-3 overflow-auto whitespace-pre-wrap select-text ${maxH}`}>
      {children}
    </pre>
  </div>
);
