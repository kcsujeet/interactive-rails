/**
 * Level 45: Recurring Jobs & Scheduling
 *
 * Three-phase flow: observe -> build -> reward
 *
 * Phase 1 (observe): 3-node horizontal layout.
 *   Scheduler (left, missing) -> Rails App (center) -> Database (right, row count grows).
 *   Probes reveal expired tokens, orphaned records, and unchecked storage growth.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: OptionCard - Create cleanup job class (ApplicationJob pattern)
 *   Step 1: OptionCard - Implement token cleanup logic (batch deletion)
 *   Step 2: Terminal - Configure Solid Queue recurring schedule (config/recurring.yml)
 *   Step 3: OptionCard - Add orphan cleanup job
 *   Step 4: OptionCard - Configure error handling (retry_on, discard_on)
 *   Step 5: OptionCard - Add monitoring/logging for scheduled runs
 *
 * Phase 3 (reward): Same 3 nodes, but Scheduler is active and jobs fire.
 *   Expired tokens cleaned, orphans purged, storage stabilized, failure handled.
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import { ArrowRight } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	AnimatedDots,
	type DotConfig,
	FlowDiagram,
	FlowHandles,
	reversePath,
} from '@/components/levels/FlowDiagram';
import { FlowNode, type FlowNodeData } from '@/components/levels/FlowNode';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act6-level45-recurring-jobs', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface SimpleNodeState {
	label: string;
	flash: ZoneFlash;
}

interface DbNodeState {
	label: string;
	flash: ZoneFlash;
	rowCount: string;
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	scheduler?: Partial<SimpleNodeState>;
	app?: Partial<SimpleNodeState>;
	db?: Partial<DbNodeState>;
	/** Scheduler <-> App edge */
	edge1?: Partial<EdgeVizState>;
	/** App <-> Database edge */
	edge2?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_SCHEDULER: SimpleNodeState = {
	label: 'No scheduler',
	flash: 'idle',
};
const DEFAULT_APP: SimpleNodeState = { label: 'Idle', flash: 'idle' };
const DEFAULT_DB: DbNodeState = {
	label: 'Database',
	flash: 'idle',
	rowCount: '2.6M stale rows',
};

const DEFAULT_SCHEDULER_REWARD: SimpleNodeState = {
	label: 'Solid Queue Scheduler',
	flash: 'green',
};
const DEFAULT_APP_REWARD: SimpleNodeState = { label: 'Idle', flash: 'idle' };
const DEFAULT_DB_REWARD: DbNodeState = {
	label: 'Database',
	flash: 'idle',
	rowCount: 'Maintained',
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-cyan-500',
};

// ─── Discovery definitions ─────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'expired-tokens', label: '2M expired session tokens accumulating' },
	{ id: 'orphaned-records', label: '500K orphaned records with no parent' },
	{ id: 'storage-growth', label: 'Storage growing 5%/week with no cleanup' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES = [
	{
		id: 'expired-tokens',
		label: 'Check expired session tokens',
		command: 'Session.where("expires_at < ?", Time.current).count',
		responseLines: [
			{ text: '=> 2,147,832', color: 'red' as const },
			{
				text: '# 2M expired tokens sitting in the database',
				color: 'red' as const,
			},
			{
				text: '# Growing by ~10,000/day with no cleanup',
				color: 'red' as const,
			},
			{
				text: '# Slowing session lookups for active users',
				color: 'red' as const,
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
			{ text: '=> 523,491', color: 'red' as const },
			{
				text: '# 500K+ order items with no parent order',
				color: 'red' as const,
			},
			{
				text: '# Created by failed checkouts, never cleaned',
				color: 'red' as const,
			},
			{
				text: '# Wasting storage and skewing analytics',
				color: 'red' as const,
			},
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
			{ text: '=> 42,949,672,960 (42 GB)', color: 'red' as const },
			{
				text: '# Storage grew 5% this week alone',
				color: 'red' as const,
			},
			{
				text: '# At this rate, disk fills in ~4 months',
				color: 'red' as const,
			},
			{
				text: '# No automated cleanup or archival process',
				color: 'red' as const,
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

// ─── Observe animation frames ─────────────────────────────────────────
// Horizontal: Scheduler (left) -> Rails App (center) -> Database (right)
// In observe, the scheduler is empty/missing. DB row count grows.
//
// Frame-by-frame:
// expired-tokens:
//   F0: App shows user logout, edge2 sends "Session expired" to DB
//   F1: DB accumulates tokens, shows +10K/day
//   F2: Scheduler shows no cleanup, DB shows 2M expired, App queries slow
//   F3: App and Scheduler show no one cleans up
//
// orphaned-records:
//   F0: App shows checkout failure, edge2 sends partial items to DB
//   F1: DB shows orphans piling up
//   F2: Scheduler empty, DB shows 523K orphans, App analytics skewed
//   F3: Nobody purges orphans
//
// storage-growth:
//   F0: DB measured at 42 GB
//   F1: DB grows 5% weekly
//   F2: Scheduler empty, disk fills in 4 months
//   F3: Storage unsustainable

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'expired-tokens': [
		{
			scheduler: { label: 'No scheduler', flash: 'idle' },
			app: { label: 'User logs out', flash: 'idle' },
			edge2: {
				active: true,
				reverse: false,
				label: 'Session expired',
				dotColor: 'bg-cyan-500',
			},
		},
		{
			edge2: { active: false },
			db: {
				label: 'Tokens accumulate',
				flash: 'amber',
				rowCount: '+10,000 expired/day',
			},
		},
		{
			scheduler: { label: 'No cleanup scheduled', flash: 'red' },
			db: {
				label: '2M expired tokens',
				flash: 'red',
				rowCount: '2,147,832 expired',
			},
			app: { label: 'Queries slowing down', flash: 'amber' },
		},
		{
			app: { label: 'No one cleans up', flash: 'red' },
			scheduler: { label: 'Empty', flash: 'red' },
		},
	],
	'orphaned-records': [
		{
			app: { label: 'Checkout fails mid-process', flash: 'amber' },
			edge2: {
				active: true,
				reverse: false,
				label: 'Partial order items created',
				dotColor: 'bg-amber-500',
			},
		},
		{
			edge2: { active: false },
			db: {
				label: 'Orphans pile up',
				flash: 'amber',
				rowCount: '523K orphaned rows',
			},
		},
		{
			scheduler: { label: 'No cleanup scheduled', flash: 'red' },
			db: {
				label: 'No parent orders',
				flash: 'red',
				rowCount: '523,491 orphans',
			},
			app: { label: 'Analytics skewed', flash: 'amber' },
		},
		{
			app: { label: 'Nobody purges orphans', flash: 'red' },
			scheduler: { label: 'Empty', flash: 'red' },
		},
	],
	'storage-growth': [
		{
			db: {
				label: 'Measuring storage',
				flash: 'amber',
				rowCount: '42 GB total',
			},
			app: { label: 'Checking disk usage', flash: 'idle' },
		},
		{
			db: {
				label: '+5% this week',
				flash: 'amber',
				rowCount: '42 GB (+2.1 GB/week)',
			},
		},
		{
			scheduler: { label: 'No cleanup scheduled', flash: 'red' },
			db: {
				label: 'Disk fills in 4 months',
				flash: 'red',
				rowCount: '42 GB and growing',
			},
			app: { label: 'No archival process', flash: 'red' },
		},
		{
			app: { label: 'Storage unsustainable', flash: 'red' },
			scheduler: { label: 'Empty', flash: 'red' },
		},
	],
};

// ─── Reward animation frames ──────────────────────────────────────────
//
// Frame-by-frame:
// expired-tokens:
//   F0: Scheduler triggers hourly job, edge1 sends CleanExpiredTokensJob to App
//   F1: App runs cleanup, edge2 sends DELETE in_batches to DB
//   F2: DB purged, App shows 85K cleaned
//   F3: Scheduler runs hourly, App complete
//
// orphaned-records:
//   F0: Scheduler triggers daily job, edge1 sends PurgeOrphansJob
//   F1: App purges, edge2 sends DELETE to DB
//   F2: DB orphans removed, App shows 523K purged
//   F3: Scheduler daily at 2AM, App complete
//
// storage-growth:
//   F0: Scheduler has both jobs, edge1 sends scheduled cleanup
//   F1: App runs cleanup, edge2 sends batch deletions to DB
//   F2: DB storage stabilized at 28GB
//   F3: Automated maintenance, 0% growth
//
// job-failure:
//   F0: Scheduler triggers job, edge1 to App
//   F1: App hits error, edge2 connection timeout
//   F2: Error returns, retry_on kicks in
//   F3: Retry succeeds, cleanup resumed

const REWARD_FRAMES: Record<string, AnimFrame[]> = {
	'expired-tokens': [
		{
			scheduler: { label: 'Triggering hourly job', flash: 'amber' },
			edge1: {
				active: true,
				reverse: false,
				label: 'CleanExpiredTokensJob',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			edge1: { active: false },
			app: { label: 'Running cleanup...', flash: 'amber' },
			edge2: {
				active: true,
				reverse: false,
				label: 'DELETE in_batches',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			edge2: { active: false },
			db: {
				label: 'Expired tokens purged',
				flash: 'green',
				rowCount: '0 expired tokens',
			},
			app: { label: 'Cleaned 85K records', flash: 'green' },
		},
		{
			scheduler: { label: 'Runs every hour', flash: 'green' },
			app: { label: 'Job complete', flash: 'green' },
		},
	],
	'orphaned-records': [
		{
			scheduler: { label: 'Triggering daily job', flash: 'amber' },
			edge1: {
				active: true,
				reverse: false,
				label: 'PurgeOrphansJob',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			edge1: { active: false },
			app: { label: 'Purging orphans...', flash: 'amber' },
			edge2: {
				active: true,
				reverse: false,
				label: 'DELETE orphaned rows',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			edge2: { active: false },
			db: {
				label: 'Orphans removed',
				flash: 'green',
				rowCount: '0 orphaned rows',
			},
			app: { label: 'Purged 523K records', flash: 'green' },
		},
		{
			scheduler: { label: 'Runs daily at 2 AM', flash: 'green' },
			app: { label: 'Job complete', flash: 'green' },
		},
	],
	'storage-growth': [
		{
			scheduler: { label: 'Both jobs scheduled', flash: 'green' },
			edge1: {
				active: true,
				reverse: false,
				label: 'Scheduled cleanup',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			edge1: { active: false },
			app: { label: 'Cleanup jobs running', flash: 'amber' },
			edge2: {
				active: true,
				reverse: false,
				label: 'Batch deletions',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			edge2: { active: false },
			db: {
				label: 'Storage stabilized',
				flash: 'green',
				rowCount: '28 GB (stable)',
			},
		},
		{
			scheduler: { label: 'Automated maintenance', flash: 'green' },
			app: { label: 'Growth stopped', flash: 'green' },
			db: {
				label: '0% growth/week',
				flash: 'green',
				rowCount: '28 GB (stable)',
			},
		},
	],
	'job-failure': [
		{
			scheduler: { label: 'Triggering cleanup job', flash: 'amber' },
			edge1: {
				active: true,
				reverse: false,
				label: 'CleanExpiredTokensJob',
				dotColor: 'bg-cyan-500',
			},
		},
		{
			edge1: { active: false },
			app: { label: 'Job raised error!', flash: 'red' },
			edge2: {
				active: true,
				reverse: false,
				label: 'Connection timeout',
				dotColor: 'bg-red-500',
			},
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: 'ConnectionTimeoutError',
				dotColor: 'bg-red-500',
			},
			app: { label: 'retry_on kicks in', flash: 'amber' },
		},
		{
			edge2: { active: false },
			scheduler: { label: 'Retry in 30s (3 attempts)', flash: 'amber' },
			app: { label: 'Retrying automatically', flash: 'green' },
			db: {
				label: 'Reconnected',
				flash: 'green',
				rowCount: 'Cleanup resumed',
			},
		},
	],
};

// ─── Build step definitions ────────────────────────────────────────────

const STEP_DEFS = [
	{ id: 'create-job', title: 'Create Cleanup Job Class' },
	{ id: 'token-cleanup', title: 'Token Cleanup Logic' },
	{ id: 'recurring-yml', title: 'Configure Recurring Schedule' },
	{ id: 'orphan-job', title: 'Add Orphan Cleanup Job' },
	{ id: 'error-handling', title: 'Error Handling' },
	{ id: 'monitoring', title: 'Monitoring & Logging' },
];

// Step 0: Create cleanup job class (OptionCard)
const CREATE_JOB_OPTIONS = [
	{
		id: 'wrong-plain-ruby',
		label: 'Plain Ruby class with a run method',
		code: `class CleanExpiredTokensJob
  def run
    Session.where("expires_at < ?", Time.current).delete_all
  end
end`,
		correct: false,
		feedback:
			'A plain Ruby class cannot be enqueued by the queue system. Jobs must inherit from the base job class to use scheduling and retries.',
	},
	{
		id: 'wrong-rake-task',
		label: 'Rake task in lib/tasks/',
		code: `# lib/tasks/cleanup.rake
namespace :cleanup do
  task expired_tokens: :environment do
    Session.where("expires_at < ?", Time.current).delete_all
  end
end`,
		correct: false,
		feedback:
			'Rake tasks need external cron or manual execution. The queue system manages scheduling natively through its config file, no external cron needed.',
	},
	{
		id: 'correct',
		label: 'ApplicationJob subclass with queue_as :maintenance',
		code: `class CleanExpiredTokensJob < ApplicationJob
  queue_as :maintenance

  def perform
    # Cleanup logic goes here
  end
end`,
		correct: true,
	},
];

// Step 1: Token cleanup logic (OptionCard)
const TOKEN_CLEANUP_OPTIONS = [
	{
		id: 'wrong-delete-all',
		label: 'Delete all expired tokens in one query',
		code: `def perform
  Session.where("expires_at < ?", 24.hours.ago).delete_all
end`,
		correct: false,
		feedback:
			'Deleting 2M records in a single DELETE locks the table for minutes, blocking all session lookups. Use batching to delete in smaller chunks.',
	},
	{
		id: 'correct',
		label: 'Batch deletion with in_batches and logging',
		code: `def perform
  expired = Session.where("expires_at < ?", 24.hours.ago)
  count = expired.count

  expired.in_batches(of: 10_000) do |batch|
    batch.delete_all
  end

  Rails.logger.info(
    "[CleanExpiredTokensJob] Purged #{count} expired sessions"
  )
end`,
		correct: true,
	},
	{
		id: 'wrong-destroy-all',
		label: 'Use destroy_all for callbacks',
		code: `def perform
  Session.where("expires_at < ?", 24.hours.ago).destroy_all
end`,
		correct: false,
		feedback:
			'destroy_all loads every record into memory and runs callbacks one by one. For 2M expired tokens, this causes OOM. Expired sessions need no callbacks.',
	},
];

// Step 2: Configure recurring.yml (Terminal)
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

// Step 3: Add orphan cleanup job (OptionCard)
const ORPHAN_JOB_OPTIONS = [
	{
		id: 'wrong-no-batch',
		label: 'Find and delete orphans without batching',
		code: `class PurgeOrphansJob < ApplicationJob
  queue_as :default

  def perform
    OrderItem.left_joins(:order)
      .where(orders: { id: nil })
      .delete_all
  end
end`,
		correct: false,
		feedback:
			'Deleting 500K rows in one statement locks the table. Also, maintenance jobs belong on a dedicated queue so they do not block user-facing work.',
	},
	{
		id: 'wrong-wrong-queue',
		label: 'Batch deletion on the default queue',
		code: `class PurgeOrphansJob < ApplicationJob
  queue_as :default

  def perform
    OrderItem.left_joins(:order)
      .where(orders: { id: nil })
      .in_batches(of: 5_000, &:delete_all)

    Rails.logger.info("[PurgeOrphansJob] Orphans purged")
  end
end`,
		correct: false,
		feedback:
			'The deletion logic is correct, but maintenance jobs should use a dedicated queue. Running cleanup on :default competes with user-facing jobs like order processing.',
	},
	{
		id: 'correct',
		label: 'Batch deletion on the maintenance queue with logging',
		code: `class PurgeOrphansJob < ApplicationJob
  queue_as :maintenance

  def perform
    orphans = OrderItem.left_joins(:order)
      .where(orders: { id: nil })
    count = orphans.count

    orphans.in_batches(of: 5_000, &:delete_all)

    Rails.logger.info(
      "[PurgeOrphansJob] Purged #{count} orphaned records"
    )
  end
end`,
		correct: true,
	},
];

// Step 4: Error handling (OptionCard)
const ERROR_HANDLING_OPTIONS = [
	{
		id: 'wrong-no-retry',
		label: 'No error handling (let it crash)',
		code: `class CleanExpiredTokensJob < ApplicationJob
  queue_as :maintenance

  def perform
    # If it fails, it just fails.
    # Queue marks it as failed.
    Session.where("expires_at < ?", 24.hours.ago)
      .in_batches(of: 10_000, &:delete_all)
  end
end`,
		correct: false,
		feedback:
			'Without retry logic, a transient error (network hiccup, connection timeout) permanently fails the job. Recurring jobs need resilience for temporary failures.',
	},
	{
		id: 'correct',
		label: 'retry_on transient errors, discard_on fatal errors',
		code: `class CleanExpiredTokensJob < ApplicationJob
  queue_as :maintenance

  retry_on ActiveRecord::ConnectionTimeoutError,
    wait: 30.seconds, attempts: 3

  discard_on ActiveRecord::RecordNotFound

  def perform
    Session.where("expires_at < ?", 24.hours.ago)
      .in_batches(of: 10_000, &:delete_all)
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-rescue-silence',
		label: 'Rescue all exceptions and silently continue',
		code: `class CleanExpiredTokensJob < ApplicationJob
  queue_as :maintenance

  def perform
    Session.where("expires_at < ?", 24.hours.ago)
      .in_batches(of: 10_000, &:delete_all)
  rescue => e
    # Ignore errors, will run again next hour
  end
end`,
		correct: false,
		feedback:
			'Silently swallowing exceptions hides real bugs. Use explicit retry for transient errors and discard for expected ones. Let unexpected errors surface.',
	},
];

// Step 5: Monitoring & Logging (OptionCard)
const MONITORING_OPTIONS = [
	{
		id: 'wrong-no-metrics',
		label: 'Just log "done" with no details',
		code: `def perform
  Session.where("expires_at < ?", 24.hours.ago)
    .in_batches(of: 10_000, &:delete_all)
  Rails.logger.info("Done")
end`,
		correct: false,
		feedback:
			'"Done" tells you nothing. How many records were cleaned? How long did it take? Monitoring needs counts, timing, and structured data for alerting.',
	},
	{
		id: 'wrong-puts',
		label: 'Use puts for output',
		code: `def perform
  count = Session.where("expires_at < ?", 24.hours.ago).count
  Session.where("expires_at < ?", 24.hours.ago)
    .in_batches(of: 10_000, &:delete_all)
  puts "Cleaned #{count} sessions"
end`,
		correct: false,
		feedback:
			'puts writes to stdout, which is not captured by log aggregators in production. Use structured logging for monitoring and alerting.',
	},
	{
		id: 'correct',
		label: 'Structured logging with count, duration, and job name',
		code: `def perform
  start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
  expired = Session.where("expires_at < ?", 24.hours.ago)
  count = expired.count

  expired.in_batches(of: 10_000, &:delete_all)

  duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time
  Rails.logger.info({
    job: self.class.name,
    records_purged: count,
    duration_ms: (duration * 1000).round(2),
    status: "completed"
  }.to_json)
end`,
		correct: true,
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	null, // step 0: OptionCard (create job)
	null, // step 1: OptionCard (token cleanup)
	{
		// step 2: Terminal (recurring.yml)
		commands: RECURRING_YML_COMMANDS,
		outputLines: [
			{
				text: 'Created config/recurring.yml with Solid Queue schedule',
				color: 'green' as const,
			},
		],
	},
	null, // step 3: OptionCard (orphan job)
	null, // step 4: OptionCard (error handling)
	null, // step 5: OptionCard (monitoring)
];

// ─── Stress test scenarios ─────────────────────────────────────────────

const STRESS_SCENARIOS = [
	{
		id: 'expired-tokens',
		label: 'CleanExpiredTokensJob runs (hourly)',
		description: 'Scheduled hourly, purges expired session tokens in batches',
		method: 'POST' as const,
		path: '/jobs/clean_expired_tokens',
		actor: 'scheduler',
		expectedResult: 'allowed' as const,
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
		method: 'POST' as const,
		path: '/jobs/purge_orphans',
		actor: 'scheduler',
		expectedResult: 'allowed' as const,
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
		method: 'GET' as const,
		path: '/admin/storage',
		actor: 'admin',
		expectedResult: 'allowed' as const,
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
		method: 'POST' as const,
		path: '/jobs/clean_expired_tokens',
		actor: 'scheduler',
		expectedResult: 'blocked' as const,
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

// ─── Code preview builder ──────────────────────────────────────────────

function getCodeFiles(
	phase: 'observe' | 'build' | 'reward',
	completedStep: number,
) {
	if (phase === 'observe') {
		return [
			{
				filename: 'config/recurring.yml',
				language: 'yaml',
				code: `# config/recurring.yml
# (file does not exist)
# No recurring jobs configured
# All cleanup is manual (and forgotten)`,
			},
			{
				filename: 'app/jobs/',
				language: 'ruby',
				code: `# No cleanup job classes exist
# Database accumulates stale data:
#   - 2M expired session tokens
#   - 500K orphaned order items
#   - 100K stale cache entries
# Storage growing 5%/week with no automated maintenance`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (completedStep >= 0) {
			files.push({
				filename: 'app/jobs/clean_expired_tokens_job.rb',
				language: 'ruby',
				code: `class CleanExpiredTokensJob < ApplicationJob
  queue_as :maintenance

  def perform
    # Cleanup logic goes here
  end
end`,
			});
		}

		if (completedStep >= 1) {
			files[0] = {
				filename: 'app/jobs/clean_expired_tokens_job.rb',
				language: 'ruby',
				code: `class CleanExpiredTokensJob < ApplicationJob
  queue_as :maintenance

  def perform
    expired = Session.where("expires_at < ?", 24.hours.ago)
    count = expired.count

    expired.in_batches(of: 10_000) do |batch|
      batch.delete_all
    end

    Rails.logger.info(
      "[CleanExpiredTokensJob] Purged #{count} expired sessions"
    )
  end
end`,
			};
		}

		if (completedStep >= 2) {
			files.push({
				filename: 'config/recurring.yml',
				language: 'yaml',
				code: `# config/recurring.yml
production:
  clean_expired_tokens:
    class: CleanExpiredTokensJob
    schedule: "every hour"`,
			});
		}

		if (completedStep >= 3) {
			files.push({
				filename: 'app/jobs/purge_orphans_job.rb',
				language: 'ruby',
				code: `class PurgeOrphansJob < ApplicationJob
  queue_as :maintenance

  def perform
    orphans = OrderItem.left_joins(:order)
      .where(orders: { id: nil })
    count = orphans.count

    orphans.in_batches(of: 5_000, &:delete_all)

    Rails.logger.info(
      "[PurgeOrphansJob] Purged #{count} orphaned records"
    )
  end
end`,
			});
			// Update recurring.yml to include both jobs
			const ymlIdx = files.findIndex(
				(f) => f.filename === 'config/recurring.yml',
			);
			if (ymlIdx >= 0) {
				files[ymlIdx] = {
					filename: 'config/recurring.yml',
					language: 'yaml',
					code: `# config/recurring.yml
production:
  clean_expired_tokens:
    class: CleanExpiredTokensJob
    schedule: "every hour"
    queue: maintenance
  purge_orphans:
    class: PurgeOrphansJob
    schedule: "every day at 2am"
    queue: maintenance`,
				};
			}
		}

		if (completedStep >= 4) {
			files[0] = {
				filename: 'app/jobs/clean_expired_tokens_job.rb',
				language: 'ruby',
				code: `class CleanExpiredTokensJob < ApplicationJob
  queue_as :maintenance

  retry_on ActiveRecord::ConnectionTimeoutError,
    wait: 30.seconds, attempts: 3

  discard_on ActiveRecord::RecordNotFound

  def perform
    expired = Session.where("expires_at < ?", 24.hours.ago)
    count = expired.count

    expired.in_batches(of: 10_000) do |batch|
      batch.delete_all
    end

    Rails.logger.info(
      "[CleanExpiredTokensJob] Purged #{count} expired sessions"
    )
  end
end`,
			};
		}

		if (completedStep >= 5) {
			files[0] = {
				filename: 'app/jobs/clean_expired_tokens_job.rb',
				language: 'ruby',
				code: `class CleanExpiredTokensJob < ApplicationJob
  queue_as :maintenance

  retry_on ActiveRecord::ConnectionTimeoutError,
    wait: 30.seconds, attempts: 3

  discard_on ActiveRecord::RecordNotFound

  def perform
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    expired = Session.where("expires_at < ?", 24.hours.ago)
    count = expired.count

    expired.in_batches(of: 10_000, &:delete_all)

    duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time
    Rails.logger.info({
      job: self.class.name,
      records_purged: count,
      duration_ms: (duration * 1000).round(2),
      status: "completed"
    }.to_json)
  end
end`,
			};
		}

		if (files.length === 0) {
			files.push({
				filename: 'app/jobs/clean_expired_tokens_job.rb',
				language: 'ruby',
				code: '# Step 1: Create the job class...',
			});
		}

		return files;
	}

	// reward
	return [
		{
			filename: 'config/recurring.yml',
			language: 'yaml',
			code: `# config/recurring.yml
production:
  clean_expired_tokens:
    class: CleanExpiredTokensJob
    schedule: "every hour"
    queue: maintenance
  purge_orphans:
    class: PurgeOrphansJob
    schedule: "every day at 2am"
    queue: maintenance`,
		},
		{
			filename: 'app/jobs/clean_expired_tokens_job.rb',
			language: 'ruby',
			code: `class CleanExpiredTokensJob < ApplicationJob
  queue_as :maintenance

  retry_on ActiveRecord::ConnectionTimeoutError,
    wait: 30.seconds, attempts: 3

  discard_on ActiveRecord::RecordNotFound

  def perform
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    expired = Session.where("expires_at < ?", 24.hours.ago)
    count = expired.count

    expired.in_batches(of: 10_000, &:delete_all)

    duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time
    Rails.logger.info({
      job: self.class.name,
      records_purged: count,
      duration_ms: (duration * 1000).round(2),
      status: "completed"
    }.to_json)
  end
end`,
		},
		{
			filename: 'app/jobs/purge_orphans_job.rb',
			language: 'ruby',
			code: `class PurgeOrphansJob < ApplicationJob
  queue_as :maintenance

  def perform
    orphans = OrderItem.left_joins(:order)
      .where(orders: { id: nil })
    count = orphans.count

    orphans.in_batches(of: 5_000, &:delete_all)

    Rails.logger.info(
      "[PurgeOrphansJob] Purged #{count} orphaned records"
    )
  end
end`,
		},
	];
}

// ─── Custom React Flow nodes ──────────────────────────────────────────

function flashToStatus(flash: ZoneFlash): FlowNodeData['status'] {
	if (flash === 'green') return 'active';
	if (flash === 'amber') return 'warning';
	if (flash === 'red') return 'error';
	return 'idle';
}

interface SchedulerNodeData extends SimpleNodeState {
	[key: string]: unknown;
}

const SchedulerNode = memo(({ data }: { data: SchedulerNodeData }) => {
	const d = data as SchedulerNodeData;
	const flowData: FlowNodeData = {
		label: 'Scheduler',
		icon: 'SC',
		color: '#f97316',
		status: flashToStatus(d.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<>
			<FlowHandles />
			<FlowNode data={flowData}>
				<p className="text-xs text-foreground font-medium truncate">
					{d.label}
				</p>
			</FlowNode>
		</>
	);
});

interface AppNodeData extends SimpleNodeState {
	[key: string]: unknown;
}

const AppNode = memo(({ data }: { data: AppNodeData }) => {
	const d = data as AppNodeData;
	const flowData: FlowNodeData = {
		label: 'Rails App',
		icon: 'RA',
		color: '#8b5cf6',
		status: flashToStatus(d.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<>
			<FlowHandles />
			<FlowNode data={flowData}>
				<p className="text-xs text-foreground font-medium truncate">
					{d.label}
				</p>
			</FlowNode>
		</>
	);
});

interface DbNodeData extends DbNodeState {
	[key: string]: unknown;
}

const DbNode = memo(({ data }: { data: DbNodeData }) => {
	const d = data as DbNodeData;
	const flowData: FlowNodeData = {
		label: 'Database',
		icon: 'DB',
		color: '#10b981',
		description: d.label,
		status: flashToStatus(d.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<>
			<FlowHandles />
			<FlowNode data={flowData}>
				<div className="mt-1.5 pt-1.5 border-t border-border">
					<p className="text-[10px] font-mono text-muted-foreground truncate">
						{d.rowCount}
					</p>
				</div>
			</FlowNode>
		</>
	);
});

// ── Custom edge ──

function toDotFill(twClass: string): string {
	if (twClass.includes('emerald')) return '#10b981';
	if (twClass.includes('red')) return '#ef4444';
	if (twClass.includes('amber')) return '#f59e0b';
	if (twClass.includes('cyan')) return '#06b6d4';
	return '#a1a1aa';
}

interface RjEdgeData extends EdgeVizState {
	[key: string]: unknown;
}

const RjEdge = memo(
	({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
		const d = (data ?? DEFAULT_EDGE) as RjEdgeData;
		const [edgePath, labelX, labelY] = getStraightPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
		});

		const fill = toDotFill(d.dotColor);
		const dotPath = d.reverse ? reversePath(edgePath) : edgePath;

		const dots: DotConfig[] = d.active
			? [0, 1, 2].map((i) => ({
					id: `${id}-d${i}`,
					color: fill,
					r: 5,
					dur: '1.2s',
					begin: i === 0 ? '0s' : `-${i * 0.4}s`,
				}))
			: [];

		return (
			<>
				<BaseEdge
					id={id}
					path={edgePath}
					style={{
						stroke: d.active ? fill : '#a1a1aa',
						strokeWidth: 2,
						strokeDasharray: '6 4',
					}}
				/>
				{dots.length > 0 && <AnimatedDots dots={dots} path={dotPath} />}
				{d.label && (
					<EdgeLabelRenderer>
						<div
							className="nodrag nopan pointer-events-none absolute text-[10px] font-mono text-foreground bg-background/90 px-1.5 py-0.5 rounded border border-border max-w-64 text-center whitespace-nowrap"
							style={{
								transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 18}px)`,
							}}
						>
							{d.label}
						</div>
					</EdgeLabelRenderer>
				)}
			</>
		);
	},
);

const rjNodeTypes = {
	scheduler: SchedulerNode,
	app: AppNode,
	db: DbNode,
};
const rjEdgeTypes = { rj: RjEdge };

// ─── Main component ────────────────────────────────────────────────────

export function Level45RecurringJobs({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<'observe' | 'build' | 'reward'>('observe');
	const isReward = phase === 'reward';

	// ── Visualization state ──
	const [schedulerState, setSchedulerState] =
		useState<SimpleNodeState>(DEFAULT_SCHEDULER);
	const [appState, setAppState] = useState<SimpleNodeState>(DEFAULT_APP);
	const [dbState, setDbState] = useState<DbNodeState>(DEFAULT_DB);
	const [edge1State, setEdge1State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge2State, setEdge2State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setSchedulerState(isReward ? DEFAULT_SCHEDULER_REWARD : DEFAULT_SCHEDULER);
		setAppState(isReward ? DEFAULT_APP_REWARD : DEFAULT_APP);
		setDbState(isReward ? DEFAULT_DB_REWARD : DEFAULT_DB);
		setEdge1State(DEFAULT_EDGE);
		setEdge2State(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.scheduler)
			setSchedulerState((prev) => ({ ...prev, ...frame.scheduler }));
		if (frame.app) setAppState((prev) => ({ ...prev, ...frame.app }));
		if (frame.db) setDbState((prev) => ({ ...prev, ...frame.db }));
		if (frame.edge1) setEdge1State((prev) => ({ ...prev, ...frame.edge1 }));
		if (frame.edge2) setEdge2State((prev) => ({ ...prev, ...frame.edge2 }));
	}, []);

	const runAnimation = useCallback(
		(frames: AnimFrame[], onDone?: () => void, frameDelay?: number) => {
			const delay = frameDelay ?? ANIMATION_DURATION_MS;
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
			resetViz();
			setVizAnimating(true);

			const newTimers: ReturnType<typeof setTimeout>[] = [];
			for (let i = 0; i < frames.length; i++) {
				const t = setTimeout(() => applyFrame(frames[i]), i * delay);
				newTimers.push(t);
			}
			const tCleanup = setTimeout(() => {
				setEdge1State((prev) => ({ ...prev, active: false }));
				setEdge2State((prev) => ({ ...prev, active: false }));
			}, frames.length * delay);
			newTimers.push(tCleanup);
			const tEnd = setTimeout(
				() => {
					setVizAnimating(false);
					onDone?.();
				},
				frames.length * delay + 100,
			);
			newTimers.push(tEnd);
			timersRef.current = newTimers;
		},
		[resetViz, applyFrame],
	);

	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, []);

	// ── Observe phase ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});

	const handleProbe = useCallback(
		(probeId: string) => {
			if (vizAnimating) return;
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}
			const frames = PROBE_FRAMES[probeId];
			if (frames) runAnimation(frames, undefined, ANIMATION_DURATION_MS * 2);
		},
		[vizAnimating, discoveryGating, runAnimation],
	);

	// ── Build phase ──
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const allOptions: Record<number, typeof CREATE_JOB_OPTIONS> = {
				0: CREATE_JOB_OPTIONS,
				1: TOKEN_CLEANUP_OPTIONS,
				3: ORPHAN_JOB_OPTIONS,
				4: ERROR_HANDLING_OPTIONS,
				5: MONITORING_OPTIONS,
			};
			const options = allOptions[stepper.currentStep];
			if (!options) return;
			const option = options.find((o) => o.id === optionId);
			if (!option) return;
			if (option.correct) {
				stepper.completeStep();
			} else {
				stepper.recordWrongAttempt(option.feedback ?? 'Not quite right.');
			}
		},
		[stepper],
	);

	// ── Reward phase ──
	const stressTest = useStressTest(STRESS_SCENARIOS);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_FRAMES[scenarioId];
			if (frames) {
				setSchedulerState(DEFAULT_SCHEDULER_REWARD);
				setAppState(DEFAULT_APP_REWARD);
				setDbState(DEFAULT_DB_REWARD);
				setEdge1State(DEFAULT_EDGE);
				setEdge2State(DEFAULT_EDGE);
				runAnimation(frames, undefined, ANIMATION_DURATION_MS * 2);
			}
		},
		[vizAnimating, stressTest, runAnimation],
	);

	// ── Header handlers ──
	const handleValidate = useCallback((): ValidationResult => {
		if (phase !== 'reward') {
			return { valid: false, message: 'Complete all phases first.' };
		}
		if (stressTest.results.length < 3) {
			return {
				valid: false,
				message: 'Fire at least 3 stress test scenarios.',
			};
		}
		return {
			valid: true,
			message: 'Recurring jobs keep your database clean!',
		};
	}, [phase, stressTest.results.length]);

	const handleComplete = useCallback(() => {
		onComplete?.({ stars: stepper.starRating });
	}, [onComplete, stepper.starRating]);

	const handleReset = useCallback(() => {
		setPhase('observe');
		setVizAnimating(false);
		resetViz();
		stressTest.reset();
		for (const t of timersRef.current) clearTimeout(t);
		timersRef.current = [];
	}, [resetViz, stressTest]);

	// ── Flow nodes & edges ──
	// Horizontal: Scheduler (left) -> Rails App (center) -> Database (right)
	const flowNodes = useMemo(
		(): Node[] => [
			{
				id: 'scheduler',
				type: 'scheduler',
				position: { x: 0, y: 50 },
				data: { ...schedulerState } satisfies SchedulerNodeData,
			},
			{
				id: 'app',
				type: 'app',
				position: { x: 300, y: 50 },
				data: { ...appState } satisfies AppNodeData,
			},
			{
				id: 'db',
				type: 'db',
				position: { x: 600, y: 40 },
				data: { ...dbState } satisfies DbNodeData,
			},
		],
		[schedulerState, appState, dbState],
	);

	const flowEdges = useMemo(
		(): Edge[] => [
			{
				id: 'e-sched-app',
				source: 'scheduler',
				target: 'app',
				type: 'rj',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge1State } satisfies RjEdgeData,
			},
			{
				id: 'e-app-db',
				source: 'app',
				target: 'db',
				type: 'rj',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge2State } satisfies RjEdgeData,
			},
		],
		[edge1State, edge2State],
	);

	// ── Build step config ──
	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx === 2) {
			const termData = TERMINAL_STEP_MAP[idx];
			return {
				type: 'terminal' as const,
				commands: termData?.commands
					? shuffleOptions(termData.commands, idx)
					: undefined,
				outputLines: termData?.outputLines,
			};
		}
		const stepOptions: Record<number, typeof CREATE_JOB_OPTIONS> = {
			0: CREATE_JOB_OPTIONS,
			1: TOKEN_CLEANUP_OPTIONS,
			3: ORPHAN_JOB_OPTIONS,
			4: ERROR_HANDLING_OPTIONS,
			5: MONITORING_OPTIONS,
		};
		return {
			type: 'option' as const,
			options: shuffleOptions(stepOptions[idx], idx),
		};
	}, [stepper.currentStep]);

	const buildCodePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	// ── Option step descriptions ──
	const OPTION_DESCRIPTIONS: Record<number, string> = {
		0: 'How should the cleanup job class be structured?',
		1: 'How should the token cleanup logic handle 2M expired rows?',
		3: 'How should the orphan cleanup job be implemented?',
		4: 'How should recurring jobs handle transient and fatal errors?',
		5: 'How should the job report its results for monitoring?',
	};

	// ── Render: Left panel ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground mb-2">
							Your database has 2M expired session tokens, 500K orphaned
							records, and 100K stale cache entries. Storage is growing 5% per
							week. You have Solid Queue from Level 22 for one-off background
							jobs, but nothing runs on a recurring schedule.
						</p>
						<p className="text-sm text-muted-foreground">
							Nobody cleans up because cleanup never happens automatically. Fire
							probes to see the damage.
						</p>
					</div>
					<DiscoveryChecklist
						discoveredCount={discoveryGating.discoveredCount}
						discoveries={discoveryGating.discoveries}
						minRequired={discoveryGating.minRequired}
					/>
					{discoveryGating.isUnlocked && (
						<Button
							className="w-full animate-in fade-in duration-500"
							onClick={() => setPhase('build')}
						>
							Build the Fix <ArrowRight className="w-4 h-4 ml-2" />
						</Button>
					)}
				</div>
			);
		}

		if (phase === 'build') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Building
						</h3>
						<p className="text-sm text-muted-foreground">
							Create recurring cleanup jobs with Solid Queue. Configure
							schedules, error handling, and monitoring to keep the database
							clean automatically.
						</p>
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						steps={stepper.steps}
					/>
				</div>
			);
		}

		// reward
		return (
			<div className="space-y-4 p-4">
				<div>
					<h3 className="text-sm font-semibold text-foreground mb-2">Legend</h3>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-emerald-500" />
							<span className="text-muted-foreground">
								Job completed successfully
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">
								Job failed (retry triggered)
							</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Completed</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Retried</div>
					</div>
				</div>
			</div>
		);
	};

	// ── Render: Center panel ──
	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col p-4 gap-4">
					<div className="flex-1 min-h-0">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={rjEdgeTypes}
							nodes={flowNodes}
							nodeTypes={rjNodeTypes}
						/>
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={vizAnimating}
							onProbe={handleProbe}
							probes={PROBES}
						/>
					</div>
				</div>
			);
		}

		if (phase === 'build') {
			if (
				currentStepConfig.type === 'terminal' &&
				currentStepConfig.commands &&
				currentStepConfig.outputLines
			) {
				return (
					<div className="flex-1 flex flex-col p-4">
						<TerminalChoiceStep
							commands={currentStepConfig.commands}
							completed={stepper.isCurrentStepCompleted}
							description={
								<p className="text-sm text-muted-foreground">
									Configure the recurring job schedule. The queue system reads
									from a YAML configuration file.
								</p>
							}
							hasNext={stepper.currentStep < STEP_DEFS.length - 1}
							initialHistory={buildTerminalHistory(
								TERMINAL_STEP_MAP,
								stepper.currentStep,
							)}
							onCorrect={() => stepper.completeStep()}
							onNext={stepper.nextStep}
							onWrong={(fb) => stepper.recordWrongAttempt(fb)}
							outputLines={currentStepConfig.outputLines}
							stepKey={stepper.currentStep}
							title={STEP_DEFS[stepper.currentStep].title}
						/>
					</div>
				);
			}

			if (currentStepConfig.type === 'option' && currentStepConfig.options) {
				return (
					<div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
						<div>
							<h3 className="text-lg font-semibold text-foreground">
								{STEP_DEFS[stepper.currentStep].title}
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{OPTION_DESCRIPTIONS[stepper.currentStep]}
							</p>
						</div>
						{stepper.lastFeedback && (
							<ErrorFeedback message={stepper.lastFeedback} />
						)}
						<div className="space-y-3">
							{currentStepConfig.options.map((opt) => (
								<OptionCard
									disabled={stepper.isCurrentStepCompleted}
									key={opt.id}
									mono
									name={opt.label}
									onClick={() => handleOptionSelect(opt.id)}
									selected={stepper.isCurrentStepCompleted && opt.correct}
								/>
							))}
						</div>
						{stepper.isCurrentStepCompleted &&
							stepper.currentStep < STEP_DEFS.length - 1 && (
								<Button className="gap-2" onClick={stepper.nextStep} size="sm">
									Next Step <ArrowRight className="w-4 h-4" />
								</Button>
							)}
						{stepper.isCurrentStepCompleted &&
							stepper.currentStep === STEP_DEFS.length - 1 && (
								<Button
									className="gap-2"
									onClick={() => setPhase('reward')}
									size="sm"
								>
									Next Step <ArrowRight className="w-4 h-4" />
								</Button>
							)}
					</div>
				);
			}
		}

		// reward
		return (
			<div className="flex-1 flex flex-col p-4 gap-4">
				<div className="flex-1 min-h-0">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={rjEdgeTypes}
						nodes={flowNodes}
						nodeTypes={rjNodeTypes}
					/>
				</div>
				<div className="flex-1 min-h-0 flex flex-col px-6 pb-2">
					<StressTestPanel
						allowedCount={stressTest.allowedCount}
						blockedCount={stressTest.blockedCount}
						canAutoFire={stressTest.canAutoFire}
						className="flex-1 flex flex-col"
						disabled={vizAnimating}
						isAutoFiring={stressTest.isAutoFiring}
						onFire={handleFireScenario}
						onToggleAutoFire={stressTest.toggleAutoFire}
						results={stressTest.results}
						scenarios={STRESS_SCENARIOS}
					/>
				</div>
			</div>
		);
	};

	return (
		<LevelLayout>
			<LeftPanel>{renderLeftPanel()}</LeftPanel>
			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Recurring Jobs"
					levelNumber={45}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={handleValidate}
				/>
				{renderCenterPanel()}
			</CenterPanel>
			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'build' ? buildCodePreviewStep : 0,
					)}
					learningGoal="Solid Queue recurring jobs automate database maintenance with cron-like scheduling in config/recurring.yml. Use dedicated queues, batch deletion, and structured logging."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level45RecurringJobs;
