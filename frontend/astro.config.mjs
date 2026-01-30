// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

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
