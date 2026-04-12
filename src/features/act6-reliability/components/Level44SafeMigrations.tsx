/**
 * Level 44: Safe Migrations
 *
 * Three-phase flow: observe -> build -> reward
 *
 * Phase 1 (observe): 3-node horizontal layout.
 *   Developer (left) -> Database (center, shows lock state) -> API Requests (right, shows blocked/queued).
 *   Probes show unsafe migrations locking the table and killing API requests.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: Install strong_migrations gem (terminal)
 *   Step 1: Run strong_migrations generator (terminal)
 *   Step 2: Fix unsafe add_column with default (option)
 *   Step 3: Fix unsafe change_column (option)
 *   Step 4: Fix unsafe add_index (option)
 *   Step 5: Configure strong_migrations safety checks (option)
 *
 * Phase 3 (reward): Same 3 nodes, but safe migration patterns avoid locks.
 *   No table lock, requests served normally.
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import {
	ArrowRight,
	Database,
	Lock,
	Server,
	Terminal,
	Unlock,
} from 'lucide-react';
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
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import { registerLevelCode } from '@/features/codebase-viewer/utils/codebase-registry';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { shuffleOptions } from '@/lib/shuffleOptions';
import type { CodeFile } from '@/utils/codeGeneration';

export const FINAL_CODE_FILES: CodeFile[] = [
	{
		filename: 'config/initializers/strong_migrations.rb',
		language: 'ruby',
		code: `# config/initializers/strong_migrations.rb
StrongMigrations.target_postgresql_version = 16
StrongMigrations.start_after = 20240101000000
StrongMigrations.lock_timeout = 10.seconds
StrongMigrations.statement_timeout = 1.hour`,
	},
	{
		filename: 'db/migrate/safe_add_priority.rb',
		language: 'ruby',
		code: `class AddPriorityToOrders < ActiveRecord::Migration[7.2]
  def change
    add_column :orders, :priority, :integer
  end
end
# Backfill: Order.in_batches.update_all(priority: 0)
# Default: change_column_default :orders, :priority, 0`,
	},
	{
		filename: 'db/migrate/safe_change_total.rb',
		language: 'ruby',
		code: `# Add new column, backfill, swap, drop old
add_column :orders, :total_decimal, :decimal
# Order.in_batches.update_all("total_decimal = total")
# Switch app to read total_decimal
# Drop old column in separate migration`,
	},
	{
		filename: 'db/migrate/safe_add_index.rb',
		language: 'ruby',
		code: `class AddCustomerIndexToOrders < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def change
    add_index :orders, :customer_id, algorithm: :concurrently
  end
end`,
	},
];

registerLevelCode('act6-level44-safe-migrations', FINAL_CODE_FILES);

// ─── Types ────────────────────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface SimpleNodeState {
	label: string;
	flash: ZoneFlash;
}

interface DbNodeState {
	label: string;
	flash: ZoneFlash;
	lockLabel: string | null;
	lockFlash: ZoneFlash;
	rowsLabel: string | null;
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	developer?: Partial<SimpleNodeState>;
	database?: Partial<DbNodeState>;
	api?: Partial<SimpleNodeState>;
	/** Developer <-> Database edge */
	edge1?: Partial<EdgeVizState>;
	/** Database <-> API Requests edge */
	edge2?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_DEVELOPER: SimpleNodeState = {
	label: 'Idle',
	flash: 'idle',
};

const DEFAULT_DATABASE: DbNodeState = {
	label: 'orders (5M rows)',
	flash: 'idle',
	lockLabel: null,
	lockFlash: 'idle',
	rowsLabel: '5,000,000 rows',
};

const DEFAULT_API: SimpleNodeState = {
	label: 'Serving requests',
	flash: 'idle',
};

const DEFAULT_DATABASE_REWARD: DbNodeState = {
	label: 'orders (5M rows)',
	flash: 'idle',
	lockLabel: 'No Lock',
	lockFlash: 'green',
	rowsLabel: '5,000,000 rows',
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-cyan-500',
};

// ─── Discovery definitions ─────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'add-column-lock', label: 'add_column with default locks table' },
	{ id: 'change-column-lock', label: 'change_column rewrites all rows' },
	{ id: 'add-index-lock', label: 'add_index blocks writes during creation' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES = [
	{
		id: 'add-column-default',
		label: 'Add column with default on 5M rows',
		command:
			'rails db:migrate # add_column :orders, :priority, :integer, default: 0',
		responseLines: [
			{
				text: 'ALTER TABLE orders ADD COLUMN priority integer DEFAULT 0',
				color: 'red' as const,
			},
			{
				text: '# ACCESS EXCLUSIVE lock acquired on orders table',
				color: 'red' as const,
			},
			{
				text: '# Rewriting 5,000,000 rows... 30 seconds',
				color: 'red' as const,
			},
			{
				text: '# All API requests to orders return 500',
				color: 'red' as const,
			},
		],
		story: [
			'A deploy adds a priority column with a default value to the orders table.',
			'PostgreSQL acquires an ACCESS EXCLUSIVE lock to rewrite every row.',
			'The lock holds for 30 seconds on 5M rows.',
			'100K users see 500 errors. The API is completely down.',
		],
	},
	{
		id: 'change-column-type',
		label: 'Change column type on orders table',
		command: 'rails db:migrate # change_column :orders, :total, :decimal',
		responseLines: [
			{
				text: 'ALTER TABLE orders ALTER COLUMN total TYPE decimal',
				color: 'red' as const,
			},
			{
				text: '# Exclusive lock held during full table rewrite',
				color: 'red' as const,
			},
			{
				text: '# Every row must be read, converted, and written back',
				color: 'red' as const,
			},
			{
				text: '# 500 errors for all order queries during rewrite',
				color: 'red' as const,
			},
		],
		story: [
			'A migration changes the total column from integer to decimal.',
			'PostgreSQL must rewrite every row to convert the data type.',
			'An exclusive lock prevents any reads or writes during the rewrite.',
			'The 5M-row rewrite takes 30+ seconds. All order endpoints return 500.',
		],
	},
	{
		id: 'add-index-blocking',
		label: 'Add index on large table',
		command: 'rails db:migrate # add_index :orders, :customer_id',
		responseLines: [
			{
				text: 'CREATE INDEX index_orders_on_customer_id ON orders (customer_id)',
				color: 'yellow' as const,
			},
			{
				text: '# SHARE lock acquired: reads OK, writes BLOCKED',
				color: 'red' as const,
			},
			{
				text: '# Building index over 5M rows... 45 seconds',
				color: 'red' as const,
			},
			{
				text: '# INSERT/UPDATE/DELETE on orders queue and timeout',
				color: 'red' as const,
			},
		],
		story: [
			'A migration adds an index on customer_id for the orders table.',
			'PostgreSQL acquires a SHARE lock while building the index.',
			'Reads continue, but all writes (INSERT, UPDATE, DELETE) are blocked.',
			'Order creation and updates fail for 45 seconds.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'add-column-default': ['add-column-lock'],
	'change-column-type': ['change-column-lock'],
	'add-index-blocking': ['add-index-lock'],
};

// ─── Observe animation frames ─────────────────────────────────────────

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'add-column-default': [
		{
			developer: { label: 'rails db:migrate', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'ADD COLUMN ... DEFAULT 0',
				dotColor: 'bg-cyan-500',
			},
			database: { label: 'orders (5M rows)', flash: 'idle' },
		},
		{
			edge1: { active: false },
			database: {
				label: 'ACCESS EXCLUSIVE LOCK',
				flash: 'red',
				lockLabel: 'LOCKED 30s',
				lockFlash: 'red',
			},
			edge2: {
				active: true,
				reverse: true,
				label: 'Blocked!',
				dotColor: 'bg-red-500',
			},
			api: { label: 'Requests queuing...', flash: 'amber' },
		},
		{
			edge2: { active: false },
			database: {
				label: 'Rewriting 5M rows...',
				flash: 'red',
				lockLabel: 'LOCKED',
				lockFlash: 'red',
			},
			api: { label: '500 errors (100K users)', flash: 'red' },
		},
		{
			developer: { label: 'Deploy caused outage', flash: 'red' },
			database: {
				label: 'Still locked...',
				flash: 'red',
				lockLabel: 'LOCKED 30s',
				lockFlash: 'red',
			},
			api: { label: 'All requests failing', flash: 'red' },
		},
	],
	'change-column-type': [
		{
			developer: { label: 'rails db:migrate', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'ALTER COLUMN total TYPE decimal',
				dotColor: 'bg-cyan-500',
			},
			database: { label: 'orders (5M rows)', flash: 'idle' },
		},
		{
			edge1: { active: false },
			database: {
				label: 'EXCLUSIVE LOCK',
				flash: 'red',
				lockLabel: 'LOCKED',
				lockFlash: 'red',
			},
			edge2: {
				active: true,
				reverse: true,
				label: 'Reads blocked!',
				dotColor: 'bg-red-500',
			},
			api: { label: 'Cannot query orders', flash: 'amber' },
		},
		{
			edge2: { active: false },
			database: {
				label: 'Full row rewrite in progress',
				flash: 'red',
				lockLabel: 'REWRITING',
				lockFlash: 'red',
			},
			api: { label: '500 on all order endpoints', flash: 'red' },
		},
		{
			developer: { label: 'Type change caused outage', flash: 'red' },
			database: {
				label: 'Every row converted',
				flash: 'red',
				lockLabel: 'LOCKED 30s+',
				lockFlash: 'red',
			},
			api: { label: 'Total downtime: 30+ seconds', flash: 'red' },
		},
	],
	'add-index-blocking': [
		{
			developer: { label: 'rails db:migrate', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'CREATE INDEX',
				dotColor: 'bg-cyan-500',
			},
			database: { label: 'orders (5M rows)', flash: 'idle' },
		},
		{
			edge1: { active: false },
			database: {
				label: 'SHARE LOCK',
				flash: 'amber',
				lockLabel: 'WRITE LOCK',
				lockFlash: 'amber',
			},
			api: { label: 'Reads OK, writes blocked', flash: 'amber' },
		},
		{
			database: {
				label: 'Building index over 5M rows',
				flash: 'red',
				lockLabel: 'LOCKED 45s',
				lockFlash: 'red',
			},
			edge2: {
				active: true,
				reverse: true,
				label: 'Writes failing',
				dotColor: 'bg-red-500',
			},
			api: { label: 'Order creates/updates fail', flash: 'red' },
		},
		{
			edge2: { active: false },
			developer: { label: 'Index caused write outage', flash: 'red' },
			database: {
				label: 'Still building...',
				flash: 'red',
				lockLabel: 'LOCKED',
				lockFlash: 'red',
			},
			api: { label: 'Writes blocked 45 seconds', flash: 'red' },
		},
	],
};

// ─── Reward animation frames ──────────────────────────────────────────

const REWARD_FRAMES: Record<string, AnimFrame[]> = {
	'add-column-default': [
		{
			developer: { label: 'Safe migration: 3 steps', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'ADD COLUMN (no default)',
				dotColor: 'bg-emerald-500',
			},
			database: { label: 'orders (5M rows)', flash: 'idle' },
		},
		{
			edge1: { active: false },
			database: {
				label: 'Column added instantly',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
			api: { label: 'Serving requests normally', flash: 'green' },
		},
		{
			developer: { label: 'Backfilling in batches', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'UPDATE in_batches',
				dotColor: 'bg-emerald-500',
			},
			database: {
				label: 'Backfilling (no lock)',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
		},
		{
			edge1: { active: false },
			developer: { label: 'Zero downtime!', flash: 'green' },
			database: {
				label: 'Default set for new rows',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
			api: { label: 'No 500 errors', flash: 'green' },
		},
	],
	'change-column-type': [
		{
			developer: { label: 'Safe: new column + rename', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'ADD COLUMN total_decimal',
				dotColor: 'bg-emerald-500',
			},
			database: { label: 'orders (5M rows)', flash: 'idle' },
		},
		{
			edge1: { active: false },
			database: {
				label: 'New column added instantly',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
			api: { label: 'Serving requests normally', flash: 'green' },
		},
		{
			developer: { label: 'Backfill + switch reads', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'Backfill in_batches',
				dotColor: 'bg-emerald-500',
			},
			database: {
				label: 'Backfilling (no lock)',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
		},
		{
			edge1: { active: false },
			developer: { label: 'Zero downtime!', flash: 'green' },
			database: {
				label: 'Old column dropped later',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
			api: { label: 'No 500 errors', flash: 'green' },
		},
	],
	'add-index-blocking': [
		{
			developer: { label: 'Safe: CONCURRENTLY', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'CREATE INDEX CONCURRENTLY',
				dotColor: 'bg-emerald-500',
			},
			database: { label: 'orders (5M rows)', flash: 'idle' },
		},
		{
			edge1: { active: false },
			database: {
				label: 'Building index concurrently',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
			api: { label: 'Reads + writes OK', flash: 'green' },
		},
		{
			database: {
				label: 'Index built (no locks held)',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
			api: { label: 'All requests served', flash: 'green' },
		},
		{
			developer: { label: 'Zero downtime!', flash: 'green' },
			database: {
				label: 'Index active',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
			api: { label: 'No 500 errors', flash: 'green' },
		},
	],
	'validate-constraint': [
		{
			developer: { label: 'Safe: validate separately', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'ADD CONSTRAINT NOT VALID',
				dotColor: 'bg-emerald-500',
			},
			database: { label: 'orders (5M rows)', flash: 'idle' },
		},
		{
			edge1: { active: false },
			database: {
				label: 'Constraint added (not validated)',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
			api: { label: 'Serving requests normally', flash: 'green' },
		},
		{
			edge1: {
				active: true,
				reverse: false,
				label: 'VALIDATE CONSTRAINT',
				dotColor: 'bg-emerald-500',
			},
			database: {
				label: 'Validating (SHARE UPDATE EXCLUSIVE)',
				flash: 'green',
				lockLabel: 'Light Lock',
				lockFlash: 'green',
			},
			api: { label: 'Reads + writes OK', flash: 'green' },
		},
		{
			edge1: { active: false },
			developer: { label: 'Zero downtime!', flash: 'green' },
			database: {
				label: 'Constraint validated',
				flash: 'green',
				lockLabel: 'No Lock',
				lockFlash: 'green',
			},
			api: { label: 'No 500 errors', flash: 'green' },
		},
	],
};

// ─── Build step definitions ────────────────────────────────────────────

const STEP_DEFS = [
	{ id: 'install-gem', title: 'Install strong_migrations' },
	{ id: 'run-generator', title: 'Run Generator' },
	{ id: 'fix-add-column', title: 'Fix Unsafe add_column' },
	{ id: 'fix-change-column', title: 'Fix Unsafe change_column' },
	{ id: 'fix-add-index', title: 'Fix Unsafe add_index' },
	{ id: 'configure-checks', title: 'Configure Safety Checks' },
];

const INSTALL_GEM_COMMANDS = [
	{
		id: 'wrong-npm',
		label: 'npm install strong-migrations',
		command: 'npm install strong-migrations',
		correct: false,
		feedback:
			'This is a Ruby gem, not a Node.js package. Ruby gems are installed with a different package manager.',
	},
	{
		id: 'correct',
		label: 'bundle add strong_migrations',
		command: 'bundle add strong_migrations',
		correct: true,
	},
	{
		id: 'wrong-gem-install',
		label: 'gem install strong_migrations',
		command: 'gem install strong_migrations',
		correct: false,
		feedback:
			'gem install installs system-wide. For a Rails project, add it to the Gemfile so the dependency is tracked and reproducible.',
	},
];

const RUN_GENERATOR_COMMANDS = [
	{
		id: 'wrong-init',
		label: 'rails generate migration StrongMigrationsSetup',
		command: 'rails generate migration StrongMigrationsSetup',
		correct: false,
		feedback:
			'A standard migration does not create the initializer file. The gem provides its own generator for configuration.',
	},
	{
		id: 'wrong-rake',
		label: 'rake strong_migrations:setup',
		command: 'rake strong_migrations:setup',
		correct: false,
		feedback:
			'There is no rake task for setup. The gem uses the standard Rails generator pattern.',
	},
	{
		id: 'correct',
		label: 'rails generate strong_migrations:install',
		command: 'rails generate strong_migrations:install',
		correct: true,
	},
];

const FIX_ADD_COLUMN_OPTIONS = [
	{
		id: 'wrong-disable-lock',
		label: 'Disable lock timeout before adding column',
		code: `class AddPriorityToOrders < ActiveRecord::Migration[7.2]
  def change
    execute "SET lock_timeout = 0"
    add_column :orders, :priority, :integer, default: 0
  end
end`,
		correct: false,
		feedback:
			'Disabling lock timeout does not prevent the lock itself. The table is still locked for the entire rewrite. The lock timeout just prevents the migration from failing if another lock is held.',
	},
	{
		id: 'correct',
		label: 'Add column without default, then backfill in batches',
		code: `class AddPriorityToOrders < ActiveRecord::Migration[7.2]
  def change
    add_column :orders, :priority, :integer
    # Backfill in a separate migration or script:
    # Order.in_batches.update_all(priority: 0)
    # Then set default for new rows:
    # change_column_default :orders, :priority, 0
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-raw-sql',
		label: 'Use raw SQL ALTER TABLE to add column',
		code: `class AddPriorityToOrders < ActiveRecord::Migration[7.2]
  def change
    execute <<~SQL
      ALTER TABLE orders
      ADD COLUMN priority integer DEFAULT 0
    SQL
  end
end`,
		correct: false,
		feedback:
			'Raw SQL with DEFAULT has the same problem as the Rails helper. PostgreSQL still rewrites every row. The issue is the operation itself, not how you invoke it.',
	},
];

const FIX_CHANGE_COLUMN_OPTIONS = [
	{
		id: 'wrong-in-place',
		label: 'Use SET DATA TYPE with USING clause',
		code: `class ChangeOrderTotal < ActiveRecord::Migration[7.2]
  def change
    execute <<~SQL
      ALTER TABLE orders
      ALTER COLUMN total SET DATA TYPE decimal
      USING total::decimal
    SQL
  end
end`,
		correct: false,
		feedback:
			'SET DATA TYPE still requires a full table rewrite and exclusive lock, regardless of the USING clause. The data type conversion happens row by row while the table is locked.',
	},
	{
		id: 'wrong-safety-assured',
		label: 'Wrap change_column in safety_assured',
		code: `class ChangeOrderTotal < ActiveRecord::Migration[7.2]
  def change
    safety_assured do
      change_column :orders, :total, :decimal
    end
  end
end`,
		correct: false,
		feedback:
			'safety_assured only bypasses the strong_migrations check. It does not make the operation safe. The table is still locked during the full rewrite.',
	},
	{
		id: 'correct',
		label: 'Add new column, backfill, then swap',
		code: `# Step 1: Add new column (instant, no lock)
add_column :orders, :total_decimal, :decimal

# Step 2: Backfill in batches (no lock)
# Order.in_batches.update_all("total_decimal = total")

# Step 3: Update app to read from total_decimal
# Step 4: Drop old column in later migration`,
		correct: true,
	},
];

const FIX_ADD_INDEX_OPTIONS = [
	{
		id: 'wrong-partial',
		label: 'Add a partial index to reduce lock time',
		code: `class AddCustomerIndexToOrders < ActiveRecord::Migration[7.2]
  def change
    add_index :orders, :customer_id, where: "created_at > '2024-01-01'"
  end
end`,
		correct: false,
		feedback:
			'A partial index is smaller but still acquires a SHARE lock during creation. The lock blocks all writes for the entire build duration.',
	},
	{
		id: 'correct',
		label: 'Use algorithm: :concurrently with disable_ddl_transaction!',
		code: `class AddCustomerIndexToOrders < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def change
    add_index :orders, :customer_id, algorithm: :concurrently
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-no-disable',
		label: 'Use algorithm: :concurrently without disable_ddl_transaction!',
		code: `class AddCustomerIndexToOrders < ActiveRecord::Migration[7.2]
  def change
    add_index :orders, :customer_id, algorithm: :concurrently
  end
end`,
		correct: false,
		feedback:
			'CONCURRENTLY cannot run inside a transaction. Without disable_ddl_transaction!, Rails wraps the migration in a transaction and PostgreSQL raises an error.',
	},
];

const CONFIGURE_CHECKS_OPTIONS = [
	{
		id: 'wrong-disable-all',
		label: 'Disable all strong_migrations checks',
		code: `# config/initializers/strong_migrations.rb
StrongMigrations.checks = []
# "We know what we are doing"`,
		correct: false,
		feedback:
			'Disabling all checks defeats the purpose of the gem. Configure it to match your database and start checking from a specific migration version.',
	},
	{
		id: 'wrong-only-timeout',
		label: 'Only set lock_timeout',
		code: `# config/initializers/strong_migrations.rb
StrongMigrations.lock_timeout = 10.seconds`,
		correct: false,
		feedback:
			'Lock timeout alone only fails migrations that take too long to acquire a lock. It does not detect unsafe operations before they run. You need target_version and start_after.',
	},
	{
		id: 'correct',
		label: 'Set target_version, start_after, and lock_timeout',
		code: `# config/initializers/strong_migrations.rb
StrongMigrations.target_postgresql_version = 16
StrongMigrations.start_after = 20240101000000
StrongMigrations.lock_timeout = 10.seconds
StrongMigrations.statement_timeout = 1.hour`,
		correct: true,
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{
		commands: INSTALL_GEM_COMMANDS,
		outputLines: [
			{
				text: 'Fetching strong_migrations 2.1.0',
				color: 'green' as const,
			},
			{
				text: 'Installing strong_migrations 2.1.0',
				color: 'green' as const,
			},
		],
	},
	{
		commands: RUN_GENERATOR_COMMANDS,
		outputLines: [
			{
				text: 'create  config/initializers/strong_migrations.rb',
				color: 'green' as const,
			},
		],
	},
	null, // fix-add-column: OptionCard
	null, // fix-change-column: OptionCard
	null, // fix-add-index: OptionCard
	null, // configure-checks: OptionCard
];

// ─── Stress test scenarios ─────────────────────────────────────────────

const STRESS_SCENARIOS = [
	{
		id: 'add-column-default',
		label: 'Add column with default on 5M rows',
		description: 'Safe: add without default, backfill in batches, set default',
		method: 'MIGRATE' as const,
		path: 'add_column :orders, :priority',
		actor: 'developer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'add_column :orders, :priority, :integer (no default)',
				color: 'green',
			},
			{ text: '# No table lock. Column added instantly.', color: 'green' },
			{ text: '# Backfill in batches, then set default', color: 'green' },
		],
		story: [
			'Same migration, but safe this time.',
			'Column added without default (instant, no lock).',
			'Backfill runs in batches without blocking requests.',
			'Default set for new rows. Zero downtime.',
		],
	},
	{
		id: 'change-column-type',
		label: 'Change column type on orders table',
		description: 'Safe: add new column, backfill, swap reads, drop old',
		method: 'MIGRATE' as const,
		path: 'change_column :orders, :total',
		actor: 'developer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'add_column :orders, :total_decimal, :decimal', color: 'green' },
			{
				text: '# New column added instantly. No rewrite needed.',
				color: 'green',
			},
			{ text: '# Backfill + swap in separate deploys', color: 'green' },
		],
		story: [
			'Same type change, but using the safe pattern.',
			'New column added (instant). Data backfilled in batches.',
			'App switched to read new column. Old column dropped later.',
			'No table lock, no downtime.',
		],
	},
	{
		id: 'add-index-blocking',
		label: 'Add index on large table',
		description: 'Safe: algorithm: :concurrently with disable_ddl_transaction!',
		method: 'MIGRATE' as const,
		path: 'add_index :orders, :customer_id',
		actor: 'developer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'CREATE INDEX CONCURRENTLY index_orders_on_customer_id',
				color: 'green',
			},
			{ text: '# No SHARE lock. Reads and writes continue.', color: 'green' },
			{ text: '# Index built in background', color: 'green' },
		],
		story: [
			'Same index creation, but with CONCURRENTLY.',
			'PostgreSQL builds the index without acquiring a lock.',
			'All reads and writes continue during index creation.',
			'Zero downtime.',
		],
	},
	{
		id: 'validate-constraint',
		label: 'Validate constraint safely',
		description: 'Safe: add NOT VALID constraint, then validate separately',
		method: 'MIGRATE' as const,
		path: 'validate_check_constraint :orders',
		actor: 'developer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'ADD CONSTRAINT ... NOT VALID (instant)', color: 'green' },
			{ text: 'VALIDATE CONSTRAINT (light lock, no rewrite)', color: 'green' },
			{
				text: '# Two-step approach avoids ACCESS EXCLUSIVE lock',
				color: 'green',
			},
		],
		story: [
			'Adding a check constraint the safe way.',
			'First, add the constraint with NOT VALID (instant, no lock).',
			'Then validate in a separate migration (light lock only).',
			'Existing rows validated without blocking writes.',
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
				filename: 'db/migrate/20240315_update_orders.rb',
				language: 'ruby',
				code: `# UNSAFE migration (current state)
class UpdateOrders < ActiveRecord::Migration[7.2]
  def change
    # Locks table for 30s on 5M rows!
    add_column :orders, :priority, :integer, default: 0

    # Full table rewrite, exclusive lock!
    change_column :orders, :total, :decimal

    # SHARE lock blocks all writes!
    add_index :orders, :customer_id
  end
end

# No strong_migrations gem installed
# No safety checks in place
# Deploy = potential outage`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (completedStep >= 0) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `# Gemfile
gem "strong_migrations", "~> 2.1"`,
			});
		}

		if (completedStep >= 1) {
			files.push({
				filename: 'config/initializers/strong_migrations.rb',
				language: 'ruby',
				code: `# Generated by: rails generate strong_migrations:install
# Configure in next steps...`,
			});
		}

		if (completedStep >= 2) {
			files.push({
				filename: 'db/migrate/safe_add_priority.rb',
				language: 'ruby',
				code: `class AddPriorityToOrders < ActiveRecord::Migration[7.2]
  def change
    add_column :orders, :priority, :integer
    # Backfill in a separate migration or script:
    # Order.in_batches.update_all(priority: 0)
    # Then set default for new rows:
    # change_column_default :orders, :priority, 0
  end
end`,
			});
		}

		if (completedStep >= 3) {
			files.push({
				filename: 'db/migrate/safe_change_total.rb',
				language: 'ruby',
				code: `# Step 1: Add new column (instant, no lock)
add_column :orders, :total_decimal, :decimal

# Step 2: Backfill in batches (no lock)
# Order.in_batches.update_all("total_decimal = total")

# Step 3: Update app to read from total_decimal
# Step 4: Drop old column in later migration`,
			});
		}

		if (completedStep >= 4) {
			files.push({
				filename: 'db/migrate/safe_add_index.rb',
				language: 'ruby',
				code: `class AddCustomerIndexToOrders < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def change
    add_index :orders, :customer_id, algorithm: :concurrently
  end
end`,
			});
		}

		if (completedStep >= 5) {
			const initIdx = files.findIndex(
				(f) => f.filename === 'config/initializers/strong_migrations.rb',
			);
			if (initIdx >= 0) {
				files[initIdx] = {
					filename: 'config/initializers/strong_migrations.rb',
					language: 'ruby',
					code: `# config/initializers/strong_migrations.rb
StrongMigrations.target_postgresql_version = 16
StrongMigrations.start_after = 20240101000000
StrongMigrations.lock_timeout = 10.seconds
StrongMigrations.statement_timeout = 1.hour`,
				};
			}
		}

		if (files.length === 0) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: '# Step 1: Install strong_migrations gem...',
			});
		}

		return files;
	}

	// reward
	return [
		{
			filename: 'config/initializers/strong_migrations.rb',
			language: 'ruby',
			code: `# config/initializers/strong_migrations.rb
StrongMigrations.target_postgresql_version = 16
StrongMigrations.start_after = 20240101000000
StrongMigrations.lock_timeout = 10.seconds
StrongMigrations.statement_timeout = 1.hour`,
		},
		{
			filename: 'db/migrate/safe_add_priority.rb',
			language: 'ruby',
			code: `class AddPriorityToOrders < ActiveRecord::Migration[7.2]
  def change
    add_column :orders, :priority, :integer
  end
end
# Backfill: Order.in_batches.update_all(priority: 0)
# Default: change_column_default :orders, :priority, 0`,
		},
		{
			filename: 'db/migrate/safe_change_total.rb',
			language: 'ruby',
			code: `# Add new column, backfill, swap, drop old
add_column :orders, :total_decimal, :decimal
# Order.in_batches.update_all("total_decimal = total")
# Switch app to read total_decimal
# Drop old column in separate migration`,
		},
		{
			filename: 'db/migrate/safe_add_index.rb',
			language: 'ruby',
			code: `class AddCustomerIndexToOrders < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def change
    add_index :orders, :customer_id, algorithm: :concurrently
  end
end`,
		},
	];
}

// ─── Custom React Flow nodes ──────────────────────────────────────────

const FLASH_BORDER: Record<ZoneFlash, string> = {
	idle: 'border-border',
	red: 'border-red-500 dark:border-red-400',
	green: 'border-emerald-500 dark:border-emerald-400',
	amber: 'border-amber-500 dark:border-amber-400',
};

const FLASH_BG: Record<ZoneFlash, string> = {
	idle: 'bg-card',
	red: 'bg-red-50 dark:bg-red-950/30',
	green: 'bg-emerald-50 dark:bg-emerald-950/30',
	amber: 'bg-amber-50 dark:bg-amber-950/30',
};

interface DeveloperNodeData extends SimpleNodeState {
	[key: string]: unknown;
}

const DeveloperNode = memo(({ data }: { data: DeveloperNodeData }) => {
	const d = data as DeveloperNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-40 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<Terminal className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">Developer</span>
			</div>
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>
		</div>
	);
});

interface DatabaseNodeData extends DbNodeState {
	[key: string]: unknown;
}

const DatabaseNode = memo(({ data }: { data: DatabaseNodeData }) => {
	const d = data as DatabaseNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-52 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<Database className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">Database</span>
			</div>
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>

			{d.lockLabel && (
				<div className="mt-2 pt-2 border-t border-border">
					<div
						className={`rounded border ${FLASH_BORDER[d.lockFlash]} ${FLASH_BG[d.lockFlash]} p-1.5 flex items-center gap-1.5 transition-colors duration-300`}
					>
						{d.lockFlash === 'red' || d.lockFlash === 'amber' ? (
							<Lock className="w-3 h-3 text-foreground shrink-0" />
						) : (
							<Unlock className="w-3 h-3 text-foreground shrink-0" />
						)}
						<span className="text-[10px] font-semibold text-foreground">
							{d.lockLabel}
						</span>
					</div>
				</div>
			)}

			{d.rowsLabel && (
				<div className="text-[10px] text-muted-foreground mt-1.5">
					{d.rowsLabel}
				</div>
			)}
		</div>
	);
});

interface ApiNodeData extends SimpleNodeState {
	[key: string]: unknown;
}

const ApiNode = memo(({ data }: { data: ApiNodeData }) => {
	const d = data as ApiNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-44 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<Server className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">
					API Requests
				</span>
			</div>
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>
		</div>
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

interface MigEdgeData extends EdgeVizState {
	[key: string]: unknown;
}

const MigEdge = memo(
	({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
		const d = (data ?? DEFAULT_EDGE) as MigEdgeData;
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

const migNodeTypes = {
	developer: DeveloperNode,
	database: DatabaseNode,
	api: ApiNode,
};
const migEdgeTypes = { mig: MigEdge };

// ─── Main component ────────────────────────────────────────────────────

export function Level44SafeMigrations({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<'observe' | 'build' | 'reward'>('observe');
	const isReward = phase === 'reward';

	// ── Visualization state ──
	const [devState, setDevState] = useState<SimpleNodeState>(DEFAULT_DEVELOPER);
	const [dbState, setDbState] = useState<DbNodeState>(DEFAULT_DATABASE);
	const [apiState, setApiState] = useState<SimpleNodeState>(DEFAULT_API);
	const [edge1State, setEdge1State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge2State, setEdge2State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setDevState(DEFAULT_DEVELOPER);
		setDbState(isReward ? DEFAULT_DATABASE_REWARD : DEFAULT_DATABASE);
		setApiState(DEFAULT_API);
		setEdge1State(DEFAULT_EDGE);
		setEdge2State(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.developer)
			setDevState((prev) => ({ ...prev, ...frame.developer }));
		if (frame.database) setDbState((prev) => ({ ...prev, ...frame.database }));
		if (frame.api) setApiState((prev) => ({ ...prev, ...frame.api }));
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
			const allOptions: Record<number, typeof FIX_ADD_COLUMN_OPTIONS> = {
				2: FIX_ADD_COLUMN_OPTIONS,
				3: FIX_CHANGE_COLUMN_OPTIONS,
				4: FIX_ADD_INDEX_OPTIONS,
				5: CONFIGURE_CHECKS_OPTIONS,
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
				setDevState(DEFAULT_DEVELOPER);
				setDbState(DEFAULT_DATABASE_REWARD);
				setApiState(DEFAULT_API);
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
			message: 'All migrations are safe for zero-downtime deploys!',
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
	// Horizontal layout: Developer (left) -> Database (center) -> API Requests (right)
	const flowNodes = useMemo(
		(): Node[] => [
			{
				id: 'developer',
				type: 'developer',
				position: { x: 0, y: 60 },
				data: { ...devState } satisfies DeveloperNodeData,
			},
			{
				id: 'database',
				type: 'database',
				position: { x: 300, y: 40 },
				data: { ...dbState } satisfies DatabaseNodeData,
			},
			{
				id: 'api',
				type: 'api',
				position: { x: 600, y: 55 },
				data: { ...apiState } satisfies ApiNodeData,
			},
		],
		[devState, dbState, apiState],
	);

	const flowEdges = useMemo(
		(): Edge[] => [
			{
				id: 'e-dev-db',
				source: 'developer',
				target: 'database',
				type: 'mig',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge1State } satisfies MigEdgeData,
			},
			{
				id: 'e-db-api',
				source: 'database',
				target: 'api',
				type: 'mig',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge2State } satisfies MigEdgeData,
			},
		],
		[edge1State, edge2State],
	);

	// ── Build step config ──
	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx <= 1) {
			const termData = TERMINAL_STEP_MAP[idx];
			return {
				type: 'terminal' as const,
				commands: termData?.commands
					? shuffleOptions(termData.commands, idx)
					: undefined,
				outputLines: termData?.outputLines,
			};
		}
		const stepOptions: Record<number, typeof FIX_ADD_COLUMN_OPTIONS> = {
			2: FIX_ADD_COLUMN_OPTIONS,
			3: FIX_CHANGE_COLUMN_OPTIONS,
			4: FIX_ADD_INDEX_OPTIONS,
			5: CONFIGURE_CHECKS_OPTIONS,
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
							A deploy runs a migration on the orders table (5M rows). The
							migration locks the table for 30 seconds. All API requests return
							500 errors.
						</p>
						<p className="text-sm text-muted-foreground">
							100K users are affected. Fire the probes below to see which
							migration operations are unsafe and why they cause outages.
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
							Install strong_migrations to catch unsafe patterns, then convert
							each unsafe migration into its safe alternative.
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
								No lock (safe migration)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">
								Table locked (unsafe)
							</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Safe</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Blocked</div>
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
							edgeTypes={migEdgeTypes}
							nodes={flowNodes}
							nodeTypes={migNodeTypes}
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
									{stepper.currentStep === 0 &&
										'Add a gem that detects unsafe migrations at development time, before they reach production.'}
									{stepper.currentStep === 1 &&
										'Generate the configuration file that tells the gem your database version and safety thresholds.'}
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
								{stepper.currentStep === 2 &&
									'How should you safely add a column with a default to a table with 5M rows?'}
								{stepper.currentStep === 3 &&
									'How should you safely change a column type on a large table?'}
								{stepper.currentStep === 4 &&
									'How should you safely add an index to a large table without blocking writes?'}
								{stepper.currentStep === 5 &&
									'How should you configure strong_migrations for production safety?'}
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
						edgeTypes={migEdgeTypes}
						nodes={flowNodes}
						nodeTypes={migNodeTypes}
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
					levelName="Safe Migrations"
					levelNumber={44}
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
					learningGoal="Unsafe migrations lock tables and cause outages. Use strong_migrations to detect unsafe patterns, split risky operations into safe steps, and add indexes concurrently."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level44SafeMigrations;
