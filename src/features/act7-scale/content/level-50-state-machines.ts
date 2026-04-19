import type { Level } from '@/types';

export const level50StateMachines: Level = {
	id: 'act7-level50-state-machines',
	actId: 7,
	levelNumber: 50,
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
			question: 'Which state machine approach?',
			options: [
				{
					label: 'Plain enum',
					value: 'enum',
					preview: 'ActiveRecord enum with manual guard methods',
					consequence: 'Simple column-based approach, no transition logic',
					correct: false,
				},
				{
					label: 'AASM',
					value: 'aasm',
					preview: 'Declarative DSL with guards, callbacks, and scopes',
					consequence: 'Adds state machine DSL to ActiveRecord models',
					correct: true,
				},
				{
					label: 'Statesman',
					value: 'statesman',
					preview: 'History-based state machine with audit trail built in',
					consequence: 'Stores full transition history in a separate table',
					correct: false,
				},
			],
		},
	],
	learningContent: {
		title: 'State Machines with AASM',
		goal: `In this level, you'll:\n- learn how to model complex workflows using a state machine library.\n- define valid states and transitions so records can only move through allowed paths.\n- add guards to enforce business rules.\n- trigger side effects on transitions.`,
		conceptExplanation: `State machines formalize which transitions are valid and enforce them at the model level.

**Why not just a string column?**
- No enforcement: any code can set any value
- No callbacks: no hooks for side effects on transition
- No audit: no record of who changed what, when
- No scopes: no easy way to query by state

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
	},
	hint: {
		delay: 20,
		text: 'Use AASM to declare states, events, and guarded transitions. Add PaperTrail for audit.',
	},
};
