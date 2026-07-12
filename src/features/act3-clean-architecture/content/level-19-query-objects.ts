import type { Level } from '@/types';

export const level19QueryObjects: Level = {
	id: 'act3-level19-query-objects',
	actId: 3,
	levelNumber: 19,
	name: 'Query Objects',
	requiresTests: true,
	trigger: {
		type: 'code_review',
		description:
			'Code review finds a 60-line admin controller action with inline .where().joins().group().order() chains. The same filtering logic is duplicated in the API controller and CSV export job.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 460,
				y: 250,
				locked: true,
				config: { label: 'Admin::ProductsController' },
			},
			{
				id: 'product-model',
				type: 'model',
				x: 680,
				y: 250,
				locked: true,
				config: { label: 'Product' },
			},
			{ id: 'database-node', type: 'database', x: 880, y: 250, locked: true },
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
		],
	},
	problem: {
		observation:
			'The admin dashboard controller has a 60-line index action with inline .where().joins().group().order() chains. The same filtering logic is copy-pasted in the API controller and CSV export job with slight inconsistencies.',
		rootCause:
			'Complex query logic is embedded in the controller instead of being extracted into a composable query object in app/queries/.',
		codeExample: `# app/controllers/api/admin/products_controller.rb
class Api::Admin::ProductsController < ApplicationController
  def index
    @products = Product.all

    # 60 lines of inline query chains!
    if params[:listed].present?
      @products = @products.where.not(listed_at: nil)
    end

    if params[:seller_id].present?
      @products = @products.where(seller_id: params[:seller_id])
    end

    if params[:since].present?
      @products = @products.where("listed_at >= ?", params[:since])
    end

    if params[:min_reviews].present?
      @products = @products
        .left_joins(:reviews)
        .group(:id)
        .having("COUNT(reviews.id) >= ?", params[:min_reviews])
    end

    if params[:tag].present?
      @products = @products.joins(:tags).where(tags: { name: params[:tag] })
    end

    @products = @products.order(params[:sort] || :listed_at => :desc)

    render json: @products
  end
end

# app/controllers/api/products_controller.rb -- SAME LOGIC COPY-PASTED
# app/jobs/csv_export_job.rb -- AND AGAIN with slight differences`,
		goal: 'Extract query logic into a composable ProductQuery object with chainable filter methods that returns ActiveRecord::Relation.',
		thresholds: {},
	},
	successConditions: [{ type: 'query_object_created' }],
	availableNodes: ['query_object'],
	unlockedNodes: ['query_object'],
	learningContent: {
		title: 'Query Objects: Composable PORO Queries',
		goal: `In this level, you'll:\n- learn how to extract complex query logic from controllers into reusable query objects.\n- build composable filter methods that chain together and always return ActiveRecord::Relation.\n- share the same query logic across controllers, background jobs, and exports without duplication.`,
		conceptExplanation: `Query objects extract complex query chains from controllers into reusable POROs in \`app/queries/\`.

**Why use query objects?**
- Controllers stay thin (just HTTP concerns)
- Query logic is testable in isolation
- Filters are composable and reusable across controllers, jobs, and rake tasks
- Each method returns \`self\` for chaining, and \`#results\` returns the final \`ActiveRecord::Relation\`

**Structure:**
1. \`ApplicationQuery\` base class with \`#initialize(scope)\` and \`#results\`
2. Concrete query classes (e.g., \`ProductQuery\`) with filter methods
3. Each method guards blank params: \`return self if param.blank?\`
4. \`#results\` returns \`ActiveRecord::Relation\` (not Array!) so pagination, further scopes, and eager loading still work

**When to extract:**
- Controller has >15 lines of query logic
- Same filters are needed in multiple controllers, jobs, or rake tasks
- Query involves JOINs, GROUP BY, HAVING, or subqueries

**Scopes vs. query objects:** For single-purpose filters, use named scopes (\`scope :visible, -> { where.not(listed_at: nil) }\`). Query objects are the next step when you need composable, multi-filter logic that spans parameters.

**Key principle:** Always return \`ActiveRecord::Relation\`, never \`.to_a\` or \`.map\`. This preserves lazy loading and lets callers add pagination, includes, or further scopes.

**Compose with Pundit, do not bypass authorization:**
A query object that returns \`Product.all\` returns every product, including ones the current user is not allowed to see. The production-safe pattern combines query objects with \`policy_scope\` so the user's authorization IS the base scope:

\`\`\`ruby
def index
  base = policy_scope(Product)            # Pundit narrows to what user can see
  products = ProductQuery.new(base)
    .by_seller(params[:seller_id])
    .results
  render json: products
end
\`\`\`
The query object never knows about authorization; the caller composes the two layers.

**Eager-load INSIDE the query object:**
A query object that returns 100 products and then the controller calls \`.map(&:reviews)\` produces 100 + 1 queries. Either: (a) document that the caller must add \`.includes\`, or (b) embed it in the query object as a chainable filter so the dependency is explicit:

\`\`\`ruby
def with_reviews
  @scope = @scope.includes(:reviews, :tags)
  self
end
\`\`\`
Option (b) is the safer default: the consumer of the query object cannot accidentally trigger N+1.

**Cursor pagination over offset pagination:**
\`Product.limit(100).offset(50_000)\` makes Postgres scan 50,100 rows to return 100. At a few thousand rows the cost is invisible; at a few million it is the slowest endpoint in the app. Cursor pagination uses an indexed comparison instead:

\`\`\`ruby
def after(last_id)
  return self if last_id.blank?
  @scope = @scope.where("products.id > ?", last_id)
  self
end
\`\`\`
The result is O(1) regardless of how deep the user has paged. The \`pagy\` gem supports both styles. Use offset for admin tables that page 10 deep; use cursor for any list that scrolls.

**EXPLAIN every new query:**
Before shipping a query object method, run \`Product.all.explain\` (or \`ProductQuery.new.with_min_reviews(5).results.explain\`) and read the plan. Look for \`Seq Scan\` on tables with more than ~10K rows, or \`Sort\` lines without a matching index. The most common production performance bug is "fast in dev because the table has 200 rows; sequential-scans 50M in prod." The fix is almost always an index, occasionally a query rewrite.

**Subquery composition: \`where(id: relation)\`, not \`pluck\`:**
The wrong shape:
\`\`\`ruby
hot_seller_ids = User.where(...).pluck(:id)        # materializes IDs in Ruby
@scope = @scope.where(seller_id: hot_seller_ids)   # then sends them all back
\`\`\`
The right shape:
\`\`\`ruby
@scope = @scope.where(seller_id: User.where(...))  # one SQL subquery, indexed
\`\`\`
\`pluck\` followed by \`where(id: array)\` is the same query expressed in the worst possible way: round-trip through Ruby memory, then a giant IN clause. Pass the relation, let Postgres push down the join.

**OR composition needs \`merge\` or \`.or\`:**
Chained \`where\` is implicitly AND. To express "active products that are EITHER discounted OR in the top tag," use \`.or\`:

\`\`\`ruby
def discounted_or_top_tagged
  @scope = @scope.where(active: true).where(
    discounted_scope.or(top_tagged_scope).where_clause.ast
  )
  self
end
\`\`\`
Or compose by merging two named scopes. Mixing \`.or\` with eager loading has gotchas (\`includes\` may be silently dropped); test with EXPLAIN.

**Read replicas: route reads to the replica, writes to primary:**
Most billion-dollar SaaS apps have a primary database for writes and one or more read replicas for analytical queries. Wrapping the query object body in a \`connected_to\` block lets Rails route the SELECTs to the replica:

\`\`\`ruby
def call
  ActiveRecord::Base.connected_to(role: :reading) do
    ProductQuery.new
      .listed(params[:listed])
      .results
  end
end
\`\`\`
Replicas have replication lag (typically 50-500ms). Never use a replica for "I just wrote this row, now read it back" flows; that race condition is the cause of "ghost data" reports.`,
		railsCodeExample: `# app/queries/application_query.rb
class ApplicationQuery
  attr_reader :scope

  def initialize(scope = default_scope)
    @scope = scope
  end

  def results
    scope
  end

  private

  def default_scope
    raise NotImplementedError
  end
end

# app/queries/product_query.rb
class ProductQuery < ApplicationQuery
  def listed(flag)
    return self if flag.blank?

    @scope = @scope.where.not(listed_at: nil)
    self
  end

  def by_seller(seller_id)
    return self if seller_id.blank?

    @scope = @scope.where(seller_id: seller_id)
    self
  end

  def since(date)
    return self if date.blank?

    @scope = @scope.where("listed_at >= ?", date)
    self
  end

  def with_min_reviews(count)
    return self if count.blank?

    @scope = @scope
      .left_joins(:reviews)
      .group(:id)
      .having("COUNT(reviews.id) >= ?", count)
    self
  end

  def by_tag(tag_name)
    return self if tag_name.blank?

    @scope = @scope.joins(:tags).where(tags: { name: tag_name })
    self
  end

  SORTABLE_COLUMNS = %w[listed_at created_at name].freeze
  SORT_DIRECTIONS = %w[asc desc].freeze

  def sorted(column = :listed_at, direction = :desc)
    safe_column = SORTABLE_COLUMNS.include?(column.to_s) ? column : :listed_at
    safe_direction = SORT_DIRECTIONS.include?(direction.to_s) ? direction : :desc
    @scope = @scope.order(safe_column => safe_direction)
    self
  end

  private

  def default_scope
    Product.all
  end
end

# app/controllers/api/admin/products_controller.rb -- clean!
class Api::Admin::ProductsController < ApplicationController
  def index
    products = ProductQuery.new
      .listed(params[:listed])
      .by_seller(params[:seller_id])
      .since(params[:since])
      .with_min_reviews(params[:min_reviews])
      .by_tag(params[:tag])
      .sorted(params[:sort], params[:direction])
      .results

    render json: ProductSerializer.new(products).serializable_hash.to_json
  end
end

# Reuse in API controller with different base scope:
class Api::ProductsController < ApplicationController
  def index
    products = ProductQuery.new(Product.where.not(listed_at: nil))
      .by_seller(params[:seller_id])
      .by_tag(params[:tag])
      .sorted
      .results

    render json: ProductSerializer.new(products).serializable_hash.to_json
  end
end

# Reuse from a CSV exporter (any caller can compose
# the same query, controllers, scripts, later you'll
# see this called from a background job too):
class CsvProductExport
  def initialize(filters)
    @filters = filters
  end

  def call
    products = ProductQuery.new
      .listed(true)
      .since(@filters[:since])
      .sorted(:created_at, :asc)
      .results

    CsvGenerator.new(products).generate
  end
end

# test/queries/product_query_test.rb
class ProductQueryTest < ActiveSupport::TestCase
  test "listed filters to products with listed_at" do
    listed = products(:with_listed_at)
    unlisted = products(:without_listed_at)

    results = ProductQuery.new.listed(true).results

    assert_includes results, listed
    refute_includes results, unlisted
  end

  test "blank params are skipped" do
    all_products = Product.count
    results = ProductQuery.new.by_seller("").results

    assert_equal all_products, results.count
  end

  test "methods are chainable" do
    results = ProductQuery.new
      .listed(true)
      .by_seller(users(:alice).id)
      .sorted
      .results

    assert results.is_a?(ActiveRecord::Relation)
  end

  test "with_min_reviews uses GROUP + HAVING" do
    popular = products(:popular)  # has 5 reviews
    results = ProductQuery.new.with_min_reviews(3).results

    assert_includes results, popular
  end

  test "custom base scope narrows results" do
    results = ProductQuery.new(Product.where.not(listed_at: nil)).results
    assert results.all? { |p| p.listed_at.present? }
  end
end`,
		commonMistakes: [
			'Returning Array instead of ActiveRecord::Relation (breaks pagination, eager loading, and further chaining)',
			'Not guarding blank params with `return self if param.blank?` (causes spurious WHERE clauses)',
			'Passing raw user input to .order() without an allowlist (SQL injection via sort column/direction)',
			'One giant method instead of composable filters (defeats the purpose of query objects)',
			'Putting query object logic in model scopes instead (scopes are fine for simple single-purpose filters, but query objects compose better for multi-filter scenarios)',
			'Forgetting to pass IDs instead of ActiveRecord objects for serialization-safe job arguments',
			'Calling Model.all as the base scope instead of policy_scope(Model). The query object now silently bypasses Pundit authorization',
			'Caller does .results.map(&:reviews) and triggers N+1. Embed .includes in the query object so the eager load is part of the contract',
			"OFFSET pagination on a table that grows to millions of rows. Use cursor pagination (where('id > ?', last_id)) for any list that scrolls past the first few pages",
			'Shipping a new query method without running .explain to verify the plan. "Fast in dev, sequential scan in prod" is the most common scaling bug',
			'Materializing a subquery via pluck (round-trip through Ruby memory). Pass the relation directly: where(seller_id: User.where(...)) lets Postgres push the join down',
			'Using read replicas for write-then-read flows (replication lag causes ghost-data reports). Reads after writes go to primary',
		],
		whenToUse:
			'When a controller has >15 lines of query logic, when the same filters are needed in multiple controllers or jobs, or when queries involve complex JOINs, GROUP BY, or subqueries.',
		furtherReading: [
			{
				title: 'Thoughtbot: A Case for Query Objects',
				url: 'https://thoughtbot.com/blog/a-case-for-query-objects-in-rails',
			},
			{
				title: 'Ransack Gem (alternative for simple search/filter UIs)',
				url: 'https://github.com/activerecord-hackery/ransack',
			},
			{
				title: 'pagy (cursor + offset pagination)',
				url: 'https://github.com/ddnexus/pagy',
			},
			{
				title: 'Active Record multiple databases (read replicas)',
				url: 'https://guides.rubyonrails.org/active_record_multiple_databases.html',
			},
			{
				title: 'PostgreSQL EXPLAIN docs',
				url: 'https://www.postgresql.org/docs/current/sql-explain.html',
			},
		],
		homework: [
			{
				task: 'Create app/queries/application_query.rb in your store_api app (initialize with a scope, results returns it) plus a ProductQuery with chainable filters: by_seller (filtering on your products.user_id column), since (listed on or after a date), and an allowlisted sorted. Every filter guards blank params with return self.',
				commands: ['bin/rails console'],
				verify:
					'ProductQuery.new.by_seller(user.id).since(1.week.ago).sorted.results returns an ActiveRecord::Relation, and passing blank arguments leaves the scope untouched.',
			},
			{
				task: 'Move the index filtering onto the query object so the controller shrinks back to HTTP work: parse params, compose the query, render.',
				commands: [
					'curl "http://localhost:3000/api/v1/products?seller_id=1" -H "Authorization: Bearer <token>"',
				],
				verify:
					'Filtered requests return only matching products, and the index action no longer contains inline where chains.',
			},
			{
				task: 'Read the query plan before you trust the query: run explain on a composed query from the console.',
				commands: [
					'bin/rails console',
					'ProductQuery.new.by_seller(1).sorted.results.explain',
				],
				verify:
					'A query plan prints; a Seq Scan on products tells you an index is missing before production traffic tells you instead.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Query Object node between the Controller and Model. Each filter method returns self for chaining, and #results returns the final ActiveRecord::Relation.',
	},
};
