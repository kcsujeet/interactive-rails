/**
 * Level 36: Background Jobs - Data Consistency Tests
 *
 * Tests mirror the data structures from the component and content to verify:
 * - Discovery definitions are complete and 1:1 mapped
 * - Build step quality (correct answer never first, feedback never leaks answer)
 * - Stress scenario coverage and consistency
 * - The fixes landed in this pass:
 *   - install command is `bin/rails solid_queue:install` (NOT generate),
 *     configures production.rb and creates bin/jobs / config/recurring.yml
 *   - the built SendWelcomeNotificationJob is the job the service enqueues and
 *     the worker log shows (no dead code across steps 1-4)
 *   - no fabricated `unique :until_executed` / `lock_ttl` macro (Solid Queue has
 *     no such API); the honest story is at-least-once + idempotency
 *   - the SMTP-down probe uses a connection-refused error, not
 *     Net::SMTPAuthenticationError (which is an auth failure, not a refusal)
 */

import { describe, expect, test } from 'bun:test';
import { level36BackgroundJobs } from '../content/level-36-background-jobs';

// Em dash character, referenced only to assert its absence in content.
const EM_DASH = String.fromCharCode(8212);

// ── Mirror data from the component ──

const DISCOVERY_DEFS = [
	{ id: 'email-blocks', label: 'Email blocks for 3s' },
	{ id: 'sync-side-effects', label: 'Side effects are synchronous' },
	{ id: 'slow-registration', label: 'Registration is slow' },
	{ id: 'failures-cascade', label: 'Failures cascade' },
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'register-alice': 'slow-registration',
	'register-bob': 'sync-side-effects',
	'register-fail': 'failures-cascade',
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	mailer: 'email-blocks',
	service: 'sync-side-effects',
};

const PROBE_IDS = ['register-alice', 'register-bob', 'register-fail'];

const REGISTER_FAIL_RESPONSE = [
	'HTTP/1.1 500 Internal Server Error',
	'Errno::ECONNREFUSED: Connection refused - connect(2) for smtp:587',
	'Response time: 8.3s (timeout)',
	'The user was created, but deliver_now raised an exception. The entire registration failed because of the mailer.',
];

const STEP_DEFS = [
	{ id: 'configure-queue', title: 'Configure Solid Queue' },
	{ id: 'create-job', title: 'Create a Background Job' },
	{ id: 'make-idempotent', title: 'Make the Job Idempotent' },
	{ id: 'switch-async', title: 'Switch Service to Async' },
	{ id: 'start-worker', title: 'Start the Worker' },
];

const TERMINAL_STEP_0_COMMANDS = [
	{
		id: 'sidekiq',
		label: 'bundle add sidekiq',
		correct: false,
		feedback:
			'Sidekiq requires Redis as an external dependency. Rails 8 has a built-in, database-backed alternative.',
	},
	{
		id: 'redis-queue',
		label: 'bundle add resque',
		correct: false,
		feedback:
			'Resque also requires Redis. Rails 8 includes a job backend that uses your existing database.',
	},
	{
		id: 'solid-queue',
		label: 'bin/rails solid_queue:install',
		correct: true,
	},
];

const TERMINAL_STEP_0_OUTPUT = [
	'create  config/queue.yml',
	'create  config/recurring.yml',
	'create  db/queue_schema.rb',
	'create  bin/jobs',
	'insert  config/environments/production.rb',
	'  config.solid_queue.connects_to = { database: { writing: :queue } }',
	'Solid Queue installed. Database-backed, no Redis needed.',
];

const TERMINAL_STEP_4_COMMANDS = [
	{ id: 'rails-server', label: 'rails server', correct: false, feedback: 'x' },
	{
		id: 'solid-queue-start',
		label: 'solid_queue start',
		correct: false,
		feedback: 'x',
	},
	{ id: 'bin-jobs', label: 'bin/jobs', correct: true },
];

const TERMINAL_STEP_4_OUTPUT_JOB_LINES = [
	'  [SendWelcomeNotificationJob] Performing for user 42',
	'  [SendWelcomeNotificationJob] Completed in 287ms',
];

const JOB_CLASS_OPTIONS = [
	{
		id: 'plain-ruby',
		correct: false,
		feedback:
			'A plain Ruby class has no queue integration. With nothing wiring it to the job system, calling `perform_later` on it will not enqueue anything.',
	},
	{
		id: 'active-job-object',
		correct: false,
		feedback:
			'Passing an ActiveRecord object to perform_later causes serialization issues. By the time the job runs, the in-memory copy can be stale or fail to deserialize.',
	},
	{ id: 'active-job-correct', correct: true },
];

const IDEMPOTENT_OPTIONS = [
	{
		id: 'no-guard',
		correct: false,
		feedback:
			'Without a guard, retrying the job sends the welcome email again. Jobs can run more than once due to retries or queue restarts.',
	},
	{
		id: 'rescue-only',
		correct: false,
		feedback:
			'Rescuing exceptions hides errors but does not prevent duplicate work. The job still sends the email every time it runs.',
	},
	{ id: 'idempotent-guard', correct: true },
];

const ASYNC_OPTIONS = [
	{
		id: 'perform-now',
		label: `SendWelcomeNotificationJob.perform_now(user.id)\nSyncExternalProfileJob.perform_now(user.id)`,
		correct: false,
		feedback:
			'perform_now runs the job inline, right now, on the request thread. The whole point is to stop blocking the HTTP response.',
	},
	{
		id: 'partial-async',
		label: `SendWelcomeNotificationJob.perform_later(user.id)\nSyncExternalProfileJob.perform_now(user.id)`,
		correct: false,
		feedback:
			'The welcome job is async, but the profile sync still runs inline. All side effects should be moved to the background.',
	},
	{
		id: 'full-async',
		label: `SendWelcomeNotificationJob.perform_later(user.id)\nSyncExternalProfileJob.perform_later(user.id)`,
		correct: true,
	},
];

const STRESS_SCENARIO_IDS = [
	'register-alice',
	'register-bob',
	'register-fail',
	'check-queue',
	'register-invalid',
];

// Mirror of the async service preview (getCodeFiles step >= 3).
const SERVICE_ASYNC_PREVIEW = `class UserRegistration < ApplicationService
  def call
    user = User.create!(@params)

    # All side effects are now background jobs
    SendWelcomeNotificationJob.perform_later(user.id)
    SyncExternalProfileJob.perform_later(user.id)

    # Response returns instantly (< 200ms)
    Result.new(success?: true, user: user)
  rescue ActiveRecord::RecordInvalid => e
    Result.new(success?: false, user: nil,
               errors: e.record.errors.full_messages)
  end
end`;

const ALL_OPTION_SETS = [JOB_CLASS_OPTIONS, IDEMPOTENT_OPTIONS, ASYNC_OPTIONS];

// ── Tests ──

describe('Level 36: Background Jobs', () => {
	describe('Discovery definitions', () => {
		test('has exactly 4 discoveries with unique ids and labels', () => {
			expect(DISCOVERY_DEFS).toHaveLength(4);
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(ids).size).toBe(ids.length);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('probes plus stage clicks cover every discovery', () => {
			const covered = new Set([
				...Object.values(PROBE_DISCOVERY_MAP),
				...Object.values(STAGE_DISCOVERY_MAP),
			]);
			expect(covered).toEqual(new Set(DISCOVERY_DEFS.map((d) => d.id)));
		});
	});

	describe('SMTP-down probe uses a connection-refused error', () => {
		test('shows Errno::ECONNREFUSED, not Net::SMTPAuthenticationError', () => {
			const joined = REGISTER_FAIL_RESPONSE.join('\n');
			expect(joined).toContain('Errno::ECONNREFUSED');
			expect(joined).not.toContain('Net::SMTPAuthenticationError');
			expect(joined).not.toContain('SMTP connection refused');
		});
	});

	describe('Install command and output', () => {
		test('correct command is bin/rails solid_queue:install (not generate)', () => {
			const correct = TERMINAL_STEP_0_COMMANDS.find((c) => c.correct);
			expect(correct?.label).toBe('bin/rails solid_queue:install');
			expect(correct?.label).not.toContain('generate');
		});

		test('installer output configures production.rb and creates bin/jobs', () => {
			const joined = TERMINAL_STEP_0_OUTPUT.join('\n');
			expect(joined).toContain('config/environments/production.rb');
			expect(joined).toContain('bin/jobs');
			expect(joined).toContain('config/recurring.yml');
			expect(joined).not.toContain('config/application.rb');
			expect(joined).not.toContain('config.active_job.queue_adapter');
		});
	});

	describe('No dead code across steps 1-4', () => {
		test('the service enqueues the SendWelcomeNotificationJob the player built', () => {
			const correct = ASYNC_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain(
				'SendWelcomeNotificationJob.perform_later(user.id)',
			);
			expect(correct?.label).not.toContain('UserMailer.welcome(user)');
		});

		test('the async service preview enqueues the built job', () => {
			expect(SERVICE_ASYNC_PREVIEW).toContain(
				'SendWelcomeNotificationJob.perform_later(user.id)',
			);
			expect(SERVICE_ASYNC_PREVIEW).not.toContain(
				'UserMailer.welcome(user).deliver_later',
			);
		});

		test('the worker log shows the same job the service enqueues', () => {
			const joined = TERMINAL_STEP_4_OUTPUT_JOB_LINES.join('\n');
			expect(joined).toContain('[SendWelcomeNotificationJob] Performing');
		});
	});

	describe('Build step quality', () => {
		test('has exactly 5 steps with unique ids', () => {
			expect(STEP_DEFS).toHaveLength(5);
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('each option set has exactly one correct answer, never first', () => {
			for (const options of ALL_OPTION_SETS) {
				expect(options.filter((o) => o.correct)).toHaveLength(1);
				expect(options[0].correct).toBe(false);
			}
			for (const cmds of [TERMINAL_STEP_0_COMMANDS, TERMINAL_STEP_4_COMMANDS]) {
				expect(cmds.filter((c) => c.correct)).toHaveLength(1);
				expect(cmds[0].correct).toBe(false);
			}
		});

		test('every wrong async option has feedback that does not leak the answer', () => {
			for (const opt of ASYNC_OPTIONS) {
				if (!opt.correct) {
					expect((opt.feedback ?? '').length).toBeGreaterThan(10);
					expect((opt.feedback ?? '').toLowerCase()).not.toContain(
						'perform_later',
					);
				}
			}
		});
	});

	describe('Stress scenarios', () => {
		test('has 5 scenarios with unique ids', () => {
			expect(STRESS_SCENARIO_IDS).toHaveLength(5);
			expect(new Set(STRESS_SCENARIO_IDS).size).toBe(
				STRESS_SCENARIO_IDS.length,
			);
		});

		test('every observe probe id has a matching reward scenario id', () => {
			const scen = new Set(STRESS_SCENARIO_IDS);
			for (const pid of PROBE_IDS) {
				expect(scen.has(pid)).toBe(true);
			}
		});
	});

	describe('Content: honest Solid Queue story, correct install, Rails 8', () => {
		const contentBlob = JSON.stringify(level36BackgroundJobs);

		test('no fabricated unique :until_executed / lock_ttl macro', () => {
			expect(contentBlob).not.toContain('until_executed');
			expect(contentBlob).not.toContain('lock_ttl');
		});

		test('commonMistakes teaches at-least-once idempotency, not queue-level uniqueness', () => {
			const mistakes =
				level36BackgroundJobs.learningContent.commonMistakes ?? [];
			const joined = mistakes.join('\n');
			expect(joined).toContain('at-least-once');
			expect(joined).not.toContain('unique :until_executed');
		});

		test('homework install command is bin/rails solid_queue:install', () => {
			const homework = level36BackgroundJobs.learningContent.homework ?? [];
			const commands = homework.flatMap((h) => h.commands ?? []);
			expect(commands).toContain('bin/rails solid_queue:install');
			expect(commands).not.toContain('bin/rails generate solid_queue:install');
		});

		test('railsCodeExample configures production.rb, not application.rb', () => {
			const example =
				level36BackgroundJobs.learningContent.railsCodeExample ?? '';
			expect(example).toContain('config/environments/production.rb');
			expect(example).not.toContain(
				'# config/application.rb -- Rails 8 default',
			);
		});

		test('no em dash anywhere in the content', () => {
			expect(contentBlob).not.toContain(EM_DASH);
		});
	});
});
