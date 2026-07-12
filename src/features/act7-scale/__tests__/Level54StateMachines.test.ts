/**
 * Level 54: State Machines. Backlog-fix pins (2026-07-12).
 *
 * Cumulative infrastructure: the soft-deletes level (L31) already ran
 * `bundle add paper_trail && rails generate paper_trail:install &&
 * rails db:migrate`. The versions table exists and products are
 * versioned. L54 must therefore NOT re-install PaperTrail (the old
 * step 4 re-ran the installer, which would generate a duplicate
 * migration), and its probes must not claim "no versioning gem
 * installed". The real step is wiring the ORDER model into the
 * existing infrastructure.
 *
 * Also pins the enum bridge: the wrong "enum" option uses the
 * curriculum's string-encoded style (myapp canon), and the level is
 * the teaching home for enum-as-precursor.
 */

import { describe, expect, test } from 'bun:test';
import {
	OPTION_STEP_CONFIG,
	PROBES,
	STEP_DEFS,
} from '../components/level-54-state-machines/Level54StateMachines';

describe('Level 54: no redundant PaperTrail install (L31 built it)', () => {
	test('the install step is gone; five steps remain', () => {
		expect(STEP_DEFS.map((s) => s.id)).toEqual([
			'add-aasm',
			'define-states',
			'define-transitions',
			'add-guards',
			'wire-audit',
		]);
	});

	test('nothing in the build re-runs the installer', () => {
		const text = JSON.stringify(OPTION_STEP_CONFIG);
		expect(text.includes('paper_trail:install')).toBe(false);
	});

	test('the audit step acknowledges the existing infrastructure', () => {
		expect(Object.keys(OPTION_STEP_CONFIG).map(Number).sort()).toEqual([
			1, 2, 3, 4,
		]);
		const audit = OPTION_STEP_CONFIG[4];
		expect(audit.title).toBe('Wire Audit Trail');
		expect(audit.description.toLowerCase()).toContain('audit-trail work');
	});

	test('probes never claim the versioning gem is missing', () => {
		const text = JSON.stringify(PROBES).toLowerCase();
		for (const forbidden of [
			'no versioning gem',
			'no papertrail',
			'no paper trail',
		]) {
			expect(text.includes(forbidden), `probes claim "${forbidden}"`).toBe(
				false,
			);
		}
		// The honest framing: the infrastructure exists; Order never opted in.
		expect(text).toContain('products');
	});
});

describe('Level 54: enum bridge (string-encoded, taught as precursor)', () => {
	test('the enum wrong option uses the string-encoded curriculum style', () => {
		const enumOption = OPTION_STEP_CONFIG[1].options.find(
			(o) => o.id === 'enum',
		);
		expect(enumOption).toBeDefined();
		expect(enumOption?.name).toContain('pending: "pending"');
		expect(enumOption?.name.includes('pending: 0')).toBe(false);
	});
});
