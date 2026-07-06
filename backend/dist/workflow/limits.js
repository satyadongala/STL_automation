"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKFLOW_LIMITS = void 0;
exports.WORKFLOW_LIMITS = {
    maxNestingDepth: 32,
    maxLoopIterations: 10_000,
    maxWhileIterationsPerNode: 1_000,
    maxRunDurationMs: 3_600_000,
    maxSpanCount: 100_000,
    sharedMethodMaxDepth: 20,
};
