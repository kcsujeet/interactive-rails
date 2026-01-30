// Room component showing the current room state, objectives, and entities

import type { Room, BossRoom, RoomObjective } from '../../types/dungeon';
import type { Enemy } from '../../stores/simulation';
import { EnemySprite } from './EnemySprite';

// Simplified simulation state for room display
interface RoomSimulationState {
  stabilityScore: number;
  objectiveProgress: number;
  objectiveMet: boolean;
  enemies: Enemy[];
}

interface RoomComponentProps {
  room: Room | BossRoom;
  simulationState: RoomSimulationState | null;
  roomIndex: number;
  totalRooms: number;
  className?: string;
}

// Objective display component
function ObjectiveDisplay({
  objective,
  progress,
  isMet,
}: {
  objective: RoomObjective;
  progress: number;
  isMet: boolean;
}) {
  const objectiveIcons: Record<string, string> = {
    stabilize: 'S',
    optimize: 'O',
    fix: 'F',
    build: 'B',
    survive: 'W',
  };

  return (
    <div
      className={`
        p-3 rounded-lg border-2 transition-all
        ${isMet ? 'bg-green-900/30 border-green-500' : 'bg-gray-800 border-gray-600'}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`
            w-8 h-8 rounded-full flex items-center justify-center font-bold
            ${isMet ? 'bg-green-600' : 'bg-gray-700'}
          `}
        >
          {objectiveIcons[objective.type] || '?'}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">
            {objective.type.charAt(0).toUpperCase() + objective.type.slice(1)}
          </h4>
          <p className="text-xs text-gray-400">{objective.description}</p>
        </div>
        {isMet && (
          <div className="ml-auto">
            <span className="text-green-400 text-xl">V</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isMet ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      {/* Target metrics */}
      {objective.targetMetrics && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {objective.targetMetrics.maxLatencyP95 && (
            <span className="px-2 py-0.5 bg-gray-700 rounded text-gray-300">
              p95 &lt; {objective.targetMetrics.maxLatencyP95}ms
            </span>
          )}
          {objective.targetMetrics.maxQueriesPerRequest && (
            <span className="px-2 py-0.5 bg-gray-700 rounded text-gray-300">
              Q/R &lt; {objective.targetMetrics.maxQueriesPerRequest}
            </span>
          )}
          {objective.targetMetrics.minCacheHitRate && (
            <span className="px-2 py-0.5 bg-gray-700 rounded text-gray-300">
              Cache &gt; {objective.targetMetrics.minCacheHitRate}%
            </span>
          )}
          {objective.targetMetrics.minStability && (
            <span className="px-2 py-0.5 bg-gray-700 rounded text-gray-300">
              Stability &gt; {objective.targetMetrics.minStability}
            </span>
          )}
        </div>
      )}

      {/* Hints */}
      {objective.hints && objective.hints.length > 0 && !isMet && (
        <div className="mt-2 p-2 bg-gray-900/50 rounded text-xs text-gray-400">
          Hint: {objective.hints[0]}
        </div>
      )}
    </div>
  );
}

// Boss indicator for boss rooms
function BossIndicator({ room }: { room: BossRoom }) {
  return (
    <div className="bg-red-900/30 border border-red-600 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-2xl">
          B
        </div>
        <div>
          <h4 className="font-bold text-red-400">{room.bossName}</h4>
          <p className="text-xs text-gray-400">{room.bossDescription}</p>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        {room.phases.map((phase, index) => (
          <div
            key={index}
            className="flex-1 text-center p-1 bg-gray-800 rounded text-xs"
          >
            <span className="text-gray-400">Phase {index + 1}</span>
            <br />
            <span className="text-red-300">{phase.hpThreshold}% HP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoomComponent({
  room,
  simulationState,
  roomIndex,
  totalRooms,
  className = '',
}: RoomComponentProps) {
  const isBossRoom = 'bossType' in room;
  const progress = simulationState?.objectiveProgress || 0;
  const isMet = simulationState?.objectiveMet || false;
  const enemies = simulationState?.enemies.filter((e) => e.isActive) || [];
  const stability = simulationState?.stabilityScore || 100;

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Room header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400 mb-1">
              Room {roomIndex + 1} of {totalRooms}
            </div>
            <h3 className="text-lg font-bold text-white">{room.name}</h3>
          </div>
          <div className="text-right">
            <div
              className={`text-2xl font-bold ${
                stability >= 80
                  ? 'text-green-400'
                  : stability >= 50
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {stability}
            </div>
            <div className="text-xs text-gray-400">Stability</div>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-2">{room.description}</p>
      </div>

      {/* Boss indicator for boss rooms */}
      {isBossRoom && <BossIndicator room={room as BossRoom} />}

      {/* Objective */}
      <div className="p-4">
        <ObjectiveDisplay
          objective={room.objective}
          progress={progress}
          isMet={isMet}
        />
      </div>

      {/* Enemy display area */}
      {enemies.length > 0 && (
        <div className="p-4 pt-0">
          <h4 className="text-sm font-semibold text-red-400 mb-2">
            Active Threats ({enemies.length})
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {enemies.slice(0, 8).map((enemy) => (
              <div key={enemy.id} className="flex flex-col items-center">
                <EnemySprite enemy={enemy} scale={0.8} showHealthBar />
              </div>
            ))}
          </div>
          {enemies.length > 8 && (
            <p className="text-xs text-gray-500 mt-1">
              +{enemies.length - 8} more enemies
            </p>
          )}
        </div>
      )}

      {/* Room briefing */}
      {room.briefing && (
        <div className="p-4 pt-0">
          <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
            <h4 className="text-xs font-semibold text-blue-400 mb-1">Briefing</h4>
            <p className="text-sm text-gray-300">{room.briefing}</p>
          </div>
        </div>
      )}

      {/* Available tools */}
      <div className="p-4 pt-0 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Available nodes:</span>
            <div className="flex gap-1">
              {room.availableNodeTypes.slice(0, 5).map((type) => (
                <span
                  key={type}
                  className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
                >
                  {type}
                </span>
              ))}
              {room.availableNodeTypes.length > 5 && (
                <span className="text-xs text-gray-500">
                  +{room.availableNodeTypes.length - 5}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Defenses:</span>
            <div className="flex gap-1">
              {room.availableDefenses.slice(0, 3).map((type) => (
                <span
                  key={type}
                  className="px-1.5 py-0.5 bg-green-900/30 rounded text-xs text-green-300"
                >
                  {type.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Success/Failure messages */}
      {isMet && room.successMessage && (
        <div className="p-4 bg-green-900/30 border-t border-green-700">
          <p className="text-sm text-green-300">{room.successMessage}</p>
        </div>
      )}
    </div>
  );
}
