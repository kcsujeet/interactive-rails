/**
 * Request ID middleware
 * Attaches a unique ID to each request for tracing
 */

import { createMiddleware } from 'hono/factory';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

export const requestIdMiddleware = createMiddleware(async (c, next) => {
  // Use existing request ID from header or generate new one
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();

  // Store in context for use by other middleware/handlers
  c.set('requestId', requestId);

  // Add to response headers for client-side correlation
  c.header('X-Request-ID', requestId);

  await next();
});
