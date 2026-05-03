/**
 * Level 26: Pagination
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Page Stack + Response Payload" visualization.
 *   Two-zone layout stacked vertically: 20 horizontal bars (each = 2,500 records
 *   out of 50K total) and response zone showing payload size. Player fires probes
 *   and watches all 20 bars cascade red top-to-bottom, with the response zone
 *   filling red. ProbeTerminal drives probes, clickable zones reveal StageInspector.
 *
 * Phase 2 (HOW - build): 5 steps (1 terminal + 4 OptionCard) implementing Pagy v43
 *   Step 0: bundle add pagy (terminal)
 *   Step 1: include Pagy::Method in ApplicationController (OptionCard)
 *   Step 2: Configure Pagy::OPTIONS[:limit] = 25 (OptionCard)
 *   Step 3: Wire up pagy(:offset, Product.includes(:user)) (OptionCard)
 *   Step 4: Add response.headers.merge!(@pagy.headers_hash) (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Same two-zone layout, now showing the fix.
 *   Allowed: one bar glows green (page window), response shows 6KB.
 *   Blocked (page 99999): all bars dim, response shows overflow error.
 *
 * Teaches: Pagy v43 gem, Pagy::Method, Pagy::OPTIONS, pagy(:offset, ...), headers_hash
 */

import { ArrowRight, Database, Globe, Info, Search, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { FlowConnector } from '@/components/levels/FlowConnector';
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

registerLevelCode('act4-level26-pagination', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Visualization state types
// ──────────────────────────────────────────────

type VizMode = 'idle' | 'cascade' | 'page-window' | 'overflow';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const TOTAL_BARS = 20;
const RECORDS_PER_BAR = 2500;
const TOTAL_RECORDS = TOTAL_BARS * RECORDS_PER_BAR; // 50,000

/** Pre-generated bar keys (static stack, never reordered) */
const BAR_KEYS = Array.from({ length: TOTAL_BARS }, (_, i) => `bar${i}`);

/** Map a page number (1-based, 25 per page) to a bar index (0-19), or null if out of range */
function pageToBar(page: number): number | null {
	if (page < 1 || page > Math.ceil(TOTAL_RECORDS / 25)) return null;
	// Each bar covers 2,500 records = 100 pages (25 per page)
	const barIndex = Math.floor((page - 1) / 100);
	return barIndex < TOTAL_BARS ? barIndex : null;
}

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'huge-response', label: 'Response is 12MB of JSON' },
	{ id: 'no-pagination', label: 'No pagination in controller' },
	{ id: 'memory-spike', label: 'Server loads 50K records into memory' },
	{ id: 'mobile-crash', label: 'Mobile clients crash parsing response' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'get-all-products',
		label: 'GET all products',
		command: 'GET /api/products',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{ text: 'Content-Length: 12,582,912  (12MB!)', color: 'yellow' },
			{ text: 'Transfer-Encoding: chunked', color: 'muted' },
			{ text: '', color: 'muted' },
			{
				text: '[{"id":1,...},{"id":2,...},...,{"id":50000,...}]',
				color: 'muted',
			},
			{
				text: 'All 50,000 products returned. No pagination.',
				color: 'red',
			},
		],
		story: [
			'A frontend developer calls the products API to populate a listing page.',
			'The endpoint returns all 50,000 products in a single 12 MB JSON response.',
			'No pagination is configured, so every request dumps the entire table.',
			'Response time and payload size grow linearly with the number of products.',
		],
	},
	{
		id: 'get-mobile',
		label: 'GET from mobile client',
		command: 'GET /api/products (iPhone, 3G connection)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{ text: 'Content-Length: 12,582,912', color: 'muted' },
			{ text: '', color: 'muted' },
			{
				text: 'Downloading 12MB on 3G... 45 seconds elapsed',
				color: 'yellow',
			},
			{
				text: 'JSON.parse() on 50K objects: out of memory.',
				color: 'red',
			},
			{ text: 'App crashed.', color: 'red' },
		],
		story: [
			'A customer opens the product listing on their phone over a 3G connection.',
			'The browser starts downloading the 12 MB response, taking 45 seconds.',
			'JSON.parse() attempts to hydrate 50,000 objects in limited mobile memory.',
			'The app runs out of memory and crashes.',
		],
	},
	{
		id: 'check-memory',
		label: 'Check server memory',
		command: 'rails runner "GC.stat[:heap_live_slots]"',
		responseLines: [
			{ text: '=> 2,847,391 live objects', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: 'Product.includes(:user).all loads 50K AR objects + 50K User objects.',
				color: 'muted',
			},
			{
				text: 'Each request allocates ~180MB before serialization.',
				color: 'red',
			},
		],
		story: [
			'An engineer checks the server memory after a spike in traffic.',
			'Each request loads 50,000 ActiveRecord objects plus 50,000 User objects.',
			'The heap has nearly 3 million live objects, allocating 180 MB per request.',
			'Under concurrent load, the server quickly exhausts available memory.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'get-all-products': 'huge-response',
	'get-mobile': 'mobile-crash',
	'check-memory': 'memory-spike',
};

// ──────────────────────────────────────────────
// Zone inspector data (observe phase)
// ──────────────────────────────────────────────

const ZONE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	database: {
		stageId: 'database',
		title: 'ProductList Service (Query Logic)',
		description:
			'The service returns Product.includes(:user) as the scope with no limit. The controller renders the entire scope without pagination, loading all 50K rows and allocating ~180MB per request.',
		code: `# app/services/product_list.rb
class ProductList < ApplicationService
  Result = Data.define(:success?, :scope, :errors)
  def call
    validation = ListContract.new.call({})
    scope = Product.includes(:user)  # No limit!
    Result.new(success?: true, scope: scope, errors: [])
  end
end

# Controller renders ALL of result.scope:
# => SELECT "products".* FROM "products"
# => 50,000 Product + 50,000 User objects loaded`,
	},
	response: {
		stageId: 'response',
		title: 'Response (12MB JSON)',
		description:
			'The serializer converts all 50,000 objects to a single JSON array. No pagination headers, no Link rel="next", no way for the client to request a subset. Mobile clients crash parsing this payload.',
		code: `# Response headers:
# Content-Length: 12,582,912
# Content-Type: application/json
#
# No Link header
# No X-Total-Count
# No way to request "page 2"`,
	},
};

// Map zone IDs to discovery IDs they trigger
const ZONE_DISCOVERY_MAP: Record<string, string> = {
	database: 'no-pagination',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'page-1',
		label: 'GET page 1 (default)',
		description: 'First page of products, 25 items',
		method: 'GET',
		path: '/api/products',
		actor: 'web client',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{
				text: 'Link: </products?page=2>; rel="next", </products?page=2000>; rel="last"',
				color: 'green',
			},
			{ text: 'Content-Length: 6,250  (6KB, 25 items)', color: 'green' },
		],
	},
	{
		id: 'page-50',
		label: 'GET page 50',
		description: 'Middle of the dataset',
		method: 'GET',
		path: '/api/products?page=50',
		actor: 'web client',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{
				text: 'Link: </products?page=49>; rel="prev", </products?page=51>; rel="next"',
				color: 'green',
			},
			{ text: 'Content-Length: 6,250  (6KB, 25 items)', color: 'green' },
		],
	},
	{
		id: 'page-2000',
		label: 'GET page 2000 (last)',
		description: 'Last page of 50K products',
		method: 'GET',
		path: '/api/products?page=2000',
		actor: 'mobile client',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{
				text: 'Link: </products?page=1999>; rel="prev"',
				color: 'green',
			},
			{ text: 'Content-Length: 6,250  (6KB, 25 items)', color: 'green' },
		],
	},
	{
		id: 'mobile-page-1',
		label: 'GET page 1 (mobile)',
		description: 'Mobile client gets paginated response',
		method: 'GET',
		path: '/api/products?page=1',
		actor: 'iPhone (3G)',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{
				text: 'Content-Length: 6,250  (6KB on 3G = 0.1s)',
				color: 'green',
			},
			{ text: 'Mobile renders instantly.', color: 'green' },
		],
	},
	{
		id: 'invalid-page',
		label: 'GET page 99999',
		description: 'Page beyond dataset range',
		method: 'GET',
		path: '/api/products?page=99999',
		actor: 'API client',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'Pagy::OverflowError: page 99999 out of 1..2000', color: 'red' },
			{ text: 'Returned: []  (empty array)', color: 'red' },
		],
	},
];

// Map scenario IDs to page numbers for the reward visualization
const SCENARIO_PAGE_MAP: Record<string, number> = {
	'page-1': 1,
	'page-50': 50,
	'page-2000': 2000,
	'mobile-page-1': 1,
	'invalid-page': 99999,
};

// ──────────────────────────────────────────────
// Step definitions (5 steps: 1 terminal + 4 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-gem', title: 'Install Pagination Gem' },
	{ id: 'include-method', title: 'Include Controller Module' },
	{ id: 'configure-limit', title: 'Set Page Size' },
	{ id: 'wire-index', title: 'Paginate the Query' },
	{ id: 'add-headers', title: 'Add Navigation Headers' },
];

// Step type indexed by step number
const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add pagy
	'option', // 1: include Pagy::Method
	'option', // 2: configure limit
	'option', // 3: wire pagy into index
	'option', // 4: add Link headers
];

// ──────────────────────────────────────────────
// Step 0: Install Pagination Gem (Terminal)
// ──────────────────────────────────────────────

const addGemCommands: TerminalCommand[] = [
	{
		id: 'wrong-kaminari',
		label: 'bundle add kaminari',
		command: 'bundle add kaminari',
		correct: false,
		feedback:
			'Kaminari works but is significantly slower. The recommended pagination gem is 40x faster with a smaller memory footprint.',
	},
	{
		id: 'correct',
		label: 'bundle add pagy',
		command: 'bundle add pagy',
		correct: true,
	},
	{
		id: 'wrong-will-paginate',
		label: 'bundle add will_paginate',
		command: 'bundle add will_paginate',
		correct: false,
		feedback:
			'will_paginate is a legacy gem. The modern alternative is faster and supports offset, cursor, and keyset strategies.',
	},
];

const addGemOutput: TerminalOutputLine[] = [
	{ text: 'Fetching pagy 43.3.2', color: 'cyan' },
	{ text: 'Installing pagy 43.3.2', color: 'muted' },
	{ text: 'Bundle complete! 14 Gemfile dependencies.', color: 'green' },
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

// Terminal step map (for buildTerminalHistory)
const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addGemCommands, outputLines: addGemOutput },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
];

// ──────────────────────────────────────────────
// OptionCard step configs
// ──────────────────────────────────────────────

const INCLUDE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-frontend',
		label: 'include Pagy::Frontend',
		correct: false,
		feedback:
			'Pagy::Frontend is for view helpers (HTML pagination links). API controllers need the module that provides the pagy() method.',
	},
	{
		id: 'correct',
		label: 'include Pagy::Method',
		correct: true,
	},
	{
		id: 'wrong-backend',
		label: 'include Pagy::Backend',
		correct: false,
		feedback:
			'That was the old module name from Pagy v8 and earlier. The v43+ API uses a different module name.',
	},
];

const CONFIGURE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-100',
		label: 'Pagy::OPTIONS[:limit] = 100',
		correct: false,
		feedback:
			'100 items per page is still too large for mobile clients. A typical API page size is much smaller.',
	},
	{
		id: 'wrong-old-api',
		label: 'Pagy::DEFAULT[:items] = 25',
		correct: false,
		feedback:
			'That is the old Pagy API (pre-v43). The current version uses OPTIONS and :limit instead of DEFAULT and :items.',
	},
	{
		id: 'correct',
		label: 'Pagy::OPTIONS[:limit] = 25',
		correct: true,
	},
];

const WIRE_INDEX_OPTIONS: StepOption[] = [
	{
		id: 'wrong-kaminari-style',
		label: '@products = result.scope.page(params[:page]).per(25)',
		correct: false,
		feedback:
			'That is Kaminari syntax. Pagy uses a different API: the pagy() method returns both metadata and the paginated collection.',
	},
	{
		id: 'wrong-manual',
		label: '@products = result.scope.limit(25).offset(params[:page].to_i * 25)',
		correct: false,
		feedback:
			'Manual LIMIT/OFFSET works but loses pagination metadata (total count, page links). The gem handles this automatically.',
	},
	{
		id: 'correct',
		label: '@pagy, @products = pagy(:offset, result.scope)',
		correct: true,
	},
];

const HEADERS_OPTIONS: StepOption[] = [
	{
		id: 'wrong-body',
		label: 'render json: { data: @products, meta: { page: @pagy.page } }',
		correct: false,
		feedback:
			'Embedding pagination in the JSON body is non-standard. RFC 5988 specifies Link headers so the payload stays clean.',
	},
	{
		id: 'correct',
		label: 'response.headers.merge!(@pagy.headers_hash)',
		correct: true,
	},
	{
		id: 'wrong-custom',
		label: 'response.headers["X-Pagination"] = @pagy.to_json',
		correct: false,
		feedback:
			'Custom headers are non-standard. Pagy has built-in support for RFC 5988 Link headers via headers_hash.',
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
	1: {
		title: 'Include Controller Module',
		description:
			'The gem is installed. Your ApplicationController needs the module that provides the pagination method to all controllers.',
		options: INCLUDE_OPTIONS,
	},
	2: {
		title: 'Set Page Size',
		description:
			'Configure the default page size in an initializer. The current endpoint returns all 50K products. Choose a reasonable default.',
		options: CONFIGURE_OPTIONS,
	},
	3: {
		title: 'Paginate the Query',
		description:
			'The service returns the scope via result.scope. Paginate it in the controller. The pagination method returns a tuple: metadata and the scoped collection.',
		options: WIRE_INDEX_OPTIONS,
	},
	4: {
		title: 'Add Navigation Headers',
		description:
			'API clients need to know how to fetch the next page. RFC 5988 headers are the standard way to communicate pagination URLs without polluting the JSON body.',
		options: HEADERS_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Contract file (shown in observe and final reward)
	const contractCode = `class ListContract < Dry::Validation::Contract
  params do
    optional(:page).filled(:integer, gt?: 0)
  end
end`;

	if (phase === 'observe') {
		files.push({
			filename: 'app/contracts/list_contract.rb',
			language: 'ruby',
			code: contractCode,
		});
		files.push({
			filename: 'app/services/product_list.rb',
			language: 'ruby',
			code: `class ProductList < ApplicationService
  Result = Data.define(:success?, :scope, :errors)

  def initialize(page: nil)
    @page = page
  end

  def call
    validation = ListContract.new.call(
      page: @page
    )
    if validation.failure?
      return Result.new(
        success?: false, scope: Product.none,
        errors: validation.errors.to_h
      )
    end
    scope = Product.includes(:user)  # No limit!
    Result.new(success?: true, scope: scope, errors: [])
  end
end`,
			highlight: [18],
		});
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `class Api::ProductsController < ApplicationController
  def index
    result = ProductList.call(page: params[:page])
    if result.success?
      render json: ProductSerializer.new(result.scope)
    else
      render json: { errors: result.errors },
             status: :unprocessable_entity
    end
  end
end

# Renders ALL of result.scope (50K products!)
# No pagination. No Link headers.
# Content-Length: 12,582,912  (12MB!)`,
			highlight: [5],
		});
		return files;
	}

	// Build / reward phases: evolving code
	if (furthestStep === 0) {
		// Show the broken service (same as observe)
		files.push({
			filename: 'app/services/product_list.rb',
			language: 'ruby',
			code: `class ProductList < ApplicationService
  Result = Data.define(:success?, :scope, :errors)

  def initialize(page: nil)
    @page = page
  end

  def call
    validation = ListContract.new.call(page: @page)
    if validation.failure?
      return Result.new(
        success?: false, scope: Product.none,
        errors: validation.errors.to_h
      )
    end
    scope = Product.includes(:user)  # No limit!
    Result.new(success?: true, scope: scope, errors: [])
  end
end`,
			highlight: [17],
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
gem "jsonapi-serializer"
gem "pagy", "~> 43.3"`,
			highlight: [7],
		});
	}

	if (furthestStep >= 2) {
		files.push({
			filename: 'app/controllers/application_controller.rb',
			language: 'ruby',
			code: `class ApplicationController < ActionController::API
  include Pagy::Method
end`,
			highlight: [2],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'config/initializers/pagy.rb',
			language: 'ruby',
			code: `# frozen_string_literal: true

Pagy::OPTIONS[:limit] = 25`,
			highlight: [3],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code:
				furthestStep >= 5
					? `class Api::ProductsController < ApplicationController
  def index
    result = ProductList.call(page: params[:page])
    if result.success?
      @pagy, @products = pagy(:offset, result.scope)
      response.headers.merge!(@pagy.headers_hash)
      render json: ProductSerializer.new(@products)
    else
      render json: { errors: result.errors },
             status: :unprocessable_entity
    end
  end
end

# Response:
# HTTP/1.1 200 OK
# Link: </products?page=2>; rel="next",
#       </products?page=2000>; rel="last"
# Content-Length: 6,250  (25 items only!)`
					: `class Api::ProductsController < ApplicationController
  def index
    result = ProductList.call(page: params[:page])
    if result.success?
      @pagy, @products = pagy(:offset, result.scope)
      render json: ProductSerializer.new(@products)
    else
      render json: { errors: result.errors },
             status: :unprocessable_entity
    end
  end
end`,
			highlight: furthestStep >= 5 ? [5, 6] : [5],
		});
	}

	// Show contract + final service in reward
	if (furthestStep >= 5) {
		files.push({
			filename: 'app/contracts/list_contract.rb',
			language: 'ruby',
			code: contractCode,
		});
		files.push({
			filename: 'app/services/product_list.rb',
			language: 'ruby',
			code: `class ProductList < ApplicationService
  Result = Data.define(:success?, :scope, :errors)

  def initialize(page: nil)
    @page = page
  end

  def call
    validation = ListContract.new.call(page: @page)
    if validation.failure?
      return Result.new(
        success?: false, scope: Product.none,
        errors: validation.errors.to_h
      )
    end
    scope = Product.includes(:user)
    Result.new(success?: true, scope: scope, errors: [])
  end
end`,
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Reward Legend
// ──────────────────────────────────────────────

function PaginationLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<div className="w-8 h-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
					<span className="text-foreground">
						Active page chunk (25 records)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-8 h-2.5 rounded-sm bg-muted-foreground/20" />
					<span className="text-foreground">Untouched records</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-8 h-2.5 rounded-sm bg-muted-foreground/10" />
					<span className="text-foreground">Page out of range (all dim)</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level26Pagination({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedZones, setInspectedZones] = useState<Set<string>>(new Set());
	const [firedProbeCount, setFiredProbeCount] = useState(0);

	// ── Visualization state ──
	const [vizMode, setVizMode] = useState<VizMode>('idle');
	const [cascadeProgress, setCascadeProgress] = useState(0); // 0..TOTAL_BARS (bar index)
	const [activeBar, setActiveBar] = useState<number | null>(null); // bar index for reward
	const [vizAnimating, setVizAnimating] = useState(false);
	const cascadeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// ── Cascade animation helpers ──
	const clearCascadeTimers = useCallback(() => {
		for (const t of cascadeTimersRef.current) clearTimeout(t);
		cascadeTimersRef.current = [];
	}, []);

	/** Run the red cascade animation: 20 bars cascade sequentially top-to-bottom */
	const runCascade = useCallback(
		(onDone?: () => void): void => {
			clearCascadeTimers();
			setVizMode('cascade');
			setCascadeProgress(0);
			setActiveBar(null);
			setVizAnimating(true);

			// Cascade across 20 bars
			const startDelay = Math.round(ANIMATION_DURATION_MS * 0.15);
			const cascadeDuration = ANIMATION_DURATION_MS;
			const perBarDelay = Math.round(cascadeDuration / TOTAL_BARS);

			for (let bar = 1; bar <= TOTAL_BARS; bar++) {
				const timer = setTimeout(
					() => {
						setCascadeProgress(bar);
					},
					startDelay + bar * perBarDelay,
				);
				cascadeTimersRef.current.push(timer);
			}

			// Total: start delay + cascade + settle
			const totalDuration =
				startDelay +
				TOTAL_BARS * perBarDelay +
				Math.round(ANIMATION_DURATION_MS * 0.25);
			const endTimer = setTimeout(() => {
				setVizAnimating(false);
				onDone?.();
			}, totalDuration);
			cascadeTimersRef.current.push(endTimer);
		},
		[clearCascadeTimers],
	);

	/** Show a single page window bar (reward allowed scenario) */
	const runPageWindow = useCallback(
		(barIndex: number) => {
			clearCascadeTimers();
			setVizMode('page-window');
			setCascadeProgress(0);
			setActiveBar(barIndex);
			setVizAnimating(true);

			const timer = setTimeout(
				() => setVizAnimating(false),
				ANIMATION_DURATION_MS,
			);
			cascadeTimersRef.current.push(timer);
		},
		[clearCascadeTimers],
	);

	/** Show overflow state (reward blocked scenario) */
	const runOverflow = useCallback(() => {
		clearCascadeTimers();
		setVizMode('overflow');
		setCascadeProgress(0);
		setActiveBar(null);
		setVizAnimating(true);

		const timer = setTimeout(
			() => setVizAnimating(false),
			ANIMATION_DURATION_MS,
		);
		cascadeTimersRef.current.push(timer);
	}, [clearCascadeTimers]);

	const resetVisualization = useCallback(() => {
		clearCascadeTimers();
		setVizMode('idle');
		setCascadeProgress(0);
		setActiveBar(null);
		setVizAnimating(false);
	}, [clearCascadeTimers]);

	// Cleanup timers on unmount
	useEffect(() => {
		return () => clearCascadeTimers();
	}, [clearCascadeTimers]);

	// ── Zone click handler (observe phase) ──
	const handleZoneClick = useCallback(
		(zoneId: string) => {
			if (phase !== 'observe') return;

			const data = ZONE_INSPECTOR_MAP[zoneId];
			if (!data) return;

			setInspectorData(data);
			setInspectedZones((prev) => {
				if (prev.has(zoneId)) return prev;
				const next = new Set(prev);
				next.add(zoneId);
				return next;
			});

			const discoveryId = ZONE_DISCOVERY_MAP[zoneId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, discoveryGating],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setFiredProbeCount((c) => c + 1);

			// Run cascade animation, trigger discovery after it completes
			runCascade(() => {
				const discoveryId = PROBE_DISCOVERY_MAP[probeId];
				if (discoveryId) {
					discoveryGating.discover(discoveryId);
				}
			});
		},
		[discoveryGating, runCascade],
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

	// ── Reward phase: fire stress scenario ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);

			const page = SCENARIO_PAGE_MAP[scenarioId] ?? 1;
			const barIndex = pageToBar(page);

			if (barIndex !== null) {
				runPageWindow(barIndex);
			} else {
				runOverflow();
			}
		},
		[vizAnimating, stressTest, runPageWindow, runOverflow],
	);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		resetVisualization();
		setPhase('build');
	};

	const handleStartReward = () => {
		resetVisualization();
		setPhase('reward');
		stressTest.reset();
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
		return { valid: true, message: 'Pagination is live!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// Derived viz state
	const isCascading = vizMode === 'cascade' && vizAnimating;
	const isCascadeDone = vizMode === 'cascade' && !vizAnimating;
	const isPageWindow = vizMode === 'page-window';
	const isOverflow = vizMode === 'overflow';

	// Last stress test result for response zone
	const lastResult =
		stressTest.results.length > 0
			? stressTest.results[stressTest.results.length - 1]
			: null;
	const lastScenario = lastResult
		? STRESS_SCENARIOS.find((s) => s.id === lastResult.scenarioId)
		: null;

	// ── Bar state helper ──
	const getBarState = (
		barIndex: number,
	): 'neutral' | 'red' | 'green' | 'dim' => {
		if (phase === 'observe' || (phase === 'reward' && vizMode === 'cascade')) {
			// Cascade: bar-by-bar red fill top-to-bottom
			if (barIndex < cascadeProgress) return 'red';
			return 'neutral';
		}
		if (phase === 'reward') {
			if (isPageWindow && activeBar !== null) {
				return barIndex === activeBar ? 'green' : 'dim';
			}
			if (isOverflow) {
				return 'dim';
			}
		}
		return 'neutral';
	};

	// ── Response zone content ──
	const getResponseContent = (): {
		text: string;
		detail?: string;
		variant: 'neutral' | 'danger' | 'success';
	} => {
		if (phase === 'observe') {
			if (isCascading) {
				const loadedRows = cascadeProgress * RECORDS_PER_BAR;
				return {
					text: `Loading... ${loadedRows.toLocaleString()} / ${TOTAL_RECORDS.toLocaleString()} records`,
					variant: 'danger',
				};
			}
			if (isCascadeDone) {
				return {
					text: '12MB / 50,000 records',
					detail: 'No pagination. No Link headers.',
					variant: 'danger',
				};
			}
			return {
				text: 'Waiting for request...',
				variant: 'neutral',
			};
		}

		// Reward phase
		if (isPageWindow && lastScenario) {
			const page = SCENARIO_PAGE_MAP[lastScenario.id] ?? 1;
			return {
				text: `6KB / 25 records (page ${page})`,
				detail: `Link: </products?page=${Math.max(1, page - 1)}>; rel="prev"`,
				variant: 'success',
			};
		}
		if (isOverflow) {
			return {
				text: 'Page out of range',
				detail: 'Pagy::OverflowError, returned []',
				variant: 'danger',
			};
		}
		return {
			text: 'Fire a scenario to test pagination...',
			variant: 'neutral',
		};
	};

	// ── Visualization render ──
	const renderPageStack = () => {
		const responseContent = getResponseContent();
		const isObserve = phase === 'observe';

		return (
			<div className="flex flex-col items-center gap-1">
				{/* Database Zone */}
				<button
					className={cn(
						'w-full rounded-lg border p-3 text-left transition-colors relative',
						'bg-card',
						isCascading || isCascadeDone
							? 'border-destructive'
							: isPageWindow
								? 'border-emerald-500 dark:border-emerald-400'
								: 'border-border',
						isObserve && 'cursor-pointer hover:border-primary/50',
					)}
					onClick={() => handleZoneClick('database')}
					type="button"
				>
					{/* Zone label */}
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<Database className="w-4 h-4 text-muted-foreground" />
							<span className="text-xs font-semibold text-foreground">
								Database: products ({TOTAL_RECORDS.toLocaleString()} rows)
							</span>
						</div>
						{isObserve && !inspectedZones.has('database') && (
							<span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary animate-pulse">
								<Search className="w-3 h-3" />
							</span>
						)}
						{phase === 'reward' && activeBar !== null && isPageWindow && (
							<span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
								Page {SCENARIO_PAGE_MAP[lastScenario?.id ?? ''] ?? '?'}
							</span>
						)}
					</div>

					{/* Page Stack: 20 horizontal bars */}
					<div className="flex flex-col gap-0.5">
						{BAR_KEYS.map((key, i) => {
							const state = getBarState(i);
							return (
								<div
									className={cn(
										'relative h-3 w-full rounded-sm transition-colors duration-150',
										state === 'neutral' && 'bg-muted-foreground/20',
										state === 'red' && 'bg-red-500 dark:bg-red-400',
										state === 'green' && 'bg-emerald-500 dark:bg-emerald-400',
										state === 'dim' && 'bg-muted-foreground/10',
									)}
									key={key}
								>
									{/* Row label on the right for every 5th bar */}
									{i % 5 === 0 && (
										<span className="absolute right-1 top-0 text-[9px] font-mono text-muted-foreground/60 leading-3">
											{((i + 1) * RECORDS_PER_BAR).toLocaleString()}
										</span>
									)}
								</div>
							);
						})}
					</div>

					{/* Bar legend */}
					<div className="mt-2 text-xs text-muted-foreground">
						Each bar = {RECORDS_PER_BAR.toLocaleString()} records (100 pages)
					</div>
				</button>

				{/* FlowConnector between zones */}
				<FlowConnector
					active={isCascading || (isPageWindow && vizAnimating)}
					direction="vertical"
					dotColor={
						isCascading
							? 'bg-destructive'
							: isPageWindow
								? 'bg-success'
								: 'bg-muted-foreground'
					}
					dotCount={isCascading ? 3 : 1}
				/>

				{/* Response Zone */}
				<button
					className={cn(
						'w-full rounded-lg border p-3 text-left transition-colors relative',
						'bg-card',
						responseContent.variant === 'danger'
							? 'border-destructive'
							: responseContent.variant === 'success'
								? 'border-emerald-500 dark:border-emerald-400'
								: 'border-border',
						isObserve && 'cursor-pointer hover:border-primary/50',
					)}
					onClick={() => handleZoneClick('response')}
					type="button"
				>
					<div className="flex items-center justify-between mb-1">
						<div className="flex items-center gap-2">
							<Globe className="w-4 h-4 text-muted-foreground" />
							<span className="text-xs font-semibold text-foreground">
								Response
							</span>
						</div>
						{isObserve && !inspectedZones.has('response') && (
							<span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary animate-pulse">
								<Search className="w-3 h-3" />
							</span>
						)}
					</div>

					<div
						className={cn(
							'text-sm font-mono font-bold',
							responseContent.variant === 'danger' &&
								'text-red-600 dark:text-red-400',
							responseContent.variant === 'success' &&
								'text-emerald-600 dark:text-emerald-400',
							responseContent.variant === 'neutral' && 'text-muted-foreground',
						)}
					>
						{responseContent.text}
					</div>
					{responseContent.detail && (
						<div
							className={cn(
								'text-xs font-mono mt-1',
								responseContent.variant === 'danger'
									? 'text-red-500/70 dark:text-red-400/70'
									: responseContent.variant === 'success'
										? 'text-emerald-500/70 dark:text-emerald-400/70'
										: 'text-muted-foreground',
							)}
						>
							{responseContent.detail}
						</div>
					)}
				</button>
			</div>
		);
	};

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
							GET /api/products returns all 50,000 products at once. The
							response is 12MB of JSON. Mobile clients crash, and the server
							allocates 180MB per request.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							You need a pagination gem that supports API-style Link headers,
							has a tiny memory footprint, and can handle high-traffic
							endpoints.
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
							{/* Progressive hint for zone click discovery */}
							{firedProbeCount >= 2 &&
								!discoveryGating.isDiscovered('no-pagination') && (
									<Alert
										className="mt-3 animate-in fade-in duration-500"
										variant="info"
									>
										<Info className="w-4 h-4" />
										<AlertDescription className="text-xs">
											Click the{' '}
											<span className="font-medium">Database zone</span> in the
											visualization to inspect why there is no pagination in the
											controller.
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
							<PaginationLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/10 rounded-lg p-3 text-center">
										<div className="text-xs text-muted-foreground mb-1">
											Paginated
										</div>
										<div className="text-2xl font-bold text-success tabular-nums">
											{stressTest.allowedCount}
										</div>
									</div>
									<div className="bg-destructive/10 rounded-lg p-3 text-center">
										<div className="text-xs text-muted-foreground mb-1">
											Out of Range
										</div>
										<div className="text-2xl font-bold text-destructive tabular-nums">
											{stressTest.blockedCount}
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
					levelName="Pagination"
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
						<div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									Page Stack: GET /api/products
								</div>
								{vizMode !== 'idle' && (
									<span
										className={cn(
											'text-xs font-mono font-bold tabular-nums',
											isCascading ? 'text-destructive' : 'text-destructive',
										)}
									>
										{cascadeProgress * RECORDS_PER_BAR > 0
											? `${(cascadeProgress * RECORDS_PER_BAR).toLocaleString()} / ${TOTAL_RECORDS.toLocaleString()} loaded`
											: `${TOTAL_RECORDS.toLocaleString()} records`}
									</span>
								)}
							</div>

							{/* Visualization */}
							<div className="px-6 pb-2">{renderPageStack()}</div>

							{/* StageInspector overlay */}
							{inspectorData && (
								<div className="px-6">
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								</div>
							)}

							{/* Probe terminal */}
							<div className="px-6 pb-2 flex-1 min-h-0 flex flex-col">
								<ProbeTerminal
									className="flex-1 flex flex-col"
									disabled={vizAnimating}
									onProbe={handleProbe}
									probes={PROBES}
									title="Performance Probe"
								/>
							</div>

							{/* Build the Fix button (discovery gated) */}
							<div className="p-4 flex justify-center">
								{discoveryGating.isUnlocked && (
									<Button
										className="gap-2 animate-in fade-in duration-500"
										onClick={handleStartBuild}
										size="lg"
									>
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Terminal step (0: gem install) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={addGemCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Choose the right pagination gem. You need one that is
													fast, memory-efficient, and supports Link headers for
													API clients.
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
											outputLines={addGemOutput}
											stepKey={stepper.currentStep}
											title="Install Pagination Gem"
										/>
									)}

								{/* OptionCard steps (1, 2, 3, 4) */}
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
						<div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									Pagination Active
								</div>
								{vizMode !== 'idle' && (
									<div className="flex items-center gap-2">
										<Zap
											className={cn(
												'w-4 h-4',
												isPageWindow ? 'text-success' : 'text-destructive',
											)}
										/>
										<span
											className={cn(
												'text-xs font-mono font-bold',
												isPageWindow ? 'text-success' : 'text-destructive',
											)}
										>
											{isPageWindow
												? '25 records / 6KB (1 bar)'
												: isOverflow
													? 'page out of range'
													: `${TOTAL_RECORDS.toLocaleString()} records (all ${TOTAL_BARS} bars!)`}
										</span>
									</div>
								)}
							</div>

							{/* Visualization */}
							<div className="px-6 pb-2">{renderPageStack()}</div>

							{/* Stress test controls */}
							<div className="px-6 pb-2 flex-1 min-h-0">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={vizAnimating}
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
				<CodePreviewPanel
					files={getCodeFiles(phase, stepper.furthestStep)}
					learningGoal={
						phase === 'observe'
							? 'Product.includes(:user).all loads every row. The 12MB JSON response has no pagination headers and no way to request a subset.'
							: 'Pagy paginates with offset strategy, 25 per page, and sends RFC 5988 Link headers so clients can navigate pages.'
					}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
							Key Concepts
						</div>
						<div className="space-y-3 text-xs">
							<div className="flex items-start gap-2">
								<Database className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										Pagy::OPTIONS[:limit]
									</span>
									<div className="text-muted-foreground">
										Default page size (25 items per request)
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Zap className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										pagy(:offset, scope)
									</span>
									<div className="text-muted-foreground">
										Returns [pagy_metadata, paginated_collection]
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Globe className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										@pagy.headers_hash
									</span>
									<div className="text-muted-foreground">
										RFC 5988 Link headers for API navigation
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Pagy v43 API Changes
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# v43+ uses Pagy::Method (not Backend)
include Pagy::Method

# v43+ uses OPTIONS (not DEFAULT)
Pagy::OPTIONS[:limit] = 25

# v43+ requires strategy argument
pagy(:offset, Product.all)

# v43+ uses headers_hash method
@pagy.headers_hash`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level26Pagination;
