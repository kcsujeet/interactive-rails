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
		codeExample: `# app/controllers/api/v1/admin/products_controller.rb
class Api::V1::Admin::ProductsController < ApplicationController
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

# app/controllers/api/v1/products_controller.rb -- SAME LOGIC COPY-PASTED
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

**Key principle:** Always return \`ActiveRecord::Relation\`, never \`.to_a\` or \`.map\`. This preserves lazy loading and lets callers add pagination, includes, or further scopes.`,
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

# app/controllers/api/v1/admin/products_controller.rb -- clean!
class Api::V1::Admin::ProductsController < ApplicationController
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
class Api::V1::ProductsController < ApplicationController
  def index
    products = ProductQuery.new(Product.where.not(listed_at: nil))
      .by_seller(params[:seller_id])
      .by_tag(params[:tag])
      .sorted
      .results

    render json: ProductSerializer.new(products).serializable_hash.to_json
  end
end

# Reuse in background job:
class CsvExportJob < ApplicationJob
  def perform(filters)
    products = ProductQuery.new
      .listed(true)
      .since(filters[:since])
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
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Query Object node between the Controller and Model. Each filter method returns self for chaining, and #results returns the final ActiveRecord::Relation.',
	},
};
