import type { Level } from '@/types';

export const level15Callbacks: Level = {
	id: 'act3-level15-callbacks',
	actId: 3,
	levelNumber: 15,
	name: 'Callbacks & Normalizations',
	trigger: {
		type: 'incident',
		description:
			'Sellers submit product names with extra whitespace, so buyers cannot find listings on the storefront. New users sign up but receive no welcome email and create duplicate accounts. Both failures point at the same question: what does the model lifecycle belong to, and what does it not?',
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
			'A seller submits "  Ceramic Mug  " (with whitespace) and the row stores it dirty. A buyer searches the storefront for "Ceramic Mug" and finds zero results, even though the listing exists. Separately, new users sign up but never receive a welcome email, so they assume the form was broken and sign up again with a different address. One failure is data that should have been cleaned by the model. The other is a side effect that should NOT have lived in the model.',
		rootCause:
			'No data normalization on Product writes or finder queries. The signup controller never triggers a welcome email after a successful save.',
		codeExample: `# Current state: raw data goes straight to DB
class Product < ApplicationRecord
  belongs_to :user
  validates :name, presence: true, length: { minimum: 3, maximum: 255 }
  validates :description, presence: true, length: { minimum: 10 }
  validates :price, presence: true, numericality: { greater_than: 0 }
end

# What happens:
Product.create!(name: "  Ceramic Mug  ", ...)
# => Stored as "  Ceramic Mug  "

Product.find_by(name: "Ceramic Mug")
# => nil  (whitespace mismatch)

# Also: no welcome email is sent after signup.
# UsersController#create does User.new + save and that's it.

# Rails 8 has a clean way to handle data cleaning
# (a declarative model API that runs on writes AND
# reads). And there is a clear answer to "where do
# after-save side effects belong" -- not in the model.`,
		goal: "Clean and transform the product name automatically before saving, and find the right place for follow-up actions like welcome emails so they are explicit, fast, and don't fire in every test.",
		thresholds: {},
	},
	successConditions: [{ type: 'callbacks_configured' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Callbacks: Normalization vs Side Effects',
		goal: `In this level, you'll:\n- automatically clean and transform product names before they hit the database, on both writes and reads.\n- find the right place for after-save side effects so the model stays simple and tests stay fast.`,
		conceptExplanation: `**The rule: callbacks are for normalization. Side effects belong elsewhere.**

**What callbacks ARE for: deterministic shaping of attributes.**

Rails 8's \`normalizes\` is a declarative API that cleans values BOTH on write and on finder queries. Use it for stripping whitespace and other deterministic shaping. It replaces the older \`before_save :strip_whitespace\` recipe, which only ran on writes (so a lookup with a clean value still missed a dirty stored row). The User model already uses this for \`email_address\` (the auth generator added it back in level 9). Now Product needs the same treatment for the seller-submitted name.

Other callback macros in the same family: \`before_validation\` and \`after_initialize\`. They are all fine when the work is normalization-only.

**What callbacks are NOT for: contextual side effects.**

A side effect is "contextual" when it depends on _why_ the record was saved, not the fact that it was saved. Welcome emails fire on signup but not on profile edit. A loyalty-points credit fires on order completion but not on order edit. Hiding these in callbacks (\`after_create :send_welcome_email\`) means:

- every test that creates a user fires real mail
- every seed file does too
- the trigger gets buried inside the model, invisible to the controller that called \`@user.save\`
- the model becomes untestable in isolation

The fix is to call mailers and external services **explicitly**, from the controller, or from a service the controller calls, so the trigger sits next to the action that caused it.`,
		railsCodeExample: `# app/models/user.rb -- normalization is fine in the model
# (the auth generator already added this in level 9)
class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy
  has_many :products, dependent: :destroy

  # 'normalizes' applies on write AND on finder queries
  normalizes :email_address, with: ->(e) { e.strip.downcase }

  encrypts :email_address, deterministic: true, downcase: true
  encrypts :phone, deterministic: true
  encrypts :address

  validates :email_address,
    presence: true,
    uniqueness: { case_sensitive: false },
    format: { with: URI::MailTo::EMAIL_REGEXP }
end

# app/models/product.rb -- declarative normalization
class Product < ApplicationRecord
  belongs_to :user
  has_many :reviews, dependent: :destroy

  # Same pattern that User uses for email_address
  normalizes :name, with: ->(n) { n.strip }

  validates :name, presence: true, length: { minimum: 3, maximum: 255 }
  validates :description, presence: true, length: { minimum: 10 }
  validates :price, presence: true, numericality: { greater_than: 0 }
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

# normalizes also applies on the read side:
Product.find_by(name: "  Ceramic Mug  ")
# => Rails normalizes the query value too. Match found.`,
		commonMistakes: [
			'Putting side effects (notifications, audit writes, related-record creation) inside model callbacks. Test runs and seed scripts then fire the side effect every time, and the trigger is invisible to the controller that called save.',
			'Using `before_save` for normalization. It only runs on writes, so finder queries against the dirty stored value still miss.',
			'Switching `after_create` to `after_commit` and assuming the testability problem goes away. It does not -- the side effect still fires in every test and seed run.',
		],
		whenToUse:
			'Use `normalizes` for declarative data cleaning. For after-save side effects (mailers, third-party calls, related-record writes), call them from the controller or from a service the controller calls, not from model callbacks.',
		furtherReading: [
			{
				title: 'Rails 8 normalizes',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Normalization/ClassMethods.html',
			},
			{
				title: 'Active Record Callbacks (when they ARE appropriate)',
				url: 'https://guides.rubyonrails.org/active_record_callbacks.html',
			},
		],
		homework: [
			{
				task: 'Add normalizes to the Product name in your store_api app (strip the whitespace), then prove it applies on both writes and finder queries: create a product with a padded name from the console, then look it up with the padded value.',
				commands: ['bin/rails console'],
				verify:
					'The stored name is "Ceramic Mug" with no surrounding whitespace, and Product.find_by(name: "  Ceramic Mug  ") still returns the row because the query value is normalized too.',
			},
			{
				task: 'Audit your models for side effects hiding in lifecycle callbacks: after_create or after_commit hooks that send mail, call external services, or create related records. Move each one into the controller action, next to the save that triggered it.',
				commands: ['grep -RE "after_(create|commit|save)" app/models'],
				verify:
					'Any callbacks that remain are pure normalization; creating a record from the console fires no emails and no external calls.',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Fire each customer impact probe and watch what shows up on the dashboard. Each probe paints a different customer-facing failure.',
	},
};
