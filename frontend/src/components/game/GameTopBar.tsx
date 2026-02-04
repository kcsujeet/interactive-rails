/**
 * Game Top Bar Component
 * Header with level info and controls
 */

import { Button } from '../ui/Button';
import type { GameState, LevelData } from './types';

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
		<div className="h-14 bg-card border-b border-border flex items-center justify-between px-5">
			<div className="flex items-center gap-6">
				<div>
					<div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
						Session
					</div>
					<h2 className="text-sm font-semibold text-foreground -mt-0.5">
						{level?.name}
					</h2>
				</div>
				<div className="h-8 w-px bg-border" />
				<div className="flex items-center gap-4 text-sm text-muted-foreground">
					<span>
						Room {currentRoom + 1}/{level?.rooms?.length || 1}
					</span>
					<span>{placedNodesCount} nodes</span>
					<span>{connectionsCount} connections</span>
				</div>
			</div>

			<div className="flex items-center gap-5">
				{/* Stability indicator */}
				<div className="flex items-center gap-3">
					<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
						Stability
					</span>
					<div className="w-28 h-2 bg-background rounded-full overflow-hidden border border-border">
						<div
							className={`h-full transition-all duration-300 ${
								stability >= 80
									? 'bg-success'
									: stability >= 50
										? 'bg-warning'
										: 'bg-destructive'
							}`}
							style={{ width: `${stability}%` }}
						/>
					</div>
					<span
						className={`text-sm font-semibold tabular-nums ${
							stability >= 80
								? 'text-success'
								: stability >= 50
									? 'text-warning'
									: 'text-destructive'
						}`}
					>
						{stability}
					</span>
				</div>

				<div className="h-8 w-px bg-border" />

				{/* Controls */}
				<div className="flex items-center gap-2">
					{gameState === 'playing' ? (
						<Button
							className="bg-warning text-warning-foreground hover:bg-warning/90"
							onClick={onPause}
							size="sm"
						>
							Pause
						</Button>
					) : (
						<Button
							className="bg-success text-success-foreground hover:bg-success/90"
							onClick={onResume}
							size="sm"
						>
							Resume
						</Button>
					)}
					<Button onClick={onExit} size="sm" variant="outline">
						Exit
					</Button>
				</div>
			</div>
		</div>
	);
}
