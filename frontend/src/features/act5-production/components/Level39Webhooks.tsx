/**
 * Level 39: Webhooks & Idempotency
 *
 * Three-phase flow: observe -> build -> activate -> reward
 *
 * Phase 1 (observe): "Webhook Event Queue" visualization.
 *   Vertical top-to-bottom flow: Incoming Event -> [no signature gate] -> [no dedup gate] -> [sync processing]
 *   Probes fire webhook events that expose: forged events accepted, duplicates double-credited,
 *   synchronous processing blocking the response.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: Generate webhook_events migration (terminal)
 *   Step 1: Run the migration (terminal)
 *   Step 2: Configure signature verification (option)
 *   Step 3: Configure idempotency check (option)
 *   Step 4: Configure async job processing (option)
 *   Step 5: Build the webhook handler service (option)
 *
 * Phase 3 (reward): Same event queue, now with active gates.
 *   Signature gate rejects forged events. Idempotency gate catches duplicates.
 *   Valid events enqueued to background job. Fast 200 response.
 */

import { ArrowRight, Fingerprint, Layers, Mail, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	LeftPanel,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { FlowConnector } from '@/components/levels/FlowConnector';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';

// ─── Discovery definitions ─────────────────────────────────────────────
const DISCOVERY_DEFS = [
	{ id: 'no-signature', label: 'No signature verification on webhooks' },
	{ id: 'duplicate-credit', label: 'Duplicate webhook doubles user credit' },
	{ id: 'sync-timeout', label: 'Synchronous processing risks timeout' },
	{ id: 'no-dedup', label: 'No event deduplication (event_id not tracked)' },
] as const;

// ─── Probe definitions ────────────────────────────────────────────────
const PROBES = [
	{
		id: 'forged-webhook',
		label: 'POST webhook (forged, no signature)',
		command:
			'curl -X POST localhost:3000/webhooks/stripe -d \'{"type": "payment_intent.succeeded"}\'',
		responseLines: [
			{ text: '200 OK', color: 'amber' as const },
			{
				text: '# No signature header checked!',
				color: 'red' as const,
			},
			{
				text: '# Anyone can POST fake events to this endpoint',
				color: 'red' as const,
			},
			{
				text: '# Attacker credits themselves $10,000',
				color: 'red' as const,
			},
		],
	},
	{
		id: 'duplicate-event',
		label: 'POST webhook (duplicate event_id)',
		command:
			'curl -X POST localhost:3000/webhooks/stripe -d \'{"id": "evt_123", "type": "payment_intent.succeeded"}\'',
		responseLines: [
			{
				text: '# Stripe retries evt_123 (network hiccup)',
				color: 'amber' as const,
			},
			{ text: '200 OK', color: 'amber' as const },
			{
				text: '# User credited AGAIN for the same payment!',
				color: 'red' as const,
			},
			{
				text: '# $50 payment = $100 credit. No dedup check.',
				color: 'red' as const,
			},
		],
	},
	{
		id: 'slow-processing',
		label: 'POST webhook (slow handler)',
		command:
			'curl -X POST localhost:3000/webhooks/stripe -d \'{"type": "invoice.paid"}\' --max-time 25',
		responseLines: [
			{
				text: '# Processing synchronously: query user, update payment, send email...',
				color: 'amber' as const,
			},
			{
				text: '# 15 seconds elapsed... Stripe timeout is 20 seconds',
				color: 'red' as const,
			},
			{
				text: '# Stripe marks delivery failed, will retry in 1 hour',
				color: 'red' as const,
			},
			{
				text: '# Same event processed again on retry = double credit',
				color: 'red' as const,
			},
		],
	},
] as const;

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'forged-webhook': ['no-signature'],
	'duplicate-event': ['duplicate-credit', 'no-dedup'],
	'slow-processing': ['sync-timeout'],
};

// ─── Build step definitions ────────────────────────────────────────────
const STEP_DEFS = [
	{ id: 'generate-migration', label: 'Generate Events Table' },
	{ id: 'run-migration', label: 'Run Migration' },
	{ id: 'configure-signature', label: 'Verify Signature' },
	{ id: 'configure-idempotency', label: 'Check Idempotency' },
	{ id: 'configure-async', label: 'Process Asynchronously' },
	{ id: 'build-service', label: 'Build Webhook Service' },
] as const;

const GENERATE_MIGRATION_COMMANDS = [
	{
		id: 'wrong-no-index',
		label: 'rails g migration CreateWebhookEvents provider event_id event_type',
		command:
			'rails g migration CreateWebhookEvents provider event_id event_type',
		correct: false,
		feedback:
			'Without a unique index on [provider, event_id], race conditions between concurrent webhooks can insert duplicates before your code checks.',
	},
	{
		id: 'wrong-wrong-columns',
		label: 'rails g migration CreateWebhookLogs url method response_code',
		command: 'rails g migration CreateWebhookLogs url method response_code',
		correct: false,
		feedback:
			'This tracks outgoing HTTP requests, not incoming webhook events. You need to store the event ID from the provider for deduplication.',
	},
	{
		id: 'correct',
		label:
			'rails g migration CreateWebhookEvents provider:string event_id:string event_type:string payload:jsonb status:string processed_at:datetime',
		command:
			'rails g migration CreateWebhookEvents provider:string event_id:string event_type:string payload:jsonb status:string processed_at:datetime',
		correct: true,
	},
];

const RUN_MIGRATION_COMMANDS = [
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		command: 'rails db:seed',
		correct: false,
		feedback:
			'db:seed loads seed data. The migration file still needs to be applied to create the webhook_events table.',
	},
	{
		id: 'correct',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
	{
		id: 'wrong-reset',
		label: 'rails db:reset',
		command: 'rails db:reset',
		correct: false,
		feedback:
			'db:reset drops and recreates the entire database. You only need to apply the new migration, not destroy existing data.',
	},
];

const CONFIGURE_SIGNATURE_OPTIONS = [
	{
		id: 'wrong-json-parse',
		label: 'Parse JSON body directly (no verification)',
		code: `def create
  event = JSON.parse(request.body.read)
  # Trust the payload as-is
  process_event(event)
  head :ok
end`,
		correct: false,
		feedback:
			'Without signature verification, anyone can POST fake webhook events. The payload must be verified against a cryptographic signature before processing.',
	},
	{
		id: 'correct',
		label: 'Verify HMAC signature via Stripe gem',
		code: `def create
  payload = request.body.read
  sig_header = request.headers['Stripe-Signature']

  begin
    event = Stripe::Webhook.construct_event(
      payload, sig_header,
      Rails.application.credentials.stripe[:webhook_secret]
    )
  rescue JSON::ParserError
    return head :bad_request
  rescue Stripe::SignatureVerificationError
    return head :unauthorized
  end
  # event is now verified authentic
end`,
		correct: true,
	},
	{
		id: 'wrong-manual-hmac',
		label: 'Compare raw HMAC manually',
		code: `def create
  payload = request.body.read
  expected = OpenSSL::HMAC.hexdigest(
    'sha256', ENV['STRIPE_SECRET'], payload)
  if request.headers['Stripe-Signature'] != expected
    return head :unauthorized
  end
  event = JSON.parse(payload)
end`,
		correct: false,
		feedback:
			'Stripe signatures use a timestamp-based scheme (t=...,v1=...) to prevent replay attacks. Manual HMAC comparison misses the timestamp check and is vulnerable to replay.',
	},
];

const CONFIGURE_IDEMPOTENCY_OPTIONS = [
	{
		id: 'wrong-memory-set',
		label: 'Track event IDs in a Set (in memory)',
		code: `@@processed_ids = Set.new

def create
  # ...signature verification...
  return head :ok if @@processed_ids.include?(event.id)
  @@processed_ids.add(event.id)
  process_event(event)
  head :ok
end`,
		correct: false,
		feedback:
			'In-memory sets are lost on restart and not shared across processes. Multiple Puma workers would each have their own set, missing duplicates handled by other workers.',
	},
	{
		id: 'wrong-find-by',
		label: 'Check with find_by before creating',
		code: `def create
  # ...signature verification...
  return head :ok if WebhookEvent.find_by(
    provider: 'stripe', event_id: event.id)

  WebhookEvent.create!(
    provider: 'stripe', event_id: event.id,
    event_type: event.type, payload: event.data.to_h,
    status: 'pending')
  process_event(event)
  head :ok
end`,
		correct: false,
		feedback:
			'find_by + create has a race condition. Two concurrent requests can both pass the find_by check before either inserts. You need an atomic operation backed by a database constraint.',
	},
	{
		id: 'correct',
		label: 'Atomic find_or_create_by with unique index',
		code: `def create
  # ...signature verification...
  webhook_event = WebhookEvent.create_with(
    event_type: event.type,
    payload: event.data.to_h,
    status: 'pending'
  ).find_or_create_by!(
    provider: 'stripe', event_id: event.id
  )

  # Already processed? Tell Stripe to stop retrying
  return head :ok if webhook_event.completed?
end`,
		correct: true,
	},
];

const CONFIGURE_ASYNC_OPTIONS = [
	{
		id: 'wrong-sync',
		label: 'Process synchronously in the controller',
		code: `# After idempotency check:
case webhook_event.event_type
when 'payment_intent.succeeded'
  payment = Payment.find_by!(stripe_id: data['id'])
  payment.update!(status: 'completed')
  payment.user.credits.create!(amount: data['amount'])
  UserMailer.payment_confirmed(payment).deliver_now
end
webhook_event.update!(status: 'completed')
head :ok`,
		correct: false,
		feedback:
			'Synchronous processing (DB queries, email sending) can take 10-20 seconds. Stripe times out at 20 seconds and retries, causing duplicate processing.',
	},
	{
		id: 'correct',
		label: 'Enqueue background job, return 200 immediately',
		code: `# After idempotency check:
ProcessStripeWebhookJob.perform_later(webhook_event.id)
head :ok

# Job handles the heavy lifting:
# - Update payment status
# - Create credits (idempotent with key)
# - Send confirmation email
# - Mark webhook_event as completed`,
		correct: true,
	},
	{
		id: 'wrong-thread',
		label: 'Spawn a thread for processing',
		code: `# After idempotency check:
Thread.new do
  process_webhook_event(webhook_event)
end
head :ok`,
		correct: false,
		feedback:
			'Raw threads have no retry logic, no error tracking, no persistence. If the thread crashes, the event is lost. Background jobs (Solid Queue) handle all of this.',
	},
];

const BUILD_SERVICE_OPTIONS = [
	{
		id: 'wrong-controller-logic',
		label: 'All logic in the controller action',
		code: `module Webhooks
  class StripeController < ApplicationController
    skip_before_action :verify_authenticity_token

    def create
      payload = request.body.read
      sig = request.headers['Stripe-Signature']
      event = Stripe::Webhook.construct_event(
        payload, sig, credentials[:webhook_secret])
      webhook_event = WebhookEvent.create_with(
        event_type: event.type, payload: event.data.to_h,
        status: 'pending'
      ).find_or_create_by!(
        provider: 'stripe', event_id: event.id)
      return head :ok if webhook_event.completed?
      ProcessStripeWebhookJob.perform_later(webhook_event.id)
      head :ok
    rescue Stripe::SignatureVerificationError
      head :unauthorized
    end
  end
end`,
		correct: false,
		feedback:
			'Keeping all webhook logic in the controller violates the pattern established in earlier levels. Complex multi-step operations belong in a dedicated object.',
	},
	{
		id: 'correct',
		label: 'Service with contract, dedup, and async dispatch',
		code: `class IngestStripeWebhook < ApplicationService
  Result = Data.define(:success?, :webhook_event, :errors)

  def initialize(payload:, signature:)
    @payload = payload
    @signature = signature
  end

  def call
    event = verify_signature!
    webhook_event = deduplicate!(event)
    return Result.new(success?: true,
      webhook_event:, errors: []) if webhook_event.completed?

    ProcessStripeWebhookJob.perform_later(webhook_event.id)
    Result.new(success?: true, webhook_event:, errors: [])
  rescue Stripe::SignatureVerificationError
    Result.new(success?: false, webhook_event: nil,
      errors: { signature: ["Invalid signature"] })
  rescue JSON::ParserError
    Result.new(success?: false, webhook_event: nil,
      errors: { payload: ["Malformed JSON"] })
  end

  private

  def verify_signature!
    Stripe::Webhook.construct_event(
      @payload, @signature,
      Rails.application.credentials.stripe[:webhook_secret])
  end

  def deduplicate!(event)
    WebhookEvent.create_with(
      event_type: event.type,
      payload: event.data.to_h,
      status: 'pending'
    ).find_or_create_by!(
      provider: 'stripe', event_id: event.id)
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-no-dedup-service',
		label: 'Service without idempotency check',
		code: `class IngestStripeWebhook < ApplicationService
  Result = Data.define(:success?, :webhook_event, :errors)

  def initialize(payload:, signature:)
    @payload = payload
    @signature = signature
  end

  def call
    event = Stripe::Webhook.construct_event(
      @payload, @signature,
      Rails.application.credentials.stripe[:webhook_secret])

    webhook_event = WebhookEvent.create!(
      provider: 'stripe', event_id: event.id,
      event_type: event.type, payload: event.data.to_h)

    ProcessStripeWebhookJob.perform_later(webhook_event.id)
    Result.new(success?: true, webhook_event:, errors: [])
  end
end`,
		correct: false,
		feedback:
			'create! raises an exception on duplicate event_id (unique index constraint), but does not gracefully handle already-processed events. You need an atomic upsert pattern instead.',
	},
];

const TERMINAL_STEP_MAP: ({
	commands: typeof GENERATE_MIGRATION_COMMANDS;
	outputLines: { text: string; color: 'green' | 'cyan' }[];
} | null)[] = [
	{
		commands: GENERATE_MIGRATION_COMMANDS,
		outputLines: [
			{
				text: 'create  db/migrate/20260315_create_webhook_events.rb',
				color: 'green' as const,
			},
		],
	},
	{
		commands: RUN_MIGRATION_COMMANDS,
		outputLines: [
			{
				text: '== CreateWebhookEvents: migrating ============================',
				color: 'cyan' as const,
			},
			{
				text: '-- create_table(:webhook_events)',
				color: 'green' as const,
			},
			{
				text: '== CreateWebhookEvents: migrated (0.0042s) ===================',
				color: 'green' as const,
			},
		],
	},
	null, // configure-signature: OptionCard
	null, // configure-idempotency: OptionCard
	null, // configure-async: OptionCard
	null, // build-service: OptionCard
];

// ─── Stress test scenarios ─────────────────────────────────────────────
const STRESS_SCENARIOS = [
	{
		id: 'valid-payment',
		label: 'POST payment.succeeded (valid)',
		description: 'Authentic webhook with valid HMAC signature, new event',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'stripe',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'valid-subscription',
		label: 'POST subscription.created (valid)',
		description: 'Valid new subscription webhook, enqueued to background job',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'stripe',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'forged-event',
		label: 'POST payment.succeeded (forged)',
		description: 'No valid Stripe-Signature header, rejected immediately',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'attacker',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'duplicate-event',
		label: 'POST payment.succeeded (duplicate)',
		description: 'Same event_id already processed, returns 200 and skips',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'stripe',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'valid-refund',
		label: 'POST charge.refunded (valid)',
		description: 'Valid refund webhook, processed asynchronously',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'stripe',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'bad-payload',
		label: 'POST malformed JSON (invalid)',
		description: 'Garbled payload, rejected at signature verification',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'attacker',
		expectedResult: 'blocked' as const,
	},
];

// ─── Visualization types ───────────────────────────────────────────────
interface GateState {
	signature: 'absent' | 'active' | 'rejected';
	idempotency: 'absent' | 'active' | 'skipped';
	processing: 'sync' | 'async' | 'enqueued';
}

// ─── Code preview builder ──────────────────────────────────────────────
function getCodeFiles(
	phase: 'observe' | 'build' | 'activate' | 'reward',
	furthestStep: number,
) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/controllers/webhooks_controller.rb',
				language: 'ruby',
				code: `class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def stripe
    event = JSON.parse(request.body.read)
    # No signature verification! Anyone can spoof events!

    case event['type']
    when 'payment_intent.succeeded'
      payment = Payment.find_by(
        stripe_id: event['data']['object']['id'])
      payment.mark_completed!
      payment.user.credits.create!(
        amount: payment.amount)
      # Duplicate webhook = duplicate credit!
    end

    head :ok
    # No idempotency check, no async processing
    # Stripe times out at 20s, retries up to 7 times
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (furthestStep >= 0) {
			files.push({
				filename: 'db/migrate/create_webhook_events.rb',
				language: 'ruby',
				code: `class CreateWebhookEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :webhook_events do |t|
      t.string :provider, null: false
      t.string :event_id, null: false
      t.string :event_type, null: false
      t.jsonb :payload
      t.string :status, default: 'pending'
      t.datetime :processed_at
      t.timestamps
    end

    add_index :webhook_events,
      [:provider, :event_id], unique: true
  end
end${furthestStep >= 1 ? '\n# Migration applied. Table created.' : ''}`,
			});
		}

		if (furthestStep >= 2) {
			files.push({
				filename: 'app/controllers/webhooks/stripe_controller.rb',
				language: 'ruby',
				code: `module Webhooks
  class StripeController < ApplicationController
    skip_before_action :verify_authenticity_token

    def create
      payload = request.body.read
      sig_header = request.headers['Stripe-Signature']

      event = Stripe::Webhook.construct_event(
        payload, sig_header,
        Rails.application.credentials.stripe[:webhook_secret]
      )
      # Signature verified!${
				furthestStep >= 3
					? `

      webhook_event = WebhookEvent.create_with(
        event_type: event.type,
        payload: event.data.to_h,
        status: 'pending'
      ).find_or_create_by!(
        provider: 'stripe', event_id: event.id)

      return head :ok if webhook_event.completed?`
					: '\n      # Next: idempotency check...'
			}${
				furthestStep >= 4
					? `

      ProcessStripeWebhookJob.perform_later(
        webhook_event.id)
      head :ok`
					: furthestStep >= 3
						? '\n      # Next: async processing...'
						: ''
			}
    rescue JSON::ParserError
      head :bad_request
    rescue Stripe::SignatureVerificationError
      head :unauthorized
    end
  end
end`,
			});
		}

		if (furthestStep >= 5) {
			files.push({
				filename: 'app/services/ingest_stripe_webhook.rb',
				language: 'ruby',
				code: `class IngestStripeWebhook < ApplicationService
  Result = Data.define(:success?, :webhook_event, :errors)

  def initialize(payload:, signature:)
    @payload = payload
    @signature = signature
  end

  def call
    event = verify_signature!
    webhook_event = deduplicate!(event)
    return Result.new(success?: true,
      webhook_event:, errors: []) if webhook_event.completed?

    ProcessStripeWebhookJob.perform_later(webhook_event.id)
    Result.new(success?: true, webhook_event:, errors: [])
  rescue Stripe::SignatureVerificationError
    Result.new(success?: false, webhook_event: nil,
      errors: { signature: ["Invalid signature"] })
  rescue JSON::ParserError
    Result.new(success?: false, webhook_event: nil,
      errors: { payload: ["Malformed JSON"] })
  end

  private

  def verify_signature!
    Stripe::Webhook.construct_event(
      @payload, @signature,
      Rails.application.credentials.stripe[:webhook_secret])
  end

  def deduplicate!(event)
    WebhookEvent.create_with(
      event_type: event.type,
      payload: event.data.to_h,
      status: 'pending'
    ).find_or_create_by!(
      provider: 'stripe', event_id: event.id)
  end
end`,
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'db/migrate/create_webhook_events.rb',
				language: 'ruby',
				code: '# Step 1: Generate the webhook_events migration...',
			});
		}

		return files;
	}

	// activate + reward: full solution
	return [
		{
			filename: 'app/services/ingest_stripe_webhook.rb',
			language: 'ruby',
			code: `class IngestStripeWebhook < ApplicationService
  Result = Data.define(:success?, :webhook_event, :errors)

  def initialize(payload:, signature:)
    @payload = payload
    @signature = signature
  end

  def call
    event = verify_signature!
    webhook_event = deduplicate!(event)
    return Result.new(success?: true,
      webhook_event:, errors: []) if webhook_event.completed?

    ProcessStripeWebhookJob.perform_later(webhook_event.id)
    Result.new(success?: true, webhook_event:, errors: [])
  rescue Stripe::SignatureVerificationError
    Result.new(success?: false, webhook_event: nil,
      errors: { signature: ["Invalid signature"] })
  rescue JSON::ParserError
    Result.new(success?: false, webhook_event: nil,
      errors: { payload: ["Malformed JSON"] })
  end

  private

  def verify_signature!
    Stripe::Webhook.construct_event(
      @payload, @signature,
      Rails.application.credentials.stripe[:webhook_secret])
  end

  def deduplicate!(event)
    WebhookEvent.create_with(
      event_type: event.type,
      payload: event.data.to_h,
      status: 'pending'
    ).find_or_create_by!(
      provider: 'stripe', event_id: event.id)
  end
end`,
		},
		{
			filename: 'app/controllers/webhooks/stripe_controller.rb',
			language: 'ruby',
			code: `module Webhooks
  class StripeController < ApplicationController
    skip_before_action :verify_authenticity_token

    def create
      result = IngestStripeWebhook.call(
        payload: request.body.read,
        signature: request.headers['Stripe-Signature']
      )

      if result.success?
        head :ok
      else
        head :unauthorized
      end
    end
  end
end`,
		},
		{
			filename: 'app/jobs/process_stripe_webhook_job.rb',
			language: 'ruby',
			code: `class ProcessStripeWebhookJob < ApplicationJob
  queue_as :webhooks
  retry_on StandardError,
    wait: :polynomially_longer, attempts: 5

  def perform(webhook_event_id)
    webhook_event = WebhookEvent.find(webhook_event_id)
    return if webhook_event.completed?

    webhook_event.update!(status: 'processing')

    case webhook_event.event_type
    when 'payment_intent.succeeded'
      handle_payment_succeeded(webhook_event)
    when 'customer.subscription.created'
      handle_subscription_created(webhook_event)
    when 'charge.refunded'
      handle_refund(webhook_event)
    end

    webhook_event.update!(
      status: 'completed', processed_at: Time.current)
  rescue => e
    webhook_event.update!(status: 'failed')
    raise  # Re-raise so job retries
  end
end`,
		},
	];
}

// ─── Main component ────────────────────────────────────────────────────
export function Level39Webhooks(_props: LevelComponentProps) {
	const [phase, setPhase] = useState<
		'observe' | 'build' | 'activate' | 'reward'
	>('observe');

	// ── Observe phase ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});

	const [flowPhase, setFlowPhase] = useState(-1);
	const [gateState, setGateState] = useState<GateState>({
		signature: 'absent',
		idempotency: 'absent',
		processing: 'sync',
	});
	const flowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleProbe = useCallback(
		(probeId: string) => {
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}

			setFlowPhase(0);

			// All observe probes show absent gates
			setGateState({
				signature: 'absent',
				idempotency: 'absent',
				processing: 'sync',
			});

			if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
			flowTimerRef.current = setTimeout(() => {
				setFlowPhase(-1);
			}, ANIMATION_DURATION_MS * 3);
		},
		[discoveryGating],
	);

	useEffect(() => {
		return () => {
			if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
		};
	}, []);

	// ── Build phase ──
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	useEffect(() => {
		if (stepper.isComplete && phase === 'build') {
			setPhase('activate');
		}
	}, [stepper.isComplete, phase]);

	// ── Reward phase ──
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [rewardFlowPhase, setRewardFlowPhase] = useState(-1);
	const [rewardGateState, setRewardGateState] = useState<GateState>({
		signature: 'active',
		idempotency: 'active',
		processing: 'async',
	});
	const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleStressFire = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			if (!scenario) return;

			setRewardFlowPhase(0);

			// Update gate visualization based on scenario
			if (scenarioId === 'forged-event' || scenarioId === 'bad-payload') {
				setRewardGateState({
					signature: 'rejected',
					idempotency: 'active',
					processing: 'async',
				});
			} else if (scenarioId === 'duplicate-event') {
				setRewardGateState({
					signature: 'active',
					idempotency: 'skipped',
					processing: 'async',
				});
			} else {
				setRewardGateState({
					signature: 'active',
					idempotency: 'active',
					processing: 'enqueued',
				});
			}

			if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
			rewardTimerRef.current = setTimeout(() => {
				setRewardFlowPhase(-1);
			}, ANIMATION_DURATION_MS * 2);
		},
		[stressTest],
	);

	useEffect(() => {
		return () => {
			if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
		};
	}, []);

	// ── Render: Webhook Event Queue visualization ──
	const renderWebhookQueue = (isReward: boolean) => {
		const probeActive = isReward ? rewardFlowPhase !== -1 : flowPhase !== -1;
		const gates = isReward ? rewardGateState : gateState;

		const gateColor = (
			state: string,
			_type: 'signature' | 'idempotency' | 'processing',
		) => {
			if (state === 'absent' || state === 'sync')
				return 'border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50';
			if (state === 'rejected' || state === 'skipped')
				return 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30';
			if (state === 'enqueued')
				return 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30';
			return 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30';
		};

		const gateTextColor = (state: string) => {
			if (state === 'absent' || state === 'sync')
				return 'text-muted-foreground';
			if (state === 'rejected' || state === 'skipped')
				return 'text-amber-600 dark:text-amber-400';
			return 'text-emerald-600 dark:text-emerald-400';
		};

		return (
			<div className="flex flex-col items-center gap-1 h-full py-2">
				{/* Incoming Webhook Event */}
				<div className="flex items-center gap-2 shrink-0">
					<div
						className={`w-48 h-12 rounded-lg border-2 flex items-center justify-center gap-2 ${
							isReward
								? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
								: 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30'
						}`}
					>
						<Mail
							className={`w-5 h-5 ${isReward ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
						/>
						<span
							className={`text-sm font-semibold ${isReward ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
						>
							Stripe Webhook
						</span>
					</div>
					{!isReward && (
						<Badge
							className="text-[10px] text-red-600 dark:text-red-400 border-red-300 dark:border-red-700"
							variant="outline"
						>
							Unverified
						</Badge>
					)}
				</div>

				<FlowConnector
					active={probeActive}
					direction="down"
					variant={isReward ? 'success' : 'danger'}
				/>

				{/* Gate 1: Signature Verification */}
				<div className="flex items-center gap-2 shrink-0">
					<div
						className={`w-48 h-14 rounded-lg border-2 flex flex-col items-center justify-center ${gateColor(gates.signature, 'signature')}`}
					>
						<Fingerprint
							className={`w-5 h-5 ${gateTextColor(gates.signature)}`}
						/>
						<span
							className={`text-[10px] font-semibold ${gateTextColor(gates.signature)}`}
						>
							{gates.signature === 'absent'
								? 'No Verification'
								: gates.signature === 'rejected'
									? 'REJECTED (bad sig)'
									: 'HMAC Verified'}
						</span>
					</div>
					<span className="text-xs text-muted-foreground w-16">Signature</span>
				</div>

				<FlowConnector
					active={probeActive}
					direction="down"
					variant={
						isReward
							? gates.signature === 'rejected'
								? 'danger'
								: 'success'
							: 'danger'
					}
				/>

				{/* Gate 2: Idempotency Check */}
				<div className="flex items-center gap-2 shrink-0">
					<div
						className={`w-48 h-14 rounded-lg border-2 flex flex-col items-center justify-center ${gateColor(gates.idempotency, 'idempotency')}`}
					>
						<Layers className={`w-5 h-5 ${gateTextColor(gates.idempotency)}`} />
						<span
							className={`text-[10px] font-semibold ${gateTextColor(gates.idempotency)}`}
						>
							{gates.idempotency === 'absent'
								? 'No Dedup Check'
								: gates.idempotency === 'skipped'
									? 'DUPLICATE (skip)'
									: 'Event ID Checked'}
						</span>
					</div>
					<span className="text-xs text-muted-foreground w-16">
						Idempotency
					</span>
				</div>

				<FlowConnector
					active={probeActive}
					direction="down"
					variant={
						isReward
							? gates.signature === 'rejected' ||
								gates.idempotency === 'skipped'
								? 'muted'
								: 'success'
							: 'danger'
					}
				/>

				{/* Gate 3: Processing Mode */}
				<div className="flex items-center gap-2 shrink-0">
					<div
						className={`w-48 h-14 rounded-lg border-2 flex flex-col items-center justify-center ${gateColor(gates.processing, 'processing')}`}
					>
						<Zap className={`w-5 h-5 ${gateTextColor(gates.processing)}`} />
						<span
							className={`text-[10px] font-semibold ${gateTextColor(gates.processing)}`}
						>
							{gates.processing === 'sync'
								? 'Sync (blocks 15s)'
								: gates.processing === 'enqueued'
									? 'ENQUEUED (200 OK)'
									: 'Async Job Queue'}
						</span>
					</div>
					<span className="text-xs text-muted-foreground w-16">Processing</span>
				</div>

				<FlowConnector
					active={probeActive}
					direction="down"
					variant={isReward ? 'success' : 'danger'}
				/>

				{/* Result */}
				<div className="shrink-0">
					<div
						className={`w-48 h-10 rounded-lg border-2 flex items-center justify-center ${
							isReward
								? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
								: 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30'
						}`}
					>
						<span
							className={`text-xs font-semibold ${isReward ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
						>
							{isReward ? '200 OK (fast)' : '200 OK (after 15s)'}
						</span>
					</div>
				</div>
			</div>
		);
	};

	// ── Build phase: current step config ──
	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx === 0)
			return { type: 'terminal' as const, ...TERMINAL_STEP_MAP[0] };
		if (idx === 1)
			return { type: 'terminal' as const, ...TERMINAL_STEP_MAP[1] };
		if (idx === 2)
			return {
				type: 'option' as const,
				options: CONFIGURE_SIGNATURE_OPTIONS,
			};
		if (idx === 3)
			return {
				type: 'option' as const,
				options: CONFIGURE_IDEMPOTENCY_OPTIONS,
			};
		if (idx === 4)
			return { type: 'option' as const, options: CONFIGURE_ASYNC_OPTIONS };
		if (idx === 5)
			return {
				type: 'option' as const,
				options: BUILD_SERVICE_OPTIONS,
			};
		return null;
	}, [stepper.currentStep]);

	// ── Left panel ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground">
							Stripe fires a payment.succeeded webhook. Your handler credits the
							user $50. A network hiccup causes Stripe to retry the same event.
							Your handler credits another $50. User now has $100 instead of
							$50.
						</p>
					</div>
					<DiscoveryChecklist
						discoveries={DISCOVERY_DEFS.map((d) => ({
							id: d.id,
							label: d.label,
							found: discoveryGating.isDiscovered(d.id),
						}))}
					/>
					{discoveryGating.isUnlocked && (
						<Button
							className="w-full animate-in fade-in duration-500"
							onClick={() => setPhase('build')}
						>
							Build the Fix <ArrowRight className="w-4 h-4 ml-2" />
						</Button>
					)}
				</div>
			);
		}

		if (phase === 'build') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Building
						</h3>
						<p className="text-sm text-muted-foreground">
							Build a secure, idempotent webhook handler: verify signatures,
							deduplicate events, and process asynchronously.
						</p>
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						furthestStep={stepper.furthestStep}
						steps={STEP_DEFS.map((s) => s.label)}
					/>
				</div>
			);
		}

		if (phase === 'activate') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Solution Complete
						</h3>
						<p className="text-sm text-muted-foreground">
							Webhook handler with signature verification, idempotency via
							WebhookEvent table, and async processing via background jobs.
						</p>
					</div>
				</div>
			);
		}

		// reward
		return (
			<div className="space-y-4 p-4">
				<div>
					<h3 className="text-sm font-semibold text-foreground mb-2">Legend</h3>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-emerald-500" />
							<span className="text-muted-foreground">
								Verified and processed
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-amber-500" />
							<span className="text-muted-foreground">
								Rejected or deduplicated
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">
								Blocked (forged/malformed)
							</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Processed</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Rejected</div>
					</div>
				</div>
				{stressTest.canAutoFire && (
					<Button
						className="w-full"
						onClick={() => stressTest.toggleAutoFire(handleStressFire)}
						variant="outline"
					>
						{stressTest.isAutoFiring ? 'Stop Auto-Fire' : 'Auto-Fire All'}
					</Button>
				)}
			</div>
		);
	};

	// ── Center panel ──
	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col p-4 gap-4">
					<div className="flex-1 min-h-0 flex items-center justify-center">
						{renderWebhookQueue(false)}
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={flowPhase !== -1}
							onProbe={handleProbe}
							probes={PROBES}
						/>
					</div>
				</div>
			);
		}

		if (phase === 'build' && currentStepConfig) {
			if (currentStepConfig.type === 'terminal' && currentStepConfig.commands) {
				return (
					<div className="flex-1 flex flex-col p-4">
						<TerminalChoiceStep
							commands={currentStepConfig.commands}
							completed={stepper.isCurrentStepCompleted}
							description={
								<p className="text-sm text-muted-foreground">
									{stepper.currentStep === 0 &&
										'Create a table to store webhook event IDs for deduplication. Include a unique index on [provider, event_id] to prevent race conditions.'}
									{stepper.currentStep === 1 &&
										'Apply the migration to create the webhook_events table in the database.'}
								</p>
							}
							hasNext={stepper.currentStep < STEP_DEFS.length - 1}
							initialHistory={buildTerminalHistory(
								TERMINAL_STEP_MAP,
								stepper.currentStep,
							)}
							onCorrect={() => stepper.completeStep()}
							onNext={stepper.nextStep}
							onWrong={(fb) => stepper.recordWrongAttempt(fb)}
							outputLines={currentStepConfig.outputLines}
							stepKey={stepper.currentStep}
							title={STEP_DEFS[stepper.currentStep].label}
						/>
					</div>
				);
			}

			if (currentStepConfig.type === 'option') {
				return (
					<div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
						<div>
							<h3 className="text-lg font-semibold text-foreground">
								{STEP_DEFS[stepper.currentStep].label}
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{stepper.currentStep === 2 &&
									'How should the controller verify that a webhook is authentically from Stripe?'}
								{stepper.currentStep === 3 &&
									'How should the handler prevent processing the same event twice?'}
								{stepper.currentStep === 4 &&
									'How should the handler process the webhook payload after verification and dedup?'}
								{stepper.currentStep === 5 &&
									'Where should the webhook ingestion logic live?'}
							</p>
						</div>
						<div className="space-y-3">
							{currentStepConfig.options.map((opt) => (
								<OptionCard
									code={opt.code}
									correct={opt.correct}
									key={opt.id}
									label={opt.label}
									onSelect={() => {
										if (opt.correct) {
											stepper.completeStep();
										} else if (opt.feedback) {
											stepper.recordWrongAttempt(opt.feedback);
										}
									}}
								/>
							))}
						</div>
						{stepper.lastFeedback && (
							<ErrorFeedback message={stepper.lastFeedback} />
						)}
						{stepper.isCurrentStepCompleted &&
							stepper.currentStep < STEP_DEFS.length - 1 && (
								<Button onClick={stepper.nextStep} variant="outline">
									Next Step <ArrowRight className="w-4 h-4 ml-2" />
								</Button>
							)}
					</div>
				);
			}
		}

		if (phase === 'activate') {
			return (
				<div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
					<div className="flex items-center gap-1">
						{[1, 2, 3].map((star) => (
							<Zap
								className="w-8 h-8 text-amber-400 fill-amber-400"
								key={star}
							/>
						))}
					</div>
					<Button onClick={() => setPhase('reward')} size="lg">
						Visualize Webhook Security <ArrowRight className="w-4 h-4 ml-2" />
					</Button>
				</div>
			);
		}

		// reward
		return (
			<div className="flex-1 flex flex-col p-4 gap-4">
				<div className="flex-1 min-h-0 flex items-center justify-center">
					{renderWebhookQueue(true)}
				</div>
				<div className="px-6 pb-2">
					<StressTestPanel
						disabled={rewardFlowPhase !== -1}
						onFire={handleStressFire}
						scenarios={STRESS_SCENARIOS}
						stressTest={stressTest}
					/>
				</div>
			</div>
		);
	};

	return (
		<LevelLayout>
			<LeftPanel>{renderLeftPanel()}</LeftPanel>
			<CenterPanel>{renderCenterPanel()}</CenterPanel>
			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'build' ? stepper.furthestStep : 0,
					)}
					learningGoal="Webhooks need signature verification (HMAC), idempotency (event dedup), and async processing (background jobs)."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level39Webhooks;
