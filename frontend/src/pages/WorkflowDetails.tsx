import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { Play, Plus, ArrowUp, ArrowDown, Trash2, Settings, ChevronLeft, GitBranch } from 'lucide-react';
import { WorkflowDefinitionEditor } from '../components/WorkflowDefinitionEditor';

export const WorkflowDetails: React.FC = () => {
  const { projectId, workflowId } = useParams<{ projectId: string; workflowId: string }>();
  const [workflow, setWorkflow] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [allTestCases, setAllTestCases] = useState<any[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTestCaseToAdd, setSelectedTestCaseToAdd] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'linear' | 'controlflow'>('linear');
  const [headedMode, setHeadedMode] = useState(false);
  const [workersCount, setWorkersCount] = useState(1);

  const projectType: 'API' | 'UI' = project?.projectType === 'UI' ? 'UI' : 'API';
  const isUiProject = projectType === 'UI';

  const { addToast } = useStore();

  const hasControlFlow =
    workflow?.definition &&
    workflow.definition !== '{}' &&
    (() => {
      try {
        const def = JSON.parse(workflow.definition);
        return def?.root && (
          def.root.type !== 'group' ||
          (def.root.children && def.root.children.length > 0)
        );
      } catch {
        return false;
      }
    })();
  const navigate = useNavigate();

  const loadData = async () => {
    if (!projectId || !workflowId) return;
    try {
      setLoading(true);
      const [wf, projectData, tcData] = await Promise.all([
        api.getWorkflow(workflowId),
        api.getProject(projectId),
        api.getTestCases(projectId)
      ]);
      setWorkflow(wf);
      setProject(projectData);
      setEnvironments(projectData.environments || []);
      setAllTestCases(tcData || []);
      if (projectData.projectType === 'UI') {
        setActiveTab('controlflow');
      }
      if (projectData.environments?.length > 0) {
        setSelectedEnvId(projectData.environments[0].id);
      }
      setLoading(false);
    } catch (err: any) {
      addToast(err.message, 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, workflowId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin"></div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8">
        <h3 className="text-xl font-bold text-text-secondary">Workflow Not Found</h3>
        <Link to={`/projects/${projectId}`} className="mt-4 px-4 py-2 btn-primary rounded-lg text-sm font-medium">
          Back to Project
        </Link>
      </div>
    );
  }

  const handleExecute = async () => {
    if (workflow.testCases.length === 0 && !hasControlFlow) {
      addToast('Add test cases or save a control-flow definition first', 'error');
      return;
    }
    try {
      const run = await api.executeWorkflow(workflow.id, selectedEnvId || null, {
        headed: isUiProject ? headedMode : undefined,
        workers: isUiProject ? workersCount : undefined,
      });
      addToast('Workflow execution triggered');
      navigate(`/execution/${run.id}`);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleAddTestCase = async () => {
    if (!selectedTestCaseToAdd) return;
    try {
      await api.addTestCaseToWorkflow(workflow.id, selectedTestCaseToAdd);
      addToast('Test case added to workflow');
      setShowAddModal(false);
      setSelectedTestCaseToAdd('');
      loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleRemoveTestCase = async (relationId: string) => {
    try {
      await api.removeTestCaseFromWorkflow(workflow.id, relationId);
      addToast('Test case removed from workflow');
      loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= workflow.testCases.length) return;

    const list = [...workflow.testCases];
    const temp = list[index];
    list[index] = list[newIdx];
    list[newIdx] = temp;

    const relationIds = list.map(item => item.id);
    try {
      await api.updateWorkflowTestCasesOrder(workflow.id, relationIds);
      loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const testCasesForWorkflow = allTestCases.filter((tc) => {
    const isUiTc = tc.testType === 'UI' || tc.method === 'UI';
    return isUiProject ? isUiTc : !isUiTc;
  });

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

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
      <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-800 hover:text-brand-700 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Project
      </Link>

      {/* Header */}
      <div className="glass-card p-6 rounded-2xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-brand-500/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-800 uppercase tracking-widest mb-1">
            <span>Workflow Scope</span>
            <span className="px-2 py-0.5 rounded-full border border-brand-200/50 bg-white/85 text-text-primary">
              {projectType}
            </span>
          </div>
          <h2 className="text-3xl font-extrabold text-text-primary">{workflow.name}</h2>
          <p className="text-text-muted text-sm mt-1">
            {workflow.description ||
              (isUiProject ? 'UI workflow with optional control flow' : 'Sequential API chaining workflow')}
          </p>
          {hasControlFlow && (
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
              <GitBranch className="w-3 h-3" /> Control-flow engine
            </span>
          )}
        </div>

        {/* Execution options */}
        <div className="flex flex-wrap items-center gap-4 bg-white/50 p-4 rounded-xl border border-brand-200/50">
          {isUiProject && (
            <>
              <div className="flex items-center gap-2 self-end">
                <input
                  type="checkbox"
                  id="wfHeadedMode"
                  checked={headedMode}
                  onChange={(e) => setHeadedMode(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-brand-300/40 bg-white/85 text-brand-500 focus:ring-brand-500"
                />
                <label htmlFor="wfHeadedMode" className="text-[10px] font-semibold text-label uppercase tracking-wider cursor-pointer">
                  Headed Mode
                </label>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-label uppercase tracking-wider mb-1.5">Workers</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={workersCount}
                  onChange={(e) => setWorkersCount(parseInt(e.target.value, 10) || 1)}
                  className="bg-white/85 border border-brand-200/50 rounded-lg px-2 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-brand-500 w-16"
                />
              </div>
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
          <button
            onClick={handleExecute}
            disabled={workflow.testCases.length === 0 && !hasControlFlow}
            className="flex items-center gap-1.5 px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm rounded-lg active:scale-95 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all disabled:opacity-50 self-end"
          >
            <Play className="w-4 h-4 fill-white/20" />
            <span>Execute Workflow</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['linear', 'controlflow'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-colors ${
              activeTab === tab
                ? 'bg-brand-600/20 border-brand-500/40 text-brand-700'
                : 'bg-white/85 border-brand-200/50 text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab === 'linear' ? 'Linear Sequence' : 'Control Flow'}
          </button>
        ))}
      </div>

      {activeTab === 'controlflow' && workflowId && (
        <div className="mb-8">
          <WorkflowDefinitionEditor
            workflowId={workflowId}
            projectType={projectType}
            initialDefinition={workflow.definition || '{}'}
            onSaved={loadData}
            onConvertLinear={() => api.convertWorkflowLinearToDefinition(workflowId).then(loadData)}
            addToast={addToast}
          />
        </div>
      )}

      {activeTab === 'linear' && (
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-text-primary">Execution Sequence</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-800 border border-brand-500/20">
              {workflow.testCases.length} Steps
            </span>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/85 border border-brand-200/50 text-text-primary hover:text-brand-700 hover:border-brand-500/40 text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4 text-brand-800" />
            <span>Add {isUiProject ? 'UI' : 'API'} Step</span>
          </button>
        </div>

        {workflow.testCases.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-brand-200/50 rounded-xl">
            <Settings className="w-10 h-10 text-brand-800 mx-auto mb-3" />
            <h4 className="text-text-secondary font-bold">No Steps Defined</h4>
            <p className="text-text-muted text-sm mt-1">
              Add {isUiProject ? 'UI' : 'API'} test cases to build your sequential workflow, or use the Control Flow tab.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {workflow.testCases.map((wtc: any, index: number) => (
              <div key={wtc.id} className="flex items-center gap-4 bg-white/60 border border-brand-200/40 p-4 rounded-xl group hover:border-brand-500/30 transition-colors">
                <div className="flex flex-col items-center gap-1 w-6">
                  <button
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="text-brand-700 hover:text-brand-700 disabled:opacity-20 transition-colors"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <div className="text-[10px] font-mono font-bold text-text-secondary">{index + 1}</div>
                  <button
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === workflow.testCases.length - 1}
                    className="text-brand-700 hover:text-brand-700 disabled:opacity-20 transition-colors"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getMethodColor(wtc.testCase.method)}`}>
                      {wtc.testCase.testType === 'UI' || wtc.testCase.method === 'UI' ? 'UI' : wtc.testCase.method}
                    </span>
                    <h4 className="font-semibold text-text-primary truncate">{wtc.testCase.name}</h4>
                  </div>
                  <div className="font-mono text-xs text-text-secondary truncate">
                    {wtc.testCase.path}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRemoveTestCase(wtc.id)}
                    className="p-2 rounded-lg bg-white/90 border border-brand-200/50 text-text-secondary hover:text-rose-700 hover:border-rose-500/30 transition-all"
                    title="Remove from workflow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Add Test Case Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-brand-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/85 border border-brand-200/50 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-brand-200/50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary">Add Workflow Step</h3>
              <button onClick={() => setShowAddModal(false)} className="text-text-secondary hover:text-brand-700 transition-colors">
                <Trash2 className="w-5 h-5 opacity-0" /> {/* Spacer */}
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto max-h-[60vh]">
              <label className="block text-xs font-semibold text-label uppercase tracking-wider mb-2">Select Existing Test Case</label>
              <div className="space-y-2">
                {testCasesForWorkflow.map(tc => (
                  <label key={tc.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedTestCaseToAdd === tc.id ? 'bg-brand-500/10 border-brand-500/50' : 'bg-brand-900/90 border-brand-200/50 hover:border-brand-300/40'}`}>
                    <input
                      type="radio"
                      name="testCaseId"
                      value={tc.id}
                      checked={selectedTestCaseToAdd === tc.id}
                      onChange={(e) => setSelectedTestCaseToAdd(e.target.value)}
                      className="accent-brand-500 w-4 h-4 bg-brand-100 border-brand-300/40"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getMethodColor(tc.method)}`}>
                          {tc.testType === 'UI' || tc.method === 'UI' ? 'UI' : tc.method}
                        </span>
                        <span className="font-medium text-sm text-text-primary truncate">{tc.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-text-secondary mt-1 truncate">{tc.path}</div>
                    </div>
                  </label>
                ))}
                {testCasesForWorkflow.length === 0 && (
                  <div className="text-sm text-text-secondary text-center py-4">
                    No {isUiProject ? 'UI' : 'API'} test cases available in this project.
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-brand-200/50 flex justify-end gap-3 bg-brand-900/90/50">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-brand-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTestCase}
                disabled={!selectedTestCaseToAdd}
                className="px-4 py-2 btn-primary text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                Add Step
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
