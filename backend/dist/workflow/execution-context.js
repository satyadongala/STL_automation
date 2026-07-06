"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionContext = void 0;
class ExecutionContext {
    globalVars;
    frames = [];
    lastApiResponse = null;
    constructor(globalVars) {
        this.globalVars = globalVars;
        this.frames.push({ kind: 'workflow', vars: {} });
    }
    static merge(projectVars, envVars, workflowVars = {}) {
        const merged = {
            ...projectVars,
            ...envVars,
        };
        for (const [k, v] of Object.entries(workflowVars)) {
            if (v !== null && v !== undefined)
                merged[k] = String(v);
        }
        return new ExecutionContext(merged);
    }
    pushScope(initial = {}, kind = 'loop') {
        this.frames.push({ kind, vars: { ...initial } });
    }
    popScope() {
        if (this.frames.length > 1) {
            this.frames.pop();
        }
    }
    getSnapshot() {
        const out = { ...this.globalVars };
        for (const frame of this.frames) {
            Object.assign(out, frame.vars);
        }
        return out;
    }
    get(path) {
        for (let i = this.frames.length - 1; i >= 0; i--) {
            const val = this.frames[i].vars[path];
            if (val !== undefined)
                return val;
        }
        if (path.includes('.')) {
            const root = path.split('.')[0];
            const rest = path.slice(root.length + 1);
            const rootVal = this.get(root);
            if (rootVal === undefined)
                return this.globalVars[path];
            try {
                const parsed = JSON.parse(rootVal);
                let current = parsed;
                for (const part of rest.split('.')) {
                    if (current === null || current === undefined)
                        return undefined;
                    current = current[part];
                }
                return current !== undefined && current !== null ? String(current) : undefined;
            }
            catch {
                return undefined;
            }
        }
        return this.globalVars[path];
    }
    set(name, value, scope = 'workflow') {
        if (scope === 'global') {
            this.globalVars[name] = value;
            return;
        }
        const frame = scope === 'loop'
            ? [...this.frames].reverse().find((f) => f.kind === 'loop') || this.frames[this.frames.length - 1]
            : this.frames.find((f) => f.kind === 'workflow') || this.frames[0];
        frame.vars[name] = value;
    }
    applyOverrides(overrides = {}) {
        for (const [k, v] of Object.entries(overrides)) {
            this.set(k, v, 'workflow');
        }
    }
}
exports.ExecutionContext = ExecutionContext;
