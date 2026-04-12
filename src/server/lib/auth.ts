/**
 * Better Auth configuration
 * Creates auth instance per-request since D1 bindings are only available in request context
 */

import { betterAuth } from 'better-auth';
import { customSession } from 'better-auth/plugins';

export function createAuth(db: D1Database, secret: string, baseURL: string) {
	return betterAuth({
		database: db,
		secret,
		baseURL,
		basePath: '/api/auth',
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			sendResetPassword: async ({ user, url }) => {
				// TODO: Replace with real email provider (e.g. Resend)
				console.log(`[Password Reset] To: ${user.email}, URL: ${url}`);
			},
		},
		user: {
			additionalFields: {
				username: {
					type: 'string',
					required: true,
					unique: true,
					input: true,
				},
			},
		},
		plugins: [
			customSession(async ({ user, session }) => {
				// Strip sensitive fields (token, ipAddress, userAgent) from the response.
				// username comes from additionalFields, accessed via bracket notation.
				return {
					user: {
						id: user.id,
						name: user.name,
						email: user.email,
						username: user['username' as keyof typeof user] ?? '',
						image: user.image,
					},
					session: {
						expiresAt: session.expiresAt,
					},
				};
			}),
		],
		advanced: {
			disableCSRFCheck: false,
		},
		session: {
			expiresIn: 60 * 60 * 24 * 365, // 1 year
			updateAge: 60 * 60 * 24, // refresh daily
		},
		trustedOrigins: ['http://localhost:4321', 'https://interactiverails.com'],
	});
}

export type Auth = ReturnType<typeof createAuth>;
