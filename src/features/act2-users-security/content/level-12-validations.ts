import type { Level } from '@/types';

export const level12Validations: Level = {
	id: 'act2-level12-validations',
	actId: 2,
	levelNumber: 12,
	name: 'Validations',
	trigger: {
		type: 'user_complaint',
		description:
			'Authentication is live, but users submit products with missing names and blank descriptions, and duplicate or malformed emails. The database is filling up with invalid records. Reject bad data before it hits the DB.',
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
				id: 'product-model',
				type: 'model',
				x: 880,
				y: 220,
				locked: true,
				config: { label: 'Product' },
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
			{
				id: 'c4',
				sourceNodeId: 'controller-node',
				targetNodeId: 'product-model',
			},
			{
				id: 'c5',
				sourceNodeId: 'product-model',
				targetNodeId: 'database-node',
			},
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
			'The database contains products with blank names and empty descriptions, plus users with duplicate and malformed emails. No data integrity.',
		rootCause:
			'No model validations. Data flows straight through to the database without any checks.',
		codeExample: `# Current state: NO validations
class Product < ApplicationRecord
  # Nothing here. Accepts anything!
end

class User < ApplicationRecord
  has_secure_password
  # No email_address uniqueness or format check!
end

# What gets through:
Product.create(name: "", description: "")   # Saved! Blank name and description.
User.create(email_address: "not-an-email")  # Saved! Invalid email format.
User.create(email_address: "joe@test.com")  # Saved!
User.create(email_address: "joe@test.com")  # RecordNotUnique raised; client sees a 500.

# The database is full of garbage.`,
		goal: 'Reject the bad data at the model layer before it ever reaches the database, then inspect the resulting error messages from the Rails console.',
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
		goal: `In this level, you'll:\n- learn how to reject bad data at the model layer before it ever reaches the database.\n- pick the right built-in ActiveRecord validator for each kind of failure (blank field, duplicate value, malformed string).\n- understand when validations run in the record lifecycle.\n- return meaningful error messages to API clients.`,
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

**Where the error messages come from (\`I18n\`):**
- When a validation fails, you get \`product.errors.full_messages\` like \`["Name can't be blank", "Price must be greater than 0"]\`. Where do those English strings actually live?
- Rails ships an internationalization framework called **I18n**. Every built-in validator has a default message stored as a translation key (\`errors.messages.blank\`, \`errors.messages.taken\`, \`errors.messages.invalid\`)
- The default English translations live inside Rails itself, in the \`activemodel\` gem at \`activemodel/lib/active_model/locale/en.yml\` (and \`activerecord/lib/active_record/locale/en.yml\`), per the [Rails i18n guide](https://guides.rubyonrails.org/i18n.html). Your app's own \`config/locales/en.yml\` is where you override or add strings. Rails 8 ships English by default; other languages are gem-based (\`gem "rails-i18n"\`)
- To customize a message: \`validates :name, presence: { message: "is required" }\`. To translate the entire app: add \`config/locales/es.yml\` (or \`fr.yml\`, \`ja.yml\`) with translated keys, then set \`I18n.locale = :es\` per request
- For an English-only app, you still benefit: \`I18n.t("errors.messages.blank")\` is the canonical way to access these strings in mailers, controllers, anywhere outside the model. Hardcoding strings in code makes them harder to update and translate later
- Even API-only apps that never plan to translate should know I18n exists. The default messages your validators produce **are** I18n strings. The \`t()\` helper is the path to clean copy management`,
		railsCodeExample: `# app/models/product.rb
class Product < ApplicationRecord
  belongs_to :user

  validates :name, presence: true,
                   length: { minimum: 3, maximum: 255 }
  validates :description, presence: true,
                          length: { minimum: 10, message: "is too short (minimum 10 characters)" }
  validates :price, presence: true,
                    numericality: { greater_than: 0 }
end

# app/models/user.rb
class User < ApplicationRecord
  has_secure_password

  validates :email_address, presence: true,
                    uniqueness: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP,
                              message: "must be a valid email address" }
end

# In the controller, return validation errors as JSON:
def create
  product = Current.user.products.build(params[:product].to_unsafe_h)
  if product.save
    render json: ProductSerializer.new(product).serializable_hash.to_json, status: :created
  else
    render json: { errors: product.errors.full_messages }, status: :unprocessable_entity
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

class Product < ApplicationRecord
  validates :name, no_profanity: true
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
		homework: [
			{
				task: 'Add validations to Product in your store_api app: name present with a sensible length range, description present, price present and numerically greater than zero. Then try to save garbage from the console.',
				commands: ['bin/rails console', 'Product.create(name: "", price: nil)'],
				verify:
					'The create returns an unsaved record, and errors.full_messages lists one readable message per broken rule.',
			},
			{
				task: 'Protect User the same way: email_address present, unique (case insensitive), and matching URI::MailTo::EMAIL_REGEXP. Try to create a duplicate account in the console.',
				commands: ['bin/rails console'],
				verify:
					'The second user with the same email_address fails validation with "has already been taken" instead of raising RecordNotUnique from the database.',
			},
			{
				task: 'Return validation failures to API clients as structured JSON instead of a 500. Curl a bad create with your Bearer token.',
				commands: [
					'curl -X POST http://localhost:3000/api/v1/products -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d \'{"product":{"name":""}}\'',
				],
				verify:
					'The response status is 422 Unprocessable Entity and the body contains an errors array of readable messages.',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Click the pipeline stages and fire data probes to discover what gets through. Each kind of bad data (blank field, duplicate value, malformed string) needs its own kind of model-level check. Look at the built-in ActiveRecord validators list and pick the one that fits the failure mode.',
	},
};
