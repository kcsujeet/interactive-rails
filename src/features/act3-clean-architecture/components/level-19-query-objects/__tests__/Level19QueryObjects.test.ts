/**
 * Level 19: Query Objects. Tests pin the review-finding fixes and import
 * the real component data so drift is caught at type-check time.
 *
 * Schema ground truth (Act 1-3):
 * - Product belongs_to :user; the foreign-key column is `user_id`, never
 *   `seller_id` (L13 strong-params, homework: products.user_id).
 * - Product has enum :status with string values draft/listed/sold (L17,
 *   rails-conventions.md string-encoded enums); "listed" is
 *   where(status: "listed"), not where.not(listed_at: nil).
 * - Product has NO tags association, so joins(:tags) must not appear.
 * - Background jobs do not exist until L36; the third consumer is a plain
 *   CSV export PORO, not a job.
 *
 * Rails facts verified against canonical docs on 2026-07-20:
 * - .order with raw params is SQL-injectable; the SORTABLE_COLUMNS allowlist
 *   is required. https://guides.rubyonrails.org/active_record_querying.html
 */

import { describe, expect, test } from 'bun:test';
import { expectBuildStepQuality } from '@/lib/testing/level-pedagogy';
import {
	FILTER_METHOD_OPTIONS,
	getCodeFiles,
	PATTERN_OPTIONS,
	STEP_DEFS,
	WIRE_OPTIONS,
} from '../Level19QueryObjects';

const allPreviewCode = () => {
	const chunks: string[] = [];
	for (const phase of ['intro', 'build', 'reward'] as const) {
		for (let step = -1; step <= STEP_DEFS.length; step++) {
			for (const f of getCodeFiles(phase, step)) {
				chunks.push(`${f.filename}\n${f.code}`);
			}
		}
	}
	return chunks.join('\n');
};

describe('Level 19: build step quality', () => {
	const STEP_OPTION_SETS = [
		{ name: 'extraction-pattern', options: PATTERN_OPTIONS },
		{ name: 'filter-method', options: FILTER_METHOD_OPTIONS },
		{ name: 'wire-controller', options: WIRE_OPTIONS },
	];

	test('every step: exactly one correct, correct never first, feedback present', () => {
		for (const set of STEP_OPTION_SETS) {
			expectBuildStepQuality({ name: set.name, options: set.options });
		}
	});

	test('the wire-controller correct answer chains on user_id, never seller_id', () => {
		const correct = WIRE_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('by_seller(params[:user_id])');
		expect(correct?.label.includes('seller_id')).toBe(false);
	});

	test('no build option or feedback references the blog-era by_author/by_tag filters', () => {
		const text = JSON.stringify([
			...PATTERN_OPTIONS,
			...FILTER_METHOD_OPTIONS,
			...WIRE_OPTIONS,
		]);
		expect(text.includes('by_author')).toBe(false);
		expect(text.includes('by_tag')).toBe(false);
		expect(text.includes('"rails"')).toBe(false);
	});
});

describe('Level 19: reward gating reaches the final code', () => {
	test('the reward preview (STEP_DEFS.length) shows the full ProductQuery and clean controller', () => {
		// The reward passes STEP_DEFS.length so getCodeFiles hits furthestStep>=3.
		const reward = getCodeFiles('reward', STEP_DEFS.length);
		const joined = reward.map((f) => `${f.filename}\n${f.code}`).join('\n');
		// Full query object: all filter methods present.
		expect(joined).toContain('def by_seller(user_id)');
		expect(joined).toContain('def featured(flag)');
		expect(joined).toContain('SORTABLE_COLUMNS');
		// Clean controller present.
		expect(joined).toContain('.by_seller(params[:user_id])');
	});
});

describe('Level 19: schema correctness across all previews', () => {
	const all = allPreviewCode();

	test('no preview uses seller_id (the column is user_id)', () => {
		expect(all.includes('seller_id')).toBe(false);
		expect(all).toContain('user_id');
	});

	test('the listed filter uses the status enum, not where.not(listed_at: nil)', () => {
		expect(all).toContain('where(status: "listed")');
		expect(all.includes('where.not(listed_at: nil)')).toBe(false);
	});

	test('no preview references a nonexistent tags association', () => {
		expect(all.includes('joins(:tags)')).toBe(false);
		expect(all.includes('by_tag')).toBe(false);
		expect(all.includes('tags: {')).toBe(false);
	});

	test('the sorted method includes the SQL-injection allowlist', () => {
		const query = getCodeFiles('reward', STEP_DEFS.length).find((f) =>
			f.filename.includes('product_query.rb'),
		);
		expect(query?.code).toContain('SORTABLE_COLUMNS');
		expect(query?.code).toContain('SORT_DIRECTIONS');
	});

	test('the third consumer is a PORO export, not a background job', () => {
		expect(all.includes('csv_export_job')).toBe(false);
		expect(all.includes('app/jobs/')).toBe(false);
		expect(all).toContain('csv_product_export.rb');
	});
});
