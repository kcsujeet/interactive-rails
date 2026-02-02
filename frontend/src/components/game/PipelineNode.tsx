/**
 * Pipeline Node Component
 * Individual node with ports
 */

import type { MouseEvent } from 'react';
import { getNodeInfo } from './data';
import type { Connection, PendingConnection, PlacedNode } from './types';

interface PipelineNodeProps {
  node: PlacedNode;
  isSelected: boolean;
  isDragging: boolean;
  isPipelineBroken: boolean;
  simulationRunning: boolean;
  pendingConnection: PendingConnection | null;
  connections: Connection[];
  onMouseDown: (e: MouseEvent, nodeId: string) => void;
  onStartConnection: (e: MouseEvent, nodeId: string) => void;
  onCompleteConnection: (e: MouseEvent, nodeId: string) => void;
}

export function PipelineNode({
  node,
  isSelected,
  isDragging,
  isPipelineBroken,
  simulationRunning,
  pendingConnection,
  connections,
  onMouseDown,
  onStartConnection,
  onCompleteConnection,
}: PipelineNodeProps) {
  const nodeInfo = getNodeInfo(node.type);
  const isConnectionSource = pendingConnection?.sourceNodeId === node.id;
  const hasInputConnection = connections.some((c) => c.targetNodeId === node.id);
  const hasOutputConnection = connections.some((c) => c.sourceNodeId === node.id);

  const getNodeLabel = () => {
    if (node.config?.label) return node.config.label;

    switch (node.type) {
      case 'database':
        return isPipelineBroken ? 'DISCONNECTED' : 'PostgreSQL';
      case 'eager_load':
        return 'includes(:assoc)';
      case 'cache':
        return 'Redis Cache';
      case 'index':
        return 'add_index :table';
      case 'model':
        return 'ActiveRecord';
      case 'controller':
        return 'ActionController';
      case 'view':
        return 'ERB Template';
      case 'router':
        return 'routes.rb';
      case 'request':
        return 'HTTP GET';
      case 'response':
        return 'HTTP 200';
      default:
        return node.type;
    }
  };

  return (
    <div
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onClick={(e) => e.stopPropagation()}
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 select-none ${
        isDragging ? 'cursor-grabbing z-20' : 'cursor-grab'
      } ${isSelected && !isDragging ? 'scale-105 z-10' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        zIndex: isDragging ? 20 : isSelected ? 10 : 1,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        pointerEvents: node.locked ? 'none' : 'auto',
        opacity: node.locked ? 0.7 : 1,
        filter: node.locked ? 'grayscale(100%)' : 'none',
      }}
    >
      {/* Input port (left side) - Hide for locked nodes unless it's a specific educational case? Keeping hidden for now */}
      {!node.locked && node.type !== 'request' && (
        <div
          data-port="input"
          className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            pendingConnection && !isConnectionSource
              ? 'bg-green-500 border-green-300 scale-125 cursor-pointer'
              : hasInputConnection
                ? 'bg-gray-600 border-gray-400'
                : 'bg-gray-700 border-gray-500'
          }`}
          onMouseUp={(e) => onCompleteConnection(e, node.id)}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              pendingConnection && !isConnectionSource ? 'bg-white' : 'bg-gray-400'
            }`}
          />
        </div>
      )}

      {/* Output port (right side) */}
      {!node.locked && node.type !== 'response' && (
        <div
          data-port="output"
          className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
            isConnectionSource
              ? 'bg-blue-500 border-blue-300 scale-125'
              : hasOutputConnection
                ? 'bg-gray-600 border-gray-400 hover:bg-blue-600 hover:border-blue-400'
                : 'bg-gray-700 border-gray-500 hover:bg-blue-600 hover:border-blue-400'
          }`}
          onMouseDown={(e) => onStartConnection(e, node.id)}
        >
          <div
            className={`w-2 h-2 rounded-full ${isConnectionSource ? 'bg-white' : 'bg-gray-400'}`}
          />
        </div>
      )}

      <div
        className={`w-32 rounded-lg border-2 overflow-hidden shadow-lg ${
          isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''
        }`}
        style={{
          borderColor: isPipelineBroken && node.type === 'database' ? '#6b7280' : nodeInfo.color,
          opacity: isPipelineBroken && node.type === 'database' ? 0.6 : 1,
        }}
      >
        <div
          className="px-3 py-2 text-white text-sm font-medium text-center relative"
          style={{ backgroundColor: nodeInfo.color }}
        >
          {nodeInfo.name}
          {/* Activity indicator for database */}
          {node.type === 'database' && simulationRunning && !isPipelineBroken && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
          )}
          {node.type === 'database' && isPipelineBroken && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gray-500" />
          )}
        </div>
        <div className="bg-gray-800 px-3 py-2">
          <div
            className={`text-xs text-center ${
              isPipelineBroken && node.type === 'database' ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {getNodeLabel()}
          </div>
        </div>
      </div>
    </div>
  );
}
