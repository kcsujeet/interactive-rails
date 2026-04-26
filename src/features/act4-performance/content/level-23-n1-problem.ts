import type { Level } from '@/types';

export const level23N1Problem: Level = {
	id: 'act4-level23-n1-problem',
	actId: 4,
	levelNumber: 23,
	name: 'The N+1 Problem',
	trigger: {
		type: 'performance_alert',
		description:
			'10K users hit the API daily. Response times crept above 2 seconds. Explore the request pipeline, trace the query explosion, then set up Prosopite to catch N+1 automatically.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 480,
				y: 250,
				locked: true,
			},
			{
				id: 'product-model',
				type: 'model',
				x: 720,
				y: 140,
				locked: true,
				config: { label: 'Product' },
			},
			{
				id: 'author-model',
				type: 'model',
				x: 720,
				y: 360,
				locked: true,
				config: { label: 'User' },
			},
			{ id: 'database-node', type: 'database', x: 960, y: 250, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 480,
				y: 460,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 720, y: 460, locked: true },
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
			{ id: 'c5', sourceNodeId: 'product-model', targetNodeId: 'author-model' },
			{ id: 'c6', sourceNodeId: 'author-model', targetNodeId: 'database-node' },
			{
				id: 'c7',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c8',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'`/api/products` runs 101 queries for 100 products. Each product triggers an extra query to fetch its user.',
		rootCause:
			'N+1 query pattern: 1 query loads all products, then N individual queries load each user.',
		codeExample: `# app/services/product_list.rb
class ProductList < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def call
    validation = ListContract.new.call({})
    return Result.new(...) if validation.failure?

    products = Product.all  # No eager loading!
    Result.new(success?: true, products: products, errors: [])
  end
end

# app/serializers/product_serializer.rb
class ProductSerializer < BaseSerializer
  attribute :name
  attribute :description

  attribute :author_name do |product|
    product.user.name  # <-- triggers a query PER PRODUCT
  end
end

# Database log:
#   Product Load (2.1ms)  SELECT "products".* FROM "products"
#   User Load (0.3ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 1
#   User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 2
#   User Load (0.3ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 3
#   ... 97 more queries
#
# Total: 101 queries, 850ms`,
		goal: 'Explore the pipeline to find the N+1 pattern. Then add automatic N+1 detection and prevent lazy-loading regressions at the model level.',
		thresholds: { maxQueriesPerRequest: 5 },
	},
	successConditions: [{ type: 'n1_identified' }],
	requiresTests: true,
	availableNodes: [],
	unlockedNodes: ['eager_load'],
	learningContent: {
		title: 'The N+1 Query Problem & Detection',
		goal: `In this level, you'll:\n- learn to spot the N+1 query problem, the most common performance killer in Rails apps.\n- understand why loading 100 products generates 101 database queries.\n- trace the problem back to association access in serializers.\n- add automatic N+1 detection that raises in development.\n- prevent lazy-loading regressions at the model level.`,
		conceptExplanation: `The N+1 problem is the most common performance killer in Rails apps. It happens when you load a collection of records (1 query) and then access an association on each record (N queries).

**The math is brutal:**
- 100 products = 101 queries
- 1,000 products = 1,001 queries
- 10,000 products = 10,001 queries

It scales linearly with data size. What works in development with 10 records becomes a disaster in production with 10,000. Twitter's early timeline had this exact problem: loading each tweet's author triggered a separate query.

**Production benchmarks (N+1 vs preloaded at scale):**
\`\`\`
N+1:     4.873s | 1,564 MB | 5,301,574 objects allocated
Preload: 0.195s |   682 MB |   148,827 objects allocated
→ 25x faster, 2.3x less memory, 35x fewer objects
\`\`\`

**Detection tools:**
- **Prosopite gem**: Monitors SQL patterns rather than association access. Catches N+1 through raw SQL, \`find_each\` blocks, and any code path that generates duplicate SQL patterns. Raises \`Prosopite::NPlusOneQueriesError\` in development. Requires \`pg_query\` gem for PostgreSQL
- **strict_loading**: Rails built-in. Raises \`ActiveRecord::StrictLoadingViolationError\` when you lazy-load an association that was not eager-loaded. Set per-model or per-query

**Where N+1 hides:**
- Serializers (accessing associations during rendering)
- Views (iterating and calling association methods)
- Scopes with dependent queries
- Callbacks that touch associations
- \`find_each\` blocks with association access`,
		railsCodeExample: `# The problem: N+1 queries
@products = Product.all  # 1 query: SELECT * FROM products

# In serializer or view:
@products.each do |product|
  product.user.name       # +1 query per product
  product.reviews.count  # +1 query per product (even worse: N+1+N)
end
# Total: 1 + N + N queries!

# === Prosopite setup (N+1 detector) ===
# Gemfile
gem 'prosopite'
gem 'pg_query'  # Required for PostgreSQL SQL fingerprinting

# config/environments/development.rb
config.after_initialize do
  Prosopite.rails_logger = true
  Prosopite.raise = true  # Raises error on N+1 in dev
end

# In tests (catch N+1 regressions):
# test/test_helper.rb
Prosopite.rails_logger = true
Prosopite.raise = true

# Prosopite monitors SQL patterns. It detects N+1 through:
# - Raw SQL queries
# - find_each blocks that trigger per-record queries
# - Any code path that generates duplicate SQL patterns

# === strict_loading (Rails built-in) ===
# Per-model default:
class Product < ApplicationRecord
  self.strict_loading_by_default = true
end

# Per-query:
Product.strict_loading.includes(:user).each { |p| p.user }
# Without includes, this raises StrictLoadingViolationError`,
		commonMistakes: [
			'Not using Prosopite in development (catches N+1 patterns automatically)',
			'Assuming eager loading is always the fix (sometimes you need to restructure)',
			'Only checking controller queries (N+1 often hides in serializers)',
			'Ignoring N+1 in tests because test data is small',
		],
		whenToUse:
			'Always check for N+1 when iterating over records and accessing associations. Install Prosopite in every Rails project from day one.',
		furtherReading: [
			{
				title: 'Prosopite README',
				url: 'https://github.com/charkost/prosopite/blob/main/README.md',
			},
			{
				title: 'ActiveRecord Eager Loading Guide',
				url: 'https://guides.rubyonrails.org/active_record_querying.html#eager-loading-associations',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 2',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Click pipeline stages and fire probes at different data sizes. Watch how query count scales with product count.',
	},
};
