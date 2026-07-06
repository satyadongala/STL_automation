import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { 
  Play, Plus, ArrowUp, ArrowDown, Trash2, Edit3, Sliders, Globe, Code, 
  Settings, CheckSquare, Square, Search, Copy, Check, GitCommit, FolderArchive
} from 'lucide-react';

export const ProjectDetails: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'testcases' | 'workflows'>('testcases');
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDesc, setNewWorkflowDesc] = useState('');
  const [headedMode, setHeadedMode] = useState(false);
  const [workersCount, setWorkersCount] = useState(1);
  
  const { addToast } = useStore();
  const navigate = useNavigate();

  const loadDetails = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [projData, wfs] = await Promise.all([
        api.getProject(projectId),
        api.getWorkflows(projectId)
      ]);
      setProject(projData);
      setTestCases(projData.testCases || []);
      setEnvironments(projData.environments || []);
      setWorkflows(wfs || []);
      if (projData.environments?.length > 0) {
        setSelectedEnvId(projData.environments[0].id);
      }
      setLoading(false);
    } catch (err: any) {
      addToast(err.message, 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8">
        <h3 className="text-xl font-bold text-text-secondary">Project Not Found</h3>
        <Link to="/projects" className="mt-4 px-4 py-2 btn-primary rounded-lg text-sm font-medium">
          Back to Projects
        </Link>
      </div>
    );
  }

  // Handle single run
  const handleRunTestCase = (testCaseId: string) => {
    api.triggerRun({
      projectId: project.id,
      environmentId: selectedEnvId || null,
      testCaseIds: [testCaseId],
      headed: project.projectType === 'UI' ? headedMode : undefined,
      workers: project.projectType === 'UI' ? workersCount : undefined
    })
      .then(run => {
        addToast('Execution triggered successfully');
        navigate(`/execution/${run.id}`);
      })
      .catch(err => addToast(err.message, 'error'));
  };

  // Handle bulk run
  const handleRunSelected = () => {
    if (selectedTestCaseIds.size === 0) {
      addToast('Select at least one test case to run', 'error');
      return;
    }
    api.triggerRun({
      projectId: project.id,
      environmentId: selectedEnvId || null,
      testCaseIds: Array.from(selectedTestCaseIds),
      headed: project.projectType === 'UI' ? headedMode : undefined,
      workers: project.projectType === 'UI' ? workersCount : undefined
    })
      .then(run => {
        addToast(`Execution triggered for ${selectedTestCaseIds.size} tests`);
        navigate(`/execution/${run.id}`);
      })
      .catch(err => addToast(err.message, 'error'));
  };

  // Handle running all tests matching search query or grep
  const handleRunAll = () => {
    const activeTestCases = filteredTestCases;
    if (activeTestCases.length === 0) {
      addToast('No test cases match filter criteria', 'error');
      return;
    }
    api.triggerRun({
      projectId: project.id,
      environmentId: selectedEnvId || null,
      testCaseIds: activeTestCases.map(tc => tc.id),
      headed: project.projectType === 'UI' ? headedMode : undefined,
      workers: project.projectType === 'UI' ? workersCount : undefined
    })
      .then(run => {
        addToast(`Execution triggered for ${activeTestCases.length} tests`);
        navigate(`/execution/${run.id}`);
      })
      .catch(err => addToast(err.message, 'error'));
  };

  // Move test cases in sortOrder
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= testCases.length) return;

    const list = [...testCases];
    // Swap
    const temp = list[index];
    list[index] = list[newIdx];
    list[newIdx] = temp;

    // Update sort order values locally
    const updatedList = list.map((tc, idx) => ({
      ...tc,
      sortOrder: idx
    }));

    setTestCases(updatedList);

    // Call API to persist new ordering
    try {
      const orders = updatedList.map(item => ({ id: item.id, sortOrder: item.sortOrder }));
      await api.reorderTestCases(orders);
    } catch (err: any) {
      addToast(err.message, 'error');
      loadDetails(); // reload original order
    }
  };

  // Delete test case
  const handleDeleteTestCase = async (id: string) => {
    if (confirm('Are you sure you want to delete this test case?')) {
      try {
        await api.deleteTestCase(id);
        addToast('Test case deleted');
        loadDetails();
      } catch (err: any) {
        addToast(err.message, 'error');
      }
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName || !projectId) return;
    try {
      await api.createWorkflow(projectId, { name: newWorkflowName, description: newWorkflowDesc });
      addToast('Workflow created successfully');
      setShowWorkflowModal(false);
      setNewWorkflowName('');
      setNewWorkflowDesc('');
      loadDetails();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      try {
        await api.deleteWorkflow(id);
        addToast('Workflow deleted');
        loadDetails();
      } catch (err: any) {
        addToast(err.message, 'error');
      }
    }
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    const updated = new Set(selectedTestCaseIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedTestCaseIds(updated);
  };

  const toggleSelectAll = () => {
    if (selectedTestCaseIds.size === filteredTestCases.length) {
      setSelectedTestCaseIds(new Set());
    } else {
      setSelectedTestCaseIds(new Set(filteredTestCases.map(tc => tc.id)));
    }
  };

  // Clone test case
  const handleCloneTestCase = async (tc: any) => {
    try {
      const cloned = {
        projectId: tc.projectId,
        testType: tc.testType || (tc.method === 'UI' ? 'UI' : 'API'),
        name: `${tc.name} (Copy)`,
        description: tc.description,
        method: tc.method,
        path: tc.path,
        headers: JSON.parse(tc.headers || '{}'),
        queryParams: JSON.parse(tc.queryParams || '{}'),
        body: tc.body,
        assertions: JSON.parse(tc.assertions || '[]'),
        variablesToExtract: JSON.parse(tc.variablesToExtract || '[]'),
        uiSteps: JSON.parse(tc.uiSteps || '[]'),
        sortOrder: testCases.length
      };
      await api.createTestCase(cloned);
      addToast('Test case cloned successfully');
      loadDetails();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  // Filter test cases and workflows
  const filteredTestCases = testCases.filter(tc => 
    tc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    tc.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWorkflows = workflows.filter(wf => 
    wf.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (wf.description && wf.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'UI': return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
      case 'GET': return 'bg-sky-100 text-sky-800 border border-sky-300';
      case 'POST': return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      case 'PUT': return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'DELETE': return 'bg-rose-100 text-rose-800 border border-rose-300';
      default: return 'bg-brand-100 text-brand-900 border border-brand-300';
    }
  };

  const activeEnv = environments.find(e => e.id === selectedEnvId);
  const currentBaseUrl = activeEnv?.baseUrl || project.baseUrl;

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
      
      {/* Header and Details */}
      <div className="glass-card p-6 rounded-2xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-brand-500/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-label uppercase tracking-widest mb-1">
            <span>Project Scope</span>
            <span className="px-2 py-0.5 rounded-full border border-brand-200/50 bg-white/85 text-text-primary">
              {project.projectType === 'UI' ? 'UI' : 'API'}
            </span>
          </div>
          <h2 className="text-3xl font-extrabold text-text-primary">{project.name}</h2>
          <p className="text-text-muted text-sm mt-1">{project.description || 'No description'}</p>
          <div className="flex flex-wrap gap-4 mt-4">
            <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-white/85 border border-brand-200/50 px-3 py-1.5 rounded-lg">
              <Globe className="w-3.5 h-3.5 text-brand-700" />
              <span>Base URL: {currentBaseUrl}</span>
            </span>
          </div>
        </div>

        {/* Execution options & Export */}
        <div className="flex flex-wrap items-center gap-4 bg-white/50 p-4 rounded-xl border border-brand-200/50">
          <Link
            to={`/projects/${project.id}/generate`}
            className="flex items-center gap-2 px-4 py-2 bg-white/85 hover:bg-brand-100/80 border border-brand-200/50 hover:border-indigo-400 text-indigo-700 font-bold rounded-lg transition-all"
          >
            <FolderArchive className="w-4 h-4" />
            <span className="text-sm">Export ZIP</span>
          </Link>
          <div className="w-px h-8 bg-brand-100 mx-1"></div>
          {project.projectType === 'UI' && (
            <>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="headedMode"
                  checked={headedMode}
                  onChange={(e) => setHeadedMode(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-brand-300/40 bg-white/85 text-brand-500 focus:ring-brand-500"
                />
                <label htmlFor="headedMode" className="text-[10px] font-semibold text-label uppercase tracking-wider cursor-pointer">
                  Headed Mode
                </label>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-label uppercase tracking-wider mb-1.5">Workers</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={workersCount}
                  onChange={(e) => setWorkersCount(parseInt(e.target.value) || 1)}
                  className="bg-white/85 border border-brand-200/50 rounded-lg px-2 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-brand-500 transition-colors w-16"
                />
              </div>
              <div className="w-px h-8 bg-brand-100 mx-1"></div>
            </>
          )}
          <div>
            <label className="block text-[10px] font-semibold text-label uppercase tracking-wider mb-1.5">Environment</label>
            <select
              value={selectedEnvId}
              onChange={(e) => setSelectedEnvId(e.target.value)}
              className="bg-white/85 border border-brand-200/50 rounded-lg px-3 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-brand-500 transition-colors"
            >
              <option value="">Default (No Env Override)</option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 self-end">
            <button
              onClick={handleRunAll}
              disabled={testCases.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 btn-primary text-white font-semibold text-xs rounded-lg active:scale-95 shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-white/20" />
              <span>Run All Tests</span>
            </button>
            {selectedTestCaseIds.size > 0 && (
              <button
                onClick={handleRunSelected}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg active:scale-95 shadow-md transition-all"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Run Selected ({selectedTestCaseIds.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Manager */}
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setActiveTab('testcases')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'testcases' ? 'tab-active' : 'tab-inactive hover:bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            <span>{project.projectType === 'UI' ? 'UI' : 'API'} Test Cases ({testCases.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('workflows')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'workflows' ? 'tab-active-indigo' : 'tab-inactive hover:bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4" />
            <span>Workflows ({workflows.length})</span>
          </div>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="glass-card p-6 rounded-2xl">
        {activeTab === 'testcases' ? (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-text-primary">Test Cases</h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by name or path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/85 border border-brand-200/50 rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary w-60 placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Create Test Case */}
            <Link
              to={`/projects/${project.id}/test-case/new`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/85 border border-brand-200/50 text-text-primary hover:text-brand-700 hover:border-brand-500/40 text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4 text-brand-700" />
              <span>Create Test</span>
            </Link>
          </div>
        </div>

        {/* Test Cases List */}
        {testCases.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-brand-200/50 rounded-xl">
            <Code className="w-12 h-12 text-brand-800 mx-auto mb-4" />
            <h4 className="text-text-secondary font-bold">No Test Cases Created</h4>
            <p className="text-text-secondary text-sm mt-1">Create your first {project.projectType === 'UI' ? 'UI' : 'API'} step to launch automation runs.</p>
            <Link
              to={`/projects/${project.id}/test-case/new`}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 btn-primary font-medium rounded-lg text-xs"
            >
              <Plus className="w-4 h-4" /> Create Test Case
            </Link>
          </div>
        ) : filteredTestCases.length === 0 ? (
          <div className="text-center py-10 text-text-secondary text-sm">
            No test cases match filter "{searchQuery}"
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-brand-300/50 text-label text-[10px] font-bold uppercase tracking-wider text-left">
                  <th className="py-3 px-4 w-10">
                    <button onClick={toggleSelectAll} className="text-text-secondary hover:text-brand-700 transition-colors">
                      {selectedTestCaseIds.size === filteredTestCases.length ? (
                        <CheckSquare className="w-4 h-4 text-brand-700" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 w-12 text-center">Order</th>
                  <th className="py-3 px-4 w-20">Method</th>
                  <th className="py-3 px-4">Endpoint Path</th>
                  <th className="py-3 px-4">Test Description</th>
                  <th className="py-3 px-4 w-28 text-center flex items-center justify-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200/60">
                {filteredTestCases.map((tc, idx) => {
                  const isChecked = selectedTestCaseIds.has(tc.id);
                  return (
                    <tr key={tc.id} className={`group hover:bg-brand-50/20 transition-colors ${isChecked ? 'bg-brand-500/5' : ''}`}>
                      <td className="py-3.5 px-4">
                        <button onClick={() => toggleSelect(tc.id)} className="text-brand-700 hover:text-brand-700 transition-colors">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-brand-700" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0}
                            className="text-brand-700 hover:text-brand-700 disabled:opacity-20 transition-colors"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === testCases.length - 1}
                            className="text-brand-700 hover:text-brand-700 disabled:opacity-20 transition-colors"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getMethodColor(tc.method)}`}>
                          {tc.testType === 'UI' || tc.method === 'UI' ? 'UI' : tc.method}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-text-primary max-w-[200px] truncate" title={tc.path}>
                        {tc.path}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-sm text-text-primary">{tc.name}</div>
                        <div className="text-xs text-text-muted line-clamp-1 mt-0.5">{tc.description || 'No summary'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleRunTestCase(tc.id)}
                            className="p-1.5 rounded-lg bg-white/85 border border-brand-200/50 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-all"
                            title="Execute Test"
                          >
                            <Play className="w-3.5 h-3.5 fill-emerald-400/10" />
                          </button>
                          <Link
                            to={`/projects/${project.id}/test-case/${tc.id}`}
                            className="p-1.5 rounded-lg bg-white/85 border border-brand-200/50 text-brand-800 hover:text-brand-900 hover:border-brand-400 transition-all"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => handleCloneTestCase(tc)}
                            className="p-1.5 rounded-lg bg-white/85 border border-brand-200/50 text-brand-800 hover:text-brand-900 hover:border-brand-400 transition-all"
                            title="Clone/Copy"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTestCase(tc.id)}
                            className="p-1.5 rounded-lg bg-white/85 border border-brand-200/50 text-brand-800 hover:text-rose-700 hover:border-rose-400 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
          </>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-text-primary">Workflows</h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter workflows..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/85 border border-brand-200/50 rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary w-60 placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <button
                  onClick={() => setShowWorkflowModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/85 border border-brand-200/50 text-text-primary hover:text-brand-700 hover:border-indigo-500/40 text-xs font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4 text-indigo-400" />
                  <span>Create Workflow</span>
                </button>
              </div>
            </div>

            {workflows.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-brand-200/50 rounded-xl">
                <GitCommit className="w-12 h-12 text-brand-800 mx-auto mb-4" />
                <h4 className="text-text-secondary font-bold">No Workflows Created</h4>
                <p className="text-text-secondary text-sm mt-1">Group {project.projectType === 'UI' ? 'UI steps' : 'APIs'} into sequential workflows to chain executions.</p>
                <button
                  onClick={() => setShowWorkflowModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs"
                >
                  <Plus className="w-4 h-4" /> Create Workflow
                </button>
              </div>
            ) : filteredWorkflows.length === 0 ? (
              <div className="text-center py-10 text-text-secondary text-sm">
                No workflows match filter "{searchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredWorkflows.map(wf => (
                  <div key={wf.id} className="bg-white/60 border border-brand-200/40 rounded-2xl p-5 hover:border-indigo-500/30 transition-all group flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                          <GitCommit className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-text-primary group-hover:text-indigo-400 transition-colors">{wf.name}</h4>
                      </div>
                      <button
                        onClick={() => handleDeleteWorkflow(wf.id)}
                        className="text-brand-700 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-text-secondary text-xs mb-5 flex-1 line-clamp-2">{wf.description || 'No description provided.'}</p>
                    
                    <div className="flex items-center justify-between border-t border-brand-200/50 pt-4 mt-auto">
                      <div className="text-xs font-semibold text-text-secondary">
                        {wf.testCases?.length || 0} {project.projectType === 'UI' ? 'UI' : 'API'} Steps
                      </div>
                      <Link
                        to={`/projects/${project.id}/workflows/${wf.id}`}
                        className="text-xs font-semibold px-3 py-1.5 bg-brand-700 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                      >
                        Configure
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Workflow Modal */}
      {showWorkflowModal && (
        <div className="fixed inset-0 bg-brand-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/85 border border-brand-200/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-brand-200/50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary">Create New Workflow</h3>
              <button onClick={() => setShowWorkflowModal(false)} className="text-text-secondary hover:text-brand-700 transition-colors">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Workflow Name</label>
                <input
                  type="text"
                  value={newWorkflowName}
                  onChange={e => setNewWorkflowName(e.target.value)}
                  className="w-full bg-white/90 border border-brand-200/50 rounded-xl px-4 py-2.5 text-sm text-text-primary outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  placeholder="e.g. End-to-End User Flow"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Description (Optional)</label>
                <textarea
                  value={newWorkflowDesc}
                  onChange={e => setNewWorkflowDesc(e.target.value)}
                  className="w-full bg-white/90 border border-brand-200/50 rounded-xl px-4 py-2.5 text-sm text-text-primary outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none h-24"
                  placeholder="Describe what this workflow tests..."
                />
              </div>
            </div>
            <div className="p-4 border-t border-brand-200/50 flex justify-end gap-3 bg-white/50">
              <button
                onClick={() => setShowWorkflowModal(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-brand-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkflow}
                disabled={!newWorkflowName}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
