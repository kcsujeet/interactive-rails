import type { Level } from '@/types';

export const level56DomainEvents: Level = {
	id: 'act7-level56-domain-events',
	actId: 7,
	levelNumber: 56,
	name: 'Domain Events & Decoupling',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'The checkout service directly calls Email, Inventory, Analytics, and Shipping. One slow service blocks the entire order. A failure in email prevents shipping from running. Adding a new service means modifying checkout.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Checkout directly calls four services in sequence. If the email service is down, inventory reservation and shipping never run. A bug in one subsystem breaks unrelated subsystems.',
		rootCause:
			'Services are tightly coupled through synchronous, sequential method calls. Each service directly calls the next, creating a failure cascade.',
		codeExample: `# Current: Tight coupling, failure cascades
class CheckoutService
  def call(order)
    order.complete!

    # Direct coupling: if ANY of these fail, the rest never run
    EmailService.send_receipt(order)           # Raises if email server is down!
    InventoryService.reserve_items(order)      # Never runs if email fails!
    AnalyticsService.track_purchase(order)     # Never runs if inventory fails!
    ShippingService.schedule_delivery(order)   # Never runs if analytics fails!
  rescue => e
    # One failure blocks everything downstream
    raise  # The whole checkout fails
  end
end

# Problem: Email failure prevents shipping from running
# Problem: Every new service means modifying CheckoutService
# Problem: Cannot test CheckoutService without mocking 4 services`,
		goal: 'Decouple services using domain events and pub/sub so failures are isolated and services process in parallel.',
		thresholds: {},
	},
	successConditions: [{ type: 'domain_events_configured' }],
	availableNodes: ['event_bus', 'message_queue'],
	unlockedNodes: ['event_bus'],
	learningContent: {
		title: 'Domain Events & Event-Driven Architecture',
		goal: `In this level, you'll:\n- learn how domain events decouple modules so they can communicate without depending on each other directly.\n- publish events when important things happen (like OrderPlaced).\n- subscribe to events from other modules.\n- keep publishers and subscribers completely independent so changes in one don't break the other.`,
		conceptExplanation: `Domain events decouple producers from consumers.

**Without domain events (tight coupling, failure cascade):**
\`\`\`
CheckoutService.call(order):
  1. order.complete! ✓
  2. EmailService.send_receipt(order) ✗ ← Email server down!
  3. InventoryService.reserve(order) NEVER RUNS
  4. AnalyticsService.track(order) NEVER RUNS
  5. ShippingService.schedule(order) NEVER RUNS
Result: Order completed but nothing else happened. Sequential = slow.
\`\`\`

**With domain events (isolated failures, parallel processing):**
\`\`\`
CheckoutService.call(order):
  1. order.complete! ✓
  2. publish OrderCompleted event ← Return immediately
Subscribers (independent, parallel):
  - EmailSubscriber: ✗ (email down) → retries later
  - InventorySubscriber: ✓ (reserved items)
  - AnalyticsSubscriber: ✓ (tracked purchase)
  - ShippingSubscriber: ✓ (scheduled delivery)
Result: 3 out of 4 succeed. Email retries independently.
\`\`\`

**The principle:** A service publishes an event describing what happened. Other services subscribe and react independently. If a subscriber fails, it does not affect the publisher or other subscribers.

**Benefits:**
- Failure isolation: email failure does not block inventory or shipping
- Parallel processing: all subscribers run concurrently, not sequentially
- Open/closed: add new subscribers without modifying the publisher
- Testability: test each service in isolation
- Audit trail: events are a log of everything that happened

**Progression, Wisper to Karafka:**

**In-process (Wisper):** Events stay within the Rails process. Simple, no infrastructure. Best for decoupling within a monolith.

**Out-of-process (Karafka + Kafka):** Events published to Kafka topics, consumed by independent worker processes. Guaranteed delivery, replay, and ordering. Choose when subscribers live in separate services.
- Producing: \`Karafka.producer.produce_sync(topic: 'payments', payload: {...}.to_json)\`
- Consuming: \`class PaymentsConsumer < ApplicationConsumer; def consume; messages.each { |msg| process(msg) }; end; end\`
- Routing: \`topic :payments do; consumer PaymentsConsumer; end\`
- Karafka Web dashboard at \`/karafka\` for monitoring

**Hybrid:** Publish in-process with Wisper, fan out to Sidekiq jobs. Good middle ground before Kafka.

**Monolith philosophy:** "Stick with a monolith for as long as possible (and no longer)." Jason Warner (CTO GitHub): "One of the biggest architectural mistakes of the past decade was going full microservice."`,
		railsCodeExample: `# Using Wisper for in-process domain events
# Gemfile
gem 'wisper'
gem 'wisper-sidekiq'  # async subscribers

# app/events/order_completed_event.rb
class OrderCompletedEvent
  include Wisper::Publisher

  def initialize(order)
    @order = order
  end

  def call
    broadcast(:order_completed, @order)
  end
end

# app/services/checkout_service.rb
class CheckoutService
  def call(order)
    order.complete!

    # Publish event, does NOT call subscribers directly
    OrderCompletedEvent.new(order).call
    # That's it! No direct dependencies on Email, Inventory, etc.
  end
end

# app/subscribers/email_subscriber.rb
class EmailSubscriber
  def order_completed(order)
    OrderMailer.receipt(order).deliver_later
  end
end

# app/subscribers/inventory_subscriber.rb
class InventorySubscriber
  def order_completed(order)
    ReserveInventoryJob.perform_later(order.id)
  end
end

# app/subscribers/analytics_subscriber.rb
class AnalyticsSubscriber
  def order_completed(order)
    TrackPurchaseJob.perform_later(order.id)
  end
end

# app/subscribers/shipping_subscriber.rb
class ShippingSubscriber
  def order_completed(order)
    ScheduleDeliveryJob.perform_later(order.id)
  end
end

# config/initializers/event_subscriptions.rb
Rails.application.config.after_initialize do
  OrderCompletedEvent.subscribe(EmailSubscriber.new)
  OrderCompletedEvent.subscribe(InventorySubscriber.new)
  OrderCompletedEvent.subscribe(AnalyticsSubscriber.new)
  OrderCompletedEvent.subscribe(ShippingSubscriber.new)
  # Add new subscribers here. CheckoutService never changes!
end

# Async subscribers with Wisper-Sidekiq
OrderCompletedEvent.subscribe(EmailSubscriber, async: true)

# Testing in isolation:
RSpec.describe CheckoutService do
  it 'publishes order_completed event' do
    events = spy('events')
    allow(OrderCompletedEvent).to receive(:new).and_return(events)
    allow(events).to receive(:call)

    CheckoutService.new.call(order)

    expect(events).to have_received(:call)
    # No need to mock EmailService, InventoryService, etc.
  end
end`,
		commonMistakes: [
			'Publishing events inside a transaction (event fires but transaction rolls back)',
			'Not handling subscriber failures (one bad subscriber breaks all)',
			'Events that are too fine-grained (event storm)',
			'Circular event chains (A publishes event, B handles it and publishes event that triggers A)',
		],
		whenToUse:
			'When multiple subsystems need to react to the same business event independently.',
		furtherReading: [
			{
				title: 'Wisper Gem',
				url: 'https://github.com/krisleech/wisper',
			},
			{
				title: 'Karafka (Kafka for Ruby/Rails)',
				url: 'https://karafka.io/',
			},
			{
				title: 'Domain Events in Rails (Arkency)',
				url: 'https://blog.arkency.com/domain-events-over-active-record-callbacks/',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 6: Kafka + Karafka',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
		homework: [
			{
				task: 'Decouple one side effect: install Wisper, create an OrderCompletedEvent publisher, and move your receipt email into an EmailSubscriber that reacts to the event instead of being called directly.',
				commands: ['bundle add wisper'],
				verify:
					'Completing an order in the console broadcasts order_completed and the subscriber enqueues the receipt mail, with the checkout code no longer referencing the mailer.',
			},
			{
				task: 'Prove the open/closed benefit: add a second subscriber (an AnalyticsSubscriber that logs the purchase) in the initializer, without editing the publisher or the checkout service.',
				commands: ['git diff --stat app/services'],
				verify:
					'git diff shows zero changes in the checkout service, yet completing an order now triggers both subscribers.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Today the OrderService directly calls EmailService, InventoryService, Analytics, and Shipping. The rewrite is to publish ONE event ("OrderCompleted") and let each downstream subscribe. The OrderService no longer knows who listens; new subscribers come and go without touching it.',
	},
};
