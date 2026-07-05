import type { Level } from '@/types';
import { middlewarePipeline } from '@/utils/pipelineTemplates';

export const level46ErrorMonitoring: Level = {
	id: 'act6-level46-error-monitoring',
	actId: 6,
	levelNumber: 46,
	name: 'Structured Error Monitoring',
	trigger: {
		type: 'user_complaint',
		description:
			'500 errors in production but nobody notices until users complain on Twitter. Request logging (L40) captures requests, but exceptions are not tracked with context, grouped, or alerted on.',
	},
	startingPipeline: middlewarePipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'Request logging from L40 captures requests, but when exceptions occur, they are written to the log with no error-specific context. The team only finds out about 500 errors when users tweet about it.',
		rootCause:
			'No structured error monitoring. Exceptions are logged but not captured with user context, grouped by type, or alerted on. Request logging shows what happened, but not why it failed.',
		codeExample: `# Current error handling: nothing
class Api::ProductsController < Api::BaseController
  def show
    result = FetchProduct.call(id: params[:id])
    if result.success?
      render json: Api::ProductSerializer
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
		conceptExplanation: `Your app crashes sometimes. When it does, you need to know **when it crashed**, **who it crashed for**, and **what they were doing**. Without that, you find out about errors the same way customers do: someone tweets, someone files a support ticket, hours later. Error monitoring closes that gap.

This level is about the EXCEPTION layer of observability. (L47 covers the broader picture: logs, metrics, traces. Cross-reference there for latency, performance, and request-flow monitoring.)

**Without error monitoring:**
\`\`\`
Customer: "Your checkout is broken!"
Team: "Broken how? When? For everyone or just you?"
Logs: 18,000 lines of unstructured text. Find the relevant one.
\`\`\`

**With error monitoring (Sentry / Honeybadger / Bugsnag):**
\`\`\`
Slack alert: "NoMethodError on PaymentsController#create, 47 occurrences in last 5 min"
Click through: full backtrace, the exact request params, the user's id, the
release SHA, breadcrumbs of what happened in the 30 seconds before the crash.
You know what to fix, who to apologize to, and which release introduced it.
\`\`\`

**What an error monitoring tool gives you:**
- **Grouping:** Identical exceptions from different users collapse into one issue. 47 customers hit the same NoMethodError -> one entry, count = 47, not 47 separate noise events.
- **Context:** Every captured error carries the user id, request id, params, IP, headers, and a timeline of recent log lines. You can reproduce the bug without guessing.
- **Alerting:** Slack / PagerDuty / email when the error rate spikes or a new exception type appears. Tunable so you don't get paged for known noise.
- **Trends:** "Is this error getting worse or better?" The dashboard answers in seconds.

**Error-rate SLO (the budget that gates risky deploys):**
An SLO is a goal you commit to. The simplest one is "99.9% of requests succeed." That gives you a 0.1% **error budget**: room for failures before you've broken your promise. The budget is the link between reliability and feature work:

\`\`\`
Error-rate SLO: 99.9% of requests succeed (30-day rolling window)
Budget:         0.1% errors per month (~43 minutes of full outage equivalent)
Today:          0.06% error rate, 60% budget remaining -> ship freely
Tomorrow:       0.18% error rate, budget exhausted -> freeze risky deploys until you fix
\`\`\`

The error budget turns "should we deploy this risky change?" from a gut call into a measurement. If budget is healthy, ship; if exhausted, fix reliability first.

(L47 covers the latency-side equivalent: latency SLOs measured in p95/p99 percentiles. Error monitoring tools track the error-rate side; metrics tools track the latency side.)

**Layers of error handling:**
1. **Rescue + respond:** Handle known errors gracefully (404 for missing record, 422 for validation failure).
2. **Report:** Send everything else to the error tracker so the team knows about it.
3. **Context:** Attach user id, request id, params, and breadcrumbs to every report.
4. **Alert:** Page the on-call when the error rate or new-exception count crosses a threshold.
5. **Budget:** Track the error rate against the SLO and gate risky work when budget runs out.

**Rails 8 has \`Rails.error\` built in.** It's a reporter abstraction that fans out to whatever external service you pick (Sentry, Honeybadger, Bugsnag). Use it instead of calling vendor APIs directly so you can swap providers without rewriting your code.`,
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

class Api::ProductsController < ApplicationController
  def create
    product = Product.new(product_params)

    # Rails.error.handle: captures error but continues execution
    Rails.error.handle(fallback: nil) do
      NotificationService.notify_followers(product.author)
    end

    if product.save
      render json: ProductSerializer.new(product).serializable_hash.to_json, status: :created
    else
      render json: { errors: product.errors }, status: :unprocessable_entity
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
		text: 'Two questions: when an exception happens, how does your error tracker hear about it (with the request context attached)? And what threshold across "errors per N requests" would tell on-call to stop the deploy? The first is a Rails 7+ API; the second is a budget you pick.',
	},
};
