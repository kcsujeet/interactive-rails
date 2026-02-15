/**
 * useStepGating Hook
 *
 * Multi-step level progression with wrong attempt tracking and star rating.
 * Steps progress linearly: locked → active → completed.
 * Star rating: 3 = 0 wrong, 2 = 1-2 wrong, 1 = 3+ wrong.
 *
 * With autoAdvance (default): completing a step auto-advances to the next.
 * Without autoAdvance: users navigate manually via goToStep/nextStep.
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

export interface UseStepGatingOptions {
	/** When false, completing a step does NOT auto-advance — user navigates manually. Default: true. */
	autoAdvance?: boolean;
}

export interface UseStepGatingReturn {
	steps: Step[];
	/** The step currently being viewed. */
	currentStep: number;
	/** The furthest step the user has unlocked. */
	furthestStep: number;
	completeStep: () => void;
	goToStep: (index: number) => void;
	/** Advance to the next step (only if current step is completed). */
	nextStep: () => void;
	wrongAttempts: number;
	recordWrongAttempt: (feedback: string) => void;
	starRating: 1 | 2 | 3;
	lastFeedback: string | null;
	clearFeedback: () => void;
	isComplete: boolean;
	/** Whether the currently viewed step has been completed. */
	isCurrentStepCompleted: boolean;
}

export function useStepGating(
	stepDefs: StepDef[],
	options?: UseStepGatingOptions,
): UseStepGatingReturn {
	const autoAdvance = options?.autoAdvance ?? true;
	const [viewingStep, setViewingStep] = useState(0);
	const [furthestStep, setFurthestStep] = useState(0);
	const [wrongAttempts, setWrongAttempts] = useState(0);
	const [lastFeedback, setLastFeedback] = useState<string | null>(null);

	const steps: Step[] = useMemo(
		() =>
			stepDefs.map((def, i) => ({
				...def,
				status:
					i < furthestStep
						? 'completed'
						: i === furthestStep
							? 'active'
							: 'locked',
			})),
		[stepDefs, furthestStep],
	);

	const isComplete = furthestStep >= stepDefs.length;
	const isCurrentStepCompleted = viewingStep < furthestStep;

	const starRating: 1 | 2 | 3 = useMemo(() => {
		if (wrongAttempts === 0) return 3;
		if (wrongAttempts <= 2) return 2;
		return 1;
	}, [wrongAttempts]);

	const completeStep = useCallback(() => {
		setLastFeedback(null);
		setFurthestStep((prev) => {
			const next = Math.min(prev + 1, stepDefs.length);
			if (autoAdvance) {
				setViewingStep(Math.min(next, stepDefs.length - 1));
			}
			return next;
		});
	}, [stepDefs.length, autoAdvance]);

	const goToStep = useCallback(
		(index: number) => {
			if (index >= 0 && index <= Math.min(furthestStep, stepDefs.length - 1)) {
				setViewingStep(index);
				setLastFeedback(null);
			}
		},
		[furthestStep, stepDefs.length],
	);

	const nextStep = useCallback(() => {
		if (viewingStep < furthestStep && viewingStep < stepDefs.length - 1) {
			setViewingStep(viewingStep + 1);
			setLastFeedback(null);
		}
	}, [viewingStep, furthestStep, stepDefs.length]);

	const recordWrongAttempt = useCallback((feedback: string) => {
		setWrongAttempts((prev) => prev + 1);
		setLastFeedback(feedback);
	}, []);

	const clearFeedback = useCallback(() => {
		setLastFeedback(null);
	}, []);

	return {
		steps,
		currentStep: viewingStep,
		furthestStep,
		completeStep,
		goToStep,
		nextStep,
		wrongAttempts,
		recordWrongAttempt,
		starRating,
		lastFeedback,
		clearFeedback,
		isComplete,
		isCurrentStepCompleted,
	};
}
