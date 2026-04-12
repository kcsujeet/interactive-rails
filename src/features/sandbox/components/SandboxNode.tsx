/**
 * Sandbox-specific React Flow node.
 * Wraps the shared FlowNode with live metrics display.
 */

import type { NodeProps } from '@xyflow/react';
import { FlowNode } from '@/components/levels/FlowNode';
import { cn } from '@/lib/utils';
import type { SandboxNode as SandboxNodeType } from '../utils/sandbox-layout';

export function SandboxNode({ data, selected }: NodeProps<SandboxNodeType>) {
	return (
		<FlowNode data={data} selected={selected}>
			{data.metrics && (
				<div className="space-y-1 pt-1 border-t border-border">
					{data.metrics.reqPerSec !== undefined && (
						<MetricRow label="req/s" value={data.metrics.reqPerSec} />
					)}
					{data.metrics.latency !== undefined && (
						<MetricRow
							label="latency"
							suffix="ms"
							value={data.metrics.latency}
						/>
					)}
					{data.metrics.hitRate !== undefined && (
						<MetricRow
							label="hit rate"
							suffix="%"
							value={data.metrics.hitRate}
						/>
					)}
					{data.metrics.queryCount !== undefined && (
						<MetricRow label="queries" value={data.metrics.queryCount} />
					)}
					{data.metrics.queueDepth !== undefined && (
						<MetricRow label="queue" value={data.metrics.queueDepth} />
					)}
					{data.metrics.threadsBusy !== undefined &&
						data.metrics.threadsTotal !== undefined && (
							<MetricRow
								label="threads"
								value={`${data.metrics.threadsBusy}/${data.metrics.threadsTotal}`}
							/>
						)}
					{data.metrics.blockedCount !== undefined && (
						<MetricRow
							label="blocked"
							value={data.metrics.blockedCount}
							warn
						/>
					)}
					{data.metrics.errorRate !== undefined && data.metrics.errorRate > 0 && (
						<MetricRow
							label="errors"
							suffix="%"
							value={data.metrics.errorRate}
							warn
						/>
					)}
				</div>
			)}
		</FlowNode>
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
