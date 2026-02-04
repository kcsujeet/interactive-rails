/**
 * Act 2: Clean Code
 * "Writing Maintainable Rails"
 *
 * Levels 9-15: Security, Scopes, Separation of Concerns, Service Objects, Form Objects, Authorization, View Components
 */

import type { Act, Level } from "@/components/game/types";

// ============================================
// Level 9: Security
// ============================================

const level9Security: Level = {
	id: 'act2-level9-security',
	actId: 2,
	levelNumber: 9,
	name: 'Security',
	trigger: {
		type: 'incident',
		description:
			'Security audit failed. Credentials are exposed in the codebase.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Database credentials are hardcoded in config files.',
		rootCause: 'Secrets not properly managed with environment variables.',
		codeExample: `# BAD: Hardcoded credentials
database:
  password: "supersecret123"

# GOOD: Environment variables
database:
  password: <%= ENV['DATABASE_PASSWORD'] %>`,
		goal: 'Secure all credentials using Rails encrypted credentials.',
		thresholds: {},
	},
	successConditions: [{ type: 'security_configured' }],
	availableNodes: ['env'],
	unlockedNodes: [],
	learningContent: {
		title: 'Rails Security Best Practices',
		conceptExplanation: `Never commit secrets to version control.

**Rails Credentials:**
- Encrypted with master key
- Safe to commit to git
- Edit with: rails credentials:edit`,
		railsCodeExample: `# config/credentials.yml.enc
database:
  password: supersecret123

# Access in code
Rails.application.credentials.dig(:database, :password)`,
		commonMistakes: ['Committing .env files', 'Hardcoding API keys'],
		whenToUse: 'Always use encrypted credentials for secrets.',
		furtherReading: [
			{
				title: 'Rails Security Guide',
				url: 'https://guides.rubyonrails.org/security.html',
			},
		],
	},
	hint: { delay: 20, text: 'Use Rails encrypted credentials for all secrets.' },
};

// ============================================
// Level 10: Scopes
// ============================================

const level10Scopes: Level = {
	id: 'act2-level10-scopes',
	actId: 2,
	levelNumber: 10,
	name: 'Scopes',
	trigger: {
		type: 'code_review',
		description:
			'Query logic is scattered across controllers. Time to consolidate.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Same queries repeated in multiple controllers.',
		rootCause: 'Query logic not encapsulated in model scopes.',
		codeExample: `# BAD: Repeated in controllers
Post.where(published: true).where('created_at > ?', 1.week.ago)

# GOOD: Defined once in model
scope :recent_published, -> { published.where('created_at > ?', 1.week.ago) }`,
		goal: 'Extract common queries into reusable model scopes.',
		thresholds: {},
	},
	successConditions: [{ type: 'scopes_defined' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'ActiveRecord Scopes',
		conceptExplanation: `Scopes encapsulate query logic in models.

**Benefits:**
- DRY: Define once, use everywhere
- Chainable: Post.published.recent
- Testable: Easy to unit test`,
		railsCodeExample: `class Post < ApplicationRecord
  scope :published, -> { where(published: true) }
  scope :recent, -> { where('created_at > ?', 1.week.ago) }
  scope :by_author, ->(author) { where(author: author) }
end

# Usage
Post.published.recent.by_author(current_user)`,
		commonMistakes: ['Complex logic in scopes', 'Not chaining scopes'],
		whenToUse: 'Whenever you have reusable query patterns.',
		furtherReading: [
			{
				title: 'ActiveRecord Query Interface',
				url: 'https://guides.rubyonrails.org/active_record_querying.html',
			},
		],
	},
	hint: { delay: 20, text: 'Define scopes in your model for common queries.' },
};

// ============================================
// Level 11: Separation of Concerns
// ============================================

const level11SeparationOfConcerns: Level = {
	id: 'act2-level11-separation-of-concerns',
	actId: 2,
	levelNumber: 11,
	name: 'Separation of Concerns',
	trigger: {
		type: 'code_review',
		description: 'The controller is 500 lines. We need to refactor.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Fat controller with business logic mixed in.',
		rootCause: 'Single Responsibility Principle violated.',
		codeExample: `# BAD: Fat controller
def create
  @user = User.new(user_params)
  @user.send_welcome_email
  @user.create_stripe_customer
  @user.subscribe_to_newsletter
  # ... 100 more lines
end`,
		goal: 'Drag each code block to its proper architectural layer.',
		thresholds: {},
	},
	successConditions: [{ type: 'controller_lines' }],
	availableNodes: ['service'],
	unlockedNodes: ['service'],
	learningContent: {
		title: 'Single Responsibility Principle',
		conceptExplanation: `Each class should have one reason to change.

**Controllers:** Handle HTTP requests/responses
**Models:** Data and associations
**Services:** Business logic
**Jobs:** Background processing`,
		railsCodeExample: `# app/controllers/users_controller.rb
def create
  result = UserRegistration.call(user_params)
  if result.success?
    redirect_to dashboard_path
  else
    render :new
  end
end`,
		commonMistakes: ['Putting everything in controllers', 'God objects'],
		whenToUse: 'When any class exceeds ~100 lines.',
		furtherReading: [
			{ title: 'SOLID Principles', url: 'https://en.wikipedia.org/wiki/SOLID' },
		],
	},
	hint: { delay: 25, text: 'Move business logic to service objects.' },
};

// ============================================
// Level 12: Service Objects
// ============================================

const level12ServiceObjects: Level = {
	id: 'act2-level12-service-objects',
	actId: 2,
	levelNumber: 12,
	name: 'Service Objects',
	trigger: {
		type: 'new_feature',
		description: 'User registration needs multiple steps. Create a service.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Registration logic scattered across controller and model.',
		rootCause: 'No dedicated object for the registration workflow.',
		codeExample: `# GOOD: Service object pattern
class UserRegistration
  def initialize(params)
    @params = params
  end

  def call
    create_user
    send_welcome_email
    create_stripe_customer
  end
end`,
		goal: 'Create a service object to encapsulate the registration workflow.',
		thresholds: {},
	},
	successConditions: [{ type: 'service_created' }],
	availableNodes: ['service'],
	unlockedNodes: [],
	learningContent: {
		title: 'Service Objects Pattern',
		conceptExplanation: `Service objects encapsulate business logic.

**Characteristics:**
- Single public method (call)
- Stateless operation
- Returns result object`,
		railsCodeExample: `# app/services/user_registration.rb
class UserRegistration
  Result = Struct.new(:success?, :user, :errors)

  def self.call(params)
    new(params).call
  end

  def initialize(params)
    @params = params
  end

  def call
    user = User.new(@params)
    if user.save
      WelcomeMailer.welcome(user).deliver_later
      Result.new(true, user, [])
    else
      Result.new(false, nil, user.errors.full_messages)
    end
  end
end`,
		commonMistakes: ['Multiple public methods', 'Storing state'],
		whenToUse: 'Multi-step operations or complex business logic.',
		furtherReading: [
			{
				title: 'Service Objects',
				url: 'https://www.toptal.com/ruby-on-rails/rails-service-objects-tutorial',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Create a service class with a single call method.',
	},
};

// ============================================
// Level 13: Form Objects
// ============================================

const level13FormObjects: Level = {
	id: 'act2-level13-form-objects',
	actId: 2,
	levelNumber: 13,
	name: 'Form Objects',
	trigger: {
		type: 'new_feature',
		description:
			'Registration form creates both User and Company. How do we validate?',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Form spans multiple models with complex validations.',
		rootCause: 'No abstraction for multi-model forms.',
		codeExample: `# Form creates multiple records
# User + Company + Address
# Where do validations go?`,
		goal: 'Create a form object to handle multi-model forms.',
		thresholds: {},
	},
	successConditions: [{ type: 'form_object_created' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Form Objects Pattern',
		conceptExplanation: `Form objects handle complex form logic.

**Use when:**
- Form spans multiple models
- Virtual attributes needed
- Complex validations`,
		railsCodeExample: `# app/forms/registration_form.rb
class RegistrationForm
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :email, :string
  attribute :company_name, :string
  attribute :terms_accepted, :boolean

  validates :email, presence: true, format: URI::MailTo::EMAIL_REGEXP
  validates :company_name, presence: true
  validates :terms_accepted, acceptance: true

  def save
    return false unless valid?

    ActiveRecord::Base.transaction do
      company = Company.create!(name: company_name)
      User.create!(email: email, company: company)
    end
    true
  rescue ActiveRecord::RecordInvalid
    false
  end
end`,
		commonMistakes: [
			'Validations in controller',
			'accepts_nested_attributes abuse',
		],
		whenToUse: 'Forms that create/update multiple models.',
		furtherReading: [
			{
				title: 'Form Objects',
				url: 'https://thoughtbot.com/blog/activemodel-form-objects',
			},
		],
	},
	hint: { delay: 20, text: 'Create a form class with ActiveModel::Model.' },
};

// ============================================
// Level 14: Authorization
// ============================================

const level14Authorization: Level = {
	id: 'act2-level14-authorization',
	actId: 2,
	levelNumber: 14,
	name: 'Authorization',
	trigger: {
		type: 'security_incident',
		description:
			'Users can edit posts they do not own. Authorization is broken.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Any logged-in user can modify any post.',
		rootCause: 'No authorization layer checking ownership.',
		codeExample: `# BAD: No authorization
def update
  @post = Post.find(params[:id])
  @post.update(post_params)
end

# Anyone can update any post!`,
		goal: 'Implement proper authorization using Pundit policies.',
		thresholds: {},
	},
	successConditions: [{ type: 'authorization_configured' }],
	availableNodes: ['policy'],
	unlockedNodes: ['policy'],
	learningContent: {
		title: 'Authorization with Pundit',
		conceptExplanation: `Pundit provides policy-based authorization.

**Key concepts:**
- Policy classes define permissions
- Scopes filter collections
- Controller integration`,
		railsCodeExample: `# app/policies/post_policy.rb
class PostPolicy < ApplicationPolicy
  def update?
    record.user == user
  end

  def destroy?
    record.user == user || user.admin?
  end

  class Scope < Scope
    def resolve
      if user.admin?
        scope.all
      else
        scope.where(user: user)
      end
    end
  end
end

# In controller
def update
  @post = Post.find(params[:id])
  authorize @post
  @post.update(post_params)
end`,
		commonMistakes: ['Forgetting authorize call', 'Logic in controllers'],
		whenToUse: 'Every action that needs permission checking.',
		furtherReading: [
			{ title: 'Pundit', url: 'https://github.com/varvet/pundit' },
		],
	},
	hint: { delay: 20, text: 'Create a policy class to check ownership.' },
};

// ============================================
// Level 15: View Components
// ============================================

const level15ViewComponents: Level = {
	id: 'act2-level15-view-components',
	actId: 2,
	levelNumber: 15,
	name: 'View Components',
	trigger: {
		type: 'code_review',
		description:
			'Same partial rendered in 12 places with different logic. Refactor time.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Complex view logic duplicated across partials.',
		rootCause: 'No abstraction for reusable view logic.',
		codeExample: `# BAD: Logic in views
<% if current_user.admin? && post.published? %>
  <div class="admin-badge">...</div>
<% end %>
# Repeated in multiple views`,
		goal: 'Extract reusable view logic into ViewComponents.',
		thresholds: {},
	},
	successConditions: [{ type: 'view_component_created' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'ViewComponent Pattern',
		conceptExplanation: `ViewComponents are Ruby objects for view logic.

**Benefits:**
- Testable in isolation
- Encapsulated logic
- Type-safe parameters`,
		railsCodeExample: `# app/components/post_card_component.rb
class PostCardComponent < ViewComponent::Base
  def initialize(post:, show_admin_badge: false)
    @post = post
    @show_admin_badge = show_admin_badge
  end

  def render?
    @post.published? || @show_admin_badge
  end
end

# app/components/post_card_component.html.erb
<article class="post-card">
  <h2><%= @post.title %></h2>
  <% if @show_admin_badge %>
    <span class="badge">Admin</span>
  <% end %>
</article>

# In views
<%= render(PostCardComponent.new(post: @post, show_admin_badge: current_user.admin?)) %>`,
		commonMistakes: ['Logic in ERB', 'Not testing components'],
		whenToUse: 'Any reusable UI with logic.',
		furtherReading: [
			{ title: 'ViewComponent', url: 'https://viewcomponent.org/' },
		],
	},
	hint: {
		delay: 20,
		text: 'Create a component class extending ViewComponent::Base.',
	},
};

// ============================================
// Act 2 Definition
// ============================================

export const actTwo: Act = {
	id: 2,
	name: 'Clean Code',
	tagline: 'Writing Maintainable Rails',
	description:
		'Learn patterns for clean, maintainable Rails code: services, form objects, policies, and components.',
	levels: [
		level9Security,
		level10Scopes,
		level11SeparationOfConcerns,
		level12ServiceObjects,
		level13FormObjects,
		level14Authorization,
		level15ViewComponents,
	],
	unlockedNodes: ['service', 'policy'],
	metricsVisible: false,
};
