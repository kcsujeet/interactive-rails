import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level31SoftDeletes.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'hard-delete', label: 'Records are permanently destroyed' },
	{ id: 'no-undo', label: 'No way to restore deleted data' },
	{ id: 'no-audit', label: 'No record of who changed what' },
];

const PROBES = [
	{
		id: 'hard-delete',
		label: 'Admin deletes customer (hard delete)',
		command: 'User.find(42).destroy',
		responseLines: [
			{ text: 'DELETE FROM users WHERE id = 42', color: 'red' },
			{
				text: '# Row removed from database permanently',
				color: 'red',
			},
			{
				text: '# Associated orders, reviews, payments: CASCADE deleted',
				color: 'red',
			},
			{ text: '# No way to recover', color: 'red' },
		],
	},
	{
		id: 'no-restore',
		label: 'Restore accidentally deleted product',
		command: 'Product.find(99)  # after destroy',
		responseLines: [
			{ text: 'ActiveRecord::RecordNotFound', color: 'red' },
			{
				text: '# Product was destroyed. Customers see 404.',
				color: 'red',
			},
			{
				text: '# No "undo" method. No soft delete flag.',
				color: 'red',
			},
			{
				text: '# Must re-create from scratch (if you remember the data)',
				color: 'red',
			},
		],
	},
	{
		id: 'no-audit',
		label: 'Who changed the order status?',
		command:
			'Order.find(7).status  # changed from "paid" to "refunded" but by whom?',
		responseLines: [
			{ text: '=> "refunded"', color: 'yellow' },
			{
				text: '# Status was "paid" yesterday. Now "refunded".',
				color: 'yellow',
			},
			{ text: '# No version history. No audit log.', color: 'red' },
			{ text: '# Who changed it? When? Why?', color: 'red' },
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'hard-delete': ['hard-delete'],
	'no-restore': ['no-undo'],
	'no-audit': ['no-audit'],
};

// ── Build step options ──

const ADD_DISCARD_COMMANDS = [
	{
		id: 'wrong-paranoia',
		label: 'bundle add paranoia',
		correct: false,
		feedback:
			'Paranoia overrides destroy globally and uses acts_as_paranoid which conflicts with Rails conventions. The modern alternative is explicit and non-invasive, letting existing code work unchanged.',
	},
	{
		id: 'correct',
		label: 'bundle add discard',
		correct: true,
	},
	{
		id: 'wrong-deleted-at',
		label: 'rails g migration AddDeletedAtToUsers deleted_at:datetime',
		correct: false,
		feedback:
			'The column name should be discarded_at (Discard convention), not deleted_at. Install the gem first, then add the column.',
	},
];

const ADD_COLUMN_COMMANDS = [
	{
		id: 'correct',
		label: 'rails g migration AddDiscardToUsers discarded_at:datetime:index',
		correct: true,
	},
	{
		id: 'wrong-no-index',
		label: 'rails g migration AddDiscardToUsers discarded_at:datetime',
		correct: false,
		feedback:
			'Without an index on discarded_at, every query filtering by discard status requires a full table scan. Add :index for performance.',
	},
	{
		id: 'wrong-boolean',
		label: 'rails g migration AddDeletedToUsers deleted:boolean',
		correct: false,
		feedback:
			'A boolean flag loses the timestamp of when the record was discarded. Discard uses discarded_at:datetime so you know exactly when it was soft-deleted.',
	},
];

const CONFIGURE_MODEL_OPTIONS = [
	{
		id: 'wrong-acts-as',
		label: 'acts_as_paranoid in model',
		correct: false,
		feedback:
			'acts_as_paranoid (from the paranoia gem) overrides destroy for ALL callers. The better approach is explicit: you choose when to soft-delete, so existing code still works.',
	},
	{
		id: 'correct',
		label: 'include Discard::Model',
		correct: true,
	},
	{
		id: 'wrong-custom',
		label: 'Custom soft delete with scope',
		correct: false,
		feedback:
			'A custom implementation misses helpers like undiscard!, discarded?, and the kept/discarded scopes. The Discard gem provides all of this with one include.',
	},
];

const UPDATE_QUERIES_OPTIONS = [
	{
		id: 'wrong-default-scope',
		label: 'Use default_scope to hide discarded',
		correct: false,
		feedback:
			'default_scope applies to ALL queries including admin panels and background jobs. Use explicit .kept scope in controllers so you can access discarded records when needed.',
	},
	{
		id: 'wrong-no-change',
		label: 'No query changes (show discarded to everyone)',
		correct: false,
		feedback:
			'Without filtering, API consumers see discarded records in listings. Public-facing queries must use .kept to exclude soft-deleted records.',
	},
	{
		id: 'correct',
		label: 'Use .kept scope in public queries, .with_discarded in admin',
		correct: true,
	},
];

const ADD_PAPER_TRAIL_COMMANDS = [
	{
		id: 'correct',
		label:
			'bundle add paper_trail && rails generate paper_trail:install && rails db:migrate',
		correct: true,
	},
	{
		id: 'wrong-audited',
		label: 'bundle add audited',
		correct: false,
		feedback:
			'Audited is an alternative, but the more widely adopted versioning gem has better Rails 8 support and integrates with whodunnit tracking out of the box.',
	},
	{
		id: 'wrong-no-generator',
		label: 'bundle add paper_trail',
		correct: false,
		feedback:
			'PaperTrail needs a versions table. After installing the gem, run the generator to create the migration, then migrate.',
	},
];

const CONFIGURE_AUDIT_OPTIONS = [
	{
		id: 'wrong-no-whodunnit',
		label: 'Enable PaperTrail without whodunnit',
		correct: false,
		feedback:
			'Without whodunnit, you know WHAT changed but not WHO changed it. Set PaperTrail.request.whodunnit in your controller to track the acting user.',
	},
	{
		id: 'correct',
		label: 'PaperTrail with whodunnit in controller',
		correct: true,
	},
	{
		id: 'wrong-only-create',
		label: 'Track only create events',
		correct: false,
		feedback:
			'Tracking only creates misses the most important events: updates and deletes. The audit trail exists to answer "who changed this?" which requires tracking all mutations.',
	},
];

const ALL_OPTION_SETS = [
	{ name: 'ADD_DISCARD_COMMANDS', options: ADD_DISCARD_COMMANDS },
	{ name: 'ADD_COLUMN_COMMANDS', options: ADD_COLUMN_COMMANDS },
	{ name: 'CONFIGURE_MODEL_OPTIONS', options: CONFIGURE_MODEL_OPTIONS },
	{ name: 'UPDATE_QUERIES_OPTIONS', options: UPDATE_QUERIES_OPTIONS },
	{ name: 'ADD_PAPER_TRAIL_COMMANDS', options: ADD_PAPER_TRAIL_COMMANDS },
	{ name: 'CONFIGURE_AUDIT_OPTIONS', options: CONFIGURE_AUDIT_OPTIONS },
];

const STRESS_SCENARIOS = [
	{
		id: 'hard-delete',
		label: 'Admin soft-deletes customer (recoverable)',
		description: 'Record marked as discarded, not destroyed',
		method: 'DELETE',
		path: '/api/v1/users/42',
		actor: 'admin',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'UPDATE users SET discarded_at = NOW() WHERE id = 42',
				color: 'green',
			},
			{
				text: '# Row still in database. Can restore with undiscard!',
				color: 'green',
			},
		],
	},
	{
		id: 'no-restore',
		label: 'Restore accidentally deleted product',
		description: 'Product restored from soft-deleted state',
		method: 'POST',
		path: '/api/v1/products/99/restore',
		actor: 'admin',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'UPDATE products SET discarded_at = NULL WHERE id = 99',
				color: 'green',
			},
			{
				text: '# Product restored! Customers can see it again.',
				color: 'green',
			},
		],
	},
	{
		id: 'no-audit',
		label: 'Check who changed order status (with PaperTrail)',
		description: 'Full version history with whodunnit',
		method: 'GET',
		path: '/api/v1/orders/7/versions',
		actor: 'admin',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'v1: created by admin_1 at 2026-03-01', color: 'muted' },
			{
				text: 'v2: status -> paid by system at 2026-03-01',
				color: 'green',
			},
			{
				text: 'v3: status -> refunded by admin_2 at 2026-03-02 03:42',
				color: 'yellow',
			},
		],
	},
	{
		id: 'restore-with-trail',
		label: 'Restore user with audit trail',
		description: 'Soft delete and restore both tracked by PaperTrail',
		method: 'POST',
		path: '/api/v1/users/42/restore',
		actor: 'admin',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'User #42 restored by admin_1', color: 'green' },
			{
				text: 'PaperTrail: discard event + undiscard event logged',
				color: 'green',
			},
		],
	},
];

// ── Tests ──

describe('Level 43: Soft Deletes & Audit Trails', () => {
	describe('Discovery definitions', () => {
		test('has exactly 3 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(3);
		});

		test('all IDs unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('specific discovery labels match', () => {
			expect(DISCOVERY_DEFS[0].label).toBe('Records are permanently destroyed');
			expect(DISCOVERY_DEFS[1].label).toBe('No way to restore deleted data');
			expect(DISCOVERY_DEFS[2].label).toBe('No record of who changed what');
		});
	});

	describe('Probe definitions', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES).toHaveLength(3);
		});

		test('all probe IDs unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('each probe has exactly 4 responseLines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines).toHaveLength(4);
			}
		});

		test('exact probe IDs', () => {
			expect(PROBES[0].id).toBe('hard-delete');
			expect(PROBES[1].id).toBe('no-restore');
			expect(PROBES[2].id).toBe('no-audit');
		});
	});

	describe('Probe-to-discovery mapping', () => {
		test('every probe maps to at least one discovery', () => {
			for (const probe of PROBES) {
				const discoveries = PROBE_DISCOVERY_MAP[probe.id];
				expect(Array.isArray(discoveries)).toBe(true);
				expect(discoveries.length).toBeGreaterThanOrEqual(1);
			}
		});

		test('all mapped discovery IDs exist in DISCOVERY_DEFS', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const ids of Object.values(PROBE_DISCOVERY_MAP)) {
				for (const id of ids) {
					expect(validIds.has(id)).toBe(true);
				}
			}
		});

		test('every discovery is reachable via probes', () => {
			const reachable = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});
	});

	describe('Build step quality', () => {
		for (const { name, options } of ALL_OPTION_SETS) {
			describe(name, () => {
				test('has exactly 3 options', () => {
					expect(options).toHaveLength(3);
				});

				test('exactly one correct answer', () => {
					expect(options.filter((o) => o.correct)).toHaveLength(1);
				});

				test('every wrong option has non-empty feedback', () => {
					for (const opt of options) {
						if (!opt.correct) {
							expect(typeof opt.feedback).toBe('string');
							expect((opt.feedback as string).length).toBeGreaterThan(20);
						}
					}
				});

				test('feedback does not reveal "bundle add discard" (correct gem)', () => {
					if (name === 'ADD_DISCARD_COMMANDS') {
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect(
									(opt.feedback as string).includes('bundle add discard'),
								).toBe(false);
							}
						}
					}
				});

				test('feedback does not reveal "Discard::Model" (correct include)', () => {
					if (name === 'CONFIGURE_MODEL_OPTIONS') {
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect(
									(opt.feedback as string).includes('Discard::Model'),
								).toBe(false);
							}
						}
					}
				});

				test('feedback does not reveal "paper_trail:install" (correct generator)', () => {
					if (name === 'ADD_PAPER_TRAIL_COMMANDS') {
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect(
									(opt.feedback as string).includes('paper_trail:install'),
								).toBe(false);
							}
						}
					}
				});

				test('feedback does not reveal "set_paper_trail_whodunnit"', () => {
					if (name === 'CONFIGURE_AUDIT_OPTIONS') {
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect(
									(opt.feedback as string).includes(
										'set_paper_trail_whodunnit',
									),
								).toBe(false);
							}
						}
					}
				});
			});
		}
	});

	describe('Stress scenarios', () => {
		test('has exactly 4 scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(4);
		});

		test('all IDs unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('every scenario has at least 2 responseLines', () => {
			for (const s of STRESS_SCENARIOS) {
				expect(s.responseLines.length).toBeGreaterThanOrEqual(2);
			}
		});

		test('every responseLines entry has non-empty text', () => {
			for (const s of STRESS_SCENARIOS) {
				for (const line of s.responseLines) {
					expect(line.text.length).toBeGreaterThan(0);
				}
			}
		});

		test('all scenarios are allowed (soft delete is always recoverable)', () => {
			for (const s of STRESS_SCENARIOS) {
				expect(s.expectedResult).toBe('allowed');
			}
		});

		test('exact scenario IDs', () => {
			expect(STRESS_SCENARIOS[0].id).toBe('hard-delete');
			expect(STRESS_SCENARIOS[1].id).toBe('no-restore');
			expect(STRESS_SCENARIOS[2].id).toBe('no-audit');
			expect(STRESS_SCENARIOS[3].id).toBe('restore-with-trail');
		});
	});

	describe('Cross-phase consistency', () => {
		test('every probe ID has a matching stress scenario', () => {
			const scenarioIds = new Set(STRESS_SCENARIOS.map((s) => s.id));
			for (const probe of PROBES) {
				expect(scenarioIds.has(probe.id)).toBe(true);
			}
		});

		test('all probe IDs exist in PROBE_DISCOVERY_MAP', () => {
			for (const probe of PROBES) {
				expect(probe.id in PROBE_DISCOVERY_MAP).toBe(true);
			}
		});
	});
});
