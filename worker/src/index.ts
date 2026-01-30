/**
 * RailsExpert API
 * Main entry point for the Cloudflare Worker
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/game';
import { progressRoutes } from './routes/progress';
import { pipelineRoutes } from './routes/pipeline';
import { requestIdMiddleware } from './middleware/requestId';
import { generalRateLimiter } from './middleware/rateLimit';
import { isAppError, normalizeError } from './errors';
import { logger } from './utils/logger';
import { HTTP_STATUS } from './constants';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// ==================== Middleware ====================

// Request ID tracking (first, so all logs have request ID)
app.use('*', requestIdMiddleware);

// CORS configuration
app.use(
  '*',
  cors({
    origin: ['http://localhost:4321', 'https://railsexpert.com'],
    credentials: true,
  })
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

app.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      name: 'RailsExpert API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

// Health check with DB ping
app.get('/health', async (c) => {
  try {
    // Simple DB query to verify connection
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
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
});

// ==================== Routes ====================

app.route('/api/auth', authRoutes);
app.route('/api/game', gameRoutes);
app.route('/api/progress', progressRoutes);
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
    HTTP_STATUS.NOT_FOUND
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
    appError.statusCode as 400
  );
});

export default app;
