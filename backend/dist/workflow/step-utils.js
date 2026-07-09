"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJson = void 0;
exports.resolveVariables = resolveVariables;
exports.getVariableByPath = getVariableByPath;
exports.resolveHeaders = resolveHeaders;
exports.resolveParams = resolveParams;
exports.buildUrl = buildUrl;
exports.isJson = isJson;
exports.getValueByPath = getValueByPath;
exports.getLocator = getLocator;
exports.locatorFromDef = locatorFromDef;
exports.coerceNumber = coerceNumber;
const parseJson = (value, fallback) => {
    try {
        return value ? JSON.parse(value) : fallback;
    }
    catch {
        return fallback;
    }
};
exports.parseJson = parseJson;
function resolveVariables(template, vars) {
    if (typeof template !== 'string')
        return String(template);
    return template.replace(/\{\{\s*(\w+(?:\.\w+)*)\s*\}\}/g, (_, name) => {
        const val = getVariableByPath(vars, name);
        return val !== undefined ? String(val) : `{{${name}}}`;
    });
}
function getVariableByPath(vars, path) {
    if (!path.includes('.')) {
        return vars[path];
    }
    const parts = path.split('.');
    let current = vars[parts[0]];
    for (let i = 1; i < parts.length; i++) {
        if (current === null || current === undefined)
            return undefined;
        if (typeof current === 'object') {
            current = current[parts[i]];
        }
        else {
            return undefined;
        }
    }
    return current !== undefined && current !== null ? String(current) : undefined;
}
function resolveHeaders(headers, vars) {
    const resolved = {};
    for (const [k, v] of Object.entries(headers)) {
        resolved[k] = resolveVariables(v, vars);
    }
    return resolved;
}
function resolveParams(params, vars) {
    const resolved = {};
    for (const [k, v] of Object.entries(params)) {
        resolved[k] = resolveVariables(v, vars);
    }
    return resolved;
}
function buildUrl(baseUrl, rawPath, vars) {
    const path = resolveVariables(rawPath, vars);
    if (/^https?:\/\//i.test(path))
        return path;
    const base = baseUrl.replace(/\/+$/, '');
    if (!path)
        return base;
    if (path.startsWith('?') || path.startsWith('#'))
        return `${base}${path}`;
    const segment = path.replace(/^\/+/, '');
    if (segment && !segment.includes('/')) {
        try {
            const u = new URL(base);
            const p = u.pathname.replace(/\/+$/, '');
            if (p.endsWith(`/${segment}`) || p.endsWith(segment))
                return base;
        }
        catch {
            // ponytail: invalid base URL — fall through to string join
        }
    }
    return segment ? `${base}/${segment}` : base;
}
function isJson(str) {
    try {
        JSON.parse(str);
        return true;
    }
    catch {
        return false;
    }
}
function getValueByPath(obj, jsonPath) {
    if (jsonPath === '$')
        return obj;
    if (!jsonPath.startsWith('$.'))
        return undefined;
    const normalizedPath = jsonPath.slice(2).replace(/\[(\w+)\]/g, '.$1');
    const parts = normalizedPath.split('.').map((p) => p.trim()).filter(Boolean);
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined)
            return undefined;
        current = current[part];
    }
    return current;
}
function getLocator(page, step) {
    const type = step.locatorType || 'css';
    const sel = step.selector || '';
    switch (type) {
        case 'text':
            return page.getByText(sel);
        case 'role':
            return page.getByRole(sel);
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
function locatorFromDef(page, locator) {
    return getLocator(page, { locatorType: locator.locatorType, selector: locator.selector });
}
function coerceNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
