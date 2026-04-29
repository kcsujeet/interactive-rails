/**
 * Level 11: Callbacks & Normalizations
 *
 * Sequential phase flow: observe -> build -> reward
 * - Observe: Click pipeline stages and fire data probes to discover the missing
 *   normalizes/callback layers. Discovery gating controls when "Build the Fix" appears.
 * - Build: 4 OptionCard steps (normalize, add callback, order callbacks, avoid pitfall).
 * - Reward: Stress test the working pipeline.
 *
 * Teaches: Rails 8 normalizes, after_create, callback ordering, after_commit.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
	OBSERVE_FLOW,
	REWARD_FLOW,
	STAGE_DISCOVERY_MAP,
	STAGE_INSPECTOR_MAP,
} from './data/pipeline-stages';
import { PROBE_DISCOVERY_MAP, PROBE_PIPELINE_MAP, PROBES } from './data/probes';
import { STRESS_SCENARIOS } from './data/stress-scenarios';
import { LeftPanelContent } from './LeftPanelContent';
import { ObservePhase } from './ObservePhase';
import { RewardPhase } from './RewardPhase';
import type { Phase, StepOption } from './types';

export function Level11Callbacks({ onComplete }: LevelComponentProps) {
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

	const probeDisplay = lastProbeId ? PROBE_PIPELINE_MAP[lastProbeId] : null;

	const lastResult = stressTest.results[stressTest.results.length - 1];
	const lastScenario = lastResult
		? (STRESS_SCENARIOS.find((s) => s.id === lastResult.scenarioId) ?? null)
		: null;
	const wasBlocked = lastResult?.result === 'blocked';

	// ── Flow animation state ──
	const [flowPhase, setFlowPhase] = useState(-1);
	const [flowMessages, setFlowMessages] = useState<string[]>([]);
	const flowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearFlow = useCallback(() => {
		for (const t of flowTimeoutsRef.current) clearTimeout(t);
		flowTimeoutsRef.current = [];
	}, []);

	const runFlow = useCallback(
		(messages: string[]) => {
			clearFlow();
			setFlowMessages(messages);
			const totalPhases = messages.length * 2 - 1;
			const delay = 1500;

			setFlowPhase(0);

			for (let p = 1; p <= totalPhases; p++) {
				const t = setTimeout(() => {
					setFlowPhase(p);
				}, delay * p);
				flowTimeoutsRef.current.push(t);
			}

			const endT = setTimeout(
				() => {
					setFlowPhase(-1);
				},
				delay * (totalPhases + 2),
			);
			flowTimeoutsRef.current.push(endT);
		},
		[clearFlow],
	);

	useEffect(() => {
		return () => clearFlow();
	}, [clearFlow]);

	const handleStageClick = useCallback(
		(stageId: string) => {
			if (phase !== 'observe') return;
			const data = STAGE_INSPECTOR_MAP[stageId];
			if (!data) return;
			setInspectorData(data);
			setInspectedStages((prev) => {
				if (prev.has(stageId)) return prev;
				const next = new Set(prev);
				next.add(stageId);
				return next;
			});
			const discoveryId = STAGE_DISCOVERY_MAP[stageId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, discoveryGating],
	);

	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
			const messages = OBSERVE_FLOW[probeId];
			if (messages) runFlow(messages);
			setInspectedStages(
				new Set(['input', 'normalizes', 'model', 'callbacks']),
			);
		},
		[discoveryGating, runFlow],
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
			const messages = REWARD_FLOW[scenarioId];
			if (messages) runFlow(messages);
		},
		[stressTest, runFlow],
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
		return { valid: true, message: 'Callbacks and normalizations configured!' };
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
		? stepper.currentStep
		: stepper.currentStep - 1;

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
					actNumber={2}
					levelName="Callbacks & Normalizations"
					levelNumber={11}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{phase === 'observe' && (
						<ObservePhase
							canStartBuild={discoveryGating.isUnlocked}
							flowMessages={flowMessages}
							flowPhase={flowPhase}
							inspectedStages={inspectedStages}
							inspectorData={inspectorData}
							lastProbeId={lastProbeId}
							onCloseInspector={() => setInspectorData(null)}
							onProbe={handleProbe}
							onStageClick={handleStageClick}
							onStartBuild={handleStartBuild}
							probeDisplay={probeDisplay}
							probes={PROBES}
						/>
					)}

					{phase === 'build' && (
						<BuildPhase
							currentOptionConfig={currentOptionConfig}
							hasNextStep={hasNextStep}
							isViewingCompletedStep={isViewingCompletedStep}
							lastFeedback={stepper.lastFeedback}
							onClearFeedback={stepper.clearFeedback}
							onNextStep={stepper.nextStep}
							onOptionClick={handleOptionClick}
							onTransitionToReward={handleTransitionToReward}
							shuffledOptions={shuffledOptions}
						/>
					)}

					{phase === 'reward' && (
						<RewardPhase
							allowedCount={stressTest.allowedCount}
							blockedCount={stressTest.blockedCount}
							canAutoFire={stressTest.canAutoFire}
							flowMessages={flowMessages}
							flowPhase={flowPhase}
							isAutoFiring={stressTest.isAutoFiring}
							lastResult={lastResult}
							lastScenario={lastScenario}
							onFire={handleFireScenario}
							onToggleAutoFire={stressTest.toggleAutoFire}
							results={stressTest.results}
							scenarios={STRESS_SCENARIOS}
							wasBlocked={wasBlocked}
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

export default Level11Callbacks;
