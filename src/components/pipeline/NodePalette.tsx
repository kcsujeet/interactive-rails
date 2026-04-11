/**
 * NodePalette Component
 *
 * Sidebar with available node types that can be dragged onto the pipeline canvas.
 * Nodes are locked/unlocked based on player level progression.
 */

import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import {
	CheckCircle,
	Clock,
	Database,
	Eye,
	GitBranch,
	HardDrive,
	Lock,
	Package,
	Settings,
	Zap,
} from 'lucide-react';
import { type DragEvent, memo, useCallback } from 'react';
import { OptionCard, resolveColor } from '@/components/levels';
import type { NodeType } from '@/stores';
import { selectNodeUnlockLevel, useGameStore } from '@/stores';

interface NodeDefinition {
	type: NodeType;
	label: string;
	description: string;
	color: string;
	icon: LucideIcon;
}

const NODE_DEFINITIONS: NodeDefinition[] = [
	{
		type: 'request',
		label: 'Request',
		description: 'Entry point for HTTP requests',
		color: '#3b82f6',
		icon: Zap,
	},
	{
		type: 'router',
		label: 'Router',
		description: 'Routes requests to controllers',
		color: '#a78bfa',
		icon: GitBranch,
	},
	{
		type: 'controller',
		label: 'Controller',
		description: 'Handles business logic',
		color: '#10b981',
		icon: Settings,
	},
	{
		type: 'model',
		label: 'Model',
		description: 'Data layer and associations',
		color: '#f59e0b',
		icon: Package,
	},
	{
		type: 'database',
		label: 'Database',
		description: 'Persistent data storage',
		color: '#ef4444',
		icon: Database,
	},
	{
		type: 'cache',
		label: 'Cache',
		description: 'In-memory data caching',
		color: '#06b6d4',
		icon: HardDrive,
	},
	{
		type: 'serializer',
		label: 'Serializer',
		description: 'Serializes JSON responses',
		color: '#8b5cf6',
		icon: Eye,
	},
	{
		type: 'response',
		label: 'Response',
		description: 'Final HTTP response',
		color: '#22c55e',
		icon: CheckCircle,
	},
	{
		type: 'background_job',
		label: 'Background Job',
		description: 'Async task processing',
		color: '#9333ea',
		icon: Clock,
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
		(e: DragEvent<Element>) => {
			if (!isUnlocked) {
				e.preventDefault();
				return;
			}
			onDragStart(e as DragEvent<HTMLDivElement>, node.type);
		},
		[isUnlocked, node.type, onDragStart],
	);

	return (
		<div className="group relative">
			{/* Lock overlay */}
			{!isUnlocked && (
				<div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg z-10">
					<div className="text-center">
						<Lock className="w-5 h-5 mx-auto text-muted-foreground" />
						<p className="text-xs text-muted-foreground mt-1">
							Level {unlockLevel}
						</p>
					</div>
				</div>
			)}

			<OptionCard
				color={resolveColor(node.color)}
				description={node.description}
				disabled={!isUnlocked}
				dragData={node.type}
				dragType="application/reactflow"
				draggable={isUnlocked}
				icon={node.icon}
				name={node.label}
				onDragStart={handleDragStart}
				size="lg"
			/>
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
		['serializer', 'background_job'].includes(n.type),
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
