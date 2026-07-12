/**
 * Act 5 homework bridge: every Act 5 level ships "now do it for real"
 * exercises against the player's companion Rails project. Commands were
 * verified against canonical docs on 2026-07-12:
 * - polymorphic references generator (commentable:references{polymorphic}):
 *   https://guides.rubyonrails.org/association_basics.html#polymorphic-associations
 * - discard: https://github.com/jhawthorn/discard
 * - paper_trail install generator: https://github.com/paper-trail-gem/paper_trail
 * - transactions / requires_new savepoints:
 *   https://api.rubyonrails.org/classes/ActiveRecord/Transactions/ClassMethods.html
 * - lock / lock_version / update_all:
 *   https://api.rubyonrails.org/classes/ActiveRecord/Locking.html
 * - active_storage:install / attach / variants:
 *   https://guides.rubyonrails.org/active_storage_overview.html
 * - generate mailer / previews / deliver_later (enqueues MailDeliveryJob):
 *   https://guides.rubyonrails.org/action_mailer_basics.html
 * - generates_token_for / find_by_token_for:
 *   https://api.rubyonrails.org/classes/ActiveRecord/TokenFor/ClassMethods.html
 * - solid_queue:install / bin/jobs: https://github.com/rails/solid_queue
 * - solid_cable:install / broadcast_to: https://github.com/rails/solid_cable
 * - Faraday timeouts + faraday-retry middleware:
 *   https://lostisland.github.io/faraday/, https://github.com/lostisland/faraday-retry
 * - Stoplight circuit breaker: https://github.com/bolshakov/stoplight
 * - webhook idempotency (Stripe retries): https://stripe.com/docs/webhooks/best-practices
 */

import { describe, expect, test } from 'bun:test';
import { actFive } from '@/features/act5-production/content/act';

describe('Act 5 homework exercises', () => {
	test('every Act 5 level has at least one homework exercise', () => {
		const missing = actFive.levels
			.filter((level) => !level.learningContent.homework?.length)
			.map((level) => level.id);
		expect(missing).toEqual([]);
	});

	test('every exercise has a substantive task and verify text', () => {
		const violations: string[] = [];
		for (const level of actFive.levels) {
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
				actFive.levels.find((l) => l.id === levelId)?.learningContent
					.homework ?? []
			).flatMap((exercise) => exercise.commands ?? []);

		expect(commandsOf('act5-level30-polymorphic')).toContain(
			'bin/rails generate model Comment body:text commentable:references{polymorphic}',
		);
		expect(commandsOf('act5-level31-soft-deletes')).toContain(
			'bundle add discard paper_trail',
		);
		expect(commandsOf('act5-level34-active-storage')).toContain(
			'bin/rails active_storage:install',
		);
		expect(commandsOf('act5-level35-action-mailer')).toContain(
			'bin/rails generate mailer User password_reset',
		);
		expect(commandsOf('act5-level36-background-jobs')).toContain(
			'bin/rails generate solid_queue:install',
		);
		expect(commandsOf('act5-level36-background-jobs')).toContain('bin/jobs');
		expect(commandsOf('act5-level37-realtime')).toContain(
			'bin/rails solid_cable:install',
		);
		expect(commandsOf('act5-level38-external-apis')).toContain(
			'bundle add stoplight',
		);
	});
});
