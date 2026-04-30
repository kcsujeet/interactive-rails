/// <reference types="@cloudflare/workers-types" />
// Server types for the Hono API running inside Astro's Cloudflare adapter.
// The full set of RPG-style types (User, Realm, Dungeon, Challenge, Progress,
// etc.) was removed alongside the legacy game layer. Only the Cloudflare
// `Env` binding shape remains because pipeline routes and Better Auth still
// need it.

export interface Env {
	DB: D1Database;
	ENVIRONMENT: string;
	JWT_SECRET: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
}
