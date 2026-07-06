import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { Plus, Trash2, Edit3, Search, FolderKanban, Copy } from 'lucide-react';

export const SharedMethodsList: React.FC = () => {
  const [methods, setMethods] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { addToast } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadMethods(selectedProjectId);
    } else {
      setMethods([]);
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
      if (data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
      setLoading(false);
    } catch (err: any) {
      addToast(err.message, 'error');
      setLoading(false);
    }
  };

  const loadMethods = async (projectId: string) => {
    try {
      const data = await api.getProjectSharedMethods(projectId);
      setMethods(data);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this shared method?')) {
      try {
        await api.deleteSharedMethod(id);
        addToast('Shared method deleted');
        loadMethods(selectedProjectId);
      } catch (err: any) {
        addToast(err.message, 'error');
      }
    }
  };

  const handleDuplicate = async (method: any) => {
    try {
      await api.createSharedMethod(selectedProjectId, {
        name: `${method.name} (Copy)`,
        description: method.description,
        parameters: JSON.parse(method.parameters || '[]'),
        uiSteps: JSON.parse(method.uiSteps || '[]')
      });
      addToast('Method duplicated');
      loadMethods(selectedProjectId);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const filteredMethods = methods.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border-b border-brand-200/60 bg-white/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-10 backdrop-blur-md shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient-aqua">Shared Methods</h1>
          <p className="text-sm text-text-muted mt-1">Reusable UI flows and interactions</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <select 
            className="bg-white/85 border border-brand-300/40 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 w-full sm:w-auto"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {selectedProjectId && (
            <Link 
              to={`/projects/${selectedProjectId}/shared-methods/new`} 
              className="px-5 py-2.5 btn-primary rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Create Method
            </Link>
          )}
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1">
        <div className="mb-6 max-w-md relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text" 
            placeholder="Search methods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/60 border border-brand-200/40 rounded-xl text-sm focus:border-brand-500 outline-none transition-colors"
          />
        </div>

        {filteredMethods.length === 0 ? (
          <div className="text-center py-20 bg-white/45 border border-brand-200/35 rounded-2xl">
            <FolderKanban className="w-16 h-16 text-brand-800 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-primary">No Shared Methods Found</h3>
            <p className="text-text-secondary mt-2 max-w-md mx-auto">Create reusable methods to avoid duplicating steps across your test cases.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMethods.map((method) => {
              const paramCount = (JSON.parse(method.parameters || '[]')).length;
              const stepCount = (JSON.parse(method.uiSteps || '[]')).length;

              return (
                <div key={method.id} className="bg-white/55 border border-brand-200/40 rounded-2xl p-6 hover:border-brand-500/50 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-600 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-bold text-lg text-text-primary">{method.name}</h3>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleDuplicate(method)} className="p-2 hover:bg-brand-100/80 rounded-lg text-text-secondary hover:text-brand-700 transition-colors" title="Duplicate">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => navigate(`/projects/${selectedProjectId}/shared-methods/${method.id}`)} className="p-2 hover:bg-brand-100/80 rounded-lg text-text-secondary hover:text-brand-700 transition-colors" title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(method.id)} className="p-2 hover:bg-rose-500/20 rounded-lg text-text-secondary hover:text-rose-700 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-text-secondary mb-6 line-clamp-2 min-h-[40px]">
                    {method.description || 'No description provided.'}
                  </p>

                  <div className="flex items-center gap-4 text-xs font-medium text-text-secondary bg-white/55 rounded-xl p-3 border border-brand-200/40">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {paramCount} Params
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      {stepCount} Steps
                    </div>
                    <div className="ml-auto text-[10px] uppercase tracking-wider">
                      {new Date(method.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
