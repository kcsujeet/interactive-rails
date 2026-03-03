/**
 * useStressTest Hook
 *
 * Manages the reward phase stress-test mechanics.
 * Players fire different request scenarios at their solution
 * and watch results accumulate.
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
	/** Toggle auto-fire on/off. Only available after 3+ manual fires. */
	toggleAutoFire: () => void;
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
	const autoFireRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const autoFireIndexRef = useRef(0);
	const autoFireSpeedRef = useRef(2000);

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
			clearInterval(autoFireRef.current);
			autoFireRef.current = null;
		}
		setIsAutoFiring(false);
		autoFireSpeedRef.current = 2000;
		autoFireIndexRef.current = 0;
	}, []);

	const startAutoFire = useCallback(() => {
		if (!canAutoFire || scenarios.length === 0) return;

		setIsAutoFiring(true);
		autoFireIndexRef.current = 0;
		autoFireSpeedRef.current = 2000;

		let fireCount = 0;

		const tick = () => {
			const idx = autoFireIndexRef.current % scenarios.length;
			addResult(scenarios[idx].id);
			autoFireIndexRef.current++;
			fireCount++;

			// Escalate speed every 5 fires, down to 500ms minimum
			if (fireCount % 5 === 0 && autoFireSpeedRef.current > 500) {
				autoFireSpeedRef.current = Math.max(
					500,
					autoFireSpeedRef.current - 300,
				);
				// Restart interval with new speed
				if (autoFireRef.current) {
					clearInterval(autoFireRef.current);
				}
				autoFireRef.current = setInterval(tick, autoFireSpeedRef.current);
			}
		};

		autoFireRef.current = setInterval(tick, autoFireSpeedRef.current);
	}, [canAutoFire, scenarios, addResult]);

	const toggleAutoFire = useCallback(() => {
		if (isAutoFiring) {
			stopAutoFire();
		} else {
			startAutoFire();
		}
	}, [isAutoFiring, stopAutoFire, startAutoFire]);

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
				clearInterval(autoFireRef.current);
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
