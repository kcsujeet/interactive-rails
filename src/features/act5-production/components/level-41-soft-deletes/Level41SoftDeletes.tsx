/**
 * Level 43: Soft Deletes & Audit Trails
 *
 * Three-phase flow: observe -> build -> reward
 *
 * Phase 1 (observe): 3-node visualization.
 *   Admin (left), Rails App (center), Database (right with mini-table rows).
 *   Probes show hard deletes destroying data, no undo, no audit trail.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: Add discard gem (terminal)
 *   Step 1: Generate discarded_at migration (terminal)
 *   Step 2: Configure model with Discard::Model (option)
 *   Step 3: Update queries to exclude discarded (option)
 *   Step 4: Add paper_trail gem (terminal - counts as step but grouped)
 *   Step 5: Configure PaperTrail for audit tracking (option)
 *
 * Phase 3 (reward): Same 3 nodes, Database shows soft-deleted rows and version history.
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

registerLevelCode('act5-level41-soft-deletes', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface SimpleNodeState {
	label: string;
	flash: ZoneFlash;
}

interface DbVizState {
	label: string;
	flash: ZoneFlash;
	rows: { text: string; color: 'default' | 'red' | 'green' | 'amber' }[];
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	admin?: Partial<SimpleNodeState>;
	app?: Partial<SimpleNodeState>;
	db?: Partial<DbVizState>;
	edge1?: Partial<EdgeVizState>;
	edge2?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_ADMIN: SimpleNodeState = { label: 'Idle', flash: 'idle' };
const DEFAULT_APP: SimpleNodeState = { label: 'Idle', flash: 'idle' };

const DEFAULT_DB: DbVizState = {
	label: 'users table',
	flash: 'idle',
	rows: [
		{ text: 'User #42 (alice@shop.com)', color: 'default' },
		{ text: 'User #43 (bob@shop.com)', color: 'default' },
	],
};

const DEFAULT_DB_REWARD: DbVizState = {
	label: 'users table (soft delete)',
	flash: 'idle',
	rows: [
		{ text: 'User #42 (active)', color: 'green' },
		{ text: 'User #43 (active)', color: 'green' },
	],
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-cyan-500',
};

// ─── Discovery definitions ─────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'hard-delete', label: 'Records are permanently destroyed' },
	{ id: 'no-undo', label: 'No way to restore deleted data' },
	{ id: 'no-audit', label: 'No record of who changed what' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES = [
	{
		id: 'hard-delete',
		label: 'Admin deletes customer (hard delete)',
		command: 'User.find(42).destroy',
		responseLines: [
			{ text: 'DELETE FROM users WHERE id = 42', color: 'red' as const },
			{
				text: '# Row removed from database permanently',
				color: 'red' as const,
			},
			{
				text: '# Associated orders, reviews, payments: CASCADE deleted',
				color: 'red' as const,
			},
			{ text: '# No way to recover', color: 'red' as const },
		],
		story: [
			'A support admin runs User.find(42).destroy in the console.',
			'The user row is permanently deleted from the database.',
			'All associated data (orders, reviews, payments) is cascade deleted.',
			'The data is gone forever. No backup query can bring it back.',
		],
	},
	{
		id: 'no-restore',
		label: 'Restore accidentally deleted product',
		command: 'Product.find(99)  # after destroy',
		responseLines: [
			{ text: 'ActiveRecord::RecordNotFound', color: 'red' as const },
			{
				text: '# Product was destroyed. Customers see 404.',
				color: 'red' as const,
			},
			{
				text: '# No "undo" method. No soft delete flag.',
				color: 'red' as const,
			},
			{
				text: '# Must re-create from scratch (if you remember the data)',
				color: 'red' as const,
			},
		],
		story: [
			'An admin accidentally deletes a popular product.',
			'Customers clicking saved links see 404 Not Found.',
			'There is no undo. The row is gone from the database.',
			'The team must manually re-create the product from memory.',
		],
	},
	{
		id: 'no-audit',
		label: 'Who changed the order status?',
		command:
			'Order.find(7).status  # changed from "paid" to "refunded" but by whom?',
		responseLines: [
			{ text: '=> "refunded"', color: 'yellow' as const },
			{
				text: '# Status was "paid" yesterday. Now "refunded".',
				color: 'yellow' as const,
			},
			{ text: '# No version history. No audit log.', color: 'red' as const },
			{ text: '# Who changed it? When? Why?', color: 'red' as const },
		],
		story: [
			'An order status changed from "paid" to "refunded" overnight.',
			'The customer claims they never requested a refund.',
			'There is no audit trail. No PaperTrail version history.',
			'Impossible to tell who made the change or when.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'hard-delete': ['hard-delete'],
	'no-restore': ['no-undo'],
	'no-audit': ['no-audit'],
};

// ─── Observe animation frames ─────────────────────────────────────────

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'hard-delete': [
		{
			admin: { label: 'User.find(42).destroy', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'destroy(42)',
				dotColor: 'bg-red-500',
			},
			app: { label: 'Processing destroy...', flash: 'idle' },
		},
		{
			edge1: { active: false },
			app: { label: 'DELETE FROM users...', flash: 'amber' },
			edge2: {
				active: true,
				reverse: false,
				label: 'DELETE WHERE id=42',
				dotColor: 'bg-red-500',
			},
			db: {
				label: 'users table',
				flash: 'amber',
				rows: [
					{ text: 'User #42 (deleting...)', color: 'amber' },
					{ text: 'User #43 (bob@shop.com)', color: 'default' },
				],
			},
		},
		{
			edge2: { active: false },
			db: {
				label: 'users table',
				flash: 'red',
				rows: [
					{ text: 'User #42: GONE', color: 'red' },
					{ text: 'User #43 (bob@shop.com)', color: 'default' },
				],
			},
			app: { label: 'Row permanently deleted', flash: 'red' },
		},
		{
			admin: { label: 'Data gone forever', flash: 'red' },
			db: {
				rows: [
					{ text: '(empty row)', color: 'red' },
					{ text: 'User #43 (bob@shop.com)', color: 'default' },
				],
			},
		},
	],
	'no-restore': [
		{
			admin: { label: 'Product.find(99)', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'find(99)',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Querying...', flash: 'idle' },
		},
		{
			edge1: { active: false },
			edge2: {
				active: true,
				reverse: false,
				label: 'SELECT WHERE id=99',
				dotColor: 'bg-cyan-500',
			},
			db: {
				label: 'products table',
				flash: 'amber',
				rows: [{ text: '(no row with id=99)', color: 'red' }],
			},
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: 'RecordNotFound',
				dotColor: 'bg-red-500',
			},
			app: { label: 'Not found!', flash: 'red' },
		},
		{
			edge2: { active: false },
			edge1: {
				active: true,
				reverse: true,
				label: 'RecordNotFound',
				dotColor: 'bg-red-500',
			},
			admin: { label: 'Cannot restore. No undo.', flash: 'red' },
			app: { label: 'Row was hard deleted', flash: 'red' },
		},
	],
	'no-audit': [
		{
			admin: { label: 'Order.find(7).status', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'check status',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Querying...', flash: 'idle' },
		},
		{
			edge1: { active: false },
			edge2: {
				active: true,
				reverse: true,
				label: '"refunded"',
				dotColor: 'bg-amber-500',
			},
			app: { label: 'Status: refunded', flash: 'amber' },
			db: {
				label: 'orders table',
				flash: 'amber',
				rows: [{ text: 'Order #7: refunded', color: 'amber' }],
			},
		},
		{
			edge2: { active: false },
			edge1: {
				active: true,
				reverse: true,
				label: 'Was "paid" yesterday',
				dotColor: 'bg-amber-500',
			},
			admin: { label: 'Who changed this?', flash: 'amber' },
		},
		{
			edge1: { active: false },
			admin: { label: 'No audit trail!', flash: 'red' },
			app: { label: 'No version history', flash: 'red' },
			db: {
				label: 'No versions table',
				flash: 'red',
				rows: [{ text: 'Order #7: refunded (no history)', color: 'red' }],
			},
		},
	],
};

// ─── Reward animation frames ──────────────────────────────────────────

const REWARD_FRAMES: Record<string, AnimFrame[]> = {
	'hard-delete': [
		{
			admin: { label: 'User.find(42).discard', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'discard(42)',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Processing soft delete...', flash: 'idle' },
		},
		{
			edge1: { active: false },
			app: { label: 'SET discarded_at = NOW()', flash: 'amber' },
			edge2: {
				active: true,
				reverse: false,
				label: 'UPDATE discarded_at',
				dotColor: 'bg-amber-500',
			},
			db: {
				label: 'users table (soft delete)',
				flash: 'amber',
				rows: [
					{ text: 'User #42 (discarding...)', color: 'amber' },
					{ text: 'User #43 (active)', color: 'green' },
				],
			},
		},
		{
			edge2: { active: false },
			db: {
				label: 'users table (soft delete)',
				flash: 'green',
				rows: [
					{ text: 'User #42 (discarded)', color: 'amber' },
					{ text: 'User #43 (active)', color: 'green' },
				],
			},
			app: { label: 'Soft deleted (recoverable)', flash: 'green' },
			admin: { label: 'Can restore anytime!', flash: 'green' },
		},
	],
	'no-restore': [
		{
			admin: { label: 'Product.find(99).undiscard!', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'undiscard!(99)',
				dotColor: 'bg-emerald-500',
			},
			app: { label: 'Restoring...', flash: 'idle' },
		},
		{
			edge1: { active: false },
			edge2: {
				active: true,
				reverse: false,
				label: 'SET discarded_at = NULL',
				dotColor: 'bg-emerald-500',
			},
			db: {
				label: 'products table',
				flash: 'amber',
				rows: [{ text: 'Product #99 (restoring...)', color: 'amber' }],
			},
		},
		{
			edge2: { active: false },
			db: {
				label: 'products table',
				flash: 'green',
				rows: [{ text: 'Product #99 (active)', color: 'green' }],
			},
			app: { label: 'Product restored!', flash: 'green' },
			admin: { label: 'Customers can see it again', flash: 'green' },
		},
	],
	'no-audit': [
		{
			admin: { label: 'Order.find(7).versions', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'check versions',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Querying PaperTrail...', flash: 'idle' },
		},
		{
			edge1: { active: false },
			edge2: {
				active: true,
				reverse: true,
				label: '3 versions found',
				dotColor: 'bg-emerald-500',
			},
			db: {
				label: 'versions table',
				flash: 'green',
				rows: [
					{ text: 'v1: created (admin_1)', color: 'default' },
					{ text: 'v2: paid (system)', color: 'green' },
					{ text: 'v3: refunded (admin_2)', color: 'amber' },
				],
			},
			app: { label: 'Full version history', flash: 'green' },
		},
		{
			edge2: { active: false },
			admin: { label: 'admin_2 changed it at 3:42 AM', flash: 'green' },
			app: { label: 'Who, when, what: tracked', flash: 'green' },
		},
	],
	'restore-with-trail': [
		{
			admin: { label: 'Restore + check trail', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'undiscard + versions',
				dotColor: 'bg-emerald-500',
			},
			app: { label: 'Processing...', flash: 'idle' },
		},
		{
			edge1: { active: false },
			db: {
				label: 'Full audit trail',
				flash: 'green',
				rows: [
					{ text: 'User #42: restored by admin_1', color: 'green' },
					{ text: 'PaperTrail: discard + undiscard logged', color: 'green' },
				],
			},
			app: { label: 'Restored with audit', flash: 'green' },
			admin: { label: 'Safe and tracked', flash: 'green' },
		},
	],
};

// ─── Build step definitions ────────────────────────────────────────────

const STEP_DEFS = [
	{ id: 'add-discard', title: 'Install Discard Gem' },
	{ id: 'add-column', title: 'Add discarded_at Column' },
	{ id: 'configure-model', title: 'Configure Soft Deletes' },
	{ id: 'update-queries', title: 'Update Default Scope' },
	{ id: 'add-paper-trail', title: 'Install PaperTrail' },
	{ id: 'configure-audit', title: 'Configure Audit Trail' },
];

const ADD_DISCARD_COMMANDS = [
	{
		id: 'wrong-paranoia',
		label: 'bundle add paranoia',
		command: 'bundle add paranoia',
		correct: false,
		feedback:
			'Paranoia overrides destroy globally and uses acts_as_paranoid which conflicts with Rails conventions. The modern alternative is explicit and non-invasive, letting existing code work unchanged.',
	},
	{
		id: 'correct',
		label: 'bundle add discard',
		command: 'bundle add discard',
		correct: true,
	},
	{
		id: 'wrong-deleted-at',
		label: 'rails g migration AddDeletedAtToUsers deleted_at:datetime',
		command: 'rails g migration AddDeletedAtToUsers deleted_at:datetime',
		correct: false,
		feedback:
			'You are running a migration before installing the gem. Install the soft-delete gem first, then add the column it expects.',
	},
];

const ADD_COLUMN_COMMANDS = [
	{
		id: 'correct',
		label: 'rails g migration AddDiscardToUsers discarded_at:datetime:index',
		command:
			'rails g migration AddDiscardToUsers discarded_at:datetime:index && rails db:migrate',
		correct: true,
	},
	{
		id: 'wrong-no-index',
		label: 'rails g migration AddDiscardToUsers discarded_at:datetime',
		command: 'rails g migration AddDiscardToUsers discarded_at:datetime',
		correct: false,
		feedback:
			'Without an index on discarded_at, every query filtering by discard status requires a full table scan. Add :index for performance.',
	},
	{
		id: 'wrong-boolean',
		label: 'rails g migration AddDeletedToUsers deleted:boolean',
		command: 'rails g migration AddDeletedToUsers deleted:boolean',
		correct: false,
		feedback:
			'A boolean flag loses the timestamp of when the record was soft-deleted. The gem expects a datetime column so you know exactly when it happened.',
	},
];

const CONFIGURE_MODEL_OPTIONS = [
	{
		id: 'wrong-acts-as',
		label: 'acts_as_paranoid in model',
		code: `class User < ApplicationRecord
  acts_as_paranoid
  # Overrides destroy globally
end`,
		correct: false,
		feedback:
			'acts_as_paranoid (from the paranoia gem) overrides destroy for ALL callers. The better approach is explicit: you choose when to soft-delete, so existing code still works.',
	},
	{
		id: 'correct',
		label: 'include Discard::Model',
		code: `class User < ApplicationRecord
  include Discard::Model

  # discard / undiscard instead of destroy
  # discarded? / kept? / undiscarded? helpers
  # User.kept returns only active records
  # User.discarded returns only soft-deleted
end`,
		correct: true,
	},
	{
		id: 'wrong-custom',
		label: 'Custom soft delete with scope',
		code: `class User < ApplicationRecord
  scope :active, -> { where(discarded_at: nil) }

  def soft_delete
    update(discarded_at: Time.current)
  end
end`,
		correct: false,
		feedback:
			'A custom implementation misses built-in helpers for undoing deletes, status checks, and query scopes. The gem you installed provides all of this declaratively.',
	},
];

const UPDATE_QUERIES_OPTIONS = [
	{
		id: 'wrong-default-scope',
		label: 'Use default_scope to hide discarded',
		code: `class User < ApplicationRecord
  include Discard::Model
  default_scope -> { kept }
end`,
		correct: false,
		feedback:
			'default_scope applies to ALL queries including admin panels and background jobs. Use explicit .kept scope in controllers so you can access discarded records when needed.',
	},
	{
		id: 'wrong-no-change',
		label: 'No query changes (show discarded to everyone)',
		code: `# No changes to existing queries
# All users see discarded records mixed with active ones`,
		correct: false,
		feedback:
			'Without filtering, API consumers see discarded records in listings. Public-facing queries must use .kept to exclude soft-deleted records.',
	},
	{
		id: 'correct',
		label: 'Use .kept scope in public queries, .with_discarded in admin',
		code: `# Public API: only active records
# app/services/list_users.rb
def call
  users = User.kept  # excludes discarded
  Result.new(success?: true, resource: users, errors: {})
end

# Admin: can see and restore discarded
# app/services/admin/list_all_users.rb
def call
  users = User.with_discarded  # includes discarded
  Result.new(success?: true, resource: users, errors: {})
end`,
		correct: true,
	},
];

const ADD_PAPER_TRAIL_COMMANDS = [
	{
		id: 'correct',
		label:
			'bundle add paper_trail && rails generate paper_trail:install && rails db:migrate',
		command:
			'bundle add paper_trail && rails generate paper_trail:install && rails db:migrate',
		correct: true,
	},
	{
		id: 'wrong-audited',
		label: 'bundle add audited',
		command: 'bundle add audited',
		correct: false,
		feedback:
			'Audited is an alternative, but the more widely adopted versioning gem has better Rails 8 support and integrates with whodunnit tracking out of the box.',
	},
	{
		id: 'wrong-no-generator',
		label: 'bundle add paper_trail',
		command: 'bundle add paper_trail',
		correct: false,
		feedback:
			'PaperTrail needs a versions table. After installing the gem, run the generator to create the migration, then migrate.',
	},
];

const CONFIGURE_AUDIT_OPTIONS = [
	{
		id: 'wrong-no-whodunnit',
		label: 'Enable PaperTrail without whodunnit',
		code: `class User < ApplicationRecord
  has_paper_trail
  # No whodunnit tracking
end`,
		correct: false,
		feedback:
			'Without whodunnit, you know WHAT changed but not WHO changed it. Set PaperTrail.request.whodunnit in your controller to track the acting user.',
	},
	{
		id: 'correct',
		label: 'PaperTrail with whodunnit in controller',
		code: `# app/models/user.rb
class User < ApplicationRecord
  include Discard::Model
  has_paper_trail
end

# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  before_action :set_paper_trail_whodunnit

  private

  def set_paper_trail_whodunnit
    PaperTrail.request.whodunnit = Current.user&.id
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-only-create',
		label: 'Track only create events',
		code: `class User < ApplicationRecord
  has_paper_trail on: [:create]
  # Only tracks creation, not updates or deletes
end`,
		correct: false,
		feedback:
			'Tracking only creates misses the most important events: updates and deletes. The audit trail exists to answer "who changed this?" which requires tracking all mutations.',
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{
		commands: ADD_DISCARD_COMMANDS,
		outputLines: [
			{
				text: 'Bundle complete! 1 Gemfile dependency added.',
				color: 'green' as const,
			},
		],
	},
	{
		commands: ADD_COLUMN_COMMANDS,
		outputLines: [
			{
				text: 'create  db/migrate/add_discard_to_users.rb',
				color: 'green' as const,
			},
			{ text: '== AddDiscardToUsers: migrated', color: 'green' as const },
		],
	},
	null,
	null,
	{
		commands: ADD_PAPER_TRAIL_COMMANDS,
		outputLines: [
			{
				text: 'create  db/migrate/create_versions.rb',
				color: 'green' as const,
			},
			{ text: '== CreateVersions: migrated', color: 'green' as const },
		],
	},
	null,
];

// ─── Stress test scenarios ─────────────────────────────────────────────

const STRESS_SCENARIOS = [
	{
		id: 'hard-delete',
		label: 'Admin soft-deletes customer (recoverable)',
		description: 'Record marked as discarded, not destroyed',
		method: 'DELETE' as const,
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
		story: [
			'Same admin, same delete action.',
			'But now discard sets discarded_at instead of destroying.',
			'Row stays in database. Restorable anytime.',
		],
	},
	{
		id: 'no-restore',
		label: 'Restore accidentally deleted product',
		description: 'Product restored from soft-deleted state',
		method: 'POST' as const,
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
		story: [
			'Same accidentally deleted product.',
			'Admin runs product.undiscard!',
			'discarded_at set to NULL. Product is active again.',
			'Customers see it immediately.',
		],
	},
	{
		id: 'no-audit',
		label: 'Check who changed order status (with PaperTrail)',
		description: 'Full version history with whodunnit',
		method: 'GET' as const,
		path: '/api/v1/orders/7/versions',
		actor: 'admin',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'v1: created by admin_1 at 2026-03-01', color: 'muted' },
			{ text: 'v2: status -> paid by system at 2026-03-01', color: 'green' },
			{
				text: 'v3: status -> refunded by admin_2 at 2026-03-02 03:42',
				color: 'yellow',
			},
		],
		story: [
			'Same order status mystery.',
			'But now PaperTrail tracks every version.',
			'admin_2 changed it to refunded at 3:42 AM.',
			'Full who, when, what audit trail.',
		],
	},
	{
		id: 'restore-with-trail',
		label: 'Restore user with audit trail',
		description: 'Soft delete and restore both tracked by PaperTrail',
		method: 'POST' as const,
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
		story: [
			'Admin restores soft-deleted user.',
			'Both the discard and the restore are logged.',
			'Complete audit trail: who deleted, who restored, when.',
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
				filename: 'app/models/user.rb',
				language: 'ruby',
				code: `class User < ApplicationRecord
  has_many :orders, dependent: :destroy
  has_many :reviews, dependent: :destroy

  # destroy = permanent deletion
  # No soft delete. No audit trail.
  # User.find(42).destroy -> row GONE
end`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (completedStep >= 0) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `gem 'discard'`,
			});
		}
		if (completedStep >= 1) {
			files.push({
				filename: 'db/migrate/add_discard_to_users.rb',
				language: 'ruby',
				code: `class AddDiscardToUsers < ActiveRecord::Migration[8.0]\n  def change\n    add_column :users, :discarded_at, :datetime\n    add_index :users, :discarded_at\n  end\nend\n# Migration applied.`,
			});
		}
		if (completedStep >= 2) {
			files.push({
				filename: 'app/models/user.rb',
				language: 'ruby',
				code: `class User < ApplicationRecord\n  include Discard::Model\n\n  has_many :orders, dependent: :destroy\n  has_many :reviews, dependent: :destroy\nend`,
			});
		}
		if (completedStep >= 3) {
			files.push({
				filename: 'app/services/list_users.rb',
				language: 'ruby',
				code: `class ListUsers < ApplicationService\n  Result = Data.define(:success?, :resource, :errors)\n\n  def call\n    users = User.kept  # excludes discarded\n    Result.new(success?: true, resource: users, errors: {})\n  end\nend`,
			});
		}
		if (completedStep >= 4) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `gem 'discard'\ngem 'paper_trail'`,
			});
		}
		if (completedStep >= 5) {
			files.push({
				filename: 'app/models/user.rb',
				language: 'ruby',
				code: `class User < ApplicationRecord\n  include Discard::Model\n  has_paper_trail\n\n  has_many :orders, dependent: :destroy\nend`,
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: '# Step 1: Add discard gem...',
			});
		}
		return files;
	}

	return [
		{
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord\n  include Discard::Model\n  has_paper_trail\n\n  has_many :orders, dependent: :destroy\nend`,
		},
		{
			filename: 'app/controllers/application_controller.rb',
			language: 'ruby',
			code: `class ApplicationController < ActionController::API\n  before_action :set_paper_trail_whodunnit\n\n  private\n\n  def set_paper_trail_whodunnit\n    PaperTrail.request.whodunnit = Current.user&.id\n  end\nend`,
		},
		{
			filename: 'app/services/list_users.rb',
			language: 'ruby',
			code: `class ListUsers < ApplicationService\n  Result = Data.define(:success?, :resource, :errors)\n\n  def call\n    users = User.kept  # excludes discarded\n    Result.new(success?: true, resource: users, errors: {})\n  end\nend`,
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

interface AdminNodeData extends SimpleNodeState {
	[key: string]: unknown;
}
const AdminNode = memo(({ data }: { data: AdminNodeData }) => {
	const d = data as AdminNodeData;
	const flowData: FlowNodeData = {
		label: 'Admin',
		icon: 'AD',
		color: '#10b981',
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

interface DbNodeData extends DbVizState {
	[key: string]: unknown;
}
const DbNode = memo(({ data }: { data: DbNodeData }) => {
	const d = data as DbNodeData;
	const flowData: FlowNodeData = {
		label: d.label,
		icon: 'DB',
		color: '#10b981',
		status: flashToStatus(d.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<>
			<FlowHandles />
			<FlowNode data={flowData}>
				{d.rows.length > 0 && (
					<div className="space-y-0.5 mt-1">
						{d.rows.map((row, i) => (
							<div
								className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
									row.color === 'red'
										? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
										: row.color === 'green'
											? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
											: row.color === 'amber'
												? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
												: 'bg-muted text-muted-foreground'
								}`}
								key={`${row.text}-${i}`}
							>
								{row.text}
							</div>
						))}
					</div>
				)}
			</FlowNode>
		</>
	);
});

function toDotFill(twClass: string): string {
	if (twClass.includes('emerald')) return '#10b981';
	if (twClass.includes('red')) return '#ef4444';
	if (twClass.includes('amber')) return '#f59e0b';
	if (twClass.includes('cyan')) return '#06b6d4';
	return '#a1a1aa';
}

interface SdEdgeData extends EdgeVizState {
	[key: string]: unknown;
}
const SdEdge = memo(
	({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
		const d = (data ?? DEFAULT_EDGE) as SdEdgeData;
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

const sdNodeTypes = { admin: AdminNode, app: AppNode, db: DbNode };
const sdEdgeTypes = { sd: SdEdge };

// ─── Main component ────────────────────────────────────────────────────

export function Level41SoftDeletes({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<'observe' | 'build' | 'reward'>('observe');
	const isReward = phase === 'reward';

	const [adminState, setAdminState] = useState<SimpleNodeState>({
		label: 'Idle',
		flash: 'idle',
	});
	const [appState, setAppState] = useState<SimpleNodeState>(DEFAULT_APP);
	const [dbState, setDbState] = useState<DbVizState>(DEFAULT_DB);
	const [edge1State, setEdge1State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge2State, setEdge2State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setAdminState(DEFAULT_ADMIN);
		setAppState(DEFAULT_APP);
		setDbState(isReward ? DEFAULT_DB_REWARD : DEFAULT_DB);
		setEdge1State(DEFAULT_EDGE);
		setEdge2State(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.admin) setAdminState((prev) => ({ ...prev, ...frame.admin }));
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

	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const allOptions: Record<number, typeof CONFIGURE_MODEL_OPTIONS> = {
				2: CONFIGURE_MODEL_OPTIONS,
				3: UPDATE_QUERIES_OPTIONS,
				5: CONFIGURE_AUDIT_OPTIONS,
			};
			const options = allOptions[stepper.currentStep];
			if (!options) return;
			const option = options.find((o) => o.id === optionId);
			if (!option) return;
			if (option.correct) stepper.completeStep();
			else stepper.recordWrongAttempt(option.feedback ?? 'Not quite right.');
		},
		[stepper],
	);

	const stressTest = useStressTest(STRESS_SCENARIOS);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_FRAMES[scenarioId];
			if (frames) {
				setAdminState(DEFAULT_ADMIN);
				setAppState(DEFAULT_APP);
				setDbState(DEFAULT_DB_REWARD);
				setEdge1State(DEFAULT_EDGE);
				setEdge2State(DEFAULT_EDGE);
				runAnimation(frames, undefined, ANIMATION_DURATION_MS * 2);
			}
		},
		[vizAnimating, stressTest, runAnimation],
	);

	const handleValidate = useCallback((): ValidationResult => {
		if (phase !== 'reward')
			return { valid: false, message: 'Complete all phases first.' };
		if (stressTest.results.length < 3)
			return {
				valid: false,
				message: 'Fire at least 3 stress test scenarios.',
			};
		return {
			valid: true,
			message: 'Soft deletes and audit trails configured!',
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

	const flowNodes = useMemo(
		(): Node[] => [
			{
				id: 'admin',
				type: 'admin',
				position: { x: 0, y: 40 },
				data: { ...adminState } satisfies AdminNodeData,
			},
			{
				id: 'app',
				type: 'app',
				position: { x: 300, y: 40 },
				data: { ...appState } satisfies AppNodeData,
			},
			{
				id: 'db',
				type: 'db',
				position: { x: 600, y: 20 },
				data: { ...dbState } satisfies DbNodeData,
			},
		],
		[adminState, appState, dbState],
	);

	const flowEdges = useMemo(
		(): Edge[] => [
			{
				id: 'e-admin-app',
				source: 'admin',
				target: 'app',
				type: 'sd',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge1State } satisfies SdEdgeData,
			},
			{
				id: 'e-app-db',
				source: 'app',
				target: 'db',
				type: 'sd',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge2State } satisfies SdEdgeData,
			},
		],
		[edge1State, edge2State],
	);

	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx <= 1 || idx === 4) {
			const termData = TERMINAL_STEP_MAP[idx];
			return {
				type: 'terminal' as const,
				commands: termData?.commands
					? shuffleOptions(termData.commands, idx)
					: undefined,
				outputLines: termData?.outputLines,
			};
		}
		const stepOptions: Record<number, typeof CONFIGURE_MODEL_OPTIONS> = {
			2: CONFIGURE_MODEL_OPTIONS,
			3: UPDATE_QUERIES_OPTIONS,
			5: CONFIGURE_AUDIT_OPTIONS,
		};
		return {
			type: 'option' as const,
			options: shuffleOptions(stepOptions[idx], idx),
		};
	}, [stepper.currentStep]);

	const buildCodePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground mb-2">
							Your API is protected from bots (L42), but internal mistakes are
							just as dangerous. An admin runs User.find(42).destroy and the
							user is permanently deleted. No undo. No record of who did it.
						</p>
						<p className="text-sm text-muted-foreground">
							This is the third time this month. You need soft deletes so
							records can be restored, and an audit trail so you know who
							changed what.
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
							Add soft deletes with the Discard gem and audit trails with
							PaperTrail.
						</p>
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						steps={stepper.steps}
					/>
				</div>
			);
		}
		return (
			<div className="space-y-4 p-4">
				<div>
					<h3 className="text-sm font-semibold text-foreground mb-2">Legend</h3>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-emerald-500" />
							<span className="text-muted-foreground">Active / Restored</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-amber-500" />
							<span className="text-muted-foreground">
								Soft-deleted (recoverable)
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
						<div className="text-xs text-muted-foreground">Blocked</div>
					</div>
				</div>
			</div>
		);
	};

	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col p-4 gap-4">
					<div className="flex-1 min-h-0">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={sdEdgeTypes}
							nodes={flowNodes}
							nodeTypes={sdNodeTypes}
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
										'Install the Discard gem for soft deletes.'}
									{stepper.currentStep === 1 &&
										'Add a discarded_at column with an index to the users table.'}
									{stepper.currentStep === 4 &&
										'Install PaperTrail, run its generator, and migrate to create the versions table.'}
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
									'How should the User model be configured for soft deletes?'}
								{stepper.currentStep === 3 &&
									'How should queries handle discarded records?'}
								{stepper.currentStep === 5 &&
									'How should PaperTrail be configured to track who made changes?'}
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
		return (
			<div className="flex-1 flex flex-col p-4 gap-4">
				<div className="flex-1 min-h-0">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={sdEdgeTypes}
						nodes={flowNodes}
						nodeTypes={sdNodeTypes}
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
					levelName="Soft Deletes & Audit Trails"
					levelNumber={43}
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
					learningGoal="Discard gem for soft deletes (discarded_at column), PaperTrail for version history tracking who changed what."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level41SoftDeletes;
