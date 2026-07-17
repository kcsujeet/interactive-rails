import { defineConfig } from '@playwright/test';

/**
 * E2E smoke tests. `bun test` covers data consistency; these cover "the
 * level actually renders and responds in a browser", the class of bug the
 * unit layer cannot see. Run with `bun run test:e2e`.
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:4321',
		trace: 'retain-on-failure',
	},
	webServer: {
		// Build once and serve the static output with `astro preview`. This is
		// what actually ships (static dist/), and unlike Astro 7's `astro dev`
		// (which daemonizes and returns), `astro preview` runs in the
		// foreground so Playwright can manage its lifecycle.
		command: 'bun run build && bun run preview',
		url: 'http://localhost:4321',
		reuseExistingServer: !process.env.CI,
		stdout: 'ignore',
		timeout: 120_000,
	},
});
