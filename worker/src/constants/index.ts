/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values
 */

export const GAME = {
	XP: {
		BASE: 100,
		LEVEL_MULTIPLIER: 1.5,
	},
	HP: {
		BASE: 100,
		PER_LEVEL: 10,
		WRONG_ANSWER_BASE: 10,
		WRONG_ANSWER_PER_DIFFICULTY: 5,
	},
	DAMAGE: {
		BASE: 20,
		PER_DIFFICULTY: 10,
		SPEED_MULTIPLIERS: {
			CRITICAL: { threshold: 5000, multiplier: 2 },
			FAST: { threshold: 10000, multiplier: 1.5 },
			NORMAL: { threshold: 20000, multiplier: 1.2 },
		},
	},
	TIME_BONUS: {
		FAST: { threshold: 10000, multiplier: 1.5 },
		NORMAL: { threshold: 20000, multiplier: 1.2 },
	},
	MAX_LEVEL: 100,
} as const;

export const AUTH = {
	COOKIE: {
		NAME: 'railsexpert_session',
		MAX_AGE_SECONDS: 60 * 60 * 24 * 7, // 7 days
	},
	JWT: {
		EXPIRY_SECONDS: 60 * 60 * 24 * 7, // 7 days
	},
	PASSWORD: {
		MIN_LENGTH: 8,
		PBKDF2_ITERATIONS: 100000,
		SALT_BYTES: 16,
		HASH_BITS: 256,
	},
	RATE_LIMIT: {
		AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
		AUTH_MAX_REQUESTS: 10,
		GENERAL_WINDOW_MS: 60 * 1000, // 1 minute
		GENERAL_MAX_REQUESTS: 100,
	},
} as const;

export const API = {
	PAGINATION: {
		DEFAULT_LIMIT: 20,
		MAX_LIMIT: 100,
	},
} as const;

export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	NO_CONTENT: 204,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_ERROR: 500,
} as const;
