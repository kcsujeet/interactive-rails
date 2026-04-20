import { useCallback } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	LeftPanel,
	LevelHeader,
	RightPanel,
	type ValidateFn,
} from '@/components/levels';
import { PipelineFlow } from '@/components/levels/PipelineFlow';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import type { UseStressTestReturn } from '@/hooks/useStressTest';
import {
	rewardConnections,
	rewardIdleStages,
	SCENARIO_FRAMES,
} from './data/pipeline-stages';
import { STRESS_SCENARIOS } from './data/stress-scenarios';
import { usePipelineFrames } from './usePipelineFrames';

interface CodeFile {
	filename: string;
	language: string;
	code: string;
}

interface RewardPhaseProps {
	stressTest: UseStressTestReturn;
	codeFiles: CodeFile[];
	onValidate: ValidateFn;
	onComplete: () => void;
}

export function RewardPhase({
	stressTest,
	codeFiles,
	onValidate,
	onComplete,
}: RewardPhaseProps) {
	const { currentFrame, isPlaying, play } = usePipelineFrames();
	const stages = currentFrame?.stages ?? rewardIdleStages;

	const fireRequest = stressTest.fireRequest;
	const handleFire = useCallback(
		(scenarioId: string) => {
			const frames = SCENARIO_FRAMES[scenarioId];
			if (frames) play(frames);
			fireRequest(scenarioId);
		},
		[fireRequest, play],
	);

	const toggleAutoFire = stressTest.toggleAutoFire;
	const handleToggleAutoFire = useCallback(() => {
		toggleAutoFire(handleFire);
	}, [toggleAutoFire, handleFire]);

	return (
		<>
			<LeftPanel>
				<div className="p-4 border-b border-border">
					<h3 className="text-sm font-semibold text-foreground mb-2">Legend</h3>
					<p className="text-sm text-muted-foreground leading-relaxed">
						The proxy gates traffic on /up. Fire deploy scenarios and watch v2
						only receive traffic after a healthy response. Rollback is a tag
						swap, not a rebuild.
					</p>
				</div>
				<div className="p-4 grid grid-cols-2 gap-2">
					<div className="rounded-md border border-success/30 bg-success/5 p-3">
						<div className="text-xs text-muted-foreground">Allowed</div>
						<div className="text-2xl font-bold text-success">
							{stressTest.allowedCount}
						</div>
					</div>
					<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
						<div className="text-xs text-muted-foreground">Blocked</div>
						<div className="text-2xl font-bold text-destructive">
							{stressTest.blockedCount}
						</div>
					</div>
				</div>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Deployment"
					levelNumber={42}
					onComplete={onComplete}
					onReset={() => window.location.reload()}
					onValidate={onValidate}
				/>
				<div className="flex-1 flex flex-col bg-background overflow-auto">
					<div className="flex-1 p-6 min-h-[280px]">
						<PipelineFlow connections={rewardConnections} stages={stages} />
					</div>
					<div className="border-t border-border p-4">
						<StressTestPanel
							allowedCount={stressTest.allowedCount}
							blockedCount={stressTest.blockedCount}
							canAutoFire={stressTest.canAutoFire}
							disabled={isPlaying}
							isAutoFiring={stressTest.isAutoFiring}
							onFire={handleFire}
							onToggleAutoFire={handleToggleAutoFire}
							results={stressTest.results}
							scenarios={STRESS_SCENARIOS}
						/>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={codeFiles} />
			</RightPanel>
		</>
	);
}
