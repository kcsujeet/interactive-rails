/**
 * Level 26: Database Indexing
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): "Table Row Grid" visualization.
 *   3 lanes, each showing a database table as a grid of row blocks.
 *   Seq Scan: red wave sweeps through ALL blocks, then match block(s) turn green.
 *   The player SEES the database reading every row. Clickable lanes + schema
 *   button trigger discoveries. Discovery gating controls "Build the Fix".
 *
 * Phase 2 (HOW - build): 5 steps building database indexes via migrations
 *
 * Phase 3 (ADVANTAGE - reward): Same lanes return. Index Scan shows an
 *   IndexLookupCard (sorted B-tree entries with arrow to match), then ONLY the
 *   match block(s) turn green instantly. No red wave. The contrast teaches
 *   what an index does: skip the scan, jump to the answer.
 *
 * Teaches: add_index, unique/composite indexes, EXPLAIN, leftmost prefix rule
 */

import {
	ArrowRight,
	Database,
	Info,
	Search,
	Table2,
	X,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { cn } from '@/lib/utils';

registerLevelCode('act4-level26-database-indexing', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Query lane data types
// ──────────────────────────────────────────────

interface ScanResult {
	scanType: 'seq' | 'index';
	plan: string;
	time: string;
	rowsScanned: number;
	totalRows: number;
	rowsRemoved?: number;
	/** When true, a seq scan is expected (e.g., no WHERE clause). Uses amber instead of red. */
	expected?: boolean;
	sortKey?: string;
}

interface QueryLane {
	id: string;
	label: string;
	table: string;
	sql: string;
	icon: typeof Database;
	totalRows: number;
}

const QUERY_LANES: QueryLane[] = [
	{
		id: 'email',
		label: 'Email Lookup',
		table: 'users',
		sql: "SELECT * FROM users WHERE email = 'alice@example.com'",
		icon: Search,
		totalRows: 10000,
	},
	{
		id: 'fk',
		label: 'Foreign Key Lookup',
		table: 'posts',
		sql: 'SELECT * FROM products WHERE user_id = 42',
		icon: Table2,
		totalRows: 50000,
	},
	{
		id: 'composite',
		label: 'Composite Query',
		table: 'posts',
		sql: 'SELECT * FROM products WHERE published = true ORDER BY created_at',
		icon: Database,
		totalRows: 50000,
	},
];

// ──────────────────────────────────────────────
// Row grid config (visual representation of table rows)
// ──────────────────────────────────────────────

const GRID_SIZE = 100; // 10x10 grid of blocks per lane
const GRID_COLS = 20;

/** Which blocks in the grid represent "matched" rows */
const GRID_MATCHES: Record<string, number[]> = {
	// 1 user with that email, placed near the end to maximize visible scan
	email: [73],
	// 5 posts by user_id=42, scattered through the table
	fk: [12, 37, 54, 71, 89],
	// ~50% of posts are published (every other block)
	composite: Array.from({ length: 50 }, (_, i) => i * 2),
};

/** Index entries shown during reward phase index scans */
interface IndexEntry {
	value: string;
	row: string;
	highlight?: boolean;
}

const INDEX_LOOKUP_DATA: Record<
	string,
	{ name: string; entries: IndexEntry[] }
> = {
	email: {
		name: 'index_users_on_email (unique, B-tree)',
		entries: [
			{ value: 'aaa@corp.com', row: 'row #231' },
			{ value: 'alice@example.com', row: 'row #4231', highlight: true },
			{ value: 'bob@dev.io', row: 'row #1892' },
			{ value: 'carol@startup.co', row: 'row #892' },
			{ value: '...', row: '(9,996 more)' },
		],
	},
	fk: {
		name: 'index_posts_on_user_id (B-tree)',
		entries: [
			{ value: 'user_id = 41', row: 'rows #800..820' },
			{ value: 'user_id = 42', row: 'rows #821..845', highlight: true },
			{ value: 'user_id = 43', row: 'rows #846..870' },
			{ value: '...', row: '(sorted by user_id)' },
		],
	},
	composite: {
		name: 'index_posts_on_published_created_at',
		entries: [
			{ value: 'false, 2024-01-01', row: 'rows #1..25000' },
			{ value: 'true, 2024-01-01', row: 'row #25001', highlight: true },
			{ value: 'true, 2024-01-02', row: 'row #25002' },
			{ value: '(pre-sorted by created_at)', row: 'no Sort needed' },
		],
	},
};

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'seq-scan-email', label: 'Seq Scan on users.email (820ms)' },
	{ id: 'seq-scan-fk', label: 'Seq Scan on posts.user_id (450ms)' },
	{
		id: 'seq-scan-composite',
		label: 'Sort + Seq Scan on published posts (650ms)',
	},
	{ id: 'no-indexes', label: 'No indexes defined on any table' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'query-email',
		label: 'Find user by email',
		command:
			"EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'alice@example.com'",
		responseLines: [
			{
				text: 'Seq Scan on users  (cost=0.00..245.00 rows=1 width=72)',
				color: 'red',
			},
			{
				text: "  Filter: ((email)::text = 'alice@example.com'::text)",
				color: 'muted',
			},
			{ text: '  Rows Removed by Filter: 9999', color: 'yellow' },
			{ text: '  Execution Time: 820.00 ms', color: 'red' },
		],
		story: [
			'A user logs in by entering their email address.',
			'PostgreSQL runs a sequential scan across all 10,000 rows in the users table.',
			'It checks every single row, discarding 9,999 non-matches.',
			'Login takes 820ms because there is no index on the email column.',
		],
	},
	{
		id: 'query-fk',
		label: 'Load user posts',
		command: 'EXPLAIN ANALYZE SELECT * FROM products WHERE user_id = 42',
		responseLines: [
			{
				text: 'Seq Scan on posts  (cost=0.00..1125.00 rows=25 width=128)',
				color: 'red',
			},
			{ text: '  Filter: (user_id = 42)', color: 'muted' },
			{ text: '  Rows Removed by Filter: 49975', color: 'yellow' },
			{ text: '  Execution Time: 450.00 ms', color: 'red' },
		],
		story: [
			'A user visits a profile page, which loads all their products.',
			'The query filters products by user_id, a foreign key column.',
			'Without an index, PostgreSQL scans all 50,000 rows to find 25 matches.',
			'49,975 rows are examined and discarded, taking 450ms.',
		],
	},
	{
		id: 'query-composite',
		label: 'Published posts by date',
		command:
			'EXPLAIN ANALYZE SELECT * FROM products WHERE published = true ORDER BY created_at',
		responseLines: [
			{
				text: 'Sort  (cost=1850.00..1862.50 rows=25000 width=128)',
				color: 'red',
			},
			{ text: '  Sort Key: created_at', color: 'muted' },
			{ text: '  ->  Seq Scan on posts  (rows=25000)', color: 'red' },
			{ text: '        Filter: (published = true)', color: 'muted' },
			{ text: '  Execution Time: 650.00 ms', color: 'red' },
		],
		story: [
			'The homepage displays published products sorted by date.',
			'PostgreSQL scans 25,000 published rows, then sorts them all by created_at.',
			'Both the filter and the sort require full table scans without an index.',
			'A composite index on (published, created_at) would serve both operations.',
		],
	},
];

// Map probe IDs to discovery IDs and lane IDs
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'query-email': 'seq-scan-email',
	'query-fk': 'seq-scan-fk',
	'query-composite': 'seq-scan-composite',
};

const PROBE_LANE_MAP: Record<string, string> = {
	'query-email': 'email',
	'query-fk': 'fk',
	'query-composite': 'composite',
};

// Observe scan results per probe (Seq Scan data)
const OBSERVE_SCAN_DATA: Record<string, ScanResult> = {
	email: {
		scanType: 'seq',
		plan: 'Seq Scan on users',
		time: '820ms',
		rowsScanned: 10000,
		totalRows: 10000,
		rowsRemoved: 9999,
	},
	fk: {
		scanType: 'seq',
		plan: 'Seq Scan on posts',
		time: '450ms',
		rowsScanned: 50000,
		totalRows: 50000,
		rowsRemoved: 49975,
	},
	composite: {
		scanType: 'seq',
		plan: 'Sort + Seq Scan on posts',
		time: '650ms',
		rowsScanned: 50000,
		totalRows: 50000,
		sortKey: 'created_at',
	},
};

// ──────────────────────────────────────────────
// Schema inspector (observe phase, 4th discovery)
// ──────────────────────────────────────────────

const SCHEMA_INSPECTOR: StageInspectorData = {
	stageId: 'schema',
	title: 'Database Schema (No Indexes)',
	description:
		'No indexes exist on any column. Every WHERE, JOIN, and ORDER BY triggers a sequential scan, reading every row in the table.',
	code: `-- db/schema.rb (no indexes!)
CREATE TABLE users (
  id bigint PRIMARY KEY,
  email varchar NOT NULL,
  name varchar,
  created_at timestamp
);
-- No index on email!

CREATE TABLE posts (
  id bigint PRIMARY KEY,
  user_id bigint REFERENCES users(id),
  title varchar,
  body text,
  published boolean DEFAULT false,
  created_at timestamp
);
-- No index on user_id!
-- No index on [published, created_at]!`,
};

// Lane inspector data (click on lane headers)
const LANE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	email: {
		stageId: 'email',
		title: 'Email Lookup Query',
		description:
			'UserLookup.call(email:) calls User.find_by!(email: @email) inside the service. This translates to a WHERE clause. Without an index, the database reads every row to find the match.',
		code: `-- UserLookup service calls User.find_by!(email: @email)
-- Generated SQL:
SELECT * FROM users WHERE email = 'alice@example.com'

-- EXPLAIN output:
Seq Scan on users  (cost=0.00..245.00)
  Filter: ((email) = 'alice@example.com')
  Rows Removed by Filter: 9999
  -- Scanned all 10,000 rows to find 1 match!`,
	},
	fk: {
		stageId: 'fk',
		title: 'Foreign Key Lookup Query',
		description:
			'UserPostsLoader.call(user_id:) calls Product.where(user_id: @user_id) inside the service. This filters posts by a foreign key. Rails does NOT automatically create indexes on foreign key columns.',
		code: `-- UserPostsLoader service calls Product.where(user_id: @user_id)
-- Generated SQL:
SELECT * FROM products WHERE user_id = 42

-- EXPLAIN output:
Seq Scan on posts  (cost=0.00..1125.00)
  Filter: (user_id = 42)
  Rows Removed by Filter: 49975
  -- Scanned all 50,000 posts to find 25!`,
	},
	composite: {
		stageId: 'composite',
		title: 'Composite Query (WHERE + ORDER BY)',
		description:
			'PublishedPostsQuery.call filters with Product.where(published: true).order(:created_at) inside the service. Without a composite index, the database does a full scan AND an in-memory sort.',
		code: `-- PublishedPostsQuery service calls Product.where(published: true).order(:created_at)
-- Generated SQL:
SELECT * FROM products
  WHERE published = true
  ORDER BY created_at

-- EXPLAIN output:
Sort  (cost=1850.00..1862.50)
  Sort Key: created_at
  ->  Seq Scan on posts
      Filter: (published = true)
  -- Full scan + in-memory sort = double penalty`,
	},
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
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Index Scan using index_users_on_email on users',
				color: 'green',
			},
			{
				text: "  Index Cond: (email = 'alice@example.com')",
				color: 'yellow',
			},
			{ text: '  Rows Scanned: 1 of 10,000', color: 'green' },
			{ text: '  Execution Time: 0.05 ms (was 820ms)', color: 'green' },
		],
	},
	{
		id: 'fk-lookup',
		label: 'Load user posts',
		description: 'B-tree index on posts.user_id',
		method: 'GET',
		path: '/api/users/42/posts',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Index Scan using index_posts_on_user_id on posts',
				color: 'green',
			},
			{ text: '  Index Cond: (user_id = 42)', color: 'yellow' },
			{ text: '  Rows Scanned: 25 of 50,000', color: 'green' },
			{ text: '  Execution Time: 0.10 ms (was 450ms)', color: 'green' },
		],
	},
	{
		id: 'composite-query',
		label: 'Published posts sorted',
		description: 'Composite index on [published, created_at]',
		method: 'GET',
		path: '/api/posts?published=true&sort=created_at',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Index Scan using index_posts_on_published_and_created_at',
				color: 'green',
			},
			{
				text: '  Index Cond: (published = true)',
				color: 'yellow',
			},
			{
				text: '  Rows pre-sorted by created_at (no Sort node)',
				color: 'green',
			},
			{ text: '  Execution Time: 0.20 ms (was 650ms)', color: 'green' },
		],
	},
	{
		id: 'created-at-only',
		label: 'Posts by date only',
		description: 'Leftmost prefix rule: composite index cannot help',
		method: 'GET',
		path: '/api/posts?sort=created_at',
		actor: 'client',
		expectedResult: 'blocked',
		responseLines: [
			{
				text: 'Seq Scan on posts  (cost=0.00..1125.00)',
				color: 'red',
			},
			{
				text: '  Sort Key: created_at (no covering index)',
				color: 'yellow',
			},
			{
				text: '  Index on [published, created_at] skipped: leftmost column not in query',
				color: 'red',
			},
			{ text: '  Execution Time: 650.00 ms (still slow!)', color: 'red' },
		],
	},
	{
		id: 'admin-all-users',
		label: 'Admin: list all users',
		description: 'Full table scan, no WHERE clause to index',
		method: 'GET',
		path: '/api/admin/users',
		actor: 'admin',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Seq Scan on users  (cost=0.00..245.00)',
				color: 'yellow',
			},
			{
				text: '  No WHERE clause: index not applicable',
				color: 'yellow',
			},
			{
				text: '  Full scan expected (loading all rows is the goal)',
				color: 'green',
			},
			{
				text: '  Execution Time: 12.00 ms (acceptable for admin)',
				color: 'green',
			},
		],
	},
];

// Reward scan data per scenario
const REWARD_SCAN_DATA: Record<
	string,
	ScanResult & { laneId: string; sqlOverride?: string; labelOverride?: string }
> = {
	'email-lookup': {
		laneId: 'email',
		scanType: 'index',
		plan: 'Index Scan using index_users_on_email',
		time: '0.05ms',
		rowsScanned: 1,
		totalRows: 10000,
	},
	'fk-lookup': {
		laneId: 'fk',
		scanType: 'index',
		plan: 'Index Scan using index_posts_on_user_id',
		time: '0.10ms',
		rowsScanned: 25,
		totalRows: 50000,
	},
	'composite-query': {
		laneId: 'composite',
		scanType: 'index',
		plan: 'Index Scan using index_posts_on_published_and_created_at',
		time: '0.20ms',
		rowsScanned: 25000,
		totalRows: 50000,
	},
	'created-at-only': {
		laneId: 'composite',
		scanType: 'seq',
		plan: 'Seq Scan on posts (leftmost prefix violation)',
		time: '650ms',
		rowsScanned: 50000,
		totalRows: 50000,
	},
	'admin-all-users': {
		laneId: 'email',
		scanType: 'seq',
		plan: 'Seq Scan on users (no WHERE clause, expected)',
		time: '12ms',
		rowsScanned: 10000,
		totalRows: 10000,
		expected: true,
		sqlOverride: 'SELECT * FROM users',
		labelOverride: 'Admin: All Users',
	},
};

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

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal',
	'option',
	'option',
	'option',
	'terminal',
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
		id: 'correct',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		command: 'rails db:seed',
		correct: false,
		feedback:
			'That loads seed data. You need to apply the migration that adds indexes.',
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
	{
		commands: generateMigrationCommands,
		outputLines: generateMigrationOutput,
	},
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
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
			'UserLookup calls User.find_by!(email: @email), which triggers a Seq Scan across 10,000 rows. Each email must be unique. Which index definition belongs in the migration?',
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
			'UserPostsLoader calls Product.where(user_id: @user_id), which scans all 50,000 posts. Rails does not automatically index foreign keys. Which index fixes this?',
		options: [
			{
				id: 'wrong-composite',
				label: 'add_index :posts, [:user_id, :title]',
				correct: false,
				feedback:
					'A composite index on user_id and title is overkill here. The query only filters by user_id.',
			},
			{
				id: 'correct',
				label: 'add_index :posts, :user_id',
				correct: true,
			},
			{
				id: 'wrong-table',
				label: 'add_index :users, :id',
				correct: false,
				feedback:
					'The primary key already has an index. The slow query is on the products table, filtering by user_id.',
			},
		],
	},
	3: {
		title: 'Composite Index',
		description:
			'PublishedPostsQuery calls Product.where(published: true).order(:created_at), which does a sort on top of a Seq Scan. A composite index can cover both the WHERE and ORDER BY. Column order matters: the leftmost prefix rule means the first column must match the WHERE clause.',
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
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

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
			highlight: [7, 16, 17],
		});
		files.push({
			filename: 'app/services/user_lookup.rb',
			language: 'ruby',
			code: `class UserLookup < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(email:)
    @email = email
  end

  def call
    user = User.find_by!(email: @email)
    # Seq Scan: 820ms on 10K rows!
    Result.new(success?: true, user: user, errors: [])
  rescue ActiveRecord::RecordNotFound
    Result.new(success?: false, user: nil, errors: ["not found"])
  end
end`,
			highlight: [9, 10],
		});
		files.push({
			filename: 'app/controllers/api/v1/users_controller.rb',
			language: 'ruby',
			code: `class Api::V1::UsersController < ApplicationController
  def show
    result = UserLookup.call(email: params[:email])
    render json: UserSerializer.new(result.user)
  end
end`,
		});
		return files;
	}

	// Build / reward phases: evolving migration code
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
	} else if (furthestStep === 1) {
		files.push({
			filename: 'db/migrate/add_indexes.rb',
			language: 'ruby',
			code: `class AddIndexes < ActiveRecord::Migration[8.0]
  def change
    # Migration file created. Add index statements below.
  end
end`,
		});
	} else if (furthestStep === 2) {
		files.push({
			filename: 'db/migrate/add_indexes.rb',
			language: 'ruby',
			code: `class AddIndexes < ActiveRecord::Migration[8.0]
  def change
    add_index :users, :email, unique: true
    # Next: foreign key index
  end
end`,
			highlight: [3],
		});
	} else if (furthestStep === 3) {
		files.push({
			filename: 'db/migrate/add_indexes.rb',
			language: 'ruby',
			code: `class AddIndexes < ActiveRecord::Migration[8.0]
  def change
    add_index :users, :email, unique: true
    add_index :posts, :user_id
    # Next: composite index for published posts
  end
end`,
			highlight: [3, 4],
		});
	} else if (furthestStep === 4) {
		files.push({
			filename: 'db/migrate/add_indexes.rb',
			language: 'ruby',
			code: `class AddIndexes < ActiveRecord::Migration[8.0]
  def change
    add_index :users, :email, unique: true
    add_index :posts, :user_id
    add_index :posts, [:published, :created_at]
  end
end`,
			highlight: [3, 4, 5],
		});
	} else {
		// furthestStep >= 5 (after running migration)
		files.push({
			filename: 'db/migrate/add_indexes.rb',
			language: 'ruby',
			code: `class AddIndexes < ActiveRecord::Migration[8.0]
  def change
    add_index :users, :email, unique: true
    add_index :posts, :user_id
    add_index :posts, [:published, :created_at]
  end
end`,
			highlight: [3, 4, 5],
		});
		files.push({
			filename: 'EXPLAIN output (after indexing)',
			language: 'sql',
			code: `-- UserLookup.call(email: "alice@example.com")
-- Service calls User.find_by!(email: @email)
Index Scan using index_users_on_email on users
  Index Cond: ((email) = 'alice@example.com')
  Execution Time: 0.05 ms  (was 820ms)

-- UserPostsLoader.call(user_id: 42)
-- Service calls Product.where(user_id: @user_id)
Index Scan using index_posts_on_user_id on posts
  Index Cond: (user_id = 42)
  Execution Time: 0.10 ms  (was 450ms)

-- PublishedPostsQuery.call
-- Service calls Product.where(published: true).order(:created_at)
Index Scan using index_posts_on_published_and_created_at
  Index Cond: (published = true)
  Execution Time: 0.20 ms  (was 650ms)`,
			highlight: [3, 5, 9, 11, 15, 17],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// TableRowGrid: shows database rows as a grid of blocks
// ──────────────────────────────────────────────

function TableRowGrid({
	laneId,
	scanProgress,
	scanType,
	tableName,
	totalRows,
	expected,
}: {
	laneId: string;
	scanProgress: number; // -1=idle, 0..GRID_SIZE=scanning, GRID_SIZE=done
	scanType: 'seq' | 'index';
	tableName: string;
	totalRows: number;
	expected?: boolean;
}) {
	const matchPositions = useMemo(
		() => new Set(GRID_MATCHES[laneId] ?? []),
		[laneId],
	);
	const gridBlocks = useMemo(
		() =>
			Array.from({ length: GRID_SIZE }, (_, i) => ({
				key: `${laneId}-r${i}`,
				idx: i,
				isMatch: matchPositions.has(i),
			})),
		[laneId, matchPositions],
	);
	const isDone = scanProgress >= GRID_SIZE;
	const isActive = scanProgress >= 0;
	const matchCount = matchPositions.size;
	const rowsPerBlock = Math.round(totalRows / GRID_SIZE);

	// Color classes depend on whether the seq scan is expected (amber) or problematic (red)
	const seqTextColor = expected
		? 'text-amber-600 dark:text-amber-400'
		: 'text-red-600 dark:text-red-400';
	const seqBlockColor = expected
		? 'bg-amber-300/80 dark:bg-amber-500/50'
		: 'bg-red-400/80 dark:bg-red-500/60';

	return (
		<div className="space-y-2">
			{/* Table label */}
			<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
				<Table2 className="w-3 h-3" />
				<span className="font-mono">
					{tableName} ({totalRows.toLocaleString()} rows)
				</span>
				{isActive && scanType === 'seq' && !isDone && (
					<span className={cn('font-mono', seqTextColor)}>
						scanning row{' '}
						{Math.min(scanProgress * rowsPerBlock, totalRows).toLocaleString()}
						...
					</span>
				)}
				{isDone && scanType === 'seq' && (
					<span className={cn('font-mono', seqTextColor)}>
						all {totalRows.toLocaleString()} rows{' '}
						{expected ? 'loaded' : 'scanned'}
					</span>
				)}
				{isDone && scanType === 'index' && (
					<span className="font-mono text-emerald-600 dark:text-emerald-400">
						{matchCount} row{matchCount !== 1 ? 's' : ''} via index
					</span>
				)}
			</div>

			{/* Row grid */}
			<div
				className="flex flex-wrap gap-[3px]"
				style={{ maxWidth: `${GRID_COLS * 13}px` }}
			>
				{gridBlocks.map((block) => (
					<div
						className={cn(
							'w-2.5 h-2.5 rounded-[1px] transition-colors duration-75',
							block.isMatch && isDone
								? 'bg-emerald-500 dark:bg-emerald-400'
								: block.idx < scanProgress && scanType === 'seq'
									? seqBlockColor
									: 'bg-zinc-200 dark:bg-zinc-700/50',
						)}
						key={block.key}
					/>
				))}
			</div>

			{/* Legend below grid */}
			{isDone && (
				<div className="flex items-center gap-4 text-[10px] animate-in fade-in duration-300">
					{scanType === 'seq' ? (
						<>
							<span className="flex items-center gap-1">
								<span
									className={cn(
										'inline-block w-2 h-2 rounded-[1px]',
										seqBlockColor,
									)}
								/>
								<span className={seqTextColor}>
									{expected ? 'Loaded' : 'Scanned'} (
									{(GRID_SIZE - matchCount).toLocaleString()} blocks)
								</span>
							</span>
							<span className="flex items-center gap-1">
								<span className="inline-block w-2 h-2 rounded-[1px] bg-emerald-500 dark:bg-emerald-400" />
								<span className="text-emerald-600 dark:text-emerald-400">
									Matched ({matchCount})
								</span>
							</span>
						</>
					) : (
						<span className="flex items-center gap-1">
							<span className="inline-block w-2 h-2 rounded-[1px] bg-emerald-500 dark:bg-emerald-400" />
							<span className="text-emerald-600 dark:text-emerald-400">
								Direct lookup via index ({matchCount} row
								{matchCount !== 1 ? 's' : ''})
							</span>
						</span>
					)}
				</div>
			)}
		</div>
	);
}

// ──────────────────────────────────────────────
// IndexLookupCard: shows the B-tree index structure
// ──────────────────────────────────────────────

function IndexLookupCard({
	indexName,
	entries,
}: {
	indexName: string;
	entries: IndexEntry[];
}) {
	return (
		<div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10 p-2.5 space-y-1.5">
			<div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
				<Zap className="w-3.5 h-3.5" />
				<span className="font-mono">{indexName}</span>
			</div>
			<div className="space-y-0.5 pl-5 font-mono text-[10px]">
				{entries.map((entry) => (
					<div
						className={cn(
							'flex items-center gap-2',
							entry.highlight
								? 'text-emerald-700 dark:text-emerald-300 font-bold'
								: 'text-emerald-600/40 dark:text-emerald-400/30',
						)}
						key={`idx-${entry.value}`}
					>
						{entry.highlight ? (
							<ArrowRight className="w-2.5 h-2.5 shrink-0" />
						) : (
							<span className="w-2.5" />
						)}
						<span>{entry.value}</span>
						{entry.row && (
							<span
								className={cn(
									entry.highlight
										? 'text-emerald-600 dark:text-emerald-400'
										: 'text-emerald-500/30 dark:text-emerald-400/20',
								)}
							>
								{'\u2192'} {entry.row}
							</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// NoIndexBanner: shown during seq scan
// ──────────────────────────────────────────────

function NoIndexBanner({
	tableName,
	expected,
}: {
	tableName: string;
	expected?: boolean;
}) {
	if (expected) {
		return (
			<div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-900/10 px-2.5 py-1.5 flex items-center gap-2 text-[11px]">
				<Info className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
				<span className="font-mono text-amber-700 dark:text-amber-400 font-semibold">
					Full table scan (no WHERE clause)
				</span>
				<span className="text-amber-600/60 dark:text-amber-400/50">
					Expected when loading all rows
				</span>
			</div>
		);
	}
	return (
		<div className="rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-900/10 px-2.5 py-1.5 flex items-center gap-2 text-[11px]">
			<X className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
			<span className="font-mono text-red-700 dark:text-red-400 font-semibold">
				No index on {tableName}
			</span>
			<span className="text-red-600/60 dark:text-red-400/50">
				Reading every row (Sequential Scan)
			</span>
		</div>
	);
}

// ──────────────────────────────────────────────
// QueryPlanLane: a single query lane with row grid
// ──────────────────────────────────────────────

function QueryPlanLane({
	lane,
	scan,
	scanProgress,
	scanType,
	indexData,
	inspectable,
	inspected,
	onClick,
	sqlOverride,
	labelOverride,
}: {
	lane: QueryLane;
	scan: ScanResult | null;
	scanProgress: number;
	scanType: 'seq' | 'index';
	indexData?: { name: string; entries: IndexEntry[] } | null;
	inspectable?: boolean;
	inspected?: boolean;
	onClick?: () => void;
	sqlOverride?: string;
	labelOverride?: string;
}) {
	const Icon = lane.icon;
	const isActive = scanProgress >= 0;
	const isDone = scanProgress >= GRID_SIZE;
	const isIndex = scanType === 'index';
	const isExpected = scan?.expected ?? false;

	return (
		<button
			className={cn(
				'w-full text-left rounded-lg border p-3 transition-all duration-300',
				isActive && isDone
					? isIndex
						? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10'
						: isExpected
							? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10'
							: 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10'
					: 'border-border bg-card',
				inspectable && 'cursor-pointer hover:ring-2 hover:ring-primary/40',
			)}
			disabled={!inspectable}
			onClick={onClick}
			type="button"
		>
			{/* Header */}
			<div className="flex items-center gap-2 mb-1">
				<Icon className="w-3.5 h-3.5 text-muted-foreground" />
				<span className="text-xs font-semibold text-foreground">
					{labelOverride ?? lane.label}
				</span>
				<span className="text-[10px] font-mono text-muted-foreground">
					({lane.table})
				</span>
				{inspectable && !inspected && (
					<span className="ml-auto text-primary animate-pulse text-xs font-bold">
						?
					</span>
				)}
				{isDone && scan && (
					<Badge
						className={cn(
							'ml-auto text-[10px]',
							isIndex
								? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400'
								: isExpected
									? 'border-amber-500/50 text-amber-700 dark:text-amber-400'
									: 'border-red-500/50 text-red-700 dark:text-red-400',
						)}
						variant="outline"
					>
						{isIndex ? (
							<>
								<Zap className="w-2.5 h-2.5 mr-1" />
								{scan.time}
							</>
						) : (
							scan.time
						)}
					</Badge>
				)}
			</div>

			{/* SQL */}
			<p className="text-[10px] font-mono text-muted-foreground mb-2 truncate">
				{sqlOverride ?? lane.sql}
			</p>

			{/* Visualization content */}
			{isActive ? (
				<div className="space-y-2" onClickCapture={(e) => e.stopPropagation()}>
					{/* Index lookup card OR no-index banner */}
					{isIndex && indexData ? (
						<IndexLookupCard
							entries={indexData.entries}
							indexName={indexData.name}
						/>
					) : isActive ? (
						<NoIndexBanner expected={isExpected} tableName={lane.table} />
					) : null}

					{/* Row grid */}
					<TableRowGrid
						expected={isExpected}
						laneId={lane.id}
						scanProgress={scanProgress}
						scanType={scanType}
						tableName={lane.table}
						totalRows={lane.totalRows}
					/>

					{/* EXPLAIN plan text */}
					{isDone && scan && (
						<div className="flex items-center gap-2 animate-in fade-in duration-300">
							<span
								className={cn(
									'text-[10px] font-mono font-semibold',
									isIndex
										? 'text-emerald-700 dark:text-emerald-400'
										: isExpected
											? 'text-amber-700 dark:text-amber-400'
											: 'text-red-700 dark:text-red-400',
								)}
							>
								{scan.plan}
							</span>
							{isIndex ? (
								<Badge
									className="text-[10px] border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
									variant="outline"
								>
									FAST
								</Badge>
							) : isExpected ? (
								<Badge
									className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-400"
									variant="outline"
								>
									OK
								</Badge>
							) : (
								<Badge
									className="text-[10px] border-red-500/50 text-red-700 dark:text-red-400"
									variant="outline"
								>
									SLOW
								</Badge>
							)}
						</div>
					)}
				</div>
			) : (
				<div className="h-10 flex items-center">
					<span className="text-[10px] text-muted-foreground/50 italic">
						Fire a probe to test this query
					</span>
				</div>
			)}
		</button>
	);
}

// ──────────────────────────────────────────────
// Legend (reward phase)
// ──────────────────────────────────────────────

function QueryLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Query Performance Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Zap className="w-4 h-4 text-success" />
					<span className="text-foreground">Index Scan (direct lookup)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">Seq Scan (reads every row)</span>
				</div>
			</div>
			<div className="flex items-center gap-3 mt-3 text-[10px]">
				<span className="flex items-center gap-1">
					<span className="inline-block w-2.5 h-2.5 rounded-[1px] bg-emerald-500 dark:bg-emerald-400" />
					Matched row
				</span>
				<span className="flex items-center gap-1">
					<span className="inline-block w-2.5 h-2.5 rounded-[1px] bg-red-400/80 dark:bg-red-500/60" />
					Scanned (wasted)
				</span>
				<span className="flex items-center gap-1">
					<span className="inline-block w-2.5 h-2.5 rounded-[1px] bg-zinc-200 dark:bg-zinc-700/50" />
					Not touched
				</span>
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
		minRequired: 4,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedLanes, setInspectedLanes] = useState<Set<string>>(new Set());

	// Observe animation state: per-lane scan progress (0 to GRID_SIZE)
	const [laneProgress, setLaneProgress] = useState<Record<string, number>>({});
	const [laneDone, setLaneDone] = useState<Set<string>>(new Set());
	const [isAnimating, setIsAnimating] = useState(false);
	const animationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
	const [firedProbeCount, setFiredProbeCount] = useState(0);

	// Reward state
	const [lastRewardScenarioId, setLastRewardScenarioId] = useState<
		string | null
	>(null);
	const [rewardProgress, setRewardProgress] = useState(-1);
	const [rewardDone, setRewardDone] = useState(false);

	// ── Animation helpers ──
	const clearAnimations = useCallback(() => {
		animationTimeoutsRef.current.forEach(clearTimeout);
		animationTimeoutsRef.current = [];
	}, []);

	useEffect(() => {
		return () => clearAnimations();
	}, [clearAnimations]);

	/** Run a seq scan animation on a lane (red wave sweeping through blocks) */
	const runSeqScanAnimation = useCallback(
		(
			_laneId: string,
			onProgress: (progress: number) => void,
			onDone: () => void,
		) => {
			clearAnimations();
			setIsAnimating(true);

			const steps = 14;
			const blocksPerStep = Math.ceil(GRID_SIZE / steps);
			const stepInterval = ANIMATION_DURATION_MS / steps;

			onProgress(0);

			for (let step = 1; step <= steps; step++) {
				animationTimeoutsRef.current.push(
					setTimeout(() => {
						onProgress(Math.min(step * blocksPerStep, GRID_SIZE));
					}, step * stepInterval),
				);
			}

			animationTimeoutsRef.current.push(
				setTimeout(() => {
					onDone();
					setIsAnimating(false);
				}, ANIMATION_DURATION_MS),
			);
		},
		[clearAnimations],
	);

	/** Run an index scan animation (instant match, short delay) */
	const runIndexScanAnimation = useCallback(
		(onProgress: (progress: number) => void, onDone: () => void) => {
			clearAnimations();
			setIsAnimating(true);

			// Short pause to show the index card, then reveal match
			animationTimeoutsRef.current.push(
				setTimeout(() => {
					onProgress(GRID_SIZE);
					onDone();
				}, 400),
			);

			animationTimeoutsRef.current.push(
				setTimeout(() => {
					setIsAnimating(false);
				}, ANIMATION_DURATION_MS / 2),
			);
		},
		[clearAnimations],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			const laneId = PROBE_LANE_MAP[probeId];
			if (!laneId) return;

			// Run seq scan animation for this lane
			runSeqScanAnimation(
				laneId,
				(progress) => {
					setLaneProgress((prev) => ({ ...prev, [laneId]: progress }));
				},
				() => {
					setLaneDone((prev) => new Set([...prev, laneId]));
				},
			);

			setFiredProbeCount((c) => c + 1);

			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[discoveryGating, runSeqScanAnimation],
	);

	// ── Lane click handler (observe phase, for inspectors) ──
	const handleLaneClick = useCallback(
		(laneId: string) => {
			if (phase !== 'observe' || isAnimating) return;

			const data = LANE_INSPECTOR_MAP[laneId];
			if (!data) return;

			setInspectorData(data);
			setInspectedLanes((prev) => {
				if (prev.has(laneId)) return prev;
				return new Set([...prev, laneId]);
			});
		},
		[phase, isAnimating],
	);

	// ── Schema click handler (observe phase, 4th discovery) ──
	const handleSchemaClick = useCallback(() => {
		if (phase !== 'observe' || isAnimating) return;
		setInspectorData(SCHEMA_INSPECTOR);
		discoveryGating.discover('no-indexes');
	}, [phase, isAnimating, discoveryGating]);

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

	const handleStartReward = () => {
		setPhase('reward');
		stressTest.reset();
		setLastRewardScenarioId(null);
		setRewardProgress(-1);
		setRewardDone(false);
	};

	// ── Stress test fire handler (reward phase) ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			setLastRewardScenarioId(scenarioId);
			setRewardDone(false);
			stressTest.fireRequest(scenarioId);

			const rewardData = REWARD_SCAN_DATA[scenarioId];
			if (!rewardData) return;

			if (rewardData.scanType === 'index') {
				// Index scan: show index card, then match appears instantly
				setRewardProgress(0); // triggers the index card to show
				runIndexScanAnimation(
					(progress) => setRewardProgress(progress),
					() => setRewardDone(true),
				);
			} else {
				// Seq scan: red wave sweep
				runSeqScanAnimation(
					rewardData.laneId,
					(progress) => setRewardProgress(progress),
					() => setRewardDone(true),
				);
			}
		},
		[stressTest, runSeqScanAnimation, runIndexScanAnimation],
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

	// Reward scan data for current scenario
	const rewardScan = lastRewardScenarioId
		? REWARD_SCAN_DATA[lastRewardScenarioId]
		: null;

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							GET /api/users?email=alice@example.com takes 820ms. The EXPLAIN
							output shows a sequential scan across 10,000 rows. Without
							database indexes, every query reads every row in the table.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							An index is like a book's table of contents: it lets the database
							jump directly to matching rows instead of scanning everything.
						</p>
					</div>

					{/* Observe phase: discovery checklist + hints */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
							{firedProbeCount >= 2 && !discoveryGating.isUnlocked && (
								<Alert
									className="mt-3 animate-in fade-in duration-500"
									variant="info"
								>
									<Info className="w-4 h-4" />
									<AlertDescription className="text-xs">
										{firedProbeCount >= 3 ? (
											<>
												Now click the{' '}
												<span className="font-medium">Schema</span> button to
												see why there are no indexes.
											</>
										) : (
											<>
												Click query lanes with{' '}
												<span className="font-medium">?</span> to inspect their
												SQL, or check the schema.
											</>
										)}
									</AlertDescription>
								</Alert>
							)}
						</div>
					)}

					{/* Build phase: step progress */}
					{phase === 'build' && (
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
							<QueryLegend />
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

				<div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col min-h-0">
							<div className="flex-1 overflow-auto min-h-0 p-4 space-y-3">
								{/* Query Plan Lanes with Row Grids */}
								{QUERY_LANES.map((lane) => {
									const progress = laneProgress[lane.id] ?? -1;
									return (
										<QueryPlanLane
											inspectable
											inspected={inspectedLanes.has(lane.id)}
											key={lane.id}
											lane={lane}
											onClick={() => handleLaneClick(lane.id)}
											scan={
												laneDone.has(lane.id)
													? OBSERVE_SCAN_DATA[lane.id]
													: null
											}
											scanProgress={progress}
											scanType="seq"
										/>
									);
								})}

								{/* Schema button (4th discovery) */}
								<button
									className={cn(
										'w-full flex items-center gap-2 rounded-lg border border-dashed p-3 transition-colors',
										'border-border bg-card hover:border-primary/40 hover:bg-primary/5',
										isAnimating && 'pointer-events-none opacity-50',
									)}
									disabled={isAnimating}
									onClick={handleSchemaClick}
									type="button"
								>
									<Database className="w-4 h-4 text-muted-foreground" />
									<span className="text-xs font-medium text-foreground">
										View Schema (CREATE TABLE)
									</span>
									{!discoveryGating.isDiscovered('no-indexes') && (
										<span className="ml-auto text-primary animate-pulse text-xs font-bold">
											?
										</span>
									)}
								</button>

								{/* Stage Inspector overlay */}
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
									disabled={isAnimating}
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
											hasNext
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() => stepper.completeStep()}
											onNext={handleStartReward}
											onWrong={(fb) => stepper.recordWrongAttempt(fb)}
											outputLines={runMigrationOutput}
											stepKey={stepper.currentStep}
											title="Run Migration"
										/>
									)}

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

										{isViewingCompletedStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={
														hasNextStep ? stepper.nextStep : handleStartReward
													}
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

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col min-h-0">
							<div className="flex-1 overflow-auto min-h-0 p-4 space-y-3">
								{/* Result lane showing the query plan for current scenario */}
								{rewardScan ? (
									<div className="animate-in fade-in duration-300">
										{QUERY_LANES.filter((l) => l.id === rewardScan.laneId).map(
											(lane) => (
												<QueryPlanLane
													indexData={
														rewardScan.scanType === 'index'
															? INDEX_LOOKUP_DATA[lane.id]
															: null
													}
													key={lane.id}
													labelOverride={rewardScan.labelOverride}
													lane={lane}
													scan={rewardDone ? rewardScan : null}
													scanProgress={rewardProgress}
													scanType={rewardScan.scanType}
													sqlOverride={rewardScan.sqlOverride}
												/>
											),
										)}
									</div>
								) : (
									<div className="flex-1 flex items-center justify-center py-12">
										<p className="text-sm text-muted-foreground/50 italic">
											Fire a scenario to see its EXPLAIN plan
										</p>
									</div>
								)}
							</div>

							{/* Stress test controls */}
							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={isAnimating}
									isAutoFiring={stressTest.isAutoFiring}
									onFire={handleFireScenario}
									onToggleAutoFire={() =>
										stressTest.toggleAutoFire(handleFireScenario)
									}
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
