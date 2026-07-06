"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefinitionValidationError = void 0;
exports.parseWorkflowDefinition = parseWorkflowDefinition;
exports.hasControlFlowDefinition = hasControlFlowDefinition;
exports.validateWorkflowDefinition = validateWorkflowDefinition;
const limits_1 = require("./limits");
class DefinitionValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DefinitionValidationError';
    }
}
exports.DefinitionValidationError = DefinitionValidationError;
function parseWorkflowDefinition(raw) {
    if (!raw || raw.trim() === '' || raw.trim() === '{}')
        return null;
    try {
        const parsed = JSON.parse(raw);
        validateWorkflowDefinition(parsed);
        return parsed;
    }
    catch (e) {
        if (e instanceof DefinitionValidationError)
            throw e;
        throw new DefinitionValidationError(`Invalid workflow definition JSON: ${e.message}`);
    }
}
function hasControlFlowDefinition(raw) {
    try {
        const def = parseWorkflowDefinition(raw);
        if (!def?.root)
            return false;
        return nodeHasExecutableContent(def.root);
    }
    catch {
        return false;
    }
}
function nodeHasExecutableContent(node) {
    switch (node.type) {
        case 'group':
            return (node.children?.length ?? 0) > 0;
        case 'if':
        case 'for':
        case 'forEach':
        case 'while':
        case 'step':
        case 'testCaseRef':
        case 'setVariable':
            return true;
        default:
            return false;
    }
}
function validateWorkflowDefinition(def) {
    if (!def.schemaVersion) {
        throw new DefinitionValidationError('schemaVersion is required');
    }
    if (!def.root) {
        throw new DefinitionValidationError('root node is required');
    }
    validateNode(def.root, 0);
}
function validateNode(node, depth) {
    if (depth > limits_1.WORKFLOW_LIMITS.maxNestingDepth) {
        throw new DefinitionValidationError(`Max nesting depth ${limits_1.WORKFLOW_LIMITS.maxNestingDepth} exceeded`);
    }
    if (!node.id || !node.type) {
        throw new DefinitionValidationError('Each node requires id and type');
    }
    switch (node.type) {
        case 'group':
            (node.children || []).forEach((c) => validateNode(c, depth + 1));
            break;
        case 'step':
            if (!node.stepKind)
                throw new DefinitionValidationError(`Step ${node.id} requires stepKind`);
            break;
        case 'testCaseRef':
            if (!node.testCaseId)
                throw new DefinitionValidationError(`testCaseRef ${node.id} requires testCaseId`);
            break;
        case 'if':
            if (!node.branches?.length)
                throw new DefinitionValidationError(`if ${node.id} requires branches`);
            for (const b of node.branches) {
                if (b.kind !== 'else' && !b.condition) {
                    throw new DefinitionValidationError(`Branch ${b.kind} in ${node.id} requires condition`);
                }
                (b.body || []).forEach((c) => validateNode(c, depth + 1));
            }
            break;
        case 'for':
            if (!node.iterator || node.iterator.kind !== 'range') {
                throw new DefinitionValidationError(`for ${node.id} requires range iterator`);
            }
            (node.body || []).forEach((c) => validateNode(c, depth + 1));
            break;
        case 'forEach':
            if (!node.iterator?.collection) {
                throw new DefinitionValidationError(`forEach ${node.id} requires collection`);
            }
            (node.body || []).forEach((c) => validateNode(c, depth + 1));
            break;
        case 'while':
            if (!node.condition)
                throw new DefinitionValidationError(`while ${node.id} requires condition`);
            (node.body || []).forEach((c) => validateNode(c, depth + 1));
            break;
        case 'setVariable':
            if (!node.name)
                throw new DefinitionValidationError(`setVariable ${node.id} requires name`);
            break;
        default:
            throw new DefinitionValidationError(`Unknown node type: ${node.type}`);
    }
}
