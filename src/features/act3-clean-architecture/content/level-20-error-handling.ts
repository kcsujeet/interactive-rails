import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level20ErrorHandling: Level = {
	id: 'act3-level20-error-handling',
	actId: 3,
	levelNumber: 20,
	name: 'Error Handling',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'A client reports that the API returns raw 500 errors with Ruby stack traces in production. Another endpoint returns a 404 as plain text. The error format is different on every endpoint.',
	},
	startingPipeline: standardPipeline({ modelLabel: 'Product' }),
	problem: {
		observation:
			'API returns inconsistent error formats: sometimes HTML stack traces, sometimes plain text, sometimes JSON with different shapes. Clients cannot reliably parse error responses.',
		rootCause:
			'No centralized error handling. Each controller rescues exceptions differently (or not at all), resulting in three different error formats.',
		codeExample: `# app/controllers/api/products_controller.rb
class Api::ProductsController < ApplicationController
  def show
    @product = Product.find(params[:id])  # Raises ActiveRecord::RecordNotFound
    render json: @product
    # No rescue -- returns raw 500 with HTML stack trace!
  end

  def update
    @product = Product.find(params[:id])
    @product.update!(product_params)  # Raises ActiveRecord::RecordInvalid
    render json: @product
  rescue ActiveRecord::RecordInvalid => e
    render json: { message: e.message }, status: 422  # Different shape!
  end
end

# app/controllers/api/users_controller.rb
class Api::UsersController < ApplicationController
  def show
    @user = User.find(params[:id])
    render json: @user
  rescue ActiveRecord::RecordNotFound
    render plain: "Not found", status: 404  # Plain text, not JSON!
  end
end

# Clients see 3 different error formats:
# 1. Raw HTML stack trace (500)
# 2. { "message": "Validation failed: Title can't be blank" }
# 3. "Not found" (plain text)`,
		goal: 'Build a centralized error handling layer using rescue_from that returns consistent { error: { code, message, details } } JSON responses.',
		thresholds: {},
	},
	successConditions: [{ type: 'error_handling_configured' }],
	availableNodes: ['error_handler'],
	unlockedNodes: ['error_handler'],
	learningContent: {
		title: 'Centralized Error Handling with rescue_from',
		goal: `In this level, you'll:\n- build a centralized error handling layer so your API always returns consistent, predictable JSON errors.\n- use rescue_from in ApplicationController to catch exceptions globally.\n- map exceptions to the right HTTP status codes.\n- never leak stack traces to clients again.`,
		conceptExplanation: `\`rescue_from\` in ApplicationController catches exceptions globally and converts them to consistent JSON error responses.

**Principles:**
- Every error response has the same JSON shape: \`{ error: { code, message, details } }\`
- Never leak stack traces in production
- Use appropriate HTTP status codes
- Include machine-readable error codes for clients to switch on
- Log full details server-side, return safe messages client-side

**Standard error shape:**
\`\`\`json
{
  "error": {
    "code": "not_found",
    "message": "Product not found",
    "details": {}
  }
}
\`\`\`

**Common exceptions to handle:**
- \`ActiveRecord::RecordNotFound\` -> 404
- \`ActiveRecord::RecordInvalid\` -> 422
- \`ActionController::ParameterMissing\` -> 400
- \`Pundit::NotAuthorizedError\` -> 403
- \`ActiveRecord::RecordNotUnique\` -> 409

**Order matters:** rescue_from handlers are matched bottom-up. Put the most specific handlers last (they take priority).

**Rescue StandardError, never Exception:**
\`rescue_from StandardError\` is correct. Do NOT \`rescue_from Exception\` (or bare \`rescue\` in Ruby): \`Exception\` includes \`Interrupt\` (Ctrl+C), \`SystemExit\` (deliberate exit), and \`NoMemoryError\` (out of memory). Catching them turns shut-down signals into infinite loops and hides crash conditions that should kill the process. Every error you actually want to handle is a \`StandardError\` subclass.

**Report exceptions to an external service:**
Logging \`exception.message\` and the first 20 backtrace lines is the bare minimum. At billion-dollar SaaS scale you want full backtrace, request context, user id, request id, and grouping across similar errors. Use Sentry, Honeybadger, Bugsnag, or Rollbar:

\`\`\`ruby
def internal_server_error(exception)
  Sentry.capture_exception(exception, extra: {
    request_id: request.request_id,
    user_id: Current.user&.id,
    path: request.path
  })
  Rails.logger.error(exception.message)

  render json: {
    error: {
      code: "internal_error",
      message: "An unexpected error occurred",
      request_id: request.request_id   # so the client can quote it to support
    }
  }, status: :internal_server_error
end
\`\`\`
The \`request_id\` in the response is what closes the loop between the user reporting "I got a 500 at 4:23pm" and the on-call engineer finding the line in the log.

**Validation error shape: \`errors.details\`, not \`errors.messages\`:**
\`record.errors.messages\` returns \`{ name: ["can't be blank"] }\`, which is hardcoded English. \`record.errors.details\` returns \`{ name: [{ error: :blank }] }\` with structured codes the frontend can localize. Modern API clients want the codes:

\`\`\`ruby
def unprocessable_entity(exception)
  render json: {
    error: {
      code: "validation_failed",
      message: I18n.t("errors.validation_failed"),
      details: exception.record.errors.details   # structured, not strings
    }
  }, status: :unprocessable_entity
end
\`\`\`
For a client-side i18n setup, send both: \`details\` for the codes, \`messages\` for the rendered fallback.

**HTTP status codes worth handling:**
The set in the example covers the common ones, but production APIs also return:

- \`429 Too Many Requests\` (rate-limited) with a \`Retry-After\` header so clients can back off correctly. Bare 403 trains clients to give up; 429 trains them to wait.
- \`503 Service Unavailable\` (circuit breaker open, dependency down) with \`Retry-After\` so clients distinguish "your bug" from "our bug, try again in 30 seconds."
- \`409 Conflict\` for optimistic-lock failures (\`ActiveRecord::StaleObjectError\`).
- \`410 Gone\` for sunset endpoints (signaled in the L40 deprecation flow).
- \`408 Request Timeout\` if your middleware enforces a per-request budget (slow-client kicks).

Each one is a distinct signal to the client. Returning 500 for all of them tells the client nothing.

**RFC 9457 Problem Details (the IETF standard):**
The shape \`{ error: { code, message, details } }\` is fine for an internal API. For external partners, the IETF standard is \`application/problem+json\` per RFC 9457 (formerly RFC 7807):

\`\`\`json
{
  "type": "https://api.example.com/errors/validation_failed",
  "title": "Validation failed",
  "status": 422,
  "detail": "Name can't be blank",
  "instance": "/api/products",
  "errors": [{ "field": "name", "code": "blank" }]
}
\`\`\`
The \`type\` is a stable URL the client can switch on. Greenfield public APIs should ship Problem Details from day one; established APIs can add a content-negotiated alternative under \`Accept: application/problem+json\` without breaking existing clients.

**Service-object Result vs \`rescue_from\`: pick a layer:**
The Act 3 lineage uses Result objects (\`Data.define(:success?, :record, :errors)\`) for explicit failure paths. Mixing that with \`rescue_from\` requires a clear convention:

- **Service-layer failures** (validation, business rules) return \`Result.new(success?: false, ...)\`. The controller checks \`result.success?\` and renders the appropriate status.
- **Bare ActiveRecord errors** (RecordNotFound, RecordInvalid from a stray \`!\` somewhere deep) propagate up to \`rescue_from\` as the safety net.

Without a convention, one PR catches \`RecordInvalid\` in \`rescue_from\` and the next PR wraps the same error in a Result, and your error responses become inconsistent across endpoints. Document the layer rule in the codebase and stick to it.`,
		railsCodeExample: `# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  rescue_from StandardError, with: :internal_server_error
  rescue_from ActiveRecord::RecordNotFound, with: :not_found
  rescue_from ActiveRecord::RecordInvalid, with: :unprocessable_entity
  rescue_from ActiveRecord::RecordNotUnique, with: :conflict
  rescue_from ActionController::ParameterMissing, with: :bad_request
  rescue_from Pundit::NotAuthorizedError, with: :forbidden

  private

  def not_found(exception)
    render json: {
      error: {
        code: "not_found",
        message: "#{exception.model || 'Resource'} not found"
      }
    }, status: :not_found
  end

  def unprocessable_entity(exception)
    render json: {
      error: {
        code: "validation_failed",
        message: "Validation failed",
        details: exception.record.errors.messages
      }
    }, status: :unprocessable_entity
  end

  def bad_request(exception)
    render json: {
      error: {
        code: "bad_request",
        message: "Missing parameter: #{exception.param}"
      }
    }, status: :bad_request
  end

  def forbidden(_exception)
    render json: {
      error: {
        code: "forbidden",
        message: "You are not authorized to perform this action"
      }
    }, status: :forbidden
  end

  def conflict(_exception)
    render json: {
      error: {
        code: "conflict",
        message: "Resource already exists"
      }
    }, status: :conflict
  end

  def internal_server_error(exception)
    # Log the full error server-side
    Rails.logger.error(exception.message)
    Rails.logger.error(exception.backtrace&.first(20)&.join("\\n"))

    # Return safe message to client
    render json: {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred"
      }
    }, status: :internal_server_error
  end
end

# Now controllers are clean -- no rescue blocks needed:
# app/controllers/api/products_controller.rb
# (Simple CRUD stays in controllers; multi-step workflows use service objects)
class Api::ProductsController < ApplicationController
  def show
    product = Product.find(params[:id])  # RecordNotFound -> 404 JSON
    render json: ProductSerializer.new(product).serializable_hash.to_json
  end

  def create
    product = current_user.products.new(product_params)
    product.save!  # RecordInvalid -> 422 JSON
    render json: ProductSerializer.new(product).serializable_hash.to_json, status: :created
  end

  def update
    product = Product.find(params[:id])
    authorize product  # NotAuthorizedError -> 403 JSON
    product.update!(product_params)
    render json: ProductSerializer.new(product).serializable_hash.to_json
  end

  private

  def product_params
    params.expect(product: [:name, :description, :price])  # ParameterMissing -> 400 JSON
  end
end

# All errors now return consistent JSON:
# GET /api/products/999
# => 404 { "error": { "code": "not_found", "message": "Product not found" } }
#
# POST /api/products with invalid data
# => 422 { "error": { "code": "validation_failed", "message": "...", "details": {...} } }
#
# POST /api/products without params key
# => 400 { "error": { "code": "bad_request", "message": "Missing parameter: product" } }

# test/controllers/error_handling_test.rb
class ErrorHandlingTest < ActionDispatch::IntegrationTest
  test "returns 404 JSON for missing records" do
    get api_product_path(id: 999999), as: :json

    assert_response :not_found
    json = JSON.parse(response.body)
    assert_equal "not_found", json.dig("error", "code")
    assert_match "Product", json.dig("error", "message")
  end

  test "returns 422 JSON for validation errors" do
    post api_products_path, params: { product: { name: "" } }, as: :json

    assert_response :unprocessable_entity
    json = JSON.parse(response.body)
    assert_equal "validation_failed", json.dig("error", "code")
    assert json.dig("error", "details").present?
  end

  test "returns 400 JSON for missing parameters" do
    post api_products_path, params: {}, as: :json

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal "bad_request", json.dig("error", "code")
  end

  test "never leaks stack traces in production" do
    # Simulate an unexpected error
    Product.stub(:find, -> (_) { raise "Boom!" }) do
      get api_product_path(id: 1), as: :json
    end

    assert_response :internal_server_error
    json = JSON.parse(response.body)
    assert_equal "internal_error", json.dig("error", "code")
    refute_match "Boom!", json.dig("error", "message")
  end
end`,
		commonMistakes: [
			'Leaking stack traces in production (never render exception.backtrace to clients)',
			'Inconsistent error response shapes across endpoints (always use the same JSON structure)',
			'Rescuing StandardError too broadly without logging the original exception',
			'Not logging the full exception server-side before rendering the safe client message',
			'Forgetting to handle ActionController::ParameterMissing from params.expect()',
			'rescue_from Exception instead of StandardError (catches Interrupt and SystemExit, hides crash signals and breaks Ctrl+C)',
			'Not reporting exceptions to Sentry/Honeybadger/Bugsnag (logs alone are not enough at scale; you need grouping, frequency, and request context)',
			'No request_id or correlation id in the 500 response (client cannot quote it to support, support cannot find the line in the log)',
			'Returning 403 for rate-limit violations instead of 429 with a Retry-After header',
			'Returning 500 for dependency-down conditions instead of 503 (clients cannot distinguish "your bug" from "our bug, try again in 30s")',
			'Sending errors.messages (English strings) when the frontend needs errors.details (structured codes for i18n)',
			'Catching ActiveRecord::RecordInvalid in service objects AND in rescue_from with no documented convention (different endpoints emit different error shapes for the same condition)',
		],
		whenToUse:
			'Every API should have centralized error handling in ApplicationController from day one. It is a prerequisite for a reliable API.',
		furtherReading: [
			{
				title: 'Action Controller Overview - Rescue',
				url: 'https://guides.rubyonrails.org/action_controller_overview.html#rescue',
			},
			{
				title: 'Rails API Error Handling',
				url: 'https://guides.rubyonrails.org/api_app.html',
			},
			{
				title: 'RFC 9457: Problem Details for HTTP APIs',
				url: 'https://www.rfc-editor.org/rfc/rfc9457',
			},
			{
				title: 'Sentry for Ruby on Rails',
				url: 'https://docs.sentry.io/platforms/ruby/guides/rails/',
			},
			{
				title: 'errors.details vs errors.messages',
				url: 'https://api.rubyonrails.org/classes/ActiveModel/Errors.html#method-i-details',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add an Error Handler node connected to the controller. It intercepts all exceptions and returns consistent JSON errors with code, message, and details.',
	},
};
