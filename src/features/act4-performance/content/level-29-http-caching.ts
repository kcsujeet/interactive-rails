import type { Level } from '@/types';

export const level29HTTPCaching: Level = {
	id: 'act4-level29-http-caching',
	actId: 4,
	levelNumber: 29,
	name: 'HTTP Caching & CDNs',
	trigger: {
		type: 'scaling',
		description:
			'Your Rails caching is great, but every request still hits the server. 1,000 req/sec all computing the same API response. HTTP caching can prevent requests from reaching Rails at all.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 460,
				y: 220,
				locked: true,
			},
			{
				id: 'product-model',
				type: 'model',
				x: 660,
				y: 220,
				locked: true,
				config: { label: 'Product' },
			},
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 460,
				y: 400,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 660, y: 400, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{
				id: 'c2',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{
				id: 'c3',
				sourceNodeId: 'controller-node',
				targetNodeId: 'product-model',
			},
			{
				id: 'c4',
				sourceNodeId: 'product-model',
				targetNodeId: 'database-node',
			},
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c6',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'Same expensive API response computed on every request. 1,000 req/sec all hitting Rails. Even with Rails.cache, every request still reaches the server, and the stock weak ETag only trims bandwidth after the full response has already been rebuilt.',
		rootCause:
			'No Cache-Control headers (so nothing may be cached) and no record-derived conditional GET (so the stock ETag saves bandwidth but never skips the query and serialization). No CDN edge caching.',
		codeExample: `# app/services/product_detail.rb
class ProductDetail < ApplicationService
  Result = Data.define(:product)
  def call
    product = Product.find(@id)
    Result.new(product: product)
  end
end

# app/controllers/api/products_controller.rb
def show
  result = ProductDetail.call(id: params[:id])
  render json: result.product  # No stale? / no Cache-Control
end

# Stock Rails (Rack::ETag) still adds a weak ETag:
#   First request:  200 OK in 21ms (2 queries + serialize)
#   Second request: 304 Not Modified in 20ms
#     (bandwidth saved, but query + serialize still ran)
#
# No Cache-Control header means:
# - No browser or CDN may store the response
# - Every user request still reaches Rails
# - stale?(record) would skip the work before render`,
		goal: 'Explore uncached HTTP requests to discover the problem, then configure Cache-Control headers, ETags, and CDN caching for different endpoint types.',
		thresholds: { maxLatency: 10 },
	},
	successConditions: [{ type: 'cdn_configured' }],
	availableNodes: ['cache'],
	unlockedNodes: [],
	learningContent: {
		title: 'HTTP Caching: Cache-Control, ETags & CDNs',
		goal: `In this level, you'll:\n- learn HTTP-level caching, the first line of defense that prevents requests from reaching your server at all.\n- use conditional requests and ETags to return 304 Not Modified.\n- configure Cache-Control headers for different scenarios.\n- set up CDN edge caching for public API responses.`,
		conceptExplanation: `HTTP-level caching is the first line of defense before requests even hit Rails. It prevents requests from reaching your server at all.

**Production benchmarks:**
\`\`\`
No HTTP caching:
  First request:  200 OK in 21ms (ActiveRecord: 9.6ms, 2 queries)
  Second request: 200 OK in 21ms (same computation repeated)

Stock Rails (Rack::ETag only):
  First request:  200 OK in 21ms (ActiveRecord: 9.6ms, 2 queries)
  Second request: 304 Not Modified in 20ms (STILL queried + serialized) → bandwidth saved, compute wasted

With stale?(record):
  First request:  200 OK in 21ms (ActiveRecord: 9.6ms, 2 queries)
  Second request: 304 Not Modified in 6ms (1 cheap query, no serialize) → 3.5x faster

With CDN:
  Without CDN: Client → Origin server (60-100ms round trip)
  With CDN:    Client → Edge server (~5ms) → cache hit → instant response
\`\`\`

**Two different ETag mechanisms (this is the key distinction):**

*Stock Rails ships \`Rack::ETag\` + \`Rack::ConditionalGet\`.* Every GET already gets a weak ETag: Rails runs your action to completion, builds the full response body, then hashes that body into the ETag. If the incoming \`If-None-Match\` matches, it strips the body and returns 304. This saves download **bandwidth**, but the query and serialization already ran to produce the body it hashed. It is a bandwidth win, not a compute win.

*\`stale?(record)\` / \`fresh_when(record)\` are different.* They derive the validator from the record itself (its \`cache_key\`, backed by \`updated_at\`) using one cheap query, BEFORE you render. If the request is fresh, \`stale?\` returns \`false\`, you skip the \`render json:\` block entirely, and Rails returns 304 having done almost no work. That is the **compute** win: no serialization, no full body build.

- \`stale?\` returns a boolean and wraps an explicit \`render json:\` (the API-controller shape).
- \`fresh_when\` sets the validator and halts Rails implicit rendering, so it fits actions that render implicitly.

**Key Cache-Control directives:**
- \`max-age=N\`: Client can reuse for N seconds without asking server
- \`s-maxage=N\`: Same but for shared caches (CDN) only
- \`no-cache\`: Can be cached, but MUST revalidate with origin on every use
- \`public\`: CDN and browser can both cache
- \`private\`: Only browser can cache (user-specific data)
- \`stale-while-revalidate=N\`: Serve stale cache while fetching fresh copy in background
- \`immutable\`: The resource at this URL will never change (use with versioned URLs)

**CDN benefits:**
- Geographically distributed edge servers
- User in Tokyo hits a CDN edge in Tokyo: sub-10ms response
- Without CDN, the request travels to your server in Virginia: 60-100ms
- For versioned reference endpoints (a new version means a new URL): set \`max-age: 1 year\` + \`immutable\`
- The URL changes when the data changes, so a stale cache is impossible`,
		railsCodeExample: `# === Service provides data, controller handles HTTP caching ===

# app/services/product_detail.rb
class ProductDetail < ApplicationService
  Result = Data.define(:product)
  def call
    product = Product.find(@id)
    Result.new(product: product)
  end
end

# app/controllers/api/products_controller.rb
def show
  result = ProductDetail.call(id: params[:id])

  # Returns 304 Not Modified if product hasn't changed
  if stale?(result.product)
    render json: result.product
  end
end

# app/controllers/api/products_controller.rb
def index
  result = ProductCatalog.call

  # CDN + browser cache for 1 hour
  expires_in 1.hour, public: true,
    's-maxage': 3600

  render json: result.products
end

# === Cache-Control strategies ===

# Public data (CDN + browser):
#   Cache-Control: public, s-maxage=3600
# User-specific data (browser only):
#   Cache-Control: private, max-age=60, stale-while-revalidate=30
# Versioned/immutable reference data (a new version = new URL):
#   Cache-Control: public, max-age=31536000, immutable

# === CDN in front of the API ===
# This is an API-only app; Rails does not serve the React
# bundle (a static host / CDN does). Rails 8 production also
# already sets far-future Cache-Control on any files it does
# serve from public/. So the lever here is the Cache-Control
# on your API responses, which tells the CDN edge what it may
# store and for how long.

# === Conditional GET flow (stale?) ===
# Client: GET /api/products/42, If-None-Match: "abc123"
# Server: stale? derives the validator from the record,
#         returns 304 (empty body, 6ms) WITHOUT re-serializing`,
		commonMistakes: [
			'Not using stale? for GET endpoints (the stock ETag saves bandwidth but the query and serialize still run every time)',
			"Setting Cache-Control: public on user-specific data (CDN would serve wrong user's data)",
			'Relying on the stock body-hash ETag for compute savings (it is computed after the full response is built)',
			'Setting a very long max-age on data that can change without giving the URL a version (no way to invalidate)',
			'Forgetting to add s-maxage for the CDN (defaults to max-age, which might be too short for a shared edge cache)',
		],
		whenToUse:
			'Every read-heavy GET endpoint. Use stale?/fresh_when for dynamic content (API responses) so a 304 skips the work, not just the bandwidth. Use long max-age + immutable for versioned reference data. Add a CDN and s-maxage for geographically distributed users.',
		furtherReading: [
			{
				title: 'Rails fresh_when and stale?',
				url: 'https://api.rubyonrails.org/classes/ActionController/ConditionalGet.html',
			},
			{
				title: 'MDN Cache-Control',
				url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 5: HTTP Headers, ETags, CDNs',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
		homework: [
			{
				task: 'Wrap your products show action in stale?(product), then replay the request with the ETag the first response gave you.',
				commands: [
					'curl -i http://localhost:3000/api/v1/products/1',
					`curl -i http://localhost:3000/api/v1/products/1 -H 'If-None-Match: "<etag from first response>"'`,
				],
				verify:
					'The first response is 200 with an ETag header; the replay returns 304 Not Modified with an empty body and no serialization work.',
			},
			{
				task: 'Add expires_in 1.hour, public: true to the products index action and inspect the headers.',
				commands: ['curl -i http://localhost:3000/api/v1/products'],
				verify:
					'The index response carries Cache-Control: public, max-age=3600, telling browsers and CDNs they may reuse it for an hour without hitting Rails.',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Click pipeline stages and fire HTTP probes to see how every request hits the origin server. Discover all 4 problems to unlock the build phase.',
	},
};
