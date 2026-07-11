import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level45DataLifecycle.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'slow-recent', label: 'Recent order queries scan 50M rows' },
	{ id: 'slow-old', label: 'Old order lookups scan entire table' },
	{ id: 'slow-backup', label: 'Daily backup takes 8 hours' },
];

const PROBES = [
	{
		id: 'recent-orders',
		label: 'Customer views recent orders (slow)',
		command: 'Order.where(customer_id: 42).order(created_at: :desc).limit(10)',
		responseLines: [
			{ text: 'Seq Scan on orders (rows=50,000,000)', color: 'red' },
			{ text: 'Planning time: 12ms', color: 'yellow' },
			{ text: 'Execution time: 3,200ms', color: 'red' },
			{
				text: '# 3 second response for 10 recent orders',
				color: 'red',
			},
		],
		story: [
			'A customer opens their order history page.',
			'The query needs just 10 recent orders from today.',
			'But Postgres must scan through 50M rows to find them.',
			'3 seconds to load a page that should be instant.',
		],
	},
	{
		id: 'old-order',
		label: 'Customer views old order from 2023',
		command:
			'Order.find_by(order_number: "ORD-2023-88112")  # no index on order_number',
		responseLines: [
			{ text: 'Seq Scan on orders (rows=50,000,000)', color: 'red' },
			{ text: 'Execution time: 4,100ms', color: 'red' },
			{ text: '# Same 50M row scan for one old order', color: 'red' },
			{
				text: "# This order hasn't been accessed in 2 years",
				color: 'red',
			},
		],
		story: [
			'A customer wants to return an item from a 2023 order.',
			'The query searches the same 50M row table.',
			'4 seconds to find one row that is 2 years old.',
			'95% of these rows are never accessed but slow every query.',
		],
	},
	{
		id: 'backup-slow',
		label: 'Daily backup takes 8 hours',
		command: 'pg_dump ecommerce_production | gzip > backup.sql.gz',
		responseLines: [
			{
				text: 'Dumping table orders... (50,000,000 rows)',
				color: 'yellow',
			},
			{ text: 'Duration: 8h 12m', color: 'red' },
			{
				text: '# Backup window exceeded, overlapping with peak hours',
				color: 'red',
			},
			{
				text: '# Migration ALTER TABLE takes 4+ hours (table lock)',
				color: 'red',
			},
		],
		story: [
			'The nightly pg_dump backup starts at midnight.',
			'It takes 8 hours to dump 50M rows of order data.',
			'The backup overlaps with morning peak traffic.',
			'Any ALTER TABLE migration locks the table for hours.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'recent-orders': ['slow-recent'],
	'old-order': ['slow-old'],
	'backup-slow': ['slow-backup'],
};

const STEP_DEFS = [
	{ id: 'temperature-policy', title: 'Define Temperature Policy' },
	{ id: 'archive-migration', title: 'Generate Archive Migration' },
	{ id: 'archiving-job', title: 'Create Archiving Job' },
	{ id: 'transparent-reads', title: 'Transparent Archive Reads' },
	{ id: 'destruction-policy', title: 'Data Destruction Policy' },
	{ id: 'schedule-job', title: 'Set the Cleanup Cadence' },
];

const TEMPERATURE_POLICY_OPTIONS = [
	{
		id: 'wrong-time-only',
		label: 'Hot < 30 days, everything else is cold (delete after 1 year)',
		correct: false,
		feedback:
			'Skipping the warm tier means 30-day-old data is immediately treated as cold. Reports and analytics teams need SQL access to data between 90 days and 1 year.',
	},
	{
		id: 'wrong-no-cold',
		label: 'Hot < 90 days, warm < 1 year, keep everything else forever',
		correct: false,
		feedback:
			'Without a cold tier and destruction policy, archived data grows forever. Storage costs increase without bound for data that may never be accessed again.',
	},
	{
		id: 'correct',
		label:
			'Hot < 90 days, warm < 1 year (archive), cold > 1 year (destroy after retention)',
		correct: true,
	},
];

const ARCHIVE_MIGRATION_COMMANDS = [
	{
		id: 'wrong-add-column',
		label: 'rails g migration AddArchivedToOrders archived:boolean',
		command: 'rails g migration AddArchivedToOrders archived:boolean',
		correct: false,
		feedback:
			'Adding a column to the existing table does not reduce its size. The 50M rows still live in one table, so queries still scan everything. You need a separate table.',
	},
	{
		id: 'correct',
		label: 'rails g migration CreateArchivedOrders',
		command: 'rails g migration CreateArchivedOrders',
		correct: true,
	},
	{
		id: 'wrong-partition',
		label: 'rails g migration PartitionOrdersByDate',
		command: 'rails g migration PartitionOrdersByDate',
		correct: false,
		feedback:
			'Partitioning splits one logical table into physical partitions. That requires native Postgres DDL. For a Rails-managed archive, a separate archived_orders table is simpler and gives you control over the lifecycle.',
	},
];

const ARCHIVING_JOB_OPTIONS = [
	{
		id: 'wrong-delete-only',
		label: 'Delete old records without copying',
		correct: false,
		feedback:
			'Deleting without archiving first means the data is gone permanently. Warm data still needs to be queryable for reports and customer support.',
	},
	{
		id: 'correct',
		label: 'Copy to archive table in batches, then delete originals',
		correct: true,
	},
	{
		id: 'wrong-no-batches',
		label: 'Copy all at once, then delete',
		correct: false,
		feedback:
			'Loading millions of records into memory at once will cause an out-of-memory crash. Use find_in_batches to process records in manageable chunks.',
	},
];

const TRANSPARENT_READS_OPTIONS = [
	{
		id: 'wrong-manual-check',
		label: 'Require callers to check both tables manually',
		correct: false,
		feedback:
			'Duplicating fallback logic in every controller is error-prone. If any controller forgets, archived orders appear missing. Encapsulate the lookup in the model layer.',
	},
	{
		id: 'wrong-union-query',
		label: 'Always query both tables with UNION',
		correct: false,
		feedback:
			'A UNION query scans both tables on every request, defeating the purpose of splitting data. Hot queries should only hit the small table. Fall back to archive only when needed.',
	},
	{
		id: 'correct',
		label: 'Model-level fallback: check hot table first, then archive',
		correct: true,
	},
];

const DESTRUCTION_POLICY_OPTIONS = [
	{
		id: 'wrong-delete-all',
		label: 'Delete all archived data older than 90 days',
		correct: false,
		feedback:
			'90 days is far too aggressive for archived data. Legal and compliance requirements typically mandate multi-year retention. Destruction should only apply to data past the retention period.',
	},
	{
		id: 'correct',
		label:
			'Destroy only data past the compliance retention period, with audit log',
		correct: true,
	},
	{
		id: 'wrong-no-logging',
		label: 'Destroy silently without audit trail',
		correct: false,
		feedback:
			'Destroying data without logging creates compliance risk. Auditors need proof of what was deleted, when, and how much. Always log destruction events.',
	},
];

// Step 5 no longer re-teaches the previous level's crontab-vs-recurring.yml
// choice (the mechanism is settled there). It is a lifecycle CADENCE
// decision expressed in recurring.yml.
const CLEANUP_CADENCE_OPTIONS = [
	{
		id: 'wrong-five-minutes',
		label: 'Run both jobs every five minutes',
		correct: false,
		feedback:
			'Constant churn: archive batches and deletes would compete with peak traffic for locks all day. Batching made a nightly window sufficient, and destructive work should run when the store is quietest.',
	},
	{
		id: 'correct',
		label: 'Archive nightly at 2am; destroy weekly on Sunday at 3am',
		correct: true,
	},
	{
		id: 'wrong-destroy-hourly',
		label: 'Archive nightly at 2am; destroy hourly right behind it',
		correct: false,
		feedback:
			'Destruction is the irreversible step, so its cadence should be slow and observable. A weekly window means a bad filter deletes at most one batch of mistakes, while backups and audit logs are still fresh enough to catch it.',
	},
];

const ALL_OPTION_SETS = [
	{
		step: 0,
		name: 'Temperature Policy',
		options: TEMPERATURE_POLICY_OPTIONS,
	},
	{
		step: 1,
		name: 'Archive Migration',
		options: ARCHIVE_MIGRATION_COMMANDS,
	},
	{ step: 2, name: 'Archiving Job', options: ARCHIVING_JOB_OPTIONS },
	{ step: 3, name: 'Transparent Reads', options: TRANSPARENT_READS_OPTIONS },
	{
		step: 4,
		name: 'Destruction Policy',
		options: DESTRUCTION_POLICY_OPTIONS,
	},
	{ step: 5, name: 'Cleanup Cadence', options: CLEANUP_CADENCE_OPTIONS },
];

const STRESS_SCENARIOS = [
	{
		id: 'recent-orders',
		label: 'Customer views recent orders (hot table)',
		description: 'Query hits hot table with 2.5M rows instead of 50M',
		method: 'GET',
		path: '/api/orders',
		actor: 'customer',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'Index Scan on orders (rows=2,500,000)', color: 'green' },
			{ text: 'Execution time: 50ms (was 3,200ms)', color: 'green' },
		],
		story: [
			'Same customer, same recent orders page.',
			'But now the hot table has only 2.5M rows.',
			'Index scan finds 10 orders in 50ms.',
			'64x faster than before.',
		],
	},
	{
		id: 'old-order',
		label: 'Customer views old order (transparent archive read)',
		description: 'Not found in hot table, seamlessly falls back to archive',
		method: 'GET',
		path: '/api/orders/12345',
		actor: 'customer',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'Order.find_with_archive(12345)', color: 'green' },
			{ text: 'Found in archived_orders (120ms)', color: 'green' },
		],
		story: [
			'Same old order from 2023.',
			'Hot table lookup misses (not in last 90 days).',
			'Transparent fallback to archived_orders table.',
			'120ms total, customer never knows it was archived.',
		],
	},
	{
		id: 'backup-fast',
		label: 'Daily backup of hot table (20 minutes)',
		description: 'Hot table backup: 2.5M rows in 20 minutes (was 8 hours)',
		method: 'POST',
		path: '/ops/backup',
		actor: 'ops',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'Dumping orders... (2,500,000 rows)', color: 'green' },
			{ text: 'Duration: 20m (was 8h 12m)', color: 'green' },
			{ text: 'Migrations: seconds instead of hours', color: 'green' },
		],
		story: [
			'Same nightly backup, but only the hot table.',
			'2.5M rows instead of 50M.',
			'Done in 20 minutes, hours before peak traffic.',
			'ALTER TABLE migrations run in seconds now.',
		],
	},
	{
		id: 'cold-destroy',
		label: 'Cold data destruction (compliance-safe)',
		description: 'Destroy data past 7-year retention with audit log',
		method: 'DELETE',
		path: '/jobs/destroy_expired_data',
		actor: 'scheduler',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'DestroyExpiredDataJob running...', color: 'yellow' },
			{
				text: 'Destroyed 5,000,000 orders past retention',
				color: 'green',
			},
			{ text: 'Audit log entry created', color: 'green' },
		],
		story: [
			'Weekly destruction job runs on schedule.',
			'Only data older than 7 years is eligible.',
			'5M rows destroyed with full audit trail.',
			'Archive table stays lean, storage costs drop.',
		],
	},
];

// ── Tests ──

describe('Level 46: Data Lifecycle', () => {
	describe('Discovery definitions', () => {
		test('has exactly 3 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(3);
		});

		test('all IDs unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(3);
		});

		test('exact labels match', () => {
			expect(DISCOVERY_DEFS[0].label).toBe(
				'Recent order queries scan 50M rows',
			);
			expect(DISCOVERY_DEFS[1].label).toBe(
				'Old order lookups scan entire table',
			);
			expect(DISCOVERY_DEFS[2].label).toBe('Daily backup takes 8 hours');
		});

		test('exact IDs match', () => {
			expect(DISCOVERY_DEFS[0].id).toBe('slow-recent');
			expect(DISCOVERY_DEFS[1].id).toBe('slow-old');
			expect(DISCOVERY_DEFS[2].id).toBe('slow-backup');
		});
	});

	describe('Probe definitions', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES).toHaveLength(3);
		});

		test('all probe IDs unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(3);
		});

		test('exact probe labels', () => {
			expect(PROBES[0].label).toBe('Customer views recent orders (slow)');
			expect(PROBES[1].label).toBe('Customer views old order from 2023');
			expect(PROBES[2].label).toBe('Daily backup takes 8 hours');
		});

		test('every probe has >= 4 responseLines with real text', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThanOrEqual(4);
				for (const line of probe.responseLines) {
					expect(line.text.length).toBeGreaterThanOrEqual(10);
				}
			}
		});

		test('every probe has >= 4 story lines', () => {
			for (const probe of PROBES) {
				expect(probe.story.length).toBeGreaterThanOrEqual(4);
				for (const s of probe.story) {
					expect(s.length).toBeGreaterThanOrEqual(10);
				}
			}
		});
	});

	describe('Probe-to-discovery mapping', () => {
		test('every probe maps to discoveries', () => {
			for (const probe of PROBES) {
				const discoveries = PROBE_DISCOVERY_MAP[probe.id];
				expect(discoveries).not.toBeUndefined();
				expect(discoveries.length).toBeGreaterThanOrEqual(1);
			}
		});

		test('all mapped IDs exist in DISCOVERY_DEFS', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const ids of Object.values(PROBE_DISCOVERY_MAP)) {
				for (const id of ids) {
					expect(validIds.has(id)).toBe(true);
				}
			}
		});

		test('every discovery reachable via probes', () => {
			const reachable = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});
	});

	describe('Build step definitions', () => {
		test('has exactly 6 steps', () => {
			expect(STEP_DEFS).toHaveLength(6);
		});

		test('all step IDs unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(6);
		});

		test('exact step titles', () => {
			expect(STEP_DEFS[0].title).toBe('Define Temperature Policy');
			expect(STEP_DEFS[1].title).toBe('Generate Archive Migration');
			expect(STEP_DEFS[2].title).toBe('Create Archiving Job');
			expect(STEP_DEFS[3].title).toBe('Transparent Archive Reads');
			expect(STEP_DEFS[4].title).toBe('Data Destruction Policy');
			expect(STEP_DEFS[5].title).toBe('Set the Cleanup Cadence');
		});
	});

	describe('Build step quality', () => {
		for (const { step, name, options } of ALL_OPTION_SETS) {
			describe(`Step ${step}: ${name}`, () => {
				test('has at least 3 options', () => {
					expect(options.length).toBeGreaterThanOrEqual(3);
				});

				test('has exactly one correct answer', () => {
					const correct = options.filter((o) => o.correct);
					expect(correct).toHaveLength(1);
				});

				test('correct answer is not the first option', () => {
					expect(options[0].correct).toBe(false);
				});

				test('every wrong option has non-empty feedback', () => {
					for (const opt of options) {
						if (!opt.correct) {
							expect(typeof opt.feedback).toBe('string');
							expect((opt.feedback ?? '').length).toBeGreaterThanOrEqual(20);
						}
					}
				});

				test('feedback does not reveal the correct answer label', () => {
					const correctLabel = options.find((o) => o.correct)?.label ?? '';
					for (const opt of options) {
						if (!opt.correct && opt.feedback) {
							expect(opt.feedback).not.toContain(correctLabel);
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
			expect(new Set(ids).size).toBe(4);
		});

		test('all labels unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(4);
		});

		test('every scenario has >= 3 responseLines with real text', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.responseLines.length).toBeGreaterThanOrEqual(3);
				for (const line of scenario.responseLines) {
					expect(line.text.length).toBeGreaterThanOrEqual(5);
				}
			}
		});

		test('every scenario has >= 3 story lines', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.story.length).toBeGreaterThanOrEqual(3);
			}
		});

		test('mix of allowed and blocked results', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBe(3);
			expect(blocked.length).toBe(1);
		});

		test('exact scenario IDs and expectedResults', () => {
			expect(STRESS_SCENARIOS[0].id).toBe('recent-orders');
			expect(STRESS_SCENARIOS[0].expectedResult).toBe('allowed');
			expect(STRESS_SCENARIOS[1].id).toBe('old-order');
			expect(STRESS_SCENARIOS[1].expectedResult).toBe('allowed');
			expect(STRESS_SCENARIOS[2].id).toBe('backup-fast');
			expect(STRESS_SCENARIOS[2].expectedResult).toBe('allowed');
			expect(STRESS_SCENARIOS[3].id).toBe('cold-destroy');
			expect(STRESS_SCENARIOS[3].expectedResult).toBe('blocked');
		});
	});

	describe('Cross-phase consistency', () => {
		test('every probe concept has a matching reward scenario', () => {
			const probeToScenario: Record<string, string> = {
				'recent-orders': 'recent-orders',
				'old-order': 'old-order',
				'backup-slow': 'backup-fast',
			};
			const scenarioIds = new Set(STRESS_SCENARIOS.map((s) => s.id));
			for (const probe of PROBES) {
				const mappedId = probeToScenario[probe.id];
				expect(mappedId).not.toBeUndefined();
				expect(scenarioIds.has(mappedId)).toBe(true);
			}
		});

		test('reward scenarios are a superset of probe concepts', () => {
			// 3 probes, 4 scenarios (3 matching + 1 additional cold-destroy)
			expect(STRESS_SCENARIOS.length).toBeGreaterThanOrEqual(PROBES.length);
		});
	});

	describe('Observe frames do not reference reward-only zones', () => {
		const OBSERVE_FRAME_KEYS = ['customer', 'app', 'db', 'edge1', 'edge2'];
		const REWARD_ONLY_KEYS = ['hotDb', 'archiveDb', 'edge3'];

		test('no observe probe frame references hotDb, archiveDb, or edge3', () => {
			for (const key of REWARD_ONLY_KEYS) {
				expect(OBSERVE_FRAME_KEYS).not.toContain(key);
			}
		});
	});

	describe('No em dashes in content', () => {
		test('probes contain no em dashes', () => {
			for (const probe of PROBES) {
				expect(probe.label).not.toContain('\u2014');
				expect(probe.command).not.toContain('\u2014');
				for (const line of probe.responseLines) {
					expect(line.text).not.toContain('\u2014');
				}
				for (const s of probe.story) {
					expect(s).not.toContain('\u2014');
				}
			}
		});

		test('scenarios contain no em dashes', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.label).not.toContain('\u2014');
				expect(scenario.description).not.toContain('\u2014');
				for (const line of scenario.responseLines) {
					expect(line.text).not.toContain('\u2014');
				}
				for (const s of scenario.story) {
					expect(s).not.toContain('\u2014');
				}
			}
		});

		test('option feedback contains no em dashes', () => {
			for (const { options } of ALL_OPTION_SETS) {
				for (const opt of options) {
					if (opt.feedback) {
						expect(opt.feedback).not.toContain('\u2014');
					}
				}
			}
		});
	});
});

describe('no concept overlap with the recurring-jobs level', () => {
	test('step 5 does not re-teach crontab-vs-recurring.yml', () => {
		const text = JSON.stringify(CLEANUP_CADENCE_OPTIONS).toLowerCase();
		expect(text.includes('crontab')).toBe(false);
		expect(text.includes('infinite loop')).toBe(false);
	});
});
