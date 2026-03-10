/**
 * useStressTest Hook
 *
 * Manages the reward phase stress-test mechanics.
 * Players fire different request scenarios at their solution
 * and watch results accumulate.
 *
 * Auto-fire cycles through all scenarios once, calling the same onFire
 * callback as manual fires so animations trigger correctly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface StressScenario {
	id: string;
	label: string;
	description: string;
	method: string;
	path: string;
	actor: string;
	expectedResult: 'allowed' | 'blocked';
	/** Optional terminal-style response lines shown in the results log after firing. */
	responseLines?: { text: string; color?: string }[];
}

export interface RequestResult {
	scenarioId: string;
	result: 'allowed' | 'blocked';
	timestamp: number;
}

export interface UseStressTestReturn {
	results: RequestResult[];
	allowedCount: number;
	blockedCount: number;
	/** Whether auto-fire is currently cycling through scenarios. */
	isAutoFiring: boolean;
	/** Fire a specific scenario. Returns the result. */
	fireRequest: (scenarioId: string) => RequestResult;
	/**
	 * Toggle auto-fire on/off. Pass the same onFire handler used for manual
	 * fires so animations trigger during auto-fire. Auto-fire cycles through
	 * all scenarios once, then stops.
	 */
	toggleAutoFire: (onFire: (scenarioId: string) => void) => void;
	/** Whether auto-fire can be enabled (3+ manual fires). */
	canAutoFire: boolean;
	/** Clear all results and counters. */
	reset: () => void;
	/** Total manual fires (used to gate auto-fire). */
	manualFireCount: number;
}

export function useStressTest(
	scenarios: StressScenario[],
): UseStressTestReturn {
	const [results, setResults] = useState<RequestResult[]>([]);
	const [allowedCount, setAllowedCount] = useState(0);
	const [blockedCount, setBlockedCount] = useState(0);
	const [manualFireCount, setManualFireCount] = useState(0);
	const [isAutoFiring, setIsAutoFiring] = useState(false);
	const autoFireRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const autoFireIndexRef = useRef(0);
	const autoFireSpeedRef = useRef(1200);
	const onFireRef = useRef<((scenarioId: string) => void) | null>(null);

	const canAutoFire = manualFireCount >= 3;

	const addResult = useCallback(
		(scenarioId: string): RequestResult => {
			const scenario = scenarios.find((s) => s.id === scenarioId);
			if (!scenario) {
				throw new Error(`Unknown scenario: ${scenarioId}`);
			}

			const result: RequestResult = {
				scenarioId,
				result: scenario.expectedResult,
				timestamp: Date.now(),
			};

			setResults((prev) => [...prev.slice(-49), result]);

			if (scenario.expectedResult === 'allowed') {
				setAllowedCount((c) => c + 1);
			} else {
				setBlockedCount((c) => c + 1);
			}

			return result;
		},
		[scenarios],
	);

	const fireRequest = useCallback(
		(scenarioId: string): RequestResult => {
			setManualFireCount((c) => c + 1);
			return addResult(scenarioId);
		},
		[addResult],
	);

	const stopAutoFire = useCallback(() => {
		if (autoFireRef.current) {
			clearTimeout(autoFireRef.current);
			autoFireRef.current = null;
		}
		onFireRef.current = null;
		setIsAutoFiring(false);
		autoFireSpeedRef.current = 1200;
		autoFireIndexRef.current = 0;
	}, []);

	const startAutoFire = useCallback(
		(onFire: (scenarioId: string) => void) => {
			if (!canAutoFire || scenarios.length === 0) return;

			setIsAutoFiring(true);
			autoFireIndexRef.current = 0;
			autoFireSpeedRef.current = 1200;
			onFireRef.current = onFire;

			const tick = () => {
				const idx = autoFireIndexRef.current;

				// Stop after cycling through all scenarios once
				if (idx >= scenarios.length) {
					stopAutoFire();
					return;
				}

				// Delegate to the same handler as manual fire
				onFireRef.current?.(scenarios[idx].id);
				autoFireIndexRef.current++;

				// Schedule next tick (escalate speed as we go)
				if (autoFireIndexRef.current < scenarios.length) {
					autoFireSpeedRef.current = Math.max(
						600,
						autoFireSpeedRef.current - 100,
					);
					autoFireRef.current = setTimeout(
						tick,
						autoFireSpeedRef.current,
					);
				} else {
					// Final scenario just fired, stop after a brief delay
					autoFireRef.current = setTimeout(stopAutoFire, 500);
				}
			};

			// Fire the first one immediately, then schedule the rest
			tick();
		},
		[canAutoFire, scenarios, stopAutoFire],
	);

	const toggleAutoFire = useCallback(
		(onFire: (scenarioId: string) => void) => {
			if (isAutoFiring) {
				stopAutoFire();
			} else {
				startAutoFire(onFire);
			}
		},
		[isAutoFiring, stopAutoFire, startAutoFire],
	);

	const reset = useCallback(() => {
		stopAutoFire();
		setResults([]);
		setAllowedCount(0);
		setBlockedCount(0);
		setManualFireCount(0);
	}, [stopAutoFire]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (autoFireRef.current) {
				clearTimeout(autoFireRef.current);
			}
		};
	}, []);

	return {
		results,
		allowedCount,
		blockedCount,
		isAutoFiring,
		fireRequest,
		toggleAutoFire,
		canAutoFire,
		reset,
		manualFireCount,
	};
}
