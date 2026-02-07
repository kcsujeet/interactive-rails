/**
 * Act 4: Performance
 * "10K users. API is slow. Database groaning."
 *
 * Levels 22-28: N+1 Problem, Eager Loading, Database Indexing, Counter Caches, Pagination, Search, Caching
 * App context: Blog API at scale — 10K users, 50K posts, millions of queries
 */

import type { Act, Level } from "@/components/game/types";

// ============================================
// Level 22: The N+1 Problem
// ============================================

const level22N1Problem: Level = {
	id: 'act4-level22-n1-problem',
	actId: 4,
	levelNumber: 22,
	name: 'The N+1 Problem',
	trigger: {
		type: 'performance_alert',
		description:
			'10K users hit the API daily. Response times crept above 2 seconds. The database log reveals a devastating pattern.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 480, y: 250, locked: true },
			{ id: 'post-model', type: 'model', x: 720, y: 140, locked: true, config: { label: 'Post' } },
			{ id: 'author-model', type: 'model', x: 720, y: 360, locked: true, config: { label: 'User' } },
			{ id: 'database-node', type: 'database', x: 960, y: 250, locked: true },
			{ id: 'serializer-node', type: 'serializer', x: 480, y: 460, locked: true },
			{ id: 'response-node', type: 'response', x: 720, y: 460, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'post-model', targetNodeId: 'author-model' },
			{ id: 'c6', sourceNodeId: 'author-model', targetNodeId: 'database-node' },
			{ id: 'c7', sourceNodeId: 'controller-node', targetNodeId: 'serializer-node' },
			{ id: 'c8', sourceNodeId: 'serializer-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation:
			'`/api/posts` runs 101 queries for 100 posts. Each post triggers an extra query to fetch its author.',
		rootCause:
			'N+1 query pattern: 1 query loads all posts, then N individual queries load each author.',
		codeExample: `# app/controllers/api/v1/posts_controller.rb
def index
  @posts = Post.all
  render json: PostBlueprint.render(@posts)
end

# app/blueprints/post_blueprint.rb
class PostBlueprint < Blueprinter::Base
  identifier :id
  fields :title, :body

  field :author_name do |post|
    post.user.name  # <-- triggers a query PER POST
  end
end

# Database log:
#   Post Load (2.1ms)  SELECT "posts".* FROM "posts"
#   User Load (0.3ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 1
#   User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 2
#   User Load (0.3ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 3
#   ... 97 more queries
#
# Total: 101 queries, 850ms

# Install the bullet gem to detect N+1 automatically:
# Gemfile
gem 'bullet', group: :development

# config/environments/development.rb
config.after_initialize do
  Bullet.enable = true
  Bullet.alert = true
  Bullet.bullet_logger = true
  Bullet.console = true
  Bullet.rails_logger = true
end`,
		goal: 'Identify the N+1 query pattern. Trace the 101 queries back to the serializer accessing post.user.',
		thresholds: { maxQueriesPerRequest: 5 },
	},
	successConditions: [{ type: 'n1_identified' }],
	availableNodes: [],
	unlockedNodes: ['eager_load'],
	learningContent: {
		title: 'The N+1 Query Problem & Bullet Gem',
		conceptExplanation: `The N+1 problem is the most common performance killer in Rails apps. It happens when you load a collection of records (1 query) and then access an association on each record (N queries).

**The math is brutal:**
- 100 posts = 101 queries
- 1,000 posts = 1,001 queries
- 10,000 posts = 10,001 queries

It scales linearly with data size. What works in development with 10 records becomes a disaster in production with 10,000.

**Detection with bullet gem:**
- Automatically detects N+1 queries in development
- Shows browser alerts, console warnings, and log entries
- Also detects unused eager loading (loading associations you never use)
- Essential for any Rails project

**Where N+1 hides:**
- Serializers (accessing associations during rendering)
- Views (iterating and calling association methods)
- Scopes with dependent queries
- Callbacks that touch associations`,
		railsCodeExample: `# The problem: N+1 queries
@posts = Post.all  # 1 query: SELECT * FROM posts

# In serializer or view:
@posts.each do |post|
  post.user.name       # +1 query per post
  post.comments.count  # +1 query per post (even worse: N+1+N)
end
# Total: 1 + N + N queries!

# Bullet gem setup:
# Gemfile
gem 'bullet', group: [:development, :test]

# config/environments/development.rb
config.after_initialize do
  Bullet.enable        = true
  Bullet.alert         = true   # JS alert in browser
  Bullet.bullet_logger = true   # log/bullet.log
  Bullet.console       = true   # browser console
  Bullet.rails_logger  = true   # Rails log
  Bullet.add_footer    = true   # footer in HTML
end

# Bullet will tell you:
# "USE eager loading detected
#   Post => [:user]
#   Add to your query: .includes(:user)"`,
		commonMistakes: [
			'Not monitoring query counts in development (use bullet gem)',
			'Assuming eager loading is always the fix (sometimes you need to restructure)',
			'Only checking controller queries (N+1 often hides in serializers)',
			'Ignoring N+1 in tests because test data is small',
		],
		whenToUse:
			'Always check for N+1 when iterating over records and accessing associations. Install bullet in every Rails project.',
		furtherReading: [
			{
				title: 'Bullet Gem',
				url: 'https://github.com/flyerhzm/bullet',
			},
			{
				title: 'ActiveRecord Query Interface - Eager Loading',
				url: 'https://guides.rubyonrails.org/active_record_querying.html#eager-loading-associations',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Count the queries in the database log. Each post.user call triggers a separate SELECT.',
	},
};

// ============================================
// Level 23: Eager Loading
// ============================================

const level23EagerLoading: Level = {
	id: 'act4-level23-eager-loading',
	actId: 4,
	levelNumber: 23,
	name: 'Eager Loading',
	trigger: {
		type: 'optimization',
		description:
			'The N+1 problem is identified. Now fix it. Batch those author queries into a single load. Response time must drop to 50ms.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 480, y: 250, locked: true },
			{ id: 'post-model', type: 'model', x: 720, y: 140, locked: true, config: { label: 'Post' } },
			{ id: 'author-model', type: 'model', x: 720, y: 360, locked: true, config: { label: 'User' } },
			{ id: 'database-node', type: 'database', x: 960, y: 250, locked: true },
			{ id: 'serializer-node', type: 'serializer', x: 480, y: 460, locked: true },
			{ id: 'response-node', type: 'response', x: 720, y: 460, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'post-model', targetNodeId: 'author-model' },
			{ id: 'c6', sourceNodeId: 'author-model', targetNodeId: 'database-node' },
			{ id: 'c7', sourceNodeId: 'controller-node', targetNodeId: 'serializer-node' },
			{ id: 'c8', sourceNodeId: 'serializer-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation:
			'101 queries identified. Need to collapse N author queries into 1 batch query.',
		rootCause:
			'Associations are lazy-loaded by default. Rails only queries the database when you first access the association.',
		codeExample: `# BEFORE: 101 queries (N+1)
@posts = Post.all
# SELECT "posts".* FROM "posts"
# Then for each post:
#   SELECT "users".* FROM "users" WHERE "users"."id" = ?

# AFTER: 2 queries (eager loaded)
@posts = Post.includes(:user)
# SELECT "posts".* FROM "posts"
# SELECT "users".* FROM "users" WHERE "users"."id" IN (1, 2, 3, ...)

# Rails provides three strategies:
Post.includes(:user)     # Smart default — 2 queries or JOIN
Post.preload(:user)      # Always 2 separate queries
Post.eager_load(:user)   # Always LEFT OUTER JOIN (1 query)`,
		goal: 'Apply the correct eager loading strategy. Drop from 101 queries to 2. Response time under 50ms.',
		thresholds: { maxQueriesPerRequest: 3, maxLatency: 50 },
	},
	successConditions: [{ type: 'eager_loading_applied' }],
	requiresTests: true,
	availableNodes: ['eager_load'],
	unlockedNodes: [],
	learningContent: {
		title: 'Eager Loading: includes vs preload vs eager_load',
		conceptExplanation: `Rails provides three eager loading methods. Each works differently:

**\`includes\`** (recommended default):
- Rails decides: 2 separate queries OR a LEFT OUTER JOIN
- Uses JOIN when you filter on the association (e.g., \`.where(users: { active: true })\`)
- Uses separate queries otherwise (usually faster for simple cases)

**\`preload\`** (force separate queries):
- Always runs 2 separate queries
- Cannot filter on the preloaded association in WHERE clauses
- Best when you need the data but not for filtering

**\`eager_load\`** (force JOIN):
- Always uses LEFT OUTER JOIN in a single query
- Required when filtering/ordering by the association
- Can be slower for large datasets (big JOIN result)

**Nested eager loading:**
- \`Post.includes(comments: :user)\` — load comments AND each comment's user
- \`Post.includes(:user, :tags, comments: [:user, :likes])\` — multiple levels

**strict_loading (Rails 6.1+):**
- Raises an error if you access a non-eager-loaded association
- Catches N+1 at runtime instead of silently degrading`,
		railsCodeExample: `# includes — smart default (use this most of the time)
Post.includes(:user)
# Query 1: SELECT "posts".* FROM "posts"
# Query 2: SELECT "users".* FROM "users" WHERE "users"."id" IN (1, 2, 3...)

# includes with filtering (auto-switches to JOIN)
Post.includes(:user).where(users: { role: 'admin' })
# SELECT "posts".* FROM "posts"
#   LEFT OUTER JOIN "users" ON "users"."id" = "posts"."user_id"
#   WHERE "users"."role" = 'admin'

# preload — force 2 queries
Post.preload(:user)
# Always 2 separate queries, even with .where

# eager_load — force JOIN
Post.eager_load(:user)
# Always 1 query with LEFT OUTER JOIN

# Nested eager loading
Post.includes(comments: :user)
# Query 1: SELECT "posts".* FROM "posts"
# Query 2: SELECT "comments".* FROM "comments" WHERE "comments"."post_id" IN (...)
# Query 3: SELECT "users".* FROM "users" WHERE "users"."id" IN (...)

# strict_loading — catch N+1 at runtime
Post.strict_loading.all
# Raises ActiveRecord::StrictLoadingViolationError if you access post.user

# Per-model strict loading
class Post < ApplicationRecord
  self.strict_loading_by_default = true
end`,
		commonMistakes: [
			'Using eager_load when includes would be faster (JOIN on large tables is expensive)',
			'Eager loading associations you never access (wastes memory)',
			'Not nesting includes for deeply nested serializers',
			'Forgetting strict_loading to prevent future N+1 regressions',
		],
		whenToUse:
			'Use includes by default. Use eager_load when filtering on associations. Use preload when you need guaranteed separate queries.',
		furtherReading: [
			{
				title: 'ActiveRecord Eager Loading',
				url: 'https://guides.rubyonrails.org/active_record_querying.html#eager-loading-associations',
			},
			{
				title: 'Strict Loading (Rails 6.1+)',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Core/ClassMethods.html#method-i-strict_loading_by_default-3D',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add an Eager Load node. Use .includes(:user) to batch the author queries into one.',
	},
};

// ============================================
// Level 24: Database Indexing
// ============================================

const level24DatabaseIndexing: Level = {
	id: 'act4-level24-database-indexing',
	actId: 4,
	levelNumber: 24,
	name: 'Database Indexing',
	trigger: {
		type: 'performance_alert',
		description:
			'GET /api/users?email=alice@example.com takes 800ms. The EXPLAIN output shows a sequential scan across 10,000 rows.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 220, locked: true },
			{ id: 'controller-node', type: 'controller', x: 460, y: 220, locked: true },
			{ id: 'user-model', type: 'model', x: 660, y: 220, locked: true, config: { label: 'User' } },
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{ id: 'serializer-node', type: 'serializer', x: 460, y: 400, locked: true },
			{ id: 'response-node', type: 'response', x: 660, y: 400, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'user-model' },
			{ id: 'c4', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'serializer-node' },
			{ id: 'c6', sourceNodeId: 'serializer-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation:
			'`GET /api/users?email=...` does a full table scan on 10,000 rows. EXPLAIN shows Seq Scan with no index usage.',
		rootCause:
			'No database index on the email column. The database must scan every row to find a match.',
		codeExample: `# app/controllers/api/v1/users_controller.rb
def show
  @user = User.find_by!(email: params[:email])
  render json: UserBlueprint.render(@user)
end

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
Post.where(user_id: user.id)                 # Foreign key lookup
Post.where(published: true).order(:created_at) # Composite query`,
		goal: 'Add the correct database indexes. EXPLAIN should show Index Scan instead of Seq Scan.',
		thresholds: { maxLatency: 10 },
	},
	successConditions: [{ type: 'queries_optimized' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Database Indexing & EXPLAIN',
		conceptExplanation: `An index is like a book's table of contents. Without it, the database reads every row (sequential scan). With it, the database jumps directly to matching rows (index scan).

**When to add an index:**
- Columns in WHERE clauses (\`find_by\`, \`where\`)
- Foreign key columns (\`user_id\`, \`post_id\`)
- Columns in ORDER BY
- Columns in JOIN conditions
- Columns used in unique constraints

**Index types:**
- **B-tree** (default): Works for equality and range queries. Handles =, <, >, BETWEEN, IN, LIKE 'prefix%'
- **Unique**: Enforces uniqueness at the database level. Faster than regular B-tree for lookups
- **Composite**: Multiple columns in one index. Column order matters (leftmost prefix rule)
- **Partial**: Index only a subset of rows. Smaller and faster for common filtered queries

**EXPLAIN ANALYZE:**
- Shows the query execution plan
- Seq Scan = bad (full table scan)
- Index Scan = good (uses index)
- Shows actual execution time`,
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
		],
	},
	hint: {
		delay: 20,
		text: 'Run EXPLAIN ANALYZE on the slow query. Add an index on the email column with add_index :users, :email, unique: true.',
	},
};

// ============================================
// Level 25: Counter Caches
// ============================================

const level25CounterCaches: Level = {
	id: 'act4-level25-counter-caches',
	actId: 4,
	levelNumber: 25,
	name: 'Counter Caches',
	trigger: {
		type: 'performance_alert',
		description:
			'The posts index page shows comment counts for every post. Each post.comments.count fires a COUNT(*) query. Back to N+1.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 480, y: 250, locked: true },
			{ id: 'post-model', type: 'model', x: 720, y: 140, locked: true, config: { label: 'Post' } },
			{ id: 'comment-model', type: 'model', x: 720, y: 360, locked: true, config: { label: 'Comment' } },
			{ id: 'database-node', type: 'database', x: 960, y: 250, locked: true },
			{ id: 'serializer-node', type: 'serializer', x: 480, y: 460, locked: true },
			{ id: 'response-node', type: 'response', x: 720, y: 460, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'post-model', targetNodeId: 'comment-model' },
			{ id: 'c6', sourceNodeId: 'comment-model', targetNodeId: 'database-node' },
			{ id: 'c7', sourceNodeId: 'controller-node', targetNodeId: 'serializer-node' },
			{ id: 'c8', sourceNodeId: 'serializer-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation:
			'`post.comments.count` runs a COUNT(*) query for every post on the index page. 100 posts = 100 extra COUNT queries.',
		rootCause:
			'No denormalized count column. Rails must query the comments table for every post to get the count.',
		codeExample: `# app/blueprints/post_blueprint.rb
class PostBlueprint < Blueprinter::Base
  identifier :id
  fields :title, :body

  field :comments_count do |post|
    post.comments.count  # <-- COUNT(*) query per post!
  end
end

# Database log for 100 posts:
#   Post Load (1.2ms)  SELECT "posts".* FROM "posts"
#   (0.4ms)  SELECT COUNT(*) FROM "comments" WHERE "comments"."post_id" = 1
#   (0.3ms)  SELECT COUNT(*) FROM "comments" WHERE "comments"."post_id" = 2
#   (0.4ms)  SELECT COUNT(*) FROM "comments" WHERE "comments"."post_id" = 3
#   ... 97 more COUNT queries
#
# includes(:comments) would fix N+1 but loads ALL comment records
# into memory just to count them. That is worse!`,
		goal: 'Eliminate the COUNT queries. Store the count directly on the posts table.',
		thresholds: { maxQueriesPerRequest: 3 },
	},
	successConditions: [{ type: 'counter_cache_configured' }],
	requiresTests: true,
	availableNodes: ['counter_cache'],
	unlockedNodes: ['counter_cache'],
	learningContent: {
		title: 'Counter Caches & Denormalization',
		conceptExplanation: `A counter cache stores the count of associated records directly on the parent table. Instead of running COUNT(*) on comments every time, Rails maintains a \`comments_count\` column on the posts table.

**How it works:**
- Add a \`comments_count\` integer column to the posts table (default: 0)
- Add \`counter_cache: true\` to the \`belongs_to\` association
- Rails automatically increments/decrements the count on create/destroy
- \`post.comments.count\` reads the column instead of running a query — zero queries!

**Denormalization trade-off:**
- Reads are instant (no COUNT query)
- Writes are slightly slower (must update the counter)
- Data can get out of sync (use \`reset_counters\` to fix)

**When to use counter_cache vs other approaches:**
- Counter cache: Simple count, frequently displayed
- \`.size\` method: Uses counter cache if available, otherwise COUNT
- \`.length\` method: Loads all records into memory (never use for counting!)
- Precomputed aggregates: For complex calculations (sums, averages)`,
		railsCodeExample: `# Step 1: Migration — add counter column
class AddCommentsCountToPosts < ActiveRecord::Migration[8.0]
  def change
    add_column :posts, :comments_count, :integer, default: 0, null: false
  end
end

# Step 2: Backfill existing counts
class BackfillCommentsCount < ActiveRecord::Migration[8.0]
  def up
    Post.find_each do |post|
      Post.reset_counters(post.id, :comments)
    end
  end
end

# Step 3: Add counter_cache to belongs_to
class Comment < ApplicationRecord
  belongs_to :post, counter_cache: true
end

class Post < ApplicationRecord
  has_many :comments, dependent: :destroy
end

# Now post.comments.count uses the cached column:
post.comments.count
# No query! Reads posts.comments_count directly.

# Custom column name:
belongs_to :post, counter_cache: :replies_count

# Fix out-of-sync counters:
Post.reset_counters(post_id, :comments)

# Bulk reset all:
Post.find_each { |p| Post.reset_counters(p.id, :comments) }

# In serializer — no query needed:
class PostBlueprint < Blueprinter::Base
  identifier :id
  fields :title, :body, :comments_count
end`,
		commonMistakes: [
			'Using .length instead of .count (.length loads all records into memory)',
			'Forgetting to backfill existing counts after adding the column',
			'Not setting default: 0 on the counter column (causes NULL issues)',
			'Manually incrementing/decrementing instead of letting Rails handle it',
			'Using counter_cache for frequently changing counts on high-write tables',
		],
		whenToUse:
			'When you frequently display counts of associated records (e.g., comment counts, like counts, follower counts). The trade-off is slightly slower writes for much faster reads.',
		furtherReading: [
			{
				title: 'Rails Counter Cache',
				url: 'https://guides.rubyonrails.org/association_basics.html#options-for-belongs-to-counter-cache',
			},
			{
				title: 'counter_culture Gem',
				url: 'https://github.com/magnusvk/counter_culture',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add a comments_count column to posts and use counter_cache: true on the belongs_to association.',
	},
};

// ============================================
// Level 26: Pagination
// ============================================

const level26Pagination: Level = {
	id: 'act4-level26-pagination',
	actId: 4,
	levelNumber: 26,
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
			{ id: 'controller-node', type: 'controller', x: 460, y: 220, locked: true },
			{ id: 'post-model', type: 'model', x: 660, y: 220, locked: true, config: { label: 'Post' } },
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{ id: 'serializer-node', type: 'serializer', x: 460, y: 400, locked: true },
			{ id: 'response-node', type: 'response', x: 660, y: 400, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'serializer-node' },
			{ id: 'c6', sourceNodeId: 'serializer-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation:
			'`GET /api/posts` returns all 50K posts at once. Response size: 12MB. Load time: 8 seconds. Mobile clients crash from memory usage.',
		rootCause:
			'No pagination. Post.all loads the entire table into memory and serializes every record.',
		codeExample: `# app/controllers/api/v1/posts_controller.rb
def index
  @posts = Post.includes(:user).all  # ALL 50,000 posts!
  render json: PostBlueprint.render(@posts)
end

# Response:
# HTTP/1.1 200 OK
# Content-Length: 12,582,912  (12MB!)
# Transfer-Encoding: chunked
#
# [{"id":1,...},{"id":2,...},...,{"id":50000,...}]
#
# Problems:
# 1. Database loads 50K rows into memory
# 2. Ruby serializes 50K objects
# 3. Client parses 12MB JSON
# 4. No way to request "page 2"`,
		goal: 'Implement pagination with Pagy. Return 25 posts per page with Link headers for navigation.',
		thresholds: { maxLatency: 100 },
	},
	successConditions: [{ type: 'pagination_implemented' }],
	requiresTests: true,
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Pagination: Pagy, Cursor-Based & Link Headers',
		conceptExplanation: `Three pagination strategies, each with trade-offs:

**Offset pagination** (page numbers):
- \`LIMIT 25 OFFSET 50\` — page 3 of 25 items
- Simple, supports "jump to page 10"
- Performance degrades on deep pages (OFFSET 100000 still scans 100K rows)
- Records can shift between pages if data changes

**Cursor-based pagination** (keyset):
- \`WHERE id > last_seen_id LIMIT 25\`
- Consistent performance regardless of page depth
- No "page 5" — only "next" and "previous"
- Best for infinite scroll, real-time feeds

**API pagination with Link headers:**
- Follow RFC 5988 — pagination info in response headers, not body
- \`Link: <url?page=2>; rel="next", <url?page=100>; rel="last"\`
- Keeps the JSON body clean

**Pagy** is the recommended gem:
- 40x faster than Kaminari, 70x faster than will_paginate
- Tiny memory footprint
- Supports offset, cursor, and keyset pagination
- Built-in Link header support for APIs`,
		railsCodeExample: `# Gemfile
gem 'pagy'

# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  include Pagy::Backend

  private

  def pagy_headers(pagy)
    links = []
    links << %(<#{request.url.sub(/[?&]page=\\d+/, '')}?page=#{pagy.next}>; rel="next") if pagy.next
    links << %(<#{request.url.sub(/[?&]page=\\d+/, '')}?page=#{pagy.prev}>; rel="prev") if pagy.prev
    links << %(<#{request.url.sub(/[?&]page=\\d+/, '')}?page=#{pagy.last}>; rel="last")
    response.headers['Link'] = links.join(', ')
    response.headers['X-Total-Count'] = pagy.count.to_s
    response.headers['X-Page'] = pagy.page.to_s
    response.headers['X-Per-Page'] = pagy.items.to_s
  end
end

# app/controllers/api/v1/posts_controller.rb
class Api::V1::PostsController < ApplicationController
  def index
    @pagy, @posts = pagy(Post.includes(:user), items: 25)
    pagy_headers(@pagy)
    render json: PostBlueprint.render(@posts)
  end
end

# Response:
# HTTP/1.1 200 OK
# Link: <http://api.example.com/posts?page=2>; rel="next",
#       <http://api.example.com/posts?page=2000>; rel="last"
# X-Total-Count: 50000
# X-Page: 1
# X-Per-Page: 25
# Content-Length: 6250
#
# [{"id":1,...},...,{"id":25,...}]  (25 items only!)

# Cursor-based pagination (for infinite scroll):
class Api::V1::FeedController < ApplicationController
  def index
    scope = Post.where(published: true).order(created_at: :desc)

    if params[:after]
      cursor_post = Post.find(params[:after])
      scope = scope.where("created_at < ?", cursor_post.created_at)
    end

    @posts = scope.limit(25)
    render json: PostBlueprint.render(@posts)
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
				title: 'RFC 5988 - Web Linking',
				url: 'https://tools.ietf.org/html/rfc5988',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add Pagy to the controller. Use pagy(Post.includes(:user), items: 25) and add Link headers to the response.',
	},
};

// ============================================
// Level 27: Search
// ============================================

const level27Search: Level = {
	id: 'act4-level27-search',
	actId: 4,
	levelNumber: 27,
	name: 'Search',
	trigger: {
		type: 'new_feature',
		description:
			'Users want to find posts by keyword. The current implementation uses LIKE \'%query%\' which cannot use indexes and takes 3 seconds on 50K posts.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 220, locked: true },
			{ id: 'controller-node', type: 'controller', x: 460, y: 220, locked: true },
			{ id: 'post-model', type: 'model', x: 660, y: 220, locked: true, config: { label: 'Post' } },
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{ id: 'serializer-node', type: 'serializer', x: 460, y: 400, locked: true },
			{ id: 'response-node', type: 'response', x: 660, y: 400, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'serializer-node' },
			{ id: 'c6', sourceNodeId: 'serializer-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation:
			'`GET /api/posts?q=rails` uses `LIKE \'%rails%\'` which forces a sequential scan. 3 seconds for 50K posts. No relevance ranking.',
		rootCause:
			'LIKE with a leading wildcard cannot use B-tree indexes. Full-text search requires a different approach.',
		codeExample: `# app/controllers/api/v1/posts_controller.rb
def index
  if params[:q].present?
    @posts = Post.where("title LIKE ? OR body LIKE ?",
                        "%#{params[:q]}%", "%#{params[:q]}%")
  else
    @posts = Post.all
  end
  render json: PostBlueprint.render(@posts)
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
# 3. No stemming ("running" won't match "run")
# 4. Case-sensitive by default
# 5. SQL injection risk if not parameterized properly`,
		goal: 'Replace LIKE with proper full-text search. Results should be ranked by relevance and return in under 50ms.',
		thresholds: { maxLatency: 50 },
	},
	successConditions: [{ type: 'search_configured' }],
	requiresTests: true,
	availableNodes: ['search'],
	unlockedNodes: ['search'],
	learningContent: {
		title: 'Full-Text Search: PostgreSQL tsvector & pg_search',
		conceptExplanation: `Relying on LIKE '%query%' for search is a common mistake. It cannot use indexes, has no relevance ranking, and gets slower as data grows.

**PostgreSQL full-text search:**
- Built into the database — no external service needed
- Uses \`tsvector\` (document) and \`tsquery\` (search query)
- Supports stemming ("running" matches "run"), ranking, and phrase matching
- GIN indexes make searches fast even on millions of rows

**SQLite FTS5 (for SQLite databases):**
- SQLite's built-in full-text search engine
- Virtual table approach — create a separate FTS table
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
class AddSearchToPost < ActiveRecord::Migration[8.0]
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
      UPDATE posts SET searchable =
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''));
    SQL
  end
end

# app/models/post.rb — manual approach
class Post < ApplicationRecord
  scope :search, ->(query) {
    where("searchable @@ plainto_tsquery('english', ?)", query)
      .order(Arel.sql("ts_rank(searchable, plainto_tsquery('english', '#{query}')) DESC"))
  }
end

# === Using pg_search gem (recommended) ===
# Gemfile
gem 'pg_search'

# app/models/post.rb
class Post < ApplicationRecord
  include PgSearch::Model

  pg_search_scope :search,
    against: { title: 'A', body: 'B' },  # A = highest weight
    using: {
      tsearch: { prefix: true, dictionary: 'english' },
      trigram: { threshold: 0.3 }  # fuzzy matching
    }
end

# Controller:
def index
  @posts = if params[:q].present?
    Post.search(params[:q]).includes(:user)
  else
    Post.includes(:user).order(created_at: :desc)
  end
  @pagy, @posts = pagy(@posts, items: 25)
  render json: PostBlueprint.render(@posts)
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
Post.where(id: Post.connection.select_values(
  "SELECT rowid FROM posts_fts WHERE posts_fts MATCH ?", query
))`,
		commonMistakes: [
			'Using LIKE \'%query%\' for search (cannot use indexes, no ranking)',
			'Not adding GIN indexes on tsvector columns (search will be slow)',
			'Forgetting to backfill the search column for existing records',
			'Not weighting title higher than body in search results',
			'Building search without pagination (returning all matches)',
		],
		whenToUse:
			'PostgreSQL full-text search handles most search needs. Graduate to Elasticsearch/Meilisearch when you need autocomplete, facets, or fuzzy matching across millions of documents.',
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
		],
	},
	hint: {
		delay: 25,
		text: 'Replace LIKE with PostgreSQL full-text search using tsvector and a GIN index. Use the pg_search gem for a cleaner API.',
	},
};

// ============================================
// Level 28: Caching
// ============================================

const level28Caching: Level = {
	id: 'act4-level28-caching',
	actId: 4,
	levelNumber: 28,
	name: 'Caching',
	trigger: {
		type: 'scaling',
		description:
			'The trending posts endpoint computes rankings from 50K posts on every request. Same expensive computation, same result, 200 times per minute.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 220, locked: true },
			{ id: 'controller-node', type: 'controller', x: 460, y: 220, locked: true },
			{ id: 'post-model', type: 'model', x: 660, y: 220, locked: true, config: { label: 'Post' } },
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{ id: 'serializer-node', type: 'serializer', x: 460, y: 400, locked: true },
			{ id: 'response-node', type: 'response', x: 660, y: 400, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'serializer-node' },
			{ id: 'c6', sourceNodeId: 'serializer-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation:
			'Same expensive trending posts computation runs on every request. 200 requests/minute, each taking 500ms of database time. Database CPU at 90%.',
		rootCause:
			'No caching layer. Every request recomputes the same result from scratch.',
		codeExample: `# app/controllers/api/v1/posts_controller.rb
def trending
  # Runs on EVERY request — 200 times/minute
  @posts = Post
    .joins(:comments, :likes)
    .where("posts.created_at > ?", 7.days.ago)
    .group("posts.id")
    .select("posts.*, COUNT(DISTINCT comments.id) + COUNT(DISTINCT likes.id) AS score")
    .order("score DESC")
    .limit(20)
    .includes(:user)

  render json: PostBlueprint.render(@posts)
end

# This query:
# 1. Joins 3 tables (posts, comments, likes)
# 2. Filters 7 days of data
# 3. Groups and aggregates
# 4. Sorts by computed score
#
# Execution time: 500ms
# Requests/min: 200
# = 100 seconds of DB time per minute (out of 60 available!)`,
		goal: 'Add caching layers. The trending endpoint should serve from cache with a 95%+ hit rate.',
		thresholds: { minCacheHitRate: 95, maxLatency: 20 },
	},
	successConditions: [{ type: 'caching_configured' }],
	requiresTests: true,
	availableNodes: ['cache'],
	unlockedNodes: ['cache'],
	learningContent: {
		title: 'Caching: Solid Cache, Low-Level Cache & HTTP ETags',
		conceptExplanation: `Rails 8 introduces **Solid Cache** — a database-backed cache store that replaces Redis for most caching needs. No additional infrastructure required.

**Caching layers (from fastest to slowest):**

1. **HTTP Caching (ETags/304)** — Client never even makes a request
   - \`stale?\` checks if the resource changed
   - Returns 304 Not Modified if unchanged (no body, no computation)
   - CDNs and browsers cache the response

2. **Low-level cache (Rails.cache)** — Cached in your cache store
   - \`Rails.cache.fetch("key", expires_in: 1.hour) { expensive_query }\`
   - First request computes and stores; subsequent requests read from cache
   - Solid Cache stores this in your database (no Redis needed)

3. **Query cache** — Automatic within a single request
   - Rails caches identical SQL queries within the same request
   - Zero configuration, but only helps within a single request

**Solid Cache (Rails 8 default):**
- Database-backed — no Redis server to manage
- Survives restarts (unlike in-memory cache)
- Supports automatic cleanup of expired entries
- Perfect for most applications
- For extreme scale, add Redis or Memcached later

**Cache invalidation strategies:**
- Time-based: \`expires_in: 5.minutes\`
- Key-based: Include the record's \`updated_at\` in the cache key
- Manual: \`Rails.cache.delete("key")\`
- Touch: \`belongs_to :post, touch: true\` cascades cache invalidation`,
		railsCodeExample: `# === Solid Cache Setup (Rails 8) ===

# config/cache.yml (auto-generated)
production:
  database: cache  # Uses a separate database for cache

# config/environments/production.rb
config.cache_store = :solid_cache_store

# === Low-Level Caching ===

# app/controllers/api/v1/posts_controller.rb
def trending
  @posts = Rails.cache.fetch("trending_posts", expires_in: 5.minutes) do
    Post
      .joins(:comments, :likes)
      .where("posts.created_at > ?", 7.days.ago)
      .group("posts.id")
      .select("posts.*, COUNT(DISTINCT comments.id) + COUNT(DISTINCT likes.id) AS score")
      .order("score DESC")
      .limit(20)
      .includes(:user)
      .to_a  # Important: materialize the query before caching
  end

  render json: PostBlueprint.render(@posts)
end

# Cache key with record versioning:
Rails.cache.fetch(["post", post.id, post.updated_at]) do
  PostBlueprint.render_as_json(post)
end

# === HTTP Caching (ETags) ===

def show
  @post = Post.find(params[:id])

  # Returns 304 Not Modified if post hasn't changed
  if stale?(@post)
    render json: PostBlueprint.render(@post)
  end
end

# For collections:
def index
  @posts = Post.includes(:user).order(updated_at: :desc).limit(25)

  # Use the most recently updated post as the ETag
  if stale?(etag: @posts, last_modified: @posts.first&.updated_at)
    render json: PostBlueprint.render(@posts)
  end
end

# === Cache Invalidation ===

# Touch parent when child changes
class Comment < ApplicationRecord
  belongs_to :post, touch: true  # Updates post.updated_at
end

# Manual invalidation
Rails.cache.delete("trending_posts")

# Pattern deletion
Rails.cache.delete_matched("posts/*")

# === Conditional GET (API clients) ===
# Client sends: If-None-Match: "etag-value"
# Server returns: 304 Not Modified (empty body, fast!)`,
		commonMistakes: [
			'Caching ActiveRecord relations instead of materialized arrays (use .to_a)',
			'Not setting expiration times (stale data forever)',
			'Cache keys that do not include updated_at (stale after updates)',
			'Over-caching dynamic/personalized content',
			'Forgetting touch: true on belongs_to (child changes do not invalidate parent cache)',
			'Not using HTTP caching for public, read-heavy endpoints',
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
				title: 'HTTP Caching in Rails',
				url: 'https://guides.rubyonrails.org/caching_with_rails.html#conditional-get-support',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Wrap the trending query in Rails.cache.fetch with a 5-minute expiration. Add stale? for HTTP caching on show actions.',
	},
};

// ============================================
// Act 4 Definition
// ============================================

export const actFour: Act = {
	id: 4,
	name: 'Performance',
	tagline: '10K users. API is slow. Database groaning.',
	description:
		'Diagnose and fix N+1 queries, add indexes, implement caching with Solid Cache, pagination, and full-text search.',
	levels: [
		level22N1Problem,
		level23EagerLoading,
		level24DatabaseIndexing,
		level25CounterCaches,
		level26Pagination,
		level27Search,
		level28Caching,
	],
	unlockedNodes: ['eager_load', 'index', 'cache', 'pagination', 'search'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'queryCount', 'cacheHitRate'],
};
