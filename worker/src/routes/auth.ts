/**
 * Authentication Routes
 * Handles signup, login, logout, and session management
 */

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { AUTH, HTTP_STATUS } from '../constants';
import { UnauthorizedError } from '../errors';
import { authMiddleware } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { PipelineProgressRepository } from '../repositories/pipelineProgressRepository';
import { UserRepository } from '../repositories/userRepository';
import type { Env } from '../types';
import { createToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { hashPassword, verifyPassword } from '../utils/password';

const authRoutes = new Hono<{ Bindings: Env }>();

// Apply stricter rate limiting to auth routes
authRoutes.use('*', authRateLimiter);

// ==================== Validation Schemas ====================

const signupSchema = z.object({
	email: z.string().email('Invalid email format'),
	username: z
		.string()
		.min(3, 'Username must be at least 3 characters')
		.max(20, 'Username must be at most 20 characters')
		.regex(
			/^[a-zA-Z0-9_]+$/,
			'Username can only contain letters, numbers, and underscores',
		),
	password: z
		.string()
		.min(
			AUTH.PASSWORD.MIN_LENGTH,
			`Password must be at least ${AUTH.PASSWORD.MIN_LENGTH} characters`,
		),
});

const loginSchema = z.object({
	email: z.string().email('Invalid email format'),
	password: z.string().min(1, 'Password is required'),
});

// ==================== Helper Functions ====================

function setAuthCookie(
	c: { env: Env; header: (name: string, value: string) => void },
	token: string,
): void {
	const isProduction = c.env.ENVIRONMENT === 'production';

	setCookie(
		c as unknown as Parameters<typeof setCookie>[0],
		AUTH.COOKIE.NAME,
		token,
		{
			httpOnly: true,
			secure: isProduction,
			sameSite: 'Lax',
			maxAge: AUTH.COOKIE.MAX_AGE_SECONDS,
			path: '/',
		},
	);
}

function formatUserResponse(user: {
	id: string;
	email: string;
	username: string;
}) {
	return {
		id: user.id,
		email: user.email,
		username: user.username,
	};
}

// ==================== Routes ====================

/**
 * POST /api/auth/signup
 * Create a new user account
 */
authRoutes.post('/signup', zValidator('json', signupSchema), async (c) => {
	const { email, username, password } = c.req.valid('json');
	const userRepo = new UserRepository(c.env.DB);
	const progressRepo = new PipelineProgressRepository(c.env.DB);

	logger.info('Signup attempt', {
		requestId: c.get('requestId'),
		email: email.substring(0, 3) + '***', // Partial email for privacy
		username,
	});

	// Create user (repository handles conflict checking)
	const passwordHash = await hashPassword(password);
	const user = await userRepo.create({ email, username, passwordHash });

	// Create initial progress
	await progressRepo.createPlayerProgress({ userId: user.id });

	// Generate and set auth token
	const token = await createToken({ userId: user.id }, c.env.JWT_SECRET);
	setAuthCookie(c, token);

	logger.info('User created successfully', {
		requestId: c.get('requestId'),
		userId: user.id,
	});

	return c.json(
		{
			success: true,
			data: {
				user: formatUserResponse(user),
			},
			meta: {
				requestId: c.get('requestId'),
				timestamp: new Date().toISOString(),
			},
		},
		HTTP_STATUS.CREATED,
	);
});

/**
 * POST /api/auth/login
 * Authenticate an existing user
 */
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
	const { email, password } = c.req.valid('json');
	const userRepo = new UserRepository(c.env.DB);

	logger.info('Login attempt', {
		requestId: c.get('requestId'),
		email: email.substring(0, 3) + '***',
	});

	// Find user
	const user = await userRepo.findByEmail(email);
	if (!user) {
		// Use same error message for both invalid email and password to prevent enumeration
		throw new UnauthorizedError('Invalid email or password');
	}

	// Verify password
	const valid = await verifyPassword(password, user.password_hash);
	if (!valid) {
		logger.warn('Invalid password attempt', {
			requestId: c.get('requestId'),
			userId: user.id,
		});
		throw new UnauthorizedError('Invalid email or password');
	}

	// Generate and set auth token
	const token = await createToken({ userId: user.id }, c.env.JWT_SECRET);
	setAuthCookie(c, token);

	// Update last login
	await userRepo.updateLastLogin(user.id);

	logger.info('Login successful', {
		requestId: c.get('requestId'),
		userId: user.id,
	});

	return c.json({
		success: true,
		data: {
			user: formatUserResponse(user),
		},
		meta: {
			requestId: c.get('requestId'),
			timestamp: new Date().toISOString(),
		},
	});
});

/**
 * GET /api/auth/me
 * Get the current authenticated user
 */
authRoutes.get('/me', authMiddleware, async (c) => {
	const userId = c.get('userId');
	const userRepo = new UserRepository(c.env.DB);

	const user = await userRepo.getByIdOrThrow(userId);

	return c.json({
		success: true,
		data: {
			user: formatUserResponse(user),
		},
		meta: {
			requestId: c.get('requestId'),
			timestamp: new Date().toISOString(),
		},
	});
});

/**
 * POST /api/auth/logout
 * Clear the authentication cookie
 */
authRoutes.post('/logout', async (c) => {
	deleteCookie(c, AUTH.COOKIE.NAME, { path: '/' });

	logger.info('User logged out', {
		requestId: c.get('requestId'),
	});

	return c.json({
		success: true,
		data: {
			message: 'Logged out successfully',
		},
		meta: {
			requestId: c.get('requestId'),
			timestamp: new Date().toISOString(),
		},
	});
});

export { authRoutes };
