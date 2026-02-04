/**
 * BaseNode Component
 *
 * Base component for all pipeline nodes with common styling and handles.
 * Provides a consistent look and feel across all node types.
 */

import { Handle, Position } from '@xyflow/react';
import clsx from 'clsx';
import { memo, type ReactNode } from 'react';
import type { PipelineNodeData } from '../../../stores';

interface BaseNodeProps {
	data: PipelineNodeData;
	selected?: boolean;
	color: string;
	icon: ReactNode;
	showSourceHandle?: boolean;
	showTargetHandle?: boolean;
}

function BaseNode({
	data,
	selected,
	color,
	icon,
	showSourceHandle = true,
	showTargetHandle = true,
}: BaseNodeProps) {
	const { label, status, metrics } = data;

	const statusColor = {
		idle: 'bg-muted-foreground',
		processing: 'bg-primary animate-pulse',
		error: 'bg-destructive',
		success: 'bg-success',
	}[status];

	return (
		<div
			className={clsx(
				'relative min-w-[140px] rounded-lg border-2 bg-game-surface shadow-lg transition-all duration-200',
				selected
					? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-game-bg'
					: '',
				status === 'error' ? 'border-red-500' : 'border-game-border',
			)}
			style={{ borderColor: selected ? color : undefined }}
		>
			{/* Status indicator */}
			<div
				className={clsx(
					'absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border-2 border-game-surface',
					statusColor,
				)}
				title={`Status: ${status}`}
			/>

			{/* Header */}
			<div
				className="flex items-center gap-2 px-3 py-2 rounded-t-md"
				style={{ backgroundColor: `${color}20` }}
			>
				<span className="text-lg" style={{ color }}>
					{icon}
				</span>
				<span className="text-sm font-medium text-foreground truncate">
					{label}
				</span>
			</div>

			{/* Metrics (if available) */}
			{metrics && (
				<div className="px-3 py-2 text-xs space-y-1 border-t border-game-border">
					{metrics.processTime > 0 && (
						<div className="flex justify-between">
							<span className="text-muted-foreground">Time:</span>
							<span
								className={clsx(
									metrics.processTime > 100
										? 'text-destructive'
										: 'text-foreground',
								)}
							>
								{metrics.processTime}ms
							</span>
						</div>
					)}
					{metrics.queryCount > 0 && (
						<div className="flex justify-between">
							<span className="text-muted-foreground">Queries:</span>
							<span
								className={clsx(
									metrics.queryCount > 10 ? 'text-warning' : 'text-foreground',
								)}
							>
								{metrics.queryCount}
							</span>
						</div>
					)}
					{metrics.cacheHits > 0 && (
						<div className="flex justify-between">
							<span className="text-muted-foreground">Cache:</span>
							<span className="text-success">{metrics.cacheHits} hits</span>
						</div>
					)}
					{metrics.errorCount > 0 && (
						<div className="flex justify-between">
							<span className="text-muted-foreground">Errors:</span>
							<span className="text-destructive">{metrics.errorCount}</span>
						</div>
					)}
				</div>
			)}

			{/* Target Handle (input) */}
			{showTargetHandle && (
				<Handle
					className="!w-3 !h-3 !bg-game-surface !border-2 !border-game-border hover:!border-blue-500 hover:!scale-125 transition-all"
					position={Position.Left}
					type="target"
				/>
			)}

			{/* Source Handle (output) */}
			{showSourceHandle && (
				<Handle
					className="!w-3 !h-3 !bg-game-surface !border-2 !border-game-border hover:!border-blue-500 hover:!scale-125 transition-all"
					position={Position.Right}
					type="source"
				/>
			)}
		</div>
	);
}

export default memo(BaseNode);
