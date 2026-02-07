/**
 * Pipeline Node Component
 * Individual node with ports
 */

import type { MouseEvent } from 'react';
import { getNodeInfo } from './data';
import type { Connection, PendingConnection, PlacedNode } from './types';

interface PipelineNodeProps {
	node: PlacedNode;
	isSelected: boolean;
	isDragging: boolean;
	isPipelineBroken: boolean;
	simulationRunning: boolean;
	pendingConnection: PendingConnection | null;
	connections: Connection[];
	onMouseDown: (e: MouseEvent, nodeId: string) => void;
	onStartConnection: (e: MouseEvent, nodeId: string) => void;
	onCompleteConnection: (e: MouseEvent, nodeId: string) => void;
	onDelete?: () => void;
}

export function PipelineNode({
	node,
	isSelected,
	isDragging,
	isPipelineBroken,
	simulationRunning,
	pendingConnection,
	connections,
	onMouseDown,
	onStartConnection,
	onCompleteConnection,
	onDelete,
}: PipelineNodeProps) {
	const nodeInfo = getNodeInfo(node.type);
	const isConnectionSource = pendingConnection?.sourceNodeId === node.id;
	const hasInputConnection = connections.some(
		(c) => c.targetNodeId === node.id,
	);
	const hasOutputConnection = connections.some(
		(c) => c.sourceNodeId === node.id,
	);

	const getNodeLabel = () => {
		if (node.config?.label) return node.config.label;

		switch (node.type) {
			case 'database':
				return isPipelineBroken ? 'DISCONNECTED' : 'PostgreSQL';
			case 'eager_load':
				return 'includes(:assoc)';
			case 'cache':
				return 'Redis Cache';
			case 'index':
				return 'add_index :table';
			case 'model':
				return 'ActiveRecord';
			case 'controller':
				return 'ActionController';
			case 'view':
				return 'ERB Template';
			case 'router':
				return 'routes.rb';
			case 'request':
				return 'HTTP GET';
			case 'response':
				return 'HTTP 200';
			default:
				return node.type;
		}
	};

	return (
		<div
			className={`absolute transform -translate-x-1/2 -translate-y-1/2 select-none ${
				isDragging ? 'cursor-grabbing z-20' : 'cursor-grab'
			} ${isSelected && !isDragging ? 'scale-105 z-10' : ''}`}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => onMouseDown(e, node.id)}
			style={{
				left: node.x,
				top: node.y,
				zIndex: isDragging ? 20 : isSelected ? 10 : 1,
				transition: isDragging ? 'none' : 'transform 0.1s ease-out',
				pointerEvents: node.locked ? 'none' : 'auto',
				opacity: node.locked ? 0.7 : 1,
				filter: node.locked ? 'grayscale(100%)' : 'none',
			}}
		>
			{/* Delete button - shown when selected and not locked */}
			{isSelected && !node.locked && onDelete && (
				<button
					className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center z-30 hover:bg-destructive/80 transition-colors"
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					title="Delete node"
					type="button"
				>
					<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
						<path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</button>
			)}

			{/* Input port (left side) - Hide for locked nodes unless it's a specific educational case? Keeping hidden for now */}
			{!node.locked && node.type !== 'request' && (
				<div
					className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
						pendingConnection && !isConnectionSource
							? 'bg-success border-success/50 scale-125 cursor-pointer'
							: hasInputConnection
								? 'bg-secondary border-border'
								: 'bg-card border-border'
					}`}
					data-port="input"
					onMouseUp={(e) => onCompleteConnection(e, node.id)}
				>
					<div
						className={`w-2 h-2 rounded-full ${
							pendingConnection && !isConnectionSource
								? 'bg-foreground'
								: 'bg-muted-foreground'
						}`}
					/>
				</div>
			)}

			{/* Output port (right side) */}
			{!node.locked && node.type !== 'response' && (
				<div
					className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
						isConnectionSource
							? 'bg-primary border-primary/50 scale-125'
							: hasOutputConnection
								? 'bg-secondary border-border hover:bg-primary hover:border-primary/50'
								: 'bg-card border-border hover:bg-primary hover:border-primary/50'
					}`}
					data-port="output"
					onMouseDown={(e) => onStartConnection(e, node.id)}
				>
					<div
						className={`w-2 h-2 rounded-full ${isConnectionSource ? 'bg-foreground' : 'bg-muted-foreground'}`}
					/>
				</div>
			)}

			<div
				className={`w-32 rounded-lg border overflow-hidden ${
					isSelected
						? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
						: ''
				}`}
				style={{
					borderColor:
						isPipelineBroken && node.type === 'database'
							? '#475569'
							: `${nodeInfo.color}`,
					opacity: isPipelineBroken && node.type === 'database' ? 0.6 : 1,
				}}
			>
				<div
					className="px-3 py-2 text-foreground text-sm font-medium text-center relative"
					style={{ backgroundColor: nodeInfo.color }}
				>
					{nodeInfo.name}
					{/* Activity indicator for database */}
					{node.type === 'database' &&
						simulationRunning &&
						!isPipelineBroken && (
							<span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-warning animate-pulse" />
						)}
					{node.type === 'database' && isPipelineBroken && (
						<span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-muted-foreground" />
					)}
				</div>
				<div className="bg-background px-3 py-2 border-t border-border">
					<div
						className={`text-xs text-center font-mono ${
							isPipelineBroken && node.type === 'database'
								? 'text-muted-foreground/50'
								: 'text-muted-foreground'
						}`}
					>
						{getNodeLabel()}
					</div>
				</div>
			</div>
		</div>
	);
}
