/**
 * Act 4 homework bridge: every Act 4 level ships "now do it for real"
 * exercises against the player's companion Rails project, with an emphasis
 * on MEASURING the win (SQL log query counts, Benchmark timings, EXPLAIN
 * plans, response headers). Commands were verified against canonical docs
 * on 2026-07-12:
 * - Prosopite + pg_query: https://github.com/charkost/prosopite/blob/main/README.md
 * - strict_loading / includes / preload / eager_load / pluck / select /
 *   find_in_batches / explain:
 *   https://guides.rubyonrails.org/active_record_querying.html
 * - add_index / migrations: https://guides.rubyonrails.org/active_record_migrations.html
 * - EXPLAIN ANALYZE: https://www.postgresql.org/docs/current/using-explain.html
 * - counter_cache / reset_counters:
 *   https://guides.rubyonrails.org/association_basics.html#options-for-belongs-to-counter-cache
 * - Pagy v43 (Pagy::Method, pagy(:offset, ...), headers_hash):
 *   https://ddnexus.github.io/pagy/
 * - pg_search: https://github.com/Casecommons/pg_search
 * - solid_cache:install + db:prepare: https://github.com/rails/solid_cache
 * - dev:cache / Rails.cache.fetch: https://guides.rubyonrails.org/caching_with_rails.html
 * - stale? / expires_in ETag flow:
 *   https://api.rubyonrails.org/classes/ActionController/ConditionalGet.html
 */

import { describe, expect, test } from 'bun:test';
import { actFour } from '@/features/act4-performance/content/act';

describe('Act 4 homework exercises', () => {
	test('every Act 4 level has at least one homework exercise', () => {
		const missing = actFour.levels
			.filter((level) => !level.learningContent.homework?.length)
			.map((level) => level.id);
		expect(missing).toEqual([]);
	});

	test('every exercise has a substantive task and verify text', () => {
		const violations: string[] = [];
		for (const level of actFour.levels) {
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
				actFour.levels.find((l) => l.id === levelId)?.learningContent
					.homework ?? []
			).flatMap((exercise) => exercise.commands ?? []);

		expect(commandsOf('act4-level21-n1-problem')).toContain(
			'bundle add prosopite pg_query',
		);
		expect(commandsOf('act4-level22-eager-loading')).toContain(
			'Review.includes(:product).each { |r| r.product.name }',
		);
		expect(commandsOf('act4-level24-indexing')).toContain(
			'EXPLAIN ANALYZE SELECT * FROM products WHERE price < 10;',
		);
		expect(commandsOf('act4-level26-pagination')).toContain('bundle add pagy');
		expect(commandsOf('act4-level27-search')).toContain('bundle add pg_search');
		expect(commandsOf('act4-level28-caching')).toContain(
			'bin/rails solid_cache:install',
		);
	});
});
