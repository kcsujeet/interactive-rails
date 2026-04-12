/**
 * FlowNode - Shared React Flow node with card-style layout.
 *
 * Used across the sandbox and all level visualizations for consistent styling.
 * Colored icon header + body with optional children for level-specific content.
 *
 * Node styles (colors, icons, descriptions) come from @/lib/node-styles.
 */

import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FlowNodeData extends Record<string, unknown> {
	label: string;
	icon: string;
	color: string;
	description?: string;
	status?: 'idle' | 'active' | 'warning' | 'error' | 'critical';
	showTarget?: boolean;
	showSource?: boolean;
}

interface FlowNodeProps {
	data: FlowNodeData;
	selected?: boolean;
	children?: ReactNode;
}

export function FlowNode({ data, selected, children }: FlowNodeProps) {
	const showTarget = data.showTarget !== false;
	const showSource = data.showSource !== false;

	const isCritical = data.status === 'critical';

	const statusBorder =
		data.status === 'active'
			? 'border-success'
			: data.status === 'warning'
				? 'border-warning'
				: data.status === 'error' || isCritical
					? 'border-destructive'
					: 'border-border';

	return (
		<>
			{showTarget && (
				<Handle
					className="w-2.5 h-2.5"
					position={Position.Left}
					type="target"
				/>
			)}
			<div
				className={cn(
					'rounded-lg border-2 bg-card shadow-md min-w-40 transition-all',
					statusBorder,
					isCritical && 'animate-pulse border-destructive bg-destructive/10',
					selected &&
						'ring-2 ring-primary ring-offset-2 ring-offset-background',
				)}
			>
				{/* Colored header */}
				<div
					className="flex items-center gap-2 px-3 py-2 rounded-t-md"
					style={{ backgroundColor: `${data.color}20` }}
				>
					<span
						className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
						style={{ backgroundColor: data.color }}
					>
						{data.icon}
					</span>
					<span className="text-sm font-semibold text-foreground truncate">
						{data.label}
					</span>
					{data.status && data.status !== 'idle' && (
						<span
							className={cn(
								'w-2 h-2 rounded-full ml-auto shrink-0',
								data.status === 'active' && 'bg-success animate-pulse',
								data.status === 'warning' && 'bg-warning animate-pulse',
								data.status === 'error' && 'bg-destructive animate-pulse',
								data.status === 'critical' && 'bg-destructive animate-ping',
							)}
						/>
					)}
				</div>

				{/* Body: children replace description when present */}
				<div className="px-3 py-2 space-y-1.5">
					{children ??
						(data.description && (
							<p className="text-xs text-muted-foreground">
								{data.description}
							</p>
						))}
				</div>
			</div>
			{showSource && (
				<Handle
					className="w-2.5 h-2.5"
					position={Position.Right}
					type="source"
				/>
			)}
		</>
	);
}
