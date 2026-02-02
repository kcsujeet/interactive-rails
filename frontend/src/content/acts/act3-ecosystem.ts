/**
 * Act III: The Ecosystem
 * "Async & Integration."
 *
 * Levels 13-18: Performance, Resiliency, External Tools
 */

import type { Act, Level } from '../../components/game/types';

// ============================================
// Level 13: 3rd Party APIs & Timeouts
// ============================================

const level13ThirdPartyAPIs: Level = {
  id: 'act3-level13-third-party-apis',
  actId: 3,
  levelNumber: 13,
  name: '3rd Party APIs & Timeouts',
  trigger: {
    type: 'outage',
    description: 'The GitHub API is down. It\'s taking down our entire homepage.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 360, y: 250, locked: true },
      { id: 'external-api', type: 'external_api', x: 520, y: 250, locked: true, config: { label: 'GitHub API' } },
      { id: 'view-node', type: 'view', x: 680, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 840, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'external-api' },
      { id: 'c4', sourceNodeId: 'external-api', targetNodeId: 'view-node' },
      { id: 'c5', sourceNodeId: 'view-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Homepage loading spins forever because of one widget.',
    rootCause: 'External API call has no timeout. When GitHub is down, the page hangs.',
    codeExample: `# Current: No timeout, no fallback
def index
  @repos = HTTParty.get('https://api.github.com/users/me/repos')
  # If GitHub is slow/down, page hangs forever!
end`,
    goal: 'Add a timeout wrapper and fallback UI for when the API is unavailable.',
    thresholds: {
      maxLatency: 500,
    },
  },
  successConditions: [
    { type: 'node_present', nodeType: 'circuit_breaker' },
    { type: 'connection', sourceType: 'controller', targetType: 'circuit_breaker' },
    { type: 'connection', sourceType: 'circuit_breaker', targetType: 'external_api' },
  ],
  availableNodes: ['circuit_breaker'],
  unlockedNodes: ['redis', 'worker'],
  learningContent: {
    title: 'Failing Gracefully: Timeouts & Fallbacks',
    conceptExplanation: `External APIs will fail. Prepare for it:

**Timeouts** - Don't wait forever
**Fallbacks** - Show something instead of nothing
**Circuit Breakers** - Stop hammering broken services

Fail fast, degrade gracefully.`,
    railsCodeExample: `# With Faraday and timeouts
conn = Faraday.new do |f|
  f.options.timeout = 2      # 2 second timeout
  f.options.open_timeout = 1
end

# With circuit breaker (stoplight gem)
light = Stoplight('github-api')
  .with_fallback { [] }  # Return empty array on failure
  .run { fetch_repos }`,
    commonMistakes: [
      'No timeout on HTTP calls',
      'Letting one widget crash the whole page',
      'Not having fallback UI',
    ],
    whenToUse: 'Every external API call needs a timeout and fallback.',
    furtherReading: [
      { title: 'Faraday Timeouts', url: 'https://lostisland.github.io/faraday/' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Add a Circuit Breaker node before the External API. Configure timeout and fallback.',
  },
};

// ============================================
// Level 14: Background Jobs (Sidekiq)
// ============================================

const level14BackgroundJobs: Level = {
  id: 'act3-level14-background-jobs',
  actId: 3,
  levelNumber: 14,
  name: 'Background Jobs (Sidekiq)',
  trigger: {
    type: 'incident',
    description: 'Generating a PDF Report takes 10 seconds. The browser times out.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 360, y: 250, locked: false },
      { id: 'service-node', type: 'service', x: 520, y: 250, locked: true, config: { label: 'PDFGenerator' } },
      { id: 'response-node', type: 'response', x: 720, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'service-node' },
      { id: 'c4', sourceNodeId: 'service-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Browser request hanging. 504 Gateway Timeout errors.',
    rootCause: 'Long-running operation blocking the request.',
    codeExample: `# Current: Blocking request
def generate_report
  @report = PDFGenerator.generate(params)  # Takes 10 seconds!
  send_data @report.pdf
end

# Browser times out after 30 seconds`,
    goal: 'Move PDF generation to a background job. Return immediately with "Processing" status.',
    thresholds: {
      maxLatency: 500,
    },
  },
  successConditions: [
    { type: 'node_present', nodeType: 'redis' },
    { type: 'node_present', nodeType: 'worker' },
    { type: 'connection', sourceType: 'controller', targetType: 'redis' },
    { type: 'connection', sourceType: 'redis', targetType: 'worker' },
  ],
  availableNodes: ['redis', 'worker'],
  unlockedNodes: ['mailer'],
  learningContent: {
    title: 'Sidekiq: Asynchronous Processing',
    conceptExplanation: `Long tasks should run in the background:

1. Request enqueues job → Redis
2. Response returns immediately (202 Accepted)
3. Worker picks up job from queue
4. Job processes asynchronously

This keeps requests fast and workers busy.`,
    railsCodeExample: `# app/jobs/pdf_generator_job.rb
class PdfGeneratorJob < ApplicationJob
  queue_as :default

  def perform(report_id)
    report = Report.find(report_id)
    pdf = PDFGenerator.generate(report)
    report.update!(pdf: pdf, status: 'complete')
  end
end

# Controller enqueues, returns immediately
def create
  @report = Report.create!(status: 'processing')
  PdfGeneratorJob.perform_later(@report.id)
  render json: { status: 'processing', id: @report.id }
end`,
    commonMistakes: [
      'Processing heavy tasks in request cycle',
      'Not handling job failures',
      'Forgetting to configure Redis',
    ],
    whenToUse: 'Any task taking more than 1-2 seconds.',
    furtherReading: [
      { title: 'Sidekiq', url: 'https://github.com/sidekiq/sidekiq' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Add Redis and Worker nodes. Route Controller → Redis → Worker. Move PDFGenerator to Worker.',
  },
};

// ============================================
// Level 15: Idempotency
// ============================================

const level15Idempotency: Level = {
  id: 'act3-level15-idempotency',
  actId: 3,
  levelNumber: 15,
  name: 'Idempotency',
  trigger: {
    type: 'incident',
    description: 'The Worker retried the "Charge" job twice because of a network blip. Customer charged twice!',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 220, y: 250, locked: true },
      { id: 'redis-node', type: 'redis', x: 380, y: 250, locked: true },
      { id: 'worker-node', type: 'worker', x: 540, y: 250, locked: false, config: { label: 'ChargeWorker' } },
      { id: 'external-api', type: 'external_api', x: 700, y: 250, locked: true, config: { label: 'Stripe' } },
      { id: 'response-node', type: 'response', x: 860, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'controller-node' },
      { id: 'c2', sourceNodeId: 'controller-node', targetNodeId: 'redis-node' },
      { id: 'c3', sourceNodeId: 'redis-node', targetNodeId: 'worker-node' },
      { id: 'c4', sourceNodeId: 'worker-node', targetNodeId: 'external-api' },
      { id: 'c5', sourceNodeId: 'redis-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Worker processing the same red particle twice. Double charges!',
    rootCause: 'Job is not idempotent. Retries cause duplicate actions.',
    codeExample: `# Current: Non-idempotent job
class ChargeWorker
  def perform(order_id)
    order = Order.find(order_id)
    Stripe::Charge.create(amount: order.total)
    # If this fails AFTER charge but BEFORE marking complete,
    # retry will charge again!
  end
end`,
    goal: 'Add idempotency lock using Redis. Duplicate jobs should be safely ignored.',
    thresholds: {},
  },
  successConditions: [
    { type: 'decision_made', decisionValue: 'idempotent' },
  ],
  availableNodes: [],
  unlockedNodes: ['cache'],
  decisionModals: [
    {
      trigger: { sourceType: 'redis', targetType: 'worker' },
      question: 'How should the Worker handle retries?',
      options: [
        {
          label: 'No Lock (Default)',
          value: 'no_lock',
          preview: 'Job runs every time it\'s enqueued',
          consequence: 'Duplicate charges possible',
          correct: false,
        },
        {
          label: 'Idempotency Lock',
          value: 'idempotent',
          preview: 'Duplicate jobs are safely ignored',
          consequence: 'Charges only once, retries are no-ops',
          correct: true,
        },
      ],
    },
  ],
  learningContent: {
    title: 'Idempotency: Safe Retries',
    conceptExplanation: `An idempotent operation produces the same result whether run once or multiple times.

Jobs WILL retry. Design for it:
- Use unique job IDs
- Check if already processed
- Use database constraints

"If it can happen twice, assume it will."`,
    railsCodeExample: `# With sidekiq-unique-jobs
class ChargeWorker
  include Sidekiq::Worker
  sidekiq_options lock: :until_executed

  def perform(order_id)
    order = Order.find(order_id)
    return if order.charged?  # Already done

    Stripe::Charge.create(
      amount: order.total,
      idempotency_key: "order-#{order.id}"  # Stripe handles it
    )
    order.update!(charged: true)
  end
end`,
    commonMistakes: [
      'Assuming jobs only run once',
      'Not using idempotency keys for external APIs',
      'Checking state after side effect',
    ],
    whenToUse: 'Every job that has side effects (charges, emails, etc.).',
    furtherReading: [
      { title: 'Idempotency Keys', url: 'https://stripe.com/docs/api/idempotent_requests' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Configure the Worker connection. Select "Idempotency Lock" to prevent duplicate processing.',
  },
};

// ============================================
// Level 16: Caching Strategy
// ============================================

const level16Caching: Level = {
  id: 'act3-level16-caching',
  actId: 3,
  levelNumber: 16,
  name: 'Caching Strategy',
  trigger: {
    type: 'traffic_spike',
    description: 'The "Trending Posts" query is hammering the DB. 99% Read traffic.',
    intensity: 10,
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 360, y: 250, locked: true },
      { id: 'model-node', type: 'model', x: 520, y: 250, locked: true, config: { label: 'Post' } },
      { id: 'database-node', type: 'database', x: 680, y: 250, locked: true },
      { id: 'view-node', type: 'view', x: 840, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 1000, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
      { id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c5', sourceNodeId: 'database-node', targetNodeId: 'view-node' },
      { id: 'c6', sourceNodeId: 'view-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'DB Load 100%. Same query running thousands of times.',
    rootCause: 'No caching layer. Every request hits the database.',
    codeExample: `# Current: DB hit on every request
def index
  @trending = Post.order(views: :desc).limit(10)
  # 1000 requests = 1000 identical queries!
end`,
    goal: 'Add a Cache (Redis) node. First request is a miss, subsequent requests are hits.',
    thresholds: {
      maxQueriesPerRequest: 2,
    },
  },
  successConditions: [
    { type: 'node_present', nodeType: 'cache' },
    { type: 'connection', sourceType: 'model', targetType: 'cache' },
    { type: 'connection', sourceType: 'cache', targetType: 'database' },
  ],
  availableNodes: ['cache'],
  unlockedNodes: ['webhook_endpoint'],
  learningContent: {
    title: 'Read-Through Caching with Redis',
    conceptExplanation: `Caching reduces database load:

1. Check cache first
2. If miss, query database
3. Store result in cache
4. Return result

Subsequent requests get cached data (fast!).

Green particles = cache hit (instant)
Red particles = cache miss (goes to DB)`,
    railsCodeExample: `# Read-through cache pattern
def trending_posts
  Rails.cache.fetch('trending_posts', expires_in: 5.minutes) do
    Post.order(views: :desc).limit(10).to_a
  end
end

# First request: cache miss → DB → cache
# Next 1000 requests: cache hit → instant`,
    commonMistakes: [
      'Caching user-specific data without cache key',
      'Setting TTL too long (stale data)',
      'Not handling cache failures gracefully',
    ],
    whenToUse: 'Frequently read, rarely changed data.',
    furtherReading: [
      { title: 'Rails Caching', url: 'https://guides.rubyonrails.org/caching_with_rails.html' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Add a Cache node between Model and Database. Watch cache hits turn green.',
  },
};

// ============================================
// Level 17: Webhooks (Incoming)
// ============================================

const level17Webhooks: Level = {
  id: 'act3-level17-webhooks',
  actId: 3,
  levelNumber: 17,
  name: 'Webhooks',
  trigger: {
    type: 'new_feature',
    description: 'We handle payments, but we don\'t know when they succeed until the user refreshes.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 180, locked: true },
      { id: 'controller-node', type: 'controller', x: 240, y: 180, locked: true },
      { id: 'external-api', type: 'external_api', x: 420, y: 180, locked: true, config: { label: 'Stripe' } },
      { id: 'model-node', type: 'model', x: 600, y: 180, locked: true, config: { label: 'Payment' } },
      { id: 'database-node', type: 'database', x: 760, y: 180, locked: true },
      { id: 'response-node', type: 'response', x: 920, y: 180, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'controller-node' },
      { id: 'c2', sourceNodeId: 'controller-node', targetNodeId: 'external-api' },
      { id: 'c3', sourceNodeId: 'external-api', targetNodeId: 'model-node' },
      { id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c5', sourceNodeId: 'database-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'User staring at "Pending..." screen. Payment might have succeeded already.',
    rootCause: 'No async callback from Stripe when payment completes.',
    codeExample: `# Current: We create a payment intent
Stripe::PaymentIntent.create(amount: 1000)
# Then we wait... and wait... and poll...

# User sees "Pending" until they refresh
# We don't know when Stripe confirms the payment!`,
    goal: 'Add a Webhook Endpoint to receive async callbacks from Stripe.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'webhook_endpoint' },
    { type: 'connection', sourceType: 'external_api', targetType: 'webhook_endpoint' },
  ],
  availableNodes: ['webhook_endpoint'],
  unlockedNodes: ['storage'],
  learningContent: {
    title: 'Webhooks: Async Callbacks',
    conceptExplanation: `Webhooks let external services notify YOU:

1. Configure endpoint URL in Stripe dashboard
2. Stripe sends POST when events happen
3. Your app updates state immediately

No polling. Real-time updates.`,
    railsCodeExample: `# app/controllers/webhooks_controller.rb
class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def stripe
    payload = request.body.read
    sig = request.headers['Stripe-Signature']
    event = Stripe::Webhook.construct_event(
      payload, sig, ENV['STRIPE_WEBHOOK_SECRET']
    )

    case event.type
    when 'payment_intent.succeeded'
      payment = Payment.find_by(stripe_id: event.data.object.id)
      payment.update!(status: 'completed')
    end

    head :ok
  end
end`,
    commonMistakes: [
      'Not verifying webhook signatures',
      'Processing webhooks synchronously (blocking)',
      'Not handling duplicate webhook deliveries',
    ],
    whenToUse: 'Any integration where you need real-time updates.',
    furtherReading: [
      { title: 'Stripe Webhooks', url: 'https://stripe.com/docs/webhooks' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Add a Webhook Endpoint node. Connect Stripe API to send callbacks to it.',
  },
};

// ============================================
// Level 18: File Storage (ActiveStorage)
// ============================================

const level18FileStorage: Level = {
  id: 'act3-level18-file-storage',
  actId: 3,
  levelNumber: 18,
  name: 'File Storage (ActiveStorage)',
  trigger: {
    type: 'incident',
    description: 'Users are uploading 4K Images. App server RAM is exhausted buffering them.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 360, y: 250, locked: true },
      { id: 'model-node', type: 'model', x: 520, y: 250, locked: true },
      { id: 'database-node', type: 'database', x: 680, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 840, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
      { id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c5', sourceNodeId: 'database-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Server crashing on upload. Memory exhausted.',
    rootCause: 'Large files passing through app server.',
    codeExample: `# Current: File goes through Rails
def create
  @photo = Photo.new
  @photo.image.attach(params[:file])  # 50MB buffered in RAM!
  @photo.save
end

# Server RAM: 512MB. File: 50MB × 10 concurrent = CRASH`,
    goal: 'Add S3 storage with Direct Upload. Files bypass the app server.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'storage' },
    { type: 'connection', sourceType: 'request', targetType: 'storage' },
  ],
  availableNodes: ['storage'],
  unlockedNodes: ['event_bus'],
  learningContent: {
    title: 'ActiveStorage: Direct Uploads to S3',
    conceptExplanation: `Direct Upload flow:

1. Client asks Rails for presigned URL
2. Rails returns S3 upload URL
3. Client uploads directly to S3 (bypasses app)
4. Client tells Rails the upload is done
5. Rails associates blob with record

Large files never touch your server.`,
    railsCodeExample: `# config/storage.yml
amazon:
  service: S3
  access_key_id: <%= ENV['AWS_ACCESS_KEY_ID'] %>
  secret_access_key: <%= ENV['AWS_SECRET_ACCESS_KEY'] %>
  region: us-east-1
  bucket: my-bucket

# app/models/photo.rb
class Photo < ApplicationRecord
  has_one_attached :image, service: :amazon
end

# Enable direct upload in JavaScript
import { DirectUpload } from "@rails/activestorage"`,
    commonMistakes: [
      'Not using direct upload for large files',
      'Storing files on ephemeral filesystem',
      'Not setting file size limits',
    ],
    whenToUse: 'Any file upload, especially files > 1MB.',
    furtherReading: [
      { title: 'ActiveStorage', url: 'https://guides.rubyonrails.org/active_storage_overview.html' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Add an S3 Storage node. Connect Request directly to Storage (bypass app for uploads).',
  },
};

// ============================================
// Act III Definition
// ============================================

export const actThree: Act = {
  id: 3,
  name: 'The Ecosystem',
  tagline: 'Async & Integration.',
  description: 'Performance, Resiliency, and External Tools. Build systems that scale and recover.',
  levels: [
    level13ThirdPartyAPIs,
    level14BackgroundJobs,
    level15Idempotency,
    level16Caching,
    level17Webhooks,
    level18FileStorage,
  ],
  unlockedNodes: ['circuit_breaker', 'redis', 'worker', 'cache', 'webhook_endpoint', 'storage'],
  metricsVisible: true, // Metrics become visible in Act III
  visibleMetrics: ['latency', 'queryCount', 'cacheHitRate', 'errorRate'],
};
