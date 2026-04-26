import type { Level } from '@/types';

export const level30Caching: Level = {
	id: 'act4-level30-caching',
	actId: 4,
	levelNumber: 30,
	name: 'Caching',
	trigger: {
		type: 'scaling',
		description:
			'The trending products endpoint computes rankings from 50K products on every request. 200 identical computations per minute, each taking 512ms. Explore the request layers, discover the missing cache, then add Solid Cache.',
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
			'The TrendingProducts service recomputes rankings on every request. 200 requests/minute, each taking 512ms. Database at 170% capacity.',
		rootCause:
			'No caching layer. Every request recomputes the same result from scratch.',
		codeExample: `# app/services/trending_products.rb
class TrendingProducts < ApplicationService
  Result = Data.define(:products, :generated_at)

  def call
    validation = TrendingContract.new.call({})
    return Result.new(
      products: [], generated_at: Time.current
    ) if validation.failure?

    # Runs on EVERY request, 200 times/minute
    products = Product
      .joins(:reviews)
      .where("products.created_at > ?", 7.days.ago)
      .group("products.id")
      .select("products.*, COUNT(reviews.id) AS score")
      .order("score DESC")
      .limit(20)
      .includes(:user)

    Result.new(products: products, generated_at: Time.current)
  end
end

# 200 req/min * 512ms = 1,707ms DB time/sec
# Database at 170% of available capacity!`,
		goal: 'Add application-level caching so expensive computations are only run once, with automatic invalidation when underlying data changes.',
		thresholds: { minCacheHitRate: 95, maxLatency: 20 },
	},
	successConditions: [{ type: 'caching_configured' }],
	requiresTests: true,
	availableNodes: ['cache'],
	unlockedNodes: ['cache'],
	learningContent: {
		title: 'Caching: Fragment, Russian Doll & Solid Cache',
		goal: `In this level, you'll:\n- install a database-backed cache store for Rails 8 (no Redis required).\n- run the installer and prepare the cache database.\n- configure the production cache store.\n- wrap expensive queries with cache reads that expire automatically.\n- set up automatic cache invalidation when associated records change.`,
		conceptExplanation: `Rails 8 introduces **Solid Cache**, a database-backed cache store that replaces Redis for most caching needs. No additional infrastructure required.

**Production benchmarks:**
\`\`\`
No caching (with preloading):  ~3,800ms (sheer data volume + ranking)
Fragment cache (cache hit):    17ms → 317x faster
\`\`\`

**Application-level caching layers (from fastest to slowest):**

1. **Fragment caching**: Cache rendered view/JSON fragments
   - Wrap a view section in a \`cache\` block. Cache version auto-generated from \`MAX(updated_at)\` + \`COUNT(*)\`
   - On cache hit, the entire serialization step is skipped. Rails returns pre-computed JSON directly
   - The 317x improvement comes from avoiding all object allocation, serializer logic, and JSON generation

2. **Russian doll caching**: Nested cache blocks
   - Outer collection cache + inner per-record cache
   - One product update only re-renders that product's fragment, not the entire collection
   - Still must execute SQL to fetch product IDs, but saves serialization time

3. **Low-level cache (Rails.cache)**: Cached in your cache store
   - \`Rails.cache.fetch("key", expires_in: 1.hour) { expensive_query }\`
   - First request computes and stores; subsequent requests read from cache

4. **Query cache**: Automatic within a single request
   - Rails caches identical SQL queries within the same request
   - Zero configuration, but only helps within a single request

**Cache store comparison (choose wisely):**
- **SolidCache** (Rails 8 default): DB-backed, allows much larger caches. ~40% slower reads than Redis, but 6x larger cache on 80% cheaper storage (per 37Signals). Use a separate database/connection pool from primary
- **Memcached**: Faster than Redis for simple key-value. Strings only, LRU eviction. No persistence; data lost on restart. Good for pure fragment caching
- **Redis**: Persistent (AOF/RDB). Data structures (lists, sets, sorted sets, hashes). Atomic operations (INCR, LPUSH). 6 eviction policies. Better for complex cases and pub/sub
- **\`:memory_store\`**: Per-process only (32MB default). Data duplicated across Puma workers → reduced hit rate. Dev/test only

**DHH's expiration key pattern:** Put the expiration key inside the cache key itself. Simpler logic but generates garbage (old keys stay until evicted).

**Write-through caching:** Update cache at write time, not read time. Reading becomes O(1). Trade-off: slower writes.

**Cache invalidation strategies:**
- Time-based: \`expires_in: 5.minutes\`
- Key-based: Include the record's \`updated_at\` in the cache key
- Manual: \`Rails.cache.delete("key")\`
- Touch: \`belongs_to :product, touch: true\` cascades cache invalidation

**Real-world pattern, fan-out writing (how Twitter worked with Rails):**
On each new product, write the product ID into a cached "timeline" list for every follower. Reading a feed becomes \`Product.where(id: cached_ids)\`, trivial. The "Justin Bieber problem": celebrity with millions of followers, each product triggers millions of cache writes. Solution: mixed fan-out. Regular users get fan-out writes; celebrities are exempt (their products fetched via direct DB query at read time).`,
		railsCodeExample: `# === Solid Cache Setup (Rails 8) ===

# Gemfile
gem "solid_cache"

# config/cache.yml (auto-generated by solid_cache:install)
production:
  database: cache

# config/environments/production.rb
config.cache_store = :solid_cache_store

# === Service with Caching ===

# app/services/trending_products.rb
class TrendingProducts < ApplicationService
  Result = Data.define(:products, :generated_at)

  def call
    validation = TrendingContract.new.call({})
    return Result.new(
      products: [], generated_at: Time.current
    ) if validation.failure?

    products = Rails.cache.fetch(
      "trending_products", expires_in: 5.minutes
    ) do
      Product
        .joins(:reviews)
        .where("products.created_at > ?", 7.days.ago)
        .group("products.id")
        .select("products.*, COUNT(reviews.id) AS score")
        .order("score DESC")
        .limit(20)
        .includes(:user)
        .to_a  # Materialize before caching
    end

    Result.new(products: products, generated_at: Time.current)
  end
end

# Controller stays thin:
result = TrendingProducts.call
render json: ProductSerializer.new(result.products)

# === Cache Invalidation ===
class Review < ApplicationRecord
  belongs_to :product, touch: true
end

# Next level: HTTP caching (ETags, Cache-Control, CDNs)
# to prevent requests from reaching Rails at all.`,
		commonMistakes: [
			'Caching ActiveRecord relations instead of materialized arrays (use .to_a)',
			'Not setting expiration times (stale data forever)',
			'Cache keys that do not include updated_at (stale after updates)',
			'Over-caching dynamic/personalized content',
			'Forgetting touch: true on belongs_to (child changes do not invalidate parent cache)',
		],
		whenToUse:
			'Cache any computation that runs more than once with the same result. Start with Solid Cache (database-backed). Graduate to Redis/Memcached only if you measure a need.',
		furtherReading: [
			{
				title: 'Rails Caching Guide',
				url: 'https://guides.rubyonrails.org/caching_with_rails.html',
			},
			{
				title: 'Solid Cache',
				url: 'https://github.com/rails/solid_cache',
			},
			{
				title:
					'Book: "Rails Scales!", Chapter 3: Fragment Caching, Russian Doll, Cache Stores',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Click the service layer to inspect its code. Fire all three probes to see the same query running repeatedly without interception.',
	},
};
