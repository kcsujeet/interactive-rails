/**
 * Level 34: Locking (Concurrency Control) - Data Consistency Tests
 *
 * Tests mirror the data structures from the component to verify:
 * - Discovery definitions are complete and correctly mapped
 * - Probe definitions have proper response lines
 * - Build step quality (correct answer position, feedback quality)
 * - Stress test scenario coverage and consistency
 * - Cross-phase consistency (probe labels match stress test labels)
 * - Cumulative pattern compliance (service objects, contracts, error handling)
 */

import { describe, expect, test } from 'bun:test';

// ── Mirror data from component ──

const DISCOVERY_DEFS = [
	{ id: 'lost-update', label: "User A's deduction silently vanishes" },
	{
		id: 'stale-read',
		label: 'Both users read the same outdated balance',
	},
	{
		id: 'no-lock',
		label: 'No mechanism prevents simultaneous row access',
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'concurrent-deduct': ['lost-update', 'stale-read'],
	'stale-edit': ['no-lock'],
};

const PROBES = [
	{
		id: 'concurrent-deduct',
		label: 'Concurrent deductions',
		command: '# User A: deduct $30, User B: deduct $50 (simultaneously)',
		responseLines: [
			{ text: 'User A: Account.find(1) => balance: $100', color: 'cyan' },
			{ text: 'User B: Account.find(1) => balance: $100', color: 'cyan' },
			{ text: 'User A: balance -= 30 => saves $70', color: 'yellow' },
			{ text: 'User B: balance -= 50 => saves $50', color: 'red' },
			{ text: 'Final balance: $50 (should be $20!)', color: 'red' },
			{
				text: "User A's $30 deduction was silently lost!",
				color: 'red',
			},
		],
	},
	{
		id: 'stale-edit',
		label: 'Stale profile edit',
		command: '# Two admins edit the same user profile simultaneously',
		responseLines: [
			{
				text: 'Admin A: User.find(1) => lock_version: nil',
				color: 'cyan',
			},
			{
				text: 'Admin B: User.find(1) => lock_version: nil',
				color: 'cyan',
			},
			{
				text: "Admin A: updates name to 'Alice'   => saved",
				color: 'yellow',
			},
			{
				text: "Admin B: updates name to 'Bob'     => saved (overwrites!)",
				color: 'red',
			},
			{
				text: 'No lock_version column means no conflict detection.',
				color: 'red',
			},
		],
	},
];

const STEP_DEFS = [
	{ id: 'add-lock-version', title: 'Add Lock Version Column' },
	{ id: 'run-migration', title: 'Run Migration' },
	{ id: 'add-pessimistic-lock', title: 'Add Row Lock' },
	{ id: 'build-service', title: 'Build Deduction Service' },
	{ id: 'handle-stale-error', title: 'Handle Conflicts' },
];

const LOCK_VERSION_COMMANDS = [
	{
		id: 'wrong-boolean',
		label: 'rails g migration AddLockedToAccounts locked:boolean',
		correct: false,
		feedback:
			'A boolean flag cannot detect concurrent modifications. Optimistic locking needs a column that tracks how many times a record has been saved.',
	},
	{
		id: 'wrong-timestamp',
		label: 'rails g migration AddUpdatedAtToAccounts updated_at:datetime',
		correct: false,
		feedback:
			'Timestamps have precision issues with concurrent writes. Rails needs an auto-incrementing counter to detect exact version mismatches.',
	},
	{
		id: 'correct-lock-version',
		label: 'rails g migration AddLockVersionToAccounts lock_version:integer',
		correct: true,
	},
];

const MIGRATE_COMMANDS = [
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		correct: false,
		feedback:
			'Seeding populates the database with sample data. The migration file still needs to be applied to the schema.',
	},
	{
		id: 'wrong-reset',
		label: 'rails db:reset',
		correct: false,
		feedback:
			'Resetting drops and recreates the database from schema.rb. That discards all existing data. You just need to apply the pending migration.',
	},
	{
		id: 'correct-migrate',
		label: 'rails db:migrate',
		correct: true,
	},
];

const PESSIMISTIC_OPTIONS = [
	{
		id: 'wrong-find-only',
		correct: false,
		feedback:
			'A plain find does not acquire a row lock. Another transaction can read and modify the same row concurrently, causing a lost update.',
	},
	{ id: 'correct-lock', correct: true },
	{
		id: 'wrong-with-lock-outside',
		correct: false,
		feedback:
			'The audit log creation is outside the lock block. If it fails, the balance was already changed. All related writes must be inside the same locked transaction.',
	},
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

const STALE_ERROR_OPTIONS = [
	{
		id: 'wrong-ignore',
		correct: false,
		feedback:
			'Without handling StaleObjectError, the second writer silently overwrites the first. Optimistic locking requires catching and retrying or reporting the conflict.',
	},
	{ id: 'correct-rescue-retry', correct: true },
	{
		id: 'wrong-pessimistic-everywhere',
		correct: false,
		feedback:
			'Pessimistic locking for low-contention profile edits is overkill. It blocks concurrent reads and can cause deadlocks. Use optimistic locking (lock_version) with StaleObjectError handling instead.',
	},
];

const STRESS_SCENARIOS = [
	{
		id: 'single-deduct',
		label: 'POST deduct $30',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'concurrent-deduct-locked',
		label: 'POST concurrent deductions (locked)',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'transfer',
		label: 'POST transfer $50 between accounts',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'insufficient-funds',
		label: 'POST deduct $200 (insufficient)',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'stale-profile-edit',
		label: 'PATCH profile (stale version)',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'invalid-amount',
		label: 'POST deduct -$10 (invalid)',
		expectedResult: 'blocked' as const,
	},
];

// ── Tests ──

describe('Level 34: Locking (Concurrency Control)', () => {
	describe('Discovery definitions', () => {
		test('has exactly 3 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(3);
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

		test('concurrent-deduct probe shows both users reading stale balance', () => {
			const probe = PROBES.find((p) => p.id === 'concurrent-deduct');
			const texts = probe?.responseLines.map((l) => l.text).join(' ') ?? '';
			expect(texts).toContain('User A');
			expect(texts).toContain('User B');
			expect(texts).toContain('$100');
		});
	});

	describe('Build step quality', () => {
		test('has exactly 5 build steps', () => {
			expect(STEP_DEFS).toHaveLength(5);
		});

		test('all step IDs are unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('step titles do not reveal specific method names', () => {
			for (const step of STEP_DEFS) {
				expect(step.title).not.toContain('lock_version');
				expect(step.title).not.toContain('with_lock');
				expect(step.title).not.toContain('StaleObjectError');
			}
		});

		test('correct lock_version command is never first', () => {
			const correctIdx = LOCK_VERSION_COMMANDS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct migrate command is never first', () => {
			const correctIdx = MIGRATE_COMMANDS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct pessimistic lock option is never first', () => {
			const correctIdx = PESSIMISTIC_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct service option is never first', () => {
			const correctIdx = SERVICE_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct stale error option is never first', () => {
			const correctIdx = STALE_ERROR_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('each step has exactly one correct answer', () => {
			const allStepOptions = [
				LOCK_VERSION_COMMANDS,
				MIGRATE_COMMANDS,
				PESSIMISTIC_OPTIONS,
				SERVICE_OPTIONS,
				STALE_ERROR_OPTIONS,
			];
			for (const options of allStepOptions) {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			}
		});

		test('every wrong option has feedback', () => {
			const allStepOptions = [
				LOCK_VERSION_COMMANDS,
				MIGRATE_COMMANDS,
				PESSIMISTIC_OPTIONS,
				SERVICE_OPTIONS,
				STALE_ERROR_OPTIONS,
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
				...LOCK_VERSION_COMMANDS.filter((o) => !o.correct),
				...MIGRATE_COMMANDS.filter((o) => !o.correct),
				...PESSIMISTIC_OPTIONS.filter((o) => !o.correct),
				...SERVICE_OPTIONS.filter((o) => !o.correct),
				...STALE_ERROR_OPTIONS.filter((o) => !o.correct),
			];
			for (const opt of allWrongOptions) {
				const fb = opt.feedback?.toLowerCase() ?? '';
				expect(fb).not.toContain('lock_version:integer');
				expect(fb).not.toContain('account.lock.find');
				expect(fb).not.toContain('rails db:migrate');
				expect(fb).not.toContain('lock_version column');
			}
		});

		test('terminal steps are 0-1, option steps are 2-4', () => {
			expect(STEP_DEFS[0].id).toBe('add-lock-version');
			expect(STEP_DEFS[1].id).toBe('run-migration');
			expect(STEP_DEFS[2].id).toBe('add-pessimistic-lock');
			expect(STEP_DEFS[3].id).toBe('build-service');
			expect(STEP_DEFS[4].id).toBe('handle-stale-error');
		});
	});

	describe('Stress test scenarios', () => {
		test('has 6 scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(6);
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

		test('has 3 allowed and 3 blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed).toHaveLength(3);
			expect(blocked).toHaveLength(3);
		});

		test('includes concurrent deduction scenario (reward mirrors observe)', () => {
			const concurrent = STRESS_SCENARIOS.find(
				(s) => s.id === 'concurrent-deduct-locked',
			);
			expect(concurrent).toBeDefined();
			expect(concurrent?.expectedResult).toBe('allowed');
		});

		test('includes insufficient funds validation', () => {
			const insufficient = STRESS_SCENARIOS.find(
				(s) => s.id === 'insufficient-funds',
			);
			expect(insufficient).toBeDefined();
			expect(insufficient?.expectedResult).toBe('blocked');
		});

		test('includes optimistic locking conflict scenario', () => {
			const stale = STRESS_SCENARIOS.find((s) => s.id === 'stale-profile-edit');
			expect(stale).toBeDefined();
			expect(stale?.expectedResult).toBe('blocked');
		});

		test('includes contract validation scenario (invalid amount)', () => {
			const invalid = STRESS_SCENARIOS.find((s) => s.id === 'invalid-amount');
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

		test('concurrent deduction appears in both observe and reward', () => {
			const observeProbe = PROBES.find((p) => p.id === 'concurrent-deduct');
			const rewardScenario = STRESS_SCENARIOS.find(
				(s) => s.id === 'concurrent-deduct-locked',
			);
			expect(observeProbe).toBeDefined();
			expect(rewardScenario).toBeDefined();
		});

		test('reward scenarios cover both locking strategies from build phase', () => {
			// Pessimistic locking (financial ops)
			const pessimistic = STRESS_SCENARIOS.find(
				(s) => s.id === 'concurrent-deduct-locked',
			);
			expect(pessimistic).toBeDefined();
			// Optimistic locking (profile edits)
			const optimistic = STRESS_SCENARIOS.find(
				(s) => s.id === 'stale-profile-edit',
			);
			expect(optimistic).toBeDefined();
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

		test('stale error handler uses standard error shape', () => {
			const correct = STALE_ERROR_OPTIONS.find((o) => o.correct);
			expect(correct?.id).toBe('correct-rescue-retry');
		});

		test('wrong stale error options explain why they fail', () => {
			const ignore = STALE_ERROR_OPTIONS.find((o) => o.id === 'wrong-ignore');
			expect(ignore?.feedback).toContain('StaleObjectError');

			const pessimistic = STALE_ERROR_OPTIONS.find(
				(o) => o.id === 'wrong-pessimistic-everywhere',
			);
			expect(pessimistic?.feedback).toContain('optimistic locking');
		});
	});

	describe('Data consistency', () => {
		test('minRequired (3) matches total discoveries', () => {
			expect(DISCOVERY_DEFS.length).toBe(3);
		});

		test('all option step arrays have at least 2 options', () => {
			expect(PESSIMISTIC_OPTIONS.length).toBeGreaterThanOrEqual(2);
			expect(SERVICE_OPTIONS.length).toBeGreaterThanOrEqual(2);
			expect(STALE_ERROR_OPTIONS.length).toBeGreaterThanOrEqual(2);
		});

		test('step progression follows logical order', () => {
			const stepIds = STEP_DEFS.map((s) => s.id);
			expect(stepIds.indexOf('add-lock-version')).toBeLessThan(
				stepIds.indexOf('run-migration'),
			);
			expect(stepIds.indexOf('run-migration')).toBeLessThan(
				stepIds.indexOf('add-pessimistic-lock'),
			);
			expect(stepIds.indexOf('add-pessimistic-lock')).toBeLessThan(
				stepIds.indexOf('build-service'),
			);
			expect(stepIds.indexOf('build-service')).toBeLessThan(
				stepIds.indexOf('handle-stale-error'),
			);
		});
	});
});
