"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceReporter = void 0;
const db_1 = __importDefault(require("../db"));
const ws_1 = require("../ws");
const limits_1 = require("./limits");
class TraceReporter {
    runId;
    onLog;
    spanCount = 0;
    constructor(runId, onLog) {
        this.runId = runId;
        this.onLog = onLog;
    }
    log(line) {
        if (this.onLog)
            this.onLog(line);
        ws_1.wsManager.streamLog(this.runId, line);
    }
    async startSpan(input) {
        if (++this.spanCount > limits_1.WORKFLOW_LIMITS.maxSpanCount) {
            throw new Error(`Max span count ${limits_1.WORKFLOW_LIMITS.maxSpanCount} exceeded`);
        }
        const span = await db_1.default.executionSpan.create({
            data: {
                executionRunId: input.runId,
                parentSpanId: input.parentSpanId,
                nodeId: input.nodeId,
                nodeType: input.nodeType,
                name: input.name || input.nodeId,
                status: 'RUNNING',
                iteration: input.iteration ?? null,
            },
        });
        ws_1.wsManager.streamSpan(this.runId, {
            type: 'SPAN_STARTED',
            span: {
                id: span.id,
                parentSpanId: span.parentSpanId,
                nodeId: span.nodeId,
                nodeType: span.nodeType,
                name: span.name,
                status: span.status,
                iteration: span.iteration,
            },
        });
        return span.id;
    }
    async endSpan(spanId, status, detail = {}, errorMessage) {
        const span = await db_1.default.executionSpan.update({
            where: { id: spanId },
            data: {
                status,
                completedAt: new Date(),
                durationMs: 0,
                detail: JSON.stringify(detail),
                errorMessage: errorMessage || null,
            },
        });
        const started = span.startedAt.getTime();
        const completed = span.completedAt?.getTime() ?? Date.now();
        await db_1.default.executionSpan.update({
            where: { id: spanId },
            data: { durationMs: completed - started },
        });
        ws_1.wsManager.streamSpan(this.runId, {
            type: 'SPAN_COMPLETED',
            span: {
                id: spanId,
                status,
                errorMessage,
            },
        });
    }
}
exports.TraceReporter = TraceReporter;
