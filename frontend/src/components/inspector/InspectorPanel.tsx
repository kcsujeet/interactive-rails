// Main inspector panel component that combines all inspection tools

import { useState } from 'react';
import type { SimulationStoreState, Enemy, Defense } from '../../stores/simulation';
import { MetricsDisplay } from './MetricsDisplay';
import { QueryTraceViewer, type QueryTrace } from './QueryTraceViewer';
import { RequestTimeline, type SimulatedRequest } from './RequestTimeline';

// Simplified simulation state for inspector
interface SimulationState {
  metrics: SimulationStoreState['metrics'];
  stabilityScore: number;
  stabilityTrend: 'improving' | 'stable' | 'degrading';
  objectiveProgress: number;
  objectiveMet: boolean;
  enemies: Enemy[];
  defenses: Defense[];
  activeRequests: SimulatedRequest[];
  completedRequests: SimulatedRequest[];
}

interface InspectorPanelProps {
  simulationState: SimulationState | null;
  isOpen: boolean;
  onToggle: () => void;
  playerLevel?: number;
  className?: string;
}

type InspectorTab = 'metrics' | 'queries' | 'requests' | 'stability';

export function InspectorPanel({
  simulationState,
  isOpen,
  onToggle,
  playerLevel = 1,
  className = '',
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('metrics');

  // Advanced features unlock at higher levels
  const canSeeQueries = playerLevel >= 5;
  const canSeeRequests = playerLevel >= 10;
  const canIntervene = playerLevel >= 20;

  // Aggregate queries from all requests
  const allQueries = simulationState
    ? [...simulationState.activeRequests, ...simulationState.completedRequests].flatMap(
        (r) => r.queries
      )
    : [];

  // All requests
  const allRequests = simulationState
    ? [...simulationState.activeRequests, ...simulationState.completedRequests]
    : [];

  const tabs: { id: InspectorTab; label: string; unlockLevel: number }[] = [
    { id: 'metrics', label: 'Metrics', unlockLevel: 1 },
    { id: 'queries', label: 'Queries', unlockLevel: 5 },
    { id: 'requests', label: 'Requests', unlockLevel: 10 },
    { id: 'stability', label: 'Stability', unlockLevel: 1 },
  ];

  if (!isOpen) {
    // Collapsed state - show mini stats
    return (
      <div
        className={`bg-gray-800 border-l border-gray-700 w-12 flex flex-col items-center py-4 ${className}`}
      >
        <button
          onClick={onToggle}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Open Inspector"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </button>

        {/* Mini stability indicator */}
        {simulationState && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                simulationState.stabilityScore >= 80
                  ? 'bg-green-600'
                  : simulationState.stabilityScore >= 50
                    ? 'bg-amber-600'
                    : 'bg-red-600'
              }`}
            >
              {simulationState.stabilityScore}
            </div>
            <span className="text-xs text-gray-400 -rotate-90 whitespace-nowrap mt-4">
              Stability
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-800 border-l border-gray-700 w-80 flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Inspector
        </h2>
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-white transition-colors"
          title="Close Inspector"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => {
          const isUnlocked = playerLevel >= tab.unlockLevel;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => isUnlocked && setActiveTab(tab.id)}
              disabled={!isUnlocked}
              className={`
                flex-1 px-3 py-2 text-xs font-medium transition-colors
                ${isActive ? 'bg-gray-700 text-white border-b-2 border-blue-500' : ''}
                ${!isActive && isUnlocked ? 'text-gray-400 hover:text-white hover:bg-gray-750' : ''}
                ${!isUnlocked ? 'text-gray-600 cursor-not-allowed' : ''}
              `}
              title={!isUnlocked ? `Unlock at level ${tab.unlockLevel}` : undefined}
            >
              {tab.label}
              {!isUnlocked && (
                <span className="ml-1 text-xs text-gray-500">Lv{tab.unlockLevel}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'metrics' && (
          <MetricsDisplay metrics={simulationState?.metrics || null} />
        )}

        {activeTab === 'queries' && canSeeQueries && (
          <QueryTraceViewer queries={allQueries} />
        )}

        {activeTab === 'requests' && canSeeRequests && (
          <RequestTimeline requests={allRequests} />
        )}

        {activeTab === 'stability' && simulationState && (
          <StabilityPanel
            stabilityScore={simulationState.stabilityScore}
            stabilityTrend={simulationState.stabilityTrend}
            objectiveProgress={simulationState.objectiveProgress}
            objectiveMet={simulationState.objectiveMet}
            enemies={simulationState.enemies}
            defenses={simulationState.defenses}
          />
        )}

        {/* Locked tab message */}
        {((activeTab === 'queries' && !canSeeQueries) ||
          (activeTab === 'requests' && !canSeeRequests)) && (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">
              <svg
                className="w-12 h-12 mx-auto text-gray-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">
              {activeTab === 'queries'
                ? 'Query tracing unlocks at level 5'
                : 'Request timeline unlocks at level 10'}
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Complete more levels to unlock!
            </p>
          </div>
        )}
      </div>

      {/* Intervention controls (level 20+) */}
      {canIntervene && simulationState && (
        <div className="p-3 border-t border-gray-700 bg-gray-750">
          <h4 className="text-xs font-semibold text-amber-400 mb-2">
            Debug Controls (Level 20+)
          </h4>
          <div className="flex gap-2">
            <button className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600">
              Pause Requests
            </button>
            <button className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600">
              Clear Cache
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Stability sub-panel
function StabilityPanel({
  stabilityScore,
  stabilityTrend,
  objectiveProgress,
  objectiveMet,
  enemies,
  defenses,
}: {
  stabilityScore: number;
  stabilityTrend: 'improving' | 'stable' | 'degrading';
  objectiveProgress: number;
  objectiveMet: boolean;
  enemies: SimulationState['enemies'];
  defenses: SimulationState['defenses'];
}) {
  const trendColors = {
    improving: 'text-green-400',
    stable: 'text-gray-400',
    degrading: 'text-red-400',
  };

  const trendIcons = {
    improving: '^',
    stable: '~',
    degrading: 'v',
  };

  const activeEnemies = enemies.filter((e) => e.isActive);

  return (
    <div className="p-4 space-y-4">
      {/* Main stability gauge */}
      <div className="text-center">
        <div
          className={`text-6xl font-bold ${
            stabilityScore >= 80
              ? 'text-green-400'
              : stabilityScore >= 50
                ? 'text-amber-400'
                : 'text-red-400'
          }`}
        >
          {stabilityScore}
        </div>
        <div className="text-gray-400 text-sm">Stability Score</div>
        <div className={`text-sm ${trendColors[stabilityTrend]}`}>
          {trendIcons[stabilityTrend]} {stabilityTrend}
        </div>
      </div>

      {/* Stability bar */}
      <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            stabilityScore >= 80
              ? 'bg-green-500'
              : stabilityScore >= 50
                ? 'bg-amber-500'
                : 'bg-red-500'
          }`}
          style={{ width: `${stabilityScore}%` }}
        />
      </div>

      {/* Objective progress */}
      <div className="bg-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">Objective Progress</span>
          {objectiveMet && (
            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
              COMPLETE
            </span>
          )}
        </div>
        <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              objectiveMet ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${objectiveProgress}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-1 text-right">
          {objectiveProgress.toFixed(0)}%
        </div>
      </div>

      {/* Enemies */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-2 flex items-center justify-between">
          <span>Active Threats</span>
          <span className="text-red-400">{activeEnemies.length}</span>
        </h4>
        {activeEnemies.length === 0 ? (
          <p className="text-xs text-gray-400">No active enemies</p>
        ) : (
          <div className="space-y-1">
            {activeEnemies.slice(0, 5).map((enemy) => (
              <div key={enemy.id} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-gray-300">{enemy.type.replace('_', ' ')}</span>
                <span className="text-gray-500 ml-auto">HP: {enemy.hp}/{enemy.maxHp}</span>
              </div>
            ))}
            {activeEnemies.length > 5 && (
              <p className="text-xs text-gray-500">
                +{activeEnemies.length - 5} more...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Defenses */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-2 flex items-center justify-between">
          <span>Active Defenses</span>
          <span className="text-green-400">{defenses.length}</span>
        </h4>
        {defenses.length === 0 ? (
          <p className="text-xs text-gray-400">No defenses deployed</p>
        ) : (
          <div className="space-y-1">
            {defenses.map((defense) => (
              <div key={defense.id} className="flex items-center gap-2 text-xs">
                <div
                  className={`w-2 h-2 rounded-full ${defense.isActive ? 'bg-green-500' : 'bg-gray-500'}`}
                />
                <span className="text-gray-300">{defense.type.replace('_', ' ')}</span>
                <span className="text-gray-500 ml-auto">
                  {defense.isActive ? 'Active' : 'Cooldown'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
