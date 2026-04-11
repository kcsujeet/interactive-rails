/**
 * Centralized error handling
 * Provides typed errors and consistent error responses
 */

import { HTTP_STATUS } from '../constants';

export type ErrorCode =
	| 'VALIDATION_ERROR'
	| 'UNAUTHORIZED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'RATE_LIMITED'
	| 'INTERNAL_ERROR';

export class AppError extends Error {
	public readonly statusCode: number;
	public readonly code: ErrorCode;
	public readonly isOperational: boolean;

	constructor(
		statusCode: number,
		code: ErrorCode,
		message: string,
		isOperational = true,
	) {
		super(message);
		this.statusCode = statusCode;
		this.code = code;
		this.isOperational = isOperational;

		// Maintains proper stack trace for where error was thrown
		Error.captureStackTrace?.(this, this.constructor);
	}
}

export class ValidationError extends AppError {
	constructor(message: string) {
		super(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', message);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = 'Authentication required') {
		super(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED', message);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = 'Access denied') {
		super(HTTP_STATUS.FORBIDDEN, 'FORBIDDEN', message);
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string) {
		super(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', `${resource} not found`);
	}
}

export class ConflictError extends AppError {
	constructor(message: string) {
		super(HTTP_STATUS.CONFLICT, 'CONFLICT', message);
	}
}

export class RateLimitError extends AppError {
	constructor(retryAfterSeconds?: number) {
		const message = retryAfterSeconds
			? `Too many requests. Try again in ${retryAfterSeconds} seconds`
			: 'Too many requests. Please try again later';
		super(HTTP_STATUS.TOO_MANY_REQUESTS, 'RATE_LIMITED', message);
	}
}

export class InternalError extends AppError {
	constructor(message = 'An unexpected error occurred') {
		super(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', message, false);
	}
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
	return error instanceof AppError;
}

/**
 * Wraps unknown errors in AppError for consistent handling
 */
export function normalizeError(error: unknown): AppError {
	if (isAppError(error)) {
		return error;
	}

	if (error instanceof Error) {
		return new InternalError(
			process.env.ENVIRONMENT === 'development' ? error.message : undefined,
		);
	}

	return new InternalError();
}
