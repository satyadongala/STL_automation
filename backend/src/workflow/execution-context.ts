import type { LastApiResponse } from './types';

export type VariableScope = 'loop' | 'workflow' | 'global';

interface ScopeFrame {
  kind: VariableScope;
  vars: Record<string, string>;
}

export class ExecutionContext {
  private frames: ScopeFrame[] = [];
  public lastApiResponse: LastApiResponse | null = null;

  constructor(
    public readonly globalVars: Record<string, string>
  ) {
    this.frames.push({ kind: 'workflow', vars: {} });
  }

  static merge(
    projectVars: Record<string, string>,
    envVars: Record<string, string>,
    workflowVars: Record<string, string | number | boolean | null> = {}
  ): ExecutionContext {
    const merged: Record<string, string> = {
      ...projectVars,
      ...envVars,
    };
    for (const [k, v] of Object.entries(workflowVars)) {
      if (v !== null && v !== undefined) merged[k] = String(v);
    }
    return new ExecutionContext(merged);
  }

  pushScope(initial: Record<string, string> = {}, kind: VariableScope = 'loop'): void {
    this.frames.push({ kind, vars: { ...initial } });
  }

  popScope(): void {
    if (this.frames.length > 1) {
      this.frames.pop();
    }
  }

  getSnapshot(): Record<string, string> {
    const out = { ...this.globalVars };
    for (const frame of this.frames) {
      Object.assign(out, frame.vars);
    }
    return out;
  }

  get(path: string): string | undefined {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const val = this.frames[i].vars[path];
      if (val !== undefined) return val;
    }
    if (path.includes('.')) {
      const root = path.split('.')[0];
      const rest = path.slice(root.length + 1);
      const rootVal = this.get(root);
      if (rootVal === undefined) return this.globalVars[path];
      try {
        const parsed = JSON.parse(rootVal);
        let current: unknown = parsed;
        for (const part of rest.split('.')) {
          if (current === null || current === undefined) return undefined;
          current = (current as Record<string, unknown>)[part];
        }
        return current !== undefined && current !== null ? String(current) : undefined;
      } catch {
        return undefined;
      }
    }
    return this.globalVars[path];
  }

  set(name: string, value: string, scope: VariableScope = 'workflow'): void {
    if (scope === 'global') {
      this.globalVars[name] = value;
      return;
    }
    const frame =
      scope === 'loop'
        ? [...this.frames].reverse().find((f) => f.kind === 'loop') || this.frames[this.frames.length - 1]
        : this.frames.find((f) => f.kind === 'workflow') || this.frames[0];
    frame.vars[name] = value;
  }

  applyOverrides(overrides: Record<string, string> = {}): void {
    for (const [k, v] of Object.entries(overrides)) {
      this.set(k, v, 'workflow');
    }
  }
}
