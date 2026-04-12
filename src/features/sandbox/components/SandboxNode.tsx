/**
 * Custom React Flow node for the sandbox.
 * Card-style layout: colored header with icon + label, body with description and live metrics.
 */

import { Handle, type NodeProps, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { SandboxNode as SandboxNodeType } from '../utils/sandbox-layout';

export function SandboxNode({ data, selected }: NodeProps<SandboxNodeType>) {
	const d = data;
	const statusColor =
		d.status === 'active'
			? 'border-success'
			: d.status === 'warning'
				? 'border-warning'
				: d.status === 'error'
					? 'border-destructive'
					: 'border-border';

	return (
		<>
			<Handle className="w-2.5 h-2.5" position={Position.Left} type="target" />
			<div
				className={cn(
					'rounded-lg border-2 bg-card shadow-md min-w-40 transition-all',
					statusColor,
					selected &&
						'ring-2 ring-primary ring-offset-2 ring-offset-background',
				)}
			>
				{/* Colored header */}
				<div
					className="flex items-center gap-2 px-3 py-2 rounded-t-md"
					style={{ backgroundColor: `${d.color}20` }}
				>
					<span
						className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
						style={{ backgroundColor: d.color }}
					>
						{d.icon}
					</span>
					<span className="text-sm font-semibold text-foreground truncate">
						{d.label}
					</span>
					{/* Status dot */}
					{d.status && d.status !== 'idle' && (
						<span
							className={cn(
								'w-2 h-2 rounded-full ml-auto shrink-0',
								d.status === 'active' && 'bg-success animate-pulse',
								d.status === 'warning' && 'bg-warning animate-pulse',
								d.status === 'error' && 'bg-destructive animate-pulse',
							)}
						/>
					)}
				</div>

				{/* Body */}
				<div className="px-3 py-2 space-y-1.5">
					<p className="text-xs text-muted-foreground">{d.description}</p>

					{/* Live metrics (shown when simulation is running) */}
					{d.metrics && (
						<div className="space-y-1 pt-1 border-t border-border">
							{d.metrics.reqPerSec !== undefined && (
								<MetricRow label="req/s" value={d.metrics.reqPerSec} />
							)}
							{d.metrics.latency !== undefined && (
								<MetricRow
									label="latency"
									suffix="ms"
									value={d.metrics.latency}
								/>
							)}
							{d.metrics.hitRate !== undefined && (
								<MetricRow
									label="hit rate"
									suffix="%"
									value={d.metrics.hitRate}
								/>
							)}
							{d.metrics.queryCount !== undefined && (
								<MetricRow label="queries" value={d.metrics.queryCount} />
							)}
							{d.metrics.queueDepth !== undefined && (
								<MetricRow label="queue" value={d.metrics.queueDepth} />
							)}
							{d.metrics.threadsBusy !== undefined &&
								d.metrics.threadsTotal !== undefined && (
									<MetricRow
										label="threads"
										value={`${d.metrics.threadsBusy}/${d.metrics.threadsTotal}`}
									/>
								)}
							{d.metrics.blockedCount !== undefined && (
								<MetricRow
									label="blocked"
									value={d.metrics.blockedCount}
									warn
								/>
							)}
							{d.metrics.errorRate !== undefined && d.metrics.errorRate > 0 && (
								<MetricRow
									label="errors"
									suffix="%"
									value={d.metrics.errorRate}
									warn
								/>
							)}
						</div>
					)}
				</div>
			</div>
			<Handle className="w-2.5 h-2.5" position={Position.Right} type="source" />
		</>
	);
}

function MetricRow({
	label,
	value,
	suffix,
	warn,
}: {
	label: string;
	value: number | string;
	suffix?: string;
	warn?: boolean;
}) {
	const display =
		typeof value === 'number' ? `${Math.round(value)}${suffix ?? ''}` : value;
	return (
		<div className="flex items-center justify-between text-xs">
			<span className="text-muted-foreground">{label}</span>
			<span
				className={cn(
					'font-mono font-medium',
					warn ? 'text-destructive' : 'text-foreground',
				)}
			>
				{display}
			</span>
		</div>
	);
}
