import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level43SafeMigrations.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'add-column-lock', label: 'Volatile default rewrites the table' },
	{ id: 'change-column-lock', label: 'change_column rewrites all rows' },
	{
		id: 'add-index-lock',
		label: 'add_index blocks writes during creation',
	},
];

const PROBES = [
	{
		id: 'add-column-default',
		label: 'Add column with volatile default on 5M rows',
		command:
			'rails db:migrate # add_column :orders, :reference_code, :uuid, default: "gen_random_uuid()"',
		responseLines: [
			{
				text: 'ALTER TABLE orders ADD COLUMN reference_code uuid DEFAULT gen_random_uuid()',
				color: 'red',
			},
			{
				text: '# ACCESS EXCLUSIVE lock acquired on orders table',
				color: 'red',
			},
			{
				text: '# Rewriting 5,000,000 rows... 30 seconds',
				color: 'red',
			},
			{
				text: '# All API requests to orders return 500',
				color: 'red',
			},
		],
	},
	{
		id: 'change-column-type',
		label: 'Change column type on orders table',
		command: 'rails db:migrate # change_column :orders, :total, :decimal',
		responseLines: [
			{
				text: 'ALTER TABLE orders ALTER COLUMN total TYPE decimal',
				color: 'red',
			},
			{
				text: '# Exclusive lock held during full table rewrite',
				color: 'red',
			},
			{
				text: '# Every row must be read, converted, and written back',
				color: 'red',
			},
			{
				text: '# 500 errors for all order queries during rewrite',
				color: 'red',
			},
		],
	},
	{
		id: 'add-index-blocking',
		label: 'Add index on large table',
		command: 'rails db:migrate # add_index :orders, :customer_id',
		responseLines: [
			{
				text: 'CREATE INDEX index_orders_on_customer_id ON orders (customer_id)',
				color: 'yellow',
			},
			{
				text: '# SHARE lock acquired: reads OK, writes BLOCKED',
				color: 'red',
			},
			{
				text: '# Building index over 5M rows... 45 seconds',
				color: 'red',
			},
			{
				text: '# INSERT/UPDATE/DELETE on orders queue and timeout',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'add-column-default': ['add-column-lock'],
	'change-column-type': ['change-column-lock'],
	'add-index-blocking': ['add-index-lock'],
};

// ── Build step options ──

const INSTALL_GEM_COMMANDS = [
	{
		id: 'wrong-npm',
		label: 'npm install strong-migrations',
		correct: false,
		feedback:
			'This is a Ruby gem, not a Node.js package. Ruby gems are installed with a different package manager.',
	},
	{
		id: 'correct',
		label: 'bundle add strong_migrations',
		correct: true,
	},
	{
		id: 'wrong-gem-install',
		label: 'gem install strong_migrations',
		correct: false,
		feedback:
			'gem install installs system-wide. For a Rails project, add it to the Gemfile so the dependency is tracked and reproducible.',
	},
];

const RUN_GENERATOR_COMMANDS = [
	{
		id: 'wrong-init',
		label: 'rails generate migration StrongMigrationsSetup',
		correct: false,
		feedback:
			'A standard migration does not create the initializer file. The gem provides its own generator for configuration.',
	},
	{
		id: 'wrong-rake',
		label: 'rake strong_migrations:setup',
		correct: false,
		feedback:
			'There is no rake task for setup. The gem uses the standard Rails generator pattern.',
	},
	{
		id: 'correct',
		label: 'rails generate strong_migrations:install',
		correct: true,
	},
];

const FIX_ADD_COLUMN_OPTIONS = [
	{
		id: 'wrong-disable-lock',
		label: 'Disable lock timeout before adding column',
		correct: false,
		feedback:
			'Disabling lock timeout does not prevent the lock itself. The table is still locked for the entire rewrite. The lock timeout just prevents the migration from failing if another lock is held.',
	},
	{
		id: 'correct',
		label: 'Add column without default, then backfill in batches',
		correct: true,
	},
	{
		id: 'wrong-raw-sql',
		label: 'Use raw SQL ALTER TABLE to add column',
		correct: false,
		feedback:
			'Raw SQL with DEFAULT has the same problem as the Rails helper. PostgreSQL still rewrites every row. The issue is the operation itself, not how you invoke it.',
	},
];

const FIX_CHANGE_COLUMN_OPTIONS = [
	{
		id: 'wrong-in-place',
		label: 'Use SET DATA TYPE with USING clause',
		correct: false,
		feedback:
			'SET DATA TYPE still requires a full table rewrite and exclusive lock, regardless of the USING clause. The data type conversion happens row by row while the table is locked.',
	},
	{
		id: 'wrong-safety-assured',
		label: 'Wrap change_column in safety_assured',
		correct: false,
		feedback:
			'safety_assured only bypasses the strong_migrations check. It does not make the operation safe. The table is still locked during the full rewrite.',
	},
	{
		id: 'correct',
		label: 'Add new column, backfill, then swap',
		correct: true,
	},
];

const FIX_ADD_INDEX_OPTIONS = [
	{
		id: 'wrong-partial',
		label: 'Add a partial index to reduce lock time',
		correct: false,
		feedback:
			'A partial index is smaller but still acquires a SHARE lock during creation. The lock blocks all writes for the entire build duration.',
	},
	{
		id: 'correct',
		label: 'Use algorithm: :concurrently with disable_ddl_transaction!',
		correct: true,
	},
	{
		id: 'wrong-no-disable',
		label: 'Use algorithm: :concurrently without disable_ddl_transaction!',
		correct: false,
		feedback:
			'CONCURRENTLY cannot run inside a transaction. Without disable_ddl_transaction!, Rails wraps the migration in a transaction and PostgreSQL raises an error.',
	},
];

const CONFIGURE_CHECKS_OPTIONS = [
	{
		id: 'wrong-disable-all',
		label: 'Disable all strong_migrations checks',
		correct: false,
		feedback:
			'Disabling all checks defeats the purpose of the gem. Configure it to match your database and start checking from a specific migration version.',
	},
	{
		id: 'wrong-only-timeout',
		label: 'Only set lock_timeout',
		correct: false,
		feedback:
			'Lock timeout alone only fails migrations that take too long to acquire a lock. It does not detect unsafe operations before they run, which is the whole reason the gem is installed.',
	},
	{
		id: 'correct',
		label: 'Set target_version, start_after, and lock_timeout',
		correct: true,
	},
];

const ALL_OPTION_SETS = [
	{ name: 'INSTALL_GEM_COMMANDS', options: INSTALL_GEM_COMMANDS },
	{ name: 'RUN_GENERATOR_COMMANDS', options: RUN_GENERATOR_COMMANDS },
	{ name: 'FIX_ADD_COLUMN_OPTIONS', options: FIX_ADD_COLUMN_OPTIONS },
	{ name: 'FIX_CHANGE_COLUMN_OPTIONS', options: FIX_CHANGE_COLUMN_OPTIONS },
	{ name: 'FIX_ADD_INDEX_OPTIONS', options: FIX_ADD_INDEX_OPTIONS },
	{ name: 'CONFIGURE_CHECKS_OPTIONS', options: CONFIGURE_CHECKS_OPTIONS },
];

const STRESS_SCENARIOS = [
	{
		id: 'add-column-default',
		label: 'Add column with volatile default on 5M rows',
		description: 'Safe: add without default, backfill in batches, set default',
		method: 'MIGRATE',
		path: 'add_column :orders, :reference_code',
		actor: 'developer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'add_column :orders, :reference_code, :uuid (no default)',
				color: 'green',
			},
			{ text: '# No table lock. Column added instantly.', color: 'green' },
			{
				text: '# Backfill in batches, then set default',
				color: 'green',
			},
		],
	},
	{
		id: 'change-column-type',
		label: 'Change column type on orders table',
		description: 'Safe: add new column, backfill, swap reads, drop old',
		method: 'MIGRATE',
		path: 'change_column :orders, :total',
		actor: 'developer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'add_column :orders, :total_decimal, :decimal',
				color: 'green',
			},
			{
				text: '# New column added instantly. No rewrite needed.',
				color: 'green',
			},
			{
				text: '# Backfill + swap in separate deploys',
				color: 'green',
			},
		],
	},
	{
		id: 'add-index-blocking',
		label: 'Add index on large table',
		description: 'Safe: algorithm: :concurrently with disable_ddl_transaction!',
		method: 'MIGRATE',
		path: 'add_index :orders, :customer_id',
		actor: 'developer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'CREATE INDEX CONCURRENTLY index_orders_on_customer_id',
				color: 'green',
			},
			{
				text: '# Only a light lock (SHARE UPDATE EXCLUSIVE): reads and writes continue',
				color: 'green',
			},
			{ text: '# Index built in the background', color: 'green' },
		],
	},
	{
		id: 'validate-constraint',
		label: 'Validate constraint safely',
		description: 'Safe: add NOT VALID constraint, then validate separately',
		method: 'MIGRATE',
		path: 'validate_check_constraint :orders',
		actor: 'developer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'ADD CONSTRAINT ... NOT VALID (instant)',
				color: 'green',
			},
			{
				text: 'VALIDATE CONSTRAINT (light lock, no rewrite)',
				color: 'green',
			},
			{
				text: '# Two-step approach avoids ACCESS EXCLUSIVE lock',
				color: 'green',
			},
		],
	},
	{
		id: 'unsafe-blocked',
		label: 'Ship an unsafe migration (gem catches it)',
		description: 'strong_migrations refuses the volatile default before deploy',
		method: 'MIGRATE',
		path: 'add_column :orders, :reference_code, default: uuid()',
		actor: 'developer',
		expectedResult: 'blocked' as const,
		responseLines: [
			{
				text: 'add_column :orders, :reference_code, :uuid, default: "gen_random_uuid()"',
				color: 'red',
			},
			{
				text: 'StrongMigrations::UnsafeMigration raised, migration aborted',
				color: 'red',
			},
			{
				text: '# The gem stops it before it can lock the table in production',
				color: 'green',
			},
		],
	},
];

// ── Tests ──

describe('Level 44: Safe Migrations', () => {
	describe('Discovery definitions', () => {
		test('has exactly 3 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(3);
		});

		test('all IDs unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('specific discovery labels match', () => {
			expect(DISCOVERY_DEFS[0].label).toBe(
				'Volatile default rewrites the table',
			);
			expect(DISCOVERY_DEFS[1].label).toBe('change_column rewrites all rows');
			expect(DISCOVERY_DEFS[2].label).toBe(
				'add_index blocks writes during creation',
			);
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
			expect(PROBES[0].id).toBe('add-column-default');
			expect(PROBES[1].id).toBe('change-column-type');
			expect(PROBES[2].id).toBe('add-index-blocking');
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

				test('feedback does not reveal "bundle add strong_migrations"', () => {
					if (name === 'INSTALL_GEM_COMMANDS') {
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect(
									(opt.feedback as string).includes(
										'bundle add strong_migrations',
									),
								).toBe(false);
							}
						}
					}
				});

				test('feedback does not reveal "strong_migrations:install"', () => {
					if (name === 'RUN_GENERATOR_COMMANDS') {
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect(
									(opt.feedback as string).includes(
										'strong_migrations:install',
									),
								).toBe(false);
							}
						}
					}
				});

				test('feedback does not reveal "algorithm: :concurrently"', () => {
					if (name === 'FIX_ADD_INDEX_OPTIONS') {
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect(
									(opt.feedback as string).includes('algorithm: :concurrently'),
								).toBe(false);
							}
						}
					}
				});

				test('feedback does not reveal full correct label', () => {
					if (name === 'FIX_ADD_INDEX_OPTIONS') {
						const correctLabel = options.find((o) => o.correct)?.label ?? '';
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect((opt.feedback as string).includes(correctLabel)).toBe(
									false,
								);
							}
						}
					}
				});

				test('feedback does not reveal "target_postgresql_version"', () => {
					if (name === 'CONFIGURE_CHECKS_OPTIONS') {
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect(
									(opt.feedback as string).includes(
										'target_postgresql_version',
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
		test('has exactly 5 scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(5);
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

		test('mix of allowed and blocked (gem visibly blocks an unsafe migration)', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBe(4);
			expect(blocked.length).toBe(1);
			expect(blocked[0].id).toBe('unsafe-blocked');
		});

		test('exact scenario IDs', () => {
			expect(STRESS_SCENARIOS[0].id).toBe('add-column-default');
			expect(STRESS_SCENARIOS[1].id).toBe('change-column-type');
			expect(STRESS_SCENARIOS[2].id).toBe('add-index-blocking');
			expect(STRESS_SCENARIOS[3].id).toBe('validate-constraint');
			expect(STRESS_SCENARIOS[4].id).toBe('unsafe-blocked');
		});

		test('exact scenario labels', () => {
			expect(STRESS_SCENARIOS[0].label).toBe(
				'Add column with volatile default on 5M rows',
			);
			expect(STRESS_SCENARIOS[1].label).toBe(
				'Change column type on orders table',
			);
			expect(STRESS_SCENARIOS[2].label).toBe('Add index on large table');
			expect(STRESS_SCENARIOS[3].label).toBe('Validate constraint safely');
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

	describe('Technical accuracy', () => {
		test('add-column probe is about a volatile default, not a constant', () => {
			const probe = PROBES.find((p) => p.id === 'add-column-default');
			expect(probe?.command?.includes('gen_random_uuid()')).toBe(true);
			// A constant default like DEFAULT 0 is safe on PG11+ and must not be
			// what the probe animates as locking the table.
			expect(probe?.command?.includes('DEFAULT 0')).toBe(false);
		});

		test('CIC scenario does not claim zero lock (it takes a light lock)', () => {
			const s = STRESS_SCENARIOS.find((sc) => sc.id === 'add-index-blocking');
			const joined = (s?.responseLines ?? []).map((l) => l.text).join(' ');
			expect(joined.includes('SHARE UPDATE EXCLUSIVE')).toBe(true);
			expect(joined.includes('No SHARE lock. Reads and writes continue.')).toBe(
				false,
			);
		});
	});
});
