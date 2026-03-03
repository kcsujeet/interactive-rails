/**
 * useDiscoveryGating Hook
 *
 * Tracks what the player has discovered during the observe phase.
 * Pure exploration gating: no wrong attempts, no auto-advance.
 * "Build the Fix" button appears when discoveredCount >= minRequired.
 */

import { useCallback, useMemo, useState } from 'react';

export interface DiscoveryDef {
	id: string;
	label: string;
}

export type DiscoveryStatus = 'hidden' | 'discovered';

export interface Discovery extends DiscoveryDef {
	status: DiscoveryStatus;
}

export interface UseDiscoveryGatingOptions {
	/** Minimum discoveries required to unlock the next phase. Defaults to all. */
	minRequired?: number;
}

export interface UseDiscoveryGatingReturn {
	discoveries: Discovery[];
	/** Number of discoveries found so far. */
	discoveredCount: number;
	/** Total number of discoveries defined. */
	totalRequired: number;
	/** Minimum required to unlock. */
	minRequired: number;
	/** Mark a discovery as found (idempotent). */
	discover: (id: string) => void;
	/** Check if a specific discovery has been found. */
	isDiscovered: (id: string) => boolean;
	/** True when discoveredCount >= minRequired. */
	isUnlocked: boolean;
}

export function useDiscoveryGating(
	defs: DiscoveryDef[],
	options?: UseDiscoveryGatingOptions,
): UseDiscoveryGatingReturn {
	const minRequired = options?.minRequired ?? defs.length;
	const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(new Set());

	const discoveries: Discovery[] = useMemo(
		() =>
			defs.map((def) => ({
				...def,
				status: discoveredIds.has(def.id) ? 'discovered' : 'hidden',
			})),
		[defs, discoveredIds],
	);

	const discoveredCount = discoveredIds.size;
	const isUnlocked = discoveredCount >= minRequired;

	const discover = useCallback((id: string) => {
		setDiscoveredIds((prev) => {
			if (prev.has(id)) return prev;
			const next = new Set(prev);
			next.add(id);
			return next;
		});
	}, []);

	const isDiscovered = useCallback(
		(id: string) => discoveredIds.has(id),
		[discoveredIds],
	);

	return {
		discoveries,
		discoveredCount,
		totalRequired: defs.length,
		minRequired,
		discover,
		isDiscovered,
		isUnlocked,
	};
}
