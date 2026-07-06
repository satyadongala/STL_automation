import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { Sliders, Plus, Edit3, Trash2, X, Check, Save } from 'lucide-react';

export const EnvironmentsPage: React.FC = () => {
  const { projects, setProjects, addToast } = useStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [environments, setEnvironments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit / Create form state
  const [isEditing, setIsEditing] = useState(false);
  const [currentEnv, setCurrentEnv] = useState<any>(null);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [variables, setVariables] = useState<{ key: string; value: string }[]>([]);

  useEffect(() => {
    api.getProjects()
      .then((data) => {
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      })
      .catch((err) => addToast(err.message, 'error'));
  }, []);

  const loadEnvironments = (projId: string) => {
    if (!projId) return;
    setLoading(true);
    api.getEnvironments(projId)
      .then((data) => {
        setEnvironments(data);
        setLoading(false);
      })
      .catch((err) => {
        addToast(err.message, 'error');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadEnvironments(selectedProjectId);
      cancelEdit();
    }
  }, [selectedProjectId]);

  const startCreate = () => {
    setCurrentEnv(null);
    setName('');
    setBaseUrl('');
    setHeaders([{ key: '', value: '' }]);
    setVariables([{ key: '', value: '' }]);
    setIsEditing(true);
  };

  const startEdit = (env: any) => {
    setCurrentEnv(env);
    setName(env.name);
    setBaseUrl(env.baseUrl);

    const parsedHeaders = JSON.parse(env.headers || '{}');
    const headerList = Object.entries(parsedHeaders).map(([k, v]) => ({ key: k, value: String(v) }));
    setHeaders(headerList.length > 0 ? headerList : [{ key: '', value: '' }]);

    const parsedVars = JSON.parse(env.variables || '{}');
    const varList = Object.entries(parsedVars).map(([k, v]) => ({ key: k, value: String(v) }));
    setVariables(varList.length > 0 ? varList : [{ key: '', value: '' }]);

    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setCurrentEnv(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    if (!name || !baseUrl) {
      addToast('Name and Base URL are required', 'error');
      return;
    }

    const headersObj: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.key.trim()) headersObj[h.key.trim()] = h.value;
    });

    const varsObj: Record<string, string> = {};
    variables.forEach((v) => {
      if (v.key.trim()) varsObj[v.key.trim()] = v.value;
    });

    const payload = {
      projectId: selectedProjectId,
      name,
      baseUrl,
      headers: headersObj,
      variables: varsObj
    };

    const action = currentEnv 
      ? api.updateEnvironment(currentEnv.id, payload)
      : api.createEnvironment(payload);

    action
      .then(() => {
        addToast(`Environment successfully ${currentEnv ? 'updated' : 'created'}`);
        setIsEditing(false);
        loadEnvironments(selectedProjectId);
      })
      .catch((err) => addToast(err.message, 'error'));
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this environment configuration?')) {
      api.deleteEnvironment(id)
        .then(() => {
          addToast('Environment deleted successfully');
          loadEnvironments(selectedProjectId);
        })
        .catch((err) => addToast(err.message, 'error'));
    }
  };

  // Row operations
  const addHeaderRow = () => setHeaders([...headers, { key: '', value: '' }]);
  const removeHeaderRow = (idx: number) => setHeaders(headers.filter((_, i) => i !== idx));
  const updateHeaderRow = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...headers];
    updated[idx][field] = val;
    setHeaders(updated);
  };

  const addVarRow = () => setVariables([...variables, { key: '', value: '' }]);
  const removeVarRow = (idx: number) => setVariables(variables.filter((_, i) => i !== idx));
  const updateVarRow = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...variables];
    updated[idx][field] = val;
    setVariables(updated);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-gradient-aqua">Environments</h2>
          <p className="text-text-muted mt-1">Configure environment variables and baseUrl overrides per workspace context.</p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3 bg-white/50 p-4 border border-brand-200/50 rounded-xl">
          <span className="text-xs font-semibold text-label uppercase tracking-wider">Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-white/85 border border-brand-200/50 rounded-lg px-3 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-brand-500 transition-colors"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: List of environments */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-text-primary">Active Configurations</h3>
            <button
              onClick={startCreate}
              disabled={!selectedProjectId}
              className="flex items-center gap-1 text-xs font-bold text-brand-800 hover:text-brand-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add New
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin"></div>
            </div>
          ) : environments.length === 0 ? (
            <div className="text-center py-12 glass-card rounded-xl text-text-secondary text-sm">
              No environments configured.
            </div>
          ) : (
            environments.map((env) => (
              <div
                key={env.id}
                onClick={() => startEdit(env)}
                className={`p-5 rounded-xl border transition-all cursor-pointer ${
                  currentEnv?.id === env.id
                    ? 'bg-brand-500/5 border-brand-500/40 shadow-[0_0_15px_rgba(139,92,246,0.05)]'
                    : 'glass-card hover:border-brand-200/50'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-text-primary">{env.name}</span>
                  <div className="flex gap-1.5 opacity-0 hover:opacity-100 group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(env); }}
                      className="p-1.5 rounded-lg bg-white/85 border border-brand-200/50 text-text-secondary hover:text-brand-700"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(env.id); }}
                      className="p-1.5 rounded-lg bg-white/85 border border-brand-200/50 text-text-secondary hover:text-rose-700 hover:border-rose-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-text-secondary font-mono truncate">{env.baseUrl}</div>
              </div>
            ))
          )}
        </div>

        {/* Right column: Form details */}
        <div className="lg:col-span-2">
          {isEditing ? (
            <form onSubmit={handleSave} className="glass-card p-6 rounded-2xl space-y-6">
              <h3 className="text-lg font-bold text-text-primary border-b border-brand-200/50 pb-3 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-800" />
                <span>{currentEnv ? `Edit Environment (${name})` : 'New Environment'}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-label uppercase tracking-wider mb-2">Environment Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. QA, Staging, Production"
                    required
                    className="w-full bg-white/85 border border-brand-200/50 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-label uppercase tracking-wider mb-2">Override Base URL *</label>
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="e.g. https://qa-api.company.com"
                    required
                    className="w-full bg-white/85 border border-brand-200/50 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 outline-none"
                  />
                </div>
              </div>

              {/* Override Headers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-label uppercase tracking-wider">Override Headers</label>
                  <button
                    type="button"
                    onClick={addHeaderRow}
                    className="text-[10px] font-bold text-brand-800 hover:text-brand-700 uppercase tracking-wider flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Header
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {headers.map((h, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={h.key}
                        onChange={(e) => updateHeaderRow(i, 'key', e.target.value)}
                        placeholder="Header Key"
                        className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-xs outline-none"
                      />
                      <input
                        type="text"
                        value={h.value}
                        onChange={(e) => updateHeaderRow(i, 'value', e.target.value)}
                        placeholder="Header Value"
                        className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeHeaderRow(i)}
                        className="p-1.5 rounded-xl bg-white/85 border border-brand-200/50 text-text-secondary hover:text-rose-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Override Variables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-label uppercase tracking-wider">Override Variables</label>
                  <button
                    type="button"
                    onClick={addVarRow}
                    className="text-[10px] font-bold text-brand-800 hover:text-brand-700 uppercase tracking-wider flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Variable
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {variables.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={v.key}
                        onChange={(e) => updateVarRow(i, 'key', e.target.value)}
                        placeholder="Variable Name"
                        className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-xs outline-none"
                      />
                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => updateVarRow(i, 'value', e.target.value)}
                        placeholder="Variable Value"
                        className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeVarRow(i)}
                        className="p-1.5 rounded-xl bg-white/85 border border-brand-200/50 text-text-secondary hover:text-rose-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form buttons */}
              <div className="pt-4 border-t border-brand-200/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-brand-200/50 rounded-xl text-text-secondary hover:text-brand-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-primary font-semibold text-xs shadow-md transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </button>
              </div>

            </form>
          ) : (
            <div className="glass-card p-10 rounded-2xl text-center border border-brand-200/60 flex flex-col items-center justify-center h-full min-h-[300px]">
              <Sliders className="w-10 h-10 text-brand-800 mb-3" />
              <h4 className="font-bold text-text-secondary">Select or Create an Environment</h4>
              <p className="text-text-secondary text-xs mt-1 max-w-sm">Configure different variables (e.g. usernames, secrets) and baseUrl endpoints for QA, Staging, and Production tiers.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
