/**
 * Act 3: Clean Architecture
 * "Codebase doubles. Fat controllers, duplicated logic. Time to refactor."
 *
 * Levels 15-21: Service Objects, Concerns & Modules, Form Objects, Custom Validators,
 * Error Handling, Action Mailer, Background Jobs
 * App context: Social platform API with code quality problems
 */

import type { Act, Level } from "@/types";

// ============================================
// Level 15: Service Objects
// ============================================

const level15ServiceObjects: Level = {
	id: 'act3-level15-service-objects',
	actId: 3,
	levelNumber: 15,
	name: 'Service Objects',
	requiresTests: true,
	trigger: {
		type: 'refactor_request',
		description:
			'The RegistrationsController#create action is 80 lines long. It creates a user, sends a welcome email, and creates a Stripe customer. Too much logic in one controller action.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 460, y: 250, locked: true, config: { label: 'RegistrationsController' } },
			{ id: 'model-node', type: 'model', x: 680, y: 250, locked: true, config: { label: 'User' } },
			{ id: 'database-node', type: 'database', x: 880, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 460, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'response-node' },
		],
	},
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
      render json: UserBlueprint.render(result.user), status: :created
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
// Level 16: Concerns & Modules
// ============================================

const level16Concerns: Level = {
	id: 'act3-level16-concerns',
	actId: 3,
	levelNumber: 16,
	name: 'Concerns & Modules',
	requiresTests: true,
	trigger: {
		type: 'code_review',
		description:
			'Tagging logic is copy-pasted across Post, Comment, and Photo models. Three copies of the same 40 lines. DRY it up with a Taggable concern.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'post-model', type: 'model', x: 200, y: 150, locked: true, config: { label: 'Post' } },
			{ id: 'comment-model', type: 'model', x: 200, y: 300, locked: true, config: { label: 'Comment' } },
			{ id: 'photo-model', type: 'model', x: 200, y: 450, locked: true, config: { label: 'Photo' } },
			{ id: 'database-node', type: 'database', x: 500, y: 300, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{ id: 'c2', sourceNodeId: 'comment-model', targetNodeId: 'database-node' },
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
			'Concerns with dependencies on the host model\'s specific attributes (breaks when included elsewhere)',
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
// Level 17: Form Objects
// ============================================

const level17FormObjects: Level = {
	id: 'act3-level17-form-objects',
	actId: 3,
	levelNumber: 17,
	name: 'Form Objects',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'The onboarding endpoint creates a User, Company, and Address in one request. Validations are scattered across three models, and cross-model rules like "admin requires paid plan" have nowhere to live.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 460, y: 250, locked: true, config: { label: 'OnboardingController' } },
			{ id: 'user-model', type: 'model', x: 680, y: 120, locked: true, config: { label: 'User' } },
			{ id: 'company-model', type: 'model', x: 680, y: 250, locked: true, config: { label: 'Company' } },
			{ id: 'address-model', type: 'model', x: 680, y: 380, locked: true, config: { label: 'Address' } },
			{ id: 'database-node', type: 'database', x: 880, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'user-model' },
			{ id: 'c4', sourceNodeId: 'controller-node', targetNodeId: 'company-model' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'address-model' },
			{ id: 'c6', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{ id: 'c7', sourceNodeId: 'company-model', targetNodeId: 'database-node' },
			{ id: 'c8', sourceNodeId: 'address-model', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'The controller manually validates and creates three models. Cross-model rules like "company name is required if role is admin" live in the controller. Partial failures leave orphaned records because there is no transaction.',
		rootCause:
			'No form object to encapsulate multi-model validation and creation in a single transactional unit.',
		codeExample: `# app/controllers/api/v1/onboarding_controller.rb
class Api::V1::OnboardingController < ApplicationController
  def create
    # Manual validation in the controller -- messy!
    if params[:role] == "admin" && params[:company_name].blank?
      return render json: { error: "Company name required for admins" }, status: 422
    end

    user = User.new(email: params[:email], password: params[:password], role: params[:role])
    unless user.valid?
      return render json: { errors: user.errors }, status: 422
    end

    company = Company.new(name: params[:company_name], plan: params[:plan])
    unless company.valid?
      return render json: { errors: company.errors }, status: 422
    end

    # No transaction! Partial failures create orphaned records
    user.save!
    company.save!
    company.update!(owner: user)
    Address.create!(
      addressable: company,
      street: params[:street],
      city: params[:city],
      country: params[:country]
    )

    render json: user, status: :created
  rescue ActiveRecord::RecordInvalid => e
    # Some records were already saved -- data inconsistency!
    render json: { error: e.message }, status: 422
  end
end`,
		goal: 'Create a form object using ActiveModel::Model that validates all inputs and persists them in a single transaction.',
		thresholds: {},
	},
	successConditions: [{ type: 'form_object_created' }],
	availableNodes: ['form_object'],
	unlockedNodes: ['form_object'],
	learningContent: {
		title: 'Form Objects with ActiveModel::Model',
		conceptExplanation: `Form objects act as a single entry point for multi-model forms. They include \`ActiveModel::Model\` to get validations, attribute assignment, and error handling without a database table.

**Key benefits:**
- All validations in one place (including cross-model rules)
- Single transaction wraps all creates/updates
- Works with \`params.expect()\` just like a model
- Testable without hitting multiple models

**Structure:**
1. Include \`ActiveModel::Model\` and \`ActiveModel::Attributes\`
2. Define attributes with types
3. Add validations (including cross-model rules)
4. Implement \`#save\` that wraps everything in a transaction

**ActiveModel::Model gives you:**
- \`initialize(attributes = {})\` with mass assignment
- \`valid?\`, \`invalid?\`, \`errors\`
- Naming conventions for form helpers and JSON serialization
- Works exactly like an ActiveRecord model from the controller's perspective`,
		railsCodeExample: `# app/forms/onboarding_form.rb
class OnboardingForm
  include ActiveModel::Model
  include ActiveModel::Attributes

  # User attributes
  attribute :email, :string
  attribute :password, :string
  attribute :role, :string, default: "member"

  # Company attributes
  attribute :company_name, :string
  attribute :plan, :string, default: "starter"

  # Address attributes
  attribute :street, :string
  attribute :city, :string
  attribute :country, :string

  # Standard validations
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password, presence: true, length: { minimum: 8 }
  validates :company_name, presence: true
  validates :city, presence: true
  validates :country, presence: true

  # Cross-model validation: only form objects can do this cleanly
  validate :admin_requires_paid_plan

  attr_reader :user, :company

  def save
    return false unless valid?

    ActiveRecord::Base.transaction do
      @company = Company.create!(name: company_name, plan: plan)
      @user = User.create!(
        email: email,
        password: password,
        role: role,
        company: @company
      )
      Address.create!(
        addressable: @company,
        street: street,
        city: city,
        country: country
      )
    end

    true
  rescue ActiveRecord::RecordInvalid => e
    errors.add(:base, e.message)
    false
  end

  private

  def admin_requires_paid_plan
    if role == "admin" && plan == "starter"
      errors.add(:plan, "must be a paid plan for admin users")
    end
  end
end

# app/controllers/api/v1/onboarding_controller.rb
class Api::V1::OnboardingController < ApplicationController
  def create
    form = OnboardingForm.new(onboarding_params)

    if form.save
      render json: UserBlueprint.render(form.user), status: :created
    else
      render json: { errors: form.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def onboarding_params
    params.expect(onboarding: [
      :email, :password, :role,
      :company_name, :plan,
      :street, :city, :country
    ])
  end
end

# test/forms/onboarding_form_test.rb
class OnboardingFormTest < ActiveSupport::TestCase
  test "valid onboarding creates user, company, and address" do
    form = OnboardingForm.new(
      email: "alice@example.com", password: "secure1234",
      company_name: "Acme", plan: "pro",
      city: "Portland", country: "US"
    )

    assert form.save
    assert_equal "Acme", form.company.name
    assert_equal "alice@example.com", form.user.email
  end

  test "admin with starter plan is invalid" do
    form = OnboardingForm.new(
      email: "admin@example.com", password: "secure1234",
      role: "admin", plan: "starter",
      company_name: "Acme", city: "Portland", country: "US"
    )

    refute form.save
    assert_includes form.errors[:plan], "must be a paid plan for admin users"
  end

  test "rolls back everything on partial failure" do
    # Company name triggers DB uniqueness violation
    Company.create!(name: "Acme", plan: "pro")

    form = OnboardingForm.new(
      email: "alice@example.com", password: "secure1234",
      company_name: "Acme", plan: "pro",
      city: "Portland", country: "US"
    )

    refute form.save
    assert_nil User.find_by(email: "alice@example.com")  # Rolled back!
  end
end`,
		commonMistakes: [
			'Forgetting to wrap persistence in a transaction (partial failures leave orphaned records)',
			'Using accepts_nested_attributes_for instead of a form object (hard to validate, hard to test)',
			'Not including ActiveModel::Attributes (relying on bare attr_accessor loses type casting)',
			'Putting cross-model validations in a callback instead of the form object',
			'Not testing the form object in isolation from the controller',
		],
		whenToUse:
			'Any endpoint that creates or updates multiple models, or where cross-model validations are needed that do not belong on any single model.',
		furtherReading: [
			{
				title: 'ActiveModel::Model',
				url: 'https://api.rubyonrails.org/classes/ActiveModel/Model.html',
			},
			{
				title: 'Form Objects in Rails',
				url: 'https://thoughtbot.com/blog/activemodel-form-objects',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Form Object node between the Controller and the models. It validates all inputs together and persists them in a single transaction.',
	},
};

// ============================================
// Level 18: Custom Validators
// ============================================

const level18CustomValidators: Level = {
	id: 'act3-level18-custom-validators',
	actId: 3,
	levelNumber: 18,
	name: 'Custom Validators',
	requiresTests: true,
	trigger: {
		type: 'user_complaint',
		description:
			'Users submit "not a url" for their website field and future dates for birthdays. The same bad-data patterns appear across User, Company, and Event models with duplicated inline validations.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'user-model', type: 'model', x: 200, y: 150, locked: true, config: { label: 'User' } },
			{ id: 'company-model', type: 'model', x: 200, y: 300, locked: true, config: { label: 'Company' } },
			{ id: 'event-model', type: 'model', x: 200, y: 450, locked: true, config: { label: 'Event' } },
			{ id: 'database-node', type: 'database', x: 500, y: 300, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{ id: 'c2', sourceNodeId: 'company-model', targetNodeId: 'database-node' },
			{ id: 'c3', sourceNodeId: 'event-model', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'Invalid URLs and future birthdates are stored in the database. The same regex validations are copy-pasted across multiple models with slight inconsistencies.',
		rootCause:
			'No reusable custom validator classes. Inline validation logic is duplicated and inconsistent across models.',
		codeExample: `# app/models/user.rb -- inline regex, duplicated
class User < ApplicationRecord
  validate :website_must_be_valid_url
  validate :birthday_must_be_in_past

  private

  def website_must_be_valid_url
    return if website.blank?
    unless website.match?(/\\Ahttps?:\\/\\/[\\S]+\\z/)
      errors.add(:website, "is not a valid URL")
    end
  end

  def birthday_must_be_in_past
    return if birthday.blank?
    if birthday > Date.today
      errors.add(:birthday, "can't be in the future")
    end
  end
end

# app/models/company.rb -- SAME validation copy-pasted!
class Company < ApplicationRecord
  validate :website_must_be_valid_url

  private

  def website_must_be_valid_url
    return if website.blank?
    unless website.match?(/\\Ahttps?:\\/\\/[\\S]+\\z/)  # same regex
      errors.add(:website, "is not a valid URL")
    end
  end
end

# app/models/event.rb -- AND AGAIN with slight differences
class Event < ApplicationRecord
  validate :start_date_must_be_in_future
  validate :website_must_be_valid_url
  # ... same code repeated but with different field names
end`,
		goal: 'Build reusable custom validator classes (UrlValidator, PastDateValidator) that can be used with a one-liner in any model.',
		thresholds: {},
	},
	successConditions: [{ type: 'custom_validator_created' }],
	availableNodes: ['validator'],
	unlockedNodes: ['validator'],
	learningContent: {
		title: 'Custom Validator Classes',
		conceptExplanation: `Rails supports two types of custom validators:

**EachValidator** (validates individual attributes):
- Subclass \`ActiveModel::EachValidator\`
- Override \`validate_each(record, attribute, value)\`
- Use with \`validates :field, your_validator: true\`
- Naming convention: \`UrlValidator\` -> \`validates :field, url: true\`

**Validator** (validates the whole record):
- Subclass \`ActiveModel::Validator\`
- Override \`validate(record)\`
- Use with \`validates_with YourValidator\`

**Conditional validations:**
- \`validates :field, presence: true, if: :published?\`
- \`validates :field, presence: true, unless: -> { draft? }\`
- \`on: :create\` / \`on: :update\` for lifecycle-specific rules

**Custom options:**
- Validators receive \`options\` hash for configuration
- \`options[:message]\` allows custom error messages
- \`options[:allow_blank]\` skips validation for blank values

Custom validators are reusable across any model that has the validated attribute.`,
		railsCodeExample: `# app/validators/url_validator.rb
class UrlValidator < ActiveModel::EachValidator
  def validate_each(record, attribute, value)
    return if value.blank? && options[:allow_blank]

    uri = URI.parse(value)
    unless uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
      record.errors.add(attribute, options[:message] || "is not a valid URL")
    end
  rescue URI::InvalidURIError
    record.errors.add(attribute, options[:message] || "is not a valid URL")
  end
end

# app/validators/past_date_validator.rb
class PastDateValidator < ActiveModel::EachValidator
  def validate_each(record, attribute, value)
    return if value.blank?

    if value > Date.today
      record.errors.add(attribute, options[:message] || "must be in the past")
    end
  end
end

# app/validators/future_date_validator.rb
class FutureDateValidator < ActiveModel::EachValidator
  def validate_each(record, attribute, value)
    return if value.blank?

    if value <= Date.today
      record.errors.add(attribute, options[:message] || "must be in the future")
    end
  end
end

# Now models are clean one-liners:
# app/models/user.rb
class User < ApplicationRecord
  validates :website, url: true, allow_blank: true
  validates :birthday, past_date: true
  validates :email, presence: true
end

# app/models/company.rb
class Company < ApplicationRecord
  validates :website, url: true
  validates :founded_on, past_date: { message: "founding date must be in the past" }
end

# app/models/event.rb
class Event < ApplicationRecord
  validates :url, url: true
  validates :start_date, future_date: true
  validates :title, presence: true, if: :published?
end

# Conditional validations:
class Post < ApplicationRecord
  validates :body, presence: true, on: :publish
  validates :slug, uniqueness: true, if: -> { slug.present? }
  validates :featured_image, presence: true, unless: :draft?
end

# test/validators/url_validator_test.rb
class UrlValidatorTest < ActiveSupport::TestCase
  test "rejects invalid URLs" do
    user = User.new(website: "not a url", email: "a@b.com", password: "x")
    user.valid?
    assert_includes user.errors[:website], "is not a valid URL"
  end

  test "accepts valid HTTPS URLs" do
    user = User.new(website: "https://example.com", email: "a@b.com", password: "x")
    user.valid?
    assert_empty user.errors[:website]
  end

  test "allows blank when configured" do
    user = User.new(website: "", email: "a@b.com", password: "x")
    user.valid?
    assert_empty user.errors[:website]  # allow_blank: true
  end

  test "supports custom error messages" do
    company = Company.new(founded_on: 1.year.from_now)
    company.valid?
    assert_includes company.errors[:founded_on], "founding date must be in the past"
  end
end`,
		commonMistakes: [
			'Putting complex regex in models instead of extracting to a validator class',
			'Not handling nil/blank values in custom validators (causes NoMethodError)',
			'Forgetting to test edge cases (empty strings, nil, unicode, very long strings)',
			'Not allowing custom error messages via options[:message]',
			'Using validate (method) when validates (declarative) is cleaner and more consistent',
		],
		whenToUse:
			'When the same validation logic is needed in 2+ models, or when built-in validators (presence, uniqueness, format) are not sufficient for the business rule.',
		furtherReading: [
			{
				title: 'Active Record Validations',
				url: 'https://guides.rubyonrails.org/active_record_validations.html',
			},
			{
				title: 'Custom Validators Guide',
				url: 'https://guides.rubyonrails.org/active_record_validations.html#custom-validators',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add Validator nodes and connect them to the models that need reusable validation rules. Each validator is a class in app/validators/.',
	},
};

// ============================================
// Level 19: Error Handling
// ============================================

const level19ErrorHandling: Level = {
	id: 'act3-level19-error-handling',
	actId: 3,
	levelNumber: 19,
	name: 'Error Handling',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'A client reports that the API returns raw 500 errors with Ruby stack traces in production. Another endpoint returns a 404 as plain text. The error format is different on every endpoint.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 400, y: 250, locked: true },
			{ id: 'model-node', type: 'model', x: 560, y: 250, locked: true, config: { label: 'Post' } },
			{ id: 'database-node', type: 'database', x: 720, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 880, y: 250, locked: true },
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
        message: "\#{exception.model || 'Resource'} not found"
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
        message: "Missing parameter: \#{exception.param}"
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
    render json: PostBlueprint.render(post)
  end

  def create
    post = current_user.posts.new(post_params)
    post.save!  # RecordInvalid -> 422 JSON
    render json: PostBlueprint.render(post), status: :created
  end

  def update
    post = Post.find(params[:id])
    authorize post  # NotAuthorizedError -> 403 JSON
    post.update!(post_params)
    render json: PostBlueprint.render(post)
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
// Level 20: Action Mailer
// ============================================

const level20ActionMailer: Level = {
	id: 'act3-level20-action-mailer',
	actId: 3,
	levelNumber: 20,
	name: 'Action Mailer',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Users forget their passwords and have no way to reset them. Build a password reset flow with secure token generation and email delivery.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 460, y: 250, locked: true, config: { label: 'PasswordResetsController' } },
			{ id: 'user-model', type: 'model', x: 680, y: 250, locked: true, config: { label: 'User' } },
			{ id: 'database-node', type: 'database', x: 880, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 680, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'user-model' },
			{ id: 'c4', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'response-node' },
		],
	},
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
    @reset_url = "https://socialplatform.com/reset-password?token=\#{@token}"

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
// Level 21: Background Jobs
// ============================================

const level21BackgroundJobs: Level = {
	id: 'act3-level21-background-jobs',
	actId: 3,
	levelNumber: 21,
	name: 'Background Jobs',
	requiresTests: true,
	trigger: {
		type: 'performance_alert',
		description:
			'Email sending blocks the HTTP response for 3 seconds. Users stare at a loading spinner while the mailer talks to the SMTP server. The Stripe API call adds another 2 seconds. Move it all to background jobs.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 240, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 400, y: 250, locked: true, config: { label: 'RegistrationsController' } },
			{ id: 'service-node', type: 'service', x: 600, y: 250, locked: true, config: { label: 'UserRegistration' } },
			{ id: 'user-model', type: 'model', x: 800, y: 140, locked: true, config: { label: 'User' } },
			{ id: 'mailer-node', type: 'mailer', x: 800, y: 380, locked: true, config: { label: 'UserMailer' } },
			{ id: 'database-node', type: 'database', x: 980, y: 140, locked: true },
			{ id: 'response-node', type: 'response', x: 980, y: 380, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'service-node' },
			{ id: 'c4', sourceNodeId: 'service-node', targetNodeId: 'user-model' },
			{ id: 'c5', sourceNodeId: 'service-node', targetNodeId: 'mailer-node' },
			{ id: 'c6', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{ id: 'c7', sourceNodeId: 'controller-node', targetNodeId: 'response-node' },
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
	tagline: 'Codebase doubles. Time to refactor.',
	description:
		'Extract fat controllers into service objects, concerns, form objects, and mailers. Set up proper error handling and move slow work to Solid Queue background jobs.',
	levels: [
		level15ServiceObjects,
		level16Concerns,
		level17FormObjects,
		level18CustomValidators,
		level19ErrorHandling,
		level20ActionMailer,
		level21BackgroundJobs,
	],
	unlockedNodes: ['service', 'concern', 'form_object', 'mailer', 'job'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate'],
};
