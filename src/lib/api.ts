/**
 * API Client
 * Handles all API requests with proper error handling and response parsing
 */

import type {
	Achievement,
	Challenge,
	ChallengeResult,
	Dungeon,
	Progress,
	Realm,
} from '../../shared/types';

// Same-origin: API runs inside Astro via Cloudflare adapter
const API_URL = '';

interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
	};
	meta?: {
		requestId?: string;
		timestamp: string;
	};
}

class ApiError extends Error {
	constructor(
		message: string,
		public code: string,
		public statusCode: number,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

async function fetchApi<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	const response = await fetch(`${API_URL}${endpoint}`, {
		...options,
		credentials: 'include', // Send cookies with requests
		headers: {
			'Content-Type': 'application/json',
			...options.headers,
		},
	});

	const json: ApiResponse<T> = (await response.json().catch(() => ({
		success: false,
		error: { code: 'PARSE_ERROR', message: 'Failed to parse response' },
	}))) as ApiResponse<T>;

	if (!response.ok || !json.success) {
		const errorMessage = json.error?.message || `HTTP ${response.status}`;
		const errorCode = json.error?.code || 'UNKNOWN_ERROR';
		throw new ApiError(errorMessage, errorCode, response.status);
	}

	return json.data as T;
}

// Auth is handled by Better Auth client (see @/lib/auth-client.ts)

// Game endpoints
export async function getRealms(): Promise<{ realms: Realm[] }> {
	return fetchApi('/api/game/realms');
}

export async function getLevels(realmId: string): Promise<{
	realm: { id: string; name: string; description: string };
	levels: Dungeon[];
}> {
	return fetchApi(`/api/game/realms/${realmId}/levels`);
}

export async function getChallenges(
	levelId: string,
): Promise<{ levelId: string; challenges: Challenge[] }> {
	return fetchApi(`/api/game/levels/${levelId}/challenges`);
}

// Backwards compatibility
/** @deprecated Use getLevels instead */
export const getDungeons = getLevels;

export async function submitAnswer(
	challengeId: string,
	answer: string,
	timeTakenMs: number,
): Promise<ChallengeResult> {
	return fetchApi(`/api/game/challenges/${challengeId}/attempt`, {
		method: 'POST',
		body: JSON.stringify({ answer, timeTakenMs }),
	});
}

// Progress endpoints
export async function getProgress(): Promise<Progress> {
	return fetchApi('/api/progress');
}

export async function getAchievements(): Promise<{
	achievements: Achievement[];
}> {
	return fetchApi('/api/progress/achievements');
}

export async function restoreHp(): Promise<{
	currentHp: number;
	maxHp: number;
}> {
	return fetchApi('/api/progress/restore-hp', { method: 'POST' });
}
