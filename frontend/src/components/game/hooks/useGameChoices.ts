/**
 * Game Choices Hook
 *
 * Persists Level 1 technology choices (database, frontend)
 * and tracks constraints that affect future levels.
 */

import { useCallback, useEffect, useState } from 'react';
import type { GameChoices } from '../types';

const STORAGE_KEY = 'rails-expert-game-choices';

const DEFAULT_CHOICES: GameChoices = {
	database: null,
	frontend: null,
	constraints: {
		apiOnly: false,
		canShard: false,
	},
};

export interface UseGameChoicesReturn {
	choices: GameChoices;
	setDatabase: (db: 'postgresql' | 'sqlite') => void;
	setFrontend: (fe: 'react' | 'hotwire') => void;
	isChoicesComplete: boolean;
	canShard: boolean;
	isApiOnly: boolean;
	resetChoices: () => void;
}

export function useGameChoices(): UseGameChoicesReturn {
	const [choices, setChoices] = useState<GameChoices>(DEFAULT_CHOICES);

	// Load from localStorage on mount
	useEffect(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as GameChoices;
				setChoices(parsed);
			}
		} catch (e) {
			console.error('Failed to load game choices:', e);
		}
	}, []);

	// Save to localStorage when choices change
	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
		} catch (e) {
			console.error('Failed to save game choices:', e);
		}
	}, [choices]);

	const setDatabase = useCallback((db: 'postgresql' | 'sqlite') => {
		setChoices((prev) => ({
			...prev,
			database: db,
			constraints: {
				...prev.constraints,
				canShard: db === 'postgresql', // Only PostgreSQL can shard
			},
		}));
	}, []);

	const setFrontend = useCallback((fe: 'react' | 'hotwire') => {
		setChoices((prev) => ({
			...prev,
			frontend: fe,
			constraints: {
				...prev.constraints,
				apiOnly: fe === 'react', // React requires API-only mode
			},
		}));
	}, []);

	const resetChoices = useCallback(() => {
		setChoices(DEFAULT_CHOICES);
		localStorage.removeItem(STORAGE_KEY);
	}, []);

	const isChoicesComplete =
		choices.database !== null && choices.frontend !== null;

	return {
		choices,
		setDatabase,
		setFrontend,
		isChoicesComplete,
		canShard: choices.constraints.canShard,
		isApiOnly: choices.constraints.apiOnly,
		resetChoices,
	};
}

export default useGameChoices;
