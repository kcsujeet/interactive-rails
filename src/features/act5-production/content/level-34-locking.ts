import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level34Locking: Level = {
	id: 'act5-level34-locking',
	actId: 5,
	levelNumber: 34,
	name: 'Locking',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'Two customers check out the same product simultaneously. Both see "15 in stock." Customer A buys 10, Customer B buys 8. Final stock is 7, not the expected result. 18 units sold, only 8 deducted.',
	},
	startingPipeline: standardPipeline(),
	problem: {
		observation:
			'Customer A reads stock (15), Customer B reads stock (15). A buys 10, saves 5. B buys 8, saves 7, overwriting A. 18 units sold, only 8 deducted. Lost update.',
		rootCause:
			'No row-level locking. Concurrent reads followed by concurrent writes cause lost updates because each request operates on stale data.',
		codeExample: `# BAD: No locking in the service
class PlaceOrder < ApplicationService
  Result = Data.define(:success?, :order, :errors)

  def initialize(product_id:, quantity:)
    @product_id = product_id
    @quantity = quantity
  end

  def call
    v = OrderContract.new.call(
      product_id: @product_id, quantity: @quantity)
    return Result.new(success?: false,
      order: nil, errors: v.errors.to_h) if v.failure?

    product = Product.find(@product_id)
    # Request A reads 15, Request B reads 15 (stale!)
    product.stock_count -= @quantity
    product.save!
    # Request A saves 5, Request B saves 5 (overwrites!)
    Result.new(success?: true, order: nil, errors: [])
  end
end`,
		goal: 'Prevent lost updates from concurrent access by adding both optimistic and pessimistic locking strategies, and build a service that handles conflicts gracefully.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'model' },
		{ type: 'connection', sourceType: 'controller', targetType: 'model' },
	],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Locking (Concurrency Control)',
		goal: `In this level, you'll:\n- understand how concurrent access causes lost updates\n- add optimistic locking with a version column that detects stale writes\n- add pessimistic locking that holds a database lock during critical sections\n- handle conflict errors gracefully on low-contention resources`,
		conceptExplanation: `Locking prevents concurrent access from corrupting shared data. Two strategies exist:

**Optimistic Locking (lock_version column):**
- No database locks held during read
- On save, Rails checks if \`lock_version\` has changed since the record was loaded
- If changed, raises \`ActiveRecord::StaleObjectError\`
- Best for low-contention resources (product edits, CMS pages)

**Pessimistic Locking (SELECT ... FOR UPDATE):**
- Acquires a database row lock when reading
- Other transactions must wait until the lock is released (on COMMIT/ROLLBACK)
- Best for high-contention resources (inventory counts, order totals)

**Rule of thumb:**
- Low contention + user-facing: Optimistic (detect conflict, ask user to retry)
- High contention + financial: Pessimistic (serialize access, no lost updates)

**Key API:**
\`\`\`ruby
# Pessimistic
Product.lock.find(id)     # SELECT ... FOR UPDATE
product.with_lock { ... } # lock + block

# Optimistic (needs lock_version column)
product.save! # raises StaleObjectError if version mismatch
\`\`\``,
		railsCodeExample: `# app/contracts/order_contract.rb
class OrderContract < Dry::Validation::Contract
  params do
    required(:product_id).filled(:integer)
    required(:quantity).filled(:integer, gt?: 0)
  end
end

# app/services/place_order.rb
class PlaceOrder < ApplicationService
  Result = Data.define(:success?, :order, :errors)

  def initialize(product_id:, quantity:)
    @product_id = product_id
    @quantity = quantity
  end

  def call
    v = OrderContract.new.call(
      product_id: @product_id, quantity: @quantity)
    return Result.new(success?: false,
      order: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      product = Product.lock.find(@product_id)
      raise InsufficientStockError if product.stock_count < @quantity
      product.stock_count -= @quantity
      product.save!
      order = Order.create!(product:, quantity: @quantity,
        user: Current.user)
      Result.new(success?: true, order:, errors: [])
    end
  rescue InsufficientStockError
    Result.new(success?: false, order: nil,
      errors: ["Insufficient stock"])
  end
end

# app/controllers/api/v1/orders_controller.rb
class Api::V1::OrdersController < ApplicationController
  def create
    result = PlaceOrder.call(
      product_id: params.expect(order: [:product_id])[:product_id],
      quantity: params.expect(order: [:quantity])[:quantity])
    if result.success?
      render json: OrderSerializer.new(result.order),
        status: :created
    else
      render json: { error: { code: "ORDER_FAILED",
        message: "Could not place order",
        details: result.errors } },
        status: :unprocessable_entity
    end
  rescue ActiveRecord::StaleObjectError
    render json: { error: { code: "CONFLICT",
      message: "Product was modified by another request",
      details: {} } }, status: :conflict
  end
end`,
		commonMistakes: [
			'Using optimistic locking for inventory operations (too many retries under load)',
			'Holding pessimistic locks too long (causes deadlocks and timeouts)',
			'Forgetting to handle StaleObjectError when using optimistic locking',
			'Using pessimistic locks for low-contention product edits (overkill)',
		],
		whenToUse:
			'Pessimistic locking for inventory and financial data. Optimistic locking for product details and content edits.',
		furtherReading: [
			{
				title: 'Active Record Locking',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Locking.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Think about what happens when two checkout requests read the same product row. What mechanism can serialize their writes?',
	},
};
