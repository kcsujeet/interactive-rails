/**
 * Level 23: Narrow Fetching
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Data Table Heatmap visualization. A stylized
 *   database table grid shows 30 columns. When probes fire, ALL columns
 *   light up red, then the 2-3 needed columns flash green. The ratio
 *   teaches the lesson. Memory gauge shows waste.
 *
 * Phase 2 (HOW - build): 4 OptionCard steps. Pick the right fetching strategy
 *   (pluck, select, find_in_batches) for each scenario.
 *
 * Phase 3 (ADVANTAGE - reward): Same heatmap returns, now showing narrow
 *   fetches working. StressTestPanel lets player fire scenarios.
 *
 * Teaches: pluck, select, find_in_batches for memory-efficient data fetching
 */

import { ArrowRight, Database, Info, Layers, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	type ProbeConfig,
	ProbeTerminal,
} from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { cn } from '@/lib/utils';

registerLevelCode('act4-level23-narrow-fetching', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Table column schema
// ──────────────────────────────────────────────

interface TableColumn {
	id: string;
	label: string;
	/** Approximate bytes per row for this column */
	size: 'small' | 'medium' | 'large';
	/** Whether this is the collapsed "+N more" placeholder */
	collapsed?: boolean;
}

const TABLE_COLUMNS: TableColumn[] = [
	{ id: 'id', label: 'id', size: 'small' },
	{ id: 'name', label: 'name', size: 'medium' },
	{ id: 'email', label: 'email', size: 'medium' },
	{ id: 'first_name', label: 'first_name', size: 'medium' },
	{ id: 'last_name', label: 'last_name', size: 'medium' },
	{ id: 'language_id', label: 'language_id', size: 'small' },
	{ id: 'bio', label: 'bio', size: 'medium' },
	{ id: 'avatar_url', label: 'avatar_url', size: 'medium' },
	{ id: 'big_text_column', label: 'big_text_column', size: 'large' },
	{ id: 'created_at', label: 'created_at', size: 'small' },
	{ id: 'updated_at', label: 'updated_at', size: 'small' },
	{ id: 'more', label: '+19 more', size: 'small', collapsed: true },
];

const TOTAL_COLUMN_COUNT = 30;
const ROW_COUNT = 8;

// ──────────────────────────────────────────────
// Discovery definitions
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'select-star', label: 'SELECT * loads all 30 columns' },
	{ id: 'ar-overhead', label: 'Full AR objects waste memory' },
	{ id: 'batch-missing', label: 'Loading all records exhausts memory' },
	{ id: 'text-column', label: 'Large TEXT columns dominate footprint' },
];

// ──────────────────────────────────────────────
// Probe definitions
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'csv-export',
		label: 'CSV Export',
		command: 'GET /api/users/export.csv (as admin)',
		responseLines: [
			{ text: 'SELECT * FROM users;', color: 'yellow' },
			{ text: '-- 30 columns loaded, only 2 needed (id, email)', color: 'red' },
			{ text: '-- big_text_column: 75 KB per row', color: 'red' },
			{ text: 'Memory: 681 MB for 10K rows', color: 'red' },
			{ text: 'Needed: 2.35 MB (id + email only)', color: 'green' },
		],
		story: [
			'An admin exports all users to CSV for a quarterly report.',
			'The query loads all 30 columns, including a 75 KB big_text_column per row.',
			'Only id and email are needed for the export.',
			'681 MB of memory is allocated when 2.35 MB would suffice.',
		],
	},
	{
		id: 'dropdown-api',
		label: 'Dropdown',
		command: 'GET /api/categories/options (as frontend)',
		responseLines: [
			{ text: 'categories = Category.all', color: 'yellow' },
			{ text: 'categories.map { |c| [c.id, c.name] }', color: 'yellow' },
			{ text: '-- 10K ActiveRecord objects instantiated', color: 'red' },
			{ text: '-- Each object: 2.5 KB overhead for 2 values', color: 'red' },
			{ text: 'Plain arrays would use 80 bytes each', color: 'green' },
		],
		story: [
			'The frontend fetches a dropdown of categories for a product form.',
			'Category.all instantiates 10,000 full ActiveRecord objects.',
			'Each object carries 2.5 KB of overhead, but only id and name are used.',
			'Plain arrays at 80 bytes each would use a fraction of the memory.',
		],
	},
	{
		id: 'nightly-sync',
		label: 'Nightly Sync',
		command: 'rails runner NightlySyncJob.perform (as scheduler)',
		responseLines: [
			{ text: 'User.all.each { |u| SyncService.process(u) }', color: 'yellow' },
			{ text: '-- Loading 50K records into memory at once', color: 'red' },
			{ text: '-- Peak memory: 3.4 GB', color: 'red' },
			{ text: '-- Server swap triggered, OOM killer invoked', color: 'red' },
			{ text: 'Batching 1K at a time: ~50 MB constant', color: 'green' },
		],
		story: [
			'A nightly sync job processes all 50,000 users for an external system.',
			'User.all.each loads every record into memory at once.',
			'Peak memory hits 3.4 GB, triggering the OOM killer on the server.',
			'Batching 1,000 records at a time would keep memory at a steady 50 MB.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'csv-export': 'select-star',
	'dropdown-api': 'ar-overhead',
	'nightly-sync': 'batch-missing',
};

/** Which columns are "needed" per probe (shown green) */
const PROBE_NEEDED_COLUMNS: Record<string, string[]> = {
	'csv-export': ['id', 'email'],
	'dropdown-api': ['id', 'name'],
	'nightly-sync': [], // all columns needed, but batched
};

/** Memory gauge data per probe */
const PROBE_MEMORY: Record<
	string,
	{ total: string; needed: string; totalPct: number; neededPct: number }
> = {
	'csv-export': {
		total: '681 MB',
		needed: '2.35 MB',
		totalPct: 100,
		neededPct: 0.35,
	},
	'dropdown-api': {
		total: '245 MB',
		needed: '0.8 MB',
		totalPct: 36,
		neededPct: 0.12,
	},
	'nightly-sync': {
		total: '3.4 GB',
		needed: '~50 MB',
		totalPct: 100,
		neededPct: 1.5,
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (for big_text_column click)
// ──────────────────────────────────────────────

const BIG_TEXT_INSPECTOR: StageInspectorData = {
	stageId: 'big_text_column',
	title: 'big_text_column (TEXT)',
	description:
		'PostgreSQL TEXT columns can store up to 1 GB per cell. This column averages 75 KB per row.\n\n' +
		'75 KB per row x 10,000 rows = 750 MB for just one column.\n\n' +
		'A user once stored the entire U.S. Constitution in a TEXT field. ' +
		'The SELECT * forced the DB to write to disk mid-response, causing double-digit second latency for an endpoint that only needed id and name.',
	code: `# 75 KB per row in big_text_column
10_000.times { |i|
  User.create!(
    big_text_column: "..." # avg 75 KB
  )
}

# SELECT * loads ALL of it:
User.all  # 750 MB just from this column!

# SELECT id, name skips it entirely:
User.pluck(:id, :name)  # 2.35 MB total`,
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'csv-pluck',
		label: 'CSV Export',
		description: 'pluck(:id, :email) returns plain arrays',
		method: 'GET',
		path: '/api/users/export.csv',
		actor: 'admin',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'User.pluck(:id, :email)', color: 'yellow' },
			{ text: '-- 2 columns, plain arrays (no AR objects)', color: 'green' },
			{ text: 'Memory: 2.35 MB for 10K rows', color: 'green' },
		],
	},
	{
		id: 'dropdown-pluck',
		label: 'Dropdown',
		description: 'pluck(:id, :name) returns key-value pairs',
		method: 'GET',
		path: '/api/categories/options',
		actor: 'frontend',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'Category.pluck(:id, :name)', color: 'yellow' },
			{
				text: '-- 2 columns, 80 bytes per pair (no 2.5 KB objects)',
				color: 'green',
			},
			{ text: 'Memory: 0.8 MB for 10K rows', color: 'green' },
		],
	},
	{
		id: 'api-select',
		label: 'API Response',
		description: 'select(:id, :first_name, :last_name) for model methods',
		method: 'GET',
		path: '/api/users',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'User.select(:id, :first_name, :last_name)', color: 'yellow' },
			{ text: '-- 3 columns, AR objects with model methods', color: 'green' },
			{ text: 'Memory: 12.1 MB for 10K rows', color: 'green' },
		],
	},
	{
		id: 'batch-sync',
		label: 'Nightly Sync',
		description: 'find_in_batches(batch_size: 1000) processes in chunks',
		method: 'POST',
		path: '/jobs/nightly_sync',
		actor: 'scheduler',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'User.find_in_batches(batch_size: 1000)', color: 'yellow' },
			{ text: '-- Batch 1/50... Batch 2/50... processing', color: 'green' },
			{ text: 'Peak memory: ~50 MB constant (not 3.4 GB)', color: 'green' },
		],
	},
	{
		id: 'wide-fetch',
		label: 'Wide Fetch',
		description: 'User.all loads all 30 columns for 50K records',
		method: 'GET',
		path: '/api/users/all',
		actor: 'legacy_client',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'User.all', color: 'yellow' },
			{ text: '-- SELECT * FROM users (30 columns, 50K rows)', color: 'red' },
			{ text: '-- big_text_column: 75 KB per row', color: 'red' },
			{ text: 'Memory: 3.4 GB, server OOM killed', color: 'red' },
		],
	},
];

/** Which columns light up per stress scenario (reward heatmap) */
const STRESS_NEEDED_COLUMNS: Record<string, string[]> = {
	'csv-pluck': ['id', 'email'],
	'dropdown-pluck': ['id', 'name'],
	'api-select': ['id', 'first_name', 'last_name'],
	'batch-sync': [], // all columns, but batched
	'wide-fetch': [], // all columns, blocked
};

const STRESS_MEMORY: Record<string, { label: string; pct: number }> = {
	'csv-pluck': { label: '2.35 MB', pct: 0.35 },
	'dropdown-pluck': { label: '0.8 MB', pct: 0.12 },
	'api-select': { label: '12.1 MB', pct: 1.8 },
	'batch-sync': { label: '~50 MB/batch', pct: 7.3 },
	'wide-fetch': { label: '681 MB', pct: 100 },
};

// ──────────────────────────────────────────────
// Step definitions (4 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'csv-export', title: 'CSV Export Strategy' },
	{ id: 'dropdown', title: 'Dropdown Data' },
	{ id: 'batch', title: 'Batch Processing' },
	{ id: 'api-response', title: 'API Response Building' },
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
		codeContext: string;
		options: StepOption[];
	}
> = {
	0: {
		title: 'CSV Export Strategy',
		description:
			'Admin dashboard exports 50K user records to CSV. Only id and email are needed. The users table has 30 columns including a 75KB TEXT column (bio).',
		codeContext: `# Current service (slow, high memory)
class UserExport < ApplicationService
  def call
    users = User.all  # SELECT *
    csv = CSV.generate do |csv|
      users.each { |u| csv << [u.id, u.email] }
    end
    Result.new(success?: true, resource: csv, errors: [])
  end
end`,
		options: [
			{
				id: 'map-all',
				label: 'User.all.map { |u| [u.id, u.email] }',
				correct: false,
				feedback:
					'This loads full ActiveRecord objects with all 30 columns including the 75KB bio field. Massive memory waste when you only need two columns.',
			},
			{
				id: 'pluck',
				label: 'User.pluck(:id, :email)',
				correct: true,
			},
			{
				id: 'select-two',
				label: 'User.select(:id, :email)',
				correct: false,
				feedback:
					'This creates ActiveRecord objects when you only need raw data for a CSV. For simple values without model methods, there is a lighter approach that skips object creation entirely.',
			},
		],
	},
	1: {
		title: 'Dropdown Data',
		description:
			'A dropdown needs [id, name] pairs for 10K category records. No model methods are needed, just raw data for the UI.',
		codeContext: `# Current service (wasteful AR overhead)
class CategoryDropdown < ApplicationService
  def call
    # Need: [[1, "Tech"], [2, "Science"], ...]
    categories = Category.all
    pairs = categories.map { |c| [c.id, c.name] }
    Result.new(success?: true, resource: pairs, errors: [])
  end
end`,
		options: [
			{
				id: 'all',
				label: 'Category.all',
				correct: false,
				feedback:
					'Loading full ActiveRecord objects for a simple dropdown is wasteful. You instantiate AR overhead for each of 10K records when you only need two plain values.',
			},
			{
				id: 'select',
				label: 'Category.select(:id, :name)',
				correct: false,
				feedback:
					'This creates ActiveRecord objects when you only need plain data. For simple key-value pairs without model methods, there is a lighter approach.',
			},
			{
				id: 'pluck',
				label: 'Category.pluck(:id, :name)',
				correct: true,
			},
		],
	},
	2: {
		title: 'Batch Processing',
		description:
			'Processing 50K records for a nightly data sync. Each record needs model validations run on it, so you need full AR objects.',
		codeContext: `# Current service (loads all 50K records at once)
class NightlySync < ApplicationService
  def call
    User.all.each do |user|
      SyncService.process(user)  # needs validations
    end
    Result.new(success?: true, resource: nil, errors: [])
  end
end`,
		options: [
			{
				id: 'all-each',
				label: 'User.all.each { |u| process(u) }',
				correct: false,
				feedback:
					'This loads ALL 50K records into memory at once. With large datasets this will exhaust memory and crash the process.',
			},
			{
				id: 'find-in-batches',
				label:
					'User.find_in_batches(batch_size: 1000) { |batch| batch.each { |u| process(u) } }',
				correct: true,
			},
			{
				id: 'pluck-find',
				label: 'User.pluck(:id).each { |id| process(User.find(id)) }',
				correct: false,
				feedback:
					'This plucks all IDs then does an individual database query for each one, a classic N+1 problem that makes 50K extra queries.',
			},
		],
	},
	3: {
		title: 'API Response with Model Methods',
		description:
			'Building an API response that needs user.full_name, a model method that combines first_name and last_name. The table also has large TEXT columns.',
		codeContext: `class User < ApplicationRecord
  def full_name
    "#{first_name} #{last_name}"
  end
end

# Current service (loads all columns)
class UserListing < ApplicationService
  def call
    users = User.all
    data = users.map { |u|
      { id: u.id, name: u.full_name }
    }
    Result.new(success?: true, resource: data, errors: [])
  end
end`,
		options: [
			{
				id: 'pluck-manual',
				label: 'User.pluck(:first_name, :last_name).map { |f,l| "#{f} #{l}" }',
				correct: false,
				feedback:
					'This reimplements the full_name logic in the query layer. If the model method changes, you have to update it in two places. Keep model logic in the model.',
			},
			{
				id: 'all',
				label: 'User.all',
				correct: false,
				feedback:
					'This loads every column when you only need names. Wasteful, especially with large TEXT columns bloating memory.',
			},
			{
				id: 'select',
				label: 'User.select(:id, :first_name, :last_name)',
				correct: true,
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
			filename: 'app/services/user_export.rb',
			language: 'ruby',
			code: `class UserExport < ApplicationService
  Result = Data.define(:success?, :resource, :errors)

  def call
    users = User.all  # SELECT * FROM users
    csv = CSV.generate do |csv|
      users.each { |u| csv << [u.id, u.email] }
    end
    Result.new(success?: true, resource: csv, errors: [])
  end
end`,
			highlight: [5],
		});
		files.push({
			filename: 'app/services/user_listing.rb',
			language: 'ruby',
			code: `class UserListing < ApplicationService
  Result = Data.define(:success?, :resource, :errors)

  def call
    users = User.all  # SELECT * FROM users
    data = users.map { |u|
      { id: u.id, name: u.full_name }
    }
    Result.new(success?: true, resource: data, errors: [])
  end
end`,
			highlight: [5],
		});
		return files;
	}

	// Build phase: show the current scenario's context code
	if (phase === 'build') {
		const stepConfig = OPTION_STEP_CONFIG[Math.min(furthestStep, 3)];
		if (stepConfig) {
			files.push({
				filename: 'current_service.rb',
				language: 'ruby',
				code: stepConfig.codeContext,
				highlight: [],
			});
		}
		files.push({
			filename: 'benchmark_comparison.rb',
			language: 'ruby',
			code: `# Memory benchmarks (100K products, 30 columns)

# Wide fetch: loads everything
Product.all
#=> 681 MB, 149K objects allocated

# Select: partial AR objects
Product.select(:id, :title)
#=> 12.1 MB, 107K objects  (56x less)

# Pluck: plain Ruby arrays
Product.pluck(:id, :title)
#=> 2.35 MB, 45K objects   (290x less)

# Batch: constant memory
Product.find_in_batches(batch_size: 1000) { |batch|
  # ~50 MB per batch regardless of total
}`,
			highlight: [4, 8, 12, 16],
		});
		return files;
	}

	// Reward phase: show the fixed code
	files.push({
		filename: 'app/services/user_export.rb',
		language: 'ruby',
		code: `class UserExport < ApplicationService
  Result = Data.define(:success?, :resource, :errors)

  # pluck returns plain arrays (no AR objects)
  def call
    rows = User.pluck(:id, :email)
    csv = CSV.generate { |csv| rows.each { |r| csv << r } }
    Result.new(success?: true, resource: csv, errors: [])
  end
end`,
		highlight: [6],
	});
	files.push({
		filename: 'app/services/category_dropdown.rb',
		language: 'ruby',
		code: `class CategoryDropdown < ApplicationService
  Result = Data.define(:success?, :resource, :errors)

  # pluck for raw key-value pairs
  def call
    pairs = Category.pluck(:id, :name)
    Result.new(success?: true, resource: pairs, errors: [])
  end
end`,
		highlight: [6],
	});
	files.push({
		filename: 'app/services/user_listing.rb',
		language: 'ruby',
		code: `class UserListing < ApplicationService
  Result = Data.define(:success?, :resource, :errors)

  # select for model methods (skips large columns)
  def call
    users = User.select(:id, :first_name, :last_name)
    data = users.map { |u|
      { id: u.id, name: u.full_name }
    }
    Result.new(success?: true, resource: data, errors: [])
  end
end`,
		highlight: [6],
	});
	files.push({
		filename: 'app/services/nightly_sync.rb',
		language: 'ruby',
		code: `class NightlySync < ApplicationService
  Result = Data.define(:success?, :resource, :errors)

  # find_in_batches: constant memory
  def call
    User.find_in_batches(batch_size: 1000) do |batch|
      batch.each { |u| SyncService.process(u) }
    end
    Result.new(success?: true, resource: nil, errors: [])
  end
end`,
		highlight: [6],
	});

	return files;
}

// ──────────────────────────────────────────────
// Data Table Heatmap component
// ──────────────────────────────────────────────

interface HeatmapState {
	/** Which animation phase: -1=idle, 0=columns red, 1=rows fill, 2=needed green, 3=gauge */
	animPhase: number;
	/** Which columns are "needed" (green) */
	neededColumns: string[];
	/** Memory gauge data */
	memory: {
		total: string;
		needed: string;
		totalPct: number;
		neededPct: number;
	} | null;
	/** Is this a "blocked" scenario (all red, no green) */
	isBlocked: boolean;
	/** For nightly sync: show batch label instead of green columns */
	isBatched: boolean;
	/** Row counter for animation */
	rowCount: number;
}

const INITIAL_HEATMAP: HeatmapState = {
	animPhase: -1,
	neededColumns: [],
	memory: null,
	isBlocked: false,
	isBatched: false,
	rowCount: 0,
};

function DataTableHeatmap({
	state,
	mode,
	onColumnClick,
	inspectedBigText,
	inspectableBigText,
}: {
	state: HeatmapState;
	/** 'problem' = observe phase (red dominates, shows waste), 'solution' = reward phase (green dominates for allowed, red only for blocked) */
	mode: 'problem' | 'solution';
	onColumnClick?: (colId: string) => void;
	inspectedBigText?: boolean;
	inspectableBigText?: boolean;
}) {
	const isActive = state.animPhase >= 0;
	const showColumns = state.animPhase >= 0;
	const showGreen = state.animPhase >= 2 && !state.isBlocked;
	const showGauge = state.animPhase >= 3;

	// In solution mode for allowed scenarios: no red at all. Just green on neutral.
	const solutionAllowed = mode === 'solution' && !state.isBlocked;

	return (
		<div className="space-y-3">
			{/* Column headers */}
			<div className="flex gap-0.5 flex-wrap">
				{TABLE_COLUMNS.map((col) => {
					const isNeeded = showColumns && state.neededColumns.includes(col.id);
					const isBigText = col.id === 'big_text_column';
					const isClickable = isBigText && inspectableBigText && onColumnClick;

					// Color logic differs by mode
					let colorClass: string;
					if (solutionAllowed && showGreen && isNeeded) {
						// Solution allowed: needed columns glow green
						colorClass =
							'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500 text-emerald-700 dark:text-emerald-300';
					} else if (solutionAllowed) {
						// Solution allowed: non-needed columns stay neutral/dim
						colorClass = 'bg-muted border-border text-muted-foreground';
					} else if (showGreen && isNeeded) {
						// Problem mode: needed columns flash green (contrast against red)
						colorClass =
							'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500 text-emerald-700 dark:text-emerald-300';
					} else if (showColumns && isActive) {
						// Problem mode (or solution blocked): all columns red
						colorClass =
							'bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300';
					} else {
						colorClass = 'bg-muted border-border text-muted-foreground';
					}

					return (
						<button
							className={cn(
								'relative px-1.5 py-1 text-[10px] font-mono rounded border transition-all transition-colors duration-300',
								isBigText
									? 'min-w-[100px]'
									: col.collapsed
										? 'min-w-[60px]'
										: 'min-w-[56px]',
								colorClass,
								isClickable &&
									!inspectedBigText &&
									'cursor-pointer hover:ring-2 hover:ring-primary/50',
								isClickable && inspectedBigText && 'cursor-default',
							)}
							disabled={!isClickable}
							key={col.id}
							onClick={isClickable ? () => onColumnClick(col.id) : undefined}
							type="button"
						>
							{col.label}
							{isBigText && inspectableBigText && !inspectedBigText && (
								<span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center animate-pulse">
									?
								</span>
							)}
							{isBigText && (
								<span
									className={cn(
										'block text-[8px] mt-0.5',
										showColumns && isActive && !solutionAllowed
											? 'text-red-500 dark:text-red-400'
											: 'text-muted-foreground',
									)}
								>
									75 KB/row
								</span>
							)}
						</button>
					);
				})}
			</div>

			{/* Column count indicator */}
			<div className="text-[10px] text-muted-foreground font-mono text-right">
				{solutionAllowed && showGreen && state.neededColumns.length > 0 ? (
					<span className="text-emerald-600 dark:text-emerald-400 font-bold">
						{state.neededColumns.length} columns fetched
					</span>
				) : solutionAllowed && state.isBatched && showGreen ? (
					<span className="text-primary font-bold">
						All columns, batched 1K at a time
					</span>
				) : isActive &&
					!state.isBlocked &&
					state.neededColumns.length > 0 &&
					showGreen ? (
					<span>
						<span className="text-emerald-600 dark:text-emerald-400 font-bold">
							{state.neededColumns.length} needed
						</span>
						{' / '}
						<span className="text-red-500 dark:text-red-400">
							{TOTAL_COLUMN_COUNT} loaded
						</span>
					</span>
				) : state.isBatched && showGreen ? (
					<span className="text-primary font-bold">
						All columns, batched 1K at a time
					</span>
				) : isActive ? (
					<span className="text-red-500 dark:text-red-400 font-bold">
						{TOTAL_COLUMN_COUNT} columns loaded via SELECT *
					</span>
				) : (
					`${TOTAL_COLUMN_COUNT} columns total`
				)}
			</div>

			{/* Row indicator bars */}
			<div className="space-y-1">
				{Array.from({ length: ROW_COUNT }).map((_, i) => {
					const showRow = state.animPhase >= 1 && i < state.rowCount;
					return (
						<div
							className={cn(
								'h-2 rounded-full transition-all duration-300',
								showRow && solutionAllowed
									? 'bg-emerald-400/30 dark:bg-emerald-500/20'
									: showRow && !state.isBlocked && showGreen
										? 'bg-emerald-400/30 dark:bg-emerald-500/20'
										: showRow
											? 'bg-red-400/30 dark:bg-red-500/20'
											: 'bg-muted',
							)}
							// biome-ignore lint/suspicious/noArrayIndexKey: rows are fixed-position indicator bars; index is identity
							key={i}
						/>
					);
				})}
				<div className="text-[10px] text-muted-foreground font-mono text-right">
					{state.animPhase >= 1 && state.rowCount > 0
						? state.isBatched && (showGreen || solutionAllowed)
							? 'Batch 1/50 (1,000 rows)'
							: `${state.rowCount.toLocaleString()}${state.rowCount >= 10000 ? '+' : ''} rows`
						: `10K-50K rows`}
				</div>
			</div>

			{/* Memory gauge */}
			{state.memory && (
				<div className="space-y-1.5 pt-1 border-t border-border">
					{solutionAllowed ? (
						/* Solution allowed: single green gauge only */
						showGauge && (
							<div className="flex items-center gap-2 animate-in fade-in duration-300">
								<div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
									<div className="h-full rounded-full bg-emerald-500 dark:bg-emerald-600 transition-all duration-700 max-w-[3%] min-w-[2px]" />
								</div>
								<span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 w-24 text-right">
									{state.memory.needed}
								</span>
							</div>
						)
					) : (
						/* Problem mode or solution blocked: red gauge (+ green comparison in problem mode) */
						<>
							<div className="flex items-center gap-2">
								<div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
									<div
										className={cn(
											'h-full rounded-full transition-all',
											showGauge ? 'duration-700 w-full' : 'duration-0 w-0',
											!showGreen
												? 'bg-red-500 dark:bg-red-600'
												: 'bg-red-400/20 dark:bg-red-500/15',
										)}
									/>
								</div>
								<span
									className={cn(
										'text-[10px] font-mono w-24 text-right',
										!showGreen
											? 'text-red-500 dark:text-red-400'
											: 'text-red-400/60 dark:text-red-500/40',
									)}
								>
									{showGauge
										? showGreen
											? `${state.memory.total} wasted`
											: state.memory.total
										: ''}
								</span>
							</div>
							{showGreen && (
								<div className="flex items-center gap-2 animate-in fade-in duration-300">
									<div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
										<div className="h-full rounded-full bg-emerald-500 dark:bg-emerald-600 transition-all duration-700 max-w-[3%] min-w-[2px]" />
									</div>
									<span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 w-24 text-right">
										{state.memory.needed}
									</span>
								</div>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level23NarrowFetching({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');

	// ── Animation state ──
	const [isAnimating, setIsAnimating] = useState(false);
	const [heatmapState, setHeatmapState] =
		useState<HeatmapState>(INITIAL_HEATMAP);
	const animationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
	const [firedProbeCount, setFiredProbeCount] = useState(0);

	// ── StageInspector state ──
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedBigText, setInspectedBigText] = useState(false);

	// ── Reward heatmap state ──
	const [rewardHeatmap, setRewardHeatmap] =
		useState<HeatmapState>(INITIAL_HEATMAP);

	const clearAnimations = useCallback(() => {
		for (const t of animationTimeoutsRef.current) clearTimeout(t);
		animationTimeoutsRef.current = [];
	}, []);

	useEffect(() => {
		return () => clearAnimations();
	}, [clearAnimations]);

	// ── Observe phase: run heatmap animation on probe ──
	const runObserveAnimation = useCallback(
		(probeId: string) => {
			clearAnimations();
			setIsAnimating(true);

			const neededCols = PROBE_NEEDED_COLUMNS[probeId] ?? [];
			const memory = PROBE_MEMORY[probeId] ?? null;
			const isBatched = probeId === 'nightly-sync';

			// Phase 0: all columns turn red (staggered via CSS transition)
			setHeatmapState({
				animPhase: 0,
				neededColumns: neededCols,
				memory,
				isBlocked: false,
				isBatched,
				rowCount: 0,
			});

			// Phase 1: rows fill up (after ANIMATION_DURATION_MS)
			const rowInterval = 150;
			const totalRows = isBatched ? 8 : 8;
			animationTimeoutsRef.current.push(
				setTimeout(() => {
					setHeatmapState((prev) => ({ ...prev, animPhase: 1 }));
					// Animate row counter
					for (let r = 1; r <= totalRows; r++) {
						animationTimeoutsRef.current.push(
							setTimeout(() => {
								const count = isBatched
									? Math.round((50000 / totalRows) * r)
									: Math.round((10000 / totalRows) * r);
								setHeatmapState((prev) => ({ ...prev, rowCount: count }));
							}, r * rowInterval),
						);
					}
				}, ANIMATION_DURATION_MS),
			);

			// Phase 2: needed columns flash green (after 2 * ANIMATION_DURATION_MS)
			animationTimeoutsRef.current.push(
				setTimeout(() => {
					setHeatmapState((prev) => ({ ...prev, animPhase: 2 }));
				}, 2 * ANIMATION_DURATION_MS),
			);

			// Phase 3: memory gauge fills (after 3 * ANIMATION_DURATION_MS)
			animationTimeoutsRef.current.push(
				setTimeout(() => {
					setHeatmapState((prev) => ({ ...prev, animPhase: 3 }));
				}, 3 * ANIMATION_DURATION_MS),
			);

			// Unlock after 4 * ANIMATION_DURATION_MS
			animationTimeoutsRef.current.push(
				setTimeout(() => {
					setIsAnimating(false);
				}, 4 * ANIMATION_DURATION_MS),
			);
		},
		[clearAnimations],
	);

	// ── Reward phase: run heatmap animation on stress test fire ──
	const runRewardAnimation = useCallback(
		(scenarioId: string) => {
			clearAnimations();
			setIsAnimating(true);

			const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			if (!scenario) return;

			const neededCols = STRESS_NEEDED_COLUMNS[scenarioId] ?? [];
			const memData = STRESS_MEMORY[scenarioId];
			const isBlocked = scenario.expectedResult === 'blocked';
			const isBatched = scenarioId === 'batch-sync';

			// Phase 0: columns light up
			// For allowed: show 681 MB (what SELECT * would load) vs actual narrow amount
			// For blocked: show 681 MB as the actual load
			setRewardHeatmap({
				animPhase: 0,
				neededColumns: neededCols,
				memory: {
					total: '681 MB',
					needed: memData?.label ?? '',
					totalPct: 100,
					neededPct: memData?.pct ?? 0,
				},
				isBlocked,
				isBatched,
				rowCount: 0,
			});

			// Phase 1: rows
			animationTimeoutsRef.current.push(
				setTimeout(() => {
					setRewardHeatmap((prev) => ({
						...prev,
						animPhase: 1,
						rowCount: isBatched ? 1000 : 10000,
					}));
				}, ANIMATION_DURATION_MS * 0.5),
			);

			// Phase 2: green/red columns
			animationTimeoutsRef.current.push(
				setTimeout(() => {
					setRewardHeatmap((prev) => ({ ...prev, animPhase: 2 }));
				}, ANIMATION_DURATION_MS),
			);

			// Phase 3: gauge
			animationTimeoutsRef.current.push(
				setTimeout(() => {
					setRewardHeatmap((prev) => ({ ...prev, animPhase: 3 }));
				}, ANIMATION_DURATION_MS * 1.5),
			);

			// Unlock
			animationTimeoutsRef.current.push(
				setTimeout(() => {
					setIsAnimating(false);
				}, 2 * ANIMATION_DURATION_MS),
			);
		},
		[clearAnimations],
	);

	// ── Probe handler ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setFiredProbeCount((c) => c + 1);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
			runObserveAnimation(probeId);
		},
		[discoveryGating, runObserveAnimation],
	);

	// ── Column click handler (big_text_column) ──
	const handleColumnClick = useCallback(
		(colId: string) => {
			if (phase !== 'observe' || isAnimating) return;
			if (colId === 'big_text_column') {
				setInspectorData(BIG_TEXT_INSPECTOR);
				setInspectedBigText(true);
				discoveryGating.discover('text-column');
			}
		},
		[phase, isAnimating, discoveryGating],
	);

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			runRewardAnimation(scenarioId);
		},
		[stressTest, runRewardAnimation],
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
		return { valid: true, message: 'All scenarios mastered!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your Rails app is running out of memory in production. Multiple
							endpoints use{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								SELECT *
							</code>{' '}
							when they only need a few columns. The users table has 30 columns
							including a 75KB TEXT field.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							{phase === 'observe'
								? 'Fire probes to see how much data gets loaded. Click column headers to inspect the worst offenders.'
								: phase === 'reward'
									? 'Test your narrow fetching strategies. Watch the heatmap show efficient vs wasteful fetches.'
									: 'Choose the right strategy for each scenario: pluck for raw values, select for model methods, find_in_batches for huge datasets.'}
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
							{/* Progressive hint */}
							{firedProbeCount >= 2 && !discoveryGating.isUnlocked && (
								<Alert
									className="mt-3 animate-in fade-in duration-500"
									variant="info"
								>
									<Info className="w-4 h-4" />
									<AlertDescription className="text-xs">
										Click the{' '}
										<span className="font-medium">big_text_column</span> header
										to see why TEXT columns dominate the memory footprint.
									</AlertDescription>
								</Alert>
							)}
						</div>
					)}

					{/* Build phase: step progress */}
					{phase === 'build' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Scenarios
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
						<div className="p-4 border-b border-border space-y-3">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Fetch Results
							</div>
							<div className="grid grid-cols-2 gap-2">
								<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-center">
									<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
										{stressTest.allowedCount}
									</div>
									<div className="text-[10px] text-muted-foreground">
										Efficient
									</div>
								</div>
								<div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-center">
									<div className="text-lg font-bold text-red-500 dark:text-red-400">
										{stressTest.blockedCount}
									</div>
									<div className="text-[10px] text-muted-foreground">
										Blocked
									</div>
								</div>
							</div>
							<div className="space-y-1.5 text-[10px]">
								<div className="flex items-center gap-1.5">
									<div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500" />
									<span className="text-muted-foreground">
										Narrow fetch (efficient)
									</span>
								</div>
								<div className="flex items-center gap-1.5">
									<div className="w-3 h-3 rounded bg-red-500/30 border border-red-500" />
									<span className="text-muted-foreground">
										Wide fetch (blocked)
									</span>
								</div>
							</div>
						</div>
					)}

					{/* Decision tree (visible in build+) */}
					{phase !== 'observe' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Decision Tree
							</div>
							<pre className="text-xs text-muted-foreground bg-secondary p-3 rounded overflow-x-auto leading-relaxed">
								{`Need model methods?
\u251C\u2500 No  \u2192 pluck (lightest)
\u2514\u2500 Yes
   \u251C\u2500 Few records \u2192 select
   \u2514\u2500 10K+ records
      \u2514\u2500 find_in_batches + select`}
							</pre>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Narrow Fetching"
					levelNumber={23}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col overflow-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									Data Table Heatmap: SELECT * Waste
								</div>
								<span className="text-xs font-mono text-destructive font-bold">
									{TOTAL_COLUMN_COUNT} columns, 10K+ rows
								</span>
							</div>

							{/* Heatmap visualization */}
							<div className="px-6 py-3">
								<div className="max-w-2xl mx-auto">
									<DataTableHeatmap
										inspectableBigText
										inspectedBigText={inspectedBigText}
										mode="problem"
										onColumnClick={handleColumnClick}
										state={heatmapState}
									/>
								</div>
							</div>

							{/* ProbeTerminal */}
							<div className="px-6 py-2 flex-shrink-0">
								<div className="max-w-2xl mx-auto">
									<ProbeTerminal
										disabled={isAnimating}
										onProbe={handleProbe}
										probes={PROBES}
										title="Endpoint Probe"
									/>
								</div>
							</div>

							{/* Build the Fix button */}
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

							{/* StageInspector overlay */}
							{inspectorData && (
								<StageInspector
									data={inspectorData}
									onClose={() => setInspectorData(null)}
								/>
							)}
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && currentOptionConfig && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
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
												hasNextStep
													? stepper.nextStep
													: () => {
															setPhase('reward');
															stressTest.reset();
														}
											}
											size="sm"
										>
											Next Step
											<ArrowRight className="w-4 h-4" />
										</Button>
									</div>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Reward ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col overflow-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									Narrow Fetching: Stress Test
								</div>
								{rewardHeatmap.animPhase >= 2 && rewardHeatmap.isBlocked && (
									<Badge
										className="text-[10px] border-red-500/50 text-red-500 dark:text-red-400 animate-in fade-in duration-300"
										variant="outline"
									>
										BLOCKED
									</Badge>
								)}
							</div>

							{/* Reward heatmap */}
							<div className="px-6 py-3">
								<div className="max-w-2xl mx-auto">
									<DataTableHeatmap mode="solution" state={rewardHeatmap} />
								</div>
							</div>

							{/* StressTestPanel */}
							<div className="px-6 py-2 flex-shrink-0">
								<div className="max-w-2xl mx-auto">
									<StressTestPanel
										allowedCount={stressTest.allowedCount}
										blockedCount={stressTest.blockedCount}
										canAutoFire={stressTest.canAutoFire}
										disabled={isAnimating}
										isAutoFiring={stressTest.isAutoFiring}
										onFire={handleFireScenario}
										onToggleAutoFire={stressTest.toggleAutoFire}
										results={stressTest.results}
										scenarios={STRESS_SCENARIOS}
									/>
								</div>
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)}>
					{/* Quick reference (visible in all phases) */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
							When to Use Each
						</div>
						<div className="space-y-3 text-xs">
							<div>
								<div className="flex items-center gap-1.5 text-success font-medium mb-1">
									<Zap className="w-3 h-3" />
									pluck
								</div>
								<p className="text-muted-foreground">
									Need raw values (dropdowns, CSV, IDs). No model methods
									needed. Returns plain Ruby arrays.
								</p>
							</div>
							<div>
								<div className="flex items-center gap-1.5 text-warning font-medium mb-1">
									<Database className="w-3 h-3" />
									select
								</div>
								<p className="text-muted-foreground">
									Need model methods or associations but not all columns.
									Returns lightweight AR objects.
								</p>
							</div>
							<div>
								<div className="flex items-center gap-1.5 text-primary font-medium mb-1">
									<Layers className="w-3 h-3" />
									find_in_batches
								</div>
								<p className="text-muted-foreground">
									Processing huge datasets. Loads fixed-size chunks so memory
									stays constant regardless of total rows.
								</p>
							</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level23NarrowFetching;
