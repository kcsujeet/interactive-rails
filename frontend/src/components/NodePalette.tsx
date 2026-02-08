/**
 * Node Palette Component
 * Left sidebar content with draggable nodes and metrics.
 * Renders content only — wrap in LeftPanel for layout chrome.
 */

import type { DragEvent } from 'react';
import { nodeTypes } from '@/utils/gameData';
import type { LevelChallenge, LiveMetrics } from '@/types/game';

interface NodePaletteProps {
	challenge: LevelChallenge | undefined;
	/** Available node types - overrides challenge.availableNodes if provided */
	availableNodes?: string[];
	/** Goal text - overrides challenge.goal if provided */
	goal?: string;
	/** Whether to show metrics panel - defaults to true if challenge has initialMetrics */
	showMetrics?: boolean;
	liveMetrics: LiveMetrics;
	isPipelineBroken: boolean;
	breakReason: string | null;
	draggedNodeType: string | null;
	onDragStart: (e: DragEvent<HTMLDivElement>, nodeType: string) => void;
	onDragEnd: () => void;
}

export function NodePalette({
	challenge,
	availableNodes,
	goal,
	showMetrics,
	liveMetrics,
	isPipelineBroken,
	breakReason,
	draggedNodeType,
	onDragStart,
	onDragEnd,
}: NodePaletteProps) {
	const availableNodeTypes = availableNodes || challenge?.availableNodes || [];
	const goalText = goal || challenge?.goal;
	const shouldShowMetrics = showMetrics ?? !!challenge?.initialMetrics;

	return (
		<div className="p-4 overflow-y-auto flex-1">
			{/* Live metrics display */}
			{shouldShowMetrics && (
				<div
					className={`mb-5 rounded-lg p-4 border transition-all duration-300 ${
						isPipelineBroken
							? 'bg-background border-secondary'
							: 'bg-background border-border'
					}`}
				>
					<div
						className={`text-[10px] font-medium mb-3 uppercase tracking-wider ${
							isPipelineBroken ? 'text-muted-foreground' : 'text-primary'
						}`}
					>
						{isPipelineBroken
							? `Pipeline Broken - ${breakReason}`
							: 'Live Metrics'}
					</div>

					<div className="mb-3">
						<div className="flex justify-between text-xs text-muted-foreground mb-1">
							<span>Queries</span>
							<span className="text-foreground font-medium tabular-nums">
								{liveMetrics.queryCount.toLocaleString()}
							</span>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-2 text-center">
						<div className="bg-background rounded-md p-3 border border-border">
							<div className="text-xl font-semibold text-foreground tabular-nums">
								{Math.round(liveMetrics.latency)}
							</div>
							<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
								ms
							</div>
						</div>
						<div className="bg-background rounded-md p-3 border border-border">
							<div className="text-xl font-semibold text-foreground tabular-nums">
								{Math.round(liveMetrics.dbLoad)}%
							</div>
							<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
								db load
							</div>
						</div>
					</div>

					<div className="mt-3 space-y-2">
						<div>
							<div className="flex justify-between text-[10px] text-muted-foreground mb-1">
								<span>CPU</span>
								<span className="tabular-nums">
									{Math.round(liveMetrics.cpuLoad)}%
								</span>
							</div>
							<div className="h-1.5 bg-secondary rounded-full overflow-hidden">
								<div
									className="h-full transition-all duration-300 bg-primary"
									style={{ width: `${liveMetrics.cpuLoad}%` }}
								/>
							</div>
						</div>
						<div>
							<div className="flex justify-between text-[10px] text-muted-foreground mb-1">
								<span>Database</span>
								<span className="tabular-nums">
									{Math.round(liveMetrics.dbLoad)}%
								</span>
							</div>
							<div className="h-1.5 bg-secondary rounded-full overflow-hidden">
								<div
									className="h-full transition-all duration-300 bg-primary"
									style={{ width: `${liveMetrics.dbLoad}%` }}
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Goal reminder */}
			{goalText && (
				<div className="mb-5 bg-success/10 border border-success/20 rounded-lg p-4">
					<div className="text-[10px] font-medium text-success mb-1.5 uppercase tracking-wider">
						Goal
					</div>
					<div className="text-sm text-success-foreground leading-relaxed">
						{goalText}
					</div>
				</div>
			)}

			<h2 className="text-sm font-semibold text-foreground mb-1">
				Blueprint Nodes
			</h2>

			{availableNodeTypes.length === 0 ? (
				<p className="text-xs text-muted-foreground mt-2">
					No nodes to add for this challenge. Focus on the existing pipeline.
				</p>
			) : (
				<>
					<p className="text-xs text-muted-foreground mb-4">
						Drag components onto the canvas
					</p>
					<div className="space-y-2">
						{nodeTypes
							.filter((node) => availableNodeTypes.includes(node.type))
							.map((node) => (
								<div
									className={`p-3 rounded-md border cursor-grab active:cursor-grabbing transition-all ${
										draggedNodeType === node.type
											? 'opacity-50 border-dashed'
											: 'hover:translate-x-0.5 hover:shadow-md'
									}`}
									draggable
									key={node.type}
									onDragEnd={onDragEnd}
									onDragStart={(e) => onDragStart(e, node.type)}
									style={{
										backgroundColor: `${node.color}15`,
										borderColor: `${node.color}60`,
									}}
								>
									<div className="flex items-center justify-between">
										<span className="text-sm text-foreground font-medium">
											{node.name}
										</span>
										<svg
											className="w-4 h-4 text-muted-foreground"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												d="M4 8h16M4 16h16"
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={1.5}
											/>
										</svg>
									</div>
								</div>
							))}
					</div>
				</>
			)}

			<div className="mt-6 pt-5 border-t border-border">
				<h3 className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
					How To Connect
				</h3>
				<div className="text-xs text-muted-foreground space-y-1.5">
					<p>• Drag from right port to left port</p>
					<p>• Click a connection line to delete it</p>
					<p>• Request has no input port</p>
					<p>• Response has no output port</p>
				</div>
			</div>
		</div>
	);
}
