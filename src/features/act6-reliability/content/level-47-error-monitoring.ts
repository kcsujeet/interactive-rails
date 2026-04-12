import type { Level } from '@/types';
import { middlewarePipeline } from '@/utils/pipelineTemplates';

export const level42ErrorMonitoring: Level = {
	id: 'act6-level47-error-monitoring',
	actId: 6,
	levelNumber: 47,
	name: 'Structured Error Monitoring',
	trigger: {
		type: 'user_complaint',
		description:
			'500 errors in production but nobody notices until users complain on Twitter. Request logging (L41) captures requests, but exceptions are not tracked with context, grouped, or alerted on.',
	},
	startingPipeline: middlewarePipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'Request logging from L41 captures requests, but when exceptions occur, they are written to the log with no error-specific context. The team only finds out about 500 errors when users tweet about it.',
		rootCause:
			'No structured error monitoring. Exceptions are logged but not captured with user context, grouped by type, or alerted on. Request logging shows what happened, but not why it failed.',
		codeExample: `# Current error handling: nothing
class Api::V1::ProductsController < Api::BaseController
  def show
    result = FetchProduct.call(id: params[:id])
    if result.success?
      render json: Api::V1::ProductSerializer
        .new(result.resource).serializable_hash
    end
  end
  # ActiveRecord::RecordNotFound => 500 Internal Server Error
  # No context, no alert, no grouping
end

# Production log:
# [ERROR] ActiveRecord::RecordNotFound: Couldn't find Product with 'id'=999
# ...and that's it. No user context, no request ID, no breadcrumbs.

# Questions we can't answer:
# - How many users are affected?
# - Is this a new error or recurring?
# - What was the user doing when it happened?
# - Is this getting worse or better?
# - Are we within our error budget?`,
		goal: 'Implement structured error monitoring with context, grouping, alerting, and error budgets.',
		thresholds: { maxErrorRate: 0.005 },
	},
	successConditions: [{ type: 'error_monitoring_configured' }],
	availableNodes: ['error_monitor'],
	unlockedNodes: ['error_monitor'],
	learningContent: {
		title: 'Structured Error Monitoring & SLOs',
		goal: `In this level, you'll:
- set up structured error monitoring so you know when things break in production before your users tell you.
- report errors with rich context like user ID and request ID so you can reproduce issues quickly.
- route errors to a monitoring service for grouping, alerting, and prioritization.`,
		conceptExplanation: `**Error monitoring** transforms raw exceptions into actionable insights:

**Without SLOs:**
\`\`\`
PagerDuty fires at 3 AM: "High error rate"
Team: "Is this a real problem or a blip?"
      "What's the normal error rate?"
      "Should we wake more people up?"
No answers. Every alert feels equally urgent.
\`\`\`

**With SLOs:**
\`\`\`
SLO:           p95 latency ≤ 200ms, 99% of the time, 30-day rolling window
Current:       99.3%, within budget
Error budget:  0.3% remaining (was 1%)
Alert:         "Error budget at 30%, freeze risky deploys"
Decision:      Clear, data-driven, no guesswork
\`\`\`

**SLOs, SLIs, and error budgets explained:**
- **SLI (Service Level Indicator):** The metric being measured (e.g., latency p95)
- **SLO (Service Level Objective):** The goal (e.g., p95 ≤ 200ms, 99% of the time over 30-day window)
- **SLA (Service Level Agreement):** Contractual agreement with customers (consequences if breached)
- **Error budget:** If SLO is 99%, you have 1% budget for failures. Spend it on risky deploys/experiments. When exhausted → freeze features, fix reliability

**Latency percentiles (measure what matters):**
- **p50 (median):** Half of requests faster, half slower. Hides tail latency
- **p75:** 75% of requests faster than this value
- **p90:** 90% of requests. Starting to see edge cases
- **p95 (industry standard):** Captures the experience of 1-in-20 users. Alert on this, not averages
- **p99:** Worst 1%. Often reveals infrastructure problems
- **p99.9:** Extreme outliers. GC pauses, network hiccups, cold caches
- **Why not averages?** A 200ms average can hide a p99 of 5 seconds. Averages lie; percentiles reveal the tail

**Monitoring cost warning:** Coinbase spent $65M/year on Datadog. Temporary metrics from old projects linger forever. Review periodically and delete unused dashboards and metrics.

**Key capabilities:**
- **Grouping:** Same error type from different users grouped together
- **Context:** User ID, request params, breadcrumbs attached to every error
- **Alerting:** Slack/PagerDuty notifications when error rate spikes
- **Trends:** Is this error getting worse or better over time?

**Layers of error handling:**
1. **Rescue + respond:** Handle known errors gracefully (404, 422)
2. **Report:** Send unknown errors to monitoring service
3. **Context:** Attach user, request, and breadcrumb data
4. **Alert:** Notify the team based on severity and frequency
5. **Budget:** Track error rate against SLO targets

**Rails 8 ErrorReporter:**
Rails 8 has a built-in \`Rails.error\` reporter that integrates with external services (Sentry, Honeybadger, etc.).`,
		railsCodeExample: `# ============================
# Rails 8 Error Reporter Setup
# ============================

# config/initializers/error_reporting.rb
# Rails 8 built-in error reporter with custom subscriber
Rails.error.subscribe(ErrorSubscriber.new)

# app/lib/error_subscriber.rb
class ErrorSubscriber
  def report(error, handled:, severity:, context:, source: nil)
    # Send to Sentry (or Honeybadger, Bugsnag, etc.)
    Sentry.capture_exception(error, extra: context)

    # Also log structured JSON
    Rails.logger.error({
      error: error.class.name,
      message: error.message,
      handled: handled,
      severity: severity,
      context: context,
      source: source,
      backtrace: error.backtrace&.first(10)
    }.to_json)
  end
end

# ============================
# Structured Error Handling
# ============================

# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  # Set error context for every request
  before_action :set_error_context

  # Handle known errors gracefully (don't send to error tracker)
  rescue_from ActiveRecord::RecordNotFound do |e|
    render json: { error: "Not found" }, status: :not_found
  end

  rescue_from ActiveRecord::RecordInvalid do |e|
    render json: { errors: e.record.errors }, status: :unprocessable_entity
  end

  rescue_from ActionController::ParameterMissing do |e|
    render json: { error: e.message }, status: :bad_request
  end

  private

  def set_error_context
    Rails.error.set_context(
      user_id: current_user&.id,
      request_id: request.request_id,
      ip: request.remote_ip,
      path: request.path,
      method: request.method,
      user_agent: request.user_agent
    )
  end
end

# ============================
# Using Rails.error in Application Code
# ============================

class Api::V1::PostsController < ApplicationController
  def create
    product = Product.new(product_params)

    # Rails.error.handle: captures error but continues execution
    Rails.error.handle(fallback: nil) do
      NotificationService.notify_followers(post.author)
    end

    if post.save
      render json: ProductSerializer.new(product).serializable_hash.to_json, status: :created
    else
      render json: { errors: post.errors }, status: :unprocessable_entity
    end
  end
end

class PaymentService
  def process(order)
    # Rails.error.record: captures error AND re-raises it
    Rails.error.record(severity: :error, context: { order_id: order.id }) do
      gateway.charge(order.total_cents)
    end
  end
end

# ============================
# Error Budgets with Recurring Job
# ============================

# app/jobs/error_budget_check_job.rb
class ErrorBudgetCheckJob < ApplicationJob
  # SLO: 99.9% success rate (0.1% error budget)
  ERROR_BUDGET = 0.001

  def perform
    window = 1.hour.ago..Time.current
    total = RequestLog.where(created_at: window).count
    errors = RequestLog.where(created_at: window, status: 500..599).count

    return if total.zero?

    error_rate = errors.to_f / total

    if error_rate > ERROR_BUDGET
      AlertService.fire!(
        severity: :critical,
        message: "Error budget exceeded: #{(error_rate * 100).round(3)}% " \
                 "(budget: #{(ERROR_BUDGET * 100).round(3)}%)",
        details: {
          total_requests: total,
          error_count: errors,
          error_rate: error_rate,
          budget: ERROR_BUDGET
        }
      )
    end

    # Log for dashboard regardless
    Rails.logger.info({
      event: "error_budget_check",
      total_requests: total,
      error_count: errors,
      error_rate: error_rate.round(6),
      budget: ERROR_BUDGET,
      within_budget: error_rate <= ERROR_BUDGET
    }.to_json)
  end
end

# config/recurring.yml
production:
  error_budget_check:
    class: ErrorBudgetCheckJob
    schedule: every 5 minutes
    description: "Check error rate against SLO budget"

# ============================
# Sentry Configuration (Rails 8)
# ============================

# Gemfile
gem "sentry-ruby"
gem "sentry-rails"

# config/initializers/sentry.rb
Sentry.init do |config|
  config.dsn = Rails.application.credentials.sentry_dsn
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]
  config.traces_sample_rate = 0.1  # 10% of requests traced
  config.profiles_sample_rate = 0.1

  config.environment = Rails.env
  config.release = ENV.fetch("GIT_SHA", "unknown")

  # Filter sensitive params before sending
  config.before_send = lambda do |event, hint|
    event.request&.data&.except!("password", "token", "secret", "api_key")
    event
  end

  # Don't send common expected errors
  config.excluded_exceptions += [
    "ActionController::RoutingError",
    "ActiveRecord::RecordNotFound"
  ]
end`,
		commonMistakes: [
			'Rescuing StandardError globally (hides real bugs)',
			'Not attaching user context to error reports',
			'Alerting on every single error (alert fatigue)',
			'No error budgets or SLOs (no way to measure reliability)',
			'Logging errors as unstructured text (impossible to query)',
			'Not filtering sensitive data before sending to error service',
			'Sending expected errors (404, 422) to the error tracker (noise)',
		],
		whenToUse:
			'Every production application. Set up error monitoring before launch, not after the first outage.',
		furtherReading: [
			{
				title: 'Rails Error Reporting',
				url: 'https://guides.rubyonrails.org/error_reporting.html',
			},
			{
				title: 'Sentry for Rails',
				url: 'https://docs.sentry.io/platforms/ruby/guides/rails/',
			},
			{
				title: 'Google SRE Book: SLOs',
				url: 'https://sre.google/sre-book/service-level-objectives/',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 8: SLOs, SLIs, Error Budgets',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add an Error Monitor node connected to the controller. Use Rails.error with context and set up alerting with error budgets.',
	},
};
