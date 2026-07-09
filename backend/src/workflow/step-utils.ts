import type { UiLocator } from './types';

export const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export function resolveVariables(template: string, vars: Record<string, string>): string {
  if (typeof template !== 'string') return String(template);
  return template.replace(/\{\{\s*(\w+(?:\.\w+)*)\s*\}\}/g, (_, name: string) => {
    const val = getVariableByPath(vars, name);
    return val !== undefined ? String(val) : `{{${name}}}`;
  });
}

export function getVariableByPath(vars: Record<string, string>, path: string): string | undefined {
  if (!path.includes('.')) {
    return vars[path];
  }
  const parts = path.split('.');
  let current: unknown = vars[parts[0]];
  for (let i = 1; i < parts.length; i++) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[parts[i]];
    } else {
      return undefined;
    }
  }
  return current !== undefined && current !== null ? String(current) : undefined;
}

export function resolveHeaders(
  headers: Record<string, string>,
  vars: Record<string, string>
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    resolved[k] = resolveVariables(v, vars);
  }
  return resolved;
}

export function resolveParams(
  params: Record<string, string>,
  vars: Record<string, string>
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    resolved[k] = resolveVariables(v, vars);
  }
  return resolved;
}

export function buildUrl(baseUrl: string, rawPath: string, vars: Record<string, string>): string {
  const path = resolveVariables(rawPath, vars);
  if (/^https?:\/\//i.test(path)) return path;
  const base = baseUrl.replace(/\/+$/, '');
  if (!path) return base;
  if (path.startsWith('?') || path.startsWith('#')) return `${base}${path}`;
  const segment = path.replace(/^\/+/, '');
  if (segment && !segment.includes('/')) {
    try {
      const u = new URL(base);
      const p = u.pathname.replace(/\/+$/, '');
      if (p.endsWith(`/${segment}`) || p.endsWith(segment)) return base;
    } catch {
      // ponytail: invalid base URL — fall through to string join
    }
  }
  return segment ? `${base}/${segment}` : base;
}

export function isJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function getValueByPath(obj: unknown, jsonPath: string): unknown {
  if (jsonPath === '$') return obj;
  if (!jsonPath.startsWith('$.')) return undefined;
  const normalizedPath = jsonPath.slice(2).replace(/\[(\w+)\]/g, '.$1');
  const parts = normalizedPath.split('.').map((p) => p.trim()).filter(Boolean);

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function getLocator(page: import('@playwright/test').Page, step: { locatorType?: string; selector?: string }) {
  const type = step.locatorType || 'css';
  const sel = step.selector || '';
  switch (type) {
    case 'text':
      return page.getByText(sel);
    case 'role':
      return page.getByRole(sel as Parameters<typeof page.getByRole>[0]);
    case 'testId':
      return page.getByTestId(sel);
    case 'placeholder':
      return page.getByPlaceholder(sel);
    case 'label':
      return page.getByLabel(sel);
    case 'xpath':
      return page.locator(`xpath=${sel}`);
    default:
      return page.locator(sel);
  }
}

export function locatorFromDef(page: import('@playwright/test').Page, locator: UiLocator) {
  return getLocator(page, { locatorType: locator.locatorType, selector: locator.selector });
}

export function coerceNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
