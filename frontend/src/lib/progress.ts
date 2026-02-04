export type StackChoices = {
	database: 'postgres' | 'sqlite';
	frontend: 'react' | 'erb' | 'hotwire';
};

export type LevelProgressEntry = {
	stars: number;
	bestScore: number;
};

export type GuestProgress = {
	completedLevels: string[];
	levelProgress: Record<string, LevelProgressEntry>;
	stackChoices: StackChoices | null;
};

export type ProgressData = GuestProgress & {
	isGuest: boolean;
};

const GUEST_PROGRESS_KEY = 'railsexpert_progress_v1';

function loadGuestProgress(): GuestProgress {
	if (typeof window === 'undefined') {
		return { completedLevels: [], levelProgress: {}, stackChoices: null };
	}
	const raw = localStorage.getItem(GUEST_PROGRESS_KEY);
	if (!raw) {
		return { completedLevels: [], levelProgress: {}, stackChoices: null };
	}
	try {
		const parsed = JSON.parse(raw) as GuestProgress;
		return {
			completedLevels: parsed.completedLevels || [],
			levelProgress: parsed.levelProgress || {},
			stackChoices: parsed.stackChoices || null,
		};
	} catch {
		return { completedLevels: [], levelProgress: {}, stackChoices: null };
	}
}

function saveGuestProgress(data: GuestProgress) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(data));
}

export function clearGuestProgress() {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(GUEST_PROGRESS_KEY);
}

export function hasGuestProgress(): boolean {
	const data = loadGuestProgress();
	return data.completedLevels.length > 0;
}

export async function getProgress(): Promise<ProgressData> {
	try {
		const response = await fetch('/api/pipeline/progress', {
			credentials: 'include',
		});

		if (response.ok) {
			const json = await response.json();
			const completedLevels = json.data?.completedLevels || [];
			const levelProgress = json.data?.levelProgress || [];
			const stackChoices = json.data?.stackChoices || null;

			const progressMap: Record<string, LevelProgressEntry> = {};
			for (const entry of levelProgress) {
				progressMap[entry.levelId] = {
					stars: entry.stars,
					bestScore: entry.bestScore,
				};
			}

			return {
				completedLevels,
				levelProgress: progressMap,
				stackChoices,
				isGuest: false,
			};
		}

		if (response.status !== 401) {
			console.warn('Progress fetch failed:', response.status);
		}
	} catch (error) {
		console.warn('Progress fetch error:', error);
	}

	const guest = loadGuestProgress();
	return { ...guest, isGuest: true };
}

export async function completeLevel(options: {
	levelId: string;
	stars: number;
	finalStability: number;
	timeToComplete: number;
	finalMetrics: {
		avgLatency: number;
		queriesPerRequest: number;
		cacheHitRate: number;
		errorRate: number;
	};
	stackChoices?: StackChoices;
}): Promise<{ success: boolean; isGuest: boolean }> {
	try {
		const response = await fetch(
			`/api/pipeline/levels/${options.levelId}/complete`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					stars: options.stars,
					finalStability: options.finalStability,
					timeToComplete: options.timeToComplete,
					finalMetrics: options.finalMetrics,
					stackChoices: options.stackChoices,
				}),
			},
		);

		if (response.ok) {
			return { success: true, isGuest: false };
		}

		if (response.status !== 401) {
			console.warn('Server completion failed:', response.status);
		}
	} catch (error) {
		console.warn('Server completion error:', error);
	}

	const guest = loadGuestProgress();
	const existing = guest.levelProgress[options.levelId];
	const bestStars = Math.max(existing?.stars || 0, options.stars);
	const bestScore = Math.max(existing?.bestScore || 0, options.finalStability);

	if (!guest.completedLevels.includes(options.levelId)) {
		guest.completedLevels.push(options.levelId);
	}
	guest.levelProgress[options.levelId] = { stars: bestStars, bestScore };
	if (options.stackChoices) {
		guest.stackChoices = options.stackChoices;
	}

	saveGuestProgress(guest);
	return { success: true, isGuest: true };
}

export async function importGuestProgress(): Promise<{
	success: boolean;
	message?: string;
}> {
	const guest = loadGuestProgress();
	if (!guest.completedLevels.length) {
		return { success: false, message: 'No guest progress to import.' };
	}

	const response = await fetch('/api/pipeline/progress/import', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({
			completedLevels: guest.completedLevels,
			levelProgress: guest.levelProgress,
			stackChoices: guest.stackChoices,
		}),
	});

	if (response.ok) {
		clearGuestProgress();
		return { success: true };
	}

	const json = await response.json().catch(() => null);
	return {
		success: false,
		message: json?.error?.message || 'Failed to import guest progress.',
	};
}
