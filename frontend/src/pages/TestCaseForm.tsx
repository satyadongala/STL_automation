import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { Save, X, Plus, Trash2 } from 'lucide-react';

type TestType = 'API' | 'UI';
type ApiTab = 'headers' | 'params' | 'body' | 'assertions' | 'extraction';

import { UiStepEditor, type UiStep } from '../components/UiStepEditor';

const safeParse = <T,>(value: string | undefined | null, fallback: T): T => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const TestCaseForm: React.FC = () => {
  const { projectId, id: testCaseId } = useParams<{ projectId: string; id?: string }>();
  const navigate = useNavigate();
  const { addToast } = useStore();

  const [loading, setLoading] = useState(!!testCaseId);
  const [projectType, setProjectType] = useState<'API' | 'UI' | null>(null);
  const [testType, setTestType] = useState<TestType>('API');
  const [activeTab, setActiveTab] = useState<ApiTab>('headers');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('');
  const [body, setBody] = useState('');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [params, setParams] = useState<{ key: string; value: string }[]>([]);
  const [assertions, setAssertions] = useState<any[]>([]);
  const [extractions, setExtractions] = useState<any[]>([]);
  const [uiSteps, setUiSteps] = useState<UiStep[]>([]);

  useEffect(() => {
    if (!projectId) return;

    if (!testCaseId) {
      setLoading(true);
      api.getProject(projectId)
        .then((p) => {
          const type = p.projectType === 'UI' ? 'UI' : 'API';
          setProjectType(type);
          setTestType(type);
          if (type === 'UI') setMethod('GET');
          setLoading(false);
        })
        .catch((err) => {
          addToast(err.message, 'error');
          setLoading(false);
        });
      return;
    }

    setLoading(true);
    Promise.all([api.getProject(projectId), api.getTestCase(testCaseId)])
      .then(([p, tc]) => {
        const projType = p.projectType === 'UI' ? 'UI' : 'API';
        setProjectType(projType);
        const loadedType = tc.testType === 'UI' || tc.method === 'UI' ? 'UI' : 'API';
        setTestType(loadedType);
        setName(tc.name);
        setDescription(tc.description || '');
        setMethod(loadedType === 'UI' ? 'GET' : tc.method);
        setPath(tc.path);
        setBody(tc.body || '');
        setHeaders(Object.entries(safeParse<Record<string, string>>(tc.headers, {})).map(([k, v]) => ({ key: k, value: String(v) })));
        setParams(Object.entries(safeParse<Record<string, string>>(tc.queryParams, {})).map(([k, v]) => ({ key: k, value: String(v) })));
        setAssertions(safeParse<any[]>(tc.assertions, []));
        setExtractions(safeParse<any[]>(tc.variablesToExtract, []));
        setUiSteps(safeParse<UiStep[]>(tc.uiSteps, []));
        setLoading(false);
      })
      .catch((err) => {
        addToast(err.message, 'error');
        setLoading(false);
      });
  }, [projectId, testCaseId]);

  const keyValueToObject = (rows: { key: string; value: string }[]) => {
    const obj: Record<string, string> = {};
    rows.forEach((row) => {
      if (row.key.trim()) obj[row.key.trim()] = row.value;
    });
    return obj;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      addToast('Test name is required', 'error');
      return;
    }
    if (testType === 'API' && !path) {
      addToast('Endpoint path is required', 'error');
      return;
    }

    if (testType === 'API' && body.trim() && method !== 'GET') {
      try {
        JSON.parse(body);
      } catch {
        addToast('Warning: Request body is not valid JSON, but will be saved.', 'info');
      }
    }

    const payload = {
      projectId: projectId!,
      testType: projectType ?? testType,
      name,
      description,
      method: testType === 'UI' ? 'UI' : method,
      path,
      headers: testType === 'API' ? keyValueToObject(headers) : {},
      queryParams: testType === 'API' ? keyValueToObject(params) : {},
      body: testType === 'API' && method !== 'GET' && body.trim() ? body.trim() : null,
      assertions: testType === 'API' ? assertions : [],
      variablesToExtract: testType === 'API' ? extractions : [],
      uiSteps: testType === 'UI' ? uiSteps : []
    };

    const action = testCaseId
      ? api.updateTestCase(testCaseId, payload)
      : api.createTestCase(payload);

    action
      .then(() => {
        addToast(`${testType} test case successfully ${testCaseId ? 'updated' : 'created'}`);
        navigate(`/projects/${projectId}`);
      })
      .catch((err) => addToast(err.message, 'error'));
  };

  const addHeaderRow = () => setHeaders([...headers, { key: '', value: '' }]);
  const removeHeaderRow = (idx: number) => setHeaders(headers.filter((_, i) => i !== idx));
  const updateHeaderRow = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...headers];
    updated[idx][field] = val;
    setHeaders(updated);
  };

  const addParamRow = () => setParams([...params, { key: '', value: '' }]);
  const removeParamRow = (idx: number) => setParams(params.filter((_, i) => i !== idx));
  const updateParamRow = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...params];
    updated[idx][field] = val;
    setParams(updated);
  };

  const addAssertion = (type: 'status_code' | 'response_time' | 'json_path' | 'header') => {
    const newAss: any = { type };
    if (type === 'status_code') newAss.expected = '200';
    if (type === 'response_time') newAss.expected = '500';
    if (type === 'json_path') {
      newAss.path = '$.data';
      newAss.operator = 'equals';
      newAss.expected = '';
    }
    if (type === 'header') {
      newAss.headerName = 'Content-Type';
      newAss.expected = 'application/json';
    }
    setAssertions([...assertions, newAss]);
  };
  const removeAssertion = (idx: number) => setAssertions(assertions.filter((_, i) => i !== idx));
  const updateAssertion = (idx: number, field: string, val: string) => {
    const updated = [...assertions];
    updated[idx][field] = val;
    setAssertions(updated);
  };

  const addExtraction = () => setExtractions([...extractions, { path: '$.data.id', variableName: 'newVariable' }]);
  const removeExtraction = (idx: number) => setExtractions(extractions.filter((_, i) => i !== idx));
  const updateExtraction = (idx: number, field: 'path' | 'variableName', val: string) => {
    const updated = [...extractions];
    updated[idx][field] = val;
    setExtractions(updated);
  };

  const addUiStep = () => setUiSteps(prev => [...prev, { action: 'click', selector: '', value: '', variableName: '', locatorType: 'css' }]);
  const removeUiStep = (idx: number) => setUiSteps(prev => prev.filter((_, i) => i !== idx));
  const updateUiStep = (idx: number, field: keyof UiStep, val: any) => {
    setUiSteps(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  if (loading || !projectType) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin"></div>
      </div>
    );
  }

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8 border-b border-brand-200/50 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold text-gradient-aqua">
            {testCaseId ? 'Modify Test Case' : `New ${testType} Test Case`}
          </h2>
          <p className="text-text-muted mt-1">
            {testType === 'UI'
              ? 'Configure browser actions, selectors, URL checks, screenshots, and extracted UI text.'
              : 'Configure path, request headers, bodies, JSON path assertions, and variable extractions.'}
          </p>
        </div>
        <Link to={`/projects/${projectId}`} className="p-2 rounded-xl bg-white/85 border border-brand-200/50 text-text-secondary hover:text-brand-700">
          <X className="w-5 h-5" />
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {testType === 'API' && (
              <div className="w-full md:w-48">
                <label className="block text-xs font-semibold text-label uppercase tracking-wider mb-2">HTTP Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full bg-white/85 border border-brand-200/50 rounded-xl px-4 py-3 text-sm font-bold text-text-primary outline-none focus:border-brand-500"
                >
                  {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}

            <div className="flex-1">
              <label className="block text-xs font-semibold text-label uppercase tracking-wider mb-2">
                {testType === 'UI' ? 'Start URL or Path' : 'Endpoint Path *'}
              </label>
              <input
                type="text"
                required={testType === 'API'}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder={testType === 'UI' ? '/login or https://app.example.com/login' : '/api/v1/users or /api/posts/{{ postId }}'}
                className="w-full bg-white/85 border border-brand-200/50 rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-label uppercase tracking-wider mb-2">Test Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={testType === 'UI' ? 'e.g. Login form accepts valid user' : 'e.g. Create User successfully'}
                className="w-full bg-white/85 border border-brand-200/50 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-label uppercase tracking-wider mb-2">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe assertions or sequence role..."
                className="w-full bg-white/85 border border-brand-200/50 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {testType === 'UI' ? (
          <>
            <FormActionBar projectId={projectId!} />
            <UiStepEditor projectId={projectId} steps={uiSteps} onAdd={addUiStep} onRemove={removeUiStep} onUpdate={updateUiStep} />
          </>
        ) : (
          <>
            <div className="flex border-b border-brand-200/50 gap-2">
              {(['headers', 'params', 'body', 'assertions', 'extraction'] as const).map((tab) => {
                if (tab === 'body' && method === 'GET') return null;
                const labels = {
                  headers: 'Headers',
                  params: 'Query Params',
                  body: 'Request Body',
                  assertions: `Assertions (${assertions.length})`,
                  extraction: `Variables Extract (${extractions.length})`
                };
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                      activeTab === tab ? 'border-brand-500 text-brand-800 bg-brand-500/5' : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            <div className="glass-card p-6 rounded-2xl min-h-[220px]">
              {activeTab === 'headers' && (
                <KeyValueEditor title="Custom Request Headers" rows={headers} onAdd={addHeaderRow} onRemove={removeHeaderRow} onUpdate={updateHeaderRow} emptyText="No custom headers. Uses default project/env headers." />
              )}
              {activeTab === 'params' && (
                <KeyValueEditor title="Query Parameters" rows={params} onAdd={addParamRow} onRemove={removeParamRow} onUpdate={updateParamRow} emptyText="No custom URL parameters." />
              )}
              {activeTab === 'body' && method !== 'GET' && (
                <div className="space-y-2 h-full flex flex-col">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-label uppercase tracking-wider">JSON Request Body</span>
                    <span className="text-[10px] text-text-secondary">Supports variables: {'{{ variable }}'}</span>
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={'{\n  "email": "test@example.com",\n  "name": "{{ randomName }}"\n}'}
                    rows={6}
                    className="w-full flex-1 bg-white/85 border border-brand-200/50 rounded-xl p-4 text-xs font-mono text-text-primary outline-none focus:border-brand-500 resize-none"
                  />
                </div>
              )}
              {activeTab === 'assertions' && (
                <AssertionsEditor assertions={assertions} onAdd={addAssertion} onRemove={removeAssertion} onUpdate={updateAssertion} />
              )}
              {activeTab === 'extraction' && (
                <ExtractionEditor extractions={extractions} onAdd={addExtraction} onRemove={removeExtraction} onUpdate={updateExtraction} />
              )}
            </div>
          </>
        )}

        <FormActionBar projectId={projectId!} />
      </form>
    </div>
  );
};

const FormActionBar: React.FC<{ projectId: string }> = ({ projectId }) => (
  <div className="glass-card p-6 rounded-2xl flex justify-end gap-3">
    <Link to={`/projects/${projectId}`} className="px-5 py-2.5 border border-brand-200/50 rounded-xl text-text-secondary hover:text-brand-700 hover:bg-brand-50 text-sm font-medium transition-colors">
      Cancel
    </Link>
    <button type="submit" className="flex items-center gap-2 px-6 py-2.5 rounded-xl btn-primary font-semibold text-sm shadow-md hover:shadow-brand-500/10 transition-all">
      <Save className="w-4 h-4" />
      <span>Save Test Case</span>
    </button>
  </div>
);

const KeyValueEditor: React.FC<{
  title: string;
  rows: { key: string; value: string }[];
  emptyText: string;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: 'key' | 'value', val: string) => void;
}> = ({ title, rows, emptyText, onAdd, onRemove, onUpdate }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <span className="text-xs font-bold text-label uppercase tracking-wider">{title}</span>
      <button type="button" onClick={onAdd} className="text-xs text-brand-800 hover:text-brand-700 font-bold flex items-center gap-1 uppercase tracking-wider">
        <Plus className="w-3.5 h-3.5" /> Add
      </button>
    </div>
    {rows.length === 0 ? (
      <div className="text-center py-8 text-brand-700 text-xs">{emptyText}</div>
    ) : (
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input value={row.key} onChange={(e) => onUpdate(i, 'key', e.target.value)} placeholder="Key" className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-xs outline-none" />
            <input value={row.value} onChange={(e) => onUpdate(i, 'value', e.target.value)} placeholder="Value" className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-xs outline-none" />
            <button type="button" onClick={() => onRemove(i)} className="p-1.5 rounded-xl bg-white/85 border border-brand-200/50 text-text-secondary hover:text-rose-700">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const AssertionsEditor: React.FC<{
  assertions: any[];
  onAdd: (type: 'status_code' | 'response_time' | 'json_path' | 'header') => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: string, val: string) => void;
}> = ({ assertions, onAdd, onRemove, onUpdate }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center border-b border-brand-200/50 pb-3">
      <span className="text-xs font-bold text-label uppercase tracking-wider">Test Assertions</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => onAdd('status_code')} className="px-2.5 py-1 rounded bg-white/85 border border-brand-200/50 hover:border-brand-500 text-[10px] font-bold text-text-primary">+ Status</button>
        <button type="button" onClick={() => onAdd('response_time')} className="px-2.5 py-1 rounded bg-white/85 border border-brand-200/50 hover:border-brand-500 text-[10px] font-bold text-text-primary">+ Latency</button>
        <button type="button" onClick={() => onAdd('json_path')} className="px-2.5 py-1 rounded bg-white/85 border border-brand-200/50 hover:border-brand-500 text-[10px] font-bold text-text-primary">+ JSON Path</button>
        <button type="button" onClick={() => onAdd('header')} className="px-2.5 py-1 rounded bg-white/85 border border-brand-200/50 hover:border-brand-500 text-[10px] font-bold text-text-primary">+ Header</button>
      </div>
    </div>
    {assertions.length === 0 ? (
      <div className="text-center py-8 text-brand-700 text-xs">No assertions defined.</div>
    ) : (
      <div className="space-y-3">
        {assertions.map((ass, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center bg-white/50 p-3 rounded-xl border border-brand-200/50">
            <span className="px-2.5 py-1 rounded bg-brand-600/10 text-brand-800 border border-brand-500/20 text-[10px] font-bold uppercase tracking-wider">{ass.type.replace('_', ' ')}</span>
            {(ass.type === 'status_code' || ass.type === 'response_time') && <input type="number" value={ass.expected} onChange={(e) => onUpdate(i, 'expected', e.target.value)} className="w-24 bg-white/85 border border-brand-200/50 rounded px-2 py-1 text-xs outline-none" />}
            {ass.type === 'json_path' && (
              <>
                <input value={ass.path} onChange={(e) => onUpdate(i, 'path', e.target.value)} placeholder="$.data.id" className="bg-white/85 border border-brand-200/50 rounded px-2 py-1 text-xs outline-none font-mono flex-grow min-w-[120px]" />
                <select value={ass.operator} onChange={(e) => onUpdate(i, 'operator', e.target.value)} className="bg-white/85 border border-brand-200/50 rounded px-2 py-1 text-xs outline-none text-text-primary font-bold">
                  <option value="equals">equals</option>
                  <option value="contains">contains</option>
                  <option value="exists">exists</option>
                  <option value="not_exists">not exists</option>
                </select>
                {ass.operator !== 'exists' && ass.operator !== 'not_exists' && <input value={ass.expected} onChange={(e) => onUpdate(i, 'expected', e.target.value)} placeholder="Expected value" className="bg-white/85 border border-brand-200/50 rounded px-2 py-1 text-xs outline-none flex-grow min-w-[100px]" />}
              </>
            )}
            {ass.type === 'header' && (
              <>
                <input value={ass.headerName} onChange={(e) => onUpdate(i, 'headerName', e.target.value)} placeholder="Header Key" className="bg-white/85 border border-brand-200/50 rounded px-2 py-1 text-xs outline-none font-mono flex-grow" />
                <input value={ass.expected} onChange={(e) => onUpdate(i, 'expected', e.target.value)} placeholder="Expected string" className="bg-white/85 border border-brand-200/50 rounded px-2 py-1 text-xs outline-none flex-grow" />
              </>
            )}
            <button type="button" onClick={() => onRemove(i)} className="p-1 rounded bg-white/85 border border-brand-200/50 text-text-secondary hover:text-rose-700 ml-auto">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ExtractionEditor: React.FC<{
  extractions: any[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: 'path' | 'variableName', val: string) => void;
}> = ({ extractions, onAdd, onRemove, onUpdate }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center border-b border-brand-200/50 pb-3">
      <span className="text-xs font-bold text-label uppercase tracking-wider">Extract response payload into variables</span>
      <button type="button" onClick={onAdd} className="text-xs text-brand-800 hover:text-brand-700 font-bold flex items-center gap-1 uppercase tracking-wider">
        <Plus className="w-3.5 h-3.5" /> Add Rule
      </button>
    </div>
    {extractions.length === 0 ? (
      <div className="text-center py-8 text-brand-700 text-xs">No variables extracted from response.</div>
    ) : (
      <div className="space-y-2">
        {extractions.map((ext, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input value={ext.path} onChange={(e) => onUpdate(i, 'path', e.target.value)} placeholder="JSON Path" className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-xs outline-none font-mono" />
            <input value={ext.variableName} onChange={(e) => onUpdate(i, 'variableName', e.target.value)} placeholder="Variable name" className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-xs outline-none" />
            <button type="button" onClick={() => onRemove(i)} className="p-1.5 rounded-xl bg-white/85 border border-brand-200/50 text-text-secondary hover:text-rose-700">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);
