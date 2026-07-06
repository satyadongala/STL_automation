import React from 'react';
import { CheckCircle2, XCircle, Circle, SkipForward } from 'lucide-react';

export interface ExecutionSpan {
  id: string;
  parentSpanId: string | null;
  nodeId: string;
  nodeType: string;
  name: string | null;
  status: string;
  iteration: number | null;
  durationMs: number;
  errorMessage?: string | null;
}

function statusIcon(status: string) {
  if (status === 'PASSED') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />;
  if (status === 'FAILED') return <XCircle className="w-3.5 h-3.5 text-rose-700" />;
  if (status === 'SKIPPED') return <SkipForward className="w-3.5 h-3.5 text-text-secondary" />;
  return <Circle className="w-3.5 h-3.5 text-brand-800 animate-pulse" />;
}

function buildTree(spans: ExecutionSpan[]): (ExecutionSpan & { children: ExecutionSpan[] })[] {
  const map = new Map<string, ExecutionSpan & { children: ExecutionSpan[] }>();
  const roots: (ExecutionSpan & { children: ExecutionSpan[] })[] = [];

  for (const span of spans) {
    map.set(span.id, { ...span, children: [] });
  }
  for (const span of spans) {
    const node = map.get(span.id)!;
    if (span.parentSpanId && map.has(span.parentSpanId)) {
      map.get(span.parentSpanId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

const SpanNode: React.FC<{ span: ExecutionSpan & { children: ExecutionSpan[] }; depth: number }> = ({
  span,
  depth,
}) => (
  <div className="select-none">
    <div
      className="flex items-center gap-2 py-1.5 text-xs"
      style={{ paddingLeft: depth * 16 }}
    >
      {statusIcon(span.status)}
      <span className="font-mono text-text-secondary">{span.nodeType}</span>
      <span className="text-text-primary truncate">{span.name || span.nodeId}</span>
      {span.iteration !== null && span.iteration !== undefined && (
        <span className="text-brand-700">#{span.iteration}</span>
      )}
      {span.durationMs > 0 && <span className="text-brand-700 ml-auto">{span.durationMs}ms</span>}
    </div>
    {span.errorMessage && (
      <div className="text-[10px] text-rose-700/90 pl-8 pb-1" style={{ paddingLeft: depth * 16 + 24 }}>
        {span.errorMessage}
      </div>
    )}
    {span.children.map((child) => (
      <SpanNode key={child.id} span={child as ExecutionSpan & { children: ExecutionSpan[] }} depth={depth + 1} />
    ))}
  </div>
);

export const ExecutionSpanTree: React.FC<{ spans: ExecutionSpan[] }> = ({ spans }) => {
  if (!spans.length) {
    return (
      <div className="text-center py-8 text-brand-700 text-xs">
        No workflow spans recorded (linear Playwright run or run still in progress).
      </div>
    );
  }

  const roots = buildTree(spans);
  return (
    <div className="font-mono text-xs overflow-y-auto max-h-[320px]">
      {roots.map((root) => (
        <SpanNode key={root.id} span={root} depth={0} />
      ))}
    </div>
  );
};
