import type { Level } from '@/types';

export const level54StateMachines: Level = {
	id: 'act7-level54-state-machines',
	actId: 7,
	levelNumber: 54,
	name: 'State Machines',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'An order went from "shipped" back to "pending". Customer support is flooded. Invalid state transitions are happening because status is just a string column.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Orders have invalid statuses. "shipped" orders are reverting to "pending". No audit trail exists for status changes.',
		rootCause:
			'Order status is a plain string with no transition guards. Any code can set any status at any time.',
		codeExample: `# Current: Status is just a string, no guards
class Order < ApplicationRecord
  # status is a string column: pending, confirmed, shipped, delivered, cancelled

  def ship!
    update!(status: 'shipped')  # No guard. What if status is 'cancelled'?
  end

  def cancel!
    update!(status: 'cancelled')  # Can cancel a delivered order?!
  end
end

# Bugs in production:
order = Order.find(42)
order.status  # => "shipped"
order.update!(status: "pending")  # Oops, no error raised!

# No audit trail:
# Who changed this? When? From what state?`,
		goal: 'Implement a state machine with guarded transitions and an audit trail.',
		thresholds: {},
	},
	successConditions: [{ type: 'state_machine_configured' }],
	availableNodes: ['state_machine'],
	unlockedNodes: ['state_machine'],
	decisionModals: [
		{
			trigger: { sourceType: 'model', targetType: 'state_machine' },
			question:
				'This level teaches AASM. Which approach keeps the state machine on the Order model itself?',
			options: [
				{
					label: 'Plain enum',
					value: 'enum',
					preview: 'ActiveRecord enum with manual guard methods',
					consequence:
						'Names the legal values but enforces no transition rules or guards, which is exactly the gap this level closes',
					correct: false,
				},
				{
					label: 'AASM',
					value: 'aasm',
					preview:
						'Declarative DSL declared inline on the model, with guards, callbacks, and scopes',
					consequence:
						'Keeps states, events, and guards on the Order model: the lightest fit for one model at this scale',
					correct: true,
				},
				{
					label: 'Statesman',
					value: 'statesman',
					preview:
						'Also a solid state machine (guards, and a persisted transition history via its ActiveRecord adapter)',
					consequence:
						'Moves the machine into a separate class and a transitions table: a heavier setup, better when you need many machines or a first-class history model',
					correct: false,
				},
			],
		},
	],
	learningContent: {
		title: 'State Machines with AASM',
		goal: `In this level, you'll:\n- learn how to model complex workflows using a state machine library.\n- define valid states and transitions so records can only move through allowed paths.\n- add guards to enforce business rules.\n- trigger side effects on transitions.`,
		conceptExplanation: `State machines formalize which transitions are valid and enforce them at the model level.

**The ladder: string -> enum -> state machine.** Order.status today is a bare string: any code can write any value, and nothing records the change. The middle rung is Active Record's \`enum\`, which the app has used on Product.status since the modeling work:

\`enum :status, { pending: "pending", confirmed: "confirmed", shipped: "shipped" }\`

An enum names the legal VALUES and gives you a lot for free: predicate methods (\`order.pending?\`), bang setters (\`order.confirmed!\`), and scopes (\`Order.shipped\`). Always use string-encoded values (as above), never integers: \`status: 1\` in a database dump means nothing, and reordering integer values corrupts production data.

**What an enum still cannot do** (and why this level exists):
- No transition rules: \`order.pending!\` happily un-ships a delivered order
- No guards: nothing requires a tracking number before shipping
- No transition callbacks: no hook that fires exactly when confirmed becomes shipped
- No audit: no record of who changed what, when

An enum protects the SET of values; a state machine protects the PATHS between them.

**AASM provides:**
- Declarative state/event/transition DSL
- Guards (conditions that must be true before transitioning)
- Callbacks (after_enter, before_exit, etc.)
- Automatic scopes (Order.shipped, Order.pending)
- Bang methods raise on invalid transition`,
		railsCodeExample: `# Gemfile
gem 'aasm'

# app/models/order.rb
class Order < ApplicationRecord
  include AASM

  aasm column: :status do
    state :pending, initial: true
    state :confirmed, :shipped, :delivered, :cancelled

    event :confirm do
      transitions from: :pending, to: :confirmed,
                  guard: :payment_received?
    end

    event :ship do
      transitions from: :confirmed, to: :shipped,
                  after: :notify_customer
    end

    event :deliver do
      transitions from: :shipped, to: :delivered,
                  after: :complete_fulfillment
    end

    event :cancel do
      transitions from: [:pending, :confirmed], to: :cancelled,
                  after: :process_refund
      # Cannot cancel shipped or delivered orders!
    end
  end

  # Scopes generated automatically:
  # Order.pending, Order.confirmed, Order.shipped, etc.

  private

  def payment_received?
    payments.where(status: 'completed').exists?
  end

  def notify_customer
    OrderMailer.shipped(self).deliver_later
  end

  def process_refund
    RefundJob.perform_later(id) if confirmed?
  end
end

# Audit trail with PaperTrail
class Order < ApplicationRecord
  has_paper_trail only: [:status]
end

# Usage:
order = Order.create!
order.confirm!          # Works if payment_received?
order.ship!             # Works: transitions confirmed -> shipped
order.cancel!           # Raises AASM::InvalidTransition!
                        # Cannot cancel a shipped order

# Query by state:
Order.pending.count     # SELECT COUNT(*) FROM orders WHERE status = 'pending'`,
		commonMistakes: [
			'Using a plain string column without transition guards',
			'Forgetting to add guard clauses for business rules',
			'Not logging state transitions for audit purposes',
			'Allowing direct status column updates that bypass the state machine',
		],
		whenToUse:
			'Whenever a model has a status/state field with specific valid transitions.',
		furtherReading: [
			{
				title: 'AASM Gem',
				url: 'https://github.com/aasm/aasm',
			},
			{
				title: 'Statesman Gem',
				url: 'https://github.com/gocardless/statesman',
			},
		],
		homework: [
			{
				task: 'Replace the bare status writes on Order with a state machine: install AASM, declare pending, confirmed, shipped, delivered, and cancelled states on the status column, and only allow cancel from pending or confirmed.',
				commands: ['bundle add aasm'],
				verify:
					'In the console, order.ship! on a confirmed order works, but order.cancel! on a shipped order raises AASM::InvalidTransition.',
			},
			{
				task: 'Add the audit trail: wire has_paper_trail only: [:status] onto Order. PaperTrail is already in your Gemfile from the earlier audit work; do not reinstall it.',
				verify:
					'After confirm! and ship!, order.versions shows one entry per status change with timestamps, answering who changed what and when.',
			},
			{
				task: 'Add a guard: the confirm event may only fire when payment_received? is true.',
				verify:
					'confirm! on an unpaid order raises AASM::InvalidTransition, and succeeds once a completed payment exists for it.',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Rails models do not ship a state machine. A long-standing Ruby gem adds the DSL: declare valid states, declare named transitions, declare guards on each transition. The auditing -- "who changed which state when" -- comes from a different gem you wire into the same model.',
	},
};
