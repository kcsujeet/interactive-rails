/**
 * StressTestPanel Component
 *
 * Center panel component for the reward phase stress test.
 * Terminal-style layout matching ProbeTerminal: dark bg, traffic-light header,
 * scenario buttons in footer, results log in the scrollable body.
 */

import { Pause, Shield, Zap } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type { RequestResult, StressScenario } from '@/hooks/useStressTest';
import { cn } from '@/lib/utils';

interface StressTestPanelProps {
	scenarios: StressScenario[];
	results: RequestResult[];
	allowedCount: number;
	blockedCount: number;
	isAutoFiring: boolean;
	canAutoFire: boolean;
	onFire: (scenarioId: string) => void;
	onToggleAutoFire: (onFire: (scenarioId: string) => void) => void;
	/** Disable all fire buttons (e.g. while a flow animation is running) */
	disabled?: boolean;
	/** Additional CSS classes for the outer container */
	className?: string;
}

export function StressTestPanel({
	scenarios,
	results,
	allowedCount,
	blockedCount,
	isAutoFiring,
	canAutoFire,
	onFire,
	onToggleAutoFire,
	disabled = false,
	className,
}: StressTestPanelProps) {
	const recentResults = results.slice(-10);

	return (
		<div
			className={cn(
				'rounded-lg border border-border bg-zinc-50 dark:bg-zinc-900 overflow-hidden',
				className,
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border shrink-0">
				<div className="flex items-center gap-2">
					<div className="flex gap-1.5">
						<div className="w-3 h-3 rounded-full bg-red-500" />
						<div className="w-3 h-3 rounded-full bg-yellow-500" />
						<div className="w-3 h-3 rounded-full bg-green-500" />
					</div>
					<Shield className="w-3.5 h-3.5 text-muted-foreground ml-1" />
					<span className="text-xs text-muted-foreground font-mono">
						Stress Test
					</span>
				</div>

				{/* Inline counters */}
				<div className="flex items-center gap-3">
					<span className="text-xs font-mono">
						<span className="text-emerald-600 dark:text-emerald-400 font-bold">
							{allowedCount}
						</span>
						<span className="text-muted-foreground ml-1">allowed</span>
					</span>
					<span className="text-xs font-mono">
						<span className="text-red-600 dark:text-red-400 font-bold">
							{blockedCount}
						</span>
						<span className="text-muted-foreground ml-1">blocked</span>
					</span>
				</div>
			</div>

			{/* Results log: flex-fill when parent uses flex layout, bounded otherwise */}
			<div
				className={cn(
					'p-3 font-mono text-sm overflow-y-auto',
					className ? 'flex-1 min-h-0' : 'min-h-36 max-h-64',
				)}
			>
				{recentResults.length === 0 && (
					<div className="text-muted-foreground text-xs">
						Fire requests to stress-test your authorization...
					</div>
				)}

				{recentResults.map((result, i) => {
					const scenario = scenarios.find((s) => s.id === result.scenarioId);
					if (!scenario) return null;
					const isAllowed = result.result === 'allowed';
					return (
						<div
							className="py-0.5"
							key={`${result.scenarioId}-${result.timestamp}-${i}`}
						>
							<div className="flex items-center gap-2">
								<span
									className={`text-xs font-bold shrink-0 ${
										isAllowed
											? 'text-emerald-600 dark:text-emerald-400'
											: 'text-red-600 dark:text-red-400'
									}`}
								>
									{isAllowed ? '200' : '403'}
								</span>
								<span className="text-muted-foreground text-xs shrink-0">
									{scenario.method}
								</span>
								<span className="text-foreground text-xs truncate">
									{scenario.path}
								</span>
								<span className="text-muted-foreground/60 text-xs ml-auto shrink-0">
									{scenario.actor}
								</span>
							</div>
							{scenario.responseLines && (
								<div className="ml-8 mt-0.5 mb-1">
									{scenario.responseLines.map((line, j) => {
										const colorClass =
											line.color === 'green'
												? 'text-emerald-600 dark:text-emerald-400'
												: line.color === 'red'
													? 'text-red-600 dark:text-red-400'
													: line.color === 'yellow'
														? 'text-yellow-600 dark:text-yellow-400'
														: 'text-muted-foreground';
										return (
											<div
												className={`text-xs ${colorClass}`}
												key={`${result.scenarioId}-line-${j}`}
											>
												{line.text}
											</div>
										);
									})}
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Scenario buttons */}
			<div className="p-3 border-t border-border bg-muted/50 shrink-0">
				<div className="text-xs text-muted-foreground mb-2">
					Fire a request to test your policy:
				</div>
				<div className="flex flex-wrap gap-2">
					{scenarios.map((scenario) => (
						<Button
							className={`font-mono text-xs ${
								scenario.expectedResult === 'allowed'
									? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700/50'
									: 'bg-red-100 hover:bg-red-200 text-red-700 border-red-300 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 dark:border-red-700/50'
							}`}
							disabled={isAutoFiring || disabled}
							key={scenario.id}
							onClick={() => onFire(scenario.id)}
							size="sm"
							variant="outline"
						>
							{scenario.label}
						</Button>
					))}

					{/* Auto-fire toggle */}
					<Button
						className="gap-1.5"
						disabled={!canAutoFire || disabled}
						onClick={() => onToggleAutoFire(onFire)}
						size="sm"
						variant={isAutoFiring ? 'destructive' : 'outline'}
					>
						{isAutoFiring ? (
							<>
								<Pause className="w-3 h-3" />
								Stop
							</>
						) : (
							<>
								<Zap className="w-3 h-3" />
								Auto
								{!canAutoFire && (
									<span className="text-xs opacity-60">(3+)</span>
								)}
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
