import React, { useState } from 'react';
import { Save, FileJson, Wand2 } from 'lucide-react';
import { api } from '../api';

const API_EXAMPLE_DEFINITION = {
  schemaVersion: '1.0.0',
  id: 'example-api-workflow',
  name: 'Example API Control Flow',
  variables: { maxRetries: 3 },
  defaults: { onFailure: 'fail', maxLoopIterations: 100 },
  root: {
    id: 'root',
    type: 'group',
    name: 'Main',
    children: [
      {
        id: 'login',
        type: 'testCaseRef',
        name: 'Login API',
        testCaseId: 'REPLACE_WITH_TEST_CASE_ID',
      },
      {
        id: 'check-status',
        type: 'if',
        name: 'Branch on API status',
        branches: [
          {
            kind: 'if',
            condition: {
              type: 'comparison',
              left: { source: 'jsonPath', path: '$.status' },
              operator: 'eq',
              right: 'OK',
            },
            body: [
              {
                id: 'success-path',
                type: 'testCaseRef',
                testCaseId: 'REPLACE_WITH_SUCCESS_TC_ID',
              },
            ],
          },
          {
            kind: 'else',
            body: [
              {
                id: 'fail-path',
                type: 'setVariable',
                name: 'lastError',
                value: { source: 'jsonPath', path: '$.message' },
              },
            ],
          },
        ],
      },
      {
        id: 'each-item',
        type: 'forEach',
        name: 'Process items',
        iterator: {
          kind: 'collection',
          collection: { source: 'jsonPath', path: '$.data.items' },
          itemVariable: 'item',
          indexVariable: 'index',
        },
        body: [
          {
            id: 'process-item',
            type: 'testCaseRef',
            testCaseId: 'REPLACE_WITH_ITEM_TC_ID',
            parameterOverrides: { sku: '{{item}}' },
          },
        ],
      },
    ],
  },
};

const UI_EXAMPLE_DEFINITION = {
  schemaVersion: '1.0.0',
  id: 'example-ui-workflow',
  name: 'Example UI Control Flow',
  defaults: { onFailure: 'fail', maxLoopIterations: 50 },
  root: {
    id: 'root',
    type: 'group',
    name: 'UI Main',
    children: [
      {
        id: 'open-app',
        type: 'testCaseRef',
        name: 'Open login page',
        testCaseId: 'REPLACE_WITH_UI_TEST_CASE_ID',
      },
      {
        id: 'dashboard-visible',
        type: 'if',
        name: 'Dashboard visible branch',
        branches: [
          {
            kind: 'if',
            condition: {
              type: 'comparison',
              left: {
                source: 'ui',
                locator: { locatorType: 'css', selector: '[data-testid="dashboard"]' },
                path: 'visible',
              },
              operator: 'eq',
              right: true,
            },
            body: [
              {
                id: 'run-dashboard-checks',
                type: 'testCaseRef',
                name: 'Dashboard assertions',
                testCaseId: 'REPLACE_WITH_DASHBOARD_TC_ID',
              },
            ],
          },
          {
            kind: 'else',
            body: [
              {
                id: 'retry-login',
                type: 'testCaseRef',
                name: 'Retry login flow',
                testCaseId: 'REPLACE_WITH_LOGIN_TC_ID',
              },
            ],
          },
        ],
      },
      {
        id: 'row-loop',
        type: 'for',
        name: 'Verify table rows',
        iterator: {
          kind: 'range',
          from: 0,
          to: { source: 'variable', path: 'rowCount' },
          step: 1,
          indexVariable: 'rowIndex',
        },
        body: [
          {
            id: 'check-row',
            type: 'step',
            stepKind: 'ui',
            name: 'Expect row status',
            ui: {
              action: 'expect_text',
              locatorType: 'css',
              selector: 'table tbody tr:nth-child({{rowIndex}}) td.status',
              value: 'Active',
            },
          },
        ],
      },
      {
        id: 'paginate',
        type: 'while',
        name: 'Paginate results',
        maxIterations: 20,
        condition: {
          type: 'comparison',
          left: {
            source: 'ui',
            locator: { locatorType: 'css', selector: 'button.next-page' },
            path: 'enabled',
          },
          operator: 'eq',
          right: true,
        },
        body: [
          {
            id: 'click-next',
            type: 'step',
            stepKind: 'ui',
            ui: {
              action: 'click',
              locatorType: 'css',
              selector: 'button.next-page',
            },
          },
        ],
      },
    ],
  },
};

function getExampleDefinition(projectType?: 'API' | 'UI') {
  return projectType === 'UI' ? UI_EXAMPLE_DEFINITION : API_EXAMPLE_DEFINITION;
}

export const WorkflowDefinitionEditor: React.FC<{
  workflowId: string;
  projectType?: 'API' | 'UI';
  initialDefinition: string;
  onSaved: () => void;
  onConvertLinear: () => Promise<void>;
  addToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ workflowId, projectType = 'API', initialDefinition, onSaved, onConvertLinear, addToast }) => {
  const isUi = projectType === 'UI';
  const [jsonText, setJsonText] = useState(() => {
    if (!initialDefinition || initialDefinition.trim() === '{}') {
      return JSON.stringify(getExampleDefinition(projectType), null, 2);
    }
    try {
      return JSON.stringify(JSON.parse(initialDefinition), null, 2);
    } catch {
      return initialDefinition;
    }
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const parsed = JSON.parse(jsonText);
      await api.updateWorkflowDefinition(workflowId, parsed);
      addToast('Workflow definition saved', 'success');
      onSaved();
    } catch (err: any) {
      addToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFormat = () => {
    try {
      setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
      addToast('JSON formatted', 'success');
    } catch {
      addToast('Invalid JSON', 'error');
    }
  };

  const handleLoadExample = () => {
    setJsonText(JSON.stringify(getExampleDefinition(projectType), null, 2));
  };

  return (
    <div className="glass-card p-6 rounded-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-text-primary">
            {isUi ? 'UI Control Flow Definition' : 'Control Flow Definition'}
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            {isUi
              ? 'Branch on element visibility/text, loop rows, paginate with while, and reference UI test cases.'
              : 'Supports if / elseIf / else, for, forEach, while, nested blocks, API and UI conditions.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onConvertLinear().then(() => addToast('Converted linear sequence', 'success')).catch((e) => addToast(e.message, 'error'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-text-primary hover:border-brand-500/40"
          >
            <Wand2 className="w-3.5 h-3.5" /> From Linear Steps
          </button>
          <button
            type="button"
            onClick={handleLoadExample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-text-primary"
          >
            <FileJson className="w-3.5 h-3.5" /> Load {isUi ? 'UI' : 'API'} Example
          </button>
          <button
            type="button"
            onClick={handleFormat}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-text-primary"
          >
            Format
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg btn-primary text-xs font-semibold disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Definition'}
          </button>
        </div>
      </div>
      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        spellCheck={false}
        className="w-full h-[420px] font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 outline-none focus:border-brand-500/50 resize-y"
      />
    </div>
  );
};
