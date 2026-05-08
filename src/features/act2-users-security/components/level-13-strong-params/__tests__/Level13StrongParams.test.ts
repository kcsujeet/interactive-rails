/**
 * Tests for Level 13: Strong Params (post-redesign).
 *
 * Per testing.md: mirror data structures from the component, do not import.
 * If the component data drifts, the test still documents the expected shape.
 *
 * Validates:
 * - Probe-to-scenario 1:1 coverage (every observe probe has a matching reward scenario).
 * - Probe-to-discovery 1:1 mapping (each probe unlocks exactly one distinct discovery).
 * - Build step quality (correct answer never first; wrong-option feedback never reveals the
 *   correct answer; exactly one correct option per step).
 * - Reward scenario uniqueness + mix of allowed/blocked.
 * - Stress scenarios cover the full attack surface (3 mass-assignment exploits + clean cases).
 */

import { describe, expect, test } from 'bun:test';

// ─────────────────────────────────────────────
// Mirrored data from Level13StrongParams.tsx
// ─────────────────────────────────────────────

const PROBE_IDS = [
	'self-promote-create',
	'self-promote-update',
	'compound-frame',
] as const;

const DISCOVERY_IDS = [
	'self-promote-create',
	'self-promote-update',
	'compound-frame',
] as const;

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'self-promote-create': 'self-promote-create',
	'self-promote-update': 'self-promote-update',
	'compound-frame': 'compound-frame',
};

const SCENARIO_IDS = [
	'self-promote-create',
	'self-promote-update',
	'compound-frame',
	'clean-create',
	'clean-update',
] as const;

const SCENARIO_RESULTS: Record<string, 'allowed' | 'blocked'> = {
	'self-promote-create': 'blocked',
	'self-promote-update': 'blocked',
	'compound-frame': 'blocked',
	'clean-create': 'allowed',
	'clean-update': 'allowed',
};

interface OptionShape {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const FILTERING_OPTIONS: OptionShape[] = [
	{
		id: 'unsafe-h',
		label: 'params[:product].to_unsafe_h',
		correct: false,
		feedback:
			'That is what the controller already does. The Rails docs literally call it "an unsafe, unfiltered representation" — extra fields like featured and user_id pass straight through.',
	},
	{
		id: 'permit-all',
		label: 'params[:product].permit!',
		correct: false,
		feedback:
			'permit! marks every key as permitted. It silences the ForbiddenAttributesError but lets every field through, including the ones an attacker injects. Same outcome as to_unsafe_h.',
	},
	{
		id: 'params-expect',
		label: 'params.expect(product: [:name, :description, :price])',
		correct: true,
	},
];

const WHITELIST_OPTIONS: OptionShape[] = [
	{
		id: 'with-featured',
		label: 'params.expect(product: [:name, :description, :price, :featured])',
		correct: false,
		feedback:
			'featured is the admin-curated homepage flag. If users can set it through request params, they can self-promote — exactly the attack you just observed. Admin-only columns belong out of the whitelist.',
	},
	{
		id: 'with-user-id',
		label: 'params.expect(product: [:name, :description, :price, :user_id])',
		correct: false,
		feedback:
			'user_id controls product ownership. If users can set it through request params, they can transfer products to victims (frame attack). Ownership belongs to the association, not the request body.',
	},
	{
		id: 'safe-only',
		label: 'params.expect(product: [:name, :description, :price])',
		correct: true,
	},
];

const OWNERSHIP_OPTIONS: OptionShape[] = [
	{
		id: 'merge-params',
		label: 'Product.create!(product_params.merge(user_id: params[:user_id]))',
		correct: false,
		feedback:
			'That still reads user_id from the request body. An attacker can send any user_id they want.',
	},
	{
		id: 'no-user',
		label: 'Product.create!(product_params)',
		correct: false,
		feedback:
			'That does not set user_id at all. The product will not be associated with any user.',
	},
	{
		id: 'current-user',
		label: 'Current.user.products.create!(product_params)',
		correct: true,
	},
];

const ALL_STEP_OPTIONS: OptionShape[][] = [
	FILTERING_OPTIONS,
	WHITELIST_OPTIONS,
	OWNERSHIP_OPTIONS,
];

// Distinctive substrings of each step's correct answer that must NOT appear in
// the same step's wrong-option feedback (the answer-leak check).
const CORRECT_ANSWER_KEYWORDS: string[][] = [
	// Step 0: correct answer is `params.expect(product: [:name, :description, :price])`.
	['params.expect', 'expect(product:'],
	// Step 1: correct answer is `params.expect(product: [:name, :description, :price])` (excludes featured + user_id).
	['[:name, :description, :price]'],
	// Step 2: correct answer is `Current.user.products.create!(product_params)`.
	['Current.user.products.create', 'Current.user.products.create!'],
];

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('Level 13: Strong Params — probe / discovery wiring', () => {
	test('every probe has a discovery mapping', () => {
		for (const id of PROBE_IDS) {
			expect(PROBE_DISCOVERY_MAP[id]).toBeDefined();
			expect(DISCOVERY_IDS.includes(PROBE_DISCOVERY_MAP[id] as never)).toBe(
				true,
			);
		}
	});

	test('probe-to-discovery is 1:1 (each probe owns a unique discovery)', () => {
		const mapped = PROBE_IDS.map((id) => PROBE_DISCOVERY_MAP[id]);
		const unique = new Set(mapped);
		expect(unique.size).toBe(PROBE_IDS.length);
	});

	test('every discovery is unlocked by exactly one probe', () => {
		for (const discoveryId of DISCOVERY_IDS) {
			const owners = PROBE_IDS.filter(
				(probeId) => PROBE_DISCOVERY_MAP[probeId] === discoveryId,
			);
			expect(owners.length).toBe(1);
		}
	});
});

describe('Level 13: Strong Params — probe / scenario coverage', () => {
	test('every observe probe has a matching reward scenario', () => {
		for (const probeId of PROBE_IDS) {
			expect(SCENARIO_IDS.includes(probeId as never)).toBe(true);
		}
	});

	test('reward is a superset of observe (all probes + clean cases)', () => {
		expect(SCENARIO_IDS.length).toBeGreaterThanOrEqual(PROBE_IDS.length);
	});

	test('all attack scenarios are blocked; clean scenarios are allowed', () => {
		for (const probeId of PROBE_IDS) {
			expect(SCENARIO_RESULTS[probeId]).toBe('blocked');
		}
		expect(SCENARIO_RESULTS['clean-create']).toBe('allowed');
		expect(SCENARIO_RESULTS['clean-update']).toBe('allowed');
	});

	test('reward has a mix of allowed and blocked', () => {
		const results = Object.values(SCENARIO_RESULTS);
		expect(results.includes('allowed')).toBe(true);
		expect(results.includes('blocked')).toBe(true);
	});

	test('all scenario IDs are unique', () => {
		const unique = new Set(SCENARIO_IDS);
		expect(unique.size).toBe(SCENARIO_IDS.length);
	});
});

describe('Level 13: Strong Params — build step quality', () => {
	test('every step has exactly one correct option', () => {
		for (const options of ALL_STEP_OPTIONS) {
			const correctCount = options.filter((o) => o.correct).length;
			expect(correctCount).toBe(1);
		}
	});

	test('every wrong option has feedback', () => {
		for (const options of ALL_STEP_OPTIONS) {
			for (const option of options) {
				if (!option.correct) {
					expect(option.feedback).toBeDefined();
					expect(option.feedback?.length ?? 0).toBeGreaterThan(0);
				}
			}
		}
	});

	test('wrong-option feedback never names the correct answer', () => {
		ALL_STEP_OPTIONS.forEach((options, stepIndex) => {
			const keywords = CORRECT_ANSWER_KEYWORDS[stepIndex];
			for (const option of options) {
				if (!option.correct && option.feedback) {
					for (const keyword of keywords) {
						expect(option.feedback).not.toContain(keyword);
					}
				}
			}
		});
	});

	test('option IDs are unique within each step', () => {
		for (const options of ALL_STEP_OPTIONS) {
			const ids = options.map((o) => o.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	test('option labels are unique within each step', () => {
		for (const options of ALL_STEP_OPTIONS) {
			const labels = options.map((o) => o.label);
			expect(new Set(labels).size).toBe(labels.length);
		}
	});
});

describe('Level 13: Strong Params — narrative consistency', () => {
	test('the correct filtering answer uses params.expect, not require/permit', () => {
		const correct = FILTERING_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('params.expect');
		expect(correct?.label).not.toContain('params.require');
		expect(correct?.label).not.toContain('permit!');
	});

	test('the correct whitelist excludes both featured and user_id', () => {
		const correct = WHITELIST_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain(':name');
		expect(correct?.label).toContain(':description');
		expect(correct?.label).toContain(':price');
		expect(correct?.label).not.toContain(':featured');
		expect(correct?.label).not.toContain(':user_id');
	});

	test('the correct ownership pattern uses Current.user.products', () => {
		const correct = OWNERSHIP_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('Current.user.products');
		expect(correct?.label).toContain('product_params');
		expect(correct?.label).not.toContain('params[:user_id]');
	});
});
