import type { Level } from '@/types';

export const level26DatabaseIndexing: Level = {
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
	startingPipeline: { nodes: [], connections: [] },
	successConditions: [{ type: 'queries_optimized' }],
	availableNodes: [],
	unlockedNodes: [],
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
- Foreign key columns (\`user_id\`, \`product_id\`)
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
An index on \`[status, created_at]\` is like a dictionary sorted by last name then first name. It is perfect for finding "all published products sorted by date" (filter by status, then sort by created_at). It is nearly useless for "all products from January" (only filtering by created_at), because the leftmost column must be in the query.

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
class AddIndexToProductsPublishedCreatedAt < ActiveRecord::Migration[8.0]
  def change
    # Covers: WHERE published = true AND created_at > ?
    # Also covers: WHERE published = true (leftmost prefix)
    # Does NOT cover: WHERE created_at > ? (not leftmost)
    add_index :products, [:published, :created_at]
  end
end

# Foreign key index (always add these!)
class AddUserIdIndexToProducts < ActiveRecord::Migration[8.0]
  def change
    add_index :products, :user_id
  end
end

# Partial index (only index published products)
class AddPartialIndexToPublishedProducts < ActiveRecord::Migration[8.0]
  def change
    add_index :products, :created_at, where: "published = true",
              name: "index_products_on_created_at_published"
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
