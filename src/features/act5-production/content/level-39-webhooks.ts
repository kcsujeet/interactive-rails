import type { Level } from '@/types';

export const level39Webhooks: Level = {
	id: 'act5-level39-webhooks',
	actId: 5,
	levelNumber: 39,
	name: 'Webhooks & Idempotency',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'Stripe sends payment results to your app via webhook callbacks (HTTP POST to /webhooks/stripe). A network hiccup caused Stripe to retry the same event. The handler processed it twice, double-crediting the customer. Support tickets flooding in.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'webhook-request',
				type: 'request',
				x: 80,
				y: 250,
				locked: true,
				config: { label: 'Stripe Webhook' },
			},
			{
				id: 'controller-node',
				type: 'controller',
				x: 300,
				y: 250,
				locked: true,
			},
			{
				id: 'payment-model',
				type: 'model',
				x: 500,
				y: 150,
				locked: true,
				config: { label: 'Payment' },
			},
			{
				id: 'credit-model',
				type: 'model',
				x: 500,
				y: 350,
				locked: true,
				config: { label: 'Credit' },
			},
			{ id: 'database-node', type: 'database', x: 700, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 860, y: 250, locked: true },
		],
		connections: [
			{
				id: 'c1',
				sourceNodeId: 'webhook-request',
				targetNodeId: 'controller-node',
			},
			{
				id: 'c2',
				sourceNodeId: 'controller-node',
				targetNodeId: 'payment-model',
			},
			{
				id: 'c3',
				sourceNodeId: 'controller-node',
				targetNodeId: 'credit-model',
			},
			{
				id: 'c4',
				sourceNodeId: 'payment-model',
				targetNodeId: 'database-node',
			},
			{ id: 'c5', sourceNodeId: 'credit-model', targetNodeId: 'database-node' },
			{
				id: 'c6',
				sourceNodeId: 'database-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'When a payment succeeds, Stripe POSTs a payment.succeeded event to your webhook endpoint. The handler credits the user $50. A network hiccup causes Stripe to retry the same event. The handler credits another $50. User now has $100 instead of $50.',
		rootCause:
			'Webhook handler is not idempotent. No signature verification (anyone could spoof webhooks). No deduplication of already-processed events. Processing happens synchronously, risking timeout.',
		codeExample: `# app/controllers/webhooks_controller.rb
class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def stripe
    result = HandleStripeWebhook.call(
      payload: request.body.read)
    head :ok
  end
end

# app/services/handle_stripe_webhook.rb
# BAD: Not idempotent, not secure
class HandleStripeWebhook < ApplicationService
  Result = Data.define(:success?, :resource, :errors)

  def initialize(payload:)
    @payload = payload
  end

  def call
    event = JSON.parse(@payload)
    # No signature verification! Anyone can spoof!

    case event['type']
    when 'payment_intent.succeeded'
      payment = Payment.find_by(
        stripe_id: event['data']['object']['id'])
      payment.mark_completed!
      payment.user.credits.create!(amount: payment.amount)
      # Duplicate webhook = duplicate credit!
    end

    Result.new(success?: true, resource: nil, errors: {})
  end
end

# Stripe retries webhooks up to 7 times over 72 hours
# Your handler MUST handle duplicates gracefully`,
		goal: 'Build a secure, idempotent webhook handler: verify signatures, deduplicate events, and process asynchronously.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'webhooks_configured' },
		{ type: 'idempotency_configured' },
	],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Webhook Security & Idempotency',
		goal: `In this level, you'll:\n- learn how to receive and process webhooks from external services like Stripe and GitHub securely.\n- verify HMAC-SHA256 signatures to prevent spoofing.\n- deduplicate events using stored event IDs for idempotency.\n- process payloads in background jobs so you can return 200 immediately.`,
		conceptExplanation: `Webhooks are incoming HTTP callbacks from external services. They are unreliable by nature.

**Three pillars of webhook handling:**

1. **Signature verification:**
   - Stripe signs every webhook with HMAC-SHA256
   - Verify the signature before processing
   - Reject unsigned/spoofed requests immediately

2. **Idempotency (deduplicate events):**
   - Store processed event IDs in a database table
   - Check before processing: if already seen, return 200 and skip
   - Use unique constraints to handle race conditions

3. **Asynchronous processing:**
   - Return 200 OK immediately (Stripe times out at 20 seconds)
   - Process the event in a background job
   - If processing fails, the job retries (not the webhook)

**Idempotency key pattern:**
- Every Stripe event has a unique \`event.id\`
- Store it in a \`webhook_events\` table with a unique index
- INSERT fails on duplicate = already processed = skip

**Raw body, not parsed body:**
Stripe signs the EXACT bytes it sent. Rails normally parses JSON requests so you can read \`params[:foo]\`; for webhook routes, do NOT use parsed params for signature verification. Parsing can re-order keys, escape characters differently, and break the HMAC. Use \`request.raw_post\` (cached, idempotent), or read the body once and stash it:

\`\`\`ruby
def create
  payload = request.raw_post     # the exact bytes Stripe sent
  sig_header = request.headers['Stripe-Signature']
  event = Stripe::Webhook.construct_event(
    payload, sig_header, webhook_secret, tolerance: 300
  )
end
\`\`\`
The \`tolerance\` argument (default 300 seconds) protects against replay attacks: an attacker who captures a valid signed payload cannot re-submit it after 5 minutes because the timestamp inside the signature is too old. Always pass a tolerance.

**Constant-time comparison:**
The Stripe SDK uses constant-time comparison internally. If you ever hand-roll signature verification for a provider without an SDK, use \`ActiveSupport::SecurityUtils.secure_compare\`, NOT \`==\`. \`==\` short-circuits on the first mismatch, leaking timing information that lets an attacker brute-force the signature byte by byte across many requests. The vulnerability is real; the fix is one line.

**Trust signed payloads as a notification, not as truth:**
For high-stakes events (payments, refunds, subscription state), the production-safe pattern is to treat the webhook as a NOTIFICATION ("something happened, here is the id") and re-fetch the resource from the API to learn the current state. The webhook payload may be stale by the time the job runs (hours later, after retries), and an attacker who breached your DB could in theory plant a webhook event row. Re-fetching from Stripe is the source of truth:

\`\`\`ruby
def handle_payment_succeeded(webhook_event)
  intent_id = webhook_event.payload.dig('object', 'id')
  intent = Stripe::PaymentIntent.retrieve(intent_id)
  return unless intent.status == 'succeeded'
  # credit the user using intent.amount, intent.currency
end
\`\`\`
This costs an extra API call per event but is the only safe pattern for money-moving operations.

**Out-of-order events:**
Stripe makes no guarantee about delivery order. If retries cause \`payment_intent.succeeded\` to arrive before \`payment_intent.created\`, a handler that does \`Payment.find_by!(stripe_id: ...)\` will fail when the local row does not exist yet. Two safe patterns:

1. \`find_or_create_by!\` on the local Payment using the Stripe id as the natural key, so either event creates the row.
2. State-machine guards on the model (\`AASM\` or hand-rolled) that reject invalid transitions; the out-of-order webhook is silently a no-op until the prerequisite event lands.

**Per-endpoint secrets:**
Each Stripe webhook endpoint has its OWN signing secret, not one global secret. Production, staging, and the Stripe-CLI dev tunnel all have different secrets. Route-specific config scales better than \`ENV['STRIPE_WEBHOOK_SECRET']\`:

\`\`\`ruby
WEBHOOK_SECRETS = {
  payments: Rails.application.credentials.dig(:stripe, :payments_webhook),
  subscriptions: Rails.application.credentials.dig(:stripe, :subscriptions_webhook)
}.freeze
\`\`\`

**Retention policy for webhook_events:**
A production deployment processes hundreds of events per day; over a year that is hundreds of thousands of rows. Without a retention policy the table grows forever, the unique index cost grows with it, and lookups slow down. Delete completed events older than 30-90 days via a scheduled job:

\`\`\`ruby
class CleanupWebhookEventsJob < ApplicationJob
  def perform
    WebhookEvent.where(status: 'completed')
                .where('processed_at < ?', 30.days.ago)
                .in_batches(of: 1000).delete_all
  end
end
\`\`\`
Failed events stay forever (or until manually triaged) so you can audit them.`,
		railsCodeExample: `# Migration: webhook events table
class CreateWebhookEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :webhook_events do |t|
      t.string :provider, null: false          # "stripe", "github"
      t.string :event_id, null: false          # Unique event ID from provider
      t.string :event_type, null: false        # "payment_intent.succeeded"
      t.jsonb :payload                         # Raw event data
      t.string :status, default: 'pending'     # pending, processing, completed, failed
      t.datetime :processed_at
      t.timestamps
    end

    add_index :webhook_events, [:provider, :event_id], unique: true
  end
end

# app/controllers/webhooks/stripe_controller.rb
module Webhooks
  class StripeController < ApplicationController
    # Skip CSRF - Stripe can't send CSRF tokens
    skip_before_action :verify_authenticity_token

    def create
      # Step 1: Verify signature
      payload = request.body.read
      sig_header = request.headers['Stripe-Signature']

      begin
        event = Stripe::Webhook.construct_event(
          payload, sig_header, ENV['STRIPE_WEBHOOK_SECRET']
        )
      rescue JSON::ParserError
        return head :bad_request
      rescue Stripe::SignatureVerificationError
        return head :unauthorized
      end

      # Step 2: Idempotency check - deduplicate
      webhook_event = WebhookEvent.create_with(
        event_type: event.type,
        payload: event.data.to_h,
        status: 'pending'
      ).find_or_create_by!(
        provider: 'stripe',
        event_id: event.id
      )

      # Already processed? Return 200 (tell Stripe to stop retrying)
      if webhook_event.status == 'completed'
        return head :ok
      end

      # Step 3: Process asynchronously - return 200 FAST
      ProcessStripeWebhookJob.perform_later(webhook_event.id)

      head :ok
    end
  end
end

# app/jobs/process_stripe_webhook_job.rb
class ProcessStripeWebhookJob < ApplicationJob
  queue_as :webhooks
  retry_on StandardError, wait: :polynomially_longer, attempts: 5

  def perform(webhook_event_id)
    webhook_event = WebhookEvent.find(webhook_event_id)

    # Double-check idempotency (job could be retried)
    return if webhook_event.completed?

    webhook_event.update!(status: 'processing')

    case webhook_event.event_type
    when 'payment_intent.succeeded'
      handle_payment_succeeded(webhook_event)
    when 'payment_intent.payment_failed'
      handle_payment_failed(webhook_event)
    when 'customer.subscription.deleted'
      handle_subscription_cancelled(webhook_event)
    end

    webhook_event.update!(status: 'completed', processed_at: Time.current)
  rescue => e
    webhook_event.update!(status: 'failed')
    raise  # Re-raise so the job retries
  end

  private

  def handle_payment_succeeded(webhook_event)
    stripe_payment_id = webhook_event.payload.dig('object', 'id')
    amount = webhook_event.payload.dig('object', 'amount')

    ActiveRecord::Base.transaction do
      payment = Payment.lock.find_by!(stripe_id: stripe_payment_id)

      # Idempotent: Only credit if not already completed
      return if payment.completed?

      payment.update!(status: 'completed')
      payment.user.credits.create!(
        amount: amount,
        source: 'payment',
        idempotency_key: "payment-#{payment.id}"
      )
    end
  end
end

# config/routes.rb
namespace :webhooks do
  post 'stripe', to: 'stripe#create'
end`,
		commonMistakes: [
			'Not verifying webhook signatures (anyone can spoof events)',
			'Processing webhooks synchronously (risks timeout, Stripe retries)',
			'No idempotency check (duplicate events = duplicate side effects)',
			'Using the event payload for amount/status instead of re-fetching from Stripe API',
			'Not handling race conditions between webhook and polling (both try to complete payment)',
			'Verifying the signature against parsed params instead of the raw body (Rails parsing can reorder keys and break the HMAC). Use request.raw_post',
			'Not passing a tolerance to construct_event (default 300s rejects replays of captured payloads after 5 minutes; without it an old signed payload still verifies forever)',
			'Hand-rolling signature comparison with == instead of ActiveSupport::SecurityUtils.secure_compare (== short-circuits and leaks timing info)',
			'Assuming Stripe delivers events in order (retries reorder them; use find_or_create_by! on the natural key, or a state machine that tolerates out-of-order)',
			'One global STRIPE_WEBHOOK_SECRET for production, staging, and the Stripe CLI dev tunnel (each endpoint has its own secret)',
			'Letting the webhook_events table grow forever (every successful event stays). Schedule a retention job to delete completed events past 30-90 days',
		],
		whenToUse:
			'Every webhook integration. Stripe, GitHub, Twilio, SendGrid all retry. Your handler MUST be idempotent.',
		furtherReading: [
			{
				title: 'Stripe Webhooks Best Practices',
				url: 'https://stripe.com/docs/webhooks/best-practices',
			},
			{
				title: 'Stripe Webhook Signatures',
				url: 'https://stripe.com/docs/webhooks/signatures',
			},
			{
				title: 'Idempotent Requests (Stripe)',
				url: 'https://stripe.com/docs/api/idempotent_requests',
			},
			{
				title: 'ActiveSupport::SecurityUtils.secure_compare',
				url: 'https://api.rubyonrails.org/classes/ActiveSupport/SecurityUtils.html',
			},
			{
				title: 'Rails request.raw_post',
				url: 'https://api.rubyonrails.org/classes/ActionDispatch/Request.html#method-i-raw_post',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Verify the Stripe signature first, then check if the event_id already exists in webhook_events. If new, enqueue a background job and return 200 immediately.',
	},
};
