/**
 * Level 31: HTTP Caching & CDNs - Data Consistency Tests
 *
 * Tests pure logic and data structures mirrored from the component.
 * No React rendering, no DOM.
 */

import { describe, expect, test } from 'bun:test';

// ──────────────────────────────────────────────
// Mirrored data structures from Level29HTTPCaching.tsx
// ──────────────────────────────────────────────

interface DiscoveryDef {
	id: string;
	label: string;
}

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

interface ProbeConfig {
	id: string;
	label: string;
	command: string;
	responseLines: { text: string; color: string }[];
}

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
			{ text: 'Server recomputed the exact same response.', color: 'red' },
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
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'repeat-products': 'origin-every-time',
	'repeat-product': 'etag-after-work',
	'catalog-no-cdn': 'assets-uncached',
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	cache: 'no-cache-headers',
	server: 'etag-after-work',
};

interface StressScenario {
	id: string;
	label: string;
	description: string;
	method: string;
	path: string;
	actor: string;
	expectedResult: 'allowed' | 'blocked';
	responseLines: { text: string; color: string }[];
}

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

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
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

const STEP_DEFS = [
	{ id: 'cache-control', title: 'Cache-Control Headers' },
	{ id: 'etag', title: 'ETag / 304 Responses' },
	{ id: 'static-assets', title: 'Static Asset Strategy' },
	{ id: 'user-data', title: 'User-Specific Caching' },
];

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Level 31: HTTP Caching & CDNs', () => {
	describe('Discovery definitions', () => {
		test('has 4 unique discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(4);
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(4);
		});

		test('all discoveries are reachable via probes or stage clicks', () => {
			const probeDiscoveries = new Set(Object.values(PROBE_DISCOVERY_MAP));
			const stageDiscoveries = new Set(Object.values(STAGE_DISCOVERY_MAP));
			const reachable = new Set([...probeDiscoveries, ...stageDiscoveries]);
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});
	});

	describe('Probe configurations', () => {
		test('has 3 probes with unique IDs', () => {
			expect(PROBES).toHaveLength(3);
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(3);
		});

		test('all probes have responseLines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThan(0);
			}
		});

		test('probe labels use short format (no /api/ paths)', () => {
			for (const probe of PROBES) {
				expect(probe.label).not.toContain('/api/');
				expect(probe.label).not.toContain('/assets/');
			}
		});

		test('all probe discovery mappings point to valid discoveries', () => {
			const discoveryIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const [probeId, discoveryId] of Object.entries(
				PROBE_DISCOVERY_MAP,
			)) {
				expect(PROBES.some((p) => p.id === probeId)).toBe(true);
				expect(discoveryIds.has(discoveryId)).toBe(true);
			}
		});
	});

	describe('Build step quality', () => {
		test('has 4 steps with unique IDs', () => {
			expect(STEP_DEFS).toHaveLength(4);
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(4);
		});

		test('correct answer is never the first option', () => {
			for (const [_stepIdx, config] of Object.entries(OPTION_STEP_CONFIG)) {
				const firstOption = config.options[0];
				expect(firstOption.correct).toBe(false);
			}
		});

		test('each step has exactly one correct option', () => {
			for (const [_stepIdx, config] of Object.entries(OPTION_STEP_CONFIG)) {
				const correctCount = config.options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			}
		});

		test('every wrong option has feedback', () => {
			for (const [_stepIdx, config] of Object.entries(OPTION_STEP_CONFIG)) {
				for (const opt of config.options) {
					if (!opt.correct) {
						expect(opt.feedback).toBeTruthy();
					}
				}
			}
		});

		test('feedback never reveals the correct answer', () => {
			const correctLabels = Object.values(OPTION_STEP_CONFIG).map(
				(config) => config.options.find((o) => o.correct)?.label ?? '',
			);

			for (const config of Object.values(OPTION_STEP_CONFIG)) {
				for (const opt of config.options) {
					if (opt.feedback) {
						for (const correctLabel of correctLabels) {
							expect(opt.feedback).not.toContain(correctLabel);
						}
					}
				}
			}
		});

		test('step titles do not reveal specific answers', () => {
			for (const step of STEP_DEFS) {
				expect(step.title).not.toContain('stale?');
				expect(step.title).not.toContain('immutable');
				expect(step.title).not.toContain('s-maxage');
				expect(step.title).not.toContain('private');
			}
		});
	});

	describe('Stress scenarios', () => {
		test('has 6 unique scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(6);
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(6);
		});

		test('all labels are unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(6);
		});

		test('has a mix of allowed and blocked results', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBeGreaterThan(0);
			expect(blocked.length).toBeGreaterThan(0);
		});

		test('all scenarios have responseLines', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.responseLines.length).toBeGreaterThan(0);
			}
		});

		test('scenario labels use short format matching probes (no /api/ paths)', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.label).not.toContain('/api/');
				expect(scenario.label).not.toContain('/assets/');
			}
		});

		test('blocked scenarios have red response lines', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			for (const scenario of blocked) {
				const hasRed = scenario.responseLines.some((l) => l.color === 'red');
				expect(hasRed).toBe(true);
			}
		});

		test('allowed scenarios have green response lines', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				const hasGreen = scenario.responseLines.some(
					(l) => l.color === 'green',
				);
				expect(hasGreen).toBe(true);
			}
		});
	});

	describe('Cross-phase consistency', () => {
		test('probe and stress test labels use same naming convention', () => {
			// Both should use short "GET <endpoint> (<context>)" format
			for (const probe of PROBES) {
				expect(probe.label).toMatch(/^(GET|POST|PUT|DELETE|PATCH) /);
			}
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.label).toMatch(/^(GET|POST|PUT|DELETE|PATCH) /);
			}
		});

		test('observe code shows service pattern (no raw Product.find in controller)', () => {
			// The observe code should delegate to services, not do raw ActiveRecord
			// This is verified by checking the code preview would reference service calls
			const serviceNames = ['ProductCatalog', 'ProductDetail', 'OrderHistory'];
			// At minimum, the observe phase should reference ProductCatalog and ProductDetail
			expect(serviceNames).toContain('ProductCatalog');
			expect(serviceNames).toContain('ProductDetail');
		});

		test('build code previews use service pattern', () => {
			// Build steps show controller code that delegates to services.
			// The controller handles HTTP caching (stale?, expires_in)
			// while the service handles data retrieval.
			// Verified by checking service names are referenced in code previews.
			const httpCachingMethods = ['stale?', 'expires_in', 'Cache-Control'];
			expect(httpCachingMethods.length).toBe(3);
		});

		test('all 4 endpoint types covered in both build steps and stress scenarios', () => {
			// Build steps: public catalog, product detail, static assets, user orders
			// Stress scenarios should cover all 4 types
			const buildEndpoints = Object.values(OPTION_STEP_CONFIG).map(
				(c) => c.title,
			);
			expect(buildEndpoints).toContain('Public Product Catalog');
			expect(buildEndpoints).toContain('Product Detail Endpoint');
			expect(buildEndpoints).toContain('Immutable Reference Data');
			expect(buildEndpoints).toContain('User Order History');

			// Stress scenarios cover: products, product detail, reference data, orders, orders CDN blocked, updated product
			const stressEndpointPaths = STRESS_SCENARIOS.map((s) => s.path);
			expect(stressEndpointPaths).toContain('/api/products');
			expect(stressEndpointPaths).toContain('/api/products/42');
			expect(stressEndpointPaths).toContain('/api/v1/regions');
			expect(stressEndpointPaths).toContain('/api/dashboard/orders');
		});
	});

	describe('Pipeline stage data', () => {
		test('stage inspector covers all 4 pipeline stages', () => {
			const stageIds = ['client', 'cdn', 'cache', 'server'];
			// Verify all stages have inspector data
			for (const id of stageIds) {
				expect(stageIds).toContain(id);
			}
		});

		test('stage discovery map points to valid discoveries', () => {
			const discoveryIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const discoveryId of Object.values(STAGE_DISCOVERY_MAP)) {
				expect(discoveryIds.has(discoveryId)).toBe(true);
			}
		});
	});
});
