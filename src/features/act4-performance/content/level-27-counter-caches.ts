import type { Level } from '@/types';

export const level27CounterCaches: Level = {
	id: 'act4-level27-counter-caches',
	actId: 4,
	levelNumber: 27,
	name: 'Counter Caches',
	trigger: {
		type: 'performance_alert',
		description:
			'Fire requests at the products index to watch COUNT(*) queries cascade through the query waterfall. Each product fires a separate query just to count its reviews.',
	},
	problem: {
		observation:
			'`product.reviews.count` runs a COUNT(*) query for every product on the index page. 100 products = 100 extra COUNT queries.',
		rootCause:
			'No denormalized count column. Rails must query the reviews table for every product to get the count.',
		codeExample: `# app/services/product_list.rb
class ProductList < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def call
    validation = ListContract.new.call({})
    return Result.new(...) if validation.failure?

    products = Product.includes(:user)
    Result.new(success?: true, products: products, errors: [])
  end
end

# app/serializers/product_serializer.rb
class ProductSerializer < BaseSerializer
  attribute :reviews_count do |product|
    product.reviews.count  # <-- COUNT(*) query per product!
  end
end

# Database log for 100 products:
#   Product Load (1.2ms)  SELECT "products".* FROM "products"
#   (0.4ms)  SELECT COUNT(*) FROM "reviews" WHERE product_id = 1
#   (0.3ms)  SELECT COUNT(*) FROM "reviews" WHERE product_id = 2
#   ... 97 more COUNT queries
#
# includes(:reviews) loads ALL records just to count them!`,
		goal: 'Eliminate expensive COUNT queries by storing pre-computed counts directly on the parent table, then update the serializer to use the cached column.',
		thresholds: { maxQueriesPerRequest: 3 },
	},
	startingPipeline: { nodes: [], connections: [] },
	successConditions: [{ type: 'counter_cache_configured' }],
	availableNodes: [],
	unlockedNodes: [],
	requiresTests: true,
	learningContent: {
		title: 'Counter Caches & Denormalization',
		goal: `In this level, you'll:\n- eliminate expensive COUNT queries by storing the count directly on the parent table.\n- learn how Rails counter caches work and when to use them.\n- configure automatic count maintenance on an association.\n- see how reading a pre-computed column is orders of magnitude faster than counting rows on every request.`,
		conceptExplanation: `A counter cache stores the count of associated records directly on the parent table. Instead of running COUNT(*) on reviews every time, Rails maintains a \`reviews_count\` column on the products table.

**How it works:**
- Add a \`reviews_count\` integer column to the products table (default: 0)
- Add \`counter_cache: true\` to the \`belongs_to\` association
- Rails automatically increments/decrements the count on create/destroy
- \`product.reviews.count\` reads the column instead of running a query. Zero queries!

**Production benchmarks:**
\`\`\`
WITHOUT counter_cache (COUNT query per product):
  Queries: 101 (1 for products + 100 COUNT queries)
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
class AddReviewsCountToProducts < ActiveRecord::Migration[8.0]
  def change
    add_column :products, :reviews_count, :integer, default: 0, null: false
  end
end

# Step 2: Backfill existing counts
class BackfillReviewsCount < ActiveRecord::Migration[8.0]
  def up
    Product.find_each do |product|
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
# No query! Reads products.reviews_count directly.

# Custom column name:
belongs_to :product, counter_cache: :replies_count

# Fix out-of-sync counters:
Product.reset_counters(product_id, :reviews)

# Bulk reset all:
Product.find_each { |p| Product.reset_counters(p.id, :reviews) }

# In serializer, no query needed:
class ProductSerializer < BaseSerializer
  attribute :name
  attribute :description
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
		text: 'Fire probes at different product counts to see the query waterfall grow. The COUNT queries multiply because there is no cached value on the parent table.',
	},
};
