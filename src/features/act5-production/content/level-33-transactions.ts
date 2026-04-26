import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level33Transactions: Level = {
	id: 'act5-level33-transactions',
	actId: 5,
	levelNumber: 33,
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
- The transaction returns nil when rolled back via Rollback`,
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
			'Nesting transactions without understanding savepoints',
		],
		whenToUse:
			'Any time multiple database writes must succeed or fail together: deduct credits + create record, transfer between accounts, multi-table updates.',
		furtherReading: [
			{
				title: 'Active Record Transactions',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Transactions/ClassMethods.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'What guarantees that all three steps succeed or fail together? Think about database-level atomicity.',
	},
};
