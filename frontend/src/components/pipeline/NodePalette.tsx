/**
 * NodePalette Component
 *
 * Sidebar with available node types that can be dragged onto the pipeline canvas.
 * Nodes are locked/unlocked based on player level progression.
 */

import clsx from 'clsx';
import { type DragEvent, memo, useCallback } from 'react';
import type { NodeType } from '../../stores';
import { selectNodeUnlockLevel, useGameStore } from '../../stores';

interface NodeDefinition {
	type: NodeType;
	label: string;
	description: string;
	color: string;
	icon: string;
}

const NODE_DEFINITIONS: NodeDefinition[] = [
	{
		type: 'request',
		label: 'Request',
		description: 'Entry point for HTTP requests',
		color: '#3b82f6',
		icon: '⚡',
	},
	{
		type: 'router',
		label: 'Router',
		description: 'Routes requests to controllers',
		color: '#a78bfa',
		icon: '🔀',
	},
	{
		type: 'controller',
		label: 'Controller',
		description: 'Handles business logic',
		color: '#10b981',
		icon: '🎮',
	},
	{
		type: 'model',
		label: 'Model',
		description: 'Data layer and associations',
		color: '#f59e0b',
		icon: '📦',
	},
	{
		type: 'database',
		label: 'Database',
		description: 'Persistent data storage',
		color: '#ef4444',
		icon: '🗄️',
	},
	{
		type: 'cache',
		label: 'Cache',
		description: 'In-memory data caching',
		color: '#06b6d4',
		icon: '💾',
	},
	{
		type: 'view',
		label: 'View',
		description: 'Renders HTML/JSON responses',
		color: '#a855f7',
		icon: '👁️',
	},
	{
		type: 'response',
		label: 'Response',
		description: 'Final HTTP response',
		color: '#22c55e',
		icon: '✅',
	},
	{
		type: 'background_job',
		label: 'Background Job',
		description: 'Async task processing',
		color: '#9333ea',
		icon: '⏳',
	},
];

interface NodePaletteItemProps {
	node: NodeDefinition;
	isUnlocked: boolean;
	unlockLevel: number;
	onDragStart: (event: DragEvent<HTMLDivElement>, nodeType: NodeType) => void;
}

const NodePaletteItem = memo(function NodePaletteItem({
	node,
	isUnlocked,
	unlockLevel,
	onDragStart,
}: NodePaletteItemProps) {
	const handleDragStart = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (!isUnlocked) {
				e.preventDefault();
				return;
			}
			onDragStart(e, node.type);
		},
		[isUnlocked, node.type, onDragStart],
	);

	return (
		<div
			className={clsx(
				'group relative p-3 rounded-lg border-2 transition-all duration-200',
				isUnlocked
					? 'bg-card border-border cursor-grab hover:border-blue-500 hover:shadow-lg active:cursor-grabbing'
					: 'bg-background/50 border-border/50 cursor-not-allowed opacity-60',
			)}
			draggable={isUnlocked}
			onDragStart={handleDragStart}
		>
			{/* Lock overlay */}
			{!isUnlocked && (
				<div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg z-10">
					<div className="text-center">
						<span className="text-lg">🔒</span>
						<p className="text-xs text-muted-foreground mt-1">
							Level {unlockLevel}
						</p>
					</div>
				</div>
			)}

			<div className="flex items-start gap-3">
				{/* Icon with colored background */}
				<div
					className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl"
					style={{ backgroundColor: `${node.color}20` }}
				>
					{node.icon}
				</div>

				{/* Text content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm text-foreground">
							{node.label}
						</span>
						{/* Color indicator */}
						<span
							className="w-2 h-2 rounded-full flex-shrink-0"
							style={{ backgroundColor: node.color }}
						/>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
						{node.description}
					</p>
				</div>
			</div>

			{/* Drag hint */}
			{isUnlocked && (
				<div className="absolute -right-1 -bottom-1 opacity-0 group-hover:opacity-100 transition-opacity">
					<span className="text-xs text-muted-foreground">Drag to add</span>
				</div>
			)}
		</div>
	);
});

interface NodePaletteProps {
	className?: string;
}

function NodePalette({ className }: NodePaletteProps) {
	const isNodeUnlocked = useGameStore((state) => state.isNodeUnlocked);
	const playerLevel = useGameStore((state) => state.level);

	const handleDragStart = useCallback(
		(event: DragEvent<HTMLDivElement>, nodeType: NodeType) => {
			event.dataTransfer.setData('application/reactflow', nodeType);
			event.dataTransfer.effectAllowed = 'move';
		},
		[],
	);

	// Group nodes by category
	const requestNodes = NODE_DEFINITIONS.filter((n) =>
		['request', 'response'].includes(n.type),
	);
	const processingNodes = NODE_DEFINITIONS.filter((n) =>
		['router', 'controller', 'model'].includes(n.type),
	);
	const dataNodes = NODE_DEFINITIONS.filter((n) =>
		['database', 'cache'].includes(n.type),
	);
	const otherNodes = NODE_DEFINITIONS.filter((n) =>
		['view', 'background_job'].includes(n.type),
	);

	const renderCategory = (title: string, nodes: NodeDefinition[]) => (
		<div className="space-y-2">
			<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
				{title}
			</h4>
			<div className="space-y-2">
				{nodes.map((node) => (
					<NodePaletteItem
						isUnlocked={isNodeUnlocked(node.type)}
						key={node.type}
						node={node}
						onDragStart={handleDragStart}
						unlockLevel={selectNodeUnlockLevel(node.type)}
					/>
				))}
			</div>
		</div>
	);

	return (
		<div
			className={clsx(
				'flex flex-col h-full bg-card border-r border-border',
				className,
			)}
		>
			{/* Header */}
			<div className="px-4 py-3 border-b border-border">
				<h3 className="font-semibold text-foreground">Node Palette</h3>
				<p className="text-xs text-muted-foreground mt-1">
					Drag nodes onto the canvas to build your pipeline
				</p>
			</div>

			{/* Node list */}
			<div className="flex-1 overflow-y-auto p-4 space-y-6">
				{renderCategory('Request/Response', requestNodes)}
				{renderCategory('Processing', processingNodes)}
				{renderCategory('Data', dataNodes)}
				{renderCategory('Other', otherNodes)}
			</div>

			{/* Footer with level info */}
			<div className="px-4 py-3 border-t border-border bg-background/50">
				<div className="flex items-center justify-between text-xs">
					<span className="text-muted-foreground">Your Level:</span>
					<span className="font-medium text-primary">Level {playerLevel}</span>
				</div>
				<div className="mt-1 text-xs text-muted-foreground">
					Unlock more nodes by leveling up
				</div>
			</div>
		</div>
	);
}

export default memo(NodePalette);

// Export node definitions for use elsewhere
export { NODE_DEFINITIONS };
