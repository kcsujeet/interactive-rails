/**
 * Act 2: Users & Security
 * "Real users arrive. Things break."
 *
 * Levels 8-14: Authentication, Validations, Callbacks & Normalizations,
 * Authorization, Testing, Security, Scopes & Enums
 * App context: Blog API (continued from Act 1)
 */

import type { Act, Level } from '@/types';

// ============================================
// Level 8: Authentication
// ============================================

const level8Authentication: Level = {
	id: 'act2-level9-authentication',
	actId: 2,
	levelNumber: 9,
	name: 'Authentication',
	trigger: {
		type: 'security_audit',
		description:
			'Anyone can hit any endpoint. There is no concept of "who is making this request." You need authentication before anything else.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 460,
				y: 220,
				locked: true,
			},
			{
				id: 'post-model',
				type: 'model',
				x: 660,
				y: 220,
				locked: true,
				config: { label: 'Post' },
			},
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 460,
				y: 400,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 660, y: 400, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{
				id: 'c2',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c6',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'Every endpoint is wide open. GET /api/v1/posts, DELETE /api/v1/posts/1 -- anyone can do anything.',
		rootCause: 'No authentication layer. No User model. No token verification.',
		codeExample: `# Current state: ZERO authentication
# Anyone can hit any endpoint:
curl -X DELETE /api/v1/posts/1   # Deleted! No questions asked.
curl -X POST /api/v1/posts       # Created! By who? Nobody knows.

# Rails 8 ships an auth generator:
bin/rails generate authentication

# This creates:
# - User model with has_secure_password
# - Session model for token management
# - Authentication concern for controllers
# - Login/logout controller scaffolding

# But we're API-only -- we need Bearer tokens, not cookies.`,
		goal: 'Generate auth scaffolding, add a User model, and protect endpoints with Bearer token authentication.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'authentication_configured' },
		{ type: 'node_present', nodeType: 'authentication' },
		{ type: 'connection', sourceType: 'request', targetType: 'authentication' },
	],
	availableNodes: ['authentication', 'model'],
	unlockedNodes: ['authentication'],
	learningContent: {
		title: 'Rails 8 Authentication & Bearer Tokens',
		goal: `In this level, you'll secure your API so every request is tied to a real user. You'll use Rails 8's built-in authentication generator, learn how has_secure_password stores passwords safely with bcrypt, and set up Bearer token authentication so clients can prove who they are on every request.`,
		conceptExplanation: `Rails 8 includes a built-in authentication generator -- no more Devise dependency for basic auth.

**\`bin/rails generate authentication\`** creates:
- User model with \`has_secure_password\` (bcrypt)
- Session model for managing tokens
- Authentication concern for controllers
- Login/logout controller scaffolding

**API mode with Bearer tokens:**
- Sessions use cookies by default -- but APIs need tokens
- Generate a token on login, return it in JSON
- Client sends \`Authorization: Bearer <token>\` on every request
- \`authenticate_or_request_with_http_token\` verifies it

**\`authenticate_by\` (Rails 8 -- timing-safe login):**
- \`User.authenticate_by(email: "...", password: "...")\` returns the user or nil
- Performs constant-time comparison to prevent timing attacks
- Replaces the manual \`find_by + authenticate\` pattern
- Returns nil (not false) on failure -- safe against enumeration

**\`has_secure_password\`:**
- Adds \`password\` and \`password_confirmation\` virtual attributes
- Stores a bcrypt hash in \`password_digest\`
- Provides \`authenticate(password)\` method
- No plaintext passwords ever touch the database`,
		railsCodeExample: `# Generate auth scaffolding (Rails 8)
bin/rails generate authentication

# app/models/user.rb
class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy
end

# For API mode: Token-based authentication
# app/controllers/concerns/api_authentication.rb
module ApiAuthentication
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_user
  end

  private

  def authenticate_user
    authenticate_or_request_with_http_token do |token, _options|
      @current_user = Session.find_by(token: token)&.user
    end
  end

  def current_user
    @current_user
  end
end

# app/controllers/api/v1/sessions_controller.rb
class Api::V1::SessionsController < ApplicationController
  skip_before_action :authenticate_user, only: [:create]

  def create
    # Rails 8: authenticate_by -- timing-safe login
    # Prevents timing attacks (constant-time comparison)
    user = User.authenticate_by(
      email: params[:email],
      password: params[:password]
    )
    if user
      session = user.sessions.create!
      render json: { token: session.token }, status: :created
    else
      render json: { error: "Invalid credentials" }, status: :unauthorized
    end
  end

  def destroy
    Current.session&.destroy
    head :no_content
  end
end

# Client usage:
# POST /api/v1/sessions { email: "...", password: "..." }
# => { "token": "abc123..." }
#
# GET /api/v1/posts -H "Authorization: Bearer abc123..."`,
		commonMistakes: [
			'Using Devise when Rails 8 auth generator is sufficient',
			'Storing plaintext passwords instead of using has_secure_password',
			'Using cookie-based sessions in API-only mode',
			'Not expiring or rotating Bearer tokens',
			'Forgetting skip_before_action on login/signup endpoints',
		],
		whenToUse:
			'Every API that has user-specific data needs authentication. Start with Rails 8 auth generator and adapt for Bearer tokens.',
		furtherReading: [
			{
				title: 'Rails 8 Authentication Generator',
				url: 'https://guides.rubyonrails.org/8_0_release_notes.html',
			},
			{
				title: 'has_secure_password',
				url: 'https://api.rubyonrails.org/classes/ActiveModel/SecurePassword/ClassMethods.html',
			},
			{
				title: 'HTTP Token Authentication',
				url: 'https://api.rubyonrails.org/classes/ActionController/HttpAuthentication/Token.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add an Authentication node between Request and Router. This intercepts every request and verifies the Bearer token before it reaches the controller.',
	},
};

// ============================================
// Level 9: Validations
// ============================================

const level9Validations: Level = {
	id: 'act2-level10-validations',
	actId: 2,
	levelNumber: 10,
	name: 'Validations',
	trigger: {
		type: 'user_complaint',
		description:
			'Users submit empty posts, duplicate emails, and garbage data. The database is filling up with invalid records. Reject bad data before it hits the DB.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 220, locked: true },
			{ id: 'auth-node', type: 'authentication', x: 280, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 480, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 680,
				y: 220,
				locked: true,
			},
			{
				id: 'post-model',
				type: 'model',
				x: 880,
				y: 220,
				locked: true,
				config: { label: 'Post' },
			},
			{ id: 'database-node', type: 'database', x: 1080, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 680,
				y: 420,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 880, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'auth-node' },
			{ id: 'c2', sourceNodeId: 'auth-node', targetNodeId: 'router-node' },
			{
				id: 'c3',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c4', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c5', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{
				id: 'c6',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c7',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'The database contains posts with blank titles, users with duplicate emails, and body text that is a single character. No data integrity.',
		rootCause:
			'No model validations. Data flows straight through to the database without any checks.',
		codeExample: `# Current state: NO validations
class Post < ApplicationRecord
  # Nothing here -- accepts anything!
end

class User < ApplicationRecord
  has_secure_password
  # No email uniqueness check!
end

# What gets through:
Post.create(title: "", body: "")           # Saved! Empty post.
Post.create(title: "a" * 1000, body: nil)  # Saved! Absurd title.
User.create(email: "not-an-email")         # Saved! Invalid email.
User.create(email: "joe@test.com")         # Saved!
User.create(email: "joe@test.com")         # Saved again! Duplicate.

# The database is full of garbage.`,
		goal: 'Add validations to reject invalid data before it reaches the database.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'validations_configured' },
		{ type: 'node_present', nodeType: 'validation' },
		{ type: 'connection', sourceType: 'controller', targetType: 'validation' },
	],
	availableNodes: ['validation'],
	unlockedNodes: ['validation'],
	learningContent: {
		title: 'ActiveRecord Validations',
		goal: `In this level, you'll learn how to reject bad data before it ever reaches the database. You'll add ActiveRecord validations like presence, uniqueness, format, and length to your models, understand when validations run in the lifecycle, and return meaningful error messages to API clients.`,
		conceptExplanation: `Validations ensure only valid data gets saved to the database. They run before \`save\`, \`create\`, and \`update\`.

**Built-in validators:**
- \`presence\` -- field cannot be blank
- \`uniqueness\` -- no duplicate values
- \`format\` -- must match a regex
- \`length\` -- min/max character count
- \`numericality\` -- must be a number
- \`inclusion\` -- must be in a list
- \`exclusion\` -- must not be in a list

**Custom messages:** Override defaults with \`message:\`
**Custom validators:** Write your own for complex rules
**Conditional validations:** \`if:\` and \`unless:\` options

When validation fails, \`save\` returns \`false\` and errors are added to the model's \`errors\` collection.`,
		railsCodeExample: `# app/models/post.rb
class Post < ApplicationRecord
  belongs_to :user

  validates :title, presence: true,
                    length: { minimum: 3, maximum: 255 }
  validates :body, presence: true,
                   length: { minimum: 10, message: "is too short (minimum 10 characters)" }
  validates :status, inclusion: { in: %w[draft published archived] }
end

# app/models/user.rb
class User < ApplicationRecord
  has_secure_password

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP,
                              message: "must be a valid email address" }
  validates :username, presence: true,
                       uniqueness: true,
                       length: { in: 3..30 },
                       format: { with: /\\A[a-zA-Z0-9_]+\\z/,
                                 message: "only allows letters, numbers, and underscores" }
end

# In the controller -- return validation errors as JSON:
def create
  post = current_user.posts.build(post_params)
  if post.save
    render json: PostSerializer.new(post).serializable_hash.to_json, status: :created
  else
    render json: { errors: post.errors.full_messages }, status: :unprocessable_entity
  end
end

# Custom validator example:
class NoProfanityValidator < ActiveModel::EachValidator
  BLOCKED_WORDS = %w[spam scam].freeze

  def validate_each(record, attribute, value)
    if value.present? && BLOCKED_WORDS.any? { |w| value.downcase.include?(w) }
      record.errors.add(attribute, "contains prohibited content")
    end
  end
end

class Post < ApplicationRecord
  validates :title, no_profanity: true
end`,
		commonMistakes: [
			'Not returning validation errors in API responses (clients see 500 instead of 422)',
			'Using uniqueness validation without a database unique index (race condition)',
			'Overly complex validations that belong in a service object',
			'Not validating associated records (validates_associated)',
			'Skipping validations with save(validate: false) in production code',
		],
		whenToUse:
			'Every model that accepts user input needs validations. Add them from the start -- retrofitting is painful.',
		furtherReading: [
			{
				title: 'Active Record Validations',
				url: 'https://guides.rubyonrails.org/active_record_validations.html',
			},
			{
				title: 'Custom Validators',
				url: 'https://guides.rubyonrails.org/active_record_validations.html#custom-validators',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add a Validation node to the pipeline. Validations run inside the model before data reaches the database.',
	},
};

// ============================================
// Level 10: Callbacks & Normalizations
// ============================================

const level10Callbacks: Level = {
	id: 'act2-level11-callbacks',
	actId: 2,
	levelNumber: 11,
	name: 'Callbacks & Normalizations',
	trigger: {
		type: 'incident',
		description:
			'Emails are stored as " JOE@GMAIL.COM " with extra whitespace and mixed case. User lookups fail because find_by(email:) is case-sensitive. Side effects on create are not firing.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'auth-node', type: 'authentication', x: 280, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 480, y: 250, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 680,
				y: 250,
				locked: true,
			},
			{
				id: 'user-model',
				type: 'model',
				x: 900,
				y: 140,
				locked: true,
				config: { label: 'User' },
			},
			{
				id: 'post-model',
				type: 'model',
				x: 900,
				y: 360,
				locked: true,
				config: { label: 'Post' },
			},
			{ id: 'database-node', type: 'database', x: 1100, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 680, y: 450, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'auth-node' },
			{ id: 'c2', sourceNodeId: 'auth-node', targetNodeId: 'router-node' },
			{
				id: 'c3',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c4', sourceNodeId: 'controller-node', targetNodeId: 'user-model' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c6', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{ id: 'c7', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'User.find_by(email: "joe@gmail.com") returns nil even though the user exists. The DB has " JOE@GMAIL.COM " stored. New users sign up but never receive a welcome email.',
		rootCause:
			'No data normalization before save. No after_create callback to trigger side effects.',
		codeExample: `# Current state: raw data goes straight to DB
class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true
end

# What happens:
User.create(email: "  JOE@GMAIL.COM  ")
# => Stored as "  JOE@GMAIL.COM  "

User.find_by(email: "joe@gmail.com")
# => nil  (case mismatch + whitespace)

# Also: no welcome email is sent after signup.
# The controller does User.create(...) and that's it.

# Rails 8 introduces 'normalizes' -- a declarative way
# to clean data before it hits the DB.`,
		goal: 'Normalize email on save and trigger a welcome email after user creation.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'callbacks_configured' },
		{ type: 'node_present', nodeType: 'callback' },
		{ type: 'connection', sourceType: 'model', targetType: 'callback' },
	],
	availableNodes: ['callback'],
	unlockedNodes: ['callback'],
	learningContent: {
		title: 'Callbacks & Rails 8 Normalizations',
		goal: `In this level, you'll learn how to automatically clean and transform data before it hits the database. You'll use Rails 8's normalizes to strip whitespace and downcase emails, hook into ActiveRecord lifecycle callbacks like before_validation and after_create, and understand why after_commit is the safe choice for external side effects.`,
		conceptExplanation: `Callbacks are hooks into the ActiveRecord lifecycle. They let you run code at specific moments: before validation, before save, after create, after destroy, etc.

**Rails 8 \`normalizes\`:**
A new declarative API for cleaning data before save. Replaces messy \`before_save\` callbacks for simple transformations.

**Common callbacks:**
- \`before_validation\` -- set defaults, format data
- \`before_save\` -- compute derived fields
- \`after_create\` -- send welcome emails, provision resources
- \`after_commit\` -- safe for external side effects (runs after DB commit)
- \`before_destroy\` -- check if deletion is allowed

**Callback ordering:** Callbacks run in the order they are defined. Use \`after_commit\` (not \`after_save\`) for external services to avoid triggering on rolled-back transactions.`,
		railsCodeExample: `# app/models/user.rb
class User < ApplicationRecord
  has_secure_password

  # Rails 8: normalizes -- declarative data cleaning
  normalizes :email, with: -> (email) { email.strip.downcase }
  normalizes :username, with: -> (username) { username.strip }

  validates :email, presence: true, uniqueness: true

  # Callbacks for side effects
  after_create :send_welcome_email
  after_create :provision_default_settings

  # Use after_commit for external services (safe after DB commit)
  after_commit :sync_to_crm, on: :create

  private

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end

  def provision_default_settings
    settings.create!(theme: "light", notifications: true)
  end

  def sync_to_crm
    CrmSyncJob.perform_later(id)
  end
end

# app/models/post.rb
class Post < ApplicationRecord
  normalizes :title, with: -> (title) { title.strip }

  before_save :set_published_at, if: :publishing?

  private

  def publishing?
    status_changed? && status == "published"
  end

  def set_published_at
    self.published_at = Time.current
  end
end

# normalizes also applies to queries:
User.find_by(email: "  JOE@GMAIL.COM  ")
# => Normalizes the query value too! Finds the user.

# Compared to the old way:
# before_save :downcase_email
# def downcase_email
#   self.email = email.strip.downcase
# end
# ^ This does NOT normalize query values!`,
		commonMistakes: [
			'Using after_save instead of after_commit for external API calls (fires even if transaction rolls back)',
			'Heavy logic in callbacks that should be in a service object',
			'Callback chains that are hard to debug (hidden control flow)',
			'Using before_save for normalization instead of Rails 8 normalizes',
			'Not using deliver_later for emails (blocks the request)',
		],
		whenToUse:
			'Use normalizes for data cleaning. Use callbacks sparingly for simple side effects. For complex workflows, prefer service objects.',
		furtherReading: [
			{
				title: 'Active Record Callbacks',
				url: 'https://guides.rubyonrails.org/active_record_callbacks.html',
			},
			{
				title: 'Rails 8 normalizes',
				url: 'https://guides.rubyonrails.org/8_0_release_notes.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add a Callback node connected to the User model. Use Rails 8 normalizes for email cleanup and after_create for the welcome email.',
	},
};

// ============================================
// Level 11: Authorization
// ============================================

const level11Authorization: Level = {
	id: 'act2-level12-authorization',
	actId: 2,
	levelNumber: 12,
	name: 'Authorization',
	trigger: {
		type: 'security_incident',
		description:
			"User A can edit User B's posts. Authentication tells us WHO is making the request, but nothing checks whether they are ALLOWED to do what they are asking.",
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'auth-node', type: 'authentication', x: 280, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 480, y: 250, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 680,
				y: 250,
				locked: true,
			},
			{
				id: 'post-model',
				type: 'model',
				x: 880,
				y: 250,
				locked: true,
				config: { label: 'Post' },
			},
			{ id: 'database-node', type: 'database', x: 1080, y: 250, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 680,
				y: 420,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 880, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'auth-node' },
			{ id: 'c2', sourceNodeId: 'auth-node', targetNodeId: 'router-node' },
			{
				id: 'c3',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c4', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c5', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{
				id: 'c6',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c7',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'User A logs in and sends DELETE /api/v1/posts/42 -- a post owned by User B. It succeeds. Any authenticated user can modify or destroy any post.',
		rootCause:
			'Authentication verifies identity but there is no authorization layer checking ownership or permissions.',
		codeExample: `# Current state: no authorization
class Api::V1::PostsController < ApplicationController
  def update
    post = Post.find(params[:id])
    post.update(post_params)  # Any user can update ANY post!
    render json: PostSerializer.new(post).serializable_hash.to_json
  end

  def destroy
    post = Post.find(params[:id])
    post.destroy  # Any user can delete ANY post!
    head :no_content
  end
end

# Authentication != Authorization
# Authentication: "Who are you?" (Bearer token)
# Authorization:  "Can you do this?" (Pundit policy)`,
		goal: 'Implement Pundit policies so users can only modify their own posts. Use Current.user for request-scoped user access.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'authorization_configured' },
		{ type: 'node_present', nodeType: 'policy' },
		{ type: 'connection', sourceType: 'controller', targetType: 'policy' },
	],
	availableNodes: ['policy'],
	unlockedNodes: ['policy'],
	learningContent: {
		title: 'Authorization with Pundit & Current.user',
		goal: `In this level, you'll learn the difference between authentication ("who are you?") and authorization ("are you allowed to do this?"). You'll implement Pundit policy classes that control which users can update or delete specific records, and scope queries so users only see data they have permission to access.`,
		conceptExplanation: `Authorization answers "Can this user do this action on this resource?"

**Pundit** provides a clean, policy-based pattern:
- One policy class per model
- Each method corresponds to a controller action (\`update?\`, \`destroy?\`)
- Policies are plain Ruby objects -- easy to test
- Scopes filter collections based on user permissions

**Current.user (Rails built-in):**
- Thread-safe, request-scoped attributes
- Set in a \`before_action\`, available everywhere in the request
- Replaces passing \`current_user\` through method arguments

**Authentication vs Authorization:**
- Authentication: "Who are you?" (Level 9)
- Authorization: "Are you allowed to do this?" (This level)`,
		railsCodeExample: `# app/policies/post_policy.rb
class PostPolicy < ApplicationPolicy
  def show?
    true  # Anyone can view published posts
  end

  def create?
    user.present?  # Any authenticated user can create
  end

  def update?
    owner_or_admin?
  end

  def destroy?
    owner_or_admin?
  end

  private

  def owner_or_admin?
    record.user == user || user.admin?
  end

  class Scope < Scope
    def resolve
      if user&.admin?
        scope.all
      else
        scope.where(user: user).or(scope.where(status: "published"))
      end
    end
  end
end

# app/models/current.rb (Rails built-in)
class Current < ActiveSupport::CurrentAttributes
  attribute :user, :session
end

# Set Current.user in authentication concern
module ApiAuthentication
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_user
  end

  private

  def authenticate_user
    authenticate_or_request_with_http_token do |token, _options|
      session = Session.find_by(token: token)
      Current.user = session&.user
    end
  end
end

# app/controllers/api/v1/posts_controller.rb
class Api::V1::PostsController < ApplicationController
  include Pundit::Authorization

  def index
    posts = policy_scope(Post)
    render json: PostSerializer.new(posts).serializable_hash.to_json
  end

  def update
    post = Post.find(params[:id])
    authorize post  # Raises Pundit::NotAuthorizedError if denied
    if post.update(post_params)
      render json: PostSerializer.new(post).serializable_hash.to_json
    else
      render json: { errors: post.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    post = Post.find(params[:id])
    authorize post
    post.destroy
    head :no_content
  end
end

# Handle authorization failures globally
class ApplicationController < ActionController::API
  include Pundit::Authorization

  rescue_from Pundit::NotAuthorizedError do |e|
    render json: { error: "Not authorized" }, status: :forbidden
  end
end`,
		commonMistakes: [
			'Forgetting to call authorize in controller actions (use after_action :verify_authorized)',
			'Checking permissions in the controller instead of the policy',
			'Not scoping index queries with policy_scope (leaking private data)',
			'Confusing authentication (who) with authorization (can)',
			'Not testing policy edge cases (admin vs owner vs stranger)',
		],
		whenToUse:
			'Every action that modifies data or returns user-specific content needs authorization. Add Pundit policies from the start.',
		furtherReading: [
			{
				title: 'Pundit',
				url: 'https://github.com/varvet/pundit',
			},
			{
				title: 'CurrentAttributes',
				url: 'https://api.rubyonrails.org/classes/ActiveSupport/CurrentAttributes.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Policy node connected to the Controller. Pundit policies check whether current_user is allowed to perform each action.',
	},
};

// ============================================
// Level 12: Testing
// ============================================

const level12Testing: Level = {
	id: 'act2-level13-testing',
	actId: 2,
	levelNumber: 13,
	name: 'Testing',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'A deploy broke the login endpoint. Nobody noticed for 3 hours. There are zero tests. The only way to verify anything works is to manually test it.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 220, locked: true },
			{ id: 'auth-node', type: 'authentication', x: 280, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 480, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 680,
				y: 220,
				locked: true,
			},
			{ id: 'policy-node', type: 'policy', x: 680, y: 80, locked: true },
			{
				id: 'post-model',
				type: 'model',
				x: 900,
				y: 220,
				locked: true,
				config: { label: 'Post' },
			},
			{ id: 'database-node', type: 'database', x: 1100, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 680,
				y: 420,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 900, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'auth-node' },
			{ id: 'c2', sourceNodeId: 'auth-node', targetNodeId: 'router-node' },
			{
				id: 'c3',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{
				id: 'c4',
				sourceNodeId: 'controller-node',
				targetNodeId: 'policy-node',
			},
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c6', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{
				id: 'c7',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c8',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'Zero test coverage. Deploys break features silently. The login endpoint was returning 500 for 3 hours and nobody knew until a user complained.',
		rootCause:
			'No automated tests. No CI. Manual testing is the only safety net.',
		codeExample: `# Current state:
# spec/ directory is empty
# No test framework configured
# No factories for creating test data

# The login endpoint broke because someone
# renamed the 'token' column to 'auth_token'
# but forgot to update the sessions controller.

# With a single request spec, this would have
# been caught before deploy:

# spec/requests/api/v1/sessions_spec.rb
RSpec.describe "Sessions API" do
  it "returns a token on valid login" do
    user = create(:user, password: "password123")
    post "/api/v1/sessions", params: { email: user.email, password: "password123" }
    expect(response).to have_http_status(:created)
    expect(json_response["token"]).to be_present
  end
end`,
		goal: 'Set up RSpec and FactoryBot. Write your first request spec for the sessions endpoint.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'testing_configured' },
		{ type: 'node_present', nodeType: 'test' },
		{ type: 'connection', sourceType: 'test', targetType: 'request' },
	],
	availableNodes: ['test'],
	unlockedNodes: ['test'],
	learningContent: {
		title: 'RSpec, FactoryBot & Request Specs',
		goal: `In this level, you'll set up automated testing for your API using RSpec and FactoryBot. You'll write request specs that send real HTTP requests and verify JSON responses, create reusable test data with factories, and learn the testing philosophy that keeps Rails apps reliable as they grow.`,
		conceptExplanation: `Testing is not optional for production applications. RSpec is the Ruby community standard.

**Test types (from most to least valuable for APIs):**
- **Request specs** -- Test the full stack (HTTP in, JSON out). Your primary test type for APIs.
- **Model specs** -- Test validations, scopes, and business logic
- **Policy specs** -- Test authorization rules
- **Service specs** -- Test service objects in isolation

**FactoryBot:** Creates test data with sensible defaults. No more fixtures.

**Testing philosophy:**
- Test behavior, not implementation
- Request specs are your highest-value tests
- One happy path + edge cases per endpoint
- Use \`let\` for lazy-loaded test data
- Use \`before\` for shared setup`,
		railsCodeExample: `# Gemfile
group :development, :test do
  gem "rspec-rails"
  gem "factory_bot_rails"
end

group :test do
  gem "shoulda-matchers"
  gem "database_cleaner-active_record"
end

# Setup:
# rails generate rspec:install

# spec/factories/users.rb
FactoryBot.define do
  factory :user do
    email { Faker::Internet.email }
    password { "password123" }
    username { Faker::Internet.username(specifier: 3..20) }
  end
end

# spec/factories/posts.rb
FactoryBot.define do
  factory :post do
    user
    title { Faker::Lorem.sentence }
    body { Faker::Lorem.paragraphs(number: 3).join("\\n\\n") }
    status { "published" }

    trait :draft do
      status { "draft" }
    end
  end
end

# spec/requests/api/v1/posts_spec.rb
RSpec.describe "Posts API", type: :request do
  let(:user) { create(:user) }
  let(:token) { user.sessions.create!.token }
  let(:headers) { { "Authorization" => "Bearer #{token}" } }

  describe "GET /api/v1/posts" do
    it "returns published posts" do
      create_list(:post, 3, user: user)
      create(:post, :draft, user: user)

      get "/api/v1/posts", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json_response.length).to eq(3)
    end
  end

  describe "POST /api/v1/posts" do
    it "creates a post with valid params" do
      post "/api/v1/posts",
           params: { post: { title: "Hello", body: "World content here" } },
           headers: headers
      expect(response).to have_http_status(:created)
      expect(json_response["title"]).to eq("Hello")
    end

    it "returns 422 with invalid params" do
      post "/api/v1/posts",
           params: { post: { title: "", body: "" } },
           headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["errors"]).to include("Title can't be blank")
    end

    it "returns 401 without authentication" do
      post "/api/v1/posts", params: { post: { title: "Hello", body: "World" } }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /api/v1/posts/:id" do
    it "forbids updating another user's post" do
      other_post = create(:post)  # belongs to another user
      patch "/api/v1/posts/#{other_post.id}",
            params: { post: { title: "Hacked" } },
            headers: headers
      expect(response).to have_http_status(:forbidden)
    end
  end
end

# spec/support/json_helpers.rb
module JsonHelpers
  def json_response
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.include JsonHelpers, type: :request
end`,
		commonMistakes: [
			'Testing implementation details instead of behavior',
			'Not testing error cases (422, 401, 403)',
			'Using fixtures instead of factories (brittle, hard to maintain)',
			'Slow test suite from not using database_cleaner properly',
			'Testing controller internals instead of HTTP request/response',
		],
		whenToUse:
			'Write request specs for every API endpoint. Write model specs for complex validations and scopes. Write policy specs for authorization rules.',
		furtherReading: [
			{
				title: 'RSpec Rails',
				url: 'https://rspec.info/documentation/6.0/rspec-rails/',
			},
			{
				title: 'FactoryBot Getting Started',
				url: 'https://github.com/thoughtbot/factory_bot/blob/main/GETTING_STARTED.md',
			},
			{
				title: 'Better Specs',
				url: 'https://www.betterspecs.org/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Test node that connects to the Request node. Tests send HTTP requests and verify the JSON response, status codes, and side effects.',
	},
};

// ============================================
// Level 13: Security
// ============================================

const level13Security: Level = {
	id: 'act2-level14-security',
	actId: 2,
	levelNumber: 14,
	name: 'Security',
	trigger: {
		type: 'security_audit',
		description:
			'Security audit results are in. No CORS headers (frontend cannot call the API from a browser). API keys hardcoded in source code. Login endpoint has no rate limiting. Strong params are inconsistently applied.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 220, locked: true },
			{ id: 'auth-node', type: 'authentication', x: 280, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 480, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 680,
				y: 220,
				locked: true,
			},
			{ id: 'policy-node', type: 'policy', x: 680, y: 80, locked: true },
			{
				id: 'post-model',
				type: 'model',
				x: 900,
				y: 220,
				locked: true,
				config: { label: 'Post' },
			},
			{ id: 'database-node', type: 'database', x: 1100, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 680,
				y: 420,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 900, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'auth-node' },
			{ id: 'c2', sourceNodeId: 'auth-node', targetNodeId: 'router-node' },
			{
				id: 'c3',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{
				id: 'c4',
				sourceNodeId: 'controller-node',
				targetNodeId: 'policy-node',
			},
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c6', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{
				id: 'c7',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c8',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'Four critical findings: (1) No CORS -- browser requests from the React frontend fail with "blocked by CORS policy." (2) API keys for Stripe and SendGrid are hardcoded in initializers. (3) The login endpoint can be brute-forced with no rate limit. (4) Some controllers accept unfiltered params.',
		rootCause:
			'Security fundamentals were never configured. CORS, credentials, rate limiting, and strong params are all missing or incomplete.',
		codeExample: `# Finding 1: No CORS headers
# Browser console: "Access to XMLHttpRequest has been blocked by CORS policy"
# The React frontend at localhost:3001 cannot talk to the API at localhost:3000

# Finding 2: Hardcoded secrets
# config/initializers/stripe.rb
Stripe.api_key = "sk_live_abc123..."  # In source control!

# Finding 3: No rate limiting on login
# An attacker can try 10,000 passwords per second:
for password in wordlist:
    POST /api/v1/sessions { email: "admin@blog.com", password }

# Finding 4: Unfiltered params
def update
  @post.update(params[:post])  # Mass assignment vulnerability!
  # User could send: { post: { user_id: 999 } } to reassign ownership
end

# Rails 8 has built-in rate_limit:
class SessionsController < ApplicationController
  rate_limit to: 10, within: 3.minutes, only: :create
end`,
		goal: 'Fix all four security findings: configure CORS, move secrets to credentials, add rate limiting, and enforce strong params.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'security_configured' },
		{ type: 'node_present', nodeType: 'cors' },
		{ type: 'node_present', nodeType: 'rate_limiter' },
	],
	availableNodes: ['cors', 'rate_limiter', 'credentials'],
	unlockedNodes: ['cors', 'rate_limiter', 'credentials'],
	learningContent: {
		title: 'API Security: CORS, Credentials, Rate Limiting & Strong Params',
		goal: `In this level, you'll harden your API against common security threats. You'll configure CORS so browsers can safely call your API, move hardcoded secrets into Rails encrypted credentials, and use Rails 8's built-in rate_limit to throttle brute-force attacks on sensitive endpoints like login.`,
		conceptExplanation: `Security is not a feature -- it is a requirement. These four areas are non-negotiable for any production API.

**CORS (Cross-Origin Resource Sharing):**
- Browsers block cross-origin requests by default
- Your API must explicitly allow the frontend origin
- Use the \`rack-cors\` gem to configure allowed origins, methods, and headers

**Rails Encrypted Credentials:**
- \`rails credentials:edit\` opens an encrypted file
- Encrypted with a master key (never committed)
- Safe to commit the encrypted file to git
- Access via \`Rails.application.credentials.dig(:stripe, :api_key)\`

**Rails 8 \`rate_limit\`:**
- Built-in rate limiting -- no gems needed
- \`rate_limit to: 10, within: 3.minutes, only: :create\`
- Returns 429 Too Many Requests when exceeded
- Uses Solid Cache as the backend by default

**Strong Params (\`params.expect\`):**
- Rails 8 replaces \`require/permit\` with \`params.expect\`
- Returns 400 Bad Request instead of 500 on tampered params
- Always whitelist -- never blacklist`,
		railsCodeExample: `# 1. CORS Configuration
# Gemfile
gem "rack-cors"

# config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "https://yourdomain.com", "http://localhost:3001"
    resource "/api/*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options],
      expose: ["Authorization"],
      max_age: 600
  end
end

# 2. Rails Encrypted Credentials
# Edit credentials:
EDITOR=vim bin/rails credentials:edit

# config/credentials.yml.enc (decrypted):
stripe:
  api_key: sk_live_abc123...
  webhook_secret: whsec_xyz...
sendgrid:
  api_key: SG.abc123...

# Access in code:
Stripe.api_key = Rails.application.credentials.dig(:stripe, :api_key)

# 3. Rails 8 Rate Limiting
class Api::V1::SessionsController < ApplicationController
  rate_limit to: 10, within: 3.minutes, only: :create,
             with: -> { render json: { error: "Too many login attempts. Try again later." },
                                status: :too_many_requests }
end

class Api::V1::PostsController < ApplicationController
  rate_limit to: 100, within: 1.minute, only: [:create, :update]
end

# 4. Strong Params with params.expect (Rails 8)
class Api::V1::PostsController < ApplicationController
  private

  def post_params
    # Rails 8: params.expect -- safer than require/permit
    params.expect(post: [:title, :body, :status])
    # If params structure doesn't match, returns 400 (not 500)
    # Rejects unexpected keys like user_id, admin, etc.
  end
end`,
		commonMistakes: [
			'Setting CORS origins to "*" in production (allows any site to call your API)',
			'Committing the master key to git (add config/master.key to .gitignore)',
			'Not rate limiting login/signup endpoints (brute force attacks)',
			'Using params.permit! or params[:post] without filtering (mass assignment)',
			'Forgetting to rate limit password reset and other sensitive endpoints',
		],
		whenToUse:
			'Configure CORS and credentials before your first deploy. Add rate limiting to every endpoint that mutates data. Always use strong params.',
		furtherReading: [
			{
				title: 'Rails Security Guide',
				url: 'https://guides.rubyonrails.org/security.html',
			},
			{
				title: 'rack-cors',
				url: 'https://github.com/cyu/rack-cors',
			},
			{
				title: 'Rails Credentials',
				url: 'https://guides.rubyonrails.org/security.html#custom-credentials',
			},
			{
				title: 'Rails 8 Rate Limiting',
				url: 'https://guides.rubyonrails.org/8_0_release_notes.html',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Add CORS and Rate Limiter nodes to the pipeline. CORS sits at the very front (before auth), and Rate Limiter protects sensitive endpoints like login.',
	},
};

// ============================================
// Level 14: Scopes & Enums
// ============================================

const level14ScopesEnums: Level = {
	id: 'act2-level15-scopes-enums',
	actId: 2,
	levelNumber: 15,
	name: 'Scopes & Enums',
	trigger: {
		type: 'user_complaint',
		description:
			'The API returns ALL posts including drafts and soft-deleted ones. Users need to filter by status. The status field is a plain string with no constraints.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 220, locked: true },
			{ id: 'cors-node', type: 'cors', x: 280, y: 220, locked: true },
			{ id: 'auth-node', type: 'authentication', x: 480, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 680, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 880,
				y: 220,
				locked: true,
			},
			{ id: 'policy-node', type: 'policy', x: 880, y: 80, locked: true },
			{
				id: 'post-model',
				type: 'model',
				x: 1080,
				y: 220,
				locked: true,
				config: { label: 'Post' },
			},
			{ id: 'database-node', type: 'database', x: 1280, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 880,
				y: 420,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 1080, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'cors-node' },
			{ id: 'c2', sourceNodeId: 'cors-node', targetNodeId: 'auth-node' },
			{ id: 'c3', sourceNodeId: 'auth-node', targetNodeId: 'router-node' },
			{
				id: 'c4',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'policy-node',
			},
			{ id: 'c6', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c7', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{
				id: 'c8',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c9',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'GET /api/v1/posts returns everything: published posts, drafts, even archived ones. Users see half-written drafts from other authors. There is no way to filter by status, and the status field accepts any string including typos like "pubished."',
		rootCause:
			'No enum to constrain status values. No scopes to filter posts by status. The controller just does Post.all.',
		codeExample: `# Current state:
class Post < ApplicationRecord
  # status is a plain string column -- accepts anything
end

# In the controller:
def index
  posts = Post.all  # Returns EVERYTHING
  render json: PostSerializer.new(posts).serializable_hash.to_json
end

# Database contains:
# | id | title        | status     |
# |----|------------- |------------|
# | 1  | "Hello"      | "published"|
# | 2  | "Draft WIP"  | "draft"    |
# | 3  | "Old Post"   | "archived" |
# | 4  | "Test"       | "pubished" | <-- typo! No validation.
# | 5  | "Deleted"    | "deleted"  |

# API returns all 5 posts. Users see drafts and deleted posts.
# There's no way to request just published posts.`,
		goal: 'Add an enum for status, define named scopes, and update the controller to support filtering.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'scopes_defined' },
		{ type: 'node_present', nodeType: 'scope' },
		{ type: 'connection', sourceType: 'controller', targetType: 'scope' },
	],
	availableNodes: ['scope'],
	unlockedNodes: ['scope'],
	learningContent: {
		title: 'Enums, Named Scopes & Query Interface',
		goal: `In this level, you'll learn how to constrain and filter your data using enums and named scopes. You'll define an enum for post status so only valid values like draft, published, and archived are allowed, and write chainable scopes that make your queries reusable and expressive across the entire app.`,
		conceptExplanation: `Enums and scopes make your models expressive and your queries safe.

**Rails 8 Enum (new syntax):**
- Defines a fixed set of values for an attribute
- Automatically creates scopes: \`Post.published\`, \`Post.draft\`
- Creates predicate methods: \`post.published?\`, \`post.draft?\`
- Creates bang methods: \`post.published!\` (updates status)
- Backed by integers in the database (fast, indexable)
- Rails 8 uses the hash syntax by default and validates values

**Named Scopes:**
- Encapsulate query logic in the model
- Chainable: \`Post.published.recent.by_author(user)\`
- Reusable across controllers, jobs, and other models
- Default scope sets the "normal" query for a model

**Query Interface:**
- \`where\`, \`order\`, \`limit\`, \`offset\`, \`pluck\`, \`select\`
- All chainable, all lazy (don't execute until needed)
- Use \`to_sql\` to inspect the generated SQL`,
		railsCodeExample: `# app/models/post.rb
class Post < ApplicationRecord
  belongs_to :user

  # Rails 8 enum syntax (hash-based, validates by default)
  enum :status, {
    draft: 0,
    published: 1,
    archived: 2,
    deleted: 3
  }, default: :draft, validate: true

  # Named scopes
  scope :visible, -> { where(status: [:published]) }
  scope :recent, -> { order(created_at: :desc) }
  scope :by_author, ->(user) { where(user: user) }
  scope :created_after, ->(date) { where("created_at >= ?", date) }
  scope :search, ->(query) {
    where("title ILIKE :q OR body ILIKE :q", q: "%#{query}%")
  }

  # Default scope (use sparingly -- affects ALL queries)
  # default_scope { where.not(status: :deleted) }
  # Better: use a scope and apply it explicitly
  scope :not_deleted, -> { where.not(status: :deleted) }
end

# Auto-generated by enum:
Post.draft        # WHERE status = 0
Post.published    # WHERE status = 1
Post.archived     # WHERE status = 2

post.published?   # true/false
post.published!   # UPDATE SET status = 1

# Chaining scopes in the controller:
class Api::V1::PostsController < ApplicationController
  def index
    posts = policy_scope(Post)
              .not_deleted
              .then { |scope| params[:status] ? scope.where(status: params[:status]) : scope.visible }
              .then { |scope| params[:q] ? scope.search(params[:q]) : scope }
              .recent
              .page(params[:page])

    render json: PostSerializer.new(posts).serializable_hash.to_json
  end
end

# Query interface examples:
Post.published.where(user: current_user).count
Post.visible.recent.limit(10).pluck(:title)
Post.where(created_at: 1.week.ago..).order(:title)

# Inspect SQL:
Post.published.recent.to_sql
# => "SELECT \\"posts\\".* FROM \\"posts\\" WHERE \\"posts\\".\\"status\\" = 1 ORDER BY created_at DESC"`,
		commonMistakes: [
			'Using strings instead of enums for status fields (typos, no validation)',
			'Using default_scope (silently affects every query, hard to override)',
			'Not adding a database index on the enum column (slow filtering on large tables)',
			'Complex logic in scopes that should be in a query object',
			'Forgetting that enum values are integers in the DB -- do not change the mapping after data exists',
		],
		whenToUse:
			'Use enums for any field with a fixed set of values (status, role, priority). Use scopes for any query pattern used in more than one place.',
		furtherReading: [
			{
				title: 'ActiveRecord Enum',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Enum.html',
			},
			{
				title: 'Active Record Query Interface',
				url: 'https://guides.rubyonrails.org/active_record_querying.html',
			},
			{
				title: 'ActiveRecord Scopes',
				url: 'https://guides.rubyonrails.org/active_record_querying.html#scopes',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add a Scope node between the Controller and Model. Define an enum for status and scopes for common filters like visible, recent, and by_author.',
	},
};

// ============================================
// Act 2 Definition
// ============================================

export const actTwo: Act = {
	id: 2,
	name: 'Users & Security',
	tagline: 'Real users arrive. Things break.',
	description:
		'Real users start hitting your API. Add authentication with Bearer tokens, validate incoming data, normalize fields, lock down authorization with Pundit, write your first tests, harden security with CORS and rate limiting, and tame your queries with enums and scopes.',
	levels: [
		level8Authentication,
		level9Validations,
		level10Callbacks,
		level11Authorization,
		level12Testing,
		level13Security,
		level14ScopesEnums,
	],
	unlockedNodes: [
		'authentication',
		'validation',
		'callback',
		'policy',
		'test',
		'cors',
		'rate_limiter',
		'credentials',
		'scope',
	],
	metricsVisible: false,
};
