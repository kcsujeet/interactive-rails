/**
 * Node Palette Component
 * Left sidebar content with draggable nodes and metrics.
 * Renders content only — wrap in LeftPanel for layout chrome.
 */

import type { DragEvent } from 'react';
import { DraggableNode } from '@/components/levels/DraggableNode';
import { MetricsPanel } from '@/components/levels/MetricsPanel';
import type { LevelChallenge, LiveMetrics } from '@/types/game';
import { nodeTypes } from '@/utils/gameData';

interface NodePaletteProps {
	challenge: LevelChallenge | undefined;
	/** Available node types - overrides challenge.availableNodes if provided */
	availableNodes?: string[];
	/** @deprecated Goal is now shown as Learning Goal in the right panel */
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
	showMetrics,
	liveMetrics,
	isPipelineBroken,
	breakReason,
	draggedNodeType,
	onDragStart,
	onDragEnd,
}: NodePaletteProps) {
	const availableNodeTypes = availableNodes || challenge?.availableNodes || [];
	const shouldShowMetrics = showMetrics ?? !!challenge?.initialMetrics;
	const renderableNodes = nodeTypes.filter((node) =>
		availableNodeTypes.includes(node.type),
	);

	return (
		<div className="p-4 overflow-y-auto flex-1">
			{shouldShowMetrics && (
				<div className="mb-5">
					<MetricsPanel
						breakReason={breakReason}
						isPipelineBroken={isPipelineBroken}
						liveMetrics={liveMetrics}
					/>
				</div>
			)}

			{renderableNodes.length > 0 && (
				<>
					<h2 className="text-sm font-semibold text-foreground mb-1">
						Pipeline Nodes
					</h2>
					<p className="text-xs text-muted-foreground mb-4">
						Drag components onto the canvas
					</p>
					<div className="space-y-2">
						{renderableNodes.map((node) => (
							<DraggableNode
								color={node.color}
								description={node.description || ''}
								icon={node.icon || ''}
								isDragging={draggedNodeType === node.type}
								key={node.type}
								name={node.name}
								onDragEnd={onDragEnd}
								onDragStart={onDragStart}
								type={node.type}
							/>
						))}
					</div>
				</>
			)}
		</div>
	);
}
