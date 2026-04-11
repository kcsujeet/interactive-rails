import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
// @ts-check
import { defineConfig } from 'astro/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: cloudflare(),
	integrations: [react()],
	vite: {
		resolve: {
			alias: {
				'@': path.resolve(__dirname, './src'),
			},
		},
		plugins: [tailwindcss()],
		// Optimize Phaser for production
		optimizeDeps: {
			include: ['phaser', 'better-auth'],
		},
		build: {
			// Ensure Phaser is bundled correctly
			commonjsOptions: {
				include: [/phaser/, /node_modules/],
			},
		},
	},
});
