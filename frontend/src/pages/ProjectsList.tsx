import React, { useEffect, useState } from 'react';
import { api, apiClient } from '../api';
import { useStore } from '../store/useStore';
import { FolderPlus, Globe, Code, FileCode, Play, Edit3, Trash2, X, Plus, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const ProjectsList: React.FC = () => {
  const { projects, setProjects, addToast } = useStore();
  const [loading, setLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  
  // Form fields
  const [projectType, setProjectType] = useState<'API' | 'UI'>('API');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [variables, setVariables] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  const fetchProjects = () => {
    setLoading(true);
    api.getProjects()
      .then(data => {
        setProjects(data);
        setLoading(false);
      })
      .catch(err => {
        addToast(err.message, 'error');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const openCreatePanel = () => {
    setEditingProject(null);
    setProjectType('API');
    setName('');
    setDescription('');
    setBaseUrl('');
    setHeaders([{ key: '', value: '' }]);
    setVariables([{ key: '', value: '' }]);
    setIsPanelOpen(true);
  };

  const openEditPanel = (project: any) => {
    setEditingProject(project);
    setProjectType(project.projectType === 'UI' ? 'UI' : 'API');
    setName(project.name);
    setDescription(project.description || '');
    setBaseUrl(project.baseUrl);
    
    // Parse JSON
    const parsedHeaders = JSON.parse(project.defaultHeaders || '{}');
    const headerList = Object.entries(parsedHeaders).map(([k, v]) => ({ key: k, value: String(v) }));
    setHeaders(headerList.length > 0 ? headerList : [{ key: '', value: '' }]);

    const parsedVars = JSON.parse(project.variables || '{}');
    const varList = Object.entries(parsedVars).map(([k, v]) => ({ key: k, value: String(v) }));
    setVariables(varList.length > 0 ? varList : [{ key: '', value: '' }]);
    
    setIsPanelOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const urlLabel = projectType === 'UI' ? 'Application URL' : 'Base URL';
    if (!name || !baseUrl) {
      addToast(`Name and ${urlLabel} are required`, 'error');
      return;
    }

    // Format headers and variables key-value arrays to JSON objects
    const headersObj: Record<string, string> = {};
    if (projectType === 'API') {
      headers.forEach((h) => {
        if (h.key.trim()) headersObj[h.key.trim()] = h.value;
      });
    }

    const varsObj: Record<string, string> = {};
    variables.forEach((v) => {
      if (v.key.trim()) varsObj[v.key.trim()] = v.value;
    });

    const payload = {
      projectType,
      name,
      description,
      baseUrl,
      defaultHeaders: headersObj,
      variables: varsObj
    };

    const action = editingProject 
      ? api.updateProject(editingProject.id, payload)
      : api.createProject(payload);

    setSaving(true);
    action
      .then(() => {
        addToast(`Project successfully ${editingProject ? 'updated' : 'created'}`);
        setIsPanelOpen(false);
        fetchProjects();
      })
      .catch(err => {
        addToast(err.response?.data?.error || err.message, 'error');
      })
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm('Are you sure you want to delete this project? This will delete all environments, test cases, and history associated with it.')) {
      api.deleteProject(id)
        .then(() => {
          addToast('Project deleted successfully');
          fetchProjects();
        })
        .catch(err => {
          addToast(err.message, 'error');
        });
    }
  };

  const handleRunAll = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const headed = localStorage.getItem('stl-headed') === '1';
    api.triggerRun({ projectId, headed })
      .then(run => {
        addToast('Execution triggered successfully');
        navigate(`/execution/${run.id}`);
      })
      .catch(err => {
        addToast(err.message, 'error');
      });
  };

  // Row operations for Key-Values
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
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-gradient-aqua">Projects</h2>
          <p className="text-text-muted mt-1">Manage project configurations, variables, and global scopes.</p>
        </div>
        <button
          onClick={openCreatePanel}
          className="btn-primary flex items-center gap-2 px-5 py-3 rounded-xl active:scale-95 transition-all duration-150"
        >
          <FolderPlus className="w-5 h-5" />
          <span>New Project</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl max-w-md mx-auto p-8 border border-dashed border-brand-200/50">
          <FolderPlus className="w-12 h-12 text-brand-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-text-primary">No Projects Found</h3>
          <p className="text-text-muted text-sm mt-1">Create a project to organize environments and UI or API test cases.</p>
          <button
            onClick={openCreatePanel}
            className="mt-6 btn-primary rounded-lg"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="glass-card p-6 rounded-2xl flex flex-col justify-between group transition-all duration-200 border border-brand-200/60 hover:border-brand-500/30 cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-text-primary group-hover:text-brand-800 transition-colors">
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.preventDefault(); openEditPanel(project); }}
                      className="p-1.5 rounded-lg bg-white/85 border border-brand-200/50 text-text-secondary hover:text-brand-700 hover:border-brand-300/40 transition-all"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(project.id, e)}
                      className="p-1.5 rounded-lg bg-white/85 border border-brand-200/50 text-text-secondary hover:text-rose-700 hover:border-rose-500/30 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-text-secondary text-sm mt-2 line-clamp-2 h-10">
                  {project.description || 'No description provided.'}
                </p>

                <div className="mt-6 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-text-secondary bg-white/60 p-2 rounded-lg border border-brand-200/40">
                    <Globe className="w-3.5 h-3.5 text-brand-800" />
                    <span className="truncate">{project.baseUrl}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-brand-200/50 flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </span>
                
                <button
                  onClick={(e) => handleRunAll(project.id, e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 hover:text-emerald-300 border border-emerald-500/20 font-semibold text-xs transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-emerald-400/20" />
                  <span>Run Tests</span>
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Slider Slide-Over Config Panel */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-brand-900/15 backdrop-blur-sm" onClick={() => setIsPanelOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-2xl bg-white/95 border-l border-brand-200/50 shadow-2xl flex flex-col animate-slide-left">
              
              {/* Header */}
              <div className="px-6 py-5 border-b border-brand-200/50 flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-primary">
                  {editingProject ? 'Edit Project Settings' : 'Create New Project'}
                </h3>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="p-1.5 rounded-lg bg-white/85 border border-brand-200/50 text-text-secondary hover:text-brand-700 hover:border-brand-300/40 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Basic Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-label uppercase tracking-wider text-label mb-2">Project Type *</label>
                    <select
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value as 'API' | 'UI')}
                      className="w-full bg-white/85 border border-brand-200/50 rounded-xl px-4 py-3 text-text-primary focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                    >
                      <option value="API">API Automation</option>
                      <option value="UI">UI Automation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-label uppercase tracking-wider text-label mb-2">Project Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. User Authentication Service"
                      required
                      className="w-full bg-white/85 border border-brand-200/50 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-label uppercase tracking-wider mb-2">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        projectType === 'UI'
                          ? 'Describe the UI flows or pages covered by this project...'
                          : 'Describe the APIs or integration testing goals...'
                      }
                      rows={2}
                      className="w-full bg-white/85 border border-brand-200/50 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-label uppercase tracking-wider mb-2">
                      {projectType === 'UI' ? 'Application URL *' : 'Base URL *'}
                    </label>
                    <input
                      type="url"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={
                        projectType === 'UI'
                          ? 'e.g. https://opensource-demo.orangehrmlive.com'
                          : 'e.g. https://api.sandbox.com'
                      }
                      required
                      className="w-full bg-white/85 border border-brand-200/50 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                    />
                    {projectType === 'UI' && (
                      <p className="text-xs text-text-muted mt-1.5">
                        The web app URL used as the starting point for UI test cases. Creating a UI project runs{' '}
                        <code className="text-[10px]">npm init playwright@latest</code> (may take 1–2 minutes).
                      </p>
                    )}
                  </div>
                </div>

                {/* Default Headers — API projects only */}
                {projectType === 'API' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-label uppercase tracking-wider">Default Headers</label>
                    <button
                      type="button"
                      onClick={addHeaderRow}
                      className="flex items-center gap-1 text-[11px] font-bold text-brand-800 hover:text-brand-700 uppercase tracking-wider"
                    >
                      <Plus className="w-3 h-3" /> Add Header
                    </button>
                  </div>
                  <div className="space-y-2">
                    {headers.map((h, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={h.key}
                          onChange={(e) => updateHeaderRow(i, 'key', e.target.value)}
                          placeholder="Header Key (e.g. Content-Type)"
                          className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        />
                        <input
                          type="text"
                          value={h.value}
                          onChange={(e) => updateHeaderRow(i, 'value', e.target.value)}
                          placeholder="Header Value"
                          className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeHeaderRow(i)}
                          className="p-2 rounded-xl bg-white/85 border border-brand-200/50 hover:bg-rose-50 text-brand-800 hover:text-rose-700 hover:border-rose-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {/* Variables / test data */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-label uppercase tracking-wider">
                      {projectType === 'UI' ? 'Default Test Data' : 'Default Variables'}
                    </label>
                    <button
                      type="button"
                      onClick={addVarRow}
                      className="flex items-center gap-1 text-[11px] font-bold text-brand-800 hover:text-brand-700 uppercase tracking-wider"
                    >
                      <Plus className="w-3 h-3" /> {projectType === 'UI' ? 'Add Field' : 'Add Variable'}
                    </button>
                  </div>
                  {projectType === 'UI' && (
                    <p className="text-xs text-text-muted mb-2">
                      Optional key-value pairs available in UI steps (e.g. username, password).
                    </p>
                  )}
                  <div className="space-y-2">
                    {variables.map((v, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={v.key}
                          onChange={(e) => updateVarRow(i, 'key', e.target.value)}
                          placeholder={projectType === 'UI' ? 'Field name (e.g. username)' : 'Variable Key (e.g. timeout)'}
                          className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        />
                        <input
                          type="text"
                          value={v.value}
                          onChange={(e) => updateVarRow(i, 'value', e.target.value)}
                          placeholder={projectType === 'UI' ? 'Value (e.g. Admin)' : 'Variable Value'}
                          className="flex-1 bg-white/85 border border-brand-200/50 rounded-xl px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeVarRow(i)}
                          className="p-2 rounded-xl bg-white/85 border border-brand-200/50 hover:bg-rose-50 text-brand-800 hover:text-rose-700 hover:border-rose-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </form>

              {/* Action Buttons */}
              <div className="px-6 py-4 border-t border-brand-200/50 bg-white/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPanelOpen(false)}
                  className="px-4 py-2 border border-brand-200/50 rounded-xl text-text-secondary hover:text-brand-700 hover:bg-brand-50 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-primary font-semibold text-sm shadow-md hover:shadow-brand-500/10 transition-all disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {saving && !editingProject && projectType === 'UI'
                      ? 'Initializing Playwright…'
                      : editingProject
                        ? 'Save Changes'
                        : 'Create Project'}
                  </span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
