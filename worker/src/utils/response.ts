/**
 * Standardized API response utilities
 * Ensures consistent response format across all endpoints
 */

import type { Context } from 'hono';
import { type AppError, normalizeError } from '../errors';
import { logger } from './logger';

export interface ApiResponse<T = unknown> {
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

/**
 * Creates a successful API response
 */
export function successResponse<T>(
	c: Context,
	data: T,
	statusCode = 200,
): Response {
	const response: ApiResponse<T> = {
		success: true,
		data,
		meta: {
			requestId: c.get('requestId'),
			timestamp: new Date().toISOString(),
		},
	};

	return c.json(response, statusCode as 200);
}

/**
 * Creates an error API response
 */
export function errorResponse(c: Context, error: AppError): Response {
	const response: ApiResponse = {
		success: false,
		error: {
			code: error.code,
			message: error.message,
		},
		meta: {
			requestId: c.get('requestId'),
			timestamp: new Date().toISOString(),
		},
	};

	// Log non-operational errors (unexpected errors)
	if (!error.isOperational) {
		logger.error('Unexpected error', error, {
			requestId: c.get('requestId'),
			path: c.req.path,
			method: c.req.method,
		});
	}

	return c.json(response, error.statusCode as 400);
}

/**
 * Handles any error and returns appropriate response
 */
export function handleError(c: Context, error: unknown): Response {
	const appError = normalizeError(error);
	return errorResponse(c, appError);
}

/**
 * Creates a paginated response
 */
export function paginatedResponse<T>(
	c: Context,
	data: T[],
	pagination: {
		page: number;
		limit: number;
		total: number;
	},
): Response {
	const response: ApiResponse<T[]> & { pagination: typeof pagination } = {
		success: true,
		data,
		pagination: {
			page: pagination.page,
			limit: pagination.limit,
			total: pagination.total,
		},
		meta: {
			requestId: c.get('requestId'),
			timestamp: new Date().toISOString(),
		},
	};

	return c.json(response);
}
