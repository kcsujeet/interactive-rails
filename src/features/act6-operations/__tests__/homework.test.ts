/**
 * Act 6 homework bridge: every Act 6 level ships "now do it for real"
 * exercises against the player's companion Rails project. Commands were
 * verified against canonical docs on 2026-07-12:
 * - rack-cors: https://github.com/cyu/rack-cors
 * - Rails 8 rate_limit + Rack::Attack: https://github.com/rack/rack-attack
 * - strong_migrations install generator:
 *   https://github.com/ankane/strong_migrations
 * - Solid Queue recurring tasks (config/recurring.yml, bin/jobs):
 *   https://github.com/rails/solid_queue
 * - Rails.error reporter: https://guides.rubyonrails.org/error_reporting.html
 * - lograge JSON formatter + custom_payload:
 *   https://github.com/roidrage/lograge
 * - OpenTelemetry Ruby (use_all, console exporter):
 *   https://opentelemetry.io/docs/languages/ruby/getting-started/
 * - Kamal init / config: https://kamal-deploy.org/docs/commands/
 * - Flipper setup generator: https://github.com/flippercloud/flipper
 */

import { describe, expect, test } from 'bun:test';
import { actSix } from '@/features/act6-operations/content/act';

describe('Act 6 homework exercises', () => {
	test('every Act 6 level has at least one homework exercise', () => {
		const missing = actSix.levels
			.filter((level) => !level.learningContent.homework?.length)
			.map((level) => level.id);
		expect(missing).toEqual([]);
	});

	test('every exercise has a substantive task and verify text', () => {
		const violations: string[] = [];
		for (const level of actSix.levels) {
			for (const exercise of level.learningContent.homework ?? []) {
				if (exercise.task.trim().length < 20) {
					violations.push(`${level.id}: task too thin: "${exercise.task}"`);
				}
				if (exercise.verify.trim().length < 20) {
					violations.push(`${level.id}: verify too thin: "${exercise.verify}"`);
				}
				if (exercise.commands && exercise.commands.length === 0) {
					violations.push(`${level.id}: empty commands array`);
				}
			}
		}
		expect(violations).toEqual([]);
	});

	test('doc-verified anchor commands appear where the level teaches them', () => {
		const commandsOf = (levelId: string) =>
			(
				actSix.levels.find((l) => l.id === levelId)?.learningContent.homework ??
				[]
			).flatMap((exercise) => exercise.commands ?? []);

		expect(commandsOf('act6-level40-middleware')).toContain(
			'bin/rails middleware',
		);
		expect(commandsOf('act6-level41-cors')).toContain('bundle add rack-cors');
		expect(commandsOf('act6-level42-rate-limiting')).toContain(
			'bundle add rack-attack',
		);
		expect(commandsOf('act6-level43-safe-migrations')).toContain(
			'bin/rails generate strong_migrations:install',
		);
		expect(commandsOf('act6-level44-recurring-jobs')).toContain('bin/jobs');
		expect(commandsOf('act6-level47-observability')).toContain(
			'bundle add lograge',
		);
		expect(commandsOf('act6-level49-deployment')).toContain('kamal init');
		expect(commandsOf('act6-level50-feature-flags')).toContain(
			'bin/rails generate flipper:setup',
		);
	});
});
