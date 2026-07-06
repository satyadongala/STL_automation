import prisma from '../db';
import { wsManager } from '../ws';
import { WORKFLOW_LIMITS } from './limits';

export interface SpanStartInput {
  runId: string;
  parentSpanId: string | null;
  nodeId: string;
  nodeType: string;
  name?: string;
  iteration?: number;
}

export class TraceReporter {
  private spanCount = 0;

  constructor(
    private readonly runId: string,
    private readonly onLog?: (line: string) => void
  ) {}

  log(line: string): void {
    if (this.onLog) this.onLog(line);
    wsManager.streamLog(this.runId, line);
  }

  async startSpan(input: SpanStartInput): Promise<string> {
    if (++this.spanCount > WORKFLOW_LIMITS.maxSpanCount) {
      throw new Error(`Max span count ${WORKFLOW_LIMITS.maxSpanCount} exceeded`);
    }

    const span = await prisma.executionSpan.create({
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

    wsManager.streamSpan(this.runId, {
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

  async endSpan(
    spanId: string,
    status: 'PASSED' | 'FAILED' | 'SKIPPED',
    detail: Record<string, unknown> = {},
    errorMessage?: string
  ): Promise<void> {
    const span = await prisma.executionSpan.update({
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
    await prisma.executionSpan.update({
      where: { id: spanId },
      data: { durationMs: completed - started },
    });

    wsManager.streamSpan(this.runId, {
      type: 'SPAN_COMPLETED',
      span: {
        id: spanId,
        status,
        errorMessage,
      },
    });
  }
}
