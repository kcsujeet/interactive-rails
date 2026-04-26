import type { Level } from '@/types';

export const level24EagerLoading: Level = {
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

# Rails provides three strategies:
Product.includes(:user)     # Smart default: 2 queries or JOIN
Product.preload(:user)      # Always 2 separate queries
Product.eager_load(:user)   # Always LEFT OUTER JOIN (1 query)

# Common trap: joins does NOT prevent N+1!
Product.joins(:user)  # INNER JOINs but does NOT load user records`,
		goal: 'Test four loading strategies against three scenarios, discover why each strategy fits different situations, then apply the right fix for basic includes, nested associations, and filtered queries.',
		thresholds: { maxQueriesPerRequest: 3, maxLatency: 50 },
	},
	startingPipeline: { nodes: [], connections: [] },
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

**Production benchmarks (simple scenario, products with users):**
\`\`\`
N+1:        Real 9.545s | User 4.873s | 1,564 MB | 5,301,574 objects
Preload:    Real 1.34s  | User 0.195s |   682 MB |   148,827 objects → 25x faster
Eager Load: Real 0.99s  | User 0.238s |   697 MB |   250,610 objects → 20x faster
\`\`\`

**Why preload beats eager_load on memory:** \`preload\` runs separate simple queries, creating fewer temporary objects. \`eager_load\` builds a single wide JOIN result; the database returns more columns per row, and ActiveRecord must allocate more intermediate objects to parse the wider result set.

**Complex scenario (products per category per user, at scale):**
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
# Query 1: SELECT "products".* FROM "products"
# Query 2: SELECT "users".* FROM "users" WHERE "users"."id" IN (1, 2, 3...)

# includes with filtering (auto-switches to JOIN)
Product.includes(:user).where(users: { role: 'admin' })
# SELECT "products".* FROM "products"
#   LEFT OUTER JOIN "users" ON "users"."id" = "products"."user_id"
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
# Query 1: SELECT "products".* FROM "products"
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
