// Room component showing the current room state, objectives, and entities

import type { Enemy } from '@/stores/simulation';
import type { BossRoom, Room, RoomObjective } from '@/types/level';
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
        ${isMet ? 'bg-success/20 border-success' : 'bg-card border-border'}
      `}
		>
			<div className="flex items-center gap-2 mb-2">
				<div
					className={`
            w-8 h-8 rounded-full flex items-center justify-center font-bold
            ${isMet ? 'bg-success' : 'bg-secondary'}
          `}
				>
					{objectiveIcons[objective.type] || '?'}
				</div>
				<div>
					<h4 className="text-sm font-semibold text-foreground">
						{objective.type.charAt(0).toUpperCase() + objective.type.slice(1)}
					</h4>
					<p className="text-xs text-muted-foreground">
						{objective.description}
					</p>
				</div>
				{isMet && (
					<div className="ml-auto">
						<span className="text-success text-xl">V</span>
					</div>
				)}
			</div>

			{/* Progress bar */}
			<div className="h-2 bg-secondary rounded-full overflow-hidden">
				<div
					className={`h-full transition-all duration-300 ${isMet ? 'bg-success' : 'bg-primary'}`}
					style={{ width: `${Math.min(100, progress)}%` }}
				/>
			</div>

			{/* Target metrics */}
			{objective.targetMetrics && (
				<div className="mt-2 flex flex-wrap gap-2 text-xs">
					{objective.targetMetrics.maxLatencyP95 && (
						<span className="px-2 py-0.5 bg-secondary rounded text-foreground">
							p95 &lt; {objective.targetMetrics.maxLatencyP95}ms
						</span>
					)}
					{objective.targetMetrics.maxQueriesPerRequest && (
						<span className="px-2 py-0.5 bg-secondary rounded text-foreground">
							Q/R &lt; {objective.targetMetrics.maxQueriesPerRequest}
						</span>
					)}
					{objective.targetMetrics.minCacheHitRate && (
						<span className="px-2 py-0.5 bg-secondary rounded text-foreground">
							Cache &gt; {objective.targetMetrics.minCacheHitRate}%
						</span>
					)}
					{objective.targetMetrics.minStability && (
						<span className="px-2 py-0.5 bg-secondary rounded text-foreground">
							Stability &gt; {objective.targetMetrics.minStability}
						</span>
					)}
				</div>
			)}

			{/* Hints */}
			{objective.hints && objective.hints.length > 0 && !isMet && (
				<div className="mt-2 p-2 bg-background/50 rounded text-xs text-muted-foreground">
					Hint: {objective.hints[0]}
				</div>
			)}
		</div>
	);
}

// Boss indicator for boss rooms
function BossIndicator({ room }: { room: BossRoom }) {
	return (
		<div className="bg-destructive/20 border border-destructive rounded-lg p-3 mb-4">
			<div className="flex items-center gap-3">
				<div className="w-12 h-12 bg-destructive rounded-full flex items-center justify-center text-2xl">
					B
				</div>
				<div>
					<h4 className="font-bold text-destructive">{room.bossName}</h4>
					<p className="text-xs text-muted-foreground">
						{room.bossDescription}
					</p>
				</div>
			</div>
			<div className="mt-2 flex gap-2">
				{room.phases.map((phase, index) => (
					<div
						className="flex-1 text-center p-1 bg-card rounded text-xs"
						key={index}
					>
						<span className="text-muted-foreground">Phase {index + 1}</span>
						<br />
						<span className="text-destructive">{phase.hpThreshold}% HP</span>
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
		<div className={`bg-card rounded-lg overflow-hidden ${className}`}>
			{/* Room header */}
			<div className="bg-secondary p-4 border-b border-border">
				<div className="flex items-center justify-between">
					<div>
						<div className="text-xs text-muted-foreground mb-1">
							Room {roomIndex + 1} of {totalRooms}
						</div>
						<h3 className="text-lg font-bold text-foreground">{room.name}</h3>
					</div>
					<div className="text-right">
						<div
							className={`text-2xl font-bold ${
								stability >= 80
									? 'text-success'
									: stability >= 50
										? 'text-warning'
										: 'text-destructive'
							}`}
						>
							{stability}
						</div>
						<div className="text-xs text-muted-foreground">Stability</div>
					</div>
				</div>
				<p className="text-sm text-muted-foreground mt-2">{room.description}</p>
			</div>

			{/* Boss indicator for boss rooms */}
			{isBossRoom && <BossIndicator room={room as BossRoom} />}

			{/* Objective */}
			<div className="p-4">
				<ObjectiveDisplay
					isMet={isMet}
					objective={room.objective}
					progress={progress}
				/>
			</div>

			{/* Enemy display area */}
			{enemies.length > 0 && (
				<div className="p-4 pt-0">
					<h4 className="text-sm font-semibold text-destructive mb-2">
						Active Threats ({enemies.length})
					</h4>
					<div className="grid grid-cols-4 gap-2">
						{enemies.slice(0, 8).map((enemy) => (
							<div className="flex flex-col items-center" key={enemy.id}>
								<EnemySprite enemy={enemy} scale={0.8} showHealthBar />
							</div>
						))}
					</div>
					{enemies.length > 8 && (
						<p className="text-xs text-muted-foreground mt-1">
							+{enemies.length - 8} more enemies
						</p>
					)}
				</div>
			)}

			{/* Room briefing */}
			{room.briefing && (
				<div className="p-4 pt-0">
					<div className="bg-primary/20 border border-primary/50 rounded p-3">
						<h4 className="text-xs font-semibold text-primary mb-1">
							Briefing
						</h4>
						<p className="text-sm text-foreground">{room.briefing}</p>
					</div>
				</div>
			)}

			{/* Available tools */}
			<div className="p-4 pt-0 border-t border-border">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">
							Available nodes:
						</span>
						<div className="flex gap-1">
							{room.availableNodeTypes.slice(0, 5).map((type) => (
								<span
									className="px-1.5 py-0.5 bg-secondary rounded text-xs text-foreground"
									key={type}
								>
									{type}
								</span>
							))}
							{room.availableNodeTypes.length > 5 && (
								<span className="text-xs text-muted-foreground">
									+{room.availableNodeTypes.length - 5}
								</span>
							)}
						</div>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">Defenses:</span>
						<div className="flex gap-1">
							{room.availableDefenses.slice(0, 3).map((type) => (
								<span
									className="px-1.5 py-0.5 bg-success/20 rounded text-xs text-success"
									key={type}
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
				<div className="p-4 bg-success/20 border-t border-success">
					<p className="text-sm text-success">{room.successMessage}</p>
				</div>
			)}
		</div>
	);
}
