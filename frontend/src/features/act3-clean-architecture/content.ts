/**
 * Act 3: Clean Architecture
 * "Codebase doubles. Fat controllers, duplicated logic. Time to refactor."
 *
 * Levels 15-21: Service Objects, Concerns & Modules, Validation Contracts, Query Objects,
 * Error Handling, Action Mailer, Background Jobs
 * App context: Social platform API with code quality problems
 */

import type { Act, Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

// ============================================
// Level 15: Service Objects
// ============================================

const level16ServiceObjects: Level = {
	id: 'act3-level17-service-objects',
	actId: 3,
	levelNumber: 17,
	name: 'Service Objects',
	requiresTests: true,
	trigger: {
		type: 'refactor_request',
		description:
			'The RegistrationsController#create action is 80 lines long. It creates a user, sends a welcome email, and creates a Stripe customer. Too much logic in one controller action.',
	},
	startingPipeline: standardPipeline(),
	problem: {
		observation:
			'The create action handles user creation, email delivery, and Stripe customer creation all inline. It is 80 lines, untestable, and breaks when any step fails.',
		rootCause:
			'Business logic is embedded in the controller instead of being extracted into a dedicated service object.',
		codeExample: `# app/controllers/api/v1/registrations_controller.rb
class Api::V1::RegistrationsController < ApplicationController
  def create
    @user = User.new(user_params)

    if @user.save
      # Send welcome email inline
      UserMailer.welcome(@user).deliver_now  # Blocks for 2s!

      # Create Stripe customer inline
      customer = Stripe::Customer.create(email: @user.email)
      @user.update!(stripe_customer_id: customer.id)

      # Subscribe to newsletter
      NewsletterService.subscribe(@user.email)

      render json: @user, status: :created
    else
      render json: { errors: @user.errors }, status: :unprocessable_entity
    end
  rescue Stripe::StripeError => e
    @user&.destroy  # Orphaned records!
    render json: { error: e.message }, status: :payment_required
  end
end

# Problems:
# 1. Controller does too many things (SRP violation)
# 2. Email blocks the response
# 3. Stripe failure leaves orphaned records
# 4. Impossible to test steps independently`,
		goal: 'Extract the registration workflow into a PORO service object with a Result pattern.',
		thresholds: {},
	},
	successConditions: [{ type: 'service_created' }],
	availableNodes: ['service'],
	unlockedNodes: ['service'],
	learningContent: {
		title: 'Service Objects & the Result Pattern',
		goal: `In this level, you'll:\n- learn how to extract bloated controller logic into service objects (plain Ruby classes with a single responsibility).\n- use the Result pattern to handle success and failure explicitly.\n- keep your controllers thin and your business logic testable in isolation.`,
		conceptExplanation: `Service objects (Plain Old Ruby Objects) encapsulate multi-step business logic outside of controllers and models.

**Why use service objects?**
- Controllers stay thin (just HTTP concerns)
- Business logic is testable in isolation
- Steps can be composed and reused
- Error handling becomes explicit with the Result pattern

**The Result pattern:**
Instead of raising exceptions or returning booleans, return a Result object with \`.success?\`, \`.failure?\`, \`.value\`, and \`.error\`. This makes the caller's logic clean and explicit.

**When to extract:**
- Controller action exceeds ~15 lines of business logic
- Multiple models are created/updated in one action
- External API calls are involved
- The same workflow is needed from multiple entry points

**Ruby's Data.define (Ruby 3.2+):**
Data classes are immutable value objects -- perfect for Results. They give you \`.new\`, \`==\`, pattern matching, and immutability for free.`,
		railsCodeExample: `# app/services/application_service.rb
class ApplicationService
  def self.call(...)
    new(...).call
  end
end

# app/services/user_registration.rb
class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(params)
    @params = params
  end

  def call
    user = User.new(@params)

    unless user.save
      return Result.new(success?: false, user: nil, errors: user.errors.full_messages)
    end

    # Enqueue side effects (don't block the response)
    UserMailer.welcome(user).deliver_later
    CreateStripeCustomerJob.perform_later(user.id)

    Result.new(success?: true, user: user, errors: [])
  end
end

# app/controllers/api/v1/registrations_controller.rb
class Api::V1::RegistrationsController < ApplicationController
  def create
    result = UserRegistration.call(registration_params)

    if result.success?
      render json: UserSerializer.new(result.user).serializable_hash.to_json, status: :created
    else
      render json: { errors: result.errors }, status: :unprocessable_entity
    end
  end

  private

  def registration_params
    params.expect(user: [:email, :password, :name])
  end
end

# Test the service in isolation:
# test/services/user_registration_test.rb
class UserRegistrationTest < ActiveSupport::TestCase
  test "successful registration creates user and enqueues jobs" do
    result = UserRegistration.call(
      email: "new@example.com",
      password: "secure123",
      name: "Alice"
    )

    assert result.success?
    assert_equal "new@example.com", result.user.email
    assert_enqueued_jobs 2  # mailer + stripe job
  end

  test "duplicate email returns failure result" do
    User.create!(email: "taken@example.com", password: "x", name: "X")
    result = UserRegistration.call(
      email: "taken@example.com",
      password: "secure123",
      name: "Alice"
    )

    refute result.success?
    assert_includes result.errors, "Email has already been taken"
    assert_enqueued_jobs 0  # no side effects on failure
  end
end`,
		commonMistakes: [
			'Multiple public methods (keep it to one: .call)',
			'Passing ActiveRecord objects instead of primitives (harder to test, serialize, and parallelize)',
			'Not using a Result object (returning true/false loses context about what went wrong)',
			'Putting service logic back in callbacks (hides control flow)',
			'Making services that are just thin wrappers around a single model save (over-extraction)',
		],
		whenToUse:
			'Multi-step workflows, external API integrations, any controller action over 15 lines of business logic, or logic reused from multiple entry points (controller, job, rake task).',
		furtherReading: [
			{
				title: 'Service Objects in Rails',
				url: 'https://www.toptal.com/ruby-on-rails/rails-service-objects-tutorial',
			},
			{
				title: 'Result Pattern in Ruby (dry-monads)',
				url: 'https://dry-rb.org/gems/dry-monads/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Service node and connect the Controller to it. The service handles the multi-step registration workflow so the controller stays thin.',
	},
};

// ============================================
// Level 17: Concerns & Modules
// ============================================

const level17Concerns: Level = {
	id: 'act3-level18-concerns',
	actId: 3,
	levelNumber: 18,
	name: 'Concerns & Modules',
	requiresTests: true,
	trigger: {
		type: 'code_review',
		description:
			'Tagging logic is copy-pasted across Post, Comment, and Photo models. Three copies of the same 40 lines. DRY it up with a Taggable concern.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'post-model',
				type: 'model',
				x: 200,
				y: 150,
				locked: true,
				config: { label: 'Post' },
			},
			{
				id: 'comment-model',
				type: 'model',
				x: 200,
				y: 300,
				locked: true,
				config: { label: 'Comment' },
			},
			{
				id: 'photo-model',
				type: 'model',
				x: 200,
				y: 450,
				locked: true,
				config: { label: 'Photo' },
			},
			{ id: 'database-node', type: 'database', x: 500, y: 300, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{
				id: 'c2',
				sourceNodeId: 'comment-model',
				targetNodeId: 'database-node',
			},
			{ id: 'c3', sourceNodeId: 'photo-model', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'Three models have identical tagging code: has_many :taggings, has_many :tags, scope :tagged_with, and #tag_list. 120 lines of duplication across Post, Comment, and Photo.',
		rootCause:
			'Shared behavior is duplicated across models instead of being extracted into an ActiveSupport::Concern.',
		codeExample: `# app/models/post.rb
class Post < ApplicationRecord
  has_many :taggings, as: :taggable, dependent: :destroy
  has_many :tags, through: :taggings

  scope :tagged_with, ->(tag_name) {
    joins(:tags).where(tags: { name: tag_name })
  }

  def tag_list
    tags.pluck(:name).join(", ")
  end

  def tag_list=(names)
    self.tags = names.split(",").map(&:strip).uniq.map { |n|
      Tag.find_or_create_by(name: n)
    }
  end
end

# app/models/comment.rb -- EXACT SAME CODE
class Comment < ApplicationRecord
  has_many :taggings, as: :taggable, dependent: :destroy
  has_many :tags, through: :taggings
  # ... identical 40 lines ...
end

# app/models/photo.rb -- EXACT SAME CODE AGAIN
class Photo < ApplicationRecord
  has_many :taggings, as: :taggable, dependent: :destroy
  # ... identical 40 lines ...
end`,
		goal: 'Extract the shared tagging behavior into a Taggable concern and include it in all three models.',
		thresholds: {},
	},
	successConditions: [{ type: 'concerns_configured' }],
	availableNodes: ['concern'],
	unlockedNodes: ['concern'],
	learningContent: {
		title: 'ActiveSupport::Concern & Shared Behavior',
		goal: `In this level, you'll:\n- learn how to eliminate code duplication across models using ActiveSupport::Concern.\n- extract shared behavior like tagging into a reusable module.\n- understand the included and class_methods blocks.\n- include the same concern in multiple models so changes only need to happen in one place.`,
		conceptExplanation: `Concerns extract shared behavior into reusable modules that can be included in multiple models or controllers.

**ActiveSupport::Concern provides:**
- \`included\` block for associations, scopes, and validations
- \`class_methods\` block for class-level methods
- Automatic dependency resolution between concerns
- Clean syntax that avoids the Ruby \`def self.included\` boilerplate

**When to use:**
- Same code in 2+ models (DRY principle)
- Behavior that is conceptually separate from the model's core responsibility
- Polymorphic patterns (tagging, commenting, auditing, soft-deletes)

**When NOT to use:**
- Kitchen-sink concerns that bundle unrelated behaviors
- Concerns that are only used by one model (just put it in the model)
- As a way to hide a god model's complexity (splitting a 500-line model into 5 concerns does not reduce complexity)`,
		railsCodeExample: `# app/models/concerns/taggable.rb
module Taggable
  extend ActiveSupport::Concern

  included do
    has_many :taggings, as: :taggable, dependent: :destroy
    has_many :tags, through: :taggings

    scope :tagged_with, ->(tag_name) {
      joins(:tags).where(tags: { name: tag_name })
    }
  end

  def tag_list
    tags.pluck(:name).join(", ")
  end

  def tag_list=(names)
    self.tags = names.split(",").map(&:strip).uniq.map { |n|
      Tag.find_or_create_by(name: n)
    }
  end

  class_methods do
    def most_tagged(limit = 10)
      joins(:taggings)
        .group(:id)
        .order("COUNT(taggings.id) DESC")
        .limit(limit)
    end
  end
end

# app/models/post.rb -- clean!
class Post < ApplicationRecord
  include Taggable

  belongs_to :author, class_name: "User"
  has_many :comments, dependent: :destroy
end

# app/models/comment.rb -- clean!
class Comment < ApplicationRecord
  include Taggable

  belongs_to :post
  belongs_to :user
end

# app/models/photo.rb -- clean!
class Photo < ApplicationRecord
  include Taggable

  has_one_attached :image
  belongs_to :user
end

# Test the concern independently:
# test/models/concerns/taggable_test.rb
class TaggableTest < ActiveSupport::TestCase
  test "tag_list returns comma-separated tags" do
    post = Post.create!(title: "Test", body: "Body", author: users(:alice))
    post.tag_list = "ruby, rails, api"

    assert_equal 3, post.tags.count
    assert_includes post.tag_list, "ruby"
  end

  test "tagged_with scope returns matching records" do
    post = posts(:tagged_post)
    post.tag_list = "ruby, rails"

    results = Post.tagged_with("ruby")
    assert_includes results, post
  end

  test "most_tagged returns records ordered by tag count" do
    popular = Post.create!(title: "Popular", body: "Body", author: users(:alice))
    popular.tag_list = "ruby, rails, api, testing"

    top = Post.most_tagged(1).first
    assert_equal popular, top
  end
end`,
		commonMistakes: [
			'Creating "god concerns" that bundle unrelated behaviors (Searchable + Publishable + Notifiable all in one)',
			'Using concerns to hide complexity instead of reducing it',
			'Not testing concerns independently from the host model',
			"Concerns with dependencies on the host model's specific attributes (breaks when included elsewhere)",
			'Forgetting the `extend ActiveSupport::Concern` line (included block silently breaks)',
		],
		whenToUse:
			'When 2+ models share identical behavior, especially polymorphic patterns like tagging, auditing, commenting, or soft-deletes.',
		furtherReading: [
			{
				title: 'ActiveSupport::Concern',
				url: 'https://api.rubyonrails.org/classes/ActiveSupport/Concern.html',
			},
			{
				title: 'Rails Guides: Active Record Basics',
				url: 'https://guides.rubyonrails.org/active_record_basics.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Concern node and connect it to all three models. The concern holds the shared tagging logic so each model is just one line: include Taggable.',
	},
};

// ============================================
// Level 18: Validation Contracts
// ============================================

const level18ValidationContracts: Level = {
	id: 'act3-level19-validation-contracts',
	actId: 3,
	levelNumber: 19,
	name: 'Validation Contracts',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'The registration endpoint creates a User, Profile, and NotificationPrefs in one request. Validations are scattered inline with duplicated render calls, and cross-field rules like "creator accounts must enable weekly digest" have nowhere to live.',
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
				config: { label: 'RegistrationController' },
			},
			{
				id: 'user-model',
				type: 'model',
				x: 680,
				y: 120,
				locked: true,
				config: { label: 'User' },
			},
			{
				id: 'profile-model',
				type: 'model',
				x: 680,
				y: 250,
				locked: true,
				config: { label: 'Profile' },
			},
			{
				id: 'notif-pref-model',
				type: 'model',
				x: 680,
				y: 380,
				locked: true,
				config: { label: 'NotificationPref' },
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
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'user-model' },
			{
				id: 'c4',
				sourceNodeId: 'controller-node',
				targetNodeId: 'profile-model',
			},
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'notif-pref-model',
			},
			{ id: 'c6', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{
				id: 'c7',
				sourceNodeId: 'profile-model',
				targetNodeId: 'database-node',
			},
			{
				id: 'c8',
				sourceNodeId: 'notif-pref-model',
				targetNodeId: 'database-node',
			},
		],
	},
	problem: {
		observation:
			'The registration controller validates and creates User, Profile, and NotificationPrefs inline. Cross-field rules like "creator role requires weekly digest" live in the controller. Every model validates independently with duplicated render calls.',
		rootCause:
			'No validation contract to encapsulate multi-model validation. Scattered inline checks instead of composable schemas with cross-field rules.',
		codeExample: `# app/controllers/registration_controller.rb
class RegistrationController < ApplicationController
  def create
    # User validations -- inline!
    if params[:email].blank?
      return render json: { error: "..." }, status: 422
    end
    if params[:password].length < 8
      return render json: { error: "..." }, status: 422
    end

    # Profile validations -- inline!
    if params[:display_name].blank?
      return render json: { error: "..." }, status: 422
    end
    if params[:bio].length > 500
      return render json: { error: "..." }, status: 422
    end

    # Notification prefs validations -- inline!
    unless %w[daily weekly monthly never].include?(params[:digest])
      return render json: { error: "..." }, status: 422
    end

    # Cross-field business rule -- also inline!
    if params[:role] == "creator" && params[:digest] != "weekly"
      return render json: { error: "..." }, status: 422
    end

    user = User.create!(...)
    Profile.create!(user: user, ...)
    NotificationPref.create!(user: user, ...)

    render json: user, status: :created
  end
end`,
		goal: 'Extract scattered validations into composable Dry::Schema definitions, then compose them in a Dry::Validation::Contract with cross-field rules.',
		thresholds: {},
	},
	successConditions: [{ type: 'form_object_created' }],
	availableNodes: ['form_object'],
	unlockedNodes: ['form_object'],
	learningContent: {
		title: 'Validation Contracts with Dry::Validation',
		goal: `In this level, you'll:\n- learn how to validate complex, multi-model input using dry-validation contracts.\n- separate schema validation (shape and types) from business rules.\n- compose reusable schemas together.\n- keep cross-field logic in one clean place instead of scattered across controllers.`,
		conceptExplanation: `Validation contracts act as a single entry point for multi-model operations. Using \`dry-validation\` and \`dry-schema\`, you get a clean separation between **schema** (shape & types) and **rules** (business logic).

**Why dry-validation over ActiveModel::Model?**
- **Two-layer validation:** Schema checks structure/types first, rules check business logic second
- **Composable:** Contracts can reuse shared schemas and rule sets
- **Immutable:** No mutation, no state, easier to reason about
- **Better errors:** Structured error objects with paths, not just flat strings
- **No Rails coupling:** Works in service objects, CLI tools, anywhere

**Structure:**
1. Define reusable \`Dry::Schema.Params\` in \`app/schemas/\` (one per model or concern)
2. Create a \`Dry::Validation::Contract\` in \`app/contracts/\` that composes schemas with \`&\`
3. \`rule\` blocks define cross-field business logic (runs after all schemas pass)
4. A separate service wraps persistence in a transaction

**Key concepts:**
- \`Dry::Schema.Params { required(:email).filled(:string) }\`: reusable schema (shape + types)
- \`params(UserSchema & ProfileSchema)\`: compose schemas in a contract
- \`rule(:role, :email_digest) { ... }\`: business rules that span multiple fields
- \`key.failure("message")\`: attach errors to specific fields
- \`contract.call(params)\` returns a \`Result\` (success or failure with errors)`,
		railsCodeExample: `# Gemfile
gem "dry-validation"
gem "dry-schema"

# app/schemas/user_schema.rb
UserSchema = Dry::Schema.Params do
  required(:email).filled(:string, format?: URI::MailTo::EMAIL_REGEXP)
  required(:password).filled(:string, min_size?: 8)
  required(:username).filled(:string, min_size?: 3)
  optional(:role).filled(:string)
end

# app/schemas/profile_schema.rb
ProfileSchema = Dry::Schema.Params do
  required(:display_name).filled(:string)
  optional(:bio).filled(:string, max_size?: 500)
  optional(:location).filled(:string)
end

# app/schemas/notif_prefs_schema.rb
NotifPrefsSchema = Dry::Schema.Params do
  required(:email_digest).filled(:string,
    included_in?: %w[daily weekly monthly never])
  optional(:push_enabled).filled(:bool)
  optional(:mentions_only).filled(:bool)
end

# app/contracts/registration_contract.rb
class RegistrationContract < Dry::Validation::Contract
  # Compose reusable schemas - each can be shared across contracts
  params(UserSchema & ProfileSchema & NotifPrefsSchema)

  # Rules: cross-field business logic (runs after all schemas pass)
  rule(:role, :email_digest) do
    if values[:role] == "creator" && values[:email_digest] != "weekly"
      key(:role).failure("creators need weekly digest")
    end
  end
end

# app/services/registration_service.rb
class RegistrationService
  def initialize(contract: RegistrationContract.new)
    @contract = contract
  end

  def call(params)
    result = @contract.call(params)
    return result if result.failure?

    attrs = result.to_h

    ActiveRecord::Base.transaction do
      user = User.create!(
        email: attrs[:email],
        password: attrs[:password],
        username: attrs[:username],
        role: attrs[:role]
      )
      Profile.create!(
        user: user,
        display_name: attrs[:display_name],
        bio: attrs[:bio],
        location: attrs[:location]
      )
      NotificationPref.create!(
        user: user,
        email_digest: attrs[:email_digest],
        push_enabled: attrs[:push_enabled],
        mentions_only: attrs[:mentions_only]
      )

      { user: user }
    end
  end
end

# app/controllers/registration_controller.rb
class RegistrationController < ApplicationController
  def create
    result = RegistrationService.new.call(registration_params)

    if result.is_a?(Dry::Validation::Result)
      render json: { errors: result.errors.to_h }, status: :unprocessable_entity
    else
      render json: UserSerializer.new(result[:user]).serializable_hash.to_json, status: :created
    end
  end

  private

  def registration_params
    params.expect(registration: [
      :email, :password, :username, :role,
      :display_name, :bio, :location,
      :email_digest, :push_enabled, :mentions_only
    ])
  end
end

# test/contracts/registration_contract_test.rb
class RegistrationContractTest < ActiveSupport::TestCase
  setup { @contract = RegistrationContract.new }

  test "valid params pass" do
    result = @contract.call(
      email: "alice@example.com", password: "secure1234",
      username: "alice", role: "member",
      display_name: "Alice", email_digest: "weekly"
    )

    assert result.success?
  end

  test "creator without weekly digest fails" do
    result = @contract.call(
      email: "bob@example.com", password: "secure1234",
      username: "bob", role: "creator",
      display_name: "Bob", email_digest: "monthly"
    )

    assert result.failure?
    assert result.errors[:role].any?
  end

  test "missing email fails schema check" do
    result = @contract.call(
      password: "secure1234", username: "alice",
      role: "member", display_name: "Alice",
      email_digest: "weekly"
    )

    assert result.failure?
    assert result.errors[:email].any?
  end
end`,
		commonMistakes: [
			'Forgetting to wrap persistence in a transaction (partial failures leave orphaned records)',
			'Inlining all validations in the contract params block instead of extracting reusable schemas to app/schemas/',
			'Mixing schema checks and business rules in the same layer (dry-validation separates them)',
			'Not checking result.failure? before using the validated data',
			'Putting cross-model validations in a model callback instead of a contract rule',
		],
		whenToUse:
			'Any endpoint that creates or updates multiple models, or where cross-field validations are needed that do not belong on any single model.',
		furtherReading: [
			{
				title: 'dry-validation',
				url: 'https://dry-rb.org/gems/dry-validation/',
			},
			{
				title: 'dry-schema',
				url: 'https://dry-rb.org/gems/dry-schema/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Validation Contract node between the Controller and the models. The contract validates all inputs, then a service persists them in a single transaction.',
	},
};

// ============================================
// Level 19: Query Objects
// ============================================

const level19QueryObjects: Level = {
	id: 'act3-level20-query-objects',
	actId: 3,
	levelNumber: 20,
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
				config: { label: 'Admin::PostsController' },
			},
			{
				id: 'post-model',
				type: 'model',
				x: 680,
				y: 250,
				locked: true,
				config: { label: 'Post' },
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
				targetNodeId: 'post-model',
			},
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'The admin dashboard controller has a 60-line index action with inline .where().joins().group().order() chains. The same filtering logic is copy-pasted in the API controller and CSV export job with slight inconsistencies.',
		rootCause:
			'Complex query logic is embedded in the controller instead of being extracted into a composable query object in app/queries/.',
		codeExample: `# app/controllers/api/v1/admin/posts_controller.rb
class Api::V1::Admin::PostsController < ApplicationController
  def index
    @posts = Post.all

    # 60 lines of inline query chains!
    if params[:status].present?
      @posts = @posts.where(status: params[:status])
    end

    if params[:author_id].present?
      @posts = @posts.where(author_id: params[:author_id])
    end

    if params[:since].present?
      @posts = @posts.where("published_at >= ?", params[:since])
    end

    if params[:min_comments].present?
      @posts = @posts
        .left_joins(:comments)
        .group(:id)
        .having("COUNT(comments.id) >= ?", params[:min_comments])
    end

    if params[:tag].present?
      @posts = @posts.joins(:tags).where(tags: { name: params[:tag] })
    end

    @posts = @posts.order(params[:sort] || :published_at => :desc)

    render json: @posts
  end
end

# app/controllers/api/v1/posts_controller.rb -- SAME LOGIC COPY-PASTED
# app/jobs/csv_export_job.rb -- AND AGAIN with slight differences`,
		goal: 'Extract query logic into a composable PostQuery object with chainable filter methods that returns ActiveRecord::Relation.',
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
2. Concrete query classes (e.g., \`PostQuery\`) with filter methods
3. Each method guards blank params: \`return self if param.blank?\`
4. \`#results\` returns \`ActiveRecord::Relation\` (not Array!) so pagination, further scopes, and eager loading still work

**When to extract:**
- Controller has >15 lines of query logic
- Same filters are needed in multiple controllers, jobs, or rake tasks
- Query involves JOINs, GROUP BY, HAVING, or subqueries

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

# app/queries/post_query.rb
class PostQuery < ApplicationQuery
  def by_status(status)
    return self if status.blank?

    @scope = @scope.where(status: status)
    self
  end

  def by_author(author_id)
    return self if author_id.blank?

    @scope = @scope.where(author_id: author_id)
    self
  end

  def since(date)
    return self if date.blank?

    @scope = @scope.where("published_at >= ?", date)
    self
  end

  def with_min_comments(count)
    return self if count.blank?

    @scope = @scope
      .left_joins(:comments)
      .group(:id)
      .having("COUNT(comments.id) >= ?", count)
    self
  end

  def by_tag(tag_name)
    return self if tag_name.blank?

    @scope = @scope.joins(:tags).where(tags: { name: tag_name })
    self
  end

  SORTABLE_COLUMNS = %w[published_at created_at title].freeze
  SORT_DIRECTIONS = %w[asc desc].freeze

  def sorted(column = :published_at, direction = :desc)
    safe_column = SORTABLE_COLUMNS.include?(column.to_s) ? column : :published_at
    safe_direction = SORT_DIRECTIONS.include?(direction.to_s) ? direction : :desc
    @scope = @scope.order(safe_column => safe_direction)
    self
  end

  private

  def default_scope
    Post.all
  end
end

# app/controllers/api/v1/admin/posts_controller.rb -- clean!
class Api::V1::Admin::PostsController < ApplicationController
  def index
    posts = PostQuery.new
      .by_status(params[:status])
      .by_author(params[:author_id])
      .since(params[:since])
      .with_min_comments(params[:min_comments])
      .by_tag(params[:tag])
      .sorted(params[:sort], params[:direction])
      .results

    render json: PostSerializer.new(posts).serializable_hash.to_json
  end
end

# Reuse in API controller with different base scope:
class Api::V1::PostsController < ApplicationController
  def index
    posts = PostQuery.new(Post.published)
      .by_author(params[:author_id])
      .by_tag(params[:tag])
      .sorted
      .results

    render json: PostSerializer.new(posts).serializable_hash.to_json
  end
end

# Reuse in background job:
class CsvExportJob < ApplicationJob
  def perform(filters)
    posts = PostQuery.new
      .by_status(filters[:status])
      .since(filters[:since])
      .sorted(:created_at, :asc)
      .results

    CsvGenerator.new(posts).generate
  end
end

# test/queries/post_query_test.rb
class PostQueryTest < ActiveSupport::TestCase
  test "by_status filters published posts" do
    published = posts(:published)
    draft = posts(:draft)

    results = PostQuery.new.by_status("published").results

    assert_includes results, published
    refute_includes results, draft
  end

  test "blank params are skipped" do
    all_posts = Post.count
    results = PostQuery.new.by_status(nil).by_author("").results

    assert_equal all_posts, results.count
  end

  test "methods are chainable" do
    results = PostQuery.new
      .by_status("published")
      .by_author(users(:alice).id)
      .sorted
      .results

    assert results.is_a?(ActiveRecord::Relation)
  end

  test "with_min_comments uses GROUP + HAVING" do
    popular = posts(:popular)  # has 5 comments
    results = PostQuery.new.with_min_comments(3).results

    assert_includes results, popular
  end

  test "custom base scope narrows results" do
    results = PostQuery.new(Post.published).results
    assert results.all? { |p| p.status == "published" }
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

// ============================================
// Level 20: Error Handling
// ============================================

const level20ErrorHandling: Level = {
	id: 'act3-level21-error-handling',
	actId: 3,
	levelNumber: 21,
	name: 'Error Handling',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'A client reports that the API returns raw 500 errors with Ruby stack traces in production. Another endpoint returns a 404 as plain text. The error format is different on every endpoint.',
	},
	startingPipeline: standardPipeline({ modelLabel: 'Post' }),
	problem: {
		observation:
			'API returns inconsistent error formats: sometimes HTML stack traces, sometimes plain text, sometimes JSON with different shapes. Clients cannot reliably parse error responses.',
		rootCause:
			'No centralized error handling. Each controller rescues exceptions differently (or not at all), resulting in three different error formats.',
		codeExample: `# app/controllers/api/v1/posts_controller.rb
class Api::V1::PostsController < ApplicationController
  def show
    @post = Post.find(params[:id])  # Raises ActiveRecord::RecordNotFound
    render json: @post
    # No rescue -- returns raw 500 with HTML stack trace!
  end

  def update
    @post = Post.find(params[:id])
    @post.update!(post_params)  # Raises ActiveRecord::RecordInvalid
    render json: @post
  rescue ActiveRecord::RecordInvalid => e
    render json: { message: e.message }, status: 422  # Different shape!
  end
end

# app/controllers/api/v1/users_controller.rb
class Api::V1::UsersController < ApplicationController
  def show
    @user = User.find(params[:id])
    render json: @user
  rescue ActiveRecord::RecordNotFound
    render plain: "Not found", status: 404  # Plain text, not JSON!
  end
end

# Clients see 3 different error formats:
# 1. Raw HTML stack trace (500)
# 2. { "message": "Validation failed: Title can't be blank" }
# 3. "Not found" (plain text)`,
		goal: 'Build a centralized error handling layer using rescue_from that returns consistent { error: { code, message, details } } JSON responses.',
		thresholds: {},
	},
	successConditions: [{ type: 'error_handling_configured' }],
	availableNodes: ['error_handler'],
	unlockedNodes: ['error_handler'],
	learningContent: {
		title: 'Centralized Error Handling with rescue_from',
		goal: `In this level, you'll:\n- build a centralized error handling layer so your API always returns consistent, predictable JSON errors.\n- use rescue_from in ApplicationController to catch exceptions globally.\n- map exceptions to the right HTTP status codes.\n- never leak stack traces to clients again.`,
		conceptExplanation: `\`rescue_from\` in ApplicationController catches exceptions globally and converts them to consistent JSON error responses.

**Principles:**
- Every error response has the same JSON shape: \`{ error: { code, message, details } }\`
- Never leak stack traces in production
- Use appropriate HTTP status codes
- Include machine-readable error codes for clients to switch on
- Log full details server-side, return safe messages client-side

**Standard error shape:**
\`\`\`json
{
  "error": {
    "code": "not_found",
    "message": "Post not found",
    "details": {}
  }
}
\`\`\`

**Common exceptions to handle:**
- \`ActiveRecord::RecordNotFound\` -> 404
- \`ActiveRecord::RecordInvalid\` -> 422
- \`ActionController::ParameterMissing\` -> 400
- \`Pundit::NotAuthorizedError\` -> 403
- \`ActiveRecord::RecordNotUnique\` -> 409

**Order matters:** rescue_from handlers are matched bottom-up. Put the most specific handlers last (they take priority).`,
		railsCodeExample: `# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  rescue_from StandardError, with: :internal_server_error
  rescue_from ActiveRecord::RecordNotFound, with: :not_found
  rescue_from ActiveRecord::RecordInvalid, with: :unprocessable_entity
  rescue_from ActiveRecord::RecordNotUnique, with: :conflict
  rescue_from ActionController::ParameterMissing, with: :bad_request
  rescue_from Pundit::NotAuthorizedError, with: :forbidden

  private

  def not_found(exception)
    render json: {
      error: {
        code: "not_found",
        message: "#{exception.model || 'Resource'} not found"
      }
    }, status: :not_found
  end

  def unprocessable_entity(exception)
    render json: {
      error: {
        code: "validation_failed",
        message: "Validation failed",
        details: exception.record.errors.messages
      }
    }, status: :unprocessable_entity
  end

  def bad_request(exception)
    render json: {
      error: {
        code: "bad_request",
        message: "Missing parameter: #{exception.param}"
      }
    }, status: :bad_request
  end

  def forbidden(_exception)
    render json: {
      error: {
        code: "forbidden",
        message: "You are not authorized to perform this action"
      }
    }, status: :forbidden
  end

  def conflict(_exception)
    render json: {
      error: {
        code: "conflict",
        message: "Resource already exists"
      }
    }, status: :conflict
  end

  def internal_server_error(exception)
    # Log the full error server-side
    Rails.logger.error(exception.message)
    Rails.logger.error(exception.backtrace&.first(20)&.join("\\n"))

    # Return safe message to client
    render json: {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred"
      }
    }, status: :internal_server_error
  end
end

# Now controllers are clean -- no rescue blocks needed:
# app/controllers/api/v1/posts_controller.rb
class Api::V1::PostsController < ApplicationController
  def show
    post = Post.find(params[:id])  # RecordNotFound -> 404 JSON
    render json: PostSerializer.new(post).serializable_hash.to_json
  end

  def create
    post = current_user.posts.new(post_params)
    post.save!  # RecordInvalid -> 422 JSON
    render json: PostSerializer.new(post).serializable_hash.to_json, status: :created
  end

  def update
    post = Post.find(params[:id])
    authorize post  # NotAuthorizedError -> 403 JSON
    post.update!(post_params)
    render json: PostSerializer.new(post).serializable_hash.to_json
  end

  private

  def post_params
    params.expect(post: [:title, :body])  # ParameterMissing -> 400 JSON
  end
end

# All errors now return consistent JSON:
# GET /api/v1/posts/999
# => 404 { "error": { "code": "not_found", "message": "Post not found" } }
#
# POST /api/v1/posts with invalid data
# => 422 { "error": { "code": "validation_failed", "message": "...", "details": {...} } }
#
# POST /api/v1/posts without params key
# => 400 { "error": { "code": "bad_request", "message": "Missing parameter: post" } }

# test/controllers/error_handling_test.rb
class ErrorHandlingTest < ActionDispatch::IntegrationTest
  test "returns 404 JSON for missing records" do
    get api_v1_post_path(id: 999999), as: :json

    assert_response :not_found
    json = JSON.parse(response.body)
    assert_equal "not_found", json.dig("error", "code")
    assert_match "Post", json.dig("error", "message")
  end

  test "returns 422 JSON for validation errors" do
    post api_v1_posts_path, params: { post: { title: "" } }, as: :json

    assert_response :unprocessable_entity
    json = JSON.parse(response.body)
    assert_equal "validation_failed", json.dig("error", "code")
    assert json.dig("error", "details").present?
  end

  test "returns 400 JSON for missing parameters" do
    post api_v1_posts_path, params: {}, as: :json

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal "bad_request", json.dig("error", "code")
  end

  test "never leaks stack traces in production" do
    # Simulate an unexpected error
    Post.stub(:find, -> (_) { raise "Boom!" }) do
      get api_v1_post_path(id: 1), as: :json
    end

    assert_response :internal_server_error
    json = JSON.parse(response.body)
    assert_equal "internal_error", json.dig("error", "code")
    refute_match "Boom!", json.dig("error", "message")
  end
end`,
		commonMistakes: [
			'Leaking stack traces in production (never render exception.backtrace to clients)',
			'Inconsistent error response shapes across endpoints (always use the same JSON structure)',
			'Rescuing StandardError too broadly without logging the original exception',
			'Not logging the full exception server-side before rendering the safe client message',
			'Forgetting to handle ActionController::ParameterMissing from params.expect()',
		],
		whenToUse:
			'Every API should have centralized error handling in ApplicationController from day one. It is a prerequisite for a reliable API.',
		furtherReading: [
			{
				title: 'Action Controller Overview - Rescue',
				url: 'https://guides.rubyonrails.org/action_controller_overview.html#rescue',
			},
			{
				title: 'Rails API Error Handling',
				url: 'https://guides.rubyonrails.org/api_app.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add an Error Handler node connected to the controller. It intercepts all exceptions and returns consistent JSON errors with code, message, and details.',
	},
};

// ============================================
// Level 21: Action Mailer
// ============================================

const level21ActionMailer: Level = {
	id: 'act3-level22-action-mailer',
	actId: 3,
	levelNumber: 22,
	name: 'Action Mailer',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Users forget their passwords and have no way to reset them. Build a password reset flow with secure token generation and email delivery.',
	},
	startingPipeline: standardPipeline({
		modelId: 'user-model',
		modelLabel: 'User',
	}),
	problem: {
		observation:
			'Users who forget their passwords are locked out permanently. Support tickets are piling up asking for manual password resets. There is no self-service flow.',
		rootCause:
			'No password reset flow exists. No mailer is configured to send reset tokens to users.',
		codeExample: `# Currently: no way to reset a password!
# Users must email support, who manually runs:
#   user = User.find_by(email: "...")
#   user.update!(password: "temporary123")
# Then tells the user to change it. Not scalable!

# What we need:
# 1. POST /api/v1/password_resets -- generate token, send email
# 2. PUT  /api/v1/password_resets/:token -- verify token, update password

# Rails 8 has generates_token_for -- no more rolling your own
# token columns, expiry logic, or secure_random strings!
# But we need a mailer to deliver the token to the user.`,
		goal: 'Build a password reset flow using Rails 8 generates_token_for and Action Mailer.',
		thresholds: {},
	},
	successConditions: [{ type: 'mailer_configured' }],
	availableNodes: ['mailer'],
	unlockedNodes: ['mailer'],
	learningContent: {
		title: 'Action Mailer & generates_token_for (Rails 8)',
		goal: `In this level, you'll:\n- build a password reset flow using Action Mailer and Rails 8's generates_token_for.\n- learn how to send emails asynchronously with deliver_later.\n- generate secure, stateless tokens that auto-expire.\n- verify tokens without storing anything in the database.`,
		conceptExplanation: `Action Mailer handles email delivery in Rails. Combined with Rails 8's \`generates_token_for\`, you get secure, expiring tokens without storing them in the database.

**generates_token_for (Rails 8):**
- Generates signed, expiring tokens using \`ActiveRecord::Base.generates_token_for\`
- Tokens are derived from the model's attributes -- they auto-expire when the attribute changes
- No token column needed in the database (stateless!)
- Verifies with \`Model.find_by_token_for(:purpose, token)\`
- Returns \`nil\` if the token is expired, tampered with, or already used

**Action Mailer:**
- Mailers are like controllers for email (each method = one email template)
- Templates live in \`app/views/mailer_name/\`
- Use \`deliver_later\` to send via background job (never \`deliver_now\` in production)
- Preview mailers in the browser at \`/rails/mailers\` during development
- Test with \`assert_emails\` and \`assert_enqueued_emails\`

**Security best practices:**
- Always return the same response whether the email exists or not (prevents enumeration)
- Use short-lived tokens (15 minutes for password reset)
- Invalidate tokens after use (generates_token_for does this automatically when password changes)`,
		railsCodeExample: `# app/models/user.rb
class User < ApplicationRecord
  has_secure_password

  # Rails 8: generates_token_for
  # Token expires in 15 minutes or when password changes
  generates_token_for :password_reset, expires_in: 15.minutes do
    password_salt&.last(10)  # Invalidates when password changes
  end

  # You can define tokens for other purposes too:
  generates_token_for :email_verification, expires_in: 24.hours do
    email
  end
end

# app/mailers/application_mailer.rb
class ApplicationMailer < ActionMailer::Base
  default from: "noreply@socialplatform.com"
  layout "mailer"
end

# app/mailers/user_mailer.rb
class UserMailer < ApplicationMailer
  def password_reset(user)
    @user = user
    @token = user.generate_token_for(:password_reset)
    @reset_url = "https://socialplatform.com/reset-password?token=#{@token}"

    mail(
      to: @user.email,
      subject: "Reset your password"
    )
  end

  def welcome(user)
    @user = user
    mail(to: @user.email, subject: "Welcome to SocialPlatform!")
  end
end

# app/views/user_mailer/password_reset.html.erb
<h1>Password Reset</h1>
<p>Hi <%= @user.name %>,</p>
<p>Click the link below to reset your password. This link expires in 15 minutes.</p>
<p><%= link_to "Reset Password", @reset_url %></p>
<p>If you didn't request this, you can safely ignore this email.</p>

# app/controllers/api/v1/password_resets_controller.rb
class Api::V1::PasswordResetsController < ApplicationController
  skip_before_action :authenticate_user

  # POST /api/v1/password_resets
  def create
    user = User.find_by(email: params[:email])

    # Always return success (don't leak whether email exists)
    if user
      UserMailer.password_reset(user).deliver_later
    end

    render json: { message: "If that email exists, we sent reset instructions." }
  end

  # PUT /api/v1/password_resets/:token
  def update
    user = User.find_by_token_for(:password_reset, params[:token])

    if user.nil?
      render json: {
        error: { code: "invalid_token", message: "Token is invalid or expired" }
      }, status: :unprocessable_entity
      return
    end

    if user.update(password: params[:password])
      # Token is now invalid because password_salt changed!
      render json: { message: "Password updated successfully" }
    else
      render json: {
        error: { code: "validation_failed", details: user.errors.messages }
      }, status: :unprocessable_entity
    end
  end
end

# test/mailers/user_mailer_test.rb
class UserMailerTest < ActionMailer::TestCase
  test "password_reset email contains reset link" do
    user = users(:alice)
    email = UserMailer.password_reset(user)

    assert_emails 1 do
      email.deliver_now
    end

    assert_equal ["noreply@socialplatform.com"], email.from
    assert_equal [user.email], email.to
    assert_match "Reset your password", email.subject
    assert_match "expires in 15 minutes", email.body.encoded
    assert_match "reset-password?token=", email.body.encoded
  end
end

# test/controllers/password_resets_controller_test.rb
class PasswordResetsControllerTest < ActionDispatch::IntegrationTest
  test "create always returns success (no email enumeration)" do
    post api_v1_password_resets_path,
      params: { email: "nonexistent@example.com" }, as: :json

    assert_response :ok
    assert_match "If that email exists", JSON.parse(response.body)["message"]
  end

  test "valid token resets password" do
    user = users(:alice)
    token = user.generate_token_for(:password_reset)

    put api_v1_password_reset_path(token),
      params: { password: "newsecure123" }, as: :json

    assert_response :ok
    assert user.reload.authenticate("newsecure123")
  end

  test "expired token is rejected" do
    user = users(:alice)
    token = user.generate_token_for(:password_reset)

    travel 20.minutes  # Token expired (15 min limit)

    put api_v1_password_reset_path(token),
      params: { password: "newsecure123" }, as: :json

    assert_response :unprocessable_entity
    json = JSON.parse(response.body)
    assert_equal "invalid_token", json.dig("error", "code")
  end

  test "token is single-use (invalidated after password change)" do
    user = users(:alice)
    token = user.generate_token_for(:password_reset)

    # First use: succeeds
    put api_v1_password_reset_path(token),
      params: { password: "newsecure123" }, as: :json
    assert_response :ok

    # Second use: fails (password_salt changed)
    put api_v1_password_reset_path(token),
      params: { password: "another_password" }, as: :json
    assert_response :unprocessable_entity
  end
end`,
		commonMistakes: [
			'Using deliver_now in production (blocks the HTTP response for 2-3 seconds)',
			'Leaking whether an email exists in the response (enables account enumeration attacks)',
			'Storing reset tokens in the database (generates_token_for eliminates this entirely)',
			'Not setting token expiration (tokens should be short-lived, 15-30 minutes)',
			'Forgetting that the token auto-invalidates after password change (no manual cleanup needed)',
		],
		whenToUse:
			'Any feature that requires email delivery: password resets, welcome emails, notifications, order confirmations, weekly digests.',
		furtherReading: [
			{
				title: 'Action Mailer Basics',
				url: 'https://guides.rubyonrails.org/action_mailer_basics.html',
			},
			{
				title: 'Rails 8 generates_token_for',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/TokenFor/ClassMethods.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Mailer node and connect it to the controller. Use generates_token_for for secure, stateless password reset tokens that auto-expire.',
	},
};

// ============================================
// Level 22: Background Jobs
// ============================================

const level22BackgroundJobs: Level = {
	id: 'act3-level23-background-jobs',
	actId: 3,
	levelNumber: 23,
	name: 'Background Jobs',
	requiresTests: true,
	trigger: {
		type: 'performance_alert',
		description:
			'Email sending blocks the HTTP response for 3 seconds. Users stare at a loading spinner while the mailer talks to the SMTP server. The Stripe API call adds another 2 seconds. Move it all to background jobs.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 240, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 400,
				y: 220,
				locked: true,
				config: { label: 'RegistrationsController' },
			},
			{
				id: 'service-node',
				type: 'service',
				x: 600,
				y: 220,
				locked: true,
				config: { label: 'UserRegistration' },
			},
			{
				id: 'user-model',
				type: 'model',
				x: 800,
				y: 140,
				locked: true,
				config: { label: 'User' },
			},
			{
				id: 'mailer-node',
				type: 'mailer',
				x: 800,
				y: 380,
				locked: true,
				config: { label: 'UserMailer' },
			},
			{ id: 'database-node', type: 'database', x: 980, y: 140, locked: true },
			{ id: 'response-node', type: 'response', x: 980, y: 380, locked: true },
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
				targetNodeId: 'service-node',
			},
			{ id: 'c4', sourceNodeId: 'service-node', targetNodeId: 'user-model' },
			{ id: 'c5', sourceNodeId: 'service-node', targetNodeId: 'mailer-node' },
			{ id: 'c6', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{
				id: 'c7',
				sourceNodeId: 'controller-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'Registration takes 5+ seconds because the mailer calls the SMTP server synchronously (3s) and the Stripe API call adds another 2s. Users think the app is broken.',
		rootCause:
			'Side effects (email, Stripe, newsletter) are executed inline during the request cycle instead of being offloaded to background jobs.',
		codeExample: `# app/services/user_registration.rb -- currently synchronous
class UserRegistration < ApplicationService
  def call
    user = User.create!(@params)

    # These block the HTTP response!
    UserMailer.welcome(user).deliver_now       # 2-3 seconds
    Stripe::Customer.create(email: user.email) # 1-2 seconds
    NewsletterService.subscribe(user.email)    # 0.5 seconds

    Result.new(success?: true, user: user, errors: [])
  end
end

# Total response time: 4-6 seconds (should be < 200ms)
# If Stripe is down, the entire registration fails
# If the email server is slow, every user waits
# If the newsletter API times out, registration times out`,
		goal: 'Move side effects to background jobs using ActiveJob and Solid Queue (Rails 8 default, database-backed, no Redis).',
		thresholds: {},
	},
	successConditions: [{ type: 'background_jobs_configured' }],
	availableNodes: ['background_job'],
	unlockedNodes: ['background_job'],
	learningContent: {
		title: 'Background Jobs with Solid Queue (Rails 8)',
		goal: `In this level, you'll:\n- learn how to move slow work like email delivery and external API calls out of the request cycle.\n- use ActiveJob with Solid Queue, Rails 8's database-backed job processor that needs no Redis.\n- design your jobs to be idempotent so they're safe to retry.`,
		conceptExplanation: `Background jobs move slow or unreliable work out of the HTTP request cycle. Rails 8 ships with Solid Queue as the default job backend -- no Redis required.

**Solid Queue (Rails 8 default):**
- Database-backed job queue (uses your existing database)
- No Redis or external dependencies needed
- Supports queues, priorities, retries, and concurrency controls
- Built-in features: unique jobs, recurring jobs, pausing queues
- Stores jobs in your database -- easy to inspect, debug, and monitor

**ActiveJob:**
- Rails' unified API for background jobs
- \`perform_later\` enqueues the job (returns immediately)
- \`perform_now\` runs inline (useful for testing)
- Automatic retries with configurable backoff strategies
- \`retry_on\` and \`discard_on\` for error handling

**What to background:**
- Email delivery (\`deliver_later\` instead of \`deliver_now\`)
- External API calls (Stripe, webhooks, third-party services)
- File processing (image resizing, PDF generation, CSV exports)
- Data exports, reports, and batch operations
- Anything that takes more than ~100ms

**Idempotency is critical:**
Jobs may run more than once (retries, queue restarts). Design every job to be safe to re-run.`,
		railsCodeExample: `# config/application.rb -- Rails 8 default
config.active_job.queue_adapter = :solid_queue

# config/queue.yml -- Solid Queue configuration
default: &default
  dispatchers:
    - polling_interval: 1
      batch_size: 500
  workers:
    - queues: "*"
      threads: 5
      polling_interval: 0.1

production:
  <<: *default
  workers:
    - queues: [default, mailers]
      threads: 5
      polling_interval: 0.1
    - queues: [low_priority]
      threads: 2
      polling_interval: 5

# app/jobs/create_stripe_customer_job.rb
class CreateStripeCustomerJob < ApplicationJob
  queue_as :default

  # Solid Queue: retry with exponential backoff
  retry_on Stripe::StripeError, wait: :polynomially_longer, attempts: 5
  discard_on Stripe::InvalidRequestError  # Don't retry bad requests

  def perform(user_id)
    user = User.find(user_id)
    return if user.stripe_customer_id.present?  # Idempotent!

    customer = Stripe::Customer.create(
      email: user.email,
      name: user.name,
      metadata: { user_id: user.id }
    )

    user.update!(stripe_customer_id: customer.id)
  end
end

# app/jobs/subscribe_newsletter_job.rb
class SubscribeNewsletterJob < ApplicationJob
  queue_as :low_priority

  retry_on Net::OpenTimeout, wait: 30.seconds, attempts: 3

  def perform(email)
    NewsletterService.subscribe(email)
  end
end

# app/services/user_registration.rb -- now async!
class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(params)
    @params = params
  end

  def call
    user = User.create!(@params)

    # All side effects are now background jobs
    UserMailer.welcome(user).deliver_later                # Queued!
    CreateStripeCustomerJob.perform_later(user.id)        # Queued!
    SubscribeNewsletterJob.perform_later(user.email)      # Queued!

    # Response returns instantly (< 200ms)
    Result.new(success?: true, user: user, errors: [])
  rescue ActiveRecord::RecordInvalid => e
    Result.new(success?: false, user: nil, errors: e.record.errors.full_messages)
  end
end

# test/jobs/create_stripe_customer_job_test.rb
class CreateStripeCustomerJobTest < ActiveJob::TestCase
  test "enqueues job on registration" do
    assert_enqueued_with(job: CreateStripeCustomerJob) do
      CreateStripeCustomerJob.perform_later(users(:alice).id)
    end
  end

  test "is idempotent -- skips if customer already exists" do
    user = users(:alice)
    user.update!(stripe_customer_id: "cus_existing")

    # Should not call Stripe API
    assert_no_changes -> { user.reload.stripe_customer_id } do
      CreateStripeCustomerJob.perform_now(user.id)
    end
  end

  test "retries on transient Stripe errors" do
    perform_enqueued_jobs do
      assert_performed_with(job: CreateStripeCustomerJob) do
        CreateStripeCustomerJob.perform_later(users(:alice).id)
      end
    end
  end
end

# test/services/user_registration_test.rb
class UserRegistrationTest < ActiveSupport::TestCase
  test "registration enqueues all background jobs" do
    result = UserRegistration.call(
      email: "new@example.com", password: "secure123", name: "Alice"
    )

    assert result.success?
    assert_enqueued_jobs 3  # welcome email + stripe + newsletter
  end
end

# Running Solid Queue workers:
# bin/jobs start                    -- start all workers
# bin/jobs start --queues=mailers   -- start worker for specific queue

# Monitoring in Rails console:
# SolidQueue::Job.where(queue_name: "default").count
# SolidQueue::FailedExecution.last(10)`,
		commonMistakes: [
			'Passing ActiveRecord objects instead of IDs to perform_later (objects get serialized and may be stale on deserialization)',
			'Not making jobs idempotent (they may run more than once on retry or queue restart)',
			'Using deliver_now instead of deliver_later in production (blocks the request)',
			'Not setting retry policies with retry_on (jobs fail silently and are lost)',
			'Not separating queues by priority (time-sensitive email should not wait behind analytics)',
			'Forgetting that Solid Queue uses your database (monitor DB load under heavy job throughput)',
		],
		whenToUse:
			'Any operation that takes more than 100ms, calls an external service, or does not need to complete before the HTTP response is sent.',
		furtherReading: [
			{
				title: 'Active Job Basics',
				url: 'https://guides.rubyonrails.org/active_job_basics.html',
			},
			{
				title: 'Solid Queue (Rails 8 default)',
				url: 'https://github.com/rails/solid_queue',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Background Job node between the service and the mailer. Jobs process asynchronously so the HTTP response returns instantly.',
	},
};

// ============================================
// Act 3 Definition
// ============================================

export const actThree: Act = {
	id: 3,
	name: 'Clean Architecture',
	tagline: 'Features are piling up. The codebase is getting messy.',
	description:
		'Your API works and it is secure, but the controllers are doing too much and the code is hard to change. Extract service objects, concerns, validation contracts, query objects, mailers, error handling, and background jobs to keep things maintainable.',
	levels: [
		level16ServiceObjects,
		level17Concerns,
		level18ValidationContracts,
		level19QueryObjects,
		level20ErrorHandling,
		level21ActionMailer,
		level22BackgroundJobs,
	],
	unlockedNodes: ['service', 'concern', 'form_object', 'query_object', 'mailer', 'job'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate'],
};
