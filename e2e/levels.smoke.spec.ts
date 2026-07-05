/**
 * Browser smoke tests.
 *
 * 1. Every level play page renders without an uncaught exception. This is
 *    the "data is valid but the level is unplayable" net that data-level
 *    unit tests cannot catch (bad lazy imports, render-time crashes,
 *    missing registry entries).
 * 2. The free-input terminal loop works end to end on L1: typing a wrong
 *    command shows its feedback, two misses reveal the option buttons, and
 *    typing the correct command completes the step.
 *
 * Run with `bun run test:e2e` (starts `astro dev` automatically).
 */

import { execSync } from 'node:child_process';
import { expect, type Page, test } from '@playwright/test';

interface LevelRef {
	actId: number;
	levelId: string;
	levelNumber: number;
	name: string;
}

const levels: LevelRef[] = JSON.parse(
	execSync('bun scripts/dump-level-ids.ts', { encoding: 'utf8' }),
);

function collectPageErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(String(error)));
	return errors;
}

test.describe('every level play page renders', () => {
	for (const level of levels) {
		test(`L${level.levelNumber} ${level.name}`, async ({ page }) => {
			const errors = collectPageErrors(page);
			await page.goto(`/acts/${level.actId}/${level.levelId}/play`);
			// The level chrome must appear; a crashed lazy component or a
			// Suspense stuck forever fails this. Some levels shorten the name
			// in their header, so the uniform "LEVEL n" chip is the fallback.
			await expect(
				page
					.getByText(level.name)
					.or(page.getByText(`LEVEL ${level.levelNumber}`))
					.first(),
			).toBeVisible({ timeout: 15_000 });
			expect(errors).toEqual([]);
		});
	}
});

test.describe('free-input terminal loop (L1, terminal archetype)', () => {
	test('wrong command teaches, two misses reveal options, correct advances', async ({
		page,
	}) => {
		const errors = collectPageErrors(page);
		await page.goto('/acts/1/act1-level1-environment/play');

		const input = page.getByLabel('Type a command');
		await expect(input).toBeVisible({ timeout: 15_000 });

		// Options are hidden until the player misses twice.
		await expect(
			page.getByRole('button', { name: 'apt-get install mise' }),
		).toHaveCount(0);

		// Miss 1: a wrong option typed verbatim shows its feedback.
		await input.fill('apt-get install mise');
		await input.press('Enter');
		await expect(
			page.getByText('apt-get is a Linux package manager', { exact: false }),
		).toBeVisible();

		// Miss 2: unrecognized input shows the shell-style error...
		await input.fill('definitely not a command');
		await input.press('Enter');
		await expect(
			page.getByText('command not recognized', { exact: false }),
		).toBeVisible();

		// ...and the fallback option buttons appear.
		await expect(
			page.getByRole('button', { name: 'apt-get install mise' }),
		).toBeVisible();

		// Typing the correct command completes the step: its success output
		// animates in and the Next Step button appears.
		await input.fill('brew install mise');
		await input.press('Enter');
		await expect(page.getByRole('button', { name: 'Next Step' })).toBeVisible({
			timeout: 10_000,
		});

		expect(errors).toEqual([]);
	});
});
