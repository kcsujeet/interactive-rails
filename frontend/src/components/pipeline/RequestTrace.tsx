/**
 * Request Trace Component
 *
 * Visualizes the execution path of a request through the pipeline.
 * Shows which nodes were visited, call counts, and timing.
 */

import { useState } from 'react';
import type { PlacedNode, Connection, SimulatedRequest, QueryTrace } from '../game/types';
import { getNodeInfo } from '../game/data';
import { Button } from '../ui/Button';

interface RequestTraceProps {
  request: SimulatedRequest | null;
  placedNodes: PlacedNode[];
  connections: Connection[];
  onHighlightNode?: (nodeId: string | null) => void;
  onHighlightConnection?: (connectionId: string | null) => void;
  className?: string;
}

interface TraceStep {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  duration: number;
  queries: QueryTrace[];
  callCount: number;
  index: number;
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function TraceStepItem({
  step,
  isLast,
  onHover,
}: {
  step: TraceStep;
  isLast: boolean;
  onHover: (nodeId: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const nodeInfo = getNodeInfo(step.nodeType);
  const hasQueries = step.queries.length > 0;
  const hasNPlusOne = step.queries.some((q) => q.isNPlusOne);

  return (
    <div
      className="relative"
      onMouseEnter={() => onHover(step.nodeId)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-border" />
      )}

      {/* Step content */}
      <div className="flex items-start gap-3 pb-4">
        {/* Node indicator */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: nodeInfo.color }}
        >
          {step.index + 1}
        </div>

        {/* Step details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{step.nodeName}</span>
            <span className="text-muted-foreground text-xs">{step.nodeType}</span>
            {step.callCount > 1 && (
              <span className="text-warning text-xs">x{step.callCount}</span>
            )}
            {hasNPlusOne && (
              <span className="text-destructive text-xs font-bold">N+1</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span>{formatDuration(step.duration)}</span>
            {hasQueries && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-auto p-0 text-xs"
              >
                {step.queries.length} queries {expanded ? '[-]' : '[+]'}
              </Button>
            )}
          </div>

          {/* Expanded queries */}
          {expanded && hasQueries && (
            <div className="mt-2 space-y-1">
              {step.queries.map((query) => (
                <div
                  key={query.id}
                  className={`p-2 rounded text-xs font-mono ${
                    query.isNPlusOne
                      ? 'bg-destructive/30 border border-destructive'
                      : 'bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground">
                      {formatDuration(query.duration)}
                    </span>
                    {query.cached && (
                      <span className="text-success">[cached]</span>
                    )}
                    {query.isNPlusOne && (
                      <span className="text-destructive">[N+1]</span>
                    )}
                  </div>
                  <div className="text-foreground break-all">{query.sql}</div>
                  {query.rowCount !== undefined && (
                    <div className="text-muted-foreground mt-1">
                      Rows: {query.rowCount}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RequestTrace({
  request,
  placedNodes,
  connections,
  onHighlightNode,
  onHighlightConnection,
  className = '',
}: RequestTraceProps) {
  if (!request) {
    return (
      <div className={`p-4 ${className}`}>
        <p className="text-muted-foreground text-sm text-center">
          No request selected. Click on a request in the timeline to view its trace.
        </p>
      </div>
    );
  }

  // Build trace steps from request path
  const steps: TraceStep[] = request.path.map((nodeId, index) => {
    const node = placedNodes.find((n) => n.id === nodeId);
    const nodeInfo = getNodeInfo(node?.type || 'unknown');
    const queries = request.queries.filter((q) => q.sourceNodeId === nodeId);

    // Count how many times this node appears in the path
    const callCount = request.path.filter((id) => id === nodeId).length;

    return {
      nodeId,
      nodeType: node?.type || 'unknown',
      nodeName: nodeInfo.name,
      duration: queries.reduce((sum, q) => sum + q.duration, 0),
      queries,
      callCount: index === request.path.indexOf(nodeId) ? callCount : 0,
      index,
    };
  });

  // Calculate totals
  const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0);
  const totalQueries = request.queries.length;
  const nPlusOneCount = request.queries.filter((q) => q.isNPlusOne).length;
  const cachedQueries = request.queries.filter((q) => q.cached).length;

  const handleHover = (nodeId: string | null) => {
    onHighlightNode?.(nodeId);

    // Also highlight connections to this node
    if (nodeId) {
      const conn = connections.find(
        (c) => c.sourceNodeId === nodeId || c.targetNodeId === nodeId
      );
      onHighlightConnection?.(conn?.id || null);
    } else {
      onHighlightConnection?.(null);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with summary */}
      <div className="p-3 border-b border-border bg-card/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Request Trace</span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              request.status === 'completed'
                ? 'bg-success/20 text-success'
                : request.status === 'failed'
                  ? 'bg-destructive/20 text-destructive'
                  : 'bg-primary/20 text-primary'
            }`}
          >
            {request.status}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Duration</div>
            <div className="text-foreground font-medium">
              {formatDuration(request.latency || totalDuration)}
            </div>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Queries</div>
            <div className="text-foreground font-medium">{totalQueries}</div>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Cached</div>
            <div className="text-success font-medium">{cachedQueries}</div>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">N+1</div>
            <div className={nPlusOneCount > 0 ? 'text-destructive font-bold' : 'text-foreground'}>
              {nPlusOneCount}
            </div>
          </div>
        </div>
      </div>

      {/* Trace steps */}
      <div className="flex-1 overflow-y-auto p-3">
        {steps.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center">No trace data available</p>
        ) : (
          steps.map((step, index) => (
            <TraceStepItem
              key={`${step.nodeId}-${index}`}
              step={step}
              isLast={index === steps.length - 1}
              onHover={handleHover}
            />
          ))
        )}
      </div>

      {/* Error message if failed */}
      {request.status === 'failed' && request.error && (
        <div className="p-3 border-t border-border bg-destructive/20">
          <div className="text-xs text-destructive font-medium mb-1">Error</div>
          <div className="text-xs text-destructive/80">{request.error}</div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Trace Mode Overlay (for highlighting paths on canvas)
// ============================================

interface TraceOverlayProps {
  request: SimulatedRequest | null;
  placedNodes: PlacedNode[];
  connections: Connection[];
  highlightedNodeId: string | null;
}

export function TraceOverlay({
  request,
  placedNodes,
  connections,
  highlightedNodeId,
}: TraceOverlayProps) {
  if (!request) return null;

  // Get nodes and connections in the trace path
  const pathNodeIds = new Set(request.path);
  const pathConnectionIds = new Set<string>();

  // Find connections in path
  for (let i = 0; i < request.path.length - 1; i++) {
    const sourceId = request.path[i];
    const targetId = request.path[i + 1];
    const conn = connections.find(
      (c) => c.sourceNodeId === sourceId && c.targetNodeId === targetId
    );
    if (conn) {
      pathConnectionIds.add(conn.id);
    }
  }

  return (
    <svg className="absolute inset-0 pointer-events-none">
      {/* Highlight connections in path */}
      {connections.map((conn) => {
        const source = placedNodes.find((n) => n.id === conn.sourceNodeId);
        const target = placedNodes.find((n) => n.id === conn.targetNodeId);
        if (!source || !target) return null;

        const isInPath = pathConnectionIds.has(conn.id);
        const isHighlighted =
          highlightedNodeId === conn.sourceNodeId ||
          highlightedNodeId === conn.targetNodeId;

        if (!isInPath && !isHighlighted) return null;

        return (
          <line
            key={conn.id}
            x1={source.x + 60}
            y1={source.y + 30}
            x2={target.x}
            y2={target.y + 30}
            stroke={isHighlighted ? '#fbbf24' : '#3b82f6'}
            strokeWidth={isHighlighted ? 4 : 3}
            strokeDasharray={isInPath ? '8,4' : 'none'}
            className="animate-pulse"
          />
        );
      })}

      {/* Highlight nodes in path */}
      {placedNodes.map((node) => {
        const isInPath = pathNodeIds.has(node.id);
        const isHighlighted = highlightedNodeId === node.id;

        if (!isInPath && !isHighlighted) return null;

        return (
          <rect
            key={node.id}
            x={node.x - 4}
            y={node.y - 4}
            width={128}
            height={68}
            rx={8}
            fill="none"
            stroke={isHighlighted ? '#fbbf24' : '#3b82f6'}
            strokeWidth={isHighlighted ? 3 : 2}
            className={isHighlighted ? 'animate-pulse' : ''}
          />
        );
      })}
    </svg>
  );
}
