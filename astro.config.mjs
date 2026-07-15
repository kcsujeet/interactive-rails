import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
// @ts-check
import { defineConfig } from 'astro/config';

// Fully static build: no server, no adapter. Every page prerenders to
// HTML/JS and the whole site can be hosted on any static host (GitHub
// Pages, Netlify, Cloudflare Pages, or `bunx serve dist`). All progress
// lives in the browser's localStorage.
// https://astro.build/config
export default defineConfig({
	output: 'static',
	integrations: [react()],
	vite: {
		plugins: [tailwindcss()],
	},
});
