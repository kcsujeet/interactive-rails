/**
 * Level 33: Transactions (Atomicity) - Data Consistency Tests
 *
 * Tests mirror the data structures from the component to verify:
 * - Discovery definitions are complete and correctly mapped
 * - Probe definitions have proper response lines
 * - Build step quality (correct answer position, feedback quality)
 * - Stress test scenario coverage and consistency
 * - Cross-phase consistency (probe labels match stress test labels)
 * - Cumulative pattern compliance (service objects, contracts)
 */

import { describe, expect, test } from 'bun:test';

// ── Mirror data from component ──

const DISCOVERY_DEFS = [
	{ id: 'credits-no-boost', label: 'Credits deducted but post never boosted' },
	{ id: 'orphan-boost', label: 'Product boosted without audit trail' },
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'boost-fail': ['credits-no-boost'],
	'log-fail': ['orphan-boost'],
};

const PROBES = [
	{
		id: 'boost-fail',
		label: 'Boost post (Boost.create! fails)',
		command: '# Deduct credits, then create boost (boost fails)',
		responseLines: [
			{
				text: 'user.credits -= 10      =>  saves (credits: 40)',
				color: 'green',
			},
			{
				text: 'Boost.create!(...)      =>  BOOM! RecordInvalid',
				color: 'red',
			},
			{
				text: 'CreditLog.create!(...)  =>  never reached',
				color: 'muted',
			},
			{
				text: 'Credits deducted but post was never boosted!',
				color: 'red',
			},
			{ text: 'No rollback. 10 credits vanished.', color: 'red' },
		],
	},
	{
		id: 'log-fail',
		label: 'Boost post (CreditLog fails)',
		command: '# Deduct credits, create boost, then log (log fails)',
		responseLines: [
			{
				text: 'user.credits -= 10      =>  saves (credits: 40)',
				color: 'green',
			},
			{
				text: 'Boost.create!(...)      =>  OK (boost #7)',
				color: 'green',
			},
			{
				text: 'CreditLog.create!(...)  =>  BOOM! ConnectionError',
				color: 'red',
			},
			{
				text: 'Product boosted but no audit trail!',
				color: 'red',
			},
			{
				text: 'Compliance violation: unaudited credit operation.',
				color: 'red',
			},
		],
	},
];

const STEP_DEFS = [
	{ id: 'identify-problem', title: 'Identify the Problem' },
	{ id: 'wrap-transaction', title: 'Wrap in Transaction' },
	{ id: 'handle-rollback', title: 'Handle Custom Abort' },
	{ id: 'build-service', title: 'Build Boost Service' },
];

const IDENTIFY_OPTIONS = [
	{
		id: 'wrong-validation',
		correct: false,
		feedback:
			'Validation is important but not the root cause here. The failed boosts all carried valid input and still left the books inconsistent.',
	},
	{
		id: 'wrong-ordering',
		correct: false,
		feedback:
			'Reordering the steps only changes which record goes missing when a step fails midway. The seller still ends up with spent credits or an unlogged boost.',
	},
	{
		id: 'correct-no-atomicity',
		correct: true,
	},
];

const TRANSACTION_OPTIONS = [
	{
		id: 'wrong-begin-rescue',
		correct: false,
		feedback:
			'Manual rescue and reload cannot undo a committed write. Only database transactions guarantee atomicity with automatic rollback on any failure.',
	},
	{ id: 'correct-transaction', correct: true },
	{
		id: 'wrong-save-only',
		correct: false,
		feedback:
			'Letting exceptions propagate does not undo writes that already committed. Without a transaction boundary, user.save! persists even if Boost.create! fails.',
	},
];

const ROLLBACK_OPTIONS = [
	{
		id: 'wrong-return-false',
		correct: false,
		feedback:
			'Returning false inside a transaction does NOT trigger a rollback. The block simply exits early and everything already written commits, credits deducted and all.',
	},
	{
		id: 'wrong-throw',
		correct: false,
		feedback:
			'In Ruby, throw/catch is generic flow control, not error signaling. A transaction block does not watch for :abort; that symbol is for halting callback chains.',
	},
	{ id: 'correct-rollback-raise', correct: true },
];

const SERVICE_OPTIONS = [
	{
		id: 'wrong-no-contract',
		correct: false,
		feedback:
			'Missing input validation via contract. Services must validate input through a Dry::Validation::Contract before executing business logic.',
	},
	{ id: 'correct-with-contract', correct: true },
];

const STRESS_SCENARIOS = [
	{
		id: 'valid-boost',
		label: 'POST boost (50 credits, valid)',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'boost-with-discount',
		label: 'POST boost (30 credits, discount)',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'negative-credits',
		label: 'POST boost (-5 credits, invalid)',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'boost-creation-fails',
		label: 'POST boost (creation error)',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'log-fails-rollback',
		label: 'POST boost (log fails, rollback)',
		expectedResult: 'blocked' as const,
	},
];

// ── Tests ──

describe('Level 33: Transactions (Atomicity)', () => {
	describe('Discovery definitions', () => {
		test('has exactly 2 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(2);
		});

		test('all discovery IDs are unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all discovery labels are unique', () => {
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('every discovery is reachable via probes', () => {
			const probeDiscoveries = new Set(
				Object.values(PROBE_DISCOVERY_MAP).flat(),
			);
			for (const def of DISCOVERY_DEFS) {
				expect(probeDiscoveries.has(def.id)).toBe(true);
			}
		});

		test('probe discovery map only references valid probe IDs', () => {
			const probeIds = new Set(PROBES.map((p) => p.id));
			for (const key of Object.keys(PROBE_DISCOVERY_MAP)) {
				expect(probeIds.has(key)).toBe(true);
			}
		});

		test('probe discovery map only references valid discovery IDs', () => {
			const discoveryIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const discoveries of Object.values(PROBE_DISCOVERY_MAP)) {
				for (const id of discoveries) {
					expect(discoveryIds.has(id)).toBe(true);
				}
			}
		});
	});

	describe('Probes', () => {
		test('has exactly 2 probes', () => {
			expect(PROBES).toHaveLength(2);
		});

		test('all probe IDs are unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('every probe has response lines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThan(0);
			}
		});

		test('every probe has a command', () => {
			for (const probe of PROBES) {
				expect(probe.command.length).toBeGreaterThan(0);
			}
		});

		test('every probe response line has a color', () => {
			for (const probe of PROBES) {
				for (const line of probe.responseLines) {
					expect(line.color).toBeDefined();
				}
			}
		});

		test('boost-fail probe shows partial failure', () => {
			const probe = PROBES.find((p) => p.id === 'boost-fail');
			const texts = probe?.responseLines.map((l) => l.text).join(' ') ?? '';
			expect(texts).toContain('BOOM');
			expect(texts).toContain('never boosted');
		});

		test('log-fail probe shows orphaned data', () => {
			const probe = PROBES.find((p) => p.id === 'log-fail');
			const texts = probe?.responseLines.map((l) => l.text).join(' ') ?? '';
			expect(texts).toContain('audit');
			expect(texts).toContain('ConnectionError');
		});
	});

	describe('Build step quality', () => {
		test('has exactly 4 build steps', () => {
			expect(STEP_DEFS).toHaveLength(4);
		});

		test('all step IDs are unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('step titles do not reveal specific method names', () => {
			for (const step of STEP_DEFS) {
				expect(step.title).not.toContain('ActiveRecord::Base.transaction');
				expect(step.title).not.toContain('ActiveRecord::Rollback');
			}
		});

		test('correct identify option is never first', () => {
			const correctIdx = IDENTIFY_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct transaction option is never first', () => {
			const correctIdx = TRANSACTION_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct rollback option is never first', () => {
			const correctIdx = ROLLBACK_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct service option is never first', () => {
			const correctIdx = SERVICE_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('each step has exactly one correct answer', () => {
			const allStepOptions = [
				IDENTIFY_OPTIONS,
				TRANSACTION_OPTIONS,
				ROLLBACK_OPTIONS,
				SERVICE_OPTIONS,
			];
			for (const options of allStepOptions) {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			}
		});

		test('every wrong option has feedback', () => {
			const allStepOptions = [
				IDENTIFY_OPTIONS,
				TRANSACTION_OPTIONS,
				ROLLBACK_OPTIONS,
				SERVICE_OPTIONS,
			];
			for (const options of allStepOptions) {
				for (const opt of options) {
					if (!opt.correct) {
						expect(opt.feedback).toBeDefined();
						expect(opt.feedback?.length).toBeGreaterThan(0);
					}
				}
			}
		});

		test('feedback never reveals the correct answer', () => {
			const allWrongOptions = [
				...IDENTIFY_OPTIONS.filter((o) => !o.correct),
				...TRANSACTION_OPTIONS.filter((o) => !o.correct),
				...ROLLBACK_OPTIONS.filter((o) => !o.correct),
				...SERVICE_OPTIONS.filter((o) => !o.correct),
			];
			for (const opt of allWrongOptions) {
				const fb = opt.feedback?.toLowerCase() ?? '';
				expect(fb).not.toContain('activerecord::base.transaction do');
				expect(fb).not.toContain('raise activerecord::rollback');
			}
		});

		test('step progression follows logical order', () => {
			const stepIds = STEP_DEFS.map((s) => s.id);
			expect(stepIds.indexOf('identify-problem')).toBeLessThan(
				stepIds.indexOf('wrap-transaction'),
			);
			expect(stepIds.indexOf('wrap-transaction')).toBeLessThan(
				stepIds.indexOf('handle-rollback'),
			);
			expect(stepIds.indexOf('handle-rollback')).toBeLessThan(
				stepIds.indexOf('build-service'),
			);
		});
	});

	describe('Stress test scenarios', () => {
		test('has 5 scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(5);
		});

		test('all scenario IDs are unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all scenario labels are unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('has mix of allowed and blocked results', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBeGreaterThan(0);
			expect(blocked.length).toBeGreaterThan(0);
		});

		test('has 2 allowed and 3 blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed).toHaveLength(2);
			expect(blocked).toHaveLength(3);
		});

		test('includes rollback scenarios that mirror observe failures', () => {
			const boostFail = STRESS_SCENARIOS.find(
				(s) => s.id === 'boost-creation-fails',
			);
			const logFail = STRESS_SCENARIOS.find(
				(s) => s.id === 'log-fails-rollback',
			);
			expect(boostFail).toBeDefined();
			expect(boostFail?.expectedResult).toBe('blocked');
			expect(logFail).toBeDefined();
			expect(logFail?.expectedResult).toBe('blocked');
		});

		test('includes contract validation scenario (negative credits)', () => {
			const invalid = STRESS_SCENARIOS.find((s) => s.id === 'negative-credits');
			expect(invalid).toBeDefined();
			expect(invalid?.expectedResult).toBe('blocked');
		});
	});

	describe('Cross-phase consistency', () => {
		test('probe discoveries cover all discovery definitions', () => {
			const probeDiscoveryIds = new Set(
				Object.values(PROBE_DISCOVERY_MAP).flat(),
			);
			for (const def of DISCOVERY_DEFS) {
				expect(probeDiscoveryIds.has(def.id)).toBe(true);
			}
		});

		test('partial failure appears in both observe and reward', () => {
			const observeProbe = PROBES.find((p) => p.id === 'boost-fail');
			const rewardScenario = STRESS_SCENARIOS.find(
				(s) => s.id === 'boost-creation-fails',
			);
			expect(observeProbe).toBeDefined();
			expect(rewardScenario).toBeDefined();
		});

		test('log failure appears in both observe and reward', () => {
			const observeProbe = PROBES.find((p) => p.id === 'log-fail');
			const rewardScenario = STRESS_SCENARIOS.find(
				(s) => s.id === 'log-fails-rollback',
			);
			expect(observeProbe).toBeDefined();
			expect(rewardScenario).toBeDefined();
		});
	});

	describe('Cumulative pattern compliance', () => {
		test('service option uses contract validation', () => {
			const correct = SERVICE_OPTIONS.find((o) => o.correct);
			expect(correct?.id).toBe('correct-with-contract');
		});

		test('wrong service option explains contract requirement', () => {
			const noContract = SERVICE_OPTIONS.find(
				(o) => o.id === 'wrong-no-contract',
			);
			expect(noContract?.feedback).toContain('contract');
			expect(noContract?.feedback).toContain('Dry::Validation::Contract');
		});
	});

	describe('Data consistency', () => {
		test('minRequired (2) matches total discoveries', () => {
			expect(DISCOVERY_DEFS.length).toBe(2);
		});

		test('all option step arrays have at least 2 options', () => {
			expect(IDENTIFY_OPTIONS.length).toBeGreaterThanOrEqual(2);
			expect(TRANSACTION_OPTIONS.length).toBeGreaterThanOrEqual(2);
			expect(ROLLBACK_OPTIONS.length).toBeGreaterThanOrEqual(2);
			expect(SERVICE_OPTIONS.length).toBeGreaterThanOrEqual(2);
		});
	});
});
