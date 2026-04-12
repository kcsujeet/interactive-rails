import type { Level } from '@/types';

export const level31HTTPCaching: Level = {
	id: 'act4-level31-http-caching',
	actId: 4,
	levelNumber: 31,
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
			'Same expensive API response computed on every request. 1,000 req/sec all hitting Rails. Even with Rails.cache, every request still reaches the server.',
		rootCause:
			'No HTTP-level caching. No Cache-Control headers, no ETags, no CDN. Every request makes a full round-trip to the server.',
		codeExample: `# app/services/post_detail.rb
class PostDetail < ApplicationService
  Result = Data.define(:post)
  def call
    product = Product.find(@id)
    Result.new(post: post)
  end
end

# app/controllers/api/v1/products_controller.rb
def show
  result = PostDetail.call(id: params[:id])
  render json: result.post  # No caching headers!
end

# Every request, even if the post hasn't changed:
#   First request:  200 OK in 21ms (2 queries)
#   Second request: 200 OK in 21ms (same computation)
#
# No Cache-Control headers means:
# - Browsers don't cache API responses
# - CDNs can't cache anything
# - Every user request hits Rails`,
		goal: 'Explore uncached HTTP requests to discover the problem, then configure Cache-Control headers, ETags, and CDN caching for different endpoint types.',
		thresholds: { maxLatency: 10 },
	},
	successConditions: [{ type: 'cdn_configured' }],
	availableNodes: ['cache'],
	unlockedNodes: [],
	learningContent: {
		title: 'HTTP Caching: Cache-Control, ETags & CDNs',
		goal: `In this level, you'll:\n- learn HTTP-level caching, the first line of defense that prevents requests from reaching your server at all.\n- use conditional requests and ETags to return 304 Not Modified.\n- configure Cache-Control headers for different scenarios.\n- set up CDN caching for static assets.`,
		conceptExplanation: `HTTP-level caching is the first line of defense before requests even hit Rails. It prevents requests from reaching your server at all.

**Production benchmarks:**
\`\`\`
No HTTP caching:
  First request:  200 OK in 21ms (ActiveRecord: 9.6ms, 2 queries)
  Second request: 200 OK in 21ms (same computation repeated)

With ETag + stale?:
  First request:  200 OK in 21ms (ActiveRecord: 9.6ms, 2 queries)
  Second request: 304 Not Modified in 6ms (1 query, no serialization) → 3.5x faster

With CDN:
  Without CDN: Client → Origin server (60-100ms round trip)
  With CDN:    Client → Edge server (~5ms) → cache hit → instant response
\`\`\`

**How ETags work:**
1. Rails generates a weak ETag (hash of response body)
2. Browser sends it back as \`If-None-Match\` on next request
3. If the post hasn't changed, Rails returns 304 (empty body)
4. No serialization, no rendering, no second DB query
5. The \`stale?\` helper checks \`post.updated_at\` in a single fast query

**Key Cache-Control directives:**
- \`max-age=N\`: Client can reuse for N seconds without asking server
- \`s-max-age=N\`: Same but for shared caches (CDN) only
- \`no-cache\`: Can be cached, but MUST revalidate with origin on every use
- \`public\`: CDN and browser can both cache
- \`private\`: Only browser can cache (user-specific data)
- \`stale-while-revalidate=N\`: Serve stale cache while fetching fresh copy in background
- \`immutable\`: Asset will never change (use with fingerprinted filenames)

**CDN benefits:**
- Geographically distributed edge servers
- User in Tokyo hits a CDN edge in Tokyo: sub-10ms response
- Without CDN, the request travels to your server in Virginia: 60-100ms
- For static assets with fingerprinted filenames: set \`max-age: 1 year\` + \`immutable\`
- Asset URL changes on every deploy, so stale cache is impossible`,
		railsCodeExample: `# === Service provides data, controller handles HTTP caching ===

# app/services/post_detail.rb
class PostDetail < ApplicationService
  Result = Data.define(:post)
  def call
    product = Product.find(@id)
    Result.new(post: post)
  end
end

# app/controllers/api/v1/products_controller.rb
def show
  result = PostDetail.call(id: params[:id])

  # Returns 304 Not Modified if post hasn't changed
  if stale?(result.post)
    render json: result.post
  end
end

# app/controllers/api/v1/products_controller.rb
def index
  result = ProductCatalog.call

  # CDN + browser cache for 1 hour
  expires_in 1.hour, public: true,
    's-max-age': 3600

  render json: result.products
end

# === Cache-Control strategies ===

# Public data (CDN + browser):
#   Cache-Control: public, s-max-age=3600
# User-specific data (browser only):
#   Cache-Control: private, max-age=60, stale-while-revalidate=30
# Fingerprinted assets (immutable):
#   Cache-Control: public, max-age=31536000, immutable

# === CDN configuration ===
# config/environments/production.rb
config.asset_host = "https://cdn.example.com"
config.public_file_server.headers = {
  "Cache-Control" => "public, max-age=31536000, immutable"
}

# === Conditional GET flow ===
# Client: GET /api/posts/42, If-None-Match: "abc123"
# Server: 304 Not Modified (empty body, 6ms vs 21ms)`,
		commonMistakes: [
			'Not using stale? for GET endpoints (every request recomputes the response)',
			"Setting Cache-Control: public on user-specific data (CDN would serve wrong user's data)",
			'Not using fingerprinted asset filenames (stale CSS/JS after deploy)',
			'Setting very long max-age without ETag (no way to invalidate if data changes)',
			'Forgetting to add s-maxage for CDN (defaults to max-age which might be too short)',
		],
		whenToUse:
			'Every read-heavy GET endpoint. Use ETags for dynamic content (API responses). Use long max-age + immutable for static assets with fingerprinted filenames. Add a CDN for geographically distributed users.',
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
	},
	hint: {
		delay: 20,
		text: 'Click pipeline stages and fire HTTP probes to see how every request hits the origin server. Discover all 4 problems to unlock the build phase.',
	},
};
