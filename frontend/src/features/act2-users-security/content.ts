/**
 * Act 2: Guards & Gates
 * "Users are signing up. Time to lock it down."
 *
 * Levels 9-15: Authentication, Validations, Callbacks & Normalizations,
 * Authorization, Testing, Strong Params, CORS
 * App context: Blog API (continued from Act 1)
 */

import type { Act, Level } from '@/types';

// ============================================
// Level 9: Authentication
// ============================================

const level9Authentication: Level = {
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
		goal: 'Generate auth scaffolding, run migrations, configure password hashing, and protect endpoints with Bearer token authentication.',
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
		goal: `In this level, you'll:\n- secure your API so every request is tied to a real user.\n- use Rails 8's built-in authentication generator.\n- learn how has_secure_password stores passwords safely with bcrypt.\n- set up Bearer token authentication so clients can prove who they are on every request.`,
		conceptExplanation: `Rails 8 includes a built-in authentication generator, so there is no more Devise dependency for basic auth.

**\`bin/rails generate authentication\`** creates:
- User model with \`has_secure_password\` (bcrypt)
- Session model for managing tokens
- Authentication concern for controllers
- Login/logout controller scaffolding

**API mode with Bearer tokens:**
- Sessions use cookies by default, but APIs need tokens
- Generate a token on login, return it in JSON
- Client sends \`Authorization: Bearer <token>\` on every request
- The Authentication concern's \`require_authentication\` verifies it

**\`authenticate_by\` (Rails 8, timing-safe login):**
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

# app/controllers/concerns/authentication.rb (generated)
module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
  end

  private

  def require_authentication
    session = Session.find_by(
      token: request.headers["Authorization"]
               &.delete_prefix("Bearer ")
    )
    resume_session(session)
  end

  def resume_session(session)
    Current.session = session
  end

  def current_user
    Current.session&.user
  end
end

# app/controllers/sessions_controller.rb
class SessionsController < ApplicationController
  allow_unauthenticated_access only: [:create]

  def create
    # Rails 8: authenticate_by (timing-safe login)
    user = User.authenticate_by(
      email_address: params[:email_address],
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
# POST /sessions { email_address: "...", password: "..." }
# => { "token": "abc123..." }
#
# GET /api/v1/posts -H "Authorization: Bearer abc123..."`,
		commonMistakes: [
			'Using Devise when Rails 8 auth generator is sufficient',
			'Storing plaintext passwords instead of using has_secure_password',
			'Using cookie-based sessions in API-only mode',
			'Not expiring or rotating Bearer tokens',
			'Forgetting allow_unauthenticated_access on login/signup endpoints',
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
		text: 'Click pipeline stages to inspect them and fire API probes to discover the vulnerabilities. Look for missing authentication layers and anonymous access.',
	},
};

// ============================================
// Level 10: Validations
// ============================================

const level10Validations: Level = {
	id: 'act2-level10-validations',
	actId: 2,
	levelNumber: 10,
	name: 'Validations',
	trigger: {
		type: 'user_complaint',
		description:
			'Authentication is live, but users submit empty posts, duplicate emails, and garbage data. The database is filling up with invalid records. Reject bad data before it hits the DB.',
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
  # Nothing here. Accepts anything!
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
		goal: 'Add presence, uniqueness, and format validations to your models, then inspect error messages in the Rails console.',
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
		goal: `In this level, you'll:\n- learn how to reject bad data before it ever reaches the database.\n- add ActiveRecord validations like presence, uniqueness, format, and length to your models.\n- understand when validations run in the lifecycle.\n- return meaningful error messages to API clients.`,
		conceptExplanation: `Validations ensure only valid data gets saved to the database. They run before \`save\`, \`create\`, and \`update\`.

**Built-in validators:**
- \`presence\`: field cannot be blank
- \`uniqueness\`: no duplicate values
- \`format\`: must match a regex
- \`length\`: min/max character count
- \`numericality\`: must be a number
- \`inclusion\`: must be in a list
- \`exclusion\`: must not be in a list

**Custom messages:** Override defaults with \`message:\`
**Custom validators:** Write your own for complex rules
**Conditional validations:** \`if:\` and \`unless:\` options

When validation fails, \`save\` returns \`false\` and errors are added to the model's \`errors\` collection.

For fields with a fixed set of values (status, role, priority), Rails 8 enums (\`enum :status, { draft: 0, published: 1 }\`) provide both validation and query scopes in one declaration.`,
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

# In the controller, return validation errors as JSON:
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
			'Every model that accepts user input needs validations. Add them from the start. Retrofitting is painful.',
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
		text: 'Click the pipeline stages and fire data probes to discover what gets through. Then build presence, uniqueness, and format validations.',
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
		goal: 'Normalize email with Rails 8 normalizes, add an after_create callback for the welcome email, learn the callback lifecycle order, and use after_commit for safe external side effects.',
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
		goal: `In this level, you'll:\n- learn how to automatically clean and transform data before it hits the database.\n- use Rails 8's normalizes to strip whitespace and downcase emails.\n- hook into ActiveRecord lifecycle callbacks like before_validation and after_create.\n- understand why after_commit is the safe choice for external side effects.`,
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
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Normalization/ClassMethods.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Click pipeline stages and fire data probes to discover what is missing. Try signing up with a messy email and checking the mailer queue.',
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
			"Users can authenticate, data is validated, and emails are normalized. But User A can still edit User B's posts. Authentication tells us WHO is making the request, but nothing checks whether they are ALLOWED to do what they are asking.",
	},
	problem: {
		observation:
			'User A logs in and sends DELETE /api/v1/posts/42 -- a post owned by User B. It succeeds. Any authenticated user can modify or destroy any post.',
		rootCause:
			'Authentication verifies identity but there is no authorization layer checking ownership or permissions.',
		codeExample: `# Current state: no authorization
class Api::V1::PostsController < ApplicationController
  def destroy
    post = Post.find(params[:id])
    post.destroy  # Any user can delete ANY post!
    head :no_content
  end
end

# Authentication: "Who are you?" (Bearer token)
# Authorization:  "Can you do this?" (???)
#
# Rails ships authentication (Level 9) but NOT authorization.
# The community standard is Pundit (gem "pundit").
# Pundit gives each model a policy class (PostPolicy),
# where each method maps to a controller action:
#   destroy? -> "Can this user delete this post?"
#   update?  -> "Can this user edit this post?"`,
		goal: 'Install Pundit, include its module in ApplicationController, generate the base policy, then build a PostPolicy and watch it filter requests in real-time.',
		thresholds: {},
	},
	learningContent: {
		title: 'Authorization with Pundit & Current.user',
		goal: `In this level, you'll:\n- learn the difference between authentication ("who are you?") and authorization ("are you allowed to do this?").\n- implement Pundit policy classes that control which users can update or delete specific records.\n- scope queries so users only see data they have permission to access.`,
		conceptExplanation: `Authorization answers "Can this user do this action on this resource?"

**Pundit** provides a clean, policy-based pattern:
- One policy class per model, named by convention: \`Post\` -> \`PostPolicy\`, \`Comment\` -> \`CommentPolicy\`
- When you call \`authorize post\`, Pundit infers \`PostPolicy\` from the record's class and calls the method matching the current action (e.g. \`destroy?\`)
- Each method corresponds to a controller action (\`update?\`, \`destroy?\`)
- Policies are plain Ruby objects, easy to test
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

  class Scope < ApplicationPolicy::Scope
    def resolve
      if user.admin?
        scope.all
      else
        scope.where(published: true)
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
		text: 'Pundit policy classes are named after the model (PostPolicy for Post). Each method matches a controller action.',
	},
};

// ============================================
// Level 13: Testing
// ============================================

const level13Testing: Level = {
	id: 'act2-level13-testing',
	actId: 2,
	levelNumber: 13,
	name: 'Testing',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'A deploy broke the login endpoint. Nobody noticed for 3 hours. Set up RSpec and FactoryBot, then write a request spec to prevent this from happening again.',
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
# but forgot to update the sessions controller:

class Api::V1::SessionsController < ApplicationController
  def create
    user = User.find_by(email: params[:email])
    if user&.authenticate(params[:password])
      session = user.sessions.create!
      render json: { auth_token: session.token },
             status: :created  # session.token => NoMethodError!
    end
  end
end

# A request spec hitting POST /api/v1/sessions
# would have caught this before deploy.`,
		goal: 'Install rspec-rails and factory_bot_rails, configure FactoryBot in RSpec, define a user factory, and write a request spec for the sessions endpoint.',
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
		goal: `In this level, you'll:\n- set up automated testing for your API using RSpec and FactoryBot.\n- write request specs that send real HTTP requests and verify JSON responses.\n- create reusable test data with factories.\n- learn the testing philosophy that keeps Rails apps reliable as they grow.`,
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
		text: 'Start by adding the rspec-rails gem with bundle add, then run the install generator to create the spec directory structure.',
	},
};

// ============================================
// Level 13: Strong Params
// ============================================

const level13StrongParams: Level = {
	id: 'act2-level14-strong-params',
	actId: 2,
	levelNumber: 14,
	name: 'Strong Params',
	trigger: {
		type: 'security_audit',
		description:
			'Your controller uses params.expect, but the whitelist is too broad. A malicious user sends admin: true in the request body and escalates privileges. You need to audit and tighten your parameter filtering.',
	},
	problem: {
		observation:
			'POST /api/v1/posts accepts user_id and admin in the request body. A user can impersonate another author or escalate their own role. The parameter whitelist is too permissive.',
		rootCause:
			'The params.expect whitelist includes sensitive fields alongside safe ones. It filters the shape of the params, but the developer never audited which fields are safe for users to set.',
		codeExample: `# Current state: whitelist is too broad
class Api::V1::PostsController < ApplicationController
  def create
    post = current_user.posts.create!(post_params)
    render json: post, status: :created
  end

  private

  def post_params
    params.expect(post: [:title, :body, :status, :user_id, :admin])
    #                                            ^^^^^^^^  ^^^^^^
    #                                      Impersonation!  Privilege escalation!
  end
end

# What gets through:
# POST /api/v1/posts
# { "post": { "title": "Hello", "user_id": 42, "admin": true } }
# => user_id overwritten, admin flag set!
#
# params.expect filters the SHAPE but not the SAFETY.
# You must audit which fields users are allowed to set.`,
		goal: 'Audit and tighten the params.expect whitelist to only include fields the user is allowed to set. Remove sensitive fields like user_id and admin.',
		thresholds: {},
	},
	learningContent: {
		title: 'Rails 8 Strong Params with params.expect',
		goal: `In this level, you'll:\n- learn how mass assignment attacks work and why a broad whitelist is dangerous.\n- audit your params.expect whitelist to remove sensitive fields.\n- understand the difference between filtering param shape and filtering param safety.\n- apply the principle of least privilege to parameter filtering.`,
		conceptExplanation: `Strong Parameters prevent mass assignment attacks by whitelisting which request params are allowed to reach the model.

**The problem (mass assignment):**
- You set up params.expect in L6, but the whitelist may include sensitive fields
- Fields like user_id, admin, role, balance should never be user-settable
- params.expect filters the shape of the request, but YOU decide which fields are safe

**Auditing your whitelist:**
- Only include fields the user is meant to edit (title, body, status)
- Never include ownership fields (user_id), role fields (admin), or internal state
- Use \`current_user.posts.create!\` to set ownership, not user-submitted params

**Nested params and arrays:**
- \`params.expect(post: [:title, :body, { tags: [] }])\` allows arrays
- \`params.expect(post: [:title, { comments_attributes: [:body] }])\` allows nested
- Each nesting level needs its own whitelist audit`,
		railsCodeExample: `# app/controllers/api/v1/posts_controller.rb
class Api::V1::PostsController < ApplicationController
  def create
    post = current_user.posts.create!(post_params)
    render json: post, status: :created
  end

  def update
    post = current_user.posts.find(params[:id])
    post.update!(post_params)
    render json: post
  end

  private

  # Rails 8: params.expect
  def post_params
    params.expect(post: [:title, :body, :status])
  end
  # Missing :post key -> 400 Bad Request (automatic)
  # Extra params like user_id, admin -> silently ignored
end

# Compared to the older pattern:
# def post_params
#   params.require(:post).permit(:title, :body, :status)
# end
# ^ Raises 500 on missing params unless you add rescue_from

# For nested params:
# params.expect(post: [:title, :body, { tags: [] }])
# params.expect(post: [:title, { comments_attributes: [:body] }])`,
		commonMistakes: [
			'Whitelisting user_id, admin, or role in permitted params (mass assignment)',
			'Using params.permit! which allows everything through',
			'Forgetting to audit nested params for sensitive fields',
			'Setting ownership via params instead of current_user association',
		],
		whenToUse:
			'Every controller action that accepts user input needs strong params. Use params.expect in Rails 8 for stricter, cleaner parameter filtering.',
		furtherReading: [
			{
				title: 'Rails 8 Release Notes (params.expect)',
				url: 'https://guides.rubyonrails.org/8_0_release_notes.html',
			},
			{
				title: 'Action Controller Parameters',
				url: 'https://api.rubyonrails.org/classes/ActionController/Parameters.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Check which fields are in your params.expect whitelist. Remove any field the user should not be able to set directly.',
	},
};

// ============================================
// Level 15: CORS
// ============================================

const level15CORS: Level = {
	id: 'act2-level15-cors',
	actId: 2,
	levelNumber: 15,
	name: 'CORS',
	trigger: {
		type: 'security_audit',
		description:
			'Your API is secured, tested, and ready. Now a React frontend needs to call it from the browser, but cross-origin requests are blocked by default. Configure CORS to open the gate.',
	},
	problem: {
		observation:
			'You have been testing with curl, which bypasses browser security. But when the React frontend at localhost:3001 tries to call the API at localhost:3000, the browser blocks it: "Access to XMLHttpRequest has been blocked by CORS policy."',
		rootCause:
			'curl sends requests directly, so CORS never mattered until now. Browsers enforce the Same-Origin Policy, blocking requests between different origins (ports count). The API must explicitly allow the frontend origin with CORS headers.',
		codeExample: `# Browser console:
# "Access to XMLHttpRequest at 'http://localhost:3000/api/v1/posts'
#  from origin 'http://localhost:3001' has been blocked by CORS policy"

# The React frontend runs on port 3001
# The Rails API runs on port 3000
# Different ports = different origins = blocked by default

# Rails does not configure CORS out of the box.
# You need the rack-cors gem to add CORS middleware.`,
		goal: 'Install the rack-cors gem, configure specific allowed origins (not wildcard), and whitelist the HTTP methods your API uses.',
		thresholds: {},
	},
	learningContent: {
		title: 'Cross-Origin Resource Sharing (CORS)',
		goal: `In this level, you'll:\n- understand why browsers block cross-origin requests by default.\n- install the rack-cors gem and configure allowed origins.\n- learn why wildcard origins are dangerous in production.\n- whitelist specific HTTP methods for your API.`,
		conceptExplanation: `CORS (Cross-Origin Resource Sharing) is a browser security feature that blocks requests from one origin to another unless the server explicitly allows it.

**Why CORS exists:**
- Without CORS, any website could make API calls to your server using the user's cookies
- CORS forces the server to declare which origins are trusted
- The browser checks the CORS headers before allowing the response through

**How it works:**
- Browser sends a "preflight" OPTIONS request to check permissions
- Server responds with Access-Control-Allow-Origin, Allow-Methods, etc.
- If the origin matches, the browser allows the actual request
- If not, the browser blocks it (the request never reaches your code)

**rack-cors gem:**
- Adds CORS middleware at the Rack level (before Rails routing)
- Configure allowed origins, methods, and headers in an initializer
- Never use wildcard (\`"*"\`) in production`,
		railsCodeExample: `# Gemfile
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

# What each option does:
# origins   - which domains can call your API
# resource  - which URL paths the CORS config applies to
# headers   - which request headers are allowed (:any = all)
# methods   - which HTTP methods are allowed
# expose    - which response headers the browser can read
# max_age   - how long (seconds) the browser caches preflight results`,
		commonMistakes: [
			'Setting origins to "*" in production (allows any website to call your API)',
			'Forgetting to include :options in allowed methods (breaks preflight requests)',
			'Not installing rack-cors and trying to set headers manually',
			'Using methods: :any instead of whitelisting specific methods',
		],
		whenToUse:
			'Every Rails API that serves a browser-based frontend (React, Vue, Next.js) needs CORS configuration. curl and mobile apps are not affected by CORS. Set it up when you connect your first browser frontend.',
		furtherReading: [
			{
				title: 'rack-cors',
				url: 'https://github.com/cyu/rack-cors',
			},
			{
				title: 'MDN: Cross-Origin Resource Sharing',
				url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
			},
			{
				title: 'Rails Security Guide',
				url: 'https://guides.rubyonrails.org/security.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Install rack-cors with bundle add, then configure specific origins in config/initializers/cors.rb. Never use wildcard origins in production.',
	},
};

// ============================================
// Act 2 Definition
// ============================================

export const actTwo: Act = {
	id: 2,
	name: 'Guards & Gates',
	tagline: 'Users are signing up. Time to lock it down.',
	description:
		'Your API is live and users are hitting it. But anyone can access anything, bad data is getting through, and there is no protection. Add authentication, validations, authorization, testing, and parameter filtering to make it production-safe, then connect a React frontend.',
	levels: [
		level9Authentication,
		level10Validations,
		level10Callbacks,
		level11Authorization,
		level13Testing,
		level13StrongParams,
		level15CORS,
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
	],
	metricsVisible: false,
};
