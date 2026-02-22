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
	User,
} from '../../../shared/types';

// In dev, use relative URL (proxied through Astro dev server for same-origin cookies)
// In prod, use the API domain
const API_URL = import.meta.env.DEV ? '' : 'https://api.interactiverails.com';

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

	const json: ApiResponse<T> = await response.json().catch(() => ({
		success: false,
		error: { code: 'PARSE_ERROR', message: 'Failed to parse response' },
	}));

	if (!response.ok || !json.success) {
		const errorMessage = json.error?.message || `HTTP ${response.status}`;
		const errorCode = json.error?.code || 'UNKNOWN_ERROR';
		throw new ApiError(errorMessage, errorCode, response.status);
	}

	return json.data as T;
}

export interface AuthResponse {
	user: User;
}

// Auth endpoints
export async function signup(
	email: string,
	username: string,
	password: string,
): Promise<AuthResponse> {
	return fetchApi('/api/auth/signup', {
		method: 'POST',
		body: JSON.stringify({ email, username, password }),
	});
}

export async function login(
	email: string,
	password: string,
): Promise<AuthResponse> {
	return fetchApi('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password }),
	});
}

export async function getMe(): Promise<{ user: User }> {
	return fetchApi('/api/auth/me');
}

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
