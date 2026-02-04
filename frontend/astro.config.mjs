import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
	integrations: [react()],
	vite: {
		plugins: [tailwindcss()],
		server: {
			proxy: {
				// Proxy API requests to worker in development
				'/api': {
					target: 'http://localhost:8787',
					changeOrigin: true,
					secure: false,
					// Preserve cookies and headers
					configure: (proxy) => {
						proxy.on('proxyRes', (proxyRes, req, res) => {
							// Ensure Set-Cookie headers are forwarded properly
							const setCookie = proxyRes.headers['set-cookie'];
							if (setCookie) {
								// Remove domain from cookies so they work on localhost
								res.setHeader(
									'set-cookie',
									setCookie.map((cookie) =>
										cookie.replace(/Domain=[^;]+;?\s*/gi, ''),
									),
								);
							}
						});
					},
				},
			},
		},
		// Optimize Phaser for production
		optimizeDeps: {
			include: ['phaser'],
		},
		build: {
			// Ensure Phaser is bundled correctly
			commonjsOptions: {
				include: [/phaser/, /node_modules/],
			},
		},
	},
});
