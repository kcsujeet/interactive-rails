/**
 * BaseNode Component
 *
 * Base component for all pipeline nodes with common styling and handles.
 * Provides a consistent look and feel across all node types.
 */

import { memo, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { PipelineNodeData } from '../../../stores';
import clsx from 'clsx';

interface BaseNodeProps {
  data: PipelineNodeData;
  selected?: boolean;
  color: string;
  icon: ReactNode;
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;
}

function BaseNode({
  data,
  selected,
  color,
  icon,
  showSourceHandle = true,
  showTargetHandle = true,
}: BaseNodeProps) {
  const { label, status, metrics } = data;

  const statusColor = {
    idle: 'bg-gray-500',
    processing: 'bg-blue-500 animate-pulse',
    error: 'bg-red-500',
    success: 'bg-green-500',
  }[status];

  return (
    <div
      className={clsx(
        'relative min-w-[140px] rounded-lg border-2 bg-game-surface shadow-lg transition-all duration-200',
        selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-game-bg' : '',
        status === 'error' ? 'border-red-500' : 'border-game-border'
      )}
      style={{ borderColor: selected ? color : undefined }}
    >
      {/* Status indicator */}
      <div
        className={clsx(
          'absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border-2 border-game-surface',
          statusColor
        )}
        title={`Status: ${status}`}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-md"
        style={{ backgroundColor: `${color}20` }}
      >
        <span className="text-lg" style={{ color }}>
          {icon}
        </span>
        <span className="text-sm font-medium text-gray-200 truncate">{label}</span>
      </div>

      {/* Metrics (if available) */}
      {metrics && (
        <div className="px-3 py-2 text-xs space-y-1 border-t border-game-border">
          {metrics.processTime > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Time:</span>
              <span
                className={clsx(
                  metrics.processTime > 100 ? 'text-red-400' : 'text-gray-300'
                )}
              >
                {metrics.processTime}ms
              </span>
            </div>
          )}
          {metrics.queryCount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Queries:</span>
              <span
                className={clsx(
                  metrics.queryCount > 10 ? 'text-amber-400' : 'text-gray-300'
                )}
              >
                {metrics.queryCount}
              </span>
            </div>
          )}
          {metrics.cacheHits > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Cache:</span>
              <span className="text-green-400">{metrics.cacheHits} hits</span>
            </div>
          )}
          {metrics.errorCount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Errors:</span>
              <span className="text-red-400">{metrics.errorCount}</span>
            </div>
          )}
        </div>
      )}

      {/* Target Handle (input) */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-game-surface !border-2 !border-game-border hover:!border-blue-500 hover:!scale-125 transition-all"
        />
      )}

      {/* Source Handle (output) */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-game-surface !border-2 !border-game-border hover:!border-blue-500 hover:!scale-125 transition-all"
        />
      )}
    </div>
  );
}

export default memo(BaseNode);
