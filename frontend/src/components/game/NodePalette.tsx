/**
 * Node Palette Component
 * Left sidebar with draggable nodes and metrics
 */

import type { DragEvent } from 'react';
import type { LevelChallenge, LiveMetrics } from './types';
import { nodeTypes } from './data';

interface NodePaletteProps {
  challenge: LevelChallenge | undefined;
  /** Available node types - overrides challenge.availableNodes if provided */
  availableNodes?: string[];
  /** Goal text - overrides challenge.goal if provided */
  goal?: string;
  /** Whether to show metrics panel - defaults to true if challenge has initialMetrics */
  showMetrics?: boolean;
  liveMetrics: LiveMetrics;
  isPipelineBroken: boolean;
  breakReason: string | null;
  selectedNodeId: string | null;
  placedNodesCount: number;
  connectionsCount: number;
  draggedNodeType: string | null;
  onDragStart: (e: DragEvent<HTMLDivElement>, nodeType: string) => void;
  onDragEnd: () => void;
  onDeleteSelected: () => void;
  onClearConnections: () => void;
  onClearAll: () => void;
}

export function NodePalette({
  challenge,
  availableNodes,
  goal,
  showMetrics,
  liveMetrics,
  isPipelineBroken,
  breakReason,
  selectedNodeId,
  placedNodesCount,
  connectionsCount,
  draggedNodeType,
  onDragStart,
  onDragEnd,
  onDeleteSelected,
  onClearConnections,
  onClearAll,
}: NodePaletteProps) {
  const availableNodeTypes = availableNodes || challenge?.availableNodes || [];
  const goalText = goal || challenge?.goal;
  const shouldShowMetrics = showMetrics ?? !!challenge?.initialMetrics;

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto shrink-0">
      <div className="p-4">
        {/* Live metrics display */}
        {shouldShowMetrics && (
          <div className={`mb-4 rounded-lg p-3 border transition-all duration-500 ${
            isPipelineBroken
              ? 'bg-gray-900/50 border-gray-700'
              : 'bg-gray-900/50 border-gray-600'
          }`}>
            <div className={`text-xs font-semibold mb-2 ${
              isPipelineBroken ? 'text-gray-400' : 'text-blue-400'
            }`}>
              {isPipelineBroken
                ? `Pipeline Broken - ${breakReason}`
                : 'Live Metrics'}
            </div>

            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Queries</span>
                <span className="text-white">
                  {liveMetrics.queryCount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-lg font-bold text-white">
                  {Math.round(liveMetrics.latency)}ms
                </div>
                <div className="text-[10px] text-gray-500">latency</div>
              </div>
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-lg font-bold text-white">
                  {Math.round(liveMetrics.dbLoad)}%
                </div>
                <div className="text-[10px] text-gray-500">DB load</div>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>CPU</span>
                  <span>{Math.round(liveMetrics.cpuLoad)}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300 bg-blue-500"
                    style={{ width: `${liveMetrics.cpuLoad}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Database</span>
                  <span>{Math.round(liveMetrics.dbLoad)}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300 bg-blue-500"
                    style={{ width: `${liveMetrics.dbLoad}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Goal reminder */}
        {goalText && (
          <div className="mb-4 bg-green-900/20 border border-green-800/50 rounded-lg p-3">
            <div className="text-xs font-semibold text-green-400 mb-1">Goal</div>
            <div className="text-xs text-green-200/70">{goalText}</div>
          </div>
        )}

        <h2 className="text-lg font-bold text-white mb-2">Add Nodes</h2>

        {availableNodeTypes.length === 0 ? (
          <p className="text-xs text-gray-500 italic">
            No nodes to add for this challenge. Focus on the existing pipeline.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">Drag to fix the pipeline</p>
            <div className="space-y-2">
              {nodeTypes
                .filter(node => availableNodeTypes.includes(node.type))
                .map((node) => (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, node.type)}
                    onDragEnd={onDragEnd}
                    className={`p-3 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all ${
                      draggedNodeType === node.type
                        ? 'opacity-50 border-dashed'
                        : 'hover:scale-[1.02]'
                    }`}
                    style={{
                      backgroundColor: `${node.color}20`,
                      borderColor: node.color,
                    }}
                  >
                    <span className="text-sm text-white font-medium">{node.name}</span>
                  </div>
                ))}
            </div>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Actions</h3>
          <div className="space-y-2">
            <button
              type="button"
              onClick={onDeleteSelected}
              disabled={!selectedNodeId}
              className={`w-full px-3 py-2 text-sm rounded ${
                selectedNodeId
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Delete Selected
            </button>
            <button
              type="button"
              onClick={onClearConnections}
              disabled={connectionsCount === 0}
              className={`w-full px-3 py-2 text-sm rounded ${
                connectionsCount > 0
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Clear Connections
            </button>
            <button
              type="button"
              onClick={onClearAll}
              disabled={placedNodesCount === 0}
              className={`w-full px-3 py-2 text-sm rounded ${
                placedNodesCount > 0
                  ? 'bg-gray-600 text-white hover:bg-gray-500'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">How to Connect</h3>
          <div className="text-xs text-gray-400 space-y-1">
            <p>Drag from right port to left port</p>
            <p>Click a connection line to delete it</p>
            <p>Request has no input port</p>
            <p>Response has no output port</p>
          </div>
        </div>
      </div>
    </div>
  );
}
