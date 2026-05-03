import type { Level } from '@/types';

export const level15Callbacks: Level = {
	id: 'act3-level15-callbacks',
	actId: 3,
	levelNumber: 15,
	name: 'Callbacks & Normalizations',
	trigger: {
		type: 'incident',
		description:
			'Emails are stored as " JOE@GMAIL.COM " with extra whitespace and mixed case. User lookups fail because find_by(email:) is case-sensitive. New users sign up but receive no welcome email. Products have no way to track whether they are draft, listed, or sold.',
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
				id: 'product-model',
				type: 'model',
				x: 900,
				y: 360,
				locked: true,
				config: { label: 'Product' },
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
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'product-model',
			},
			{ id: 'c6', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{
				id: 'c7',
				sourceNodeId: 'product-model',
				targetNodeId: 'database-node',
			},
		],
	},
	problem: {
		observation:
			'User.find_by(email: "joe@gmail.com") returns nil even though the user exists. The DB has " JOE@GMAIL.COM " stored. New users sign up but never receive a welcome email. Products have no status field to distinguish draft listings from active ones.',
		rootCause:
			'No data normalization before save. The signup controller never triggers a welcome email. The Product model has no fixed-set status attribute.',
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
# The signup controller does User.create(...) and that's it.

# And Product has no status field --
# we cannot tell drafts from listed from sold.

# Rails 8 has clean ways to handle each of these
# patterns: declarative data cleaning, a fixed-set
# status attribute, and a place for after-save side
# effects that does not bury them in the model.`,
		goal: "Clean and transform user data automatically before saving, give Product a fixed-set lifecycle attribute, and find the right place for follow-up actions like welcome emails and third-party sync so they are explicit, fast, and don't fire in every test.",
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
		title: 'Normalization, Enums, and Where Side Effects Belong',
		goal: `In this level, you'll:\n- automatically clean and transform user input before it hits the database.\n- give a model a fixed-set attribute (draft / listed / sold) the database can validate.\n- find the right place for after-save side effects so the model stays simple and tests stay fast.`,
		conceptExplanation: `**Two jobs the model SHOULD do:**

1. **Normalization**, Rails 8's \`normalizes\` is a declarative API that cleans values BOTH on write and on finder queries. Use it for stripping whitespace, downcasing, and other deterministic shaping of attributes. Replaces the older \`before_save :downcase_email\` recipe, which only ran on writes (so a lookup with a clean value still missed a dirty stored row).

2. **Fixed-set attributes**, when an attribute is one-of-a-fixed-set (draft / listed / sold, draft / published / archived, queued / running / done), use \`enum\` with **string-encoded** values: \`enum :status, draft: "draft", listed: "listed", sold: "sold"\`. The string keys ARE the database values, so a row dump reads as \`status: "listed"\` instead of \`status: 1\`. You also get \`product.listed?\`, \`product.listed!\`, and the scope \`Product.listed\` for free.

**One job the model should NOT do: contextual side effects.**

A side effect is "contextual" when it depends on _why_ the record was saved, not the fact that it was saved. Welcome emails fire on signup but not on profile edit. CRM sync fires when a user is first created in production but not when fixtures load in CI. Hiding these in callbacks (\`after_create :send_welcome_email\`) means:

- every test that creates a user fires real mail
- every seed file does too
- the trigger gets buried inside the model, invisible to the controller that called \`@user.save\`
- the model becomes untestable in isolation

The fix is to call mailers and jobs **explicitly**, from the controller, or from a service the controller calls, so the trigger sits next to the action that caused it.`,
		railsCodeExample: `# app/models/user.rb -- normalization in callbacks IS fine
class User < ApplicationRecord
  has_secure_password

  # 'normalizes' applies on write AND on finder queries
  normalizes :email, with: -> e { e.strip.downcase }

  validates :email, presence: true, uniqueness: true
end

# app/models/product.rb -- string-encoded enum
class Product < ApplicationRecord
  belongs_to :seller, class_name: "User"
  validates :name, :price_cents, presence: true

  # String-encoded so the DB column reads as
  # "draft", "listed", "sold" (not 0, 1, 2)
  enum :status, draft: "draft",
                listed: "listed",
                sold: "sold"
end

# app/controllers/users_controller.rb
# Side effect lives next to the controller line that
# triggered it. Test runs and seeds skip it for free.
class UsersController < ApplicationController
  allow_unauthenticated_access only: :create

  def create
    @user = User.new(user_params)
    if @user.save
      send_welcome_email(@user)
      render json: @user, status: :created
    else
      render json: { errors: @user.errors }, status: :unprocessable_entity
    end
  end
end

# app/controllers/products_controller.rb
# Third-party sync stays alongside the controller line
# that triggered it. Whether it ends up async (a job)
# or sync (a direct HTTP call) is an implementation
# detail you'll wire up in later levels.
class ProductsController < ApplicationController
  before_action :require_authentication

  def mark_sold
    @product = Current.user.products.find(params[:id])
    @product.update!(status: "sold")
    sync_to_accounting(@product.id)
    render json: @product
  end
end

# normalizes also applies on the read side:
User.find_by(email: "  JOE@GMAIL.COM  ")
# => Rails normalizes the query value too. Match found.`,
		commonMistakes: [
			'Putting side effects (notifications, external syncs, audit writes) inside model callbacks. Test runs and seed scripts then fire the side effect every time, and the trigger is invisible to the controller that called save.',
			'Integer-encoded enums (`enum :status, draft: 0, listed: 1`) -- unreadable in DB dumps, dangerous to reorder in production.',
			'Using `before_save` for normalization. It only runs on writes, so finder queries against the dirty stored value still miss.',
			'Calling slow external services synchronously during a save -- whether from a callback or from the controller. Move slow calls to async machinery (you will see Rails background jobs in a later level).',
		],
		whenToUse:
			'Use `normalizes` for declarative data cleaning. Use `enum` with string-encoded values for any fixed-set attribute. For after-save side effects, call them from the controller (or a service the controller calls), not from model callbacks.',
		furtherReading: [
			{
				title: 'Rails 8 normalizes',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Normalization/ClassMethods.html',
			},
			{
				title: 'ActiveRecord::Enum',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Enum.html',
			},
			{
				title: 'Active Record Callbacks (when they ARE appropriate)',
				url: 'https://guides.rubyonrails.org/active_record_callbacks.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Click each zone in the data flow lane and fire each probe to surface what is missing. Watch what happens (or does not happen) after a save.',
	},
};
