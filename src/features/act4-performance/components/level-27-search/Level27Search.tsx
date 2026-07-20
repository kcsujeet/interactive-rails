/**
 * Level 27: Search
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): "Document Search Grid" visualization.
 *   A single products table shown as a grid of 100 row blocks.
 *   LIKE search: red wave sweeps through ALL blocks (sequential scan),
 *   then matched blocks turn green. Badges show: no stemming, no ranking.
 *   Player fires 3 search probes and clicks "View Controller Code" to
 *   discover 4 problems. Discovery gating controls "Build the Fix".
 *
 * Phase 2 (HOW - build): 6 steps building pg_search full-text search:
 *   Step 0: bundle add pg_search (terminal)
 *   Step 1: Generate migration for tsvector + GIN index (terminal)
 *   Step 2: rails db:migrate (terminal)
 *   Step 3: Include PgSearch::Model in Product (OptionCard)
 *   Step 4: Configure pg_search_scope (OptionCard)
 *   Step 5: Update the service to use the search scope (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Same grid returns. GIN Index Card appears
 *   (inverted index showing stemmed terms -> row IDs). Matching blocks go
 *   green instantly (no red wave). The contrast teaches what a GIN index
 *   does: skip the scan, look up terms, jump to matching documents.
 *
 * Teaches: tsvector, tsquery, GIN indexes, pg_search gem, stemming, ranking
 */

import {
	ArrowRight,
	FileCode,
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

registerLevelCode('act4-level27-search', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Row grid config (visual representation of table rows)
// ──────────────────────────────────────────────

const GRID_SIZE = 100; // 20x5 grid of blocks

// ──────────────────────────────────────────────
// Scan result types
// ──────────────────────────────────────────────

interface SearchScanResult {
	scanType: 'seq' | 'gin' | 'blocked';
	plan: string;
	time: string;
	rowsScanned: number;
	totalRows: number;
	matchCount: number;
	ranked: boolean;
	stemmed: boolean;
}

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'seq-scan', label: 'LIKE forces a sequential scan (3,200ms)' },
	{ id: 'no-stemming', label: '"running" does not match "run"' },
	{ id: 'no-ranking', label: 'Results have no relevance ranking' },
	{ id: 'controller-like', label: 'Controller uses raw LIKE query' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'search-rails',
		label: 'Search "rails"',
		command: 'GET /api/products?q=rails (50K rows)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: 'Seq Scan on products (cost=0.00..1250.00)', color: 'red' },
			{
				text: "Filter: (name ~~ '%rails%' OR description ~~ '%rails%')",
				color: 'muted',
			},
			{ text: 'Rows Removed by Filter: 49,500', color: 'muted' },
			{ text: 'Execution Time: 3,200ms', color: 'red' },
		],
		story: [
			'A customer searches for "rails" in the product catalog.',
			'PostgreSQL runs a sequential scan across 50,000 rows using LIKE.',
			'Every row is checked for a substring match, discarding 49,500 non-matches.',
			'The search takes 3.2 seconds because LIKE cannot use an index.',
		],
	},
	{
		id: 'search-running',
		label: 'Search "running"',
		command: 'GET /api/products?q=running (stemming test)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: '0 results for "running"', color: 'red' },
			{
				text: 'Trail Shoe ("built to run on rough terrain") not found.',
				color: 'muted',
			},
			{ text: 'LIKE has no stemming: "running" != "run"', color: 'red' },
		],
		story: [
			'A customer searches for "running" expecting to find the Trail Shoe, described as "built to run on rough terrain."',
			'LIKE performs exact substring matching with no linguistic awareness.',
			'The word "running" is not a substring of "run", so LIKE never matches it.',
			'The search returns 0 results, even though a relevant product exists.',
		],
	},
	{
		id: 'search-database',
		label: 'Search "database"',
		command: 'GET /api/products?q=database (ranking test)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: 'Results returned in insertion order, not relevance.',
				color: 'red',
			},
			{
				text: 'A name match and a description mention are ranked equally.',
				color: 'muted',
			},
			{ text: 'No relevance scoring with LIKE queries.', color: 'red' },
		],
		story: [
			'A customer searches for "database" to find the most relevant product.',
			'LIKE returns matches in insertion order, not by relevance.',
			'A product with "database" in the name ranks the same as one with a passing mention.',
			'Without relevance scoring, the best results are buried in the list.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'search-rails': 'seq-scan',
	'search-running': 'no-stemming',
	'search-database': 'no-ranking',
};

// Match positions per probe (which blocks in the grid light up as matches)
const OBSERVE_GRID_MATCHES: Record<string, number[]> = {
	// 6 products about "rails", scattered through the table
	'search-rails': [8, 23, 41, 56, 72, 87],
	// 0 matches: LIKE has no stemming, "running" != "run"
	'search-running': [],
	// 7 products about "database"
	'search-database': [3, 15, 31, 47, 62, 78, 91],
};

// Observe scan data per probe
const OBSERVE_SCAN_DATA: Record<string, SearchScanResult> = {
	'search-rails': {
		scanType: 'seq',
		plan: 'Seq Scan on products (LIKE)',
		time: '3,200ms',
		rowsScanned: 50000,
		totalRows: 50000,
		matchCount: 6,
		ranked: false,
		stemmed: false,
	},
	'search-running': {
		scanType: 'seq',
		plan: 'Seq Scan on products (LIKE)',
		time: '3,200ms',
		rowsScanned: 50000,
		totalRows: 50000,
		matchCount: 0,
		ranked: false,
		stemmed: false,
	},
	'search-database': {
		scanType: 'seq',
		plan: 'Seq Scan on products (LIKE)',
		time: '3,200ms',
		rowsScanned: 50000,
		totalRows: 50000,
		matchCount: 7,
		ranked: false,
		stemmed: false,
	},
};

// ──────────────────────────────────────────────
// Controller inspector (observe phase, 4th discovery)
// ──────────────────────────────────────────────

const CONTROLLER_INSPECTOR: StageInspectorData = {
	stageId: 'controller',
	title: 'ProductSearch Service (Search Logic)',
	description:
		'The service builds a raw LIKE query with leading wildcards. This forces PostgreSQL into a sequential scan on every search, regardless of indexes. No stemming, no ranking.',
	code: `class ProductSearch < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def initialize(query:)
    @query = query
  end

  def call
    validation = SearchContract.new.call(query: @query)
    return Result.new(...) if validation.failure?

    products = Product.where(
      "name LIKE :q OR description LIKE :q",
      q: "%#{@query}%"
    )
    Result.new(success?: true, products: products, errors: [])
  end
end

# Problems:
# 1. LIKE '%query%' cannot use B-tree indexes
# 2. No stemming: "running" won't match "run"
# 3. No ranking: name match = description match`,
};

// ──────────────────────────────────────────────
// GIN Index data (reward phase)
// ──────────────────────────────────────────────

interface GinIndexEntry {
	term: string;
	rows: string;
	highlight?: boolean;
}

const GIN_INDEX_DATA: Record<
	string,
	{ name: string; entries: GinIndexEntry[] }
> = {
	'exact-term': {
		name: 'products_searchable_idx (GIN)',
		entries: [
			{ term: "'postgresql'", rows: 'rows #31, #47' },
			{
				term: "'rail'",
				rows: 'rows #8, #23, #41, #56, #72, #87',
				highlight: true,
			},
			{ term: "'rubi'", rows: 'rows #2, #15, #56' },
			{ term: "'test'", rows: 'rows #12, #34, #67' },
			{ term: '...', rows: '(12,847 more stems)' },
		],
	},
	'stemmed-term': {
		name: 'products_searchable_idx (GIN)',
		entries: [
			{ term: "'result'", rows: 'rows #12, #67' },
			{ term: "'run'", rows: 'rows #5, #19, #44', highlight: true },
			{ term: "'rspec'", rows: 'rows #19, #44' },
			{ term: "'test'", rows: 'rows #12, #34, #67' },
			{ term: '...', rows: '(12,847 more stems)' },
		],
	},
	'ranked-results': {
		name: 'products_searchable_idx (GIN)',
		entries: [
			{ term: "'data'", rows: 'rows #3, #15, #78' },
			{
				term: "'databas'",
				rows: 'rows #3, #15, #31, #47, #62, #78, #91',
				highlight: true,
			},
			{ term: "'design'", rows: 'rows #22, #45' },
			{ term: "'devop'", rows: 'rows #9, #38' },
			{ term: '...', rows: '(12,847 more stems)' },
		],
	},
	'multi-word': {
		name: 'products_searchable_idx (GIN)',
		entries: [
			{
				term: "'rubi'",
				rows: 'rows #2, #15, #23, #56',
				highlight: true,
			},
			{
				term: "'test'",
				rows: 'rows #12, #23, #34, #56, #67',
				highlight: true,
			},
			{ term: 'AND intersection', rows: 'rows #23, #56' },
			{ term: '...', rows: '(12,847 more stems)' },
		],
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'exact-term',
		label: 'Search exact term',
		description: 'Search for "rails" with GIN index',
		method: 'GET',
		path: '/api/products?q=rails',
		actor: 'user',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Bitmap Heap Scan using products_searchable_idx',
				color: 'green',
			},
			{ text: "  Index Cond: searchable @@ 'rail'", color: 'yellow' },
			{ text: '  Rows: 6 of 50,000 (GIN lookup)', color: 'green' },
			{ text: '  Execution Time: 1.8ms (was 3,200ms)', color: 'green' },
		],
	},
	{
		id: 'stemmed-term',
		label: 'Stemmed search',
		description: '"running" matches "run" via stemming',
		method: 'GET',
		path: '/api/products?q=running',
		actor: 'user',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Bitmap Heap Scan using products_searchable_idx',
				color: 'green',
			},
			{
				text: "  Index Cond: searchable @@ 'run' (stemmed from 'running')",
				color: 'yellow',
			},
			{ text: '  Rows: 3 matched via English stemming', color: 'green' },
			{ text: '  Execution Time: 1.5ms', color: 'green' },
		],
	},
	{
		id: 'ranked-results',
		label: 'Ranked results',
		description: 'Frequent matches ranked higher than passing mentions',
		method: 'GET',
		path: '/api/products?q=database',
		actor: 'user',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Bitmap Heap Scan using products_searchable_idx',
				color: 'green',
			},
			{
				text: "  ts_rank(searchable, 'databas'): frequent > passing",
				color: 'yellow',
			},
			{ text: '  Rows: 7, sorted by relevance', color: 'green' },
			{ text: '  Execution Time: 2.1ms (was 3,200ms)', color: 'green' },
		],
	},
	{
		id: 'multi-word',
		label: 'Multi-word query',
		description: '"ruby testing" uses tsquery AND',
		method: 'GET',
		path: '/api/products?q=ruby+testing',
		actor: 'user',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Bitmap Heap Scan using products_searchable_idx',
				color: 'green',
			},
			{
				text: "  Index Cond: searchable @@ 'rubi' & 'test'",
				color: 'yellow',
			},
			{ text: '  Rows: 2 (AND intersection)', color: 'green' },
			{ text: '  Execution Time: 1.2ms', color: 'green' },
		],
	},
	{
		id: 'empty-query',
		label: 'Empty search blocked',
		description: 'Empty query string rejected',
		method: 'GET',
		path: '/api/products?q=',
		actor: 'user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'HTTP/1.1 422 Unprocessable Entity', color: 'red' },
			{ text: '  params[:q] is blank, search skipped', color: 'yellow' },
			{ text: '  No database query executed', color: 'green' },
		],
	},
	{
		id: 'sql-injection',
		label: 'SQL injection blocked',
		description: 'Malicious query safely parameterized',
		method: 'GET',
		path: "/api/products?q=' OR 1=1--",
		actor: 'attacker',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{
				text: "  plainto_tsquery sanitized input: '1' & '1'",
				color: 'green',
			},
			{ text: '  0 results (no matching stems)', color: 'green' },
			{ text: '  SQL injection attempt safely neutralized', color: 'green' },
		],
	},
];

// Reward grid matches per scenario
const REWARD_GRID_MATCHES: Record<string, number[]> = {
	'exact-term': [8, 23, 41, 56, 72, 87],
	'stemmed-term': [5, 19, 44],
	'ranked-results': [15, 3, 31, 47, 62, 78, 91],
	'multi-word': [23, 56],
	'empty-query': [],
	'sql-injection': [],
};

// Reward scan data per scenario
const REWARD_SCAN_DATA: Record<string, SearchScanResult> = {
	'exact-term': {
		scanType: 'gin',
		plan: 'Bitmap Heap Scan using products_searchable_idx',
		time: '1.8ms',
		rowsScanned: 6,
		totalRows: 50000,
		matchCount: 6,
		ranked: true,
		stemmed: false,
	},
	'stemmed-term': {
		scanType: 'gin',
		plan: 'Bitmap Heap Scan using products_searchable_idx',
		time: '1.5ms',
		rowsScanned: 3,
		totalRows: 50000,
		matchCount: 3,
		ranked: true,
		stemmed: true,
	},
	'ranked-results': {
		scanType: 'gin',
		plan: 'Bitmap Heap Scan using products_searchable_idx',
		time: '2.1ms',
		rowsScanned: 7,
		totalRows: 50000,
		matchCount: 7,
		ranked: true,
		stemmed: false,
	},
	'multi-word': {
		scanType: 'gin',
		plan: 'Bitmap Heap Scan using products_searchable_idx',
		time: '1.2ms',
		rowsScanned: 2,
		totalRows: 50000,
		matchCount: 2,
		ranked: true,
		stemmed: false,
	},
	'empty-query': {
		scanType: 'blocked',
		plan: 'Query rejected (empty input)',
		time: '0ms',
		rowsScanned: 0,
		totalRows: 50000,
		matchCount: 0,
		ranked: false,
		stemmed: false,
	},
	'sql-injection': {
		scanType: 'blocked',
		plan: 'Input sanitized by plainto_tsquery',
		time: '0.3ms',
		rowsScanned: 0,
		totalRows: 50000,
		matchCount: 0,
		ranked: false,
		stemmed: false,
	},
};

// ──────────────────────────────────────────────
// Step definitions (6 steps: 3 terminal + 3 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'install-gem', title: 'Install Search Gem' },
	{ id: 'generate-migration', title: 'Generate Search Column' },
	{ id: 'run-migration', title: 'Run Migration' },
	{ id: 'include-module', title: 'Include Search Module' },
	{ id: 'configure-scope', title: 'Define Search Scope' },
	{ id: 'update-service', title: 'Update Service' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add pg_search
	'terminal', // 1: rails generate migration
	'terminal', // 2: rails db:migrate
	'option', // 3: include PgSearch::Model
	'option', // 4: pg_search_scope config
	'option', // 5: controller search action
];

// ──────────────────────────────────────────────
// Step 0: Install Search Gem (Terminal)
// ──────────────────────────────────────────────

const installGemCommands: TerminalCommand[] = [
	{
		id: 'wrong-gem-install',
		label: 'gem install pg_search',
		command: 'gem install pg_search',
		correct: false,
		feedback:
			'That installs the gem system-wide, not into your project. You need it in the Gemfile so the app can load it.',
	},
	{
		id: 'wrong-elasticsearch',
		label: 'bundle add elasticsearch-model',
		command: 'bundle add elasticsearch-model',
		correct: false,
		feedback:
			'Elasticsearch is a separate search engine. PostgreSQL has built-in full-text search that handles most needs without extra infrastructure.',
	},
	{
		id: 'correct',
		label: 'bundle add pg_search',
		command: 'bundle add pg_search',
		correct: true,
	},
];

const installGemOutput: TerminalOutputLine[] = [
	{ text: 'Fetching pg_search 2.3.7', color: 'cyan' },
	{ text: 'Installing pg_search 2.3.7', color: 'muted' },
	{ text: 'Bundle complete! 14 Gemfile dependencies.', color: 'green' },
];

// ──────────────────────────────────────────────
// Step 1: Generate Migration (Terminal)
// ──────────────────────────────────────────────

const generateMigrationCommands: TerminalCommand[] = [
	{
		id: 'wrong-model-gen',
		label: 'rails generate model SearchIndex',
		command: 'rails generate model SearchIndex',
		correct: false,
		feedback:
			'Full-text search does not need a separate model. You add a search column and index to the existing products table via a migration.',
	},
	{
		id: 'correct',
		label: 'rails generate migration AddSearchToProducts',
		command: 'rails generate migration AddSearchToProducts',
		correct: true,
	},
	{
		id: 'wrong-string-col',
		label: 'rails generate migration AddSearchToProducts searchable:string',
		command: 'rails generate migration AddSearchToProducts searchable:string',
		correct: false,
		feedback:
			'A plain text column cannot store parsed search documents and cannot back a GIN index. Full-text search needs the specialized column type Postgres provides for it.',
	},
];

const generateMigrationOutput: TerminalOutputLine[] = [
	{
		text: '      create  db/migrate/20240101_add_search_to_products.rb',
		color: 'green',
	},
];

// ──────────────────────────────────────────────
// Step 2: Run Migration (Terminal) - NEW
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
			'That loads seed data. You need to apply the migration that creates the search column and index.',
	},
];

const runMigrationOutput: TerminalOutputLine[] = [
	{
		text: '== AddSearchToProducts: migrating =============================',
		color: 'muted',
	},
	{
		text: '-- add_column(:products, :searchable, :tsvector)',
		color: 'green',
	},
	{ text: '   -> 0.0038s', color: 'muted' },
	{
		text: '-- add_index(:products, :searchable, {:using=>:gin})',
		color: 'green',
	},
	{ text: '   -> 0.0072s', color: 'muted' },
	{
		text: '== AddSearchToProducts: migrated (0.0110s) ====================',
		color: 'green',
	},
];

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: installGemCommands, outputLines: installGemOutput },
	{ commands: generateMigrationCommands, outputLines: generateMigrationOutput },
	{ commands: runMigrationCommands, outputLines: runMigrationOutput },
	null, // step 3: OptionCard
	null, // step 4: OptionCard
	null, // step 5: OptionCard
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

// Step 3: Include PgSearch in Model
const INCLUDE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-concern',
		label: 'include Searchable',
		correct: false,
		feedback:
			'That would require a custom concern you have not defined. The gem provides its own module to include.',
	},
	{
		id: 'correct',
		label: 'include PgSearch::Model',
		correct: true,
	},
	{
		id: 'wrong-ar',
		label: 'include ActiveRecord::FullTextSearch',
		correct: false,
		feedback:
			'ActiveRecord does not have a built-in FullTextSearch module. The gem provides the integration layer.',
	},
];

// Step 4: Configure pg_search_scope
// The migration already built a `searchable` tsvector column, kept fresh by a
// trigger, and a GIN index on it. The scope must point the gem at that
// precomputed column so the GIN index is actually used. Per the pg_search
// README, `tsvector_column` under `using: { tsearch: ... }` does exactly this;
// the `:against` argument is ignored when `tsvector_column` is present but is
// still required syntactically.
// https://github.com/Casecommons/pg_search#using-tsvector-columns
const SCOPE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-like-scope',
		label: 'scope :search, ->(q) {\n  where("name LIKE ?", "%#{q}%")\n}',
		correct: false,
		feedback:
			'That is the same LIKE approach you are replacing. The gem provides a DSL that reads the tsvector column you already indexed.',
	},
	{
		id: 'wrong-recompute',
		label:
			"pg_search_scope :search,\n  against: [:name, :description],\n  using: {\n    tsearch: { dictionary: 'english' }\n  }",
		correct: false,
		feedback:
			'This recomputes to_tsvector(name, description) on every query, so the GIN index you built is never used and the scan stays slow. Point the scope at the column the trigger keeps in sync.',
	},
	{
		id: 'correct',
		label:
			"pg_search_scope :search,\n  against: :searchable,\n  using: {\n    tsearch: {\n      tsvector_column: 'searchable',\n      dictionary: 'english'\n    }\n  }",
		correct: true,
	},
];

// Step 5: Wire Up Controller (using service object pattern from L16)
const SERVICE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-keep-like',
		label:
			'Product.where("name LIKE :q OR description LIKE :q", q: "%#{@query}%")',
		correct: false,
		feedback:
			'That is the same LIKE query you are replacing. You just defined a search scope on the model that uses the GIN index.',
	},
	{
		id: 'correct',
		label: 'Product.search(@query)',
		correct: true,
	},
	{
		id: 'wrong-raw-tsquery',
		label: 'Product.where("searchable @@ plainto_tsquery(?)", @query)',
		correct: false,
		feedback:
			'Writing raw SQL defeats the purpose of the gem. You already defined a clean search scope that handles tsvector, ranking, and stemming.',
	},
];

const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	3: {
		title: 'Include Search Module',
		description:
			'The gem is installed and the migration is applied. Now the Product model needs to load the search module so you can define search scopes.',
		options: INCLUDE_OPTIONS,
	},
	4: {
		title: 'Define Search Scope',
		description:
			'Point the search scope at the tsvector column your migration built and its trigger keeps in sync, so the GIN index does the work. Use the English dictionary for stemming.',
		options: SCOPE_OPTIONS,
	},
	5: {
		title: 'Update Service',
		description:
			'The search scope is ready on the model. Update the service object to replace the LIKE query with the new scope.',
		options: SERVICE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the broken service using LIKE
	if (phase === 'observe') {
		files.push({
			filename: 'app/contracts/search_contract.rb',
			language: 'ruby',
			code: `class SearchContract < Dry::Validation::Contract
  params do
    required(:query).filled(:string)
  end
end`,
		});
		files.push({
			filename: 'app/services/product_search.rb',
			language: 'ruby',
			code: `class ProductSearch < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def initialize(query:)
    @query = query
  end

  def call
    validation = SearchContract.new.call(query: @query)
    if validation.failure?
      return Result.new(
        success?: false, products: [],
        errors: validation.errors.to_h
      )
    end

    products = Product.where(
      "name LIKE :q OR description LIKE :q",
      q: "%#{@query}%"
    )
    Result.new(success?: true, products: products, errors: [])
  end
end

# EXPLAIN for LIKE '%rails%':
# Seq Scan on products  (cost=0.00..1250.00)
#   Filter: (name ~~ '%rails%')
#   Rows Removed by Filter: 49,500
#   Execution Time: 3,200ms`,
			highlight: [17, 18, 19],
		});
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `class Api::ProductsController < ApplicationController
  def index
    result = ProductSearch.call(query: params[:q])

    if result.success?
      render json: result.products
    else
      render json: { errors: result.errors },
             status: :unprocessable_entity
    end
  end
end`,
		});
		return files;
	}

	// Build / reward phases: evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/services/product_search.rb',
			language: 'ruby',
			code: `class ProductSearch < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def initialize(query:)
    @query = query
  end

  def call
    validation = SearchContract.new.call(query: @query)
    if validation.failure?
      return Result.new(
        success?: false, products: [],
        errors: validation.errors.to_h
      )
    end

    products = Product.where(
      "name LIKE :q OR description LIKE :q",
      q: "%#{@query}%"
    )
    Result.new(success?: true, products: products, errors: [])
  end
end`,
			highlight: [17, 18, 19],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `source "https://rubygems.org"

gem "rails", "~> 8.0.0"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "pg_search"`,
			highlight: [6],
		});
	}

	if (furthestStep >= 2) {
		files.push({
			filename: 'db/migrate/add_search_to_products.rb',
			language: 'ruby',
			code: `class AddSearchToProducts < ActiveRecord::Migration[8.0]
  def change
    add_column :products, :searchable, :tsvector
    add_index :products, :searchable, using: :gin

    execute <<-SQL
      CREATE TRIGGER products_search_update
      BEFORE INSERT OR UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION
        tsvector_update_trigger(
          searchable, 'pg_catalog.english',
          name, description
        );
    SQL
  end
end`,
			highlight: [3, 4],
		});
	}

	if (furthestStep >= 3) {
		// Show migration output after db:migrate
		files.push({
			filename: 'Migration output',
			language: 'sql',
			code: `-- rails db:migrate
== AddSearchToProducts: migrating ======================
-- add_column(:products, :searchable, :tsvector)
   -> 0.0038s
-- add_index(:products, :searchable, {:using=>:gin})
   -> 0.0072s
== AddSearchToProducts: migrated (0.0110s) =============`,
			highlight: [3, 5],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code:
				furthestStep >= 5
					? `class Product < ApplicationRecord
  include PgSearch::Model

  pg_search_scope :search,
    against: :searchable,
    using: {
      tsearch: {
        tsvector_column: 'searchable',
        dictionary: 'english'
      }
    }
end`
					: `class Product < ApplicationRecord
  include PgSearch::Model
end`,
			highlight: furthestStep >= 5 ? [4, 5, 6, 7, 8, 9, 10, 11] : [2],
		});
	}

	if (furthestStep >= 6) {
		files.push({
			filename: 'app/services/product_search.rb',
			language: 'ruby',
			code: `class ProductSearch < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def initialize(query:)
    @query = query
  end

  def call
    validation = SearchContract.new.call(query: @query)
    if validation.failure?
      return Result.new(
        success?: false, products: [],
        errors: validation.errors.to_h
      )
    end

    products = Product.search(@query)
    Result.new(success?: true, products: products, errors: [])
  end
end`,
			highlight: [17],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// DocumentGrid: shows database rows as a grid of blocks
// ──────────────────────────────────────────────

function DocumentGrid({
	matchPositions,
	scanProgress,
	scanType,
	totalRows,
}: {
	matchPositions: Set<number>;
	scanProgress: number; // -1=idle, 0..GRID_SIZE=scanning, GRID_SIZE=done
	scanType: 'seq' | 'gin' | 'blocked';
	totalRows: number;
}) {
	const gridBlocks = useMemo(
		() =>
			Array.from({ length: GRID_SIZE }, (_, i) => ({
				key: `r${i}`,
				idx: i,
				isMatch: matchPositions.has(i),
			})),
		[matchPositions],
	);
	const isDone = scanProgress >= GRID_SIZE;
	const isActive = scanProgress >= 0;
	const matchCount = matchPositions.size;
	const rowsPerBlock = Math.round(totalRows / GRID_SIZE);

	return (
		<div className="space-y-2.5">
			{/* Table label */}
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<Table2 className="w-3.5 h-3.5" />
				<span className="font-mono">
					products ({totalRows.toLocaleString()} rows)
				</span>
				{isActive && scanType === 'seq' && !isDone && (
					<span className="font-mono text-red-600 dark:text-red-400">
						scanning row{' '}
						{Math.min(scanProgress * rowsPerBlock, totalRows).toLocaleString()}
						...
					</span>
				)}
				{isDone && scanType === 'seq' && (
					<span className="font-mono text-red-600 dark:text-red-400">
						all {totalRows.toLocaleString()} rows scanned
					</span>
				)}
				{isDone && scanType === 'gin' && (
					<span className="font-mono text-emerald-600 dark:text-emerald-400">
						{matchCount} row{matchCount !== 1 ? 's' : ''} via GIN index
					</span>
				)}
				{isDone && scanType === 'blocked' && (
					<span className="font-mono text-red-600 dark:text-red-400">
						query rejected
					</span>
				)}
			</div>

			{/* Row grid: 20 columns, full width */}
			<div className="grid grid-cols-[repeat(20,1fr)] gap-1 w-full">
				{gridBlocks.map((block) => (
					<div
						className={cn(
							'h-4 rounded-sm transition-colors duration-75',
							block.isMatch && isDone
								? 'bg-emerald-500 dark:bg-emerald-400'
								: block.idx < scanProgress && scanType === 'seq'
									? 'bg-red-400/80 dark:bg-red-500/60'
									: 'bg-zinc-200 dark:bg-zinc-700/50',
						)}
						key={block.key}
					/>
				))}
			</div>

			{/* Legend below grid */}
			{isDone && scanType !== 'blocked' && (
				<div className="flex items-center gap-4 text-xs animate-in fade-in duration-300">
					{scanType === 'seq' ? (
						<>
							<span className="flex items-center gap-1.5">
								<span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400/80 dark:bg-red-500/60" />
								<span className="text-red-600 dark:text-red-400">
									Scanned ({(GRID_SIZE - matchCount).toLocaleString()} blocks)
								</span>
							</span>
							<span className="flex items-center gap-1.5">
								<span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
								<span className="text-emerald-600 dark:text-emerald-400">
									Matched ({matchCount})
								</span>
							</span>
						</>
					) : (
						<span className="flex items-center gap-1.5">
							<span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
							<span className="text-emerald-600 dark:text-emerald-400">
								Direct lookup via GIN index ({matchCount} row
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
// GinIndexCard: shows the inverted index structure
// ──────────────────────────────────────────────

function GinIndexCard({
	entries,
	indexName,
}: {
	entries: GinIndexEntry[];
	indexName: string;
}) {
	return (
		<div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10 p-3 space-y-2">
			<div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
				<Zap className="w-3.5 h-3.5" />
				<span className="font-mono">{indexName}</span>
			</div>
			<div className="space-y-0.5 pl-5 font-mono text-xs">
				{entries.map((entry) => (
					<div
						className={cn(
							'flex items-center gap-2',
							entry.highlight
								? 'text-emerald-700 dark:text-emerald-300 font-bold'
								: 'text-emerald-600/40 dark:text-emerald-400/30',
						)}
						key={`gin-${entry.term}`}
					>
						{entry.highlight ? (
							<ArrowRight className="w-2.5 h-2.5 shrink-0" />
						) : (
							<span className="w-2.5" />
						)}
						<span>{entry.term}</span>
						<span
							className={cn(
								entry.highlight
									? 'text-emerald-600 dark:text-emerald-400'
									: 'text-emerald-500/30 dark:text-emerald-400/20',
							)}
						>
							{'\u2192'} {entry.rows}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// NoIndexBanner: shown during observe seq scan
// ──────────────────────────────────────────────

function NoIndexBanner() {
	return (
		<div className="rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-900/10 px-3 py-2 flex items-center gap-2 text-xs">
			<X className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
			<span className="font-mono text-red-700 dark:text-red-400 font-semibold">
				No GIN index on products
			</span>
			<span className="text-red-600/60 dark:text-red-400/50">
				Reading every row (Sequential Scan)
			</span>
		</div>
	);
}

// ──────────────────────────────────────────────
// BlockedBanner: shown when query is rejected
// ──────────────────────────────────────────────

function BlockedBanner({ reason }: { reason: string }) {
	return (
		<div className="rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-900/10 px-3 py-2 flex items-center gap-2 text-xs">
			<X className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
			<span className="font-mono text-red-700 dark:text-red-400 font-semibold">
				BLOCKED
			</span>
			<span className="text-red-600/60 dark:text-red-400/50">{reason}</span>
		</div>
	);
}

// ──────────────────────────────────────────────
// SearchBadges: shows scan type, stemming, ranking status
// ──────────────────────────────────────────────

function SearchBadges({ scan }: { scan: SearchScanResult }) {
	const isGood = scan.scanType === 'gin';
	return (
		<div className="flex items-center gap-2 flex-wrap">
			{/* Scan type badge */}
			<Badge
				className={cn(
					'text-xs',
					isGood
						? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400'
						: 'border-red-500/50 text-red-700 dark:text-red-400',
				)}
				variant="outline"
			>
				{isGood ? (
					<>
						<Zap className="w-2.5 h-2.5 mr-1" />
						{scan.time}
					</>
				) : (
					scan.time
				)}
			</Badge>

			{/* Stemming badge */}
			<Badge
				className={cn(
					'text-xs',
					scan.stemmed || isGood
						? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400'
						: 'border-red-500/50 text-red-700 dark:text-red-400',
				)}
				variant="outline"
			>
				{scan.stemmed || (isGood && scan.matchCount > 0)
					? 'Stemming'
					: 'No Stemming'}
			</Badge>

			{/* Ranking badge */}
			<Badge
				className={cn(
					'text-xs',
					scan.ranked
						? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400'
						: 'border-red-500/50 text-red-700 dark:text-red-400',
				)}
				variant="outline"
			>
				{scan.ranked ? 'Ranked (A > B)' : 'No Ranking'}
			</Badge>
		</div>
	);
}

// ──────────────────────────────────────────────
// SearchLegend (reward phase)
// ──────────────────────────────────────────────

function SearchLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Search Performance Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Zap className="w-4 h-4 text-success" />
					<span className="text-foreground">
						GIN Index Scan (direct term lookup)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Blocked (empty/malicious input)
					</span>
				</div>
			</div>
			<div className="flex items-center gap-3 mt-3 text-xs">
				<span className="flex items-center gap-1.5">
					<span className="inline-block w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
					Matched row
				</span>
				<span className="flex items-center gap-1.5">
					<span className="inline-block w-3 h-3 rounded-sm bg-red-400/80 dark:bg-red-500/60" />
					Scanned (wasted)
				</span>
				<span className="flex items-center gap-1.5">
					<span className="inline-block w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-700/50" />
					Not touched
				</span>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level27Search({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);

	// Observe animation state
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);
	const [scanProgress, setScanProgress] = useState(-1);
	const [scanDone, setScanDone] = useState(false);
	const [isAnimating, setIsAnimating] = useState(false);
	const [firedProbeCount, setFiredProbeCount] = useState(0);
	const animationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// Reward animation state
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

	/** Run a seq scan animation (red wave sweeping through all blocks) */
	const runSeqScanAnimation = useCallback(
		(onProgress: (p: number) => void, onDone: () => void) => {
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

	/** Run a GIN index scan animation (instant match, short delay) */
	const runGinScanAnimation = useCallback(
		(onProgress: (p: number) => void, onDone: () => void) => {
			clearAnimations();
			setIsAnimating(true);

			// Short pause to show the index card, then reveal matches
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

	// ── Match positions for current state ──
	const observeMatchPositions = useMemo(
		() => new Set(lastProbeId ? (OBSERVE_GRID_MATCHES[lastProbeId] ?? []) : []),
		[lastProbeId],
	);

	const rewardMatchPositions = useMemo(
		() =>
			new Set(
				lastRewardScenarioId
					? (REWARD_GRID_MATCHES[lastRewardScenarioId] ?? [])
					: [],
			),
		[lastRewardScenarioId],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			setScanDone(false);

			// Run seq scan animation
			runSeqScanAnimation(
				(progress) => setScanProgress(progress),
				() => setScanDone(true),
			);

			setFiredProbeCount((c) => c + 1);

			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[discoveryGating, runSeqScanAnimation],
	);

	// ── Controller code click handler (observe phase, 4th discovery) ──
	const handleControllerClick = useCallback(() => {
		if (phase !== 'observe' || isAnimating) return;
		setInspectorData(CONTROLLER_INSPECTOR);
		discoveryGating.discover('controller-like');
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

			if (rewardData.scanType === 'gin') {
				// GIN scan: show index card, then matches appear instantly
				setRewardProgress(0);
				runGinScanAnimation(
					(progress) => setRewardProgress(progress),
					() => setRewardDone(true),
				);
			} else {
				// Blocked: show immediately
				setRewardProgress(GRID_SIZE);
				setRewardDone(true);
				setIsAnimating(false);
			}
		},
		[stressTest, runGinScanAnimation],
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
		return { valid: true, message: 'Full-text search deployed!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// Observe scan data for display
	const observeScan = lastProbeId ? OBSERVE_SCAN_DATA[lastProbeId] : null;

	// Reward scan data for current scenario
	const rewardScan = lastRewardScenarioId
		? REWARD_SCAN_DATA[lastRewardScenarioId]
		: null;
	const rewardGinData =
		lastRewardScenarioId && rewardScan?.scanType === 'gin'
			? GIN_INDEX_DATA[lastRewardScenarioId]
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
							Users want to search products by keyword, but the current
							implementation uses{' '}
							<span className="text-foreground font-medium">
								LIKE &apos;%query%&apos;
							</span>{' '}
							which takes 3 seconds on 50K products. No relevance ranking, no
							stemming, and no way to use an index.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							PostgreSQL has built-in full-text search using{' '}
							<span className="text-foreground font-medium">tsvector</span> and{' '}
							<span className="text-foreground font-medium">GIN indexes</span>.
							A gem can wrap this in a clean Rails DSL.
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
												Click{' '}
												<span className="font-medium">
													View Controller Code
												</span>{' '}
												to see why the search is broken.
											</>
										) : (
											<>
												Fire more probes to discover all the problems with LIKE
												queries.
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
							<SearchLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Fast Results</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Rejected</div>
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
					levelName="Search"
					levelNumber={27}
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
								{/* Search Query Panel */}
								<div
									className={cn(
										'rounded-lg border p-3 transition-all duration-300',
										scanDone && observeScan
											? 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10'
											: 'border-border bg-card',
									)}
								>
									{/* Header */}
									<div className="flex items-center gap-2 mb-2">
										<Search className="w-3.5 h-3.5 text-muted-foreground" />
										<span className="text-xs font-semibold text-foreground">
											Search Query
										</span>
										<span className="text-xs font-mono text-muted-foreground">
											(products)
										</span>
										{scanDone && observeScan && (
											<Badge
												className="ml-auto text-xs border-red-500/50 text-red-700 dark:text-red-400"
												variant="outline"
											>
												{observeScan.time}
											</Badge>
										)}
									</div>

									{/* SQL */}
									{lastProbeId && (
										<p className="text-xs font-mono text-muted-foreground mb-2 truncate">
											{lastProbeId === 'search-rails' &&
												"WHERE name LIKE '%rails%' OR description LIKE '%rails%'"}
											{lastProbeId === 'search-running' &&
												"WHERE name LIKE '%running%' OR description LIKE '%running%'"}
											{lastProbeId === 'search-database' &&
												"WHERE name LIKE '%database%' OR description LIKE '%database%'"}
										</p>
									)}

									{/* Grid + results */}
									{scanProgress >= 0 ? (
										<div className="space-y-2">
											<NoIndexBanner />
											<DocumentGrid
												matchPositions={observeMatchPositions}
												scanProgress={scanProgress}
												scanType="seq"
												totalRows={50000}
											/>
											{scanDone && observeScan && (
												<div className="animate-in fade-in duration-300">
													<SearchBadges scan={observeScan} />
												</div>
											)}
										</div>
									) : (
										<div className="h-10 flex items-center">
											<span className="text-xs text-muted-foreground/50 italic">
												Fire a probe to test this query
											</span>
										</div>
									)}
								</div>

								{/* Controller Code button (4th discovery) */}
								<button
									className={cn(
										'w-full flex items-center gap-2 rounded-lg border border-dashed p-3 transition-colors',
										'border-border bg-card hover:border-primary/40 hover:bg-primary/5',
										isAnimating && 'pointer-events-none opacity-50',
									)}
									disabled={isAnimating}
									onClick={handleControllerClick}
									type="button"
								>
									<FileCode className="w-4 h-4 text-muted-foreground" />
									<span className="text-xs font-medium text-foreground">
										View Controller Code
									</span>
									{!discoveryGating.isDiscovered('controller-like') && (
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
							<div className="px-6 pb-4">
								<ProbeTerminal
									disabled={isAnimating}
									onProbe={handleProbe}
									probes={PROBES}
									title="Search Probe"
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
								{/* Step 0: Install gem */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={installGemCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													You need a gem that wraps PostgreSQL full-text search
													in a clean Rails DSL. Add it to your project.
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
											outputLines={installGemOutput}
											stepKey={stepper.currentStep}
											title="Install Search Gem"
										/>
									)}

								{/* Step 1: Generate migration */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 1 && (
										<TerminalChoiceStep
											commands={generateMigrationCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Full-text search needs a tsvector column and a GIN
													index on the products table. Generate the migration
													file.
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
											title="Generate Search Column"
										/>
									)}

								{/* Step 2: Run migration */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 2 && (
										<TerminalChoiceStep
											commands={runMigrationCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													The migration file is ready with a tsvector column and
													GIN index. Apply it to the database.
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

								{/* OptionCard steps (3, 4, 5) */}
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
								{rewardScan ? (
									<div className="animate-in fade-in duration-300">
										<div
											className={cn(
												'rounded-lg border p-3 transition-all duration-300',
												rewardDone && rewardScan.scanType === 'gin'
													? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10'
													: rewardDone && rewardScan.scanType === 'blocked'
														? 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10'
														: 'border-border bg-card',
											)}
										>
											{/* Header */}
											<div className="flex items-center gap-2 mb-2">
												<Search className="w-3.5 h-3.5 text-muted-foreground" />
												<span className="text-xs font-semibold text-foreground">
													Search Query
												</span>
												<span className="text-xs font-mono text-muted-foreground">
													(products)
												</span>
												{rewardDone && rewardScan.scanType === 'gin' && (
													<Badge
														className="ml-auto text-xs border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
														variant="outline"
													>
														<Zap className="w-2.5 h-2.5 mr-1" />
														{rewardScan.time}
													</Badge>
												)}
												{rewardDone && rewardScan.scanType === 'blocked' && (
													<Badge
														className="ml-auto text-xs border-red-500/50 text-red-700 dark:text-red-400"
														variant="outline"
													>
														BLOCKED
													</Badge>
												)}
											</div>

											{/* GIN Index card (for successful searches) */}
											{rewardGinData && rewardProgress >= 0 && (
												<div className="mb-2">
													<GinIndexCard
														entries={rewardGinData.entries}
														indexName={rewardGinData.name}
													/>
												</div>
											)}

											{/* Blocked banner */}
											{rewardScan.scanType === 'blocked' && rewardDone && (
												<div className="mb-2">
													<BlockedBanner
														reason={
															lastRewardScenarioId === 'empty-query'
																? 'Empty search query rejected'
																: 'Malicious input safely sanitized'
														}
													/>
												</div>
											)}

											{/* Document grid */}
											<DocumentGrid
												matchPositions={rewardMatchPositions}
												scanProgress={rewardProgress}
												scanType={rewardScan.scanType}
												totalRows={50000}
											/>

											{/* Search badges */}
											{rewardDone && rewardScan.scanType === 'gin' && (
												<div className="mt-2 animate-in fade-in duration-300">
													<SearchBadges scan={rewardScan} />
												</div>
											)}
										</div>
									</div>
								) : (
									<div className="flex-1 flex items-center justify-center py-12">
										<p className="text-sm text-muted-foreground/50 italic">
											Fire a scenario to see the search plan
										</p>
									</div>
								)}
							</div>

							{/* Stress test controls */}
							<div className="px-6 pb-4">
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
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level27Search;
