/**
 * Level 49: Feature Flags & Staged Rollouts
 *
 * Sequential phase flow: observe -> build -> reward.
 *
 * Observe: pipeline shows the broken state (no Flag Gate, request goes
 *   straight to NewPaymentProcessor). Probes reveal coupled deploy/release,
 *   missing launch-time pinning, and missing kill switch.
 * Build: 5 steps. Two terminal (gem install, run installer + migrate),
 *   three OptionCard (wrap behind Flipper.enabled?, configure
 *   percentage_of_actors rollout, mount admin UI behind admin auth).
 * Reward: pipeline includes the Flag Gate; the gate's sublabel and the
 *   downstream paths' active/inactive variants react to the last fired
 *   stress scenario (full launch, gradual 5%, kill switch, beta opt-in).
 *
 * Teaches: Flipper, decoupling deploy from release, gradual rollout,
 * kill-switch operation, admin UI auth.
 */

import { useCallback, useMemo, useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	type ValidationResult,
} from '@/components/levels';
import type { StageInspectorData } from '@/components/levels/StageInspector';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';
import { BuildPhase } from './BuildPhase';
import { OPTION_STEP_CONFIG, STEP_DEFS } from './data/build-steps';
import { getCodeFiles } from './data/code-files';
import { DISCOVERY_DEFS } from './data/discoveries';
import {
	OBSERVE_CONNECTIONS,
	OBSERVE_STAGES,
	REWARD_CONNECTIONS,
	REWARD_STAGES,
	STAGE_DISCOVERY_MAP,
	STAGE_INSPECTOR_MAP,
} from './data/pipeline-stages';
import { PROBE_DISCOVERY_MAP, PROBES } from './data/probes';
import { STRESS_SCENARIOS } from './data/stress-scenarios';
import { LeftPanelContent } from './LeftPanelContent';
import { ObservePhase } from './ObservePhase';
import { RewardPhase } from './RewardPhase';
import type { Phase, StepOption } from './types';

export function Level50FeatureFlags({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);
	// Bumped on every probe fire so PipelineFlow re-keys its dot circles
	// and the SVG animations restart even when the same probe is fired
	// twice. Same idea for the reward phase (`fireTick` below).
	const [probeTick, setProbeTick] = useState(0);

	const lastResult = stressTest.results[stressTest.results.length - 1];

	const handleStageClick = useCallback(
		(stageId: string) => {
			if (phase !== 'observe') return;
			const data = STAGE_INSPECTOR_MAP[stageId];
			if (data) setInspectorData(data);
			setInspectedStages((prev) => {
				if (prev.has(stageId)) return prev;
				const next = new Set(prev);
				next.add(stageId);
				return next;
			});
			const discoveryId = STAGE_DISCOVERY_MAP[stageId];
			if (discoveryId) discoveryGating.discover(discoveryId);
		},
		[phase, discoveryGating],
	);

	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			setProbeTick((t) => t + 1);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) discoveryGating.discover(discoveryId);
		},
		[discoveryGating],
	);

	const handleOptionClick = useCallback(
		(option: StepOption) => {
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	const handleStartBuild = () => setPhase('build');

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
		},
		[stressTest],
	);

	const handleTransitionToReward = useCallback(() => {
		setPhase('reward');
		stressTest.reset();
	}, [stressTest]);

	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return { valid: true, message: 'Feature flags are wired and gated.' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	const shuffledOptions = useMemo(
		() =>
			currentOptionConfig
				? shuffleOptions(currentOptionConfig.options, stepper.currentStep)
				: [],
		[currentOptionConfig, stepper.currentStep],
	);

	const codePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep + 1
		: stepper.currentStep;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<LeftPanelContent
						discoveryGating={discoveryGating}
						phase={phase}
						stepper={stepper}
						stressAllowedCount={stressTest.allowedCount}
						stressBlockedCount={stressTest.blockedCount}
					/>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Feature Flags & Staged Rollouts"
					levelNumber={49}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>
				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{phase === 'observe' && (
						<ObservePhase
							animationTick={probeTick}
							baseStages={OBSERVE_STAGES}
							canStartBuild={discoveryGating.isUnlocked}
							connections={OBSERVE_CONNECTIONS}
							inspectedStages={inspectedStages}
							inspectorData={inspectorData}
							lastProbeId={lastProbeId}
							onCloseInspector={() => setInspectorData(null)}
							onProbe={handleProbe}
							onStageClick={handleStageClick}
							onStartBuild={handleStartBuild}
							probes={PROBES}
						/>
					)}

					{phase === 'build' && (
						<BuildPhase
							currentStep={stepper.currentStep}
							hasNextStep={hasNextStep}
							isViewingCompletedStep={isViewingCompletedStep}
							lastFeedback={stepper.lastFeedback}
							onClearFeedback={stepper.clearFeedback}
							onCorrectTerminal={() => stepper.completeStep()}
							onNextStep={stepper.nextStep}
							onOptionClick={handleOptionClick}
							onTransitionToReward={handleTransitionToReward}
							onWrongTerminal={(fb) => stepper.recordWrongAttempt(fb)}
							shuffledOptions={shuffledOptions}
						/>
					)}

					{phase === 'reward' && (
						<RewardPhase
							allowedCount={stressTest.allowedCount}
							animationTick={stressTest.results.length}
							baseStages={REWARD_STAGES}
							blockedCount={stressTest.blockedCount}
							canAutoFire={stressTest.canAutoFire}
							connections={REWARD_CONNECTIONS}
							isAutoFiring={stressTest.isAutoFiring}
							lastResult={lastResult}
							onFire={handleFireScenario}
							onToggleAutoFire={stressTest.toggleAutoFire}
							results={stressTest.results}
							scenarios={STRESS_SCENARIOS}
						/>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'reward' ? STEP_DEFS.length : codePreviewStep,
					)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level50FeatureFlags;
