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
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-game-surface text-slate-400 p-2 rounded-l-md border border-r-0 border-game-border hover:text-white z-10"
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
    <div className="w-80 bg-game-surface border-l border-game-border overflow-y-auto shrink-0">
      <div className="p-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Diagnostics</div>
            <h2 className="text-sm font-semibold text-white -mt-0.5">Inspector</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
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
          <div className="mb-5 p-4 bg-game-bg border border-game-border rounded-lg">
            <h3 className="text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">Selected Node</h3>
            <p className="text-sm text-white font-medium mb-3">
              {getNodeInfo(placedNodes.find((n) => n.id === selectedNodeId)?.type || '').name}
            </p>

            {/* Label Editor */}
            <div className="mb-3">
              <label htmlFor="node-label-input" className="block text-xs text-slate-500 mb-1.5">
                Label
              </label>
              <input
                id="node-label-input"
                type="text"
                className="w-full bg-slate-950 text-white text-sm border border-game-border rounded-md px-3 py-2 focus:border-sky-500 focus:outline-none transition-colors"
                placeholder="Custom label..."
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
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
            >
              Delete this node
            </button>
          </div>
        )}

        <div className="space-y-5">
          <div>
            <h3 className="text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">Pipeline</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-game-bg border border-game-border rounded-md p-3">
                <div className="text-2xl font-semibold text-white tabular-nums">{placedNodes.length}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">nodes</div>
              </div>
              <div className="bg-game-bg border border-game-border rounded-md p-3">
                <div className="text-2xl font-semibold text-white tabular-nums">{connectionsCount}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">connections</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">Queries</h3>
            <div className="bg-game-bg border border-game-border rounded-md p-3">
              <div className="text-2xl font-semibold text-white tabular-nums">
                {placedNodes.filter((n) => n.type === 'database').length}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">database nodes</div>
            </div>
          </div>

          {/* Connection tips */}
          {placedNodes.length > 0 && connectionsCount === 0 && !showValidation && (
            <div className="bg-amber-950/40 border border-amber-900 rounded-lg p-4">
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
              className="w-full px-4 py-3 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors"
            >
              Check Pipeline
            </button>
          )}

          {/* Validation results */}
          {showValidation && lastValidation && (
            <div>
              <h3 className="text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">Pipeline Status</h3>
              <div
                className={`rounded-lg p-4 border ${
                  lastValidation.valid
                    ? 'bg-emerald-950/40 border-emerald-900'
                    : 'bg-rose-950/40 border-rose-900'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-lg ${lastValidation.valid ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {lastValidation.valid ? '✓' : '✗'}
                  </span>
                  <span
                    className={`text-sm font-medium ${lastValidation.valid ? 'text-emerald-300' : 'text-rose-300'}`}
                  >
                    {lastValidation.valid ? 'Valid Pipeline!' : 'Invalid Pipeline'}
                  </span>
                  <span className="ml-auto text-xs text-slate-500 tabular-nums">
                    Score: {lastValidation.score}
                  </span>
                </div>
                {lastValidation.errors.length > 0 && (
                  <ul className="text-xs text-rose-300/80 space-y-1.5 mb-3">
                    {lastValidation.errors.slice(0, 4).map((err) => (
                      <li key={err}>• {err}</li>
                    ))}
                    {lastValidation.errors.length > 4 && (
                      <li className="text-slate-500">
                        ...and {lastValidation.errors.length - 4} more
                      </li>
                    )}
                  </ul>
                )}
                {!lastValidation.valid && (
                  <button
                    type="button"
                    onClick={onResetValidation}
                    className="w-full px-3 py-2 bg-game-bg text-slate-300 text-sm font-medium rounded-md border border-game-border hover:bg-game-border/50 transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">Pipeline Stats</h3>
            <div className="bg-game-bg border border-game-border rounded-md p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Nodes</span>
                <span className="text-white font-medium tabular-nums">{placedNodes.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Connections</span>
                <span className="text-white font-medium tabular-nums">{connectionsCount}</span>
              </div>
              {addedNodes > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Nodes Added</span>
                  <span className="text-emerald-400 font-medium tabular-nums">+{addedNodes}</span>
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
              className="w-full px-4 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-500 transition-colors"
            >
              Complete Challenge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
