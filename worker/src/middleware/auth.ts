/**
 * Authentication middleware
 * Validates JWT tokens from cookies and attaches userId to context
 */

import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../errors';
import { AUTH } from '../constants';
import type { Env } from '../types';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const token = getCookie(c, AUTH.COOKIE.NAME);

  if (!token) {
    throw new UnauthorizedError('Authentication required');
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    c.set('userId', payload.userId);
    await next();
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
});
