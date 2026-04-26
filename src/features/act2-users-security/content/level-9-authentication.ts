import type { Level } from '@/types';

export const level9Authentication: Level = {
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
				id: 'product-model',
				type: 'model',
				x: 660,
				y: 220,
				locked: true,
				config: { label: 'Product' },
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
			{
				id: 'c3',
				sourceNodeId: 'controller-node',
				targetNodeId: 'product-model',
			},
			{
				id: 'c4',
				sourceNodeId: 'product-model',
				targetNodeId: 'database-node',
			},
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
			'Every endpoint is wide open. GET /api/v1/products, DELETE /api/v1/products/1 -- anyone can do anything.',
		rootCause: 'No authentication layer. No User model. No token verification.',
		codeExample: `# Current state: ZERO authentication
# Anyone can hit any endpoint:
curl -X DELETE /api/v1/products/1   # Deleted! No questions asked.
curl -X POST /api/v1/products       # Created! By who? Nobody knows.

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
		goal: `In this level, you'll:\n- secure your API so every request is tied to a real user.\n- use Rails 8's built-in authentication generator to scaffold user and session models.\n- learn how Rails stores passwords safely using one-way hashing.\n- set up Bearer token authentication so clients can prove who they are on every request.`,
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
- \`User.authenticate_by(email: ..., password: ...)\` returns the user or nil
- Performs constant-time comparison to prevent timing attacks
- Replaces the manual \`find_by + authenticate\` pattern
- Returns nil (not false) on failure -- safe against enumeration

**\`has_secure_password\`:**
- Adds \`password\` and \`password_confirmation\` virtual attributes
- Stores a bcrypt hash in \`password_digest\`
- Provides \`authenticate(password)\` method
- No plaintext passwords ever touch the database

**\`Current\` (who is logged in?):**
- After someone logs in, the rest of your code needs to know who they are. Every controller, every model that checks ownership, every background job
- The clumsy way: pass the user object as an argument into every method that needs it
- The Rails way: the auth generator creates a \`Current\` class. After Rails verifies the Bearer token, it stores the session in \`Current.session\` and the logged-in user in \`Current.user\` — for that one request only
- From there, any controller can just call \`Current.user\` and get the logged-in user. No plumbing
- Each web request gets its own \`Current\`, so when two users hit your API at the same time, they never see each other's data
- This is why you will see \`current_user\` "just work" in every controller from now on. It comes from \`Current\`

**\`allow_unauthenticated_access\` (the login escape hatch):**
- The auth generator wires up an automatic check that runs before every action: "are you logged in?" If not, Rails returns \`401 Unauthorized\`
- That default is exactly what you want for protected endpoints. But it creates a chicken-and-egg problem: how does anyone log in for the first time if logging in requires being logged in?
- \`allow_unauthenticated_access only: [:create]\` is how you opt out. It tells Rails: "the create action on this controller (the login action) is the exception. Anyone can hit it without being authenticated"
- Same idea for signup: put \`allow_unauthenticated_access only: [:new, :create]\` on \`UsersController\` so people can register without already having an account
- Forget this and your login endpoint returns \`401\` before any user can ever log in — the most common Rails 8 auth bug
- The pattern is: block everyone by default, then carve out specific exceptions for the few public endpoints. Much safer than "let everyone through, then remember to lock down every new controller"`,
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
# POST /sessions { email: "...", password: "..." }
# => { "token": "abc123..." }
#
# GET /api/v1/products -H "Authorization: Bearer abc123..."`,
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
