// Main inspector panel component that combines all inspection tools

import { useState } from 'react';
import type {
	Defense,
	Enemy,
	SimulationStoreState,
} from "@/stores/simulation";
import { Button } from '../ui/Button';
import { MetricsDisplay } from './MetricsDisplay';
import { QueryTraceViewer } from './QueryTraceViewer';
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
		? [
				...simulationState.activeRequests,
				...simulationState.completedRequests,
			].flatMap((r) => r.queries)
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
				className={`bg-card border-l border-border w-12 flex flex-col items-center py-4 ${className}`}
			>
				<Button
					onClick={onToggle}
					size="icon"
					title="Open Inspector"
					variant="ghost"
				>
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
						/>
					</svg>
				</Button>

				{/* Mini stability indicator */}
				{simulationState && (
					<div className="mt-4 flex flex-col items-center gap-2">
						<div
							className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
								simulationState.stabilityScore >= 80
									? 'bg-success'
									: simulationState.stabilityScore >= 50
										? 'bg-warning'
										: 'bg-destructive'
							}`}
						>
							{simulationState.stabilityScore}
						</div>
						<span className="text-xs text-muted-foreground -rotate-90 whitespace-nowrap mt-4">
							Stability
						</span>
					</div>
				)}
			</div>
		);
	}

	return (
		<div
			className={`bg-card border-l border-border w-80 flex flex-col ${className}`}
		>
			{/* Header */}
			<div className="p-3 border-b border-border flex items-center justify-between">
				<h2 className="font-bold text-foreground flex items-center gap-2">
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
						/>
					</svg>
					Inspector
				</h2>
				<Button
					onClick={onToggle}
					size="icon"
					title="Close Inspector"
					variant="ghost"
				>
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M6 18L18 6M6 6l12 12"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
						/>
					</svg>
				</Button>
			</div>

			{/* Tabs */}
			<div className="flex border-b border-border">
				{tabs.map((tab) => {
					const isUnlocked = playerLevel >= tab.unlockLevel;
					const isActive = activeTab === tab.id;

					return (
						<Button
							className={`
                flex-1 rounded-none px-3 py-2 text-xs font-medium transition-colors
                ${isActive ? 'bg-secondary text-foreground border-b-2 border-primary' : ''}
                ${!isActive && isUnlocked ? 'text-muted-foreground hover:text-foreground hover:bg-secondary' : ''}
                ${!isUnlocked ? 'text-muted-foreground/50' : ''}
              `}
							disabled={!isUnlocked}
							key={tab.id}
							onClick={() => isUnlocked && setActiveTab(tab.id)}
							size="sm"
							title={
								!isUnlocked ? `Unlock at level ${tab.unlockLevel}` : undefined
							}
							variant="ghost"
						>
							{tab.label}
							{!isUnlocked && (
								<span className="ml-1 text-xs text-muted-foreground">
									Lv{tab.unlockLevel}
								</span>
							)}
						</Button>
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
						defenses={simulationState.defenses}
						enemies={simulationState.enemies}
						objectiveMet={simulationState.objectiveMet}
						objectiveProgress={simulationState.objectiveProgress}
						stabilityScore={simulationState.stabilityScore}
						stabilityTrend={simulationState.stabilityTrend}
					/>
				)}

				{/* Locked tab message */}
				{((activeTab === 'queries' && !canSeeQueries) ||
					(activeTab === 'requests' && !canSeeRequests)) && (
					<div className="p-6 text-center">
						<div className="text-4xl mb-3">
							<svg
								className="w-12 h-12 mx-auto text-muted-foreground"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									clipRule="evenodd"
									d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
									fillRule="evenodd"
								/>
							</svg>
						</div>
						<p className="text-muted-foreground text-sm">
							{activeTab === 'queries'
								? 'Query tracing unlocks at level 5'
								: 'Request timeline unlocks at level 10'}
						</p>
						<p className="text-muted-foreground/70 text-xs mt-2">
							Complete more levels to unlock!
						</p>
					</div>
				)}
			</div>

			{/* Intervention controls (level 20+) */}
			{canIntervene && simulationState && (
				<div className="p-3 border-t border-border bg-secondary">
					<h4 className="text-xs font-semibold text-warning mb-2">
						Debug Controls (Level 20+)
					</h4>
					<div className="flex gap-2">
						<Button size="sm" variant="secondary">
							Pause Requests
						</Button>
						<Button size="sm" variant="secondary">
							Clear Cache
						</Button>
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
		improving: 'text-success',
		stable: 'text-muted-foreground',
		degrading: 'text-destructive',
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
							? 'text-success'
							: stabilityScore >= 50
								? 'text-warning'
								: 'text-destructive'
					}`}
				>
					{stabilityScore}
				</div>
				<div className="text-muted-foreground text-sm">Stability Score</div>
				<div className={`text-sm ${trendColors[stabilityTrend]}`}>
					{trendIcons[stabilityTrend]} {stabilityTrend}
				</div>
			</div>

			{/* Stability bar */}
			<div className="h-4 bg-secondary rounded-full overflow-hidden">
				<div
					className={`h-full transition-all duration-500 ${
						stabilityScore >= 80
							? 'bg-success'
							: stabilityScore >= 50
								? 'bg-warning'
								: 'bg-destructive'
					}`}
					style={{ width: `${stabilityScore}%` }}
				/>
			</div>

			{/* Objective progress */}
			<div className="bg-secondary rounded-lg p-3">
				<div className="flex items-center justify-between mb-2">
					<span className="text-sm text-foreground">Objective Progress</span>
					{objectiveMet && (
						<span className="text-xs bg-success text-foreground px-2 py-0.5 rounded">
							COMPLETE
						</span>
					)}
				</div>
				<div className="h-2 bg-background rounded-full overflow-hidden">
					<div
						className={`h-full transition-all duration-300 ${
							objectiveMet ? 'bg-success' : 'bg-primary'
						}`}
						style={{ width: `${objectiveProgress}%` }}
					/>
				</div>
				<div className="text-xs text-muted-foreground mt-1 text-right">
					{objectiveProgress.toFixed(0)}%
				</div>
			</div>

			{/* Enemies */}
			<div>
				<h4 className="text-sm font-semibold text-foreground mb-2 flex items-center justify-between">
					<span>Active Threats</span>
					<span className="text-destructive">{activeEnemies.length}</span>
				</h4>
				{activeEnemies.length === 0 ? (
					<p className="text-xs text-muted-foreground">No active enemies</p>
				) : (
					<div className="space-y-1">
						{activeEnemies.slice(0, 5).map((enemy) => (
							<div className="flex items-center gap-2 text-xs" key={enemy.id}>
								<div className="w-2 h-2 rounded-full bg-destructive" />
								<span className="text-foreground">
									{enemy.type.replace('_', ' ')}
								</span>
								<span className="text-muted-foreground ml-auto">
									HP: {enemy.hp}/{enemy.maxHp}
								</span>
							</div>
						))}
						{activeEnemies.length > 5 && (
							<p className="text-xs text-muted-foreground">
								+{activeEnemies.length - 5} more...
							</p>
						)}
					</div>
				)}
			</div>

			{/* Defenses */}
			<div>
				<h4 className="text-sm font-semibold text-foreground mb-2 flex items-center justify-between">
					<span>Active Defenses</span>
					<span className="text-success">{defenses.length}</span>
				</h4>
				{defenses.length === 0 ? (
					<p className="text-xs text-muted-foreground">No defenses deployed</p>
				) : (
					<div className="space-y-1">
						{defenses.map((defense) => (
							<div className="flex items-center gap-2 text-xs" key={defense.id}>
								<div
									className={`w-2 h-2 rounded-full ${defense.isActive ? 'bg-success' : 'bg-secondary'}`}
								/>
								<span className="text-foreground">
									{defense.type.replace('_', ' ')}
								</span>
								<span className="text-muted-foreground ml-auto">
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
