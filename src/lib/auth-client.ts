import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
	baseURL: import.meta.env.DEV
		? 'http://localhost:4321'
		: 'https://interactiverails.com',
	plugins: [
		inferAdditionalFields({
			user: {
				username: {
					type: 'string',
				},
			},
		}),
	],
});
