"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConditionEvaluator = void 0;
const step_utils_1 = require("./step-utils");
class ConditionEvaluator {
    static resolveValue(ref, ctx, resources) {
        if (ref === null || typeof ref === 'boolean' || typeof ref === 'number') {
            return ref;
        }
        if (typeof ref === 'string') {
            return (0, step_utils_1.resolveVariables)(ref, ctx.getSnapshot());
        }
        if (!ref || typeof ref !== 'object' || !('source' in ref)) {
            return ref;
        }
        const vars = ctx.getSnapshot();
        switch (ref.source) {
            case 'literal':
                return ref.path ?? '';
            case 'variable':
                return ctx.get(ref.path || '') ?? '';
            case 'env':
                return process.env[ref.path || ''] ?? '';
            case 'jsonPath': {
                const body = ctx.lastApiResponse?.bodyJson ?? ctx.lastApiResponse?.bodyText;
                if (body === undefined)
                    return undefined;
                const json = typeof body === 'string'
                    ? (() => {
                        try {
                            return JSON.parse(body);
                        }
                        catch {
                            return body;
                        }
                    })()
                    : body;
                return (0, step_utils_1.getValueByPath)(json, ref.path || '$');
            }
            case 'ui': {
                if (!resources.page || !ref.locator)
                    return undefined;
                const locator = (0, step_utils_1.locatorFromDef)(resources.page, ref.locator);
                const probe = ref.path || 'text';
                if (probe === 'text')
                    return locator.innerText().catch(() => '');
                if (probe === 'value')
                    return locator.inputValue().catch(() => '');
                if (probe === 'visible')
                    return locator.isVisible().catch(() => false);
                if (probe === 'enabled')
                    return locator.isEnabled().catch(() => false);
                if (probe === 'count')
                    return locator.count().catch(() => 0);
                return locator.innerText().catch(() => '');
            }
            default:
                return undefined;
        }
    }
    static evaluate(condition, ctx, resources) {
        if (condition.type === 'logical') {
            if (condition.op === 'not') {
                return !this.evaluate(condition.conditions[0], ctx, resources);
            }
            if (condition.op === 'and') {
                return condition.conditions.every((c) => this.evaluate(c, ctx, resources));
            }
            return condition.conditions.some((c) => this.evaluate(c, ctx, resources));
        }
        const left = this.resolveValue(condition.left, ctx, resources);
        if (condition.operator === 'exists') {
            return left !== undefined && left !== null && left !== '';
        }
        const right = condition.right !== undefined ? this.resolveValue(condition.right, ctx, resources) : undefined;
        switch (condition.operator) {
            case 'eq':
                return String(left) === String(right);
            case 'neq':
                return String(left) !== String(right);
            case 'gt':
                return (0, step_utils_1.coerceNumber)(left) > (0, step_utils_1.coerceNumber)(right);
            case 'gte':
                return (0, step_utils_1.coerceNumber)(left) >= (0, step_utils_1.coerceNumber)(right);
            case 'lt':
                return (0, step_utils_1.coerceNumber)(left) < (0, step_utils_1.coerceNumber)(right);
            case 'lte':
                return (0, step_utils_1.coerceNumber)(left) <= (0, step_utils_1.coerceNumber)(right);
            case 'contains':
                return String(left).includes(String(right));
            case 'matches':
                try {
                    return new RegExp(String(right)).test(String(left));
                }
                catch {
                    return false;
                }
            case 'in': {
                const list = Array.isArray(right) ? right : String(right).split(',').map((s) => s.trim());
                return list.map(String).includes(String(left));
            }
            default:
                return false;
        }
    }
}
exports.ConditionEvaluator = ConditionEvaluator;
