import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level33Locking: Level = {
	id: 'act5-level33-locking',
	actId: 5,
	levelNumber: 33,
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
\`\`\`

**Third option: lock-free atomic UPDATE.**
For pure counter-style operations (stock, credits, balance), neither pessimistic nor optimistic locking is the right tool. The atomic conditional UPDATE is faster than both and correct under concurrency:

\`\`\`ruby
updated = Product.where(id: @product_id)
                 .where('stock_count >= ?', @quantity)
                 .update_all(['stock_count = stock_count - ?', @quantity])
return Result.new(success?: false, errors: ["Insufficient stock"]) if updated.zero?
\`\`\`
The database enforces the invariant atomically: \`stock_count >= quantity\` AND the decrement happen in one statement, no row lock held, no transaction needed for that step. \`updated.zero?\` means either the row doesn't exist OR another concurrent update beat us to it; both are "no, retry or fail." For high-contention numeric fields, this is the production-safe default. Pessimistic locks become the right tool when you need to read-then-write multiple FIELDS on the same row in a way that resists losing updates.

**Lock ordering prevents deadlocks:**
Two transactions that lock multiple rows in different orders deadlock:

\`\`\`
T1: lock Product A, then lock Order X
T2: lock Order X, then lock Product A
\`\`\`
Each waits forever for the other. PostgreSQL detects the cycle and aborts one with \`ActiveRecord::Deadlocked\` (covered in L33's retry pattern). The defensive rule: always acquire locks in a consistent order across the codebase. Pick a canonical sort (by id, by class name) and stick to it. The convention has to be a codebase-wide rule; one careless service that locks Order before Product creates the cycle.

**Lock timeouts:**
\`SELECT FOR UPDATE\` waits for the lock. If another transaction holds it for 30 seconds because of an HTTP call, your request blocks for those 30 seconds. Set a per-statement lock timeout to fail fast:

\`\`\`ruby
ActiveRecord::Base.transaction do
  ActiveRecord::Base.connection.execute("SET LOCAL lock_timeout = '5s'")
  product = Product.lock.find(@product_id)
  # ... rest of the work
end
\`\`\`
A timeout of 5-10s catches "something is wrong upstream" without needing the deadlock detector. Without a timeout, a stuck dependency can stall every order placement.

**\`SKIP LOCKED\` for queue-style processing:**
For "give me the next available row to process" (job queues, inventory pickers, lead distribution), \`SELECT FOR UPDATE\` makes every worker wait for every other. \`SELECT FOR UPDATE SKIP LOCKED\` skips locked rows so each worker grabs a different one:

\`\`\`ruby
job = Job.where(status: 'pending').lock('FOR UPDATE SKIP LOCKED').first
\`\`\`
Solid Queue uses this internally; if you build a hand-rolled queue, this is the only pattern that scales. Without it, two workers fighting over the same row is the slowest part of the system.

**\`NOWAIT\` for fail-fast:**
\`SELECT FOR UPDATE NOWAIT\` raises immediately if the row is locked instead of waiting. Right tool for "I want to try this; if I cannot, return immediately so the caller can retry":

\`\`\`ruby
Product.lock('FOR UPDATE NOWAIT').find(@product_id)
# raises ActiveRecord::LockWaitTimeout immediately if another tx holds the lock
\`\`\`

**Advisory locks for non-row resources:**
"Only one worker should run this rake task at a time across the cluster" is not about a row. PostgreSQL advisory locks are a separate lock space, named by an integer key:

\`\`\`ruby
ActiveRecord::Base.connection.execute("SELECT pg_advisory_lock(42)")
begin
  # critical section: only one connection holds key 42
ensure
  ActiveRecord::Base.connection.execute("SELECT pg_advisory_unlock(42)")
end
\`\`\`
The \`with_advisory_lock\` gem wraps this with a block API and timeout. Use for cron jobs that should not overlap, distributed work coordination, and "leader election" patterns.

**Optimistic lock retry (the missing pattern):**
The example renders 409 Conflict when \`StaleObjectError\` fires. That is the right thing for user-facing edits ("someone else changed this; reload and try again"). For server-driven operations where retry is automatic, the pattern is rescue + reload + reapply + save:

\`\`\`ruby
def call
  retries = 0
  begin
    product = Product.find(@product_id)
    apply_changes(product)
    product.save!
  rescue ActiveRecord::StaleObjectError
    retries += 1
    retry if retries < 3
    raise
  end
end
\`\`\`
Cap the retries (3 is conventional). Unbounded retries under contention turn a momentary conflict into a hot loop.

**Database-level CHECK constraints as the safety net:**
\`stock_count >= 0\` is an invariant that the application enforces, but a buggy code path can violate it. A database CHECK constraint catches the bug before it corrupts data:

\`\`\`ruby
class AddStockCheckToProducts < ActiveRecord::Migration[8.0]
  def change
    add_check_constraint :products, 'stock_count >= 0', name: 'stock_non_negative'
  end
end
\`\`\`
The constraint refuses any INSERT or UPDATE that would result in negative stock. Defense in depth: locks at the application layer, constraints at the database layer. Application bugs become \`PG::CheckViolation\` errors (loud failure) instead of silent data corruption (debugging nightmare).`,
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
			'Using lock! when an atomic conditional UPDATE would do (counters and balances do not need a row lock; the database enforces the invariant in a single statement)',
			'Inconsistent lock ordering across services (T1 locks Product then Order, T2 locks Order then Product, deadlock). Pick a canonical order and document it',
			'No lock_timeout set; SELECT FOR UPDATE waits forever when another transaction is stuck on I/O',
			'Using SELECT FOR UPDATE for queue-style "next available row" processing instead of FOR UPDATE SKIP LOCKED (every worker fights every other)',
			'No retry around StaleObjectError for server-driven optimistic-lock flows (one momentary conflict bubbles up as a 500)',
			'No database-level CHECK constraint as a safety net (an application bug can drive stock_count negative without the database noticing)',
			'Doing HTTP calls inside the transaction holding the lock (covered in L33 but worth restating: connection pool exhaustion plus long-held locks cascade)',
		],
		whenToUse:
			'Pessimistic locking for inventory and financial data. Optimistic locking for product details and content edits.',
		furtherReading: [
			{
				title: 'Active Record Locking',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Locking.html',
			},
			{
				title: 'PostgreSQL row locks (FOR UPDATE / SKIP LOCKED / NOWAIT)',
				url: 'https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE',
			},
			{
				title: 'PostgreSQL advisory locks',
				url: 'https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS',
			},
			{
				title: 'with_advisory_lock gem',
				url: 'https://github.com/ClosureTree/with_advisory_lock',
			},
			{
				title: 'PostgreSQL CHECK constraints',
				url: 'https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Think about what happens when two checkout requests read the same product row. What mechanism can serialize their writes?',
	},
};
