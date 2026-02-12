/**
 * Use Level Completion Hook
 *
 * Common completion logic for all levels - API calls, localStorage, navigation.
 */

import { useCallback, useState } from 'react';

interface CompletionData {
	stars: number;
	finalStability?: number;
	timeToComplete?: number;
	stackChoices?: {
		database?: 'postgresql' | 'sqlite';
	};
	finalMetrics?: {
		avgLatency?: number;
		queriesPerRequest?: number;
		cacheHitRate?: number;
		errorRate?: number;
	};
	decisions?: Record<string, string>;
}

interface UseLevelCompletionReturn {
	isCompleting: boolean;
	completionError: string | null;
	completeLevel: (levelId: string, data: CompletionData) => Promise<boolean>;
}

export function useLevelCompletion(): UseLevelCompletionReturn {
	const [isCompleting, setIsCompleting] = useState(false);
	const [completionError, setCompletionError] = useState<string | null>(null);

	const completeLevel = useCallback(
		async (levelId: string, data: CompletionData): Promise<boolean> => {
			setIsCompleting(true);
			setCompletionError(null);

			try {
				// Save any stack choices to localStorage for future levels
				if (data.stackChoices) {
					const existingChoices = localStorage.getItem(
						'rails-expert-game-choices',
					);
					const choices = existingChoices ? JSON.parse(existingChoices) : {};

					const updatedChoices = {
						...choices,
						database: data.stackChoices.database || choices.database,
						constraints: {
							canShard:
								(data.stackChoices.database || choices.database) ===
								'postgresql',
						},
					};

					localStorage.setItem(
						'rails-expert-game-choices',
						JSON.stringify(updatedChoices),
					);
				}

				// Save any decisions to localStorage
				if (data.decisions) {
					const existingDecisions = localStorage.getItem(
						'rails-expert-level-decisions',
					);
					const decisions = existingDecisions
						? JSON.parse(existingDecisions)
						: {};

					const updatedDecisions = {
						...decisions,
						[levelId]: data.decisions,
					};

					localStorage.setItem(
						'rails-expert-level-decisions',
						JSON.stringify(updatedDecisions),
					);
				}

				// Call the backend API to save completion
				const response = await fetch(
					`/api/pipeline/levels/${levelId}/complete`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						credentials: 'include',
						body: JSON.stringify({
							stars: data.stars,
							finalStability: data.finalStability ?? 100,
							timeToComplete: data.timeToComplete ?? 300,
							stackChoices: data.stackChoices,
							finalMetrics: data.finalMetrics ?? {
								avgLatency: 50,
								queriesPerRequest: 3,
								cacheHitRate: 80,
								errorRate: 0,
							},
						}),
					},
				);

				if (!response.ok) {
					throw new Error(`Server error: ${response.status}`);
				}

				return true;
			} catch (err) {
				console.error('Failed to complete level:', err);
				setCompletionError(
					err instanceof Error ? err.message : 'Failed to save completion',
				);
				return false;
			} finally {
				setIsCompleting(false);
			}
		},
		[],
	);

	return {
		isCompleting,
		completionError,
		completeLevel,
	};
}

// Helper to get game choices from localStorage
export function getGameChoices() {
	try {
		const stored = localStorage.getItem('rails-expert-game-choices');
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (e) {
		console.error('Failed to load game choices:', e);
	}
	return {
		database: null,
		constraints: {
			canShard: false,
		},
	};
}

// Helper to get level decisions from localStorage
export function getLevelDecisions(levelId: string): Record<string, string> {
	try {
		const stored = localStorage.getItem('rails-expert-level-decisions');
		if (stored) {
			const all = JSON.parse(stored);
			return all[levelId] || {};
		}
	} catch (e) {
		console.error('Failed to load level decisions:', e);
	}
	return {};
}

// Helper to check if a level constraint is met
export function checkConstraint(constraint: 'canShard'): boolean {
	const choices = getGameChoices();
	return choices.constraints?.[constraint] ?? false;
}

export default useLevelCompletion;
