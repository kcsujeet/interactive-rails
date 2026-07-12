import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level32Transactions: Level = {
	id: 'act5-level32-transactions',
	actId: 5,
	levelNumber: 32,
	name: 'Transactions',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'A user spends 10 credits to boost a product, but the boost record never gets created. The credits are gone with no record of what happened.',
	},
	startingPipeline: standardPipeline(),
	problem: {
		observation:
			'The boost pipeline deducts user credits, creates a boost record, and writes a credit log. When step 2 or 3 fails, the credits are already deducted and cannot be restored.',
		rootCause:
			'Each database write commits independently. Without a transaction boundary, a failure midway leaves partial writes that corrupt data integrity.',
		codeExample: `# BAD: Each operation commits independently
class BoostProduct < ApplicationService
  Result = Data.define(:success?, :boost, :errors)

  def initialize(user_id:, product_id:, cost:)
    @user_id = user_id
    @product_id = product_id
    @cost = cost
  end

  def call
    v = BoostContract.new.call(
      user_id: @user_id,
      product_id: @product_id, cost: @cost)
    return Result.new(success?: false,
      boost: nil, errors: v.errors.to_h) if v.failure?

    user = User.find(@user_id)
    user.credits -= @cost
    user.save!
    # Step 1 committed. If step 2 fails...
    boost = Boost.create!(user:, product_id: @product_id,
      reach: 5000)
    # Step 2 committed. If step 3 fails...
    CreditLog.create!(user:, amount: -@cost,
      reason: "boost_product_#{@product_id}")
    Result.new(success?: true, boost:, errors: [])
  end
end`,
		goal: 'Identify the atomicity problem, wrap operations in a transaction with proper abort handling, and build a service object that guarantees all-or-nothing semantics.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'model' },
		{ type: 'connection', sourceType: 'controller', targetType: 'model' },
	],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Transactions (Atomicity)',
		goal: `In this level, you'll:\n- understand why multi-step writes need atomicity guarantees\n- wrap related database writes in a transaction block\n- handle business-rule aborts that trigger a rollback\n- build a service object that ensures all-or-nothing semantics`,
		conceptExplanation: `Transactions ensure a group of database operations either ALL succeed or ALL fail (rollback). Without transactions, a failure midway through a multi-step write leaves data in an inconsistent state.

**The problem:**
\`\`\`ruby
user.save!              # Step 1: committed
Boost.create!(...)      # Step 2: might fail
CreditLog.create!(...)  # Step 3: might fail
# If step 2 fails, step 1 is already persisted!
\`\`\`

**The solution:**
\`\`\`ruby
ActiveRecord::Base.transaction do
  user.save!
  Boost.create!(...)
  CreditLog.create!(...)
end
# If ANY step raises, ALL are rolled back
\`\`\`

**Custom aborts:**
- \`raise ActiveRecord::Rollback\` silently aborts the transaction
- Unlike other exceptions, it does not propagate outside the block
- Use it for business rule failures (e.g., insufficient credits)

**Key rules:**
- Always wrap related writes in a transaction
- Any exception inside the block triggers rollback
- The transaction returns nil when rolled back via Rollback

**Race conditions (the check-then-set bug):**
The naive transaction body still has a race. Two concurrent boost requests can both pass \`user.credits < @cost\`, both decrement, and the user ends up with negative credits. The transaction guarantees atomicity, not isolation from concurrent writers.

Two production-safe fixes:

1. \`user.lock!\` (pessimistic, SELECT FOR UPDATE):
\`\`\`ruby
ActiveRecord::Base.transaction do
  user = User.lock.find(@user_id)   # blocks other writers
  raise ActiveRecord::Rollback if user.credits < @cost
  user.update!(credits: user.credits - @cost)
end
\`\`\`

2. Atomic conditional UPDATE (lock-free, fastest at scale):
\`\`\`ruby
updated = User.where(id: @user_id)
              .where('credits >= ?', @cost)
              .update_all(['credits = credits - ?', @cost])
return Result.new(success?: false, ...) if updated.zero?
\`\`\`
For pure counter/balance operations, the conditional UPDATE is the right tool. No row lock, no transaction needed for that step; the database enforces the invariant.

**Isolation levels:**
PostgreSQL defaults to READ COMMITTED. Inside a transaction, repeated SELECTs on the same row may see different values if another transaction commits in between. For multi-row consistency (read three rows, decide, write), bump the isolation level:

\`\`\`ruby
ActiveRecord::Base.transaction(isolation: :repeatable_read) do
  ...
end
\`\`\`
\`:serializable\` is the strongest setting; it makes Postgres behave as if transactions ran one at a time, but it can raise \`ActiveRecord::SerializationFailure\` on conflict. Code that uses \`:serializable\` must retry on that error.

**Deadlocks (retry with backoff):**
When two transactions touch the same rows in different orders, PostgreSQL detects the cycle and aborts one with \`ActiveRecord::Deadlocked\`. Production code should retry a small number of times before giving up:

\`\`\`ruby
def call
  retries = 0
  begin
    ActiveRecord::Base.transaction { ... }
  rescue ActiveRecord::Deadlocked, ActiveRecord::SerializationFailure
    retries += 1
    if retries < 3
      sleep(0.05 * (2 ** retries))   # 50ms, 100ms, 200ms
      retry
    end
    raise
  end
end
\`\`\`

**Never do I/O inside a transaction:**
Every transaction holds row locks and a connection from the pool until COMMIT. If you call an external HTTP API, send an email, or sleep inside the block, you hold those locks for that entire wait. At scale this exhausts the connection pool and cascades into request timeouts. The rule: do I/O before the transaction (validate the request) or after (in an \`after_commit\` callback). Never during.

**\`after_commit\` vs \`after_save\` for side effects:**
\`after_save\` fires INSIDE the transaction, BEFORE the COMMIT. If you enqueue a background job from \`after_save\`, the worker can pick it up and look up the record before the transaction commits, getting \`ActiveRecord::RecordNotFound\`. Always use \`after_commit\` (or Rails 7.2+'s \`enqueue_after_transaction_commit: :always\` on the job class) for any side effect that depends on the row being persisted.

\`\`\`ruby
# WRONG
class Boost < ApplicationRecord
  after_save :notify_user   # might fire before COMMIT
end

# RIGHT
class Boost < ApplicationRecord
  after_commit :notify_user, on: :create
end

# OR (Rails 7.2+)
class NotifyUserJob < ApplicationJob
  self.enqueue_after_transaction_commit = :always
end
\`\`\`

**Nested transactions and savepoints:**
Rails does NOT begin a real nested transaction by default. A second \`ActiveRecord::Base.transaction do\` block joins the outer one as a no-op. To get a real partial-rollback boundary, pass \`requires_new: true\` to create a SAVEPOINT:

\`\`\`ruby
ActiveRecord::Base.transaction do
  user.update!(credits: user.credits - cost)

  ActiveRecord::Base.transaction(requires_new: true) do
    Boost.create!(...)
    raise ActiveRecord::Rollback if some_condition  # rolls back ONLY this savepoint
  end

  CreditLog.create!(...)   # still runs even if the inner block rolled back
end
\`\`\`
Without \`requires_new: true\`, an inner \`Rollback\` is silently swallowed and the outer transaction commits anyway, which is almost never what you want.`,
		railsCodeExample: `# app/contracts/boost_contract.rb
class BoostContract < Dry::Validation::Contract
  params do
    required(:user_id).filled(:integer)
    required(:product_id).filled(:integer)
    required(:cost).filled(:integer, gt?: 0)
  end
end

# app/services/boost_product.rb
class BoostProduct < ApplicationService
  Result = Data.define(:success?, :boost, :errors)

  def initialize(user_id:, product_id:, cost:)
    @user_id = user_id
    @product_id = product_id
    @cost = cost
  end

  def call
    v = BoostContract.new.call(
      user_id: @user_id,
      product_id: @product_id, cost: @cost)
    return Result.new(success?: false,
      boost: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      user = User.find(@user_id)
      raise ActiveRecord::Rollback if user.credits < @cost
      user.credits -= @cost
      user.save!
      boost = Boost.create!(user:, product_id: @product_id,
        reach: 5000)
      CreditLog.create!(user:, amount: -@cost,
        reason: "boost_product_#{@product_id}")
      Result.new(success?: true, boost:, errors: [])
    end || Result.new(success?: false, boost: nil,
      errors: ["Insufficient credits"])
  end
end`,
		commonMistakes: [
			'Not wrapping related writes in a transaction (partial failures corrupt data)',
			'Using begin/rescue/reload instead of a real transaction for rollback',
			'Returning false inside a transaction and expecting rollback (only raise works)',
			'Nesting transactions without requires_new: true (the inner Rollback is silently swallowed and the outer transaction still commits)',
			'Check-then-set inside a transaction without lock! or atomic UPDATE (two concurrent requests both pass the check, then both write, leaving the counter negative)',
			'Using after_save to enqueue jobs (the worker may dequeue before COMMIT and hit RecordNotFound). Use after_commit instead',
			'Doing HTTP calls or sending email inside a transaction block (holds row locks and a DB connection for the entire wait, exhausts the pool under load)',
			'Not retrying on ActiveRecord::Deadlocked (Postgres aborts one transaction in any deadlock; production code retries 2-3 times with backoff)',
			'Reading and writing across multiple rows under READ COMMITTED and assuming consistency (bump to :repeatable_read or :serializable, or take row locks)',
		],
		whenToUse:
			'Any time multiple database writes must succeed or fail together: deduct credits + create record, transfer between accounts, multi-table updates.',
		furtherReading: [
			{
				title: 'Active Record Transactions',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Transactions/ClassMethods.html',
			},
			{
				title: 'Active Record Pessimistic Locking',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Locking/Pessimistic.html',
			},
			{
				title: 'PostgreSQL Transaction Isolation',
				url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
			},
			{
				title: 'Rails 7.2: enqueue_after_transaction_commit',
				url: 'https://api.rubyonrails.org/classes/ActiveJob/EnqueueAfterTransactionCommit.html',
			},
		],
		homework: [
			{
				task: 'Prove all-or-nothing in your console: create a product inside a transaction, then abort with ActiveRecord::Rollback.',
				commands: [
					'bin/rails console',
					'before = Product.count',
					'ActiveRecord::Base.transaction { Product.create!(name: "Tx test", price: 5); raise ActiveRecord::Rollback }',
					'Product.count == before',
				],
				verify:
					'The count is unchanged and the SQL log shows BEGIN ... ROLLBACK instead of COMMIT. Note that ActiveRecord::Rollback did not propagate: the block returned nil silently.',
			},
			{
				task: 'Contrast with a regular exception: it rolls back AND propagates to the caller.',
				commands: [
					'bin/rails console',
					'before = Product.count',
					'begin; ActiveRecord::Base.transaction { Product.create!(name: "Tx boom", price: 5); raise "boom" }; rescue => e; puts e.message; end',
					'Product.count == before',
				],
				verify:
					'"boom" reaches your rescue block and the product was still rolled back: any exception aborts the transaction, but only ActiveRecord::Rollback is swallowed.',
			},
			{
				task: 'Demonstrate savepoints: without requires_new: true an inner Rollback is swallowed by the outer transaction.',
				commands: [
					'bin/rails console',
					'before = Product.count',
					'ActiveRecord::Base.transaction { Product.create!(name: "Outer", price: 1); ActiveRecord::Base.transaction(requires_new: true) { Product.create!(name: "Inner", price: 1); raise ActiveRecord::Rollback } }',
					'Product.count - before',
				],
				verify:
					'The count went up by exactly 1: the savepoint rolled back only the inner create while the outer transaction still committed "Outer".',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'What guarantees that all three steps succeed or fail together? Think about database-level atomicity.',
	},
};
