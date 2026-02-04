/**
 * Act 4: Production Ready
 * "Building for the Real World"
 *
 * Levels 22-26: External APIs, Webhooks, File Storage, Idempotency, Health Checks
 */

import type { Act, Level } from '../../components/game/types';

// ============================================
// Level 22: External APIs
// ============================================

const level22ExternalAPIs: Level = {
	id: 'act4-level22-external-apis',
	actId: 4,
	levelNumber: 22,
	name: 'External APIs',
	trigger: {
		type: 'incident',
		description: 'Stripe API timeout crashed the checkout flow.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'External API calls block requests and cause timeouts.',
		rootCause: 'No resilience patterns for external dependencies.',
		codeExample: `# BAD: No timeout, no retry
response = HTTParty.get('https://api.stripe.com/...')

# GOOD: Timeout + retry + circuit breaker
response = with_resilience { stripe_client.charge(amount) }`,
		goal: 'Implement resilience patterns for external API calls.',
		thresholds: {},
	},
	successConditions: [{ type: 'api_resilience_configured' }],
	availableNodes: ['circuit_breaker'],
	unlockedNodes: ['circuit_breaker'],
	learningContent: {
		title: 'Resilient API Integration',
		conceptExplanation: `External APIs fail. Be prepared.

**Patterns:**
- Timeouts: Don't wait forever
- Retries: Try again with backoff
- Circuit breaker: Stop calling failed services`,
		railsCodeExample: `# Using Faraday with middleware
connection = Faraday.new do |f|
  f.request :retry, max: 3, interval: 0.5
  f.options.timeout = 5
  f.options.open_timeout = 2
end

# Circuit breaker pattern
class PaymentService
  include CircuitBreaker

  circuit_breaker :charge,
    failure_threshold: 5,
    recovery_timeout: 30

  def charge(amount)
    Stripe::Charge.create(amount: amount)
  end
end

# Fallback
def process_payment
  charge(amount)
rescue CircuitBreaker::OpenError
  queue_for_retry
  render_payment_pending
end`,
		commonMistakes: ['No timeouts', 'Infinite retries', 'No fallback behavior'],
		whenToUse: 'Every external API call.',
		furtherReading: [
			{
				title: 'Circuit Breaker Pattern',
				url: 'https://martinfowler.com/bliki/CircuitBreaker.html',
			},
		],
	},
	hint: { delay: 20, text: 'Add timeouts, retries, and circuit breaker.' },
};

// ============================================
// Level 23: Webhooks
// ============================================

const level23Webhooks: Level = {
	id: 'act4-level23-webhooks',
	actId: 4,
	levelNumber: 23,
	name: 'Webhooks',
	trigger: {
		type: 'new_feature',
		description:
			'Stripe sends payment events via webhooks. How do we handle them?',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Need to receive and process webhook events.',
		rootCause: 'No webhook handling infrastructure.',
		codeExample: `# Webhook endpoint needs:
# 1. Signature verification
# 2. Idempotent processing
# 3. Async handling`,
		goal: 'Implement secure, idempotent webhook handling.',
		thresholds: {},
	},
	successConditions: [{ type: 'webhooks_configured' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Webhook Security & Reliability',
		conceptExplanation: `Webhooks are incoming HTTP requests from external services.

**Requirements:**
- Verify signatures (prevent spoofing)
- Handle duplicates (idempotency)
- Process async (return 200 fast)`,
		railsCodeExample: `# app/controllers/webhooks_controller.rb
class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def stripe
    payload = request.body.read
    sig_header = request.headers['Stripe-Signature']

    begin
      event = Stripe::Webhook.construct_event(
        payload, sig_header, ENV['STRIPE_WEBHOOK_SECRET']
      )
    rescue Stripe::SignatureVerificationError
      return head :bad_request
    end

    # Idempotency: Check if already processed
    return head :ok if WebhookEvent.exists?(event_id: event.id)

    # Record and process async
    WebhookEvent.create!(event_id: event.id, data: event.data)
    ProcessWebhookJob.perform_later(event.id)

    head :ok
  end
end`,
		commonMistakes: [
			'No signature verification',
			'Sync processing',
			'No idempotency',
		],
		whenToUse: 'Any external service integration with webhooks.',
		furtherReading: [
			{ title: 'Stripe Webhooks', url: 'https://stripe.com/docs/webhooks' },
		],
	},
	hint: {
		delay: 20,
		text: 'Verify signature, check idempotency, process async.',
	},
};

// ============================================
// Level 24: File Storage
// ============================================

const level24FileStorage: Level = {
	id: 'act4-level24-file-storage',
	actId: 4,
	levelNumber: 24,
	name: 'File Storage',
	trigger: {
		type: 'scaling',
		description: 'Users upload 4K videos. Memory spikes crash the server.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Large file uploads crash the application.',
		rootCause: 'Files routed through app server instead of direct upload.',
		codeExample: `# BAD: File goes through app
# Browser -> App Server -> S3 (memory spike!)

# GOOD: Direct upload
# Browser -> S3 (direct)
# App only receives URL`,
		goal: 'Configure storage provider, enable direct uploads, and add CDN.',
		thresholds: {},
	},
	successConditions: [{ type: 'storage_configured' }],
	availableNodes: ['s3'],
	unlockedNodes: ['s3'],
	learningContent: {
		title: 'ActiveStorage & Direct Uploads',
		conceptExplanation: `ActiveStorage handles file uploads in Rails.

**Direct Upload:**
- Browser uploads directly to S3
- App server not involved
- No memory pressure`,
		railsCodeExample: `# config/storage.yml
amazon:
  service: S3
  access_key_id: <%= ENV['AWS_ACCESS_KEY_ID'] %>
  secret_access_key: <%= ENV['AWS_SECRET_ACCESS_KEY'] %>
  region: us-east-1
  bucket: myapp-production

# app/models/post.rb
class Post < ApplicationRecord
  has_one_attached :cover_image
  has_many_attached :documents
end

# Direct upload in form
<%= form.file_field :cover_image, direct_upload: true %>

# In JavaScript
import { DirectUpload } from "@rails/activestorage"

const upload = new DirectUpload(file, url)
upload.create((error, blob) => {
  // blob.signed_id to attach to model
})`,
		commonMistakes: ['Large files through app server', 'No CDN for serving'],
		whenToUse: 'Any file uploads, especially > 1MB.',
		furtherReading: [
			{
				title: 'ActiveStorage',
				url: 'https://guides.rubyonrails.org/active_storage_overview.html',
			},
		],
	},
	hint: { delay: 20, text: 'Enable direct_upload: true for large files.' },
};

// ============================================
// Level 25: Idempotency
// ============================================

const level25Idempotency: Level = {
	id: 'act4-level25-idempotency',
	actId: 4,
	levelNumber: 25,
	name: 'Idempotency',
	trigger: {
		type: 'incident',
		description: 'Customer charged twice! Duplicate webhook delivered.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Duplicate requests cause duplicate charges.',
		rootCause: 'Operations are not idempotent.',
		codeExample: `# BAD: Duplicate creates two charges
def charge(amount)
  Stripe::Charge.create(amount: amount)
end

# GOOD: Idempotent with key
def charge(amount, idempotency_key:)
  Stripe::Charge.create(
    amount: amount,
    idempotency_key: idempotency_key
  )
end`,
		goal: 'Make critical operations idempotent.',
		thresholds: {},
	},
	successConditions: [{ type: 'idempotency_configured' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Idempotency Patterns',
		conceptExplanation: `An operation is idempotent if running it multiple times has the same effect as running it once.

**Critical for:**
- Payment processing
- Webhook handling
- API requests`,
		railsCodeExample: `# Database-backed idempotency
class ProcessPayment
  def call(order_id, idempotency_key)
    # Check if already processed
    existing = Payment.find_by(idempotency_key: idempotency_key)
    return existing if existing

    # Use database lock to prevent race conditions
    Payment.transaction do
      payment = Payment.create!(
        order_id: order_id,
        idempotency_key: idempotency_key,
        status: 'pending'
      )

      result = Stripe::Charge.create(
        amount: order.total,
        idempotency_key: idempotency_key
      )

      payment.update!(status: 'completed', stripe_id: result.id)
      payment
    end
  rescue ActiveRecord::RecordNotUnique
    # Race condition: another request won
    Payment.find_by!(idempotency_key: idempotency_key)
  end
end`,
		commonMistakes: [
			'No idempotency key',
			'Race conditions',
			'Retrying non-idempotent operations',
		],
		whenToUse: 'Payment processing, webhooks, any operation with side effects.',
		furtherReading: [
			{
				title: 'Stripe Idempotency',
				url: 'https://stripe.com/docs/api/idempotent_requests',
			},
		],
	},
	hint: { delay: 20, text: 'Use unique keys and check-before-create pattern.' },
};

// ============================================
// Level 26: Health Checks
// ============================================

const level26HealthChecks: Level = {
	id: 'act4-level26-health-checks',
	actId: 4,
	levelNumber: 26,
	name: 'Health Checks',
	trigger: {
		type: 'incident',
		description: 'Kubernetes keeps killing pods. Need proper health checks.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Container orchestrator cannot determine app health.',
		rootCause: 'No health check endpoints.',
		codeExample: `# Kubernetes needs:
# livenessProbe: Is the app alive?
# readinessProbe: Can it handle traffic?`,
		goal: 'Implement liveness, readiness, and deep health checks.',
		thresholds: {},
	},
	successConditions: [{ type: 'health_checks_configured' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Health Checks for Production',
		conceptExplanation: `Three types of health checks:

**Liveness** - Is the process alive? (restart if not)
**Readiness** - Can it handle traffic? (remove from LB if not)
**Deep** - Are all dependencies healthy?`,
		railsCodeExample: `# config/routes.rb
get '/health/live', to: 'health#live'
get '/health/ready', to: 'health#ready'
get '/health/deep', to: 'health#deep'

# app/controllers/health_controller.rb
class HealthController < ApplicationController
  def live
    head :ok
  end

  def ready
    # Check critical dependencies
    ActiveRecord::Base.connection.execute('SELECT 1')
    Rails.cache.read('health_check')
    head :ok
  rescue => e
    render json: { error: e.message }, status: :service_unavailable
  end

  def deep
    checks = {
      database: check_database,
      redis: check_redis,
      sidekiq: check_sidekiq,
      s3: check_s3
    }

    if checks.values.all? { |v| v[:healthy] }
      render json: checks, status: :ok
    else
      render json: checks, status: :service_unavailable
    end
  end
end

# Kubernetes deployment.yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5`,
		commonMistakes: [
			'Heavy checks in liveness',
			'No readiness probe',
			'Checking non-critical services',
		],
		whenToUse: 'Every production deployment.',
		furtherReading: [
			{
				title: 'Kubernetes Probes',
				url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Liveness should be simple, readiness checks dependencies.',
	},
};

// ============================================
// Act 4 Definition
// ============================================

export const actFour: Act = {
	id: 4,
	name: 'Production Ready',
	tagline: 'Building for the Real World',
	description:
		'Prepare your Rails app for production: external APIs, webhooks, file storage, idempotency, and health checks.',
	levels: [
		level22ExternalAPIs,
		level23Webhooks,
		level24FileStorage,
		level25Idempotency,
		level26HealthChecks,
	],
	unlockedNodes: ['circuit_breaker', 's3'],
	metricsVisible: true,
};
