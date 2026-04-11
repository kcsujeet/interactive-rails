/**
 * Interactive Rails API
 * Hono app mounted inside Astro via the Cloudflare adapter.
 * Accessed through the catch-all route at src/pages/api/[...path].ts.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTP_STATUS } from './constants';
import { normalizeError } from './errors';
import { createAuth } from './lib/auth';
import { generalRateLimiter } from './middleware/rateLimit';
import { requestIdMiddleware } from './middleware/requestId';
import { pipelineRoutes } from './routes/pipeline';
import type { Env } from './types';
import { logger } from './utils/logger';

const app = new Hono<{ Bindings: Env }>();

// ==================== Middleware ====================

// Request ID tracking (first, so all logs have request ID)
app.use('*', requestIdMiddleware);

// CORS configuration (same-origin in production, keep for external clients)
app.use(
	'*',
	cors({
		origin: ['http://localhost:4321', 'https://interactiverails.com'],
		credentials: true,
	}),
);

// Request logging
app.use('*', async (c, next) => {
	const start = Date.now();
	await next();
	const duration = Date.now() - start;

	logger.info('Request completed', {
		requestId: c.get('requestId'),
		method: c.req.method,
		path: c.req.path,
		status: c.res.status,
		duration,
	});
});

// General rate limiting (applied to all routes)
app.use('/api/*', generalRateLimiter);

// ==================== Health Check ====================

app.get('/api/health', async (c) => {
	try {
		await c.env.DB.prepare('SELECT 1').first();

		return c.json({
			success: true,
			data: {
				status: 'healthy',
				database: 'connected',
				timestamp: new Date().toISOString(),
			},
		});
	} catch (error) {
		logger.error('Health check failed', error as Error, {
			requestId: c.get('requestId'),
		});

		return c.json(
			{
				success: false,
				data: {
					status: 'unhealthy',
					database: 'disconnected',
					timestamp: new Date().toISOString(),
				},
			},
			HTTP_STATUS.INTERNAL_ERROR,
		);
	}
});

// ==================== Routes ====================

// Better Auth handles all /api/auth/* routes
app.on(['GET', 'POST'], '/api/auth/**', (c) => {
	const auth = createAuth(
		c.env.DB,
		c.env.BETTER_AUTH_SECRET,
		c.env.BETTER_AUTH_URL,
	);
	return auth.handler(c.req.raw);
});

app.route('/api/pipeline', pipelineRoutes);

// ==================== Error Handling ====================

// 404 handler
app.notFound((c) => {
	return c.json(
		{
			success: false,
			error: {
				code: 'NOT_FOUND',
				message: 'The requested resource was not found',
			},
			meta: {
				requestId: c.get('requestId'),
				timestamp: new Date().toISOString(),
			},
		},
		HTTP_STATUS.NOT_FOUND,
	);
});

// Global error handler
app.onError((err, c) => {
	const appError = normalizeError(err);

	// Log unexpected errors
	if (!appError.isOperational) {
		logger.error('Unhandled error', err as Error, {
			requestId: c.get('requestId'),
			path: c.req.path,
			method: c.req.method,
		});
	}

	return c.json(
		{
			success: false,
			error: {
				code: appError.code,
				message: appError.message,
			},
			meta: {
				requestId: c.get('requestId'),
				timestamp: new Date().toISOString(),
			},
		},
		appError.statusCode as 400,
	);
});

export default app;
