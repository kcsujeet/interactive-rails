/**
 * DataFlowEdge Component
 *
 * Custom edge component that visualizes data flow between nodes.
 * Shows animated data packets and latency indicators.
 */

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import clsx from 'clsx';

interface DataFlowEdgeData {
  animated?: boolean;
  dataFlow?: {
    requestsPerSecond: number;
    avgLatency: number;
  };
  [key: string]: unknown;
}

function DataFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as DataFlowEdgeData | undefined;
  const dataFlow = edgeData?.dataFlow;
  const isAnimated = edgeData?.animated ?? true;

  // Determine edge color based on latency
  const getEdgeColor = () => {
    if (!dataFlow) return '#4a4a6a'; // Default gray
    if (dataFlow.avgLatency > 500) return '#ef4444'; // Red - high latency
    if (dataFlow.avgLatency > 200) return '#f59e0b'; // Amber - medium latency
    return '#10b981'; // Green - good latency
  };

  const edgeColor = getEdgeColor();

  return (
    <>
      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#3b82f6' : edgeColor,
          strokeWidth: selected ? 3 : 2,
        }}
      />

      {/* Animated flow indicator */}
      {isAnimated && (
        <circle r="4" fill={edgeColor}>
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Edge label with metrics */}
      {dataFlow && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={clsx(
              'px-2 py-1 rounded text-xs font-mono',
              'bg-game-surface border border-game-border shadow-lg',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              selected && 'opacity-100'
            )}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-400">
                {dataFlow.requestsPerSecond} req/s
              </span>
              <span
                className={clsx(
                  dataFlow.avgLatency > 500
                    ? 'text-red-400'
                    : dataFlow.avgLatency > 200
                      ? 'text-amber-400'
                      : 'text-green-400'
                )}
              >
                {dataFlow.avgLatency}ms
              </span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(DataFlowEdge);

// Export edge types map for React Flow
export const edgeTypes = {
  dataFlow: DataFlowEdge,
};
