/**
 * Level 48: Deployment with Kamal
 *
 * Thin orchestrator. Holds phase state and hooks, hands them to the
 * per-phase components. See ObservePhase, BuildPhase, RewardPhase for the
 * actual UI, and ./data/* for static content (discoveries, probes, steps,
 * stress scenarios, pipeline stages, code previews).
 */

import { useMemo, useState } from 'react';
import type { ValidationResult } from '@/components/levels';
import { LevelLayout } from '@/components/levels';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { BuildPhase } from './BuildPhase';
import { STEP_DEFS } from './data/build-steps';
import { getCodeFiles } from './data/code-files';
import { DISCOVERY_DEFS } from './data/discoveries';
import { STRESS_SCENARIOS } from './data/stress-scenarios';
import { ObservePhase } from './ObservePhase';
import { RewardPhase } from './RewardPhase';

type Phase = 'observe' | 'build' | 'reward';

export function Level48Deployment({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);

	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	const completedStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	const codeFiles = useMemo(() => {
		if (phase === 'observe') return getCodeFiles('observe', 0);
		if (phase === 'reward') return getCodeFiles('reward', STEP_DEFS.length);
		return getCodeFiles('build', completedStep);
	}, [phase, completedStep]);

	const handleValidate = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all build steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return { valid: true, message: 'Kamal deployment configured. Ship it.' };
	};

	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	return (
		<LevelLayout>
			{phase === 'observe' && (
				<ObservePhase
					codeFiles={codeFiles}
					discoveryGating={discoveryGating}
					onAdvance={() => setPhase('build')}
					onComplete={handleComplete}
					onValidate={handleValidate}
				/>
			)}
			{phase === 'build' && (
				<BuildPhase
					codeFiles={codeFiles}
					onAdvance={() => setPhase('reward')}
					onComplete={handleComplete}
					onValidate={handleValidate}
					setWrongFeedback={setWrongFeedback}
					stepper={stepper}
					wrongFeedback={wrongFeedback}
				/>
			)}
			{phase === 'reward' && (
				<RewardPhase
					codeFiles={codeFiles}
					onComplete={handleComplete}
					onValidate={handleValidate}
					stressTest={stressTest}
				/>
			)}
		</LevelLayout>
	);
}

export default Level48Deployment;
