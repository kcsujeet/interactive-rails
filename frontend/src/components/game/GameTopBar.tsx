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
    <div className="h-14 bg-game-surface border-b border-game-border flex items-center justify-between px-5">
      <div className="flex items-center gap-6">
        <div>
          <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Session</div>
          <h2 className="text-sm font-semibold text-white -mt-0.5">{level?.name}</h2>
        </div>
        <div className="h-8 w-px bg-game-border" />
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>Room {currentRoom + 1}/{level?.rooms?.length || 1}</span>
          <span>{placedNodesCount} nodes</span>
          <span>{connectionsCount} connections</span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* Stability indicator */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Stability</span>
          <div className="w-28 h-2 bg-game-bg rounded-full overflow-hidden border border-game-border">
            <div
              className={`h-full transition-all duration-300 ${
                stability >= 80
                  ? 'bg-emerald-500'
                  : stability >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
              style={{ width: `${stability}%` }}
            />
          </div>
          <span
            className={`text-sm font-semibold tabular-nums ${
              stability >= 80
                ? 'text-emerald-400'
                : stability >= 50
                  ? 'text-amber-400'
                  : 'text-rose-400'
            }`}
          >
            {stability}
          </span>
        </div>

        <div className="h-8 w-px bg-game-border" />

        {/* Controls */}
        <div className="flex items-center gap-2">
          {gameState === 'playing' ? (
            <button
              type="button"
              onClick={onPause}
              className="px-3.5 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-500 transition-colors"
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={onResume}
              className="px-3.5 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-500 transition-colors"
            >
              Resume
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="px-3.5 py-1.5 bg-game-bg text-slate-400 text-sm font-medium rounded-md border border-game-border hover:bg-game-border/50 hover:text-slate-300 transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
