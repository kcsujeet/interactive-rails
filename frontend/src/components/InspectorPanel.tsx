/**
 * Inspector Panel Component
 * Right sidebar content with validation and stats.
 * Renders content only — wrap in RightPanel for layout chrome.
 */

import type {
	LevelChallenge,
	PlacedNode,
	ValidationResult,
} from '@/types/game';
import { Button } from './ui/Button';

interface InspectorPanelProps {
	placedNodes: PlacedNode[];
	connectionsCount: number;
	showValidation: boolean;
	lastValidation: ValidationResult | null;
	challenge: LevelChallenge | undefined;
	/** Initial nodes count - overrides challenge.initialNodes.length if provided */
	initialNodesCount?: number;
	onCheckPipeline: () => void;
	onResetValidation: () => void;
	onComplete: (stars: number) => void;
}

export function InspectorPanel({
	placedNodes,
	connectionsCount,
	showValidation,
	lastValidation,
	challenge,
	initialNodesCount,
	onCheckPipeline,
	onResetValidation,
	onComplete,
}: InspectorPanelProps) {
	const addedNodes =
		placedNodes.length -
		(initialNodesCount ?? challenge?.initialNodes.length ?? 0);

	return (
		<div className="p-4 overflow-y-auto flex-1">
			<div className="mb-5">
				<div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
					Diagnostics
				</div>
				<h2 className="text-sm font-semibold text-foreground -mt-0.5">
					Inspector
				</h2>
			</div>

			<div className="space-y-5">
				<div>
					<h3 className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
						Pipeline
					</h3>
					<div className="grid grid-cols-2 gap-2">
						<div className="bg-background border border-border rounded-md p-3">
							<div className="text-2xl font-semibold text-foreground tabular-nums">
								{placedNodes.length}
							</div>
							<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
								nodes
							</div>
						</div>
						<div className="bg-background border border-border rounded-md p-3">
							<div className="text-2xl font-semibold text-foreground tabular-nums">
								{connectionsCount}
							</div>
							<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
								connections
							</div>
						</div>
					</div>
				</div>

				<div>
					<h3 className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
						Queries
					</h3>
					<div className="bg-background border border-border rounded-md p-3">
						<div className="text-2xl font-semibold text-foreground tabular-nums">
							{placedNodes.filter((n) => n.type === 'database').length}
						</div>
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
							database nodes
						</div>
					</div>
				</div>

				{/* Connection tips */}
				{placedNodes.length > 0 &&
					connectionsCount === 0 &&
					!showValidation && (
						<div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
							<div className="text-sm text-warning font-medium mb-1">
								Tip: Connect your nodes
							</div>
							<div className="text-xs text-warning-foreground/70">
								Drag from a node&apos;s right port to another node&apos;s left
								port to create a connection.
							</div>
						</div>
					)}

				{/* Check Pipeline button */}
				{placedNodes.length >= 2 &&
					connectionsCount >= 1 &&
					!showValidation && (
						<Button className="w-full" onClick={onCheckPipeline}>
							Check Pipeline
						</Button>
					)}

				{/* Validation results */}
				{showValidation && lastValidation && (
					<div>
						<h3 className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
							Pipeline Status
						</h3>
						<div
							className={`rounded-lg p-4 border ${
								lastValidation.valid
									? 'bg-success/10 border-success/20'
									: 'bg-destructive/10 border-destructive/20'
							}`}
						>
							<div className="flex items-center gap-2 mb-2">
								<span
									className={`text-lg ${lastValidation.valid ? 'text-success' : 'text-destructive'}`}
								>
									{lastValidation.valid ? '✓' : '✗'}
								</span>
								<span
									className={`text-sm font-medium ${lastValidation.valid ? 'text-success' : 'text-destructive'}`}
								>
									{lastValidation.valid
										? 'Valid Pipeline!'
										: 'Invalid Pipeline'}
								</span>
								<span className="ml-auto text-xs text-muted-foreground tabular-nums">
									Score: {lastValidation.score}
								</span>
							</div>
							{lastValidation.errors.length > 0 && (
								<ul className="text-xs text-destructive/80 space-y-1.5 mb-3">
									{lastValidation.errors.slice(0, 4).map((err) => (
										<li key={err}>• {err}</li>
									))}
									{lastValidation.errors.length > 4 && (
										<li className="text-muted-foreground">
											...and {lastValidation.errors.length - 4} more
										</li>
									)}
								</ul>
							)}
							{!lastValidation.valid && (
								<Button
									className="w-full"
									onClick={onResetValidation}
									size="sm"
									variant="outline"
								>
									Try Again
								</Button>
							)}
						</div>
					</div>
				)}

				<div>
					<h3 className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
						Pipeline Stats
					</h3>
					<div className="bg-background border border-border rounded-md p-4 space-y-2.5">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Nodes</span>
							<span className="text-foreground font-medium tabular-nums">
								{placedNodes.length}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Connections</span>
							<span className="text-foreground font-medium tabular-nums">
								{connectionsCount}
							</span>
						</div>
						{addedNodes > 0 && (
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Nodes Added</span>
								<span className="text-success font-medium tabular-nums">
									+{addedNodes}
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Complete button */}
				{showValidation && lastValidation?.valid && (
					<Button
						className="w-full bg-success text-success-foreground hover:bg-success/90"
						onClick={() => {
							const stars =
								lastValidation.score >= 80
									? 3
									: lastValidation.score >= 50
										? 2
										: 1;
							onComplete(stars);
						}}
					>
						Complete Challenge
					</Button>
				)}
			</div>
		</div>
	);
}
