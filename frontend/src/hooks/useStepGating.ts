/**
 * useStepGating Hook
 *
 * Multi-step level progression with wrong attempt tracking and star rating.
 * Steps progress linearly: locked → active → completed.
 * Star rating: 3 = 0 wrong, 2 = 1-2 wrong, 1 = 3+ wrong.
 */

import { useCallback, useMemo, useState } from 'react';

export interface StepDef {
	id: string;
	title: string;
}

export type StepStatus = 'locked' | 'active' | 'completed';

export interface Step extends StepDef {
	status: StepStatus;
}

export interface UseStepGatingReturn {
	steps: Step[];
	currentStep: number;
	completeStep: () => void;
	wrongAttempts: number;
	recordWrongAttempt: (feedback: string) => void;
	starRating: 1 | 2 | 3;
	lastFeedback: string | null;
	clearFeedback: () => void;
	isComplete: boolean;
}

export function useStepGating(stepDefs: StepDef[]): UseStepGatingReturn {
	const [currentStep, setCurrentStep] = useState(0);
	const [wrongAttempts, setWrongAttempts] = useState(0);
	const [lastFeedback, setLastFeedback] = useState<string | null>(null);

	const steps: Step[] = useMemo(
		() =>
			stepDefs.map((def, i) => ({
				...def,
				status:
					i < currentStep
						? 'completed'
						: i === currentStep
							? 'active'
							: 'locked',
			})),
		[stepDefs, currentStep],
	);

	const isComplete = currentStep >= stepDefs.length;

	const starRating: 1 | 2 | 3 = useMemo(() => {
		if (wrongAttempts === 0) return 3;
		if (wrongAttempts <= 2) return 2;
		return 1;
	}, [wrongAttempts]);

	const completeStep = useCallback(() => {
		setLastFeedback(null);
		setCurrentStep((prev) => Math.min(prev + 1, stepDefs.length));
	}, [stepDefs.length]);

	const recordWrongAttempt = useCallback((feedback: string) => {
		setWrongAttempts((prev) => prev + 1);
		setLastFeedback(feedback);
	}, []);

	const clearFeedback = useCallback(() => {
		setLastFeedback(null);
	}, []);

	return {
		steps,
		currentStep,
		completeStep,
		wrongAttempts,
		recordWrongAttempt,
		starRating,
		lastFeedback,
		clearFeedback,
		isComplete,
	};
}
