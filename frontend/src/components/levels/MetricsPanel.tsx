/**
 * Metrics Panel Component
 *
 * Live metrics display extracted from NodePalette for reuse.
 */

import type { LiveMetrics } from '@/types/game';

interface MetricsPanelProps {
	liveMetrics: LiveMetrics;
	isPipelineBroken: boolean;
	breakReason: string | null;
}

export function MetricsPanel({
	liveMetrics,
	isPipelineBroken,
	breakReason,
}: MetricsPanelProps) {
	return (
		<div
			className={`rounded-lg p-4 border transition-all duration-300 ${
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
	);
}
