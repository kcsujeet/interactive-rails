/**
 * FlowNode - Shared React Flow node with card-style layout.
 *
 * Used across the sandbox and all level visualizations for consistent styling.
 * Colored icon header + body with optional children for level-specific content.
 *
 * Usage as a React Flow nodeType:
 *   const nodeTypes = { custom: FlowNode };
 *
 * Node data shape:
 *   { label, icon, color, description?, status?, children rendered via React }
 */

import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FlowNodeData extends Record<string, unknown> {
	/** Node title shown in the header */
	label: string;
	/** 2-letter icon code shown in the colored square */
	icon: string;
	/** Hex color for the icon square and header tint */
	color: string;
	/** Optional subtitle shown below the label in the body */
	description?: string;
	/** Visual state: controls border color and optional pulsing dot */
	status?: 'idle' | 'active' | 'warning' | 'error';
	/** Whether to show left (target) handle */
	showTarget?: boolean;
	/** Whether to show right (source) handle */
	showSource?: boolean;
}

interface FlowNodeProps {
	data: FlowNodeData;
	selected?: boolean;
	/** Custom content rendered in the body below the description */
	children?: ReactNode;
}

export function FlowNode({ data, selected, children }: FlowNodeProps) {
	const showTarget = data.showTarget !== false;
	const showSource = data.showSource !== false;

	const statusBorder =
		data.status === 'active'
			? 'border-success'
			: data.status === 'warning'
				? 'border-warning'
				: data.status === 'error'
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
							)}
						/>
					)}
				</div>

				{/* Body */}
				<div className="px-3 py-2 space-y-1.5">
					{data.description && (
						<p className="text-xs text-muted-foreground">{data.description}</p>
					)}
					{children}
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
