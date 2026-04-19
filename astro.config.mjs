import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: cloudflare(),
	integrations: [react()],
	vite: {
		plugins: [tailwindcss()],
		optimizeDeps: {
			include: ['phaser', 'better-auth'],
		},
		build: {
			commonjsOptions: {
				include: [/phaser/, /node_modules/],
			},
		},
	},
});
