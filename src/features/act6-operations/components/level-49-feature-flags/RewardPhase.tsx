import { useMemo } from 'react';
import {
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import type { RequestResult, StressScenario } from '@/hooks/useStressTest';
import { SCENARIO_REWARD_OVERRIDES } from './data/pipeline-stages';

interface RewardPhaseProps {
	baseStages: PipelineStage[];
	connections: PipelineConnection[];
	scenarios: StressScenario[];
	results: RequestResult[];
	allowedCount: number;
	blockedCount: number;
	canAutoFire: boolean;
	isAutoFiring: boolean;
	lastResult: RequestResult | undefined;
	/** Bumped on every fire so PipelineFlow remounts its dot circles. */
	animationTick: number;
	onFire: (scenarioId: string) => void;
	onToggleAutoFire: (onFire: (scenarioId: string) => void) => void;
}

export function RewardPhase({
	baseStages,
	connections,
	scenarios,
	results,
	allowedCount,
	blockedCount,
	canAutoFire,
	isAutoFiring,
	lastResult,
	animationTick,
	onFire,
	onToggleAutoFire,
}: RewardPhaseProps) {
	const override = lastResult
		? SCENARIO_REWARD_OVERRIDES[lastResult.scenarioId]
		: null;

	const stages = useMemo<PipelineStage[]>(() => {
		if (!override) return baseStages;
		return baseStages.map((s) => {
			const stageOverride = override.stages[s.id];
			return stageOverride ? { ...s, ...stageOverride } : s;
		});
	}, [baseStages, override]);

	// Default to dormant ([]). Edges only animate after a stress scenario
	// fires. `undefined` would put PipelineFlow into continuous "idle"
	// mode and imply traffic is flowing before the player has fired
	// anything.
	const activeConnections = override?.activeConnections ?? [];

	return (
		<div className="flex-1 flex flex-col">
			<div className="flex-1 relative px-6 py-4">
				<PipelineFlow
					activeConnections={activeConnections}
					animationTick={animationTick}
					connections={connections}
					stages={stages}
				/>
			</div>

			<div className="px-6 pb-2">
				<StressTestPanel
					allowedCount={allowedCount}
					blockedCount={blockedCount}
					canAutoFire={canAutoFire}
					isAutoFiring={isAutoFiring}
					onFire={onFire}
					onToggleAutoFire={onToggleAutoFire}
					results={results}
					scenarios={scenarios}
				/>
			</div>
		</div>
	);
}
