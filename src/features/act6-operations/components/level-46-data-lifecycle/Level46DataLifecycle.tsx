/**
 * Level 46: Data Lifecycle
 *
 * Three-phase flow: observe -> build -> reward
 *
 * Phase 1 (observe): 3-node layout (Customer, Rails App, Database with "50M rows").
 *   Probes show slow queries scanning 50M rows, slow backups.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: Define data temperature policy (OptionCard)
 *   Step 1: Generate archive table migration (terminal)
 *   Step 2: Create archiving job (OptionCard)
 *   Step 3: Configure transparent archive reads (OptionCard)
 *   Step 4: Implement data destruction policy (OptionCard)
 *   Step 5: Schedule archiving job with Solid Queue (OptionCard)
 *
 * Phase 3 (reward): 4-node layout (Customer, Rails App, Hot DB, Archive DB).
 *   Data is split between hot and archive. Stress tests verify fast queries.
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

registerLevelCode('act6-level46-data-lifecycle', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface SimpleNodeState {
	label: string;
	sublabel: string;
	flash: ZoneFlash;
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	customer?: Partial<SimpleNodeState>;
	app?: Partial<SimpleNodeState>;
	db?: Partial<SimpleNodeState>;
	hotDb?: Partial<SimpleNodeState>;
	archiveDb?: Partial<SimpleNodeState>;
	/** Customer <-> App edge */
	edge1?: Partial<EdgeVizState>;
	/** App <-> DB / App <-> Hot DB edge */
	edge2?: Partial<EdgeVizState>;
	/** App <-> Archive DB edge (reward only) */
	edge3?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_CUSTOMER: SimpleNodeState = {
	label: 'Idle',
	sublabel: '',
	flash: 'idle',
};

const DEFAULT_APP: SimpleNodeState = {
	label: 'Idle',
	sublabel: '',
	flash: 'idle',
};

const DEFAULT_DB: SimpleNodeState = {
	label: '50M rows',
	sublabel: 'All orders in one table',
	flash: 'idle',
};

const DEFAULT_HOT_DB: SimpleNodeState = {
	label: '2.5M rows',
	sublabel: 'Last 90 days (hot)',
	flash: 'green',
};

const DEFAULT_ARCHIVE_DB: SimpleNodeState = {
	label: '47.5M rows',
	sublabel: 'Archived (warm/cold)',
	flash: 'idle',
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-cyan-500',
};

// ─── Discovery definitions ─────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'slow-recent', label: 'Recent order queries scan 50M rows' },
	{ id: 'slow-old', label: 'Old order lookups scan entire table' },
	{ id: 'slow-backup', label: 'Daily backup takes 8 hours' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES = [
	{
		id: 'recent-orders',
		label: 'Customer views recent orders (slow)',
		command: 'Order.where(customer_id: 42).order(created_at: :desc).limit(10)',
		responseLines: [
			{
				text: 'Seq Scan on orders (rows=50,000,000)',
				color: 'red' as const,
			},
			{ text: 'Planning time: 12ms', color: 'yellow' as const },
			{ text: 'Execution time: 3,200ms', color: 'red' as const },
			{
				text: '# 3 second response for 10 recent orders',
				color: 'red' as const,
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
		command: 'Order.find_by(id: 12345, created_at: "2023-03-15")',
		responseLines: [
			{
				text: 'Seq Scan on orders (rows=50,000,000)',
				color: 'red' as const,
			},
			{ text: 'Execution time: 4,100ms', color: 'red' as const },
			{
				text: '# Same 50M row scan for one old order',
				color: 'red' as const,
			},
			{
				text: "# This order hasn't been accessed in 2 years",
				color: 'red' as const,
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
				color: 'yellow' as const,
			},
			{ text: 'Duration: 8h 12m', color: 'red' as const },
			{
				text: '# Backup window exceeded, overlapping with peak hours',
				color: 'red' as const,
			},
			{
				text: '# Migration ALTER TABLE takes 4+ hours (table lock)',
				color: 'red' as const,
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

// ─── Observe animation frames ─────────────────────────────────────────

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'recent-orders': [
		{
			customer: {
				label: 'GET /orders',
				sublabel: 'Recent orders page',
				flash: 'idle',
			},
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /orders',
				dotColor: 'bg-cyan-500',
			},
		},
		{
			edge1: { active: false },
			app: { label: 'Order.limit(10)', sublabel: 'Querying...', flash: 'idle' },
			edge2: {
				active: true,
				reverse: false,
				label: 'SELECT * FROM orders',
				dotColor: 'bg-cyan-500',
			},
		},
		{
			db: { label: 'Seq Scan 50M rows', sublabel: '3,200ms', flash: 'red' },
			edge2: {
				active: true,
				reverse: true,
				label: '10 rows (3.2s)',
				dotColor: 'bg-red-500',
			},
		},
		{
			edge2: { active: false },
			app: { label: '3.2s response', sublabel: 'Too slow', flash: 'red' },
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK (3.2s)',
				dotColor: 'bg-red-500',
			},
			customer: {
				label: 'Page loaded (3.2s)',
				sublabel: 'Terrible UX',
				flash: 'red',
			},
		},
	],
	'old-order': [
		{
			customer: {
				label: 'GET /orders/12345',
				sublabel: 'Order from 2023',
				flash: 'idle',
			},
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /orders/12345',
				dotColor: 'bg-cyan-500',
			},
		},
		{
			edge1: { active: false },
			app: {
				label: 'Order.find(12345)',
				sublabel: 'Querying...',
				flash: 'idle',
			},
			edge2: {
				active: true,
				reverse: false,
				label: 'SELECT * FROM orders WHERE id=12345',
				dotColor: 'bg-cyan-500',
			},
		},
		{
			db: {
				label: 'Seq Scan 50M rows',
				sublabel: '4,100ms for 1 row',
				flash: 'red',
			},
			edge2: {
				active: true,
				reverse: true,
				label: '1 row (4.1s)',
				dotColor: 'bg-red-500',
			},
		},
		{
			edge2: { active: false },
			app: {
				label: '4.1s response',
				sublabel: 'For one old order',
				flash: 'red',
			},
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK (4.1s)',
				dotColor: 'bg-red-500',
			},
			customer: {
				label: 'Finally loaded (4.1s)',
				sublabel: 'Customer frustrated',
				flash: 'red',
			},
		},
	],
	'backup-slow': [
		{
			app: {
				label: 'pg_dump started',
				sublabel: 'Nightly backup',
				flash: 'amber',
			},
			edge2: {
				active: true,
				reverse: false,
				label: 'COPY orders TO stdout',
				dotColor: 'bg-amber-500',
			},
		},
		{
			db: {
				label: 'Dumping 50M rows...',
				sublabel: '2h elapsed, 25% done',
				flash: 'amber',
			},
		},
		{
			db: {
				label: 'Still dumping...',
				sublabel: '6h elapsed, 75% done',
				flash: 'red',
			},
			app: {
				label: 'Peak hours started',
				sublabel: 'Backup still running',
				flash: 'red',
			},
		},
		{
			db: {
				label: '8h 12m to backup',
				sublabel: 'Migrations blocked too',
				flash: 'red',
			},
			edge2: { active: false },
			app: {
				label: 'Backup overlaps traffic',
				sublabel: 'ALTER TABLE = hours of lock',
				flash: 'red',
			},
		},
	],
};

// ─── Reward animation frames ──────────────────────────────────────────

const REWARD_FRAMES: Record<string, AnimFrame[]> = {
	'recent-orders': [
		{
			customer: {
				label: 'GET /orders',
				sublabel: 'Recent orders page',
				flash: 'idle',
			},
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /orders',
				dotColor: 'bg-cyan-500',
			},
		},
		{
			edge1: { active: false },
			app: {
				label: 'Order.limit(10)',
				sublabel: 'Hot table query',
				flash: 'idle',
			},
			edge2: {
				active: true,
				reverse: false,
				label: 'SELECT FROM orders (2.5M)',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			hotDb: {
				label: 'Index scan 2.5M rows',
				sublabel: '50ms',
				flash: 'green',
			},
			edge2: {
				active: true,
				reverse: true,
				label: '10 rows (50ms)',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			edge2: { active: false },
			app: { label: '50ms response', sublabel: '64x faster', flash: 'green' },
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK (50ms)',
				dotColor: 'bg-emerald-500',
			},
			customer: {
				label: 'Instant load (50ms)',
				sublabel: 'Great UX',
				flash: 'green',
			},
		},
	],
	'old-order': [
		{
			customer: {
				label: 'GET /orders/12345',
				sublabel: 'Order from 2023',
				flash: 'idle',
			},
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /orders/12345',
				dotColor: 'bg-cyan-500',
			},
		},
		{
			edge1: { active: false },
			app: {
				label: 'Not in hot table',
				sublabel: 'Checking archive...',
				flash: 'amber',
			},
			edge3: {
				active: true,
				reverse: false,
				label: 'SELECT FROM archived_orders',
				dotColor: 'bg-amber-500',
			},
		},
		{
			archiveDb: {
				label: 'Found in archive',
				sublabel: '120ms',
				flash: 'green',
			},
			edge3: {
				active: true,
				reverse: true,
				label: '1 row (120ms)',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			edge3: { active: false },
			app: {
				label: 'Transparent read',
				sublabel: '120ms from archive',
				flash: 'green',
			},
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK (120ms)',
				dotColor: 'bg-emerald-500',
			},
			customer: {
				label: 'Order loaded (120ms)',
				sublabel: 'Seamless archive read',
				flash: 'green',
			},
		},
	],
	'backup-fast': [
		{
			app: {
				label: 'pg_dump started',
				sublabel: 'Hot table only',
				flash: 'idle',
			},
			edge2: {
				active: true,
				reverse: false,
				label: 'COPY orders TO stdout',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			hotDb: {
				label: 'Dumping 2.5M rows',
				sublabel: '5% of original',
				flash: 'green',
			},
		},
		{
			edge2: { active: false },
			hotDb: {
				label: '20 min backup',
				sublabel: 'Was 8 hours',
				flash: 'green',
			},
			app: {
				label: 'Backup done before dawn',
				sublabel: 'Migrations fast too',
				flash: 'green',
			},
		},
	],
	'cold-destroy': [
		{
			app: {
				label: 'DestroyExpiredDataJob',
				sublabel: 'Running destruction policy',
				flash: 'amber',
			},
			edge3: {
				active: true,
				reverse: false,
				label: 'DELETE WHERE created_at < 7.years.ago',
				dotColor: 'bg-amber-500',
			},
		},
		{
			archiveDb: {
				label: 'Destroying cold data',
				sublabel: 'Beyond retention period',
				flash: 'amber',
			},
		},
		{
			edge3: { active: false },
			archiveDb: {
				label: '5M rows destroyed',
				sublabel: 'Compliance-safe deletion',
				flash: 'green',
			},
			app: {
				label: 'Storage freed',
				sublabel: 'Archive stays small',
				flash: 'green',
			},
		},
	],
};

// ─── Build step definitions ────────────────────────────────────────────

const STEP_DEFS = [
	{ id: 'temperature-policy', title: 'Define Temperature Policy' },
	{ id: 'archive-migration', title: 'Generate Archive Migration' },
	{ id: 'archiving-job', title: 'Create Archiving Job' },
	{ id: 'transparent-reads', title: 'Transparent Archive Reads' },
	{ id: 'destruction-policy', title: 'Data Destruction Policy' },
	{ id: 'schedule-job', title: 'Schedule with Solid Queue' },
];

const TEMPERATURE_POLICY_OPTIONS = [
	{
		id: 'wrong-time-only',
		label: 'Hot < 30 days, everything else is cold (delete after 1 year)',
		code: `# data_lifecycle_policy.rb
TIERS = {
  hot:  { max_age: 30.days },
  cold: { max_age: 1.year, action: :delete }
}`,
		correct: false,
		feedback:
			'Skipping the warm tier means 30-day-old data is immediately treated as cold. Reports and analytics teams need SQL access to data between 90 days and 1 year.',
	},
	{
		id: 'wrong-no-cold',
		label: 'Hot < 90 days, warm < 1 year, keep everything else forever',
		code: `# data_lifecycle_policy.rb
TIERS = {
  hot:  { max_age: 90.days },
  warm: { max_age: 1.year, action: :archive }
  # cold: keep forever in archive
}`,
		correct: false,
		feedback:
			'Without a cold tier and destruction policy, archived data grows forever. Storage costs increase without bound for data that may never be accessed again.',
	},
	{
		id: 'correct',
		label:
			'Hot < 90 days, warm < 1 year (archive), cold > 1 year (destroy after retention)',
		code: `# data_lifecycle_policy.rb
TIERS = {
  hot:  { max_age: 90.days, storage: :primary },
  warm: { max_age: 1.year, storage: :archive_table },
  cold: { max_age: 7.years, action: :destroy }
}`,
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
		code: `class ArchiveOrdersJob < ApplicationJob
  def perform
    Order.where("created_at < ?", 90.days.ago)
         .in_batches(of: 5_000)
         .delete_all
  end
end`,
		correct: false,
		feedback:
			'Deleting without archiving first means the data is gone permanently. Warm data still needs to be queryable for reports and customer support.',
	},
	{
		id: 'correct',
		label: 'Copy to archive table in batches, then delete originals',
		code: `class ArchiveOrdersJob < ApplicationJob
  def perform
    Order.where("created_at < ?", 90.days.ago)
         .find_in_batches(batch_size: 1_000) do |batch|
      ArchivedOrder.insert_all(batch.map(&:attributes))
      Order.where(id: batch.map(&:id)).delete_all
    end
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-no-batches',
		label: 'Copy all at once, then delete',
		code: `class ArchiveOrdersJob < ApplicationJob
  def perform
    old = Order.where("created_at < ?", 90.days.ago)
    ArchivedOrder.insert_all(old.map(&:attributes))
    old.delete_all
  end
end`,
		correct: false,
		feedback:
			'Loading millions of records into memory at once will cause an out-of-memory crash. Use find_in_batches to process records in manageable chunks.',
	},
];

const TRANSPARENT_READS_OPTIONS = [
	{
		id: 'wrong-manual-check',
		label: 'Require callers to check both tables manually',
		code: `# orders_controller.rb
def show
  @order = Order.find_by(id: params[:id])
  @order ||= ArchivedOrder.find_by(id: params[:id])
  # Every controller must duplicate this logic
end`,
		correct: false,
		feedback:
			'Duplicating fallback logic in every controller is error-prone. If any controller forgets, archived orders appear missing. Encapsulate the lookup in the model layer.',
	},
	{
		id: 'wrong-union-query',
		label: 'Always query both tables with UNION',
		code: `# order.rb
scope :with_archive, -> {
  from("(SELECT * FROM orders
        UNION ALL
        SELECT * FROM archived_orders) AS orders")
}`,
		correct: false,
		feedback:
			'A UNION query scans both tables on every request, defeating the purpose of splitting data. Hot queries should only hit the small table. Fall back to archive only when needed.',
	},
	{
		id: 'correct',
		label: 'Model-level fallback: check hot table first, then archive',
		code: `# app/models/order.rb
class Order < ApplicationRecord
  def self.find_with_archive(id)
    find_by(id: id) ||
      ArchivedOrder.find_by(id: id)
  end

  def self.for_customer(customer_id)
    recent = where(customer_id: customer_id)
    return recent if recent.exists?
    ArchivedOrder.where(customer_id: customer_id)
  end
end`,
		correct: true,
	},
];

const DESTRUCTION_POLICY_OPTIONS = [
	{
		id: 'wrong-delete-all',
		label: 'Delete all archived data older than 90 days',
		code: `class DestroyExpiredDataJob < ApplicationJob
  def perform
    ArchivedOrder.where("created_at < ?", 90.days.ago)
                 .delete_all
  end
end`,
		correct: false,
		feedback:
			'90 days is far too aggressive for archived data. Legal and compliance requirements typically mandate multi-year retention. Destruction should only apply to data past the retention period.',
	},
	{
		id: 'correct',
		label:
			'Destroy only data past the compliance retention period, with audit log',
		code: `class DestroyExpiredDataJob < ApplicationJob
  def perform
    expired = ArchivedOrder.where(
      "created_at < ?", 7.years.ago
    )
    count = expired.count
    expired.in_batches(of: 10_000).delete_all

    Rails.logger.info(
      "Destroyed #{count} orders past retention"
    )
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-no-logging',
		label: 'Destroy silently without audit trail',
		code: `class DestroyExpiredDataJob < ApplicationJob
  def perform
    ArchivedOrder.where(
      "created_at < ?", 7.years.ago
    ).in_batches(of: 10_000).delete_all
  end
end`,
		correct: false,
		feedback:
			'Destroying data without logging creates compliance risk. Auditors need proof of what was deleted, when, and how much. Always log destruction events.',
	},
];

const SCHEDULE_JOB_OPTIONS = [
	{
		id: 'wrong-cron-manual',
		label: 'Add a crontab entry on the server',
		code: `# crontab -e
0 2 * * * cd /app && bin/rails runner \\
  "ArchiveOrdersJob.perform_now"`,
		correct: false,
		feedback:
			'Manual crontab entries live outside the Rails app and are not version-controlled. If the server is replaced, the schedule is lost. Use Solid Queue for Rails-managed scheduling.',
	},
	{
		id: 'wrong-sleep-loop',
		label: 'Run an infinite loop in a background thread',
		code: `# config/initializers/archiver.rb
Thread.new do
  loop do
    ArchiveOrdersJob.perform_now
    sleep 24.hours
  end
end`,
		correct: false,
		feedback:
			'A background thread with sleep is fragile. It dies on deploy, has no error handling, and no visibility. Use Solid Queue recurring tasks for reliable scheduling.',
	},
	{
		id: 'correct',
		label: 'Configure Solid Queue recurring task',
		code: `# config/recurring.yml
archive_orders:
  class: ArchiveOrdersJob
  schedule: every day at 2am

destroy_expired_data:
  class: DestroyExpiredDataJob
  schedule: every sunday at 3am`,
		correct: true,
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	null, // step 0: OptionCard (temperature policy)
	{
		commands: ARCHIVE_MIGRATION_COMMANDS,
		outputLines: [
			{
				text: 'create db/migrate/20260327_create_archived_orders.rb',
				color: 'green' as const,
			},
		],
	},
	null, // step 2: OptionCard (archiving job)
	null, // step 3: OptionCard (transparent reads)
	null, // step 4: OptionCard (destruction policy)
	null, // step 5: OptionCard (schedule job)
];

// ─── Stress test scenarios ─────────────────────────────────────────────

const STRESS_SCENARIOS = [
	{
		id: 'recent-orders',
		label: 'Customer views recent orders (hot table)',
		description: 'Query hits hot table with 2.5M rows instead of 50M',
		method: 'GET' as const,
		path: '/api/v1/orders',
		actor: 'customer',
		expectedResult: 'allowed' as const,
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
		method: 'GET' as const,
		path: '/api/v1/orders/12345',
		actor: 'customer',
		expectedResult: 'allowed' as const,
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
		method: 'POST' as const,
		path: '/ops/backup',
		actor: 'ops',
		expectedResult: 'allowed' as const,
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
		method: 'DELETE' as const,
		path: '/jobs/destroy_expired_data',
		actor: 'scheduler',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: 'DestroyExpiredDataJob running...', color: 'yellow' },
			{ text: 'Destroyed 5,000,000 orders past retention', color: 'green' },
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

// ─── Code preview builder ──────────────────────────────────────────────

function getCodeFiles(
	phase: 'observe' | 'build' | 'reward',
	completedStep: number,
) {
	if (phase === 'observe') {
		return [
			{
				filename: 'orders_controller.rb',
				language: 'ruby',
				code: `class OrdersController < ApplicationController
  # Every query hits the same 50M row table
  def index
    @orders = Order.where(customer_id: current_user.id)
                   .order(created_at: :desc)
                   .limit(10)
    # Seq Scan on orders (rows=50,000,000)
    # Execution time: 3,200ms
  end

  def show
    @order = Order.find(params[:id])
    # Same 50M row scan for one record
  end
end

# pg_dump takes 8 hours (50M rows)
# ALTER TABLE takes 4+ hours (table lock)
# 95% of rows are older than 1 year`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (completedStep >= 0) {
			files.push({
				filename: 'data_lifecycle_policy.rb',
				language: 'ruby',
				code: `# Data Temperature Policy
TIERS = {
  hot:  { max_age: 90.days, storage: :primary },
  warm: { max_age: 1.year, storage: :archive_table },
  cold: { max_age: 7.years, action: :destroy }
}`,
			});
		}

		if (completedStep >= 1) {
			files.push({
				filename: 'db/migrate/create_archived_orders.rb',
				language: 'ruby',
				code: `class CreateArchivedOrders < ActiveRecord::Migration[8.0]
  def change
    create_table :archived_orders do |t|
      t.references :customer, null: false
      t.string :status
      t.decimal :total, precision: 10, scale: 2
      t.timestamps
    end

    add_index :archived_orders, :customer_id
    add_index :archived_orders, :created_at
  end
end`,
			});
		}

		if (completedStep >= 2) {
			files.push({
				filename: 'app/jobs/archive_orders_job.rb',
				language: 'ruby',
				code: `class ArchiveOrdersJob < ApplicationJob
  def perform
    Order.where("created_at < ?", 90.days.ago)
         .find_in_batches(batch_size: 1_000) do |batch|
      ArchivedOrder.insert_all(batch.map(&:attributes))
      Order.where(id: batch.map(&:id)).delete_all
    end
  end
end`,
			});
		}

		if (completedStep >= 3) {
			files.push({
				filename: 'app/models/order.rb',
				language: 'ruby',
				code: `class Order < ApplicationRecord
  def self.find_with_archive(id)
    find_by(id: id) ||
      ArchivedOrder.find_by(id: id)
  end

  def self.for_customer(customer_id)
    recent = where(customer_id: customer_id)
    return recent if recent.exists?
    ArchivedOrder.where(customer_id: customer_id)
  end
end`,
			});
		}

		if (completedStep >= 4) {
			files.push({
				filename: 'app/jobs/destroy_expired_data_job.rb',
				language: 'ruby',
				code: `class DestroyExpiredDataJob < ApplicationJob
  def perform
    expired = ArchivedOrder.where(
      "created_at < ?", 7.years.ago
    )
    count = expired.count
    expired.in_batches(of: 10_000).delete_all

    Rails.logger.info(
      "Destroyed #{count} orders past retention"
    )
  end
end`,
			});
		}

		if (completedStep >= 5) {
			files.push({
				filename: 'config/recurring.yml',
				language: 'yaml',
				code: `archive_orders:
  class: ArchiveOrdersJob
  schedule: every day at 2am

destroy_expired_data:
  class: DestroyExpiredDataJob
  schedule: every sunday at 3am`,
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'data_lifecycle_policy.rb',
				language: 'ruby',
				code: '# Step 1: Define the data temperature policy...',
			});
		}

		return files;
	}

	// reward
	return [
		{
			filename: 'data_lifecycle_policy.rb',
			language: 'ruby',
			code: `# Data Temperature Policy
TIERS = {
  hot:  { max_age: 90.days, storage: :primary },
  warm: { max_age: 1.year, storage: :archive_table },
  cold: { max_age: 7.years, action: :destroy }
}`,
		},
		{
			filename: 'app/jobs/archive_orders_job.rb',
			language: 'ruby',
			code: `class ArchiveOrdersJob < ApplicationJob
  def perform
    Order.where("created_at < ?", 90.days.ago)
         .find_in_batches(batch_size: 1_000) do |batch|
      ArchivedOrder.insert_all(batch.map(&:attributes))
      Order.where(id: batch.map(&:id)).delete_all
    end
  end
end`,
		},
		{
			filename: 'app/models/order.rb',
			language: 'ruby',
			code: `class Order < ApplicationRecord
  def self.find_with_archive(id)
    find_by(id: id) ||
      ArchivedOrder.find_by(id: id)
  end

  def self.for_customer(customer_id)
    recent = where(customer_id: customer_id)
    return recent if recent.exists?
    ArchivedOrder.where(customer_id: customer_id)
  end
end`,
		},
		{
			filename: 'config/recurring.yml',
			language: 'yaml',
			code: `archive_orders:
  class: ArchiveOrdersJob
  schedule: every day at 2am

destroy_expired_data:
  class: DestroyExpiredDataJob
  schedule: every sunday at 3am`,
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

interface CustomerNodeData extends SimpleNodeState {
	[key: string]: unknown;
}

const CustomerNode = memo(({ data }: { data: CustomerNodeData }) => {
	const d = data as CustomerNodeData;
	const flowData: FlowNodeData = {
		label: 'Customer',
		icon: 'CU',
		color: '#3b82f6',
		description: d.label,
		status: flashToStatus(d.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<>
			<FlowHandles />
			<FlowNode data={flowData}>
				{d.sublabel && (
					<p className="text-[10px] text-muted-foreground truncate">
						{d.sublabel}
					</p>
				)}
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
		description: d.label,
		status: flashToStatus(d.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<>
			<FlowHandles />
			<FlowNode data={flowData}>
				{d.sublabel && (
					<p className="text-[10px] text-muted-foreground truncate">
						{d.sublabel}
					</p>
				)}
			</FlowNode>
		</>
	);
});

interface DbNodeData extends SimpleNodeState {
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
				{d.sublabel && (
					<p className="text-[10px] text-muted-foreground truncate">
						{d.sublabel}
					</p>
				)}
			</FlowNode>
		</>
	);
});

const HotDbNode = memo(({ data }: { data: DbNodeData }) => {
	const d = data as DbNodeData;
	const flowData: FlowNodeData = {
		label: 'Hot DB',
		icon: 'HD',
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
				{d.sublabel && (
					<p className="text-[10px] text-muted-foreground truncate">
						{d.sublabel}
					</p>
				)}
			</FlowNode>
		</>
	);
});

const ArchiveDbNode = memo(({ data }: { data: DbNodeData }) => {
	const d = data as DbNodeData;
	const flowData: FlowNodeData = {
		label: 'Archive DB',
		icon: 'AR',
		color: '#6b7280',
		description: d.label,
		status: flashToStatus(d.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<>
			<FlowHandles />
			<FlowNode data={flowData}>
				{d.sublabel && (
					<p className="text-[10px] text-muted-foreground truncate">
						{d.sublabel}
					</p>
				)}
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

interface DlEdgeData extends EdgeVizState {
	[key: string]: unknown;
}

const DlEdge = memo(
	({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
		const d = (data ?? DEFAULT_EDGE) as DlEdgeData;
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

const dlNodeTypes = {
	customer: CustomerNode,
	app: AppNode,
	db: DbNode,
	hotDb: HotDbNode,
	archiveDb: ArchiveDbNode,
};
const dlEdgeTypes = { dl: DlEdge };

// ─── Main component ────────────────────────────────────────────────────

export function Level46DataLifecycle({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<'observe' | 'build' | 'reward'>('observe');
	const isReward = phase === 'reward';

	// ── Visualization state ──
	const [customerState, setCustomerState] =
		useState<SimpleNodeState>(DEFAULT_CUSTOMER);
	const [appState, setAppState] = useState<SimpleNodeState>(DEFAULT_APP);
	const [dbState, setDbState] = useState<SimpleNodeState>(DEFAULT_DB);
	const [hotDbState, setHotDbState] = useState<SimpleNodeState>(DEFAULT_HOT_DB);
	const [archiveDbState, setArchiveDbState] =
		useState<SimpleNodeState>(DEFAULT_ARCHIVE_DB);
	const [edge1State, setEdge1State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge2State, setEdge2State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge3State, setEdge3State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setCustomerState(DEFAULT_CUSTOMER);
		setAppState(DEFAULT_APP);
		setDbState(DEFAULT_DB);
		setHotDbState(DEFAULT_HOT_DB);
		setArchiveDbState(DEFAULT_ARCHIVE_DB);
		setEdge1State(DEFAULT_EDGE);
		setEdge2State(DEFAULT_EDGE);
		setEdge3State(DEFAULT_EDGE);
	}, []);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.customer)
			setCustomerState((prev) => ({ ...prev, ...frame.customer }));
		if (frame.app) setAppState((prev) => ({ ...prev, ...frame.app }));
		if (frame.db) setDbState((prev) => ({ ...prev, ...frame.db }));
		if (frame.hotDb) setHotDbState((prev) => ({ ...prev, ...frame.hotDb }));
		if (frame.archiveDb)
			setArchiveDbState((prev) => ({ ...prev, ...frame.archiveDb }));
		if (frame.edge1) setEdge1State((prev) => ({ ...prev, ...frame.edge1 }));
		if (frame.edge2) setEdge2State((prev) => ({ ...prev, ...frame.edge2 }));
		if (frame.edge3) setEdge3State((prev) => ({ ...prev, ...frame.edge3 }));
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
				setEdge3State((prev) => ({ ...prev, active: false }));
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
			const allOptions: Record<number, typeof TEMPERATURE_POLICY_OPTIONS> = {
				0: TEMPERATURE_POLICY_OPTIONS,
				2: ARCHIVING_JOB_OPTIONS,
				3: TRANSPARENT_READS_OPTIONS,
				4: DESTRUCTION_POLICY_OPTIONS,
				5: SCHEDULE_JOB_OPTIONS,
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
				setCustomerState(DEFAULT_CUSTOMER);
				setAppState(DEFAULT_APP);
				setHotDbState(DEFAULT_HOT_DB);
				setArchiveDbState(DEFAULT_ARCHIVE_DB);
				setEdge1State(DEFAULT_EDGE);
				setEdge2State(DEFAULT_EDGE);
				setEdge3State(DEFAULT_EDGE);
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
		return { valid: true, message: 'Data lifecycle strategy is working!' };
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
	const flowNodes = useMemo((): Node[] => {
		if (isReward) {
			// 4-node layout: Customer (left), App (center), Hot DB (right-top), Archive DB (right-bottom)
			return [
				{
					id: 'customer',
					type: 'customer',
					position: { x: 0, y: 70 },
					data: { ...customerState } satisfies CustomerNodeData,
				},
				{
					id: 'app',
					type: 'app',
					position: { x: 280, y: 70 },
					data: { ...appState } satisfies AppNodeData,
				},
				{
					id: 'hotDb',
					type: 'hotDb',
					position: { x: 550, y: 0 },
					data: { ...hotDbState } satisfies DbNodeData,
				},
				{
					id: 'archiveDb',
					type: 'archiveDb',
					position: { x: 550, y: 140 },
					data: { ...archiveDbState } satisfies DbNodeData,
				},
			];
		}

		// Observe: 3-node layout: Customer (left), App (center), Database (right)
		return [
			{
				id: 'customer',
				type: 'customer',
				position: { x: 0, y: 50 },
				data: { ...customerState } satisfies CustomerNodeData,
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
		];
	}, [isReward, customerState, appState, dbState, hotDbState, archiveDbState]);

	const flowEdges = useMemo((): Edge[] => {
		if (isReward) {
			return [
				{
					id: 'e-cust-app',
					source: 'customer',
					target: 'app',
					type: 'dl',
					sourceHandle: 'right-source',
					targetHandle: 'left-target',
					data: { ...edge1State } satisfies DlEdgeData,
				},
				{
					id: 'e-app-hot',
					source: 'app',
					target: 'hotDb',
					type: 'dl',
					sourceHandle: 'right-source',
					targetHandle: 'left-target',
					data: { ...edge2State } satisfies DlEdgeData,
				},
				{
					id: 'e-app-archive',
					source: 'app',
					target: 'archiveDb',
					type: 'dl',
					sourceHandle: 'right-source',
					targetHandle: 'left-target',
					data: { ...edge3State } satisfies DlEdgeData,
				},
			];
		}

		return [
			{
				id: 'e-cust-app',
				source: 'customer',
				target: 'app',
				type: 'dl',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge1State } satisfies DlEdgeData,
			},
			{
				id: 'e-app-db',
				source: 'app',
				target: 'db',
				type: 'dl',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge2State } satisfies DlEdgeData,
			},
		];
	}, [isReward, edge1State, edge2State, edge3State]);

	// ── Build step config ──
	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx === 1) {
			const termData = TERMINAL_STEP_MAP[idx];
			return {
				type: 'terminal' as const,
				commands: termData?.commands
					? shuffleOptions(termData.commands, idx)
					: undefined,
				outputLines: termData?.outputLines,
			};
		}
		const stepOptions: Record<number, typeof TEMPERATURE_POLICY_OPTIONS> = {
			0: TEMPERATURE_POLICY_OPTIONS,
			2: ARCHIVING_JOB_OPTIONS,
			3: TRANSPARENT_READS_OPTIONS,
			4: DESTRUCTION_POLICY_OPTIONS,
			5: SCHEDULE_JOB_OPTIONS,
		};
		return {
			type: 'option' as const,
			options: shuffleOptions(stepOptions[idx], idx),
		};
	}, [stepper.currentStep]);

	const buildCodePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

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
							Level 45 added recurring cleanup jobs, but they only purge expired
							tokens and orphans. The orders table itself has 50M rows, 95%
							older than 1 year and never accessed.
						</p>
						<p className="text-sm text-muted-foreground">
							Queries are slow, backups take 8 hours, and migrations lock for
							minutes. All data lives in one table with no lifecycle policy.
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
							Classify data by temperature, create an archive table, build
							archiving and destruction jobs, and schedule them with Solid
							Queue.
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
								Fast query (hot table)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-amber-500" />
							<span className="text-muted-foreground">Archive fallback</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">
								Data destroyed (past retention)
							</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Processed</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Destroyed</div>
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
							edgeTypes={dlEdgeTypes}
							nodes={flowNodes}
							nodeTypes={dlNodeTypes}
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
									Create a separate table to hold archived orders. This is the
									physical destination for warm data.
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
								{stepper.currentStep === 0 &&
									'How should you classify data by access frequency and age?'}
								{stepper.currentStep === 2 &&
									'How should the archiving job move old data to the archive table?'}
								{stepper.currentStep === 3 &&
									'How should the app read data that might be in the archive?'}
								{stepper.currentStep === 4 &&
									'How should data past the compliance retention period be handled?'}
								{stepper.currentStep === 5 &&
									'How should the archiving and destruction jobs run on schedule?'}
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
						edgeTypes={dlEdgeTypes}
						nodes={flowNodes}
						nodeTypes={dlNodeTypes}
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
					levelName="Data Lifecycle"
					levelNumber={46}
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
					learningGoal="Classify data by temperature (hot/warm/cold), archive old records to a separate table, implement transparent reads, and schedule destruction of expired data."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level46DataLifecycle;
