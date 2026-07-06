import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api';

export interface UiStep {
  action?: string;
  selector?: string;
  value?: string;
  variableName?: string;
  label?: string;
  locatorType?: string;
  methodId?: string; // For useMethod
  params?: Record<string, string>; // For useMethod parameters map
}

export const uiActions = [
  { value: 'click', label: 'Click', needsSelector: true, needsValue: false },
  { value: 'fill', label: 'Fill', needsSelector: true, needsValue: true },
  { value: 'select', label: 'Select Option', needsSelector: true, needsValue: true },
  { value: 'check', label: 'Check', needsSelector: true, needsValue: false },
  { value: 'uncheck', label: 'Uncheck', needsSelector: true, needsValue: false },
  { value: 'wait_for_selector', label: 'Wait For Selector', needsSelector: true, needsValue: false },
  { value: 'expect_visible', label: 'Expect Visible', needsSelector: true, needsValue: false },
  { value: 'expect_text', label: 'Expect Text', needsSelector: true, needsValue: true },
  { value: 'expect_url', label: 'Expect URL', needsSelector: false, needsValue: true },
  { value: 'extract_text', label: 'Extract Text', needsSelector: true, needsValue: false, needsVariable: true },
  { value: 'goto', label: 'Go To URL/Path', needsSelector: false, needsValue: true },
  { value: 'screenshot', label: 'Screenshot', needsSelector: false, needsValue: true },
  { value: 'useMethod', label: 'Use Shared Method', needsSelector: false, needsValue: false, isMethod: true }
];

export const UiStepEditor: React.FC<{
  projectId?: string;
  steps: UiStep[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: keyof UiStep, val: any) => void;
  hideHeader?: boolean;
}> = ({ projectId, steps, onAdd, onRemove, onUpdate, hideHeader }) => {
  const [sharedMethods, setSharedMethods] = useState<any[]>([]);

  useEffect(() => {
    if (projectId) {
      api.getProjectSharedMethods(projectId).then(setSharedMethods).catch(console.error);
    }
  }, [projectId]);

  return (
    <div className="glass-card p-6 rounded-2xl space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between border-b border-brand-200/50 pb-3">
          <span className="text-xs font-bold text-label uppercase tracking-wider">Browser Steps</span>
        </div>
      )}
      {steps.length === 0 ? (
        <div className="text-center py-10 text-brand-700 text-xs">No UI steps defined.</div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => {
            const action = uiActions.find((item) => item.value === step.action) || uiActions[0];
            const isMethod = action.isMethod;
            const selectedMethod = isMethod ? sharedMethods.find(m => m.id === step.methodId) : null;
            const methodParams: string[] = selectedMethod ? JSON.parse(selectedMethod.parameters || '[]') : [];

            return (
              <div key={index} className="bg-white/50 border border-brand-200/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-white/85 border border-brand-200/50 flex items-center justify-center text-[10px] font-bold text-text-secondary">{index + 1}</span>
                  <select value={step.action || 'click'} onChange={(e) => onUpdate(index, 'action', e.target.value)} className="flex-1 bg-white/85 border border-brand-200/50 rounded-lg px-3 py-2 text-xs font-bold text-text-primary outline-none">
                    {uiActions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <button type="button" onClick={() => onRemove(index)} className="p-2 rounded-lg bg-white/85 border border-brand-200/50 text-text-secondary hover:text-rose-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                {isMethod ? (
                  <div className="grid grid-cols-1 gap-3">
                    <select 
                      value={step.methodId || ''} 
                      onChange={(e) => {
                        onUpdate(index, 'methodId', e.target.value);
                        onUpdate(index, 'params', {});
                      }}
                      className="bg-white/85 border border-brand-200/50 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-500"
                    >
                      <option value="">-- Select Shared Method --</option>
                      {sharedMethods.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>

                    {selectedMethod && methodParams.length > 0 && (
                      <div className="bg-white/55 p-3 rounded-xl border border-brand-200/50">
                        <span className="text-[10px] font-bold text-label uppercase tracking-wider mb-2 block">Map Parameters</span>
                        <div className="space-y-2">
                          {methodParams.map(paramName => (
                            <div key={paramName} className="flex items-center gap-2">
                              <span className="text-xs font-mono text-text-primary w-1/3 truncate">{paramName}</span>
                              <input 
                                value={(step.params || {})[paramName] || ''}
                                onChange={(e) => {
                                  const newParams = { ...(step.params || {}), [paramName]: e.target.value };
                                  onUpdate(index, 'params', newParams);
                                }}
                                placeholder={`Value for ${paramName}`}
                                className="flex-1 bg-white/90 border border-brand-200/50 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-brand-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {action.needsSelector && (
                      <>
                        <input value={step.selector || ''} onChange={(e) => onUpdate(index, 'selector', e.target.value)} placeholder="Selector, e.g. [data-testid=email]" className="bg-white/85 border border-brand-200/50 rounded-lg px-3 py-2 text-xs font-mono outline-none" />
                        <select value={step.locatorType || 'css'} onChange={(e) => onUpdate(index, 'locatorType', e.target.value)} className="bg-white/85 border border-brand-200/50 rounded-lg px-2 py-1 text-xs outline-none">
                          <option value="css">CSS</option>
                          <option value="text">Text</option>
                          <option value="role">Role</option>
                          <option value="testId">Test ID</option>
                          <option value="placeholder">Placeholder</option>
                          <option value="label">Label</option>
                          <option value="xpath">XPath</option>
                        </select>
                      </>
                    )}
                    {action.needsValue && (
                      <input value={step.value || ''} onChange={(e) => onUpdate(index, 'value', e.target.value)} placeholder="Value/Expected" className="bg-white/85 border border-brand-200/50 rounded-lg px-3 py-2 text-xs outline-none" />
                    )}
                    {action.needsVariable && (
                      <input value={step.variableName || ''} onChange={(e) => onUpdate(index, 'variableName', e.target.value)} placeholder="Variable Name" className="bg-white/85 border border-brand-200/50 rounded-lg px-3 py-2 text-xs outline-none" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex justify-end pt-2 border-t border-brand-200/50">
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600/20 text-brand-800 rounded-lg text-sm font-medium hover:bg-brand-600/30 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Step
        </button>
      </div>
    </div>
  );
};
