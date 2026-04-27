import type { Level } from '@/types';

export const level11Callbacks: Level = {
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
		goal: 'Clean and transform user data automatically before saving, hook into the model lifecycle to trigger side effects, and learn the safe way to call external services from callbacks.',
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
		goal: `In this level, you'll:\n- learn how to automatically clean and transform data before it hits the database.\n- use a declarative approach to normalize attributes like email before save.\n- hook into ActiveRecord lifecycle callbacks to trigger side effects at the right moment.\n- understand which callback is the safe choice for external services like email delivery.`,
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

# app/models/product.rb
class Product < ApplicationRecord
  normalizes :name, with: -> (name) { name.strip }

  before_save :set_listed_at, if: :listing?

  private

  def listing?
    status_changed? && status == "active"
  end

  def set_listed_at
    self.listed_at = Time.current
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
