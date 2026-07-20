/**
 * Level 29: HTTP Caching & CDNs
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration of uncached HTTP requests.
 *   Click pipeline stages to inspect code. Fire probes to see every request
 *   hitting the origin server at full cost. Discovery gating unlocks build.
 * Phase 2 (HOW - build): 4 OptionCard steps choosing Cache-Control strategies
 *   for different endpoint types (public catalog, ETag, static assets, private data).
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire request scenarios and watch
 *   cache hits, 304s, and CDN edge responses.
 *
 * Teaches: Cache-Control, ETags, 304 responses, CDN configuration, stale?
 */

import { ArrowRight, Check, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';

registerLevelCode('act4-level29-http-caching', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'no-cache-headers', label: 'No Cache-Control headers on responses' },
	{
		id: 'etag-after-work',
		label:
			'Stock ETag saves bandwidth, but only after the full response is rebuilt',
	},
	{ id: 'origin-every-time', label: 'Every request hits the origin server' },
	{
		id: 'assets-uncached',
		label: 'No CDN edge caching for the public catalog',
	},
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'repeat-products',
		label: 'GET products (repeat)',
		command: 'GET /api/products (first), then GET /api/products (second)',
		responseLines: [
			{ text: 'Request 1: 200 OK in 200ms (origin)', color: 'red' },
			{ text: 'Request 2: 200 OK in 200ms (origin)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No Cache-Control header, so no cache may store this.',
				color: 'yellow',
			},
			{
				text: 'Server recomputed the exact same response.',
				color: 'red',
			},
		],
		story: [
			'A customer visits the product listing, then navigates back to it seconds later.',
			'Both requests return 200 OK with the full response body.',
			'The server recomputed the exact same response from scratch both times.',
			'No Cache-Control header is set, so no browser or CDN may store the response.',
		],
	},
	{
		id: 'repeat-product',
		label: 'GET product detail (repeat)',
		command: 'GET /api/products/42 (first), then GET /api/products/42 (second)',
		responseLines: [
			{ text: 'Request 1: 200 OK in 21ms (query + serialize)', color: 'red' },
			{
				text: 'Request 2: 304 Not Modified in 20ms (still queried + serialized)',
				color: 'yellow',
			},
			{ text: '', color: 'muted' },
			{
				text: 'Stock Rack::ETag hashed the body, so the 304 saved bandwidth.',
				color: 'yellow',
			},
			{
				text: 'But the full query + serialize ran first to build that body.',
				color: 'red',
			},
		],
		story: [
			'A customer views a product detail page, then refreshes the page.',
			'The product has not changed. Stock Rails ships Rack::ETag, so it hashes the response body and returns 304 the second time.',
			'The 304 saves download bandwidth, but the server still ran the full query and serialization to build the body it then hashed.',
			'A validator derived from the record could skip all that work before rendering.',
		],
	},
	{
		id: 'catalog-no-cdn',
		label: 'GET products from 3 regions',
		command: 'GET /api/products from Tokyo, Sydney, London',
		responseLines: [
			{ text: 'Tokyo:  200 OK in 180ms (origin, Virginia)', color: 'red' },
			{ text: 'Sydney: 200 OK in 220ms (origin, Virginia)', color: 'red' },
			{ text: 'London: 200 OK in 90ms  (origin, Virginia)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No s-maxage, so a CDN edge is not allowed to cache this.',
				color: 'yellow',
			},
			{
				text: 'Every user in every region pays the full round-trip to origin.',
				color: 'red',
			},
		],
		story: [
			'Customers in Tokyo, Sydney, and London all open the public product catalog.',
			'The catalog is identical for every user and changes only about once an hour.',
			'With no s-maxage directive, a CDN edge is not permitted to cache the response.',
			'Every request travels all the way to the origin server in Virginia.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'repeat-products': 'origin-every-time',
	'repeat-product': 'etag-after-work',
	'catalog-no-cdn': 'assets-uncached',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ cacheSublabel: string; serverBadge: string }
> = {
	'repeat-products': {
		cacheSublabel: 'MISS (no Cache-Control)',
		serverBadge: '200',
	},
	'repeat-product': {
		cacheSublabel: 'full work, then 304',
		serverBadge: '304',
	},
	'catalog-no-cdn': {
		cacheSublabel: 'MISS (no s-maxage)',
		serverBadge: '200',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	client: {
		stageId: 'client',
		title: 'Browser / API Client',
		description:
			'The client makes HTTP requests. Without caching headers, it has no way to know if a response is still fresh. Every navigation or API call triggers a full round-trip to the server.',
	},
	cdn: {
		stageId: 'cdn',
		title: 'CDN Edge (Not Configured)',
		description:
			"No CDN is configured. All requests travel directly to the origin server, regardless of the user's location. A user in Tokyo waits 60-100ms for a round-trip to Virginia.",
	},
	cache: {
		stageId: 'cache',
		title: 'HTTP Cache Layer (No Cache-Control)',
		description:
			'No Cache-Control header is set, so browsers and CDNs are not allowed to store responses. Stock Rails does add a weak ETag (see the server stage), but without Cache-Control nothing is cached and every request still reaches Rails.',
		code: `# What the response carries today:
response.headers
# => { "Content-Type" => "application/json",
#      "ETag" => "W/\\"<hash of body>\\"" }
# Present: weak ETag (added by Rack::ETag)
# Missing: Cache-Control (max-age / s-maxage)`,
	},
	server: {
		stageId: 'server',
		title: 'Rails Origin Server',
		description:
			'Stock Rails wraps every response in Rack::ETag, which hashes the finished body and returns 304 when it matches. That saves download bandwidth, but the full query and serialization run first to produce the body being hashed. A stale?(record) check derives the validator from the record and returns 304 before any of that work happens.',
		code: `# app/controllers/api/products_controller.rb
def show
  result = ProductDetail.call(id: params[:id])
  # No stale? / fresh_when: the body is always built.
  # Rack::ETag then hashes it and may return 304,
  # but query + serialize already ran.
  render json: result.product
end`,
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	cache: 'no-cache-headers',
	server: 'etag-after-work',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'public-catalog-hit',
		label: 'GET products (CDN hit)',
		description: 'Repeat request for product catalog, CDN has it cached',
		method: 'GET',
		path: '/api/products',
		actor: 'any user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'CDN Edge: HIT (5ms)', color: 'green' },
			{ text: 'Cache-Control: public, s-maxage=3600', color: 'yellow' },
			{ text: 'Origin server not contacted.', color: 'green' },
		],
	},
	{
		id: 'product-304',
		label: 'GET product detail (304)',
		description: 'Product unchanged since last request, ETag matches',
		method: 'GET',
		path: '/api/products/42',
		actor: 'returning visitor',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '304 Not Modified (6ms)', color: 'green' },
			{ text: 'If-None-Match matched current ETag', color: 'yellow' },
			{ text: 'No body, no serialization.', color: 'green' },
		],
	},
	{
		id: 'static-immutable',
		label: 'GET regions (cached)',
		description: 'Versioned reference endpoint served from browser cache',
		method: 'GET',
		path: '/api/v1/regions',
		actor: 'any user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'from disk cache (0ms)', color: 'green' },
			{
				text: 'Cache-Control: public, max-age=31536000, immutable',
				color: 'yellow',
			},
			{ text: 'No network request at all.', color: 'green' },
		],
	},
	{
		id: 'private-browser',
		label: 'GET orders (browser cache)',
		description: 'User-specific orders served from private browser cache',
		method: 'GET',
		path: '/api/dashboard/orders',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'from browser cache (0ms)', color: 'green' },
			{ text: 'Cache-Control: private, max-age=60', color: 'yellow' },
			{ text: 'User-specific data served locally.', color: 'green' },
		],
	},
	{
		id: 'private-cdn-blocked',
		label: 'GET orders via CDN (blocked)',
		description:
			'CDN tries to cache private user data, rejected by private directive',
		method: 'GET',
		path: '/api/dashboard/orders',
		actor: 'CDN edge server',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'CDN Edge: REJECTED', color: 'red' },
			{ text: 'Cache-Control: private blocks shared caches', color: 'yellow' },
			{ text: 'User data protected from CDN storage.', color: 'red' },
		],
	},
	{
		id: 'stale-product',
		label: 'GET product detail (updated)',
		description: 'Product was updated, ETag changed, full response needed',
		method: 'GET',
		path: '/api/products/42',
		actor: 'returning visitor',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK (21ms, full response)', color: 'green' },
			{ text: 'If-None-Match did not match current ETag', color: 'yellow' },
			{ text: 'Product updated, fresh response generated.', color: 'green' },
		],
	},
];

// ──────────────────────────────────────────────
// Step definitions (build phase: 4 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'cache-control', title: 'Cache-Control Headers' },
	{ id: 'etag', title: 'ETag / 304 Responses' },
	{ id: 'static-assets', title: 'Static Asset Strategy' },
	{ id: 'user-data', title: 'User-Specific Caching' },
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
	0: {
		title: 'Public Product Catalog',
		description:
			'A public product catalog endpoint. Same data served to all users. Changes once per hour. Which Cache-Control strategy?',
		options: [
			{
				id: 'private-no-store',
				label: 'Cache-Control: private, no-store',
				correct: false,
				feedback:
					'This prevents ALL caching, both browser and CDN. For public data that rarely changes, you want caches to store and serve it.',
			},
			{
				id: 'public-s-maxage',
				label: 'Cache-Control: public, s-maxage=3600',
				correct: true,
			},
			{
				id: 'no-cache-revalidate',
				label: 'Cache-Control: no-cache, must-revalidate',
				correct: false,
				feedback:
					'This forces revalidation on every single request, far too aggressive for data that only changes once per hour.',
			},
		],
	},
	1: {
		title: 'Product Detail Endpoint',
		description:
			'Single product detail endpoint. Product changes infrequently. Want to avoid re-serializing unchanged data. Which caching approach?',
		options: [
			{
				id: 'expires-in',
				label: 'expires_in 24.hours, public: true',
				correct: false,
				feedback:
					'Time-based expiration means clients have no way to know when the product is actually updated. They may serve stale data or miss updates entirely.',
			},
			{
				id: 'fresh-when',
				label: 'fresh_when @product',
				correct: false,
				feedback:
					'fresh_when sets the validator but only halts Rails implicit rendering. This action renders JSON explicitly, so you need the form that returns a boolean you can branch on to skip the explicit render.',
			},
			{
				id: 'stale',
				label: 'stale? @product',
				correct: true,
			},
		],
	},
	2: {
		title: 'Immutable Reference Data',
		description:
			'A versioned reference endpoint (e.g. GET /api/v1/regions) whose payload never changes for a given version: a new version means a new URL. Which Cache-Control header lets the CDN and browser hold it as long as possible?',
		options: [
			{
				id: 'max-age-1day',
				label: 'Cache-Control: public, max-age=86400',
				correct: false,
				feedback:
					'Only caches for 1 day. A versioned resource whose URL changes when the data changes can be cached far longer than that.',
			},
			{
				id: 'no-cache',
				label: 'Cache-Control: no-cache',
				correct: false,
				feedback:
					'Forces revalidation on every request, which defeats the point of a versioned URL that is guaranteed never to change its contents.',
			},
			{
				id: 'immutable',
				label: 'Cache-Control: public, max-age=31536000, immutable',
				correct: true,
			},
		],
	},
	3: {
		title: 'User Order History',
		description:
			"Dashboard showing user's own order history. Different for every user. Which Cache-Control header?",
		options: [
			{
				id: 'public-s-maxage',
				label: 'Cache-Control: public, s-maxage=300',
				correct: false,
				feedback:
					"Public means the CDN caches it. Other users could see someone else's order history. This is a critical security issue for user-specific data.",
			},
			{
				id: 'private-swr',
				label: 'Cache-Control: private, max-age=60, stale-while-revalidate=30',
				correct: true,
			},
			{
				id: 'public-vary',
				label: 'Cache-Control: public, max-age=60, Vary: Cookie',
				correct: false,
				feedback:
					'Vary: Cookie technically segments by cookie, but CDNs handle Vary poorly. Many will just bypass the cache entirely, defeating the purpose.',
			},
		],
	},
};

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'client', to: 'cdn', dots: 'mixed' },
	{ from: 'cdn', to: 'cache', dots: 'mixed' },
	{ from: 'cache', to: 'server', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'client', to: 'cdn', dots: 'clean' },
	{ from: 'cdn', to: 'cache', dots: 'clean' },
	{ from: 'cache', to: 'server', dots: 'clean' },
];

// Every probe/scenario is a request traversing the full pipeline, so a fire
// activates every edge as a single-pass burst. Dormant until the first fire.
const OBSERVE_CONNECTION_IDS = OBSERVE_CONNECTIONS.map(
	(c) => `${c.from}-${c.to}`,
);
const REWARD_CONNECTION_IDS = REWARD_CONNECTIONS.map(
	(c) => `${c.from}-${c.to}`,
);

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show service pattern but no HTTP caching
	if (phase === 'observe') {
		files.push({
			filename: 'app/services/product_catalog.rb',
			language: 'ruby',
			code: `class ProductCatalog < ApplicationService
  Result = Data.define(:products)

  def call
    products = Product.includes(:category).all
    Result.new(products: products)
  end
end`,
			highlight: [],
		});
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `class Api::ProductsController < ApplicationController
  def index
    result = ProductCatalog.call
    # No Cache-Control headers
    # CDN can't help, browser re-fetches every time
    render json: result.products
  end
end`,
			highlight: [4, 5],
		});
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `class Api::ProductsController < ApplicationController
  def show
    result = ProductDetail.call(id: params[:id])
    # No stale? check. Rack::ETag still hashes the
    # body and may return 304, but only after the
    # full query + serialize has already run.
    render json: result.product
  end
end`,
			highlight: [4, 5, 6],
		});
		return files;
	}

	// Build / reward: show evolving code with service pattern
	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `class Api::ProductsController < ApplicationController
  def index
    result = ProductCatalog.call
    # No caching: every request hits the server
    render json: result.products
  end
end`,
			highlight: [],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `class Api::ProductsController < ApplicationController
  def index
    result = ProductCatalog.call

    # CDN + browser cache for 1 hour
    expires_in 1.hour, public: true,
      's-maxage': 3600

    render json: result.products
  end
end`,
			highlight: [5, 6, 7],
		});
	}

	if (furthestStep >= 2) {
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `class Api::ProductsController < ApplicationController
  def show
    result = ProductDetail.call(id: params[:id])

    # ETag from product content
    # Returns 304 if unchanged
    if stale?(result.product)
      render json: result.product
    end
    # If not stale, Rails auto-returns 304
  end
end`,
			highlight: [6, 7, 8, 9],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/controllers/api/regions_controller.rb',
			language: 'ruby',
			code: `class Api::V1::RegionsController < ApplicationController
  def index
    # Versioned, immutable reference data.
    # A new version means a new URL, so the CDN
    # and browser can hold it for a year.
    expires_in 1.year, public: true
    response.headers["Cache-Control"] += ", immutable"

    render json: Region.all
  end
end`,
			highlight: [6, 7],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'app/controllers/api/dashboard_controller.rb',
			language: 'ruby',
			code: `class Api::DashboardController < ApplicationController
  before_action :authenticate_user!

  def orders
    result = OrderHistory.call(user: current_user)

    # Private: browser only, no CDN
    # SWR: serve stale while fetching fresh
    expires_in 1.minute,
      private: true,
      stale_while_revalidate: 30.seconds

    render json: result.orders
  end
end`,
			highlight: [9, 10, 11],
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
				Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">Cache hit / 304 (served fast)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">Blocked by private directive</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level29HTTPCaching({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);
	const [probeTick, setProbeTick] = useState(0);

	// ── Build observe stages dynamically (tracks inspected + last probe) ──
	const probeDisplay = lastProbeId ? PROBE_PIPELINE_MAP[lastProbeId] : null;
	const observeStages: PipelineStage[] = useMemo(
		() => [
			{
				id: 'client',
				label: 'Client',
				inspectable: true,
				inspected: inspectedStages.has('client'),
			},
			{
				id: 'cdn',
				label: 'CDN',
				sublabel: probeDisplay
					? probeDisplay.cacheSublabel
					: '(not configured)',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('cdn'),
			},
			{
				id: 'cache',
				label: 'HTTP Cache',
				sublabel: probeDisplay ? probeDisplay.cacheSublabel : '(no headers)',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('cache'),
			},
			{
				id: 'server',
				label: 'Rails Server',
				badge: probeDisplay ? probeDisplay.serverBadge : undefined,
				variant: (probeDisplay ? 'danger' : 'default') as 'danger' | 'default',
				inspectable: true,
				inspected: inspectedStages.has('server'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		const scenario = lastResult
			? STRESS_SCENARIOS.find((s) => s.id === lastResult.scenarioId)
			: null;

		// Determine what type of cache response this is
		const isCdnHit = scenario?.id === 'public-catalog-hit';
		const is304 = scenario?.id === 'product-304';
		// The product was updated: ETag no longer matches, full 200 response.
		const isFullResponse = scenario?.id === 'stale-product';
		const isBrowserCache =
			scenario?.id === 'static-immutable' || scenario?.id === 'private-browser';

		return [
			{ id: 'client', label: 'Client' },
			{
				id: 'cdn',
				label: 'CDN Edge',
				sublabel: wasBlocked
					? 'private, skip'
					: isCdnHit
						? 'HIT (5ms)'
						: 'PASS',
				variant: wasBlocked
					? ('danger' as const)
					: isCdnHit
						? ('active' as const)
						: ('default' as const),
				badge: wasBlocked ? 'BLOCKED' : isCdnHit ? 'HIT' : undefined,
			},
			{
				id: 'cache',
				label: 'HTTP Cache',
				sublabel: wasBlocked
					? 'rejected'
					: is304
						? '304 Not Modified'
						: isFullResponse
							? 'ETag changed, 200'
							: isBrowserCache
								? 'from cache (0ms)'
								: 'cache active',
				variant: wasBlocked
					? ('danger' as const)
					: isFullResponse
						? ('default' as const)
						: ('active' as const),
				badge: is304 ? '304' : isFullResponse ? '200' : undefined,
			},
			{
				id: 'server',
				label: 'Rails Server',
				sublabel: wasBlocked
					? 'never reached'
					: isCdnHit || isBrowserCache
						? 'skipped'
						: is304
							? 'stale? short-circuit, no render'
							: isFullResponse
								? 'full render (product changed)'
								: undefined,
			},
		];
	}, [lastResult]);

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
			setProbeTick((tick) => tick + 1);
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

	const handleStartReward = () => {
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
		return { valid: true, message: 'HTTP caching strategy configured!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

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
							Your API serves every response from scratch. No caching headers,
							no ETags, no CDN. 1,000 requests per second all computing the same
							response.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							HTTP caching can prevent requests from reaching Rails at all. The
							right{' '}
							<span className="text-foreground font-medium">Cache-Control</span>{' '}
							header depends on who the data is for and how often it changes.
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
							<PipelineLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Served</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Blocked</div>
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
					levelName="HTTP Caching"
					levelNumber={29}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									activeConnections={lastProbeId ? OBSERVE_CONNECTION_IDS : []}
									animationTick={probeTick}
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

							{/* Probe terminal (bounded, not flex-fill) */}
							<div className="px-6 pb-4">
								<ProbeTerminal
									onProbe={handleProbe}
									probes={PROBES}
									title="HTTP Probe"
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
												hasNextStep ? stepper.nextStep : handleStartReward
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

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									activeConnections={
										stressTest.results.length > 0 ? REWARD_CONNECTION_IDS : []
									}
									animationTick={stressTest.results.length}
									connections={REWARD_CONNECTIONS}
									stages={rewardStages}
								/>
							</div>

							{/* Stress test controls below pipeline (bounded, not flex-fill) */}
							<div className="px-6 pb-4">
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
				<CodePreviewPanel
					files={getCodeFiles(phase, stepper.furthestStep)}
					learningGoal="HTTP caching lets browsers and CDNs serve responses without hitting your server. The right Cache-Control header depends on who the data is for and how often it changes."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level29HTTPCaching;
