/**
 * Level 26: Database Indexing
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   inspect code, fire query probes to discover slow sequential scans.
 *   Discovery gating controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 5 steps building database indexes via migrations
 *   Step 0: Generate migration (terminal)
 *   Step 1: Add unique index on users.email (OptionCard)
 *   Step 2: Add foreign key index on posts.user_id (OptionCard)
 *   Step 3: Add composite index on posts.[published, created_at] (OptionCard)
 *   Step 4: Run migration (terminal)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Performance" button
 * Phase 4 (ADVANTAGE - reward): Stress test. Fire query scenarios and watch
 *   EXPLAIN switch from Seq Scan to Index Scan.
 *
 * Teaches: add_index, unique/composite/partial indexes, EXPLAIN, algorithm: :concurrently
 */

import { ArrowRight, Check, Play, Star, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalCommand,
	type TerminalOutputLine,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'seq-scan-email', label: 'Seq Scan on users.email (820ms)' },
	{ id: 'seq-scan-fk', label: 'Seq Scan on posts.user_id (450ms)' },
	{ id: 'seq-scan-composite', label: 'Sort + Seq Scan on published posts (650ms)' },
	{ id: 'no-indexes', label: 'No indexes defined on any table' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'query-email',
		label: 'Find user by email',
		command: 'EXPLAIN ANALYZE SELECT * FROM users WHERE email = \'alice@example.com\'',
		responseLines: [
			{ text: 'Seq Scan on users  (cost=0.00..245.00 rows=1 width=72)', color: 'red' },
			{ text: '  Filter: ((email)::text = \'alice@example.com\'::text)', color: 'muted' },
			{ text: '  Rows Removed by Filter: 9999', color: 'yellow' },
			{ text: '  Execution Time: 820.00 ms', color: 'red' },
		],
	},
	{
		id: 'query-fk',
		label: 'Load user posts',
		command: 'EXPLAIN ANALYZE SELECT * FROM posts WHERE user_id = 42',
		responseLines: [
			{ text: 'Seq Scan on posts  (cost=0.00..1125.00 rows=25 width=128)', color: 'red' },
			{ text: '  Filter: (user_id = 42)', color: 'muted' },
			{ text: '  Rows Removed by Filter: 49975', color: 'yellow' },
			{ text: '  Execution Time: 450.00 ms', color: 'red' },
		],
	},
	{
		id: 'query-composite',
		label: 'Published posts by date',
		command: 'EXPLAIN ANALYZE SELECT * FROM posts WHERE published = true ORDER BY created_at',
		responseLines: [
			{ text: 'Sort  (cost=1850.00..1862.50 rows=25000 width=128)', color: 'red' },
			{ text: '  Sort Key: created_at', color: 'muted' },
			{ text: '  ->  Seq Scan on posts  (rows=25000)', color: 'red' },
			{ text: '        Filter: (published = true)', color: 'muted' },
			{ text: '  Execution Time: 650.00 ms', color: 'red' },
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'query-email': 'seq-scan-email',
	'query-fk': 'seq-scan-fk',
	'query-composite': 'seq-scan-composite',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ dbSublabel: string; dbBadge: string }
> = {
	'query-email': {
		dbSublabel: 'Seq Scan: 10K rows',
		dbBadge: '820ms',
	},
	'query-fk': {
		dbSublabel: 'Seq Scan: 50K rows',
		dbBadge: '450ms',
	},
	'query-composite': {
		dbSublabel: 'Sort + Seq Scan',
		dbBadge: '650ms',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	request: {
		stageId: 'request',
		title: 'Incoming Request',
		description:
			'GET /api/users?email=alice@example.com arrives. The controller will look up the user by email, which hits the database.',
	},
	controller: {
		stageId: 'controller',
		title: 'UsersController',
		description:
			'The controller calls User.find_by(email: params[:email]). ActiveRecord translates this to a WHERE query on the users table.',
		code: `def show
  @user = User.find_by!(email: params[:email])
  render json: UserSerializer.new(@user)
end`,
	},
	database: {
		stageId: 'database',
		title: 'Database (No Indexes)',
		description:
			'No index exists on users.email or posts.user_id. Every query does a sequential scan, reading every row in the table to find matches. With 10K+ rows, this is extremely slow.',
		code: `-- Schema (no indexes!)
CREATE TABLE users (
  id bigint PRIMARY KEY,
  email varchar,
  name varchar,
  created_at timestamp
);
-- No index on email!
-- No index on posts.user_id!`,
	},
	model: {
		stageId: 'model',
		title: 'User Model',
		description:
			'The User model generates SQL queries. Without database indexes, every find_by, where, and order triggers a full table scan.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	database: 'no-indexes',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'email-lookup',
		label: 'Find user by email',
		description: 'Unique index lookup on users.email',
		method: 'GET',
		path: '/api/users?email=alice@example.com',
		actor: 'Index Scan (0.05ms)',
		expectedResult: 'allowed',
	},
	{
		id: 'fk-lookup',
		label: 'Load user posts',
		description: 'B-tree index on posts.user_id',
		method: 'GET',
		path: '/api/users/42/posts',
		actor: 'Index Scan (0.10ms)',
		expectedResult: 'allowed',
	},
	{
		id: 'composite-query',
		label: 'Published posts sorted',
		description: 'Composite index on [published, created_at]',
		method: 'GET',
		path: '/api/posts?published=true&sort=created_at',
		actor: 'Index Scan (0.20ms)',
		expectedResult: 'allowed',
	},
	{
		id: 'created-at-only',
		label: 'Posts by date only',
		description: 'Leftmost prefix rule: composite index cannot help',
		method: 'GET',
		path: '/api/posts?sort=created_at',
		actor: 'Seq Scan (still slow)',
		expectedResult: 'blocked',
	},
	{
		id: 'admin-all-users',
		label: 'Admin: list all users',
		description: 'Full table query, no WHERE clause needed',
		method: 'GET',
		path: '/api/admin/users',
		actor: 'Seq Scan (expected)',
		expectedResult: 'allowed',
	},
];

// ──────────────────────────────────────────────
// Step definitions (5 steps: 2 terminal + 3 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-migration', title: 'Generate Migration' },
	{ id: 'unique-index', title: 'Unique Index on Email' },
	{ id: 'fk-index', title: 'Foreign Key Index' },
	{ id: 'composite-index', title: 'Composite Index' },
	{ id: 'run-migration', title: 'Run Migration' },
];

// Step type indexed by step number
const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: rails generate migration
	'option', // 1: unique index on users.email
	'option', // 2: fk index on posts.user_id
	'option', // 3: composite index on posts.[published, created_at]
	'terminal', // 4: rails db:migrate
];

// ──────────────────────────────────────────────
// Step 0: Generate Migration (Terminal)
// ──────────────────────────────────────────────

const generateMigrationCommands: TerminalCommand[] = [
	{
		id: 'wrong-schema',
		label: 'rails db:schema:dump',
		command: 'rails db:schema:dump',
		correct: false,
		feedback:
			'That dumps the current schema to a file. You need to create a new migration to add indexes.',
	},
	{
		id: 'correct',
		label: 'rails generate migration AddIndexes',
		command: 'rails generate migration AddIndexes',
		correct: true,
	},
	{
		id: 'wrong-model',
		label: 'rails generate model Index',
		command: 'rails generate model Index',
		correct: false,
		feedback:
			'An index is a database optimization, not an ActiveRecord model. Use a plain migration.',
	},
];

const generateMigrationOutput: TerminalOutputLine[] = [
	{ text: '      invoke  active_record', color: 'muted' },
	{
		text: '      create    db/migrate/20240601120000_add_indexes.rb',
		color: 'green',
	},
];

// ──────────────────────────────────────────────
// Step 4: Run Migration (Terminal)
// ──────────────────────────────────────────────

const runMigrationCommands: TerminalCommand[] = [
	{
		id: 'wrong-setup',
		label: 'rails db:setup',
		command: 'rails db:setup',
		correct: false,
		feedback:
			'That recreates the database from scratch. You need to run pending migrations on the existing database.',
	},
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		command: 'rails db:seed',
		correct: false,
		feedback:
			'That loads seed data. You need to apply the migration that adds indexes.',
	},
	{
		id: 'correct',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
];

const runMigrationOutput: TerminalOutputLine[] = [
	{
		text: '== AddIndexes: migrating ====================================',
		color: 'muted',
	},
	{
		text: '-- add_index(:users, :email, {:unique=>true})',
		color: 'green',
	},
	{ text: '   -> 0.0045s', color: 'muted' },
	{ text: '-- add_index(:posts, :user_id)', color: 'green' },
	{ text: '   -> 0.0032s', color: 'muted' },
	{
		text: '-- add_index(:posts, [:published, :created_at])',
		color: 'green',
	},
	{ text: '   -> 0.0051s', color: 'muted' },
	{
		text: '== AddIndexes: migrated (0.0128s) ===========================',
		color: 'green',
	},
];

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: generateMigrationCommands, outputLines: generateMigrationOutput },
	null, // step 1: OptionCard (unique index)
	null, // step 2: OptionCard (fk index)
	null, // step 3: OptionCard (composite index)
	{ commands: runMigrationCommands, outputLines: runMigrationOutput },
];

// ──────────────────────────────────────────────
// OptionCard step data
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	1: {
		title: 'Unique Index on Email',
		description:
			'User.find_by(email: ...) triggers a Seq Scan across 10,000 rows. Each email must be unique. Which index definition belongs in the migration?',
		options: [
			{
				id: 'wrong-plain',
				label: 'add_index :users, :email',
				correct: false,
				feedback:
					'A plain index speeds up lookups but does not enforce uniqueness at the database level. Duplicate emails could still slip through.',
			},
			{
				id: 'correct',
				label: 'add_index :users, :email, unique: true',
				correct: true,
			},
			{
				id: 'wrong-column',
				label: 'add_index :users, :name, unique: true',
				correct: false,
				feedback:
					'The slow query filters by email, not name. Index the column that appears in the WHERE clause.',
			},
		],
	},
	2: {
		title: 'Foreign Key Index',
		description:
			'Post.where(user_id: 42) scans all 50,000 posts. Rails does not automatically index foreign keys. Which index fixes this?',
		options: [
			{
				id: 'wrong-composite',
				label: 'add_index :posts, [:user_id, :title]',
				correct: false,
				feedback:
					'A composite index on user_id and title is overkill here. The query only filters by user_id.',
			},
			{
				id: 'wrong-table',
				label: 'add_index :users, :id',
				correct: false,
				feedback:
					'The primary key already has an index. The slow query is on the posts table, filtering by user_id.',
			},
			{
				id: 'correct',
				label: 'add_index :posts, :user_id',
				correct: true,
			},
		],
	},
	3: {
		title: 'Composite Index',
		description:
			'Post.where(published: true).order(:created_at) does a sort on top of a Seq Scan. A composite index can cover both the WHERE and ORDER BY. Column order matters: the leftmost prefix rule means the first column must match the WHERE clause.',
		options: [
			{
				id: 'wrong-order',
				label: 'add_index :posts, [:created_at, :published]',
				correct: false,
				feedback:
					'Column order matters. The WHERE clause filters by published first, so published must be the leftmost column.',
			},
			{
				id: 'correct',
				label: 'add_index :posts, [:published, :created_at]',
				correct: true,
			},
			{
				id: 'wrong-single',
				label: 'add_index :posts, :created_at',
				correct: false,
				feedback:
					'A single-column index on created_at cannot cover the WHERE published = true filter. The database still needs a separate scan for the filter.',
			},
		],
	},
};

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'model', dots: 'mixed' },
	{ from: 'model', to: 'database', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'clean' },
	{ from: 'controller', to: 'model', dots: 'clean' },
	{ from: 'model', to: 'database', dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the unindexed schema
	if (phase === 'observe') {
		files.push({
			filename: 'db/schema.rb',
			language: 'ruby',
			code: `ActiveRecord::Schema[8.0].define do
  create_table "users" do |t|
    t.string "email", null: false
    t.string "name"
    t.timestamps
  end
  # No index on email!

  create_table "posts" do |t|
    t.references "user", foreign_key: true
    t.string "title"
    t.text "body"
    t.boolean "published", default: false
    t.timestamps
  end
  # No index on user_id!
  # No index on [published, created_at]!
end`,
			highlight: [7, 17, 18],
		});
		files.push({
			filename: 'app/controllers/api/v1/users_controller.rb',
			language: 'ruby',
			code: `class Api::V1::UsersController < ApplicationController
  def show
    @user = User.find_by!(email: params[:email])
    # Seq Scan: 820ms on 10K rows!
    render json: UserSerializer.new(@user)
  end
end`,
			highlight: [3, 4],
		});
		return files;
	}

	// Build / activate / reward phases: evolving migration code
	if (furthestStep === 0) {
		files.push({
			filename: 'db/migrate/add_indexes.rb',
			language: 'ruby',
			code: `class AddIndexes < ActiveRecord::Migration[8.0]
  def change
    # Add indexes here to speed up slow queries
  end
end`,
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'db/migrate/add_indexes.rb',
			language: 'ruby',
			code: `class AddIndexes < ActiveRecord::Migration[8.0]
  def change
    # Migration file created. Add index statements below.
  end
end`,
		});
	}

	if (furthestStep >= 2) {
		// After step 1: unique index on email
		files.push({
			filename: 'db/migrate/add_indexes.rb',
			language: 'ruby',
			code:
				furthestStep >= 4
					? `class AddIndexes < ActiveRecord::Migration[8.0]
  def change
    add_index :users, :email, unique: true
    add_index :posts, :user_id
    add_index :posts, [:published, :created_at]
  end
end`
					: furthestStep >= 3
						? `class AddIndexes < ActiveRecord::Migration[8.0]
  def change
    add_index :users, :email, unique: true
    add_index :posts, :user_id
    # Next: composite index for published posts
  end
end`
						: `class AddIndexes < ActiveRecord::Migration[8.0]
  def change
    add_index :users, :email, unique: true
    # Next: foreign key index
  end
end`,
			highlight:
				furthestStep >= 4
					? [3, 4, 5]
					: furthestStep >= 3
						? [3, 4]
						: [3],
		});
	}

	if (furthestStep >= 5) {
		// After running migration, show the EXPLAIN improvements
		files.push({
			filename: 'EXPLAIN output (after indexing)',
			language: 'sql',
			code: `-- User.find_by(email: "alice@example.com").explain
Index Scan using index_users_on_email on users
  Index Cond: ((email) = 'alice@example.com')
  Execution Time: 0.05 ms  -- was 820ms!

-- Post.where(user_id: 42).explain
Index Scan using index_posts_on_user_id on posts
  Index Cond: (user_id = 42)
  Execution Time: 0.10 ms  -- was 450ms!

-- Post.where(published: true).order(:created_at).explain
Index Scan using index_posts_on_published_and_created_at
  Index Cond: (published = true)
  Execution Time: 0.20 ms  -- was 650ms!`,
			highlight: [2, 4, 7, 9, 12, 14],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend (reward phase)
// ──────────────────────────────────────────────

function PipelineLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Query Performance Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">Index Scan (fast)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">Seq Scan (slow, no index)</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level26Indexing({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] =
		useState<StageInspectorData | null>(null);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);

	// ── Build observe stages dynamically (tracks inspected + last probe) ──
	const probeDisplay = lastProbeId
		? PROBE_PIPELINE_MAP[lastProbeId]
		: null;
	const observeStages: PipelineStage[] = useMemo(
		() => [
			{
				id: 'request',
				label: 'Request',
				inspectable: true,
				inspected: inspectedStages.has('request'),
			},
			{
				id: 'controller',
				label: 'Controller',
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'model',
				label: 'Model',
				inspectable: true,
				inspected: inspectedStages.has('model'),
			},
			{
				id: 'database',
				label: 'Database',
				sublabel: probeDisplay ? probeDisplay.dbSublabel : '(no indexes)',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				badge: probeDisplay ? probeDisplay.dbBadge : undefined,
				inspectable: true,
				inspected: inspectedStages.has('database'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		return [
			{ id: 'request', label: 'Request' },
			{ id: 'controller', label: 'Controller' },
			{ id: 'model', label: 'Model' },
			{
				id: 'database',
				label: 'Database',
				sublabel: wasBlocked ? 'Seq Scan (no index)' : 'Index Scan',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'SLOW' : undefined,
			},
		];
	}, [lastResult]);

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

	// ── Stage click handler (observe phase) ──
	const handleStageClick = useCallback(
		(stageId: string) => {
			if (phase !== 'observe') return;

			const data = STAGE_INSPECTOR_MAP[stageId];
			if (!data) return;

			setInspectorData(data);
			setInspectedStages((prev) => {
				if (prev.has(stageId)) return prev;
				const next = new Set(prev);
				next.add(stageId);
				return next;
			});

			// Trigger discovery if this stage has one
			const discoveryId = STAGE_DISCOVERY_MAP[stageId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, discoveryGating],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[discoveryGating],
	);

	// ── OptionCard step handler ──
	const handleOptionClick = useCallback(
		(option: StepOption) => {
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleActivateIndexes = () => {
		setPhase('reward');
		stressTest.reset();
	};

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
		},
		[stressTest],
	);

	// ── Completion ──
	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return { valid: true, message: 'Database indexes are deployed!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							GET /api/users?email=alice@example.com takes 820ms. The EXPLAIN
							output shows a sequential scan across 10,000 rows. Without
							database indexes, every query reads every row in the table.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							An index is like a book's table of contents. It lets the database
							jump directly to matching rows instead of scanning everything.
							Rails migrations use{' '}
							<span className="text-foreground font-medium">add_index</span> to
							create them.
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveries={discoveryGating.discoveries}
								discoveredCount={discoveryGating.discoveredCount}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build / activate phases: step progress */}
					{(phase === 'build' || phase === 'activate') && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Steps
							</div>
							<StepProgress
								currentStep={stepper.currentStep}
								onStepClick={stepper.goToStep}
								steps={stepper.steps}
							/>
						</div>
					)}

					{/* Reward phase: legend + counters */}
					{phase === 'reward' && (
						<>
							<PipelineLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">
											Fast (Index Scan)
										</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">
											Slow (Seq Scan)
										</div>
									</div>
								</div>
							</div>
						</>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Database Indexing"
					levelNumber={26}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									connections={OBSERVE_CONNECTIONS}
									onNodeClick={handleStageClick}
									stages={observeStages}
								/>
								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							{/* Probe terminal */}
							<div className="px-6 pb-2">
								<ProbeTerminal
									onProbe={handleProbe}
									probes={PROBES}
									title="EXPLAIN Probe"
								/>
							</div>

							{/* Build the Fix button (discovery gated) */}
							{discoveryGating.isUnlocked && (
								<div className="p-4 flex justify-center animate-in fade-in duration-500">
									<Button
										className="gap-2"
										onClick={handleStartBuild}
										size="lg"
									>
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								</div>
							)}
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Terminal steps (0: generate migration, 4: run migration) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={generateMigrationCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Three queries are doing sequential scans. You need a
													migration to add database indexes. Generate the
													migration file first.
												</p>
											}
											hasNext={hasNextStep}
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() => stepper.completeStep()}
											onNext={stepper.nextStep}
											onWrong={(fb) => stepper.recordWrongAttempt(fb)}
											outputLines={generateMigrationOutput}
											stepKey={stepper.currentStep}
											title="Generate Migration"
										/>
									)}

								{currentStepType === 'terminal' &&
									stepper.currentStep === 4 && (
										<TerminalChoiceStep
											commands={runMigrationCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													The migration has three indexes defined. Apply the
													migration to create the indexes in the database.
												</p>
											}
											hasNext={hasNextStep}
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() => stepper.completeStep()}
											onNext={stepper.nextStep}
											onWrong={(fb) => stepper.recordWrongAttempt(fb)}
											outputLines={runMigrationOutput}
											stepKey={stepper.currentStep}
											title="Run Migration"
										/>
									)}

								{/* OptionCard steps (1, 2, 3) */}
								{currentStepType === 'option' && currentOptionConfig && (
									<>
										<h3 className="text-lg font-semibold text-foreground">
											{currentOptionConfig.title}
										</h3>
										<p className="text-sm text-muted-foreground">
											{currentOptionConfig.description}
										</p>

										{isViewingCompletedStep ? (
											<div className="space-y-2">
												{currentOptionConfig.options.map((opt) => (
													<OptionCard
														color="violet"
														disabled={!opt.correct}
														key={opt.id}
														mono
														name={opt.label}
														selected={opt.correct}
														size="lg"
													/>
												))}
											</div>
										) : (
											<>
												<div className="space-y-2">
													{currentOptionConfig.options.map((opt) => (
														<OptionCard
															color="violet"
															key={opt.id}
															mono
															name={opt.label}
															onClick={() => handleOptionClick(opt)}
															size="lg"
														/>
													))}
												</div>

												<ErrorFeedback
													message={stepper.lastFeedback}
													onDismiss={stepper.clearFeedback}
												/>
											</>
										)}

										{isViewingCompletedStep && hasNextStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={stepper.nextStep}
													size="sm"
												>
													Next Step
													<ArrowRight className="w-4 h-4" />
												</Button>
											</div>
										)}
									</>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Activate (ADVANTAGE sub-phase a) ── */}
					{phase === 'activate' && (
						<div className="flex-1 flex items-center justify-center p-6">
							<div className="max-w-md text-center space-y-6">
								<div className="flex justify-center gap-1">
									{[1, 2, 3].map((s) => (
										<Star
											className={`w-8 h-8 ${
												s <= stepper.starRating
													? 'text-yellow-400 fill-yellow-400'
													: 'text-muted-foreground/30'
											}`}
											key={s}
										/>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									Your indexes are ready. Watch queries switch from Seq Scan to
									Index Scan across different scenarios.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateIndexes}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Performance
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward (ADVANTAGE sub-phase b) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									connections={REWARD_CONNECTIONS}
									stages={rewardStages}
								/>
							</div>

							{/* Stress test controls below pipeline */}
							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									isAutoFiring={stressTest.isAutoFiring}
									onFire={handleFireScenario}
									onToggleAutoFire={stressTest.toggleAutoFire}
									results={stressTest.results}
									scenarios={STRESS_SCENARIOS}
								/>
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level26Indexing;
