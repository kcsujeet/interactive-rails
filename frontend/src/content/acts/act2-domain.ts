/**
 * Act II: The Domain Layer
 * "Clean Code."
 *
 * Levels 6-12: Refactoring, Patterns, Robustness
 */

import type { Act, Level } from '../../components/game/types';

// ============================================
// Level 6: The Fat Controller
// ============================================

const level6FatController: Level = {
  id: 'act2-level6-fat-controller',
  actId: 2,
  levelNumber: 6,
  name: 'The Fat Controller',
  trigger: {
    type: 'refactor_request',
    description: 'The CreateOrder controller is 300 lines long. It\'s handling payment, inventory, and emails. It is brittle.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 400, y: 250, locked: false }, // Can be modified
      { id: 'model-node', type: 'model', x: 600, y: 250, locked: true, config: { label: 'Order' } },
      { id: 'database-node', type: 'database', x: 780, y: 250, locked: true },
      { id: 'view-node', type: 'view', x: 920, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 1060, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
      { id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c5', sourceNodeId: 'database-node', targetNodeId: 'view-node' },
      { id: 'c6', sourceNodeId: 'view-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Controller node pulsing Red (Complexity limit exceeded). Changes keep breaking things.',
    rootCause: 'Too much business logic in the controller.',
    codeExample: `# app/controllers/orders_controller.rb (300 lines!)
def create
  # Validation (50 lines)
  return render_error unless params[:items].present?

  # Payment processing (100 lines)
  charge = Stripe::Charge.create(...)

  # Inventory management (80 lines)
  params[:items].each { |item| update_inventory(item) }

  # Email notifications (40 lines)
  OrderMailer.confirmation(order).deliver_later

  # Save order (30 lines)
  @order = Order.create!(...)
end`,
    goal: 'Move logic blocks from Controller to Model. Reduce controller complexity.',
    thresholds: {},
  },
  successConditions: [
    { type: 'complexity_under', nodeType: 'controller', maxComplexity: 50 },
    { type: 'logic_block_moved', blockId: 'validate', blockLocation: 'model' },
    { type: 'logic_block_moved', blockId: 'save', blockLocation: 'model' },
  ],
  availableNodes: [],
  unlockedNodes: ['service'],
  logicBlocks: [
    { id: 'validate', name: 'Validate', code: 'validates :items, presence: true', category: 'validation', canMoveTo: ['model', 'service'] },
    { id: 'charge', name: 'Charge', code: 'Stripe::Charge.create(...)', category: 'business', canMoveTo: ['service'] },
    { id: 'email', name: 'Email', code: 'OrderMailer.confirmation.deliver_later', category: 'side_effect', canMoveTo: ['service', 'worker'] },
    { id: 'save', name: 'Save', code: 'Order.create!(...)', category: 'persistence', canMoveTo: ['model'] },
  ],
  learningContent: {
    title: 'Fat Controllers: Moving Logic to Models',
    conceptExplanation: `Controllers should be thin! They should only:
- Parse params
- Call model/service methods
- Render response

Business logic belongs in:
- **Models**: Validations, callbacks, domain logic
- **Services**: Cross-cutting concerns, complex operations

The "Fat Model, Skinny Controller" pattern keeps code maintainable.`,
    railsCodeExample: `# Before: Fat Controller
def create
  return error unless params[:title].present?
  @post = Post.new(params)
  @post.save
  PostMailer.notify(@post).deliver
end

# After: Skinny Controller
def create
  @post = Post.create!(post_params)
end

# Logic moved to Model
class Post < ApplicationRecord
  validates :title, presence: true
  after_create :send_notification
end`,
    commonMistakes: [
      'Keeping validation in controllers',
      'Calling external services directly from controllers',
      'Not extracting complex operations to services',
    ],
    whenToUse: 'When controller methods exceed 10-15 lines of actual logic.',
    furtherReading: [
      { title: 'Skinny Controllers, Fat Models', url: 'https://www.sitepoint.com/10-ruby-on-rails-best-practices/' },
    ],
  },
  hint: {
    delay: 30,
    text: 'Click the Controller node to see its Logic Blocks. Drag Validate and Save to the Model.',
  },
};

// ============================================
// Level 7: Service Objects
// ============================================

const level7ServiceObjects: Level = {
  id: 'act2-level7-service-objects',
  actId: 2,
  levelNumber: 7,
  name: 'Service Objects',
  trigger: {
    type: 'refactor_request',
    description: 'The Order Model is now too fat. It shouldn\'t know about Emailing or Payment.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 340, y: 250, locked: true },
      { id: 'model-node', type: 'model', x: 560, y: 250, locked: false, config: { label: 'Order' } },
      { id: 'database-node', type: 'database', x: 740, y: 250, locked: true },
      { id: 'view-node', type: 'view', x: 880, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 1020, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
      { id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c5', sourceNodeId: 'database-node', targetNodeId: 'view-node' },
      { id: 'c6', sourceNodeId: 'view-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Order Model is pulsing Red. It has too many responsibilities.',
    rootCause: 'Model is handling payment processing and email sending.',
    codeExample: `# app/models/order.rb (Too many responsibilities!)
class Order < ApplicationRecord
  after_create :charge_card
  after_create :send_email
  after_create :update_inventory

  def charge_card
    Stripe::Charge.create(amount: total)  # Doesn't belong here!
  end

  def send_email
    OrderMailer.confirm(self).deliver      # Doesn't belong here!
  end
end`,
    goal: 'Add a Service Object node. Move Charge and Email logic to the Service.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'service' },
    { type: 'connection', sourceType: 'controller', targetType: 'service' },
    { type: 'connection', sourceType: 'service', targetType: 'model' },
    { type: 'logic_block_moved', blockId: 'charge', blockLocation: 'service' },
    { type: 'logic_block_moved', blockId: 'email', blockLocation: 'service' },
  ],
  availableNodes: ['service'],
  unlockedNodes: ['command'],
  logicBlocks: [
    { id: 'validate', name: 'Validate', code: 'validates :total, presence: true', category: 'validation', canMoveTo: ['model'] },
    { id: 'charge', name: 'Charge', code: 'Stripe::Charge.create(...)', category: 'business', canMoveTo: ['service', 'command'] },
    { id: 'email', name: 'Email', code: 'OrderMailer.confirm.deliver', category: 'side_effect', canMoveTo: ['service', 'worker'] },
    { id: 'inventory', name: 'Inventory', code: 'item.decrement!(:stock)', category: 'business', canMoveTo: ['service', 'command'] },
  ],
  learningContent: {
    title: 'Service Objects: Single Responsibility Principle',
    conceptExplanation: `Models should only handle:
- Validations
- Associations
- Simple queries

Complex operations go in Service Objects (POROs):
- Payment processing
- Email orchestration
- Multi-step workflows

This is the Single Responsibility Principle (SRP).`,
    railsCodeExample: `# app/services/order_processor.rb
class OrderProcessor
  def initialize(order)
    @order = order
  end

  def call
    charge_card
    send_email
    update_inventory
    @order
  end

  private

  def charge_card
    Stripe::Charge.create(amount: @order.total)
  end

  def send_email
    OrderMailer.confirm(@order).deliver_later
  end
end

# Controller calls service
OrderProcessor.new(@order).call`,
    commonMistakes: [
      'Putting API calls in models',
      'Having models send emails directly',
      'Not extracting multi-step operations',
    ],
    whenToUse: 'When an operation touches multiple models or external services.',
    furtherReading: [
      { title: 'Service Objects in Rails', url: 'https://www.toptal.com/ruby-on-rails/rails-service-objects-tutorial' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Drag a Service node between Controller and Model. Move Charge and Email blocks to the Service.',
  },
};

// ============================================
// Level 8: The Command Pattern
// ============================================

const level8CommandPattern: Level = {
  id: 'act2-level8-command-pattern',
  actId: 2,
  levelNumber: 8,
  name: 'The Command Pattern',
  trigger: {
    type: 'incident',
    description: 'Payment succeeded, but Email failed. Now the data is inconsistent.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 60, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 160, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 280, y: 250, locked: true },
      { id: 'service-node', type: 'service', x: 440, y: 250, locked: false, config: { label: 'OrderProcessor' } },
      { id: 'model-node', type: 'model', x: 620, y: 250, locked: true, config: { label: 'Order' } },
      { id: 'database-node', type: 'database', x: 780, y: 250, locked: true },
      { id: 'view-node', type: 'view', x: 920, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 1060, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'service-node' },
      { id: 'c4', sourceNodeId: 'service-node', targetNodeId: 'model-node' },
      { id: 'c5', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c6', sourceNodeId: 'database-node', targetNodeId: 'view-node' },
      { id: 'c7', sourceNodeId: 'view-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Service does too much. When Email fails, Payment already succeeded. Inconsistent state.',
    rootCause: 'Operations are not atomic. No transaction wrapping.',
    codeExample: `# Current: Non-atomic service
class OrderProcessor
  def call
    charge_card    # ✓ Succeeds
    send_email     # ✗ Fails! But charge already happened
    save_order     # Never runs
  end
end

# Customer is charged but has no order!`,
    goal: 'Break Service into atomic Commands. Wrap critical operations in a Transaction.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_count', nodeType: 'command', count: 3 },
    { type: 'node_present', nodeType: 'transaction' },
    { type: 'connection', sourceType: 'transaction', targetType: 'command' },
  ],
  availableNodes: ['command', 'transaction'],
  unlockedNodes: ['contract'],
  learningContent: {
    title: 'The Command Pattern & Transactions',
    conceptExplanation: `Break complex operations into atomic Commands:
- Each Command does ONE thing
- Commands can be rolled back
- Transactions ensure all-or-nothing

Pattern: Service → Transaction → Commands

If any Command fails, the Transaction rolls back ALL changes.`,
    railsCodeExample: `# app/commands/charge_card.rb
class ChargeCard
  def call(order)
    Stripe::Charge.create(amount: order.total)
  end

  def rollback(order)
    # Refund the charge
  end
end

# app/services/order_processor.rb
def call
  ActiveRecord::Base.transaction do
    ChargeCard.new.call(@order)
    DecrementInventory.new.call(@order)
    # If anything fails, everything rolls back
    raise ActiveRecord::Rollback if error?
  end
  # Email goes OUTSIDE transaction (can't rollback emails)
  SendConfirmation.new.call(@order)
end`,
    commonMistakes: [
      'Putting non-reversible operations inside transactions',
      'Not handling partial failures',
      'Making services do too many things',
    ],
    whenToUse: 'When multiple operations must succeed or fail together.',
    furtherReading: [
      { title: 'Rails Transactions', url: 'https://guides.rubyonrails.org/active_record_querying.html#transactions' },
    ],
  },
  hint: {
    delay: 30,
    text: 'Add Command nodes for ChargeCard, DecrementInventory, SendEmail. Wrap the first two in a Transaction.',
  },
};

// ============================================
// Levels 9-12 (Abbreviated for length)
// ============================================

const level9DataContracts: Level = {
  id: 'act2-level9-data-contracts',
  actId: 2,
  levelNumber: 9,
  name: 'Data Contracts',
  trigger: {
    type: 'incident',
    description: 'Mobile app is sending garbage data. It\'s crashing the backend with 500s.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 360, y: 250, locked: true },
      { id: 'service-node', type: 'service', x: 520, y: 250, locked: true },
      { id: 'model-node', type: 'model', x: 680, y: 250, locked: true },
      { id: 'database-node', type: 'database', x: 840, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 980, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'service-node' },
      { id: 'c4', sourceNodeId: 'service-node', targetNodeId: 'model-node' },
      { id: 'c5', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c6', sourceNodeId: 'database-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Jagged "dirty" particles entering Controller. 500 errors spike.',
    rootCause: 'No input validation at the boundary.',
    codeExample: `# Current: Garbage data reaches model
# Mobile sends: { "email": null, "age": "banana" }
# Model crashes: ActiveRecord::StatementInvalid

# We need to validate at the BOUNDARY`,
    goal: 'Add a Contract node before the Service to validate and sanitize input.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'contract' },
    { type: 'connection', sourceType: 'controller', targetType: 'contract' },
    { type: 'connection', sourceType: 'contract', targetType: 'service' },
  ],
  availableNodes: ['contract'],
  unlockedNodes: ['form'],
  learningContent: {
    title: 'dry-validation: Data Contracts at the Boundary',
    conceptExplanation: `Validate input at system boundaries:
- API requests
- Form submissions
- Webhook payloads

Use dry-validation schemas to:
- Define expected structure
- Coerce types
- Reject invalid data early`,
    railsCodeExample: `# app/contracts/order_contract.rb
class OrderContract < Dry::Validation::Contract
  params do
    required(:email).filled(:string)
    required(:items).array(:hash) do
      required(:id).filled(:integer)
      required(:quantity).filled(:integer, gt?: 0)
    end
  end
end

# Usage
result = OrderContract.new.call(params)
if result.success?
  OrderService.new(result.to_h).call
else
  render json: { errors: result.errors.to_h }, status: 422
end`,
    commonMistakes: [
      'Validating only in models (too late)',
      'Not handling type coercion',
      'Trusting external input',
    ],
    whenToUse: 'At every system boundary where untrusted data enters.',
    furtherReading: [
      { title: 'dry-validation', url: 'https://dry-rb.org/gems/dry-validation/' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Drag a Contract node between Controller and Service. Invalid data will bounce off (422).',
  },
};

const level10FormObjects: Level = {
  id: 'act2-level10-form-objects',
  actId: 2,
  levelNumber: 10,
  name: 'Form Objects',
  trigger: {
    type: 'new_feature',
    description: 'Signup requires creating a User AND a Company. The Controller is hacking it.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 360, y: 250, locked: false },
      { id: 'user-model', type: 'model', x: 560, y: 180, locked: true, config: { label: 'User' } },
      { id: 'company-model', type: 'model', x: 560, y: 320, locked: true, config: { label: 'Company' } },
      { id: 'database-node', type: 'database', x: 740, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 900, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'user-model' },
      { id: 'c4', sourceNodeId: 'controller-node', targetNodeId: 'company-model' },
      { id: 'c5', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
      { id: 'c6', sourceNodeId: 'company-model', targetNodeId: 'database-node' },
      { id: 'c7', sourceNodeId: 'database-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Controller is trying to save two models. Errors are inconsistent.',
    rootCause: 'No aggregation layer for multi-model forms.',
    codeExample: `# Controller doing too much
def create
  @user = User.new(user_params)
  @company = Company.new(company_params)

  if @user.save && @company.save
    # What if user saves but company fails?
  end
end`,
    goal: 'Add a Form Object to aggregate both models.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'form' },
    { type: 'connection', sourceType: 'controller', targetType: 'form' },
    { type: 'connection', sourceType: 'form', targetType: 'model' },
  ],
  availableNodes: ['form'],
  unlockedNodes: ['policy'],
  learningContent: {
    title: 'Form Objects: Multi-Model Forms',
    conceptExplanation: `Form Objects wrap multiple models:
- Aggregate validation errors
- Coordinate saves
- Present single interface to controller

Uses ActiveModel::Model for Rails integration.`,
    railsCodeExample: `# app/forms/registration_form.rb
class RegistrationForm
  include ActiveModel::Model

  attr_accessor :email, :company_name

  def save
    return false unless valid?
    ActiveRecord::Base.transaction do
      user = User.create!(email: email)
      Company.create!(name: company_name, owner: user)
    end
    true
  rescue => e
    errors.add(:base, e.message)
    false
  end
end`,
    commonMistakes: [
      'Saving models independently (no transaction)',
      'Mixing error messages from different models',
      'Not using ActiveModel::Model',
    ],
    whenToUse: 'When a form creates/updates multiple models.',
    furtherReading: [
      { title: 'Form Objects', url: 'https://thoughtbot.com/blog/activemodel-form-objects' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Add a Form node between Controller and the Models.',
  },
};

const level11Authorization: Level = {
  id: 'act2-level11-authorization',
  actId: 2,
  levelNumber: 11,
  name: 'Authorization (Pundit)',
  trigger: {
    type: 'attack',
    description: 'A Hacker found they can delete other users\' posts if they guess the ID.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 360, y: 250, locked: false },
      { id: 'model-node', type: 'model', x: 560, y: 250, locked: true, config: { label: 'Post' } },
      { id: 'database-node', type: 'database', x: 740, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 900, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
      { id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c5', sourceNodeId: 'database-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Red "hacker" particles successfully deleting other users\' data!',
    rootCause: 'No authorization check on delete action.',
    codeExample: `# VULNERABLE CODE
def destroy
  @post = Post.find(params[:id])
  @post.destroy  # Anyone can delete any post!
end

# Hacker request: DELETE /posts/999 (not their post)
# Result: Post deleted!`,
    goal: 'Add a Policy node to authorize actions based on ownership.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'policy' },
    { type: 'connection', sourceType: 'controller', targetType: 'policy' },
  ],
  availableNodes: ['policy'],
  unlockedNodes: ['component'],
  learningContent: {
    title: 'Pundit: Resource-Based Authorization',
    conceptExplanation: `Pundit provides policy-based authorization:
- One Policy class per resource
- Methods match controller actions
- Returns true/false for authorization

Always authorize at the controller level.`,
    railsCodeExample: `# app/policies/post_policy.rb
class PostPolicy < ApplicationPolicy
  def destroy?
    user.admin? || record.user_id == user.id
  end
end

# app/controllers/posts_controller.rb
def destroy
  @post = Post.find(params[:id])
  authorize @post  # Checks PostPolicy#destroy?
  @post.destroy
end`,
    commonMistakes: [
      'Only checking in views (must check in controller)',
      'Using current_user.posts.find (hides authorization)',
      'Not scoping index queries',
    ],
    whenToUse: 'Every action that modifies user data.',
    furtherReading: [
      { title: 'Pundit', url: 'https://github.com/varvet/pundit' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Add a Policy node after Controller. Hacker particles will be blocked (403).',
  },
};

const level12ViewComponents: Level = {
  id: 'act2-level12-view-components',
  actId: 2,
  levelNumber: 12,
  name: 'ViewComponents',
  trigger: {
    type: 'refactor_request',
    description: 'The "User Card" UI logic is duplicated across 15 views. Changing it is a nightmare.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 150, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 150, locked: true },
      { id: 'controller-node', type: 'controller', x: 360, y: 150, locked: true },
      { id: 'model-node', type: 'model', x: 520, y: 150, locked: true },
      { id: 'database-node', type: 'database', x: 680, y: 150, locked: true },
      { id: 'view1', type: 'view', x: 840, y: 80, locked: true, config: { label: 'Index' } },
      { id: 'view2', type: 'view', x: 840, y: 150, locked: true, config: { label: 'Show' } },
      { id: 'view3', type: 'view', x: 840, y: 220, locked: true, config: { label: 'Profile' } },
      { id: 'response-node', type: 'response', x: 1000, y: 150, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
      { id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c5', sourceNodeId: 'database-node', targetNodeId: 'view1' },
      { id: 'c6', sourceNodeId: 'database-node', targetNodeId: 'view2' },
      { id: 'c7', sourceNodeId: 'database-node', targetNodeId: 'view3' },
      { id: 'c8', sourceNodeId: 'view1', targetNodeId: 'response-node' },
      { id: 'c9', sourceNodeId: 'view2', targetNodeId: 'response-node' },
      { id: 'c10', sourceNodeId: 'view3', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'All 3 View nodes have identical red blocks (duplicated code).',
    rootCause: 'No component extraction for shared UI elements.',
    codeExample: `# Duplicated in 15 views!
<div class="user-card">
  <img src="<%= user.avatar_url %>">
  <h3><%= user.name %></h3>
  <p><%= user.bio.truncate(100) %></p>
  <% if user.verified? %>
    <span class="badge">✓ Verified</span>
  <% end %>
</div>`,
    goal: 'Create a Component node and have all Views reference it.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'component' },
    { type: 'connection', sourceType: 'view', targetType: 'component' },
  ],
  availableNodes: ['component'],
  unlockedNodes: ['external_api'],
  learningContent: {
    title: 'ViewComponent: Encapsulated UI Components',
    conceptExplanation: `ViewComponent provides:
- Encapsulated Ruby + HTML
- Testable in isolation
- Type-safe props
- No more partials scattered everywhere

One component, used in many views.`,
    railsCodeExample: `# app/components/user_card_component.rb
class UserCardComponent < ViewComponent::Base
  def initialize(user:)
    @user = user
  end
end

# app/components/user_card_component.html.erb
<div class="user-card">
  <img src="<%= @user.avatar_url %>">
  <h3><%= @user.name %></h3>
</div>

# Usage in any view
<%= render UserCardComponent.new(user: @user) %>`,
    commonMistakes: [
      'Using partials for complex components',
      'Not testing components in isolation',
      'Putting logic in ERB instead of component class',
    ],
    whenToUse: 'For any UI element used in multiple places.',
    furtherReading: [
      { title: 'ViewComponent', url: 'https://viewcomponent.org/' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Add a Component node. Connect all Views to render the shared Component.',
  },
};

// ============================================
// Act II Definition
// ============================================

export const actTwo: Act = {
  id: 2,
  name: 'The Domain Layer',
  tagline: 'Clean Code.',
  description: 'Refactoring, Design Patterns, and Robustness. Transform messy code into maintainable architecture.',
  levels: [
    level6FatController,
    level7ServiceObjects,
    level8CommandPattern,
    level9DataContracts,
    level10FormObjects,
    level11Authorization,
    level12ViewComponents,
  ],
  unlockedNodes: ['service', 'command', 'contract', 'form', 'policy', 'component'],
  metricsVisible: false, // Still no performance metrics yet
};
