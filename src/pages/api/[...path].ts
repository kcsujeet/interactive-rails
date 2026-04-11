import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import app from '@/server/index';

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
	return app.fetch(request, env);
};
