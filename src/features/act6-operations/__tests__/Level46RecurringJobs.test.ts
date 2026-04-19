import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level46RecurringJobs.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'expired-tokens', label: '2M expired session tokens accumulating' },
	{ id: 'orphaned-records', label: '500K orphaned records with no parent' },
	{ id: 'storage-growth', label: 'Storage growing 5%/week with no cleanup' },
];

const PROBES = [
	{
		id: 'expired-tokens',
		label: 'Check expired session tokens',
		command: 'Session.where("expires_at < ?", Time.current).count',
		responseLines: [
			{ text: '=> 2,147,832', color: 'red' },
			{ text: '# 2M expired tokens sitting in the database', color: 'red' },
			{ text: '# Growing by ~10,000/day with no cleanup', color: 'red' },
			{
				text: '# Slowing session lookups for active users',
				color: 'red',
			},
		],
		story: [
			'You check the sessions table for expired tokens.',
			'Over 2 million expired rows are clogging the database.',
			'They grow by 10,000 every day as users log in and out.',
			'Nobody has ever cleaned them up. There is no automated process.',
		],
	},
	{
		id: 'orphaned-records',
		label: 'Check orphaned records',
		command: 'OrderItem.left_joins(:order).where(orders: { id: nil }).count',
		responseLines: [
			{ text: '=> 523,491', color: 'red' },
			{ text: '# 500K+ order items with no parent order', color: 'red' },
			{
				text: '# Created by failed checkouts, never cleaned',
				color: 'red',
			},
			{ text: '# Wasting storage and skewing analytics', color: 'red' },
		],
		story: [
			'You query for order items whose parent order no longer exists.',
			'523K orphaned records from failed or deleted checkouts.',
			'They accumulate silently, wasting storage and polluting reports.',
			'Without a recurring cleanup job, they will only grow.',
		],
	},
	{
		id: 'storage-growth',
		label: 'Database storage growing',
		command:
			'ActiveRecord::Base.connection.execute("SELECT pg_database_size(current_database())")',
		responseLines: [
			{ text: '=> 42,949,672,960 (42 GB)', color: 'red' },
			{ text: '# Storage grew 5% this week alone', color: 'red' },
			{ text: '# At this rate, disk fills in ~4 months', color: 'red' },
			{
				text: '# No automated cleanup or archival process',
				color: 'red',
			},
		],
		story: [
			'You check the total database size.',
			'42 GB and growing at 5% per week.',
			'Expired sessions, orphaned records, and stale cache entries pile up.',
			'Without scheduled cleanup jobs, the disk will fill in months.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'expired-tokens': ['expired-tokens'],
	'orphaned-records': ['orphaned-records'],
	'storage-growth': ['storage-growth'],
};

const STEP_DEFS = [
	{ id: 'create-job', title: 'Create Cleanup Job Class' },
	{ id: 'token-cleanup', title: 'Token Cleanup Logic' },
	{ id: 'recurring-yml', title: 'Configure Recurring Schedule' },
	{ id: 'orphan-job', title: 'Add Orphan Cleanup Job' },
	{ id: 'error-handling', title: 'Error Handling' },
	{ id: 'monitoring', title: 'Monitoring & Logging' },
];

const CREATE_JOB_OPTIONS = [
	{
		id: 'wrong-plain-ruby',
		label: 'Plain Ruby class with a run method',
		correct: false,
		feedback:
			'A plain Ruby class cannot be enqueued by the queue system. Jobs must inherit from the base job class to use scheduling and retries.',
	},
	{
		id: 'wrong-rake-task',
		label: 'Rake task in lib/tasks/',
		correct: false,
		feedback:
			'Rake tasks need external cron or manual execution. The queue system manages scheduling natively through its config file, no external cron needed.',
	},
	{
		id: 'correct',
		label: 'ApplicationJob subclass with queue_as :maintenance',
		correct: true,
	},
];

const TOKEN_CLEANUP_OPTIONS = [
	{
		id: 'wrong-delete-all',
		label: 'Delete all expired tokens in one query',
		correct: false,
		feedback:
			'Deleting 2M records in a single DELETE locks the table for minutes, blocking all session lookups. Use batching to delete in smaller chunks.',
	},
	{
		id: 'correct',
		label: 'Batch deletion with in_batches and logging',
		correct: true,
	},
	{
		id: 'wrong-destroy-all',
		label: 'Use destroy_all for callbacks',
		correct: false,
		feedback:
			'destroy_all loads every record into memory and runs callbacks one by one. For 2M expired tokens, this causes OOM. Expired sessions need no callbacks.',
	},
];

const RECURRING_YML_COMMANDS = [
	{
		id: 'wrong-crontab',
		label: 'crontab -e',
		command: 'crontab -e',
		correct: false,
		feedback:
			'System cron runs outside your Rails process. The queue system has built-in scheduling via a YAML config file, no external cron needed.',
	},
	{
		id: 'correct',
		label: 'Create config/recurring.yml with job schedule',
		command:
			'cat > config/recurring.yml <<YAML\nproduction:\n  clean_expired_tokens:\n    class: CleanExpiredTokensJob\n    schedule: "every hour"\nYAML',
		correct: true,
	},
	{
		id: 'wrong-initializer',
		label: 'rails g initializer solid_queue_schedule',
		command: 'rails g initializer solid_queue_schedule',
		correct: false,
		feedback:
			'The queue system reads recurring schedules from a YAML config file, not from an initializer. The YAML declares job class and schedule.',
	},
];

const ORPHAN_JOB_OPTIONS = [
	{
		id: 'wrong-no-batch',
		label: 'Find and delete orphans without batching',
		correct: false,
		feedback:
			'Deleting 500K rows in one statement locks the table. Also, maintenance jobs belong on a dedicated queue so they do not block user-facing work.',
	},
	{
		id: 'wrong-wrong-queue',
		label: 'Batch deletion on the default queue',
		correct: false,
		feedback:
			'The deletion logic is correct, but maintenance jobs should use a dedicated queue. Running cleanup on :default competes with user-facing jobs like order processing.',
	},
	{
		id: 'correct',
		label: 'Batch deletion on the maintenance queue with logging',
		correct: true,
	},
];

const ERROR_HANDLING_OPTIONS = [
	{
		id: 'wrong-no-retry',
		label: 'No error handling (let it crash)',
		correct: false,
		feedback:
			'Without retry logic, a transient error (network hiccup, connection timeout) permanently fails the job. Recurring jobs need resilience for temporary failures.',
	},
	{
		id: 'correct',
		label: 'retry_on transient errors, discard_on fatal errors',
		correct: true,
	},
	{
		id: 'wrong-rescue-silence',
		label: 'Rescue all exceptions and silently continue',
		correct: false,
		feedback:
			'Silently swallowing exceptions hides real bugs. Use explicit retry for transient errors and discard for expected ones. Let unexpected errors surface.',
	},
];

const MONITORING_OPTIONS = [
	{
		id: 'wrong-no-metrics',
		label: 'Just log "done" with no details',
		correct: false,
		feedback:
			'"Done" tells you nothing. How many records were cleaned? How long did it take? Monitoring needs counts, timing, and structured data for alerting.',
	},
	{
		id: 'wrong-puts',
		label: 'Use puts for output',
		correct: false,
		feedback:
			'puts writes to stdout, which is not captured by log aggregators in production. Use structured logging for monitoring and alerting.',
	},
	{
		id: 'correct',
		label: 'Structured logging with count, duration, and job name',
		correct: true,
	},
];

const ALL_OPTION_SETS = [
	{ step: 0, name: 'Create Job Class', options: CREATE_JOB_OPTIONS },
	{ step: 1, name: 'Token Cleanup Logic', options: TOKEN_CLEANUP_OPTIONS },
	{
		step: 2,
		name: 'Configure Recurring Schedule',
		options: RECURRING_YML_COMMANDS,
	},
	{ step: 3, name: 'Orphan Cleanup Job', options: ORPHAN_JOB_OPTIONS },
	{ step: 4, name: 'Error Handling', options: ERROR_HANDLING_OPTIONS },
	{ step: 5, name: 'Monitoring & Logging', options: MONITORING_OPTIONS },
];

const STRESS_SCENARIOS = [
	{
		id: 'expired-tokens',
		label: 'CleanExpiredTokensJob runs (hourly)',
		description: 'Scheduled hourly, purges expired session tokens in batches',
		method: 'POST',
		path: '/jobs/clean_expired_tokens',
		actor: 'scheduler',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'CleanExpiredTokensJob: started', color: 'green' },
			{ text: 'Purged 85,000 expired sessions in 2.3s', color: 'green' },
			{ text: 'Status: completed', color: 'green' },
		],
		story: [
			'Solid Queue triggers CleanExpiredTokensJob on the hour.',
			'The job deletes expired sessions in batches of 10,000.',
			'85,000 records purged in 2.3 seconds.',
			'Session table stays lean, queries stay fast.',
		],
	},
	{
		id: 'orphaned-records',
		label: 'PurgeOrphansJob runs (daily)',
		description: 'Scheduled daily at 2 AM, removes orphaned order items',
		method: 'POST',
		path: '/jobs/purge_orphans',
		actor: 'scheduler',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'PurgeOrphansJob: started', color: 'green' },
			{
				text: 'Purged 523,491 orphaned records in 45.1s',
				color: 'green',
			},
			{ text: 'Status: completed', color: 'green' },
		],
		story: [
			'Solid Queue triggers PurgeOrphansJob at 2 AM.',
			'The job finds order items with no parent order.',
			'523K orphaned rows deleted in batches.',
			'Storage reclaimed, analytics no longer skewed.',
		],
	},
	{
		id: 'storage-growth',
		label: 'Storage stabilized (both jobs running)',
		description: 'Recurring cleanup keeps storage growth at 0%',
		method: 'GET',
		path: '/admin/storage',
		actor: 'admin',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'Database size: 28 GB (was 42 GB)', color: 'green' },
			{ text: 'Weekly growth: 0% (was 5%)', color: 'green' },
			{ text: 'Recurring jobs: 2 active, 0 failed', color: 'green' },
		],
		story: [
			'Admin checks storage after jobs have been running.',
			'Database dropped from 42 GB to 28 GB.',
			'Weekly growth rate is now 0% (was 5%).',
			'Automated maintenance keeps the database healthy.',
		],
	},
	{
		id: 'job-failure',
		label: 'Job failure with retry',
		description:
			'Connection timeout triggers retry_on, job recovers automatically',
		method: 'POST',
		path: '/jobs/clean_expired_tokens',
		actor: 'scheduler',
		expectedResult: 'blocked',
		responseLines: [
			{
				text: 'ActiveRecord::ConnectionTimeoutError raised',
				color: 'red',
			},
			{ text: 'retry_on: waiting 30s, attempt 1 of 3', color: 'yellow' },
			{ text: 'Retry succeeded on attempt 2', color: 'green' },
		],
		story: [
			'CleanExpiredTokensJob hits a connection timeout.',
			'retry_on catches ActiveRecord::ConnectionTimeoutError.',
			'Waits 30 seconds, then retries automatically.',
			'Second attempt succeeds. No manual intervention needed.',
		],
	},
];

// ── Tests ──

describe('Level 45: Recurring Jobs', () => {
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
				'2M expired session tokens accumulating',
			);
			expect(DISCOVERY_DEFS[1].label).toBe(
				'500K orphaned records with no parent',
			);
			expect(DISCOVERY_DEFS[2].label).toBe(
				'Storage growing 5%/week with no cleanup',
			);
		});

		test('exact IDs match', () => {
			expect(DISCOVERY_DEFS[0].id).toBe('expired-tokens');
			expect(DISCOVERY_DEFS[1].id).toBe('orphaned-records');
			expect(DISCOVERY_DEFS[2].id).toBe('storage-growth');
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
			expect(PROBES[0].label).toBe('Check expired session tokens');
			expect(PROBES[1].label).toBe('Check orphaned records');
			expect(PROBES[2].label).toBe('Database storage growing');
		});

		test('every probe has >= 4 responseLines with real text', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThanOrEqual(4);
				for (const line of probe.responseLines) {
					expect(line.text.length).toBeGreaterThanOrEqual(10);
				}
			}
		});

		test('every probe has >= 3 story lines', () => {
			for (const probe of PROBES) {
				expect(probe.story.length).toBeGreaterThanOrEqual(3);
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
			expect(STEP_DEFS[0].title).toBe('Create Cleanup Job Class');
			expect(STEP_DEFS[1].title).toBe('Token Cleanup Logic');
			expect(STEP_DEFS[2].title).toBe('Configure Recurring Schedule');
			expect(STEP_DEFS[3].title).toBe('Add Orphan Cleanup Job');
			expect(STEP_DEFS[4].title).toBe('Error Handling');
			expect(STEP_DEFS[5].title).toBe('Monitoring & Logging');
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
					expect(line.text.length).toBeGreaterThanOrEqual(10);
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
			expect(STRESS_SCENARIOS[0].id).toBe('expired-tokens');
			expect(STRESS_SCENARIOS[0].expectedResult).toBe('allowed');
			expect(STRESS_SCENARIOS[1].id).toBe('orphaned-records');
			expect(STRESS_SCENARIOS[1].expectedResult).toBe('allowed');
			expect(STRESS_SCENARIOS[2].id).toBe('storage-growth');
			expect(STRESS_SCENARIOS[2].expectedResult).toBe('allowed');
			expect(STRESS_SCENARIOS[3].id).toBe('job-failure');
			expect(STRESS_SCENARIOS[3].expectedResult).toBe('blocked');
		});
	});

	describe('Cross-phase consistency', () => {
		test('every probe ID has a matching stress scenario', () => {
			const scenarioIds = new Set(STRESS_SCENARIOS.map((s) => s.id));
			for (const probe of PROBES) {
				expect(scenarioIds.has(probe.id)).toBe(true);
			}
		});

		test('reward scenarios are a superset of probe concepts', () => {
			// 3 probes map to expired-tokens, orphaned-records, storage-growth
			// 4 scenarios include those 3 + job-failure
			expect(STRESS_SCENARIOS.length).toBeGreaterThanOrEqual(PROBES.length);
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
