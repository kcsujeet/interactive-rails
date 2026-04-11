/**
 * Act 4: Performance
 * "10K users. API is slow. Database groaning."
 *
 * Levels 23-31: N+1 Problem, Eager Loading, Narrow Fetching, Database Indexing, Counter Caches, Pagination, Search, Caching, HTTP Caching & CDNs
 * App context: Blog API at scale. 10K users, 50K posts, millions of queries
 */

import type { Act, Level } from '@/types';

// ============================================
// Level 23: The N+1 Problem
// ============================================

const level23N1Problem: Level = {
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
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'product-model' },
			{ id: 'c4', sourceNodeId: 'product-model', targetNodeId: 'database-node' },
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
			'`/api/posts` runs 101 queries for 100 posts. Each post triggers an extra query to fetch its user.',
		rootCause:
			'N+1 query pattern: 1 query loads all posts, then N individual queries load each user.',
		codeExample: `# app/services/post_list.rb
class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call
    validation = ListContract.new.call({})
    return Result.new(...) if validation.failure?

    products = Product.all  # No eager loading!
    Result.new(success?: true, posts: posts, errors: [])
  end
end

# app/serializers/product_serializer.rb
class ProductSerializer < BaseSerializer
  attribute :title
  attribute :body

  attribute :author_name do |post|
    product.user.name  # <-- triggers a query PER POST
  end
end

# Database log:
#   Product Load (2.1ms)  SELECT "posts".* FROM "posts"
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
		goal: `In this level, you'll:\n- learn to spot the N+1 query problem, the most common performance killer in Rails apps.\n- understand why loading 100 posts generates 101 database queries.\n- trace the problem back to association access in serializers.\n- add automatic N+1 detection that raises in development.\n- prevent lazy-loading regressions at the model level.`,
		conceptExplanation: `The N+1 problem is the most common performance killer in Rails apps. It happens when you load a collection of records (1 query) and then access an association on each record (N queries).

**The math is brutal:**
- 100 posts = 101 queries
- 1,000 posts = 1,001 queries
- 10,000 posts = 10,001 queries

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
@posts = Product.all  # 1 query: SELECT * FROM posts

# In serializer or view:
@posts.each do |post|
  product.user.name       # +1 query per post
  product.reviews.count  # +1 query per post (even worse: N+1+N)
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
		text: 'Click pipeline stages and fire probes at different data sizes. Watch how query count scales with post count.',
	},
};

// ============================================
// Level 24: Eager Loading
// ============================================

const level24EagerLoading: Level = {
	id: 'act4-level24-eager-loading',
	actId: 4,
	levelNumber: 24,
	name: 'Eager Loading',
	trigger: {
		type: 'optimization',
		description:
			'Compare four loading strategies (includes, preload, eager_load, joins) across three scenarios to discover which strategy fits which situation.',
	},
	problem: {
		observation:
			'No eager loading strategy selected. Different scenarios need different approaches, and joins is a common trap that does not prevent N+1.',
		rootCause:
			'Associations are lazy-loaded by default. Rails only queries the database when you first access the association.',
		codeExample: `# app/services/post_list.rb
class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call
    validation = ListContract.new.call({})
    return Result.new(...) if validation.failure?

    products = Product.all  # No eager loading!
    Result.new(success?: true, posts: posts, errors: [])
  end
end

# Rails provides three strategies:
Product.includes(:user)     # Smart default: 2 queries or JOIN
Product.preload(:user)      # Always 2 separate queries
Product.eager_load(:user)   # Always LEFT OUTER JOIN (1 query)

# Common trap: joins does NOT prevent N+1!
Product.joins(:user)  # INNER JOINs but does NOT load user records`,
		goal: 'Test four loading strategies against three scenarios, discover why each strategy fits different situations, then apply the right fix for basic includes, nested associations, and filtered queries.',
		thresholds: { maxQueriesPerRequest: 3, maxLatency: 50 },
	},
	successConditions: [{ type: 'eager_loading_applied' }],
	requiresTests: true,
	availableNodes: ['eager_load'],
	unlockedNodes: [],
	learningContent: {
		title: 'Eager Loading: includes vs preload vs eager_load',
		goal: `In this level, you'll:\n- fix the N+1 problem using eager loading.\n- learn the three Rails strategies for loading associations in bulk.\n- understand when to use each strategy based on query shape, memory usage, and filtering needs.`,
		conceptExplanation: `Rails provides three eager loading methods. Each works differently, and the choice matters for both speed AND memory:

**\`includes\`** (recommended default):
- Rails decides: 2 separate queries OR a LEFT OUTER JOIN
- Uses JOIN when you filter on the association (e.g., \`.where(users: { active: true })\`)
- Uses separate queries otherwise (usually faster for simple cases)

**\`preload\`** (force separate queries, 25x faster, LESS memory):
- Always runs 2 separate queries
- 148K objects allocated vs 250K for eager_load; separate simple queries create fewer temporary objects
- Best when you DON'T filter by the associated table

**\`eager_load\`** (force JOIN, 20x faster, MORE memory):
- Always uses LEFT OUTER JOIN in a single query
- Required when filtering/ordering by the association (\`Product.eager_load(:user).where(users: {role: 'admin'})\`)
- Allocates more objects because the JOIN returns wider result rows

**\`joins\`** (NEVER for preventing N+1):
- INNER JOINs but does NOT load association records into memory
- You will still get N+1 when you access associations after \`joins\`
- This is a common misconception

**Production benchmarks (simple scenario, posts with users):**
\`\`\`
N+1:        Real 9.545s | User 4.873s | 1,564 MB | 5,301,574 objects
Preload:    Real 1.34s  | User 0.195s |   682 MB |   148,827 objects → 25x faster
Eager Load: Real 0.99s  | User 0.238s |   697 MB |   250,610 objects → 20x faster
\`\`\`

**Why preload beats eager_load on memory:** \`preload\` runs separate simple queries, creating fewer temporary objects. \`eager_load\` builds a single wide JOIN result; the database returns more columns per row, and ActiveRecord must allocate more intermediate objects to parse the wider result set.

**Complex scenario (posts per category per user, at scale):**
\`\`\`
N+1:        Real 73.191s
Preload:    Real 17.468s → 23x faster
Eager Load: Real 16.898s → 16x faster
\`\`\`

**Nested eager loading:**
- \`Product.includes(reviews: :user)\`: load reviews AND each review's user
- \`Product.includes(:user, :tags, reviews: [:user, :likes])\`: multiple levels

**strict_loading (Rails 6.1+):**
- Raises an error if you access a non-eager-loaded association
- Catches N+1 at runtime instead of silently degrading`,
		railsCodeExample: `# === Decision tree: which method to use? ===
#
# Do you filter/sort by the associated table?
#   YES → eager_load (needs JOIN for WHERE/ORDER BY)
#   NO  → Do you need ActiveRecord objects?
#         YES → preload (separate queries, less memory)
#         NO  → pluck (raw arrays, minimal memory)

# includes: smart default (use this most of the time)
Product.includes(:user)
# Query 1: SELECT "posts".* FROM "posts"
# Query 2: SELECT "users".* FROM "users" WHERE "users"."id" IN (1, 2, 3...)

# includes with filtering (auto-switches to JOIN)
Product.includes(:user).where(users: { role: 'admin' })
# SELECT "posts".* FROM "posts"
#   LEFT OUTER JOIN "users" ON "users"."id" = "posts"."user_id"
#   WHERE "users"."role" = 'admin'

# preload: force 2 queries (less memory than eager_load)
Product.preload(:user)
# Always 2 separate queries, even with .where
# 148K objects vs 250K for eager_load

# eager_load: force JOIN (required for filtering)
Product.eager_load(:user).where(users: { active: true })
# Always 1 query with LEFT OUTER JOIN

# joins: DOES NOT prevent N+1 (common mistake!)
Product.joins(:user).where(users: { role: 'admin' })
# INNER JOINs but does NOT load user records into memory
# product.user.name → STILL triggers a separate query!

# Nested eager loading
Product.includes(reviews: :user)
# Query 1: SELECT "posts".* FROM "posts"
# Query 2: SELECT "reviews".* FROM "reviews" WHERE product_id IN (...)
# Query 3: SELECT "users".* FROM "users" WHERE id IN (...)

# strict_loading: catch N+1 at runtime
Product.strict_loading.all
# Raises ActiveRecord::StrictLoadingViolationError if you access product.user

# Per-model strict loading
class Product < ApplicationRecord
  self.strict_loading_by_default = true
end
# Next level: narrow fetching (select/pluck) to fetch only needed columns`,
		commonMistakes: [
			'Using joins thinking it prevents N+1 (it INNER JOINs but does NOT load associations)',
			'Using eager_load when preload would use less memory (JOIN creates wider result rows)',
			'Eager loading associations you never access (wastes memory)',
			'Not nesting includes for deeply nested serializers',
			'Forgetting strict_loading to prevent future N+1 regressions',
		],
		whenToUse:
			"Use includes by default (let Rails decide). Use preload when you DON'T filter by the associated table (less memory). Use eager_load when you DO filter by the associated table (requires JOIN).",
		furtherReading: [
			{
				title: 'ActiveRecord Eager Loading',
				url: 'https://guides.rubyonrails.org/active_record_querying.html#eager-loading-associations',
			},
			{
				title: 'Strict Loading (Rails 6.1+)',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Core/ClassMethods.html#method-i-strict_loading_by_default-3D',
			},
			{
				title: 'Join Decomposition (Why Separate Queries Can Beat JOINs)',
				url: 'https://dev.mysql.com/doc/refman/8.0/en/optimization.html',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 2: Preloading Methods',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Fire probes to test each scenario against the four strategy cards. Click strategy cards to inspect their SQL patterns and discover the differences.',
	},
};

// ============================================
// Level 25: Narrow Fetching
// ============================================

const level25NarrowFetching: Level = {
	id: 'act4-level25-narrow-fetching',
	actId: 4,
	levelNumber: 25,
	name: 'Narrow Fetching',
	trigger: {
		type: 'performance_alert',
		description:
			'Multiple endpoints are eating memory. Explore the Data Table Heatmap to see how SELECT * loads 30 columns when only 2 are needed, then choose the right fetching strategy for each scenario.',
	},
	problem: {
		observation:
			'Several endpoints use SELECT * when they only need a few columns. A CSV export loads 50K full objects for just id and email. A dropdown fetches 10K AR objects for simple key-value pairs. A nightly sync loads everything at once instead of batching.',
		rootCause:
			'SELECT * fetches every column including large TEXT fields. No narrow fetching (pluck/select) or batch processing (find_in_batches).',
		codeExample: `# app/services/user_export.rb
class UserExport < ApplicationService
  Result = Data.define(:success?, :csv, :errors)

  def call
    validation = ExportContract.new.call({})
    return Result.new(...) if validation.failure?

    # SELECT * FROM users -- loads ALL 30 columns for 2 values
    users = User.all
    csv = CSV.generate { |csv| users.each { |u| csv << [u.id, u.email] } }
    Result.new(success?: true, csv: csv, errors: [])
  end
end
# Memory: 681 MB (only needed 2 columns!)

# Dropdown -- full AR objects for key-value pairs
categories = Category.all
categories.map { |c| [c.id, c.name] }
# Creates 10K AR objects for simple data

# Nightly sync -- loads 50K records at once
User.all.each { |u| SyncService.process(u) }
# Entire dataset in memory simultaneously`,
		goal: 'Explore the data table to discover why SELECT * wastes memory, then choose the right fetching strategy for each scenario.',
		thresholds: { maxMemoryUsage: 50 },
	},
	successConditions: [{ type: 'queries_optimized' }],
	requiresTests: true,
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Narrow Fetching: pluck, select & find_in_batches',
		goal: `In this level, you'll:\n- learn how to fetch only the data you actually need.\n- choose between raw arrays and lightweight model objects for different use cases.\n- process large datasets in manageable chunks instead of loading everything into memory.`,
		conceptExplanation: `After fixing N+1 and adding eager loading, the next performance win is fetching less data: not just fewer queries, but fewer columns and smaller batches.

**Production benchmarks (10K posts with 75KB body column):**
\`\`\`
Product.all (wide):           212ms | 681 MB  | 149,000 objects
Product.select(:id, :title):  53ms |  12 MB  | 107,000 objects → 4x faster, 56x less memory
Product.pluck(:id, :title):   18ms |   2 MB  |  45,000 objects → 12x faster, 290x less memory
\`\`\`

**Real-world endpoint comparison at scale:**
\`\`\`
Product.all (wide):     1,101ms (742ms in DB)
Product.pluck (narrow): 76ms → 14x improvement
\`\`\`

**Three tools for narrow fetching:**

**\`pluck(:col1, :col2)\`** returns plain Ruby arrays:
- No ActiveRecord objects created, lowest memory possible
- Returns \`[[1, "Title"], [2, "Other"]]\` not AR objects
- Use when you only need data values (CSV export, dropdown options, IDs for queries)

**\`select(:col1, :col2)\`** returns lightweight AR objects:
- Still creates AR objects, but skips unused columns
- Use when you need model methods (validations, associations, callbacks)
- Accessing an unselected column raises \`ActiveModel::MissingAttributeError\`

**\`find_in_batches(batch_size: 1000)\`** processes huge datasets:
- Generates \`LIMIT 1000 WHERE id > last_seen_id\` queries
- Only 1,000 records in memory at a time instead of 50,000
- Essential for exports, backfills, and data migrations

**Rule of thumb:**
- Prefer \`pluck\` when you only need data values
- Use \`select\` only when you need model methods
- Use \`find_in_batches\` when processing huge datasets

**Real-world story:** An unpaginated endpoint returning only \`id\` and \`name\` was timing out. Root cause: table had 30+ columns including serialized objects in TEXT fields. One user had stored the entire U.S. Constitution in a text field. The \`SELECT *\` forced the DB to write to disk mid-response.`,
		railsCodeExample: `# === pluck: raw arrays, minimal memory ===
Product.where(published: true).pluck(:id, :title)
# => [[1, "Laptop"], [2, "Phone"]]
# SELECT id, title FROM posts WHERE published = true
# No AR objects! Just arrays.

# === select: lightweight AR objects ===
Product.select(:id, :title, :user_id).includes(:user)
# SELECT id, title, user_id FROM posts
# AR objects with only 3 columns loaded
# post.body → raises ActiveModel::MissingAttributeError

# === find_in_batches: process huge datasets ===
Product.find_in_batches(batch_size: 1000) do |batch|
  csv_rows = batch.pluck(:id, :title).map { |r| r.join(",") }
  File.open("export.csv", "a") { |f| f.write(csv_rows.join("\\n")) }
end
# Generates: SELECT * FROM posts WHERE id > 0 LIMIT 1000
#            SELECT * FROM posts WHERE id > 1000 LIMIT 1000
#            ... (1000 records at a time, not 50K at once)

# === Combine for maximum efficiency ===
# Export endpoint (production-safe):
def export
  headers["Content-Type"] = "text/csv"
  headers["Content-Disposition"] = "attachment; filename=posts.csv"

  # Stream CSV in batches, never loads all records at once
  Product.active.find_in_batches(batch_size: 2000) do |batch|
    rows = batch.pluck(:id, :title, :created_at)
    response.stream.write(rows.map { |r| r.join(",") }.join("\\n") + "\\n")
  end
ensure
  response.stream.close
end

# === For dropdown/autocomplete: pluck, don't load objects ===
# BAD: loads full AR objects just for a dropdown
User.all.map { |u| [u.id, u.name] }
# GOOD: returns just the data you need
User.pluck(:id, :name)`,
		commonMistakes: [
			'Using Product.all when you only need 2-3 columns (loads all 30 columns)',
			'Not using find_in_batches for large dataset processing (memory explosion)',
			'Using .length on a collection to get count (loads all records, use .count)',
			'Forgetting that select raises MissingAttributeError for unselected columns',
			'Using pluck inside a loop (N+1 pluck calls; batch the query instead)',
		],
		whenToUse:
			'Any endpoint that returns data from wide tables (10+ columns) or processes large datasets (1K+ records). CSV exports, admin dashboards, dropdown data, background data processing.',
		furtherReading: [
			{
				title: 'ActiveRecord pluck',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Calculations.html#method-i-pluck',
			},
			{
				title: 'ActiveRecord find_in_batches',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Batches.html',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 2: Wide vs Narrow Fetching',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Click column headers and fire probes to explore the waste. The big_text_column header reveals why TEXT columns dominate memory.',
	},
};

// ============================================
// Level 26: Database Indexing
// ============================================

const level26DatabaseIndexing: Level = {
	id: 'act4-level26-database-indexing',
	actId: 4,
	levelNumber: 26,
	name: 'Database Indexing',
	trigger: {
		type: 'performance_alert',
		description:
			'Fire EXPLAIN probes to watch sequential scans crawl through every row, then add the right indexes to make the database jump straight to the answer.',
	},
	problem: {
		observation:
			'`GET /api/users?email=...` does a full table scan on 10,000 rows. EXPLAIN shows Seq Scan with no index usage.',
		rootCause:
			'No database index on the email column. The database must scan every row to find a match.',
		codeExample: `# app/services/user_lookup.rb
class UserLookup < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def call
    user = User.find_by!(email: @email)
    Result.new(success?: true, user: user, errors: [])
  end
end

# Controller delegates to service:
# result = UserLookup.call(email: params[:email])

# EXPLAIN ANALYZE output:
# Seq Scan on users  (cost=0.00..245.00 rows=1 width=128)
#   Filter: ((email)::text = 'alice@example.com'::text)
#   Rows Removed by Filter: 9999
#   Planning Time: 0.1ms
#   Execution Time: 82.3ms
#
# A sequential scan checks EVERY row. With 10K users this is
# slow. With 1M users it will be catastrophic.

# Common queries that need indexes:
User.find_by(email: params[:email])          # WHERE email = ?
Product.where(user_id: user.id)                 # Foreign key lookup
Product.where(published: true).order(:created_at) # Composite query`,
		goal: 'Generate a migration, add the right indexes for your query patterns, and verify the database uses index scans instead of sequential scans.',
		thresholds: { maxLatency: 10 },
	},
	successConditions: [{ type: 'queries_optimized' }],
	requiresTests: true,
	learningContent: {
		title: 'Database Indexing & EXPLAIN',
		goal: `In this level, you'll:\n- learn how database indexes dramatically speed up queries.\n- add indexes to columns used in filtering, sorting, and joining.\n- read query execution plans to tell the difference between slow sequential scans and fast index scans.\n- understand how multi-column index ordering affects which queries benefit.`,
		conceptExplanation: `An index is like a book's table of contents. Without it, the database reads every row (sequential scan). With it, the database jumps directly to matching rows (index scan).

**Production benchmarks (before vs after index):**
\`\`\`
No index:  Seq Scan on users  (cost=0.00..245.00 rows=50000) | Time: ~800ms
With index: Index Scan using index_users_on_email on users  (cost=0.00..8.27 rows=1) | Time: ~2ms → 400x faster
\`\`\`

**When to add an index:**
- Columns in WHERE clauses (\`find_by\`, \`where\`)
- Foreign key columns (\`user_id\`, \`post_id\`)
- Columns in ORDER BY
- Columns in JOIN conditions
- Columns used in unique constraints

**Index types:**
- **B-tree** (default): Works for equality and range queries. Handles =, <, >, BETWEEN, IN, LIKE 'prefix%'
- **Unique**: Enforces uniqueness at the database level. Faster than regular B-tree for lookups
- **Composite**: Multiple columns in one index. Column order matters critically (leftmost prefix rule)
- **Partial**: Index only a subset of rows. Smaller and faster for common filtered queries

**Reading PostgreSQL EXPLAIN output (what each node tells you):**
- \`Seq Scan\`: Full table scan, reads every row (bad for large tables)
- \`Index Scan\`: Uses an index to find rows (good)
- \`Index Only Scan\`: Reads data directly from the index without touching the table (best)
- \`cost=start..total\`: Estimated startup and total cost in arbitrary units
- \`rows=N\`: Estimated number of rows returned
- \`Filter\`: Rows are read then filtered (check if an index could avoid this)

**The leftmost prefix rule (critical for composite indexes):**
An index on \`[status, created_at]\` is like a dictionary sorted by last name then first name. It is perfect for finding "all published posts sorted by date" (filter by status, then sort by created_at). It is nearly useless for "all posts from January" (only filtering by created_at), because the leftmost column must be in the query.

**Composite index benchmarks:**
\`\`\`
Filtering by status AND ordering by created_at:
  No index:                    Real 28.59ms
  [status, created_at] index:  Real 11.25ms → 2.5x faster
  [created_at] only (wrong):   Real 67.73ms → WORSE! Wrong index hurts
\`\`\``,
		railsCodeExample: `# Single column index
class AddEmailIndexToUsers < ActiveRecord::Migration[8.0]
  def change
    add_index :users, :email, unique: true
  end
end

# Composite index (column order matters!)
class AddIndexToPostsPublishedCreatedAt < ActiveRecord::Migration[8.0]
  def change
    # Covers: WHERE published = true AND created_at > ?
    # Also covers: WHERE published = true (leftmost prefix)
    # Does NOT cover: WHERE created_at > ? (not leftmost)
    add_index :posts, [:published, :created_at]
  end
end

# Foreign key index (always add these!)
class AddUserIdIndexToPosts < ActiveRecord::Migration[8.0]
  def change
    add_index :posts, :user_id
  end
end

# Partial index (only index published posts)
class AddPartialIndexToPublishedPosts < ActiveRecord::Migration[8.0]
  def change
    add_index :posts, :created_at, where: "published = true",
              name: "index_posts_on_created_at_published"
  end
end

# Check with EXPLAIN:
User.where(email: "alice@example.com").explain
# AFTER index:
# Index Scan using index_users_on_email on users
#   Index Cond: ((email)::text = 'alice@example.com'::text)
#   Planning Time: 0.1ms
#   Execution Time: 0.05ms  (was 82ms!)

# Concurrent index creation (no downtime)
add_index :users, :email, algorithm: :concurrently`,
		commonMistakes: [
			'Not adding indexes to foreign key columns (Rails does not do this automatically)',
			'Wrong column order in composite indexes (leftmost prefix rule)',
			'Adding too many indexes (slows down writes)',
			'Not using EXPLAIN to verify index usage',
			'Creating indexes without algorithm: :concurrently in production (locks the table)',
		],
		whenToUse:
			'Add indexes for any column used in WHERE, ORDER BY, JOIN, or unique constraints. Always verify with EXPLAIN.',
		furtherReading: [
			{
				title: 'Rails Migration - add_index',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/ConnectionAdapters/SchemaStatements.html#method-i-add_index',
			},
			{
				title: 'Use the Index, Luke',
				url: 'https://use-the-index-luke.com/',
			},
			{
				title: 'PostgreSQL EXPLAIN Documentation',
				url: 'https://www.postgresql.org/docs/current/using-explain.html',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 2: Indexing & EXPLAIN',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Fire the EXPLAIN probes to see scan bars fill red, then click the query lanes and schema icon to inspect where indexes are missing.',
	},
};

// ============================================
// Level 27: Counter Caches
// ============================================

const level27CounterCaches: Level = {
	id: 'act4-level27-counter-caches',
	actId: 4,
	levelNumber: 27,
	name: 'Counter Caches',
	trigger: {
		type: 'performance_alert',
		description:
			'Fire requests at the posts index to watch COUNT(*) queries cascade through the query waterfall. Each post fires a separate query just to count its reviews.',
	},
	problem: {
		observation:
			'`product.reviews.count` runs a COUNT(*) query for every post on the index page. 100 posts = 100 extra COUNT queries.',
		rootCause:
			'No denormalized count column. Rails must query the reviews table for every product to get the count.',
		codeExample: `# app/services/post_list.rb
class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call
    validation = ListContract.new.call({})
    return Result.new(...) if validation.failure?

    products = Product.includes(:user)
    Result.new(success?: true, posts: posts, errors: [])
  end
end

# app/serializers/product_serializer.rb
class ProductSerializer < BaseSerializer
  attribute :reviews_count do |post|
    product.reviews.count  # <-- COUNT(*) query per post!
  end
end

# Database log for 100 posts:
#   Product Load (1.2ms)  SELECT "posts".* FROM "posts"
#   (0.4ms)  SELECT COUNT(*) FROM "reviews" WHERE product_id = 1
#   (0.3ms)  SELECT COUNT(*) FROM "reviews" WHERE product_id = 2
#   ... 97 more COUNT queries
#
# includes(:reviews) loads ALL records just to count them!`,
		goal: 'Eliminate expensive COUNT queries by storing pre-computed counts directly on the parent table, then update the serializer to use the cached column.',
		thresholds: { maxQueriesPerRequest: 3 },
	},
	successConditions: [{ type: 'counter_cache_configured' }],
	requiresTests: true,
	learningContent: {
		title: 'Counter Caches & Denormalization',
		goal: `In this level, you'll:\n- eliminate expensive COUNT queries by storing the count directly on the parent table.\n- learn how Rails counter caches work and when to use them.\n- configure automatic count maintenance on an association.\n- see how reading a pre-computed column is orders of magnitude faster than counting rows on every request.`,
		conceptExplanation: `A counter cache stores the count of associated records directly on the parent table. Instead of running COUNT(*) on reviews every time, Rails maintains a \`reviews_count\` column on the products table.

**How it works:**
- Add a \`reviews_count\` integer column to the posts table (default: 0)
- Add \`counter_cache: true\` to the \`belongs_to\` association
- Rails automatically increments/decrements the count on create/destroy
- \`product.reviews.count\` reads the column instead of running a query. Zero queries!

**Production benchmarks:**
\`\`\`
WITHOUT counter_cache (COUNT query per post):
  Queries: 101 (1 for posts + 100 COUNT queries)
  Time:    1,551ms

WITH counter_cache:
  Queries: 1
  Time:    27ms → 57x faster
\`\`\`

**How it works under the hood:**
\`\`\`sql
-- Creating a review triggers both in one transaction:
INSERT INTO reviews (...)
UPDATE products SET reviews_count = COALESCE(reviews_count, 0) + 1 WHERE id = 42
\`\`\`

**Denormalization trade-offs:**
- **Not source of truth**: The count is a cached value. Could diverge if someone runs a bad backfill or manually modifies data. Use \`reset_counters\` to fix
- **Write penalty**: Every create/destroy adds an UPDATE to the parent row
- **Locking at scale (the critical issue)**: A viral product with thousands of simultaneous reviews, all trying to \`UPDATE products SET reviews_count = ... WHERE id = viral_product_id\`. They all compete to lock the same row, leading to lock contention, deadlocks, and failed transactions. Same problem Twitter faced with \`followers_count\` on celebrity accounts. At that scale, you need async counter updates (batch increment every N seconds)

**When to use counter_cache vs other approaches:**
- Counter cache: Simple count, frequently displayed, moderate write volume
- \`.size\` method: Uses counter cache if available, otherwise COUNT
- \`.length\` method: Loads all records into memory (never use for counting!)
- Precomputed aggregates: For complex calculations (sums, averages)
- Async counters: For high-write scenarios where lock contention is a concern`,
		railsCodeExample: `# Step 1: Migration, add counter column
class AddReviewsCountToPosts < ActiveRecord::Migration[8.0]
  def change
    add_column :posts, :reviews_count, :integer, default: 0, null: false
  end
end

# Step 2: Backfill existing counts
class BackfillReviewsCount < ActiveRecord::Migration[8.0]
  def up
    Product.find_each do |post|
      Product.reset_counters(product.id, :reviews)
    end
  end
end

# Step 3: Add counter_cache to belongs_to
class Review < ApplicationRecord
  belongs_to :product, counter_cache: true
end

class Product < ApplicationRecord
  has_many :reviews, dependent: :destroy
end

# Now product.reviews.count uses the cached column:
product.reviews.count
# No query! Reads posts.reviews_count directly.

# Custom column name:
belongs_to :product, counter_cache: :replies_count

# Fix out-of-sync counters:
Product.reset_counters(product_id, :reviews)

# Bulk reset all:
Product.find_each { |p| Product.reset_counters(p.id, :reviews) }

# In serializer, no query needed:
class ProductSerializer < BaseSerializer
  attribute :title
  attribute :body
  attribute :reviews_count
end`,
		commonMistakes: [
			'Using .length instead of .count (.length loads all records into memory)',
			'Forgetting to backfill existing counts after adding the column',
			'Not setting default: 0 on the counter column (causes NULL issues)',
			'Manually incrementing/decrementing instead of letting Rails handle it',
			'Using counter_cache for frequently changing counts on high-write tables',
		],
		whenToUse:
			'When you frequently display counts of associated records (e.g., review counts, like counts, follower counts). The trade-off is slightly slower writes for much faster reads.',
		furtherReading: [
			{
				title: 'Rails Counter Cache',
				url: 'https://guides.rubyonrails.org/association_basics.html#options-for-belongs-to-counter-cache',
			},
			{
				title: 'counter_culture Gem',
				url: 'https://github.com/magnusvk/counter_culture',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 3: counter_cache',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Fire probes at different post counts to see the query waterfall grow. The COUNT queries multiply because there is no cached value on the parent table.',
	},
};

// ============================================
// Level 28: Pagination
// ============================================

const level28Pagination: Level = {
	id: 'act4-level28-pagination',
	actId: 4,
	levelNumber: 28,
	name: 'Pagination',
	trigger: {
		type: 'performance_alert',
		description:
			'GET /api/posts returns all 50,000 posts at once. The response is 12MB of JSON. Mobile clients crash.',
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
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'product-model' },
			{ id: 'c4', sourceNodeId: 'product-model', targetNodeId: 'database-node' },
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
			'The PostList service returns `Product.includes(:user)` as the scope with no limit. The controller renders the entire scope, loading 50K ActiveRecord objects into memory and sending a 12MB JSON array. There is no way for clients to request a specific page.',
		rootCause:
			'No pagination. The service scope loads the entire table and the controller renders it all.',
		codeExample: `# app/services/post_list.rb
class PostList < ApplicationService
  Result = Data.define(:success?, :scope, :errors)
  def call
    validation = ListContract.new.call(page: @page)
    return Result.new(...) if validation.failure?
    scope = Product.includes(:user)  # No limit!
    Result.new(success?: true, scope: scope, errors: [])
  end
end

# Controller renders ALL of result.scope:
# render json: ProductSerializer.new(result.scope)
#
# Problems:
# 1. Database loads 50K rows into memory
# 2. Ruby serializes 50K objects (12MB JSON)
# 3. No pagination headers, no way to request "page 2"`,
		goal: 'Add pagination to your API with configurable page sizes and RFC 5988 Link headers so clients can navigate large result sets efficiently.',
		thresholds: { maxLatency: 100 },
	},
	successConditions: [{ type: 'pagination_implemented' }],
	requiresTests: true,
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Pagination: Pagy, Cursor-Based & Link Headers',
		goal: `In this level, you'll:\n- learn how to paginate API responses so clients don't download thousands of records at once.\n- compare offset pagination (simple page numbers) with cursor-based pagination (consistent performance on deep pages).\n- return standard pagination links in HTTP headers following RFC 5988.`,
		conceptExplanation: `Three pagination strategies, each with trade-offs:

**Offset pagination** (page numbers):
- \`LIMIT 25 OFFSET 50\`: page 3 of 25 items
- Simple, supports "jump to page 10"
- Performance degrades on deep pages (OFFSET 100000 still scans 100K rows)
- Records can shift between pages if data changes (duplicates or missed items)

**Cursor-based pagination** (keyset):
- \`WHERE id > last_seen_id LIMIT 25\`
- Consistent performance regardless of page depth
- No "page 5", only "next" and "previous"
- Best for infinite scroll, real-time feeds

**Production benchmarks (1,000 sequential page requests):**
\`\`\`
Offset-based: GET /posts?page=500
  SQL:      SELECT * FROM posts LIMIT 25 OFFSET 12475
            (DB must skip over 12,475 rows before returning 25)
  Time:     Real 1.097s | User 391.5ms

Cursor-based: GET /posts?cursor=eyJpZCI6MTI0NzZ9
  SQL:      SELECT * FROM posts WHERE id > 12476 LIMIT 25
            (DB uses index to jump directly to id=12476)
  Time:     Real 0.327s | User 163.1ms → 2.4x faster
\`\`\`

**Why cursor-based is faster:** \`OFFSET 12475\` tells the DB "skip the first 12,475 rows"; it still reads and discards them. \`WHERE id > last_seen_id\` gives the DB engine extra context to traverse the B-tree index directly, with no wasted reads regardless of page depth.

**Why cursor-based is more stable:** With offset pagination, inserting a new post shifts every page by one, so users see duplicates or miss posts. With cursor-based, cursors point to specific records, and new inserts don't invalidate existing cursors.

**The timestamp gotcha:** IDs are unique, but timestamps are NOT. A bulk import of 10,000 posts with identical \`created_at\` means \`WHERE created_at > X\` can skip records with duplicate values. Fix: always add a secondary sort key on a unique column: \`ORDER BY created_at DESC, id DESC\`.

**API pagination with Link headers:**
- Follow RFC 5988: pagination info in response headers, not body
- \`Link: <url?page=2>; rel="next", <url?page=100>; rel="last"\`
- Keeps the JSON body clean

**Pagy** is the recommended gem:
- 40x faster than Kaminari, 70x faster than will_paginate
- Tiny memory footprint
- Supports offset, cursor, and keyset pagination
- Built-in Link header support for APIs`,
		railsCodeExample: `# Gemfile
gem 'pagy', '~> 43.3'

# config/initializers/pagy.rb
Pagy::OPTIONS[:limit] = 25

# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  include Pagy::Method
end

# Service object provides the scope:
class PostList < ApplicationService
  Result = Data.define(:success?, :scope, :errors)
  def call
    validation = ListContract.new.call(page: @page)
    return Result.new(success?: false, ...) if validation.failure?
    scope = Product.includes(:user)
    Result.new(success?: true, scope: scope, errors: [])
  end
end

# Controller paginates the service scope:
class Api::V1::ProductsController < ApplicationController
  def index
    result = PostList.call(page: params[:page])
    if result.success?
      @pagy, @posts = pagy(:offset, result.scope)
      response.headers.merge!(@pagy.headers_hash)
      render json: ProductSerializer.new(@posts)
    else
      render json: { errors: result.errors },
             status: :unprocessable_entity
    end
  end
end`,
		commonMistakes: [
			'Using offset pagination for deep pages on large tables (OFFSET 100000 is slow)',
			'Not including pagination metadata in the response (Link headers or meta object)',
			'Returning total count on every request (COUNT(*) on large tables is expensive)',
			'Not combining pagination with eager loading (paginate first, then eager load)',
			'Using Kaminari or will_paginate instead of Pagy (significantly slower)',
		],
		whenToUse:
			'Every list endpoint that could return more than ~50 items. Use offset for admin UIs with page numbers. Use cursor-based for feeds, timelines, and infinite scroll.',
		furtherReading: [
			{
				title: 'Pagy Gem',
				url: 'https://github.com/ddnexus/pagy',
			},
			{
				title: 'rails_cursor_pagination (Cursor-Based)',
				url: 'https://github.com/xing/rails_cursor_pagination',
			},
			{
				title: 'RFC 5988 - Web Linking',
				url: 'https://tools.ietf.org/html/rfc5988',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 4: Cursor-Based Pagination',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Pagy v43 uses pagy(:offset, scope). The first return value is metadata (page, count, headers_hash), the second is the paginated ActiveRecord relation.',
	},
};

// ============================================
// Level 29: Search
// ============================================

const level29Search: Level = {
	id: 'act4-level29-search',
	actId: 4,
	levelNumber: 29,
	name: 'Search',
	trigger: {
		type: 'new_feature',
		description:
			"Discover why LIKE '%query%' is killing search performance, then build proper full-text search with ranking, stemming, and fast index lookups.",
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
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'product-model' },
			{ id: 'c4', sourceNodeId: 'product-model', targetNodeId: 'database-node' },
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
			"`GET /api/posts?q=rails` uses `LIKE '%rails%'` which forces a sequential scan. 3 seconds for 50K posts. No relevance ranking.",
		rootCause:
			'LIKE with a leading wildcard cannot use B-tree indexes. Full-text search requires a different approach.',
		codeExample: `# app/services/post_search.rb
class PostSearch < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call
    validation = SearchContract.new.call(query: @query)
    return Result.new(...) if validation.failure?

    products = Product.where(
      "title LIKE :q OR body LIKE :q",
      q: "%#{@query}%"
    )
    Result.new(success?: true, posts: posts, errors: [])
  end
end

# EXPLAIN for LIKE '%rails%':
# Seq Scan on posts  (cost=0.00..1250.00 rows=500 width=256)
#   Filter: ((title ~~ '%rails%') OR (body ~~ '%rails%'))
#   Rows Removed by Filter: 49500
#   Execution Time: 3,200ms
#
# Problems:
# 1. Full table scan (no index can help with leading %)
# 2. No relevance ranking (exact match = partial match)
# 3. No stemming ("running" won't match "run")`,
		goal: 'Replace slow pattern-matching queries with proper full-text search that supports ranking, stemming, and weighted columns.',
		thresholds: { maxLatency: 50 },
	},
	successConditions: [{ type: 'search_configured' }],
	requiresTests: true,
	availableNodes: ['search'],
	unlockedNodes: ['search'],
	learningContent: {
		title: 'Full-Text Search: PostgreSQL tsvector & pg_search',
		goal: `In this level, you'll:\n- discover why LIKE '%query%' forces sequential scans and has no ranking or stemming.\n- set up proper full-text search with a dedicated search column and index.\n- configure search scopes with weighted columns for relevance ranking.\n- wire the controller to use the new search.\n- stress-test the solution with varied search queries.`,
		conceptExplanation: `Relying on LIKE '%query%' for search is a common mistake. It cannot use indexes, has no relevance ranking, and gets slower as data grows.

**PostgreSQL full-text search:**
- Built into the database, no external service needed
- Uses \`tsvector\` (document) and \`tsquery\` (search query)
- Supports stemming ("running" matches "run"), ranking, and phrase matching
- GIN indexes make searches fast even on millions of rows

**SQLite FTS5 (for SQLite databases):**
- SQLite's built-in full-text search engine
- Virtual table approach: create a separate FTS table
- Supports prefix queries, phrase matching, and boolean operators
- Rails 8 makes this viable for production

**pg_search gem (recommended for PostgreSQL):**
- Simple DSL for PostgreSQL full-text search
- Handles tsvector, trigrams, and multi-table search
- Integrates with ActiveRecord scopes

**When to graduate to Elasticsearch/Meilisearch:**
- Autocomplete / "search as you type"
- Faceted search (filter by category, price range)
- Fuzzy matching across millions of documents
- Multi-language support`,
		railsCodeExample: `# === PostgreSQL Full-Text Search ===

# Migration: add tsvector column with GIN index
class AddSearchToProduct < ActiveRecord::Migration[8.0]
  def change
    add_column :posts, :searchable, :tsvector
    add_index :posts, :searchable, using: :gin

    # Trigger to auto-update searchable column
    execute <<-SQL
      CREATE TRIGGER posts_searchable_update
      BEFORE INSERT OR UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION
        tsvector_update_trigger(searchable, 'pg_catalog.english', title, body);
    SQL

    # Backfill existing records
    execute <<-SQL
      UPDATE products SET searchable =
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''));
    SQL
  end
end

# app/models/product.rb (manual approach)
class Product < ApplicationRecord
  scope :search, ->(query) {
    sanitized = connection.quote(query)
    where("searchable @@ plainto_tsquery('english', ?)", query)
      .order(Arel.sql("ts_rank(searchable, plainto_tsquery('english', #{sanitized})) DESC"))
  }
end

# === Using pg_search gem (recommended) ===
# Gemfile
gem 'pg_search'

# app/models/product.rb
class Product < ApplicationRecord
  include PgSearch::Model

  pg_search_scope :search,
    against: { title: 'A', body: 'B' },  # A = highest weight
    using: {
      tsearch: { prefix: true, dictionary: 'english' },
      trigram: { threshold: 0.3 }  # fuzzy matching
    }
end

# Service object:
class PostSearch < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call
    validation = SearchContract.new.call(query: @query)
    return Result.new(success?: false, posts: [], errors: validation.errors.to_h) if validation.failure?

    products = Product.search(@query)
    Result.new(success?: true, posts: posts, errors: [])
  end
end

# === SQLite FTS5 (for SQLite databases) ===
class CreatePostsSearchIndex < ActiveRecord::Migration[8.0]
  def up
    execute <<-SQL
      CREATE VIRTUAL TABLE posts_fts USING fts5(title, body, content=posts, content_rowid=id);
      INSERT INTO posts_fts(rowid, title, body) SELECT id, title, body FROM posts;
    SQL
  end
end

# Query FTS5:
Product.where(id: Product.connection.select_values(
  "SELECT rowid FROM posts_fts WHERE posts_fts MATCH ?", query
))`,
		commonMistakes: [
			"Using LIKE '%query%' for search (cannot use indexes, no ranking)",
			'Not adding GIN indexes on tsvector columns (search will be slow)',
			'Forgetting to backfill the search column for existing records',
			'Not weighting title higher than body in search results',
			'Building search without pagination (returning all matches)',
		],
		whenToUse:
			'PostgreSQL full-text search handles most search needs. Graduate to Elasticsearch/Meilisearch when you need autocomplete, facets, or fuzzy matching across millions of documents.\n\n**Before (LIKE):** 50K rows: ~3,200ms (sequential scan), no ranking, no stemming.\n**After (tsvector + GIN):** 50K rows: ~2ms (GIN index scan), ranked results, English stemming.\n**Improvement: 1,600x faster search on 50K rows.**',
		furtherReading: [
			{
				title: 'pg_search Gem',
				url: 'https://github.com/Casecommons/pg_search',
			},
			{
				title: 'PostgreSQL Full-Text Search',
				url: 'https://www.postgresql.org/docs/current/textsearch.html',
			},
			{
				title: 'SQLite FTS5',
				url: 'https://www.sqlite.org/fts5.html',
			},
			{
				title: 'Rails Scales! (Full-Text Search chapter)',
				url: 'https://railsscales.com',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Fire the search probes and inspect the controller code to discover why LIKE queries are slow. You need all 4 discoveries to unlock the build phase.',
	},
};

// ============================================
// Level 30: Caching
// ============================================

const level30Caching: Level = {
	id: 'act4-level30-caching',
	actId: 4,
	levelNumber: 30,
	name: 'Caching',
	trigger: {
		type: 'scaling',
		description:
			'The trending posts endpoint computes rankings from 50K posts on every request. 200 identical computations per minute, each taking 512ms. Explore the request layers, discover the missing cache, then add Solid Cache.',
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
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'product-model' },
			{ id: 'c4', sourceNodeId: 'product-model', targetNodeId: 'database-node' },
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
  Result = Data.define(:posts, :generated_at)

  def call
    validation = TrendingContract.new.call({})
    return Result.new(
      posts: [], generated_at: Time.current
    ) if validation.failure?

    # Runs on EVERY request, 200 times/minute
    products = Product
      .joins(:reviews)
      .where("posts.created_at > ?", 7.days.ago)
      .group("posts.id")
      .select("posts.*, COUNT(reviews.id) AS score")
      .order("score DESC")
      .limit(20)
      .includes(:user)

    Result.new(posts: posts, generated_at: Time.current)
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
   - One post update only re-renders that post's fragment, not the entire collection
   - Still must execute SQL to fetch post IDs, but saves serialization time

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
On each new post, write the post ID into a cached "timeline" list for every follower. Reading a feed becomes \`Product.where(id: cached_ids)\`, trivial. The "Justin Bieber problem": celebrity with millions of followers, each post triggers millions of cache writes. Solution: mixed fan-out. Regular users get fan-out writes; celebrities are exempt (their posts fetched via direct DB query at read time).`,
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
  Result = Data.define(:posts, :generated_at)

  def call
    validation = TrendingContract.new.call({})
    return Result.new(
      posts: [], generated_at: Time.current
    ) if validation.failure?

    products = Rails.cache.fetch(
      "trending_products", expires_in: 5.minutes
    ) do
      Product
        .joins(:reviews)
        .where("posts.created_at > ?", 7.days.ago)
        .group("posts.id")
        .select("posts.*, COUNT(reviews.id) AS score")
        .order("score DESC")
        .limit(20)
        .includes(:user)
        .to_a  # Materialize before caching
    end

    Result.new(posts: posts, generated_at: Time.current)
  end
end

# Controller stays thin:
result = TrendingProducts.call
render json: ProductSerializer.new(result.posts)

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

// ============================================
// Level 31: HTTP Caching & CDNs
// ============================================

const level31HTTPCaching: Level = {
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
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'product-model' },
			{ id: 'c4', sourceNodeId: 'product-model', targetNodeId: 'database-node' },
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

// ============================================
// Act 4 Definition
// ============================================

export const actFour: Act = {
	id: 4,
	name: 'Performance',
	tagline: 'Traffic is growing. The API is slowing down.',
	description:
		'Users are multiplying and response times are climbing. Diagnose N+1 queries, add eager loading, narrow fetching, database indexes, counter caches, pagination, search, and caching layers to keep the API fast.',
	levels: [
		level23N1Problem,
		level24EagerLoading,
		level25NarrowFetching,
		level26DatabaseIndexing,
		level27CounterCaches,
		level28Pagination,
		level29Search,
		level30Caching,
		level31HTTPCaching,
	],
	unlockedNodes: ['eager_load', 'index', 'cache', 'pagination', 'search'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'queryCount', 'cacheHitRate'],
};
