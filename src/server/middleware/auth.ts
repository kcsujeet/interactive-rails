/**
 * Authentication middleware
 * Validates Better Auth sessions and attaches userId to context
 */

import { createMiddleware } from 'hono/factory';
import { UnauthorizedError } from '../errors';
import { createAuth } from '../lib/auth';
import type { Env } from '../types';

declare module 'hono' {
	interface ContextVariableMap {
		userId: string;
	}
}

export const authMiddleware = createMiddleware<{ Bindings: Env }>(
	async (c, next) => {
		const auth = createAuth(
			c.env.DB,
			c.env.BETTER_AUTH_SECRET,
			c.env.BETTER_AUTH_URL,
		);

		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});

		if (!session) {
			throw new UnauthorizedError('Authentication required');
		}

		c.set('userId', session.user.id);
		await next();
	},
);
