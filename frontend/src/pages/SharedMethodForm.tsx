import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { Save, ArrowLeft, Plus, Trash2, Code } from 'lucide-react';
import { UiStepEditor, type UiStep } from '../components/UiStepEditor';

export const SharedMethodForm: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id?: string }>();
  const navigate = useNavigate();
  const { addToast } = useStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parameters, setParameters] = useState<string[]>([]);
  const [uiSteps, setUiSteps] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadMethod(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadMethod = async (methodId: string) => {
    try {
      setLoading(true);
      const data = await api.getSharedMethod(methodId);
      setName(data.name);
      setDescription(data.description || '');
      setParameters(JSON.parse(data.parameters || '[]'));
      setUiSteps(JSON.parse(data.uiSteps || '[]'));
      setLoading(false);
    } catch (err: any) {
      addToast(err.message, 'error');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      addToast('Name is required', 'error');
      return;
    }
    if (!projectId) return;

    try {
      setSaving(true);
      const payload = {
        name,
        description,
        parameters,
        uiSteps
      };

      if (id) {
        await api.updateSharedMethod(id, payload);
        addToast('Shared method updated successfully');
      } else {
        await api.createSharedMethod(projectId, payload);
        addToast('Shared method created successfully');
      }
      navigate('/shared-methods');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddParam = () => setParameters([...parameters, '']);
  const handleUpdateParam = (idx: number, val: string) => {
    const updated = [...parameters];
    updated[idx] = val;
    setParameters(updated);
  };
  const handleRemoveParam = (idx: number) => {
    setParameters(parameters.filter((_, i) => i !== idx));
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 border-b border-brand-200/50 flex items-center justify-between sticky top-0 bg-white/70 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-brand-100/80 rounded-xl text-text-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Code className="w-6 h-6 text-brand-500" />
              {id ? 'Edit Shared Method' : 'Create Shared Method'}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">Define reusable UI steps and parameters</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 btn-primary rounded-xl font-medium transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)]"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Method'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="bg-white/55 border border-brand-200/40 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">Basic Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Method Name *</label>
                <input 
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white/90 border border-brand-200/50 rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-500 outline-none transition-colors placeholder:text-brand-700"
                  placeholder="e.g. Login Flow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-white/90 border border-brand-200/50 rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-500 outline-none transition-colors placeholder:text-brand-700 min-h-[100px]"
                  placeholder="What does this method do?"
                />
              </div>
            </div>
          </div>

          <div className="bg-white/55 border border-brand-200/40 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Parameters</h3>
                <p className="text-sm text-text-secondary">Define variables that this method accepts (e.g. username, password). Use them in steps like {'{{username}}'}.</p>
              </div>
              <button onClick={handleAddParam} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600/20 text-brand-800 rounded-lg text-sm font-medium hover:bg-brand-600/30 transition-colors">
                <Plus className="w-4 h-4" /> Add Parameter
              </button>
            </div>
            
            {parameters.length === 0 ? (
              <div className="text-center py-8 text-sm text-text-secondary bg-brand-900/90/50 rounded-xl border border-brand-200/50 border-dashed">
                No parameters defined. Add some to make this method dynamic.
              </div>
            ) : (
              <div className="space-y-3">
                {parameters.map((param, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input 
                      type="text"
                      value={param}
                      onChange={e => handleUpdateParam(index, e.target.value)}
                      placeholder="Parameter name (e.g. username)"
                      className="flex-1 bg-white/90 border border-brand-200/50 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:border-brand-500 outline-none font-mono"
                    />
                    <button onClick={() => handleRemoveParam(index)} className="p-2.5 rounded-xl bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/55 border border-brand-200/40 rounded-2xl p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-text-primary">UI Steps</h3>
              <p className="text-sm text-text-secondary">Define the browser interactions for this method.</p>
            </div>
            <UiStepEditor projectId={projectId} steps={uiSteps} onAdd={addUiStep} onRemove={removeUiStep} onUpdate={updateUiStep} hideHeader={true} />
          </div>

        </div>
      </div>
    </div>
  );
};
