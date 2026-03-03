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

interface StressTestPanelProps {
	scenarios: StressScenario[];
	results: RequestResult[];
	allowedCount: number;
	blockedCount: number;
	isAutoFiring: boolean;
	canAutoFire: boolean;
	onFire: (scenarioId: string) => void;
	onToggleAutoFire: () => void;
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
}: StressTestPanelProps) {
	const recentResults = results.slice(-10);

	return (
		<div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700">
				<div className="flex items-center gap-2">
					<div className="flex gap-1.5">
						<div className="w-3 h-3 rounded-full bg-red-500" />
						<div className="w-3 h-3 rounded-full bg-yellow-500" />
						<div className="w-3 h-3 rounded-full bg-green-500" />
					</div>
					<Shield className="w-3.5 h-3.5 text-zinc-400 ml-1" />
					<span className="text-xs text-zinc-400 font-mono">
						Stress Test
					</span>
				</div>

				{/* Inline counters */}
				<div className="flex items-center gap-3">
					<span className="text-xs font-mono">
						<span className="text-emerald-400 font-bold">{allowedCount}</span>
						<span className="text-zinc-500 ml-1">allowed</span>
					</span>
					<span className="text-xs font-mono">
						<span className="text-red-400 font-bold">{blockedCount}</span>
						<span className="text-zinc-500 ml-1">blocked</span>
					</span>
				</div>
			</div>

			{/* Results log */}
			<div className="p-3 font-mono text-sm max-h-36 overflow-y-auto">
				{recentResults.length === 0 && (
					<div className="text-zinc-500 text-xs">
						Fire requests to stress-test your authorization...
					</div>
				)}

				{recentResults.map((result, i) => {
					const scenario = scenarios.find(
						(s) => s.id === result.scenarioId,
					);
					if (!scenario) return null;
					const isAllowed = result.result === 'allowed';
					return (
						<div
							className="flex items-center gap-2 py-0.5"
							key={`${result.scenarioId}-${result.timestamp}-${i}`}
						>
							<span
								className={`text-xs font-bold shrink-0 ${
									isAllowed ? 'text-emerald-400' : 'text-red-400'
								}`}
							>
								{isAllowed ? '200' : '403'}
							</span>
							<span className="text-zinc-500 text-xs shrink-0">
								{scenario.method}
							</span>
							<span className="text-zinc-300 text-xs truncate">
								{scenario.path}
							</span>
							<span className="text-zinc-600 text-xs ml-auto shrink-0">
								{scenario.actor}
							</span>
						</div>
					);
				})}
			</div>

			{/* Scenario buttons */}
			<div className="p-3 border-t border-zinc-700 bg-zinc-800/50">
				<div className="text-xs text-zinc-500 mb-2">
					Fire a request to test your policy:
				</div>
				<div className="flex flex-wrap gap-2">
					{scenarios.map((scenario) => (
						<Button
							className={`font-mono text-xs ${
								scenario.expectedResult === 'allowed'
									? 'bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 border-emerald-700/50'
									: 'bg-red-900/30 hover:bg-red-900/50 text-red-300 border-red-700/50'
							}`}
							disabled={isAutoFiring}
							key={scenario.id}
							onClick={() => onFire(scenario.id)}
							size="sm"
							variant="outline"
						>
							{scenario.method} {scenario.path} as {scenario.actor}
						</Button>
					))}

					{/* Auto-fire toggle */}
					<Button
						className="gap-1.5"
						disabled={!canAutoFire}
						onClick={onToggleAutoFire}
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
