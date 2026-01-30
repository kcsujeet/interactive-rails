// Request timeline showing waterfall diagram of request flow

import { Fragment, useState, useMemo } from 'react';
import type { NodeType } from '../../stores/pipeline';
import type { QueryTrace } from './QueryTraceViewer';

// Simulated request for timeline visualization
export interface SimulatedRequest {
  id: string;
  path: NodeType[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  totalLatency: number;
  queries: QueryTrace[];
  cacheHits: number;
  cacheMisses: number;
  errorMessage?: string;
}

interface RequestTimelineProps {
  requests: SimulatedRequest[];
  maxRequests?: number;
  className?: string;
}

// Node type to color mapping
const NODE_COLORS: Record<NodeType, string> = {
  request: '#3b82f6',
  router: '#a78bfa',
  controller: '#10b981',
  model: '#f59e0b',
  database: '#ef4444',
  cache: '#06b6d4',
  view: '#a855f7',
  response: '#22c55e',
  background_job: '#9333ea',
};

// Single request waterfall bar
function RequestBar({
  request,
  maxLatency,
  isSelected,
  onSelect,
}: {
  request: SimulatedRequest;
  maxLatency: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const widthPercent = maxLatency > 0 ? (request.totalLatency / maxLatency) * 100 : 0;

  // Calculate segment widths based on path
  const segmentCount = request.path.length;
  const segmentWidth = widthPercent / segmentCount;

  const statusColors = {
    pending: 'bg-gray-500',
    processing: 'bg-blue-500 animate-pulse',
    completed: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div
      className={`flex items-center gap-2 p-1 rounded cursor-pointer transition-colors ${
        isSelected ? 'bg-gray-700' : 'hover:bg-gray-750'
      }`}
      onClick={onSelect}
    >
      {/* Request ID */}
      <span className="text-xs text-gray-400 w-20 truncate font-mono">
        {request.id.slice(0, 8)}
      </span>

      {/* Status indicator */}
      <div className={`w-2 h-2 rounded-full ${statusColors[request.status]}`} />

      {/* Timeline bar */}
      <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden relative">
        {/* Segments for each node type visited */}
        <div className="absolute inset-0 flex">
          {request.path.map((nodeType, index) => (
            <div
              key={`${request.id}-${index}`}
              className="h-full"
              style={{
                width: `${segmentWidth}%`,
                backgroundColor: NODE_COLORS[nodeType as NodeType] || '#6b7280',
              }}
              title={nodeType}
            />
          ))}
        </div>
      </div>

      {/* Latency */}
      <span
        className={`text-xs font-mono w-16 text-right ${
          request.totalLatency > 500
            ? 'text-red-400'
            : request.totalLatency > 200
              ? 'text-amber-400'
              : 'text-gray-300'
        }`}
      >
        {request.totalLatency.toFixed(0)}ms
      </span>

      {/* Query count */}
      <span
        className={`text-xs font-mono w-8 text-right ${
          request.queries.length > 10 ? 'text-red-400' : 'text-gray-400'
        }`}
      >
        Q:{request.queries.length}
      </span>
    </div>
  );
}

// Request detail panel
function RequestDetail({ request }: { request: SimulatedRequest }) {
  return (
    <div className="bg-gray-700 rounded p-3 mt-2 text-sm">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-400">Status:</span>{' '}
          <span
            className={
              request.status === 'completed'
                ? 'text-green-400'
                : request.status === 'error'
                  ? 'text-red-400'
                  : 'text-blue-400'
            }
          >
            {request.status}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Total latency:</span>{' '}
          <span className="text-white">{request.totalLatency.toFixed(1)}ms</span>
        </div>
        <div>
          <span className="text-gray-400">Queries:</span>{' '}
          <span className="text-white">{request.queries.length}</span>
        </div>
        <div>
          <span className="text-gray-400">Cache hits:</span>{' '}
          <span className="text-green-400">{request.cacheHits}</span>
          <span className="text-gray-400"> / misses:</span>{' '}
          <span className="text-amber-400">{request.cacheMisses}</span>
        </div>
      </div>

      {/* Path visualization */}
      <div className="mt-3">
        <span className="text-gray-400 text-xs">Request path:</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {request.path.map((nodeType, index) => (
            <Fragment key={index}>
              <span
                className="px-2 py-0.5 rounded text-xs text-white"
                style={{ backgroundColor: NODE_COLORS[nodeType as NodeType] || '#6b7280' }}
              >
                {nodeType}
              </span>
              {index < request.path.length - 1 && (
                <span className="text-gray-500 self-center">-&gt;</span>
              )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Error message if present */}
      {request.errorMessage && (
        <div className="mt-2 p-2 bg-red-900/30 rounded">
          <span className="text-red-300 text-xs">Error: {request.errorMessage}</span>
        </div>
      )}
    </div>
  );
}

export function RequestTimeline({
  requests,
  maxRequests = 50,
  className = '',
}: RequestTimelineProps) {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'error'>('all');

  // Filter requests
  const filteredRequests = useMemo(() => {
    let result = requests;

    if (filter === 'active') {
      result = requests.filter((r) => r.status === 'pending' || r.status === 'processing');
    } else if (filter === 'completed') {
      result = requests.filter((r) => r.status === 'completed');
    } else if (filter === 'error') {
      result = requests.filter((r) => r.status === 'error');
    }

    return result.slice(-maxRequests);
  }, [requests, filter, maxRequests]);

  // Find max latency for scaling
  const maxLatency = useMemo(
    () => Math.max(...filteredRequests.map((r) => r.totalLatency), 100),
    [filteredRequests]
  );

  const selectedRequest = selectedRequestId
    ? requests.find((r) => r.id === selectedRequestId)
    : null;

  // Stats
  const activeCount = requests.filter(
    (r) => r.status === 'pending' || r.status === 'processing'
  ).length;
  const errorCount = requests.filter((r) => r.status === 'error').length;

  return (
    <div className={`bg-gray-800 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-white">Request Timeline</h3>
          <div className="flex gap-2 text-xs">
            <span className="text-blue-400">{activeCount} active</span>
            {errorCount > 0 && <span className="text-red-400">{errorCount} errors</span>}
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 text-xs rounded ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            All ({requests.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-2 py-1 text-xs rounded ${
              filter === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-2 py-1 text-xs rounded ${
              filter === 'completed' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilter('error')}
            className={`px-2 py-1 text-xs rounded ${
              filter === 'error' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            Errors ({errorCount})
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-b border-gray-700 flex flex-wrap gap-2">
        {Object.entries(NODE_COLORS).map(([nodeType, color]) => (
          <div key={nodeType} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-400">{nodeType}</span>
          </div>
        ))}
      </div>

      {/* Request list */}
      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
        {filteredRequests.length === 0 ? (
          <p className="text-gray-400 text-center py-4 text-sm">No requests to display</p>
        ) : (
          filteredRequests.map((request) => (
            <RequestBar
              key={request.id}
              request={request}
              maxLatency={maxLatency}
              isSelected={request.id === selectedRequestId}
              onSelect={() =>
                setSelectedRequestId(request.id === selectedRequestId ? null : request.id)
              }
            />
          ))
        )}
      </div>

      {/* Selected request detail */}
      {selectedRequest && (
        <div className="p-3 border-t border-gray-700">
          <RequestDetail request={selectedRequest} />
        </div>
      )}
    </div>
  );
}
