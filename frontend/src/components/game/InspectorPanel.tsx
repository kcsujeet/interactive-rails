/**
 * Inspector Panel Component
 * Right sidebar with validation and stats
 */

import { getNodeInfo } from './data';
import type { LevelChallenge, PlacedNode, ValidationResult } from './types';

interface InspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  selectedNodeId: string | null;
  placedNodes: PlacedNode[];
  connectionsCount: number;
  showValidation: boolean;
  lastValidation: ValidationResult | null;
  challenge: LevelChallenge | undefined;
  /** Initial nodes count - overrides challenge.initialNodes.length if provided */
  initialNodesCount?: number;
  onDeleteSelected: () => void;
  onUpdateNode?: (nodeId: string, updates: Partial<PlacedNode>) => void;
  onCheckPipeline: () => void;
  onResetValidation: () => void;
  onComplete: (stars: number) => void;
}

export function InspectorPanel({
  isOpen,
  onClose,
  onOpen,
  selectedNodeId,
  placedNodes,
  connectionsCount,
  showValidation,
  lastValidation,
  challenge,
  initialNodesCount,
  onDeleteSelected,
  onUpdateNode,
  onCheckPipeline,
  onResetValidation,
  onComplete,
}: InspectorPanelProps) {
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-gray-800 text-gray-400 p-2 rounded-l-lg border border-r-0 border-gray-700 hover:text-white z-10"
        aria-label="Open inspector"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    );
  }

  const addedNodes =
    placedNodes.length - (initialNodesCount ?? challenge?.initialNodes.length ?? 0);

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto shrink-0">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Inspector</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close inspector"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Selected node info */}
        {selectedNodeId && (
          <div className="mb-4 p-3 bg-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-white mb-2">Selected Node</h3>
            <p className="text-sm text-gray-300 mb-2">
              {getNodeInfo(placedNodes.find((n) => n.id === selectedNodeId)?.type || '').name}
            </p>

            {/* Label Editor */}
            <div className="mb-2">
              <label htmlFor="node-label-input" className="block text-xs text-gray-400 mb-1">
                Label
              </label>
              <input
                id="node-label-input"
                type="text"
                className="w-full bg-gray-800 text-white text-xs border border-gray-600 rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                placeholder="Custom Label"
                value={placedNodes.find((n) => n.id === selectedNodeId)?.config?.label || ''}
                onChange={(e) =>
                  onUpdateNode?.(selectedNodeId, {
                    config: {
                      ...placedNodes.find((n) => n.id === selectedNodeId)?.config,
                      label: e.target.value,
                    },
                  })
                }
              />
            </div>

            <button
              type="button"
              onClick={onDeleteSelected}
              className="mt-2 text-xs text-red-400 hover:text-red-300"
            >
              Delete this node
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Pipeline</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-700 rounded p-3">
                <div className="text-2xl font-bold text-white">{placedNodes.length}</div>
                <div className="text-xs text-gray-400">nodes</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-2xl font-bold text-white">{connectionsCount}</div>
                <div className="text-xs text-gray-400">connections</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Queries</h3>
            <div className="bg-gray-700 rounded p-3">
              <div className="text-2xl font-bold text-white">
                {placedNodes.filter((n) => n.type === 'database').length}
              </div>
              <div className="text-xs text-gray-400">database nodes</div>
            </div>
          </div>

          {/* Connection tips */}
          {placedNodes.length > 0 && connectionsCount === 0 && !showValidation && (
            <div className="bg-amber-900/30 border border-amber-700 rounded p-3">
              <div className="text-sm text-amber-300 font-medium mb-1">Tip: Connect your nodes</div>
              <div className="text-xs text-amber-200/70">
                Drag from a node&apos;s right port to another node&apos;s left port to create a
                connection.
              </div>
            </div>
          )}

          {/* Check Pipeline button */}
          {placedNodes.length >= 2 && connectionsCount >= 1 && !showValidation && (
            <button
              type="button"
              onClick={onCheckPipeline}
              className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Check Pipeline
            </button>
          )}

          {/* Validation results */}
          {showValidation && lastValidation && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Pipeline Status</h3>
              <div
                className={`rounded p-3 border ${
                  lastValidation.valid
                    ? 'bg-green-900/30 border-green-700'
                    : 'bg-red-900/20 border-red-800/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-lg ${lastValidation.valid ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {lastValidation.valid ? '✓' : '✗'}
                  </span>
                  <span
                    className={`text-sm font-medium ${lastValidation.valid ? 'text-green-300' : 'text-red-300'}`}
                  >
                    {lastValidation.valid ? 'Valid Pipeline!' : 'Invalid Pipeline'}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    Score: {lastValidation.score}
                  </span>
                </div>
                {lastValidation.errors.length > 0 && (
                  <ul className="text-xs text-red-300/80 space-y-1 mb-3">
                    {lastValidation.errors.slice(0, 4).map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                    {lastValidation.errors.length > 4 && (
                      <li className="text-gray-500">
                        ...and {lastValidation.errors.length - 4} more
                      </li>
                    )}
                  </ul>
                )}
                {!lastValidation.valid && (
                  <button
                    type="button"
                    onClick={onResetValidation}
                    className="w-full px-3 py-2 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Pipeline Stats</h3>
            <div className="bg-gray-700/50 rounded p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Nodes</span>
                <span className="text-white font-medium">{placedNodes.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Connections</span>
                <span className="text-white font-medium">{connectionsCount}</span>
              </div>
              {addedNodes > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Nodes Added</span>
                  <span className="text-green-400 font-medium">+{addedNodes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Complete button */}
          {showValidation && lastValidation?.valid && (
            <button
              type="button"
              onClick={() => {
                const stars = lastValidation.score >= 80 ? 3 : lastValidation.score >= 50 ? 2 : 1;
                onComplete(stars);
              }}
              className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
            >
              Complete Challenge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
