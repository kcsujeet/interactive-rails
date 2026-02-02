/**
 * Game Top Bar Component
 * Header with level info and controls
 */

import type { LevelData, GameState } from './types';

interface GameTopBarProps {
  level: LevelData | null;
  gameState: GameState;
  currentRoom: number;
  stability: number;
  placedNodesCount: number;
  connectionsCount: number;
  onPause: () => void;
  onResume: () => void;
  onExit: () => void;
}

/** @deprecated Use level prop instead */
interface LegacyGameTopBarProps {
  dungeon: LevelData | null;
  gameState: GameState;
  currentRoom: number;
  stability: number;
  placedNodesCount: number;
  connectionsCount: number;
  onPause: () => void;
  onResume: () => void;
  onExit: () => void;
}

export function GameTopBar(props: GameTopBarProps | LegacyGameTopBarProps) {
  // Support both 'level' and legacy 'dungeon' prop names
  const level = 'level' in props ? props.level : props.dungeon;
  const {
    gameState,
    currentRoom,
    stability,
    placedNodesCount,
    connectionsCount,
    onPause,
    onResume,
    onExit,
  } = props;

  return (
    <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <h2 className="font-semibold text-white">{level?.name}</h2>
        <span className="text-sm text-gray-400">
          Room {currentRoom + 1}/{level?.rooms?.length || 1}
        </span>
        <span className="text-sm text-gray-500">
          {placedNodesCount} nodes, {connectionsCount} connections
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Stability indicator */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Stability:</span>
          <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                stability >= 80
                  ? 'bg-green-500'
                  : stability >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${stability}%` }}
            />
          </div>
          <span
            className={`text-sm font-bold ${
              stability >= 80
                ? 'text-green-400'
                : stability >= 50
                  ? 'text-amber-400'
                  : 'text-red-400'
            }`}
          >
            {stability}
          </span>
        </div>

        {/* Controls */}
        {gameState === 'playing' ? (
          <button
            type="button"
            onClick={onPause}
            className="px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={onResume}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            Resume
          </button>
        )}
        <button
          type="button"
          onClick={onExit}
          className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
