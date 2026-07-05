/**
 * Level 15: Callbacks & Normalizations
 *
 * Sequential phase flow: observe -> build -> reward
 * - Observe: Customer Impact Dashboard. Two customer-facing surfaces
 *   (storefront search, signup confirmation) stay clean idle. Each probe
 *   paints damage on the matching surface plus an incident-log entry, so
 *   the player sees the customer-visible cost (empty results, duplicate
 *   accounts) before the build phase introduces the fix.
 * - Build: 2 OptionCard steps:
 *     0. Normalize the Product name (positive callback example).
 *     1. Send the welcome email from the controller (negative callback
 *        example -- "side effect, not callback").
 * - Reward: Same dashboard. With the fix, the customer-facing surfaces
 *   stay clean across every scenario. A toast describes each catch.
 *
 * Teaches the rule "callbacks: normalization only, side effects elsewhere"
 * via one positive and one negative example. (See pedagogy.md case study
 * "L15 tightening: off-concept step + duplicate-lesson step" for why the
 * status-enum + external-sync steps were dropped.)
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
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';
import { BuildPhase } from './BuildPhase';
import { OPTION_STEP_CONFIG, STEP_DEFS } from './data/build-steps';
import { getCodeFiles } from './data/code-files';
import { DISCOVERY_DEFS } from './data/discoveries';
import { PROBE_DISCOVERY_MAP, PROBES } from './data/probes';
import { STRESS_SCENARIOS } from './data/stress-scenarios';
import { LeftPanelContent } from './LeftPanelContent';
import { ObservePhase } from './ObservePhase';
import { RewardPhase } from './RewardPhase';
import type { Phase, StepOption } from './types';

export function Level15Callbacks({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);

	// ── Observe-phase damage state ──
	// The dashboard paints the customer-visible damage of whichever probe
	// fired most recently. Pre-fire it shows the clean idle state.
	const observeDamage = useMemo(() => {
		if (!lastProbeId) return null;
		const probe = PROBES.find((p) => p.id === lastProbeId);
		return probe?.damage ?? null;
	}, [lastProbeId]);

	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
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
					actNumber={3}
					levelName="Callbacks & Normalizations"
					levelNumber={15}
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
							damage={observeDamage}
							onProbe={handleProbe}
							onStartBuild={handleStartBuild}
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
							isAutoFiring={stressTest.isAutoFiring}
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

export default Level15Callbacks;
