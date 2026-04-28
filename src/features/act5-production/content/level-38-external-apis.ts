import type { Level } from '@/types';

export const level38ExternalAPIs: Level = {
	id: 'act5-level38-external-apis',
	actId: 5,
	levelNumber: 38,
	name: 'External APIs',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'Stripe API returned HTTP 503 for 5 minutes. The ProcessPayment service hung for 30 seconds per request, blocking all Puma threads. Entire app unresponsive.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation:
			'The ProcessPayment service calls Stripe with no timeout, no retry, and no circuit breaker. One failing dependency cascades into total application failure.',
		rootCause:
			'No timeout configured on HTTP client. No retry with backoff. No circuit breaker to stop calling a failing service.',
		codeExample: `# The ProcessPayment service calls Stripe with no resilience.
# No timeout: thread blocks for 30+ seconds
# No retry: transient 503 errors fail immediately
# No circuit breaker: keeps hammering a dead service
#
# app/services/process_payment.rb
class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def call
    validation = PaymentContract.new.call(@params)
    return failure(validation) if validation.failure?

    # HTTParty with no timeout, no retry, no circuit breaker
    response = HTTParty.post(
      'https://api.stripe.com/v1/charges',
      body: { amount: @params[:amount] }
    )
    # If Stripe is down, ALL of our app is down
    payment = @user.payments.create!(stripe_id: response["id"])
    Result.new(success?: true, payment:, errors: {})
  end
end`,
		goal: 'Make external API calls resilient with timeouts, retries with exponential backoff, and a circuit breaker that fails fast when the service is down.',
		thresholds: {},
	},
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Resilient External API Integration',
		goal: `In this level, you'll:\n- learn how to call external APIs without letting their failures take down your app.\n- set timeouts on every HTTP call.\n- implement retries with exponential backoff for transient errors.\n- use the circuit breaker pattern to fail fast when an external service is unresponsive.`,
		conceptExplanation: `External APIs will fail. Your app must not fail with them.

**Three layers of resilience:**

1. **Timeouts** (always set these):
   - \`open_timeout\`: Max time to establish connection (2-5 seconds)
   - \`read_timeout\`: Max time to receive response (5-15 seconds)
   - Without timeouts, a hung API blocks your thread forever

2. **Retries with exponential backoff**:
   - Retry on 5xx errors and timeouts (NOT on 4xx)
   - Exponential backoff: 1s, 2s, 4s, 8s... (prevents thundering herd)
   - Add jitter (random delay) to spread retries
   - Max 3 retries, then give up

3. **Circuit breaker**:
   - Tracks failure count over a window
   - **Closed** (normal): Requests pass through
   - **Open** (broken): Fails immediately without calling the API
   - **Half-open** (testing): Allows one request to test recovery
   - Prevents cascading failures when a service is down

**Idempotency-Key for safe POST retries:**
Retrying a GET is safe; retrying a POST risks duplicating a charge or creating two of the same record. The fix is the \`Idempotency-Key\` header. Stripe (and modern APIs in general) accept a client-generated unique key per logical operation; if Stripe sees the same key twice, the second call returns the cached response from the first without re-running the work:

\`\`\`ruby
def create_charge(amount_cents:, idempotency_key:)
  @connection.post('/v1/charges', { amount: amount_cents }) do |req|
    req.headers['Idempotency-Key'] = idempotency_key
  end
end

# Caller generates a stable key per logical operation, NOT a fresh UUID per attempt
PaymentService.new.charge(
  amount_cents: order.total_cents,
  idempotency_key: "order-charge-#{order.id}"
)
\`\`\`
The key must be stable across retries. \`SecureRandom.uuid\` per call defeats the purpose; use the business-level identifier (order id, invoice id) so retries dedupe correctly. With this header in place, the "don't retry POST" rule from the example becomes "you CAN retry POST, but only with an Idempotency-Key."

**Connection pooling:**
Opening a new TLS connection to Stripe per request costs ~100-300ms (TCP handshake + TLS handshake). At any meaningful volume this becomes the dominant latency. Faraday with the \`net-http-persistent\` or \`excon\` adapter keeps connections warm:

\`\`\`ruby
Faraday.new(url: 'https://api.stripe.com') do |f|
  f.adapter :net_http_persistent, pool_size: 5
end
\`\`\`
At scale, connection pool exhaustion is itself a bug class: if every Puma thread tries to call Stripe and the pool has 2 connections, threads queue up waiting for a connection. Size the pool to match thread count.

**Bulkhead pattern (one failing dependency does not exhaust everything):**
A circuit breaker prevents calls to a known-failing service. A BULKHEAD limits concurrent calls to ANY one service so that a slow dependency cannot consume all your threads before the breaker trips. Pattern: per-service connection pool + per-service queue. \`stoplight\` plus a per-service Faraday connection achieves this.

**Secrets, not logs:**
Production logs go to a centralized service (Datadog, Sentry, S3). Logging the full request body for debugging is fine in dev, dangerous in prod: API keys, credit card numbers, PII can leak. Two safe patterns:
- Log request shape (method, path, status, duration) but never the body or auth headers.
- Use a logger middleware that filters known-sensitive headers (\`Authorization\`, \`Idempotency-Key\` is fine, \`X-Api-Key\` is not).

\`\`\`ruby
Faraday.new(...) do |f|
  f.response :logger, Rails.logger, headers: false, bodies: false
end
\`\`\`
The default Faraday logger is too permissive for production.

**Credentials over ENV:**
\`ENV['STRIPE_SECRET_KEY']\` works but rotates poorly: leaking the value of an ENV var leaks it forever, and "rotate this key" requires a deploy. \`Rails.application.credentials.dig(:stripe, :secret_key)\` lives in the encrypted credentials file, can be edited via \`bin/rails credentials:edit\`, and ships in version control as ciphertext. The master key is the only thing that lives outside the repo.

**TLS verification stays ON in production:**
Some tutorials show \`verify_mode: OpenSSL::SSL::VERIFY_NONE\` to "make it work in dev." That setting MUST never reach production: it disables certificate verification and turns the HTTPS connection into a plaintext connection from the security perspective (man-in-the-middle becomes trivial). If a CA cert is missing in dev, fix the cert chain, do not disable verification.

**Failure budget / SLO awareness:**
Circuit breaker thresholds need data. "Open after 5 failures" is reasonable when the dependency normally has 99.9%+ success rate. If Stripe is at 95% success rate due to legitimate flake, 5 failures arrive in normal operation and your breaker trips against a healthy service. Track per-dependency success rate, set thresholds based on the baseline. Tools like Datadog or Honeycomb make this measurement free.`,
		railsCodeExample: `# Faraday with resilience middleware
class StripeClient
  TIMEOUT = 10       # seconds
  OPEN_TIMEOUT = 3   # seconds
  MAX_RETRIES = 3

  def initialize
    @connection = Faraday.new(url: 'https://api.stripe.com') do |f|
      f.request :authorization, 'Bearer', ENV['STRIPE_SECRET_KEY']
      f.request :json
      f.request :retry, {
        max: MAX_RETRIES,
        interval: 0.5,
        interval_randomness: 0.5,  # Jitter
        backoff_factor: 2,         # Exponential: 0.5s, 1s, 2s
        retry_statuses: [429, 500, 502, 503, 504],
        retry_if: ->(env, _exc) { env.method != :post }  # Don't retry POST!
      }
      f.response :json
      f.options.timeout = TIMEOUT
      f.options.open_timeout = OPEN_TIMEOUT
    end
  end

  def create_charge(amount_cents:, currency: 'usd', idempotency_key:)
    @connection.post('/v1/charges', {
      amount: amount_cents,
      currency: currency
    }) do |req|
      req.headers['Idempotency-Key'] = idempotency_key
    end
  rescue Faraday::TimeoutError => e
    Rails.logger.error("Stripe timeout: #{e.message}")
    raise PaymentTimeoutError
  rescue Faraday::ConnectionFailed => e
    Rails.logger.error("Stripe connection failed: #{e.message}")
    raise PaymentConnectionError
  end
end

# Circuit breaker with the stoplight gem
require 'stoplight'

class PaymentService
  def charge(order)
    Stoplight('stripe-charges')
      .with_threshold(5)           # Open after 5 failures
      .with_cool_off_time(30)      # Try again after 30s
      .with_error_handler do |error, handle|
        raise error if error.is_a?(Stripe::InvalidRequestError) # Don't trip on 4xx
        handle.call(error)
      end
      .run do
        stripe_client.create_charge(
          amount_cents: order.total_cents,
          idempotency_key: order.idempotency_key
        )
      end
  rescue Stoplight::Error::RedLight
    # Circuit is open - fail fast
    order.update!(status: 'payment_pending')
    PaymentRetryJob.perform_in(5.minutes, order.id)
    { status: 'pending', message: 'Payment queued for processing' }
  end
end

# Wrapper pattern for any external service
module Resilient
  def self.call(service_name, timeout: 10, retries: 3, &block)
    Timeout.timeout(timeout) do
      Stoplight(service_name)
        .with_threshold(5)
        .with_cool_off_time(60)
        .run(&block)
    end
  rescue Timeout::Error
    raise ServiceTimeoutError, "#{service_name} timed out"
  rescue Stoplight::Error::RedLight
    raise CircuitOpenError, "#{service_name} circuit is open"
  end
end

# Usage:
result = Resilient.call('stripe') do
  stripe_client.create_charge(amount: 1000)
end`,
		commonMistakes: [
			'No timeouts on HTTP clients (threads block indefinitely)',
			'Retrying POST requests without idempotency keys (double charges)',
			'No circuit breaker (one failing service takes down everything)',
			'Retrying on 4xx errors (client errors will never succeed)',
			'Not logging failures for observability and alerting',
			'Generating a fresh Idempotency-Key per retry attempt (defeats the purpose; the key must be stable across retries of the same logical operation, e.g. derived from the order id)',
			'New TCP+TLS connection per API call instead of a persistent connection pool (handshake latency dominates request time at any volume)',
			'One global HTTP connection pool shared across all dependencies (Stripe slowness exhausts the pool and blocks Twilio, Postmark, and everyone else). Use per-service pools',
			'Storing API keys in ENV instead of Rails credentials (rotating ENV requires a deploy; credentials supports per-environment files and edits without leaking the value)',
			'Disabling TLS verification (verify_mode: VERIFY_NONE) to "make it work in dev" and shipping that to prod (turns HTTPS into plaintext from the security model)',
			'Logging full request/response bodies (leaks API keys, credit card numbers, PII to centralized log service)',
			'Setting circuit breaker thresholds without measuring the baseline success rate (5 failures trips against a healthy service if normal flake is higher than that)',
		],
		whenToUse:
			'Every single external API call. No exceptions. If it crosses a network boundary, it needs timeouts and error handling.',
		furtherReading: [
			{
				title: 'Circuit Breaker Pattern',
				url: 'https://martinfowler.com/bliki/CircuitBreaker.html',
			},
			{
				title: 'Faraday HTTP Client',
				url: 'https://lostisland.github.io/faraday/',
			},
			{
				title: 'Stoplight Gem (Circuit Breaker)',
				url: 'https://github.com/bolshakov/stoplight',
			},
			{
				title: 'Stripe Idempotent Requests',
				url: 'https://stripe.com/docs/api/idempotent_requests',
			},
			{
				title: 'net-http-persistent (connection pooling)',
				url: 'https://github.com/drbrain/net-http-persistent',
			},
			{
				title: 'Bulkhead pattern (Microsoft Azure docs)',
				url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Set timeouts on the HTTP client, add retries with exponential backoff for 5xx only, and wrap the call in a circuit breaker that fails fast.',
	},
};
