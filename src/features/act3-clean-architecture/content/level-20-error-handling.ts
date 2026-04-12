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
		codeExample: `# app/controllers/api/v1/products_controller.rb
class Api::V1::ProductsController < ApplicationController
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

# app/controllers/api/v1/users_controller.rb
class Api::V1::UsersController < ApplicationController
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

**Order matters:** rescue_from handlers are matched bottom-up. Put the most specific handlers last (they take priority).`,
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
# app/controllers/api/v1/products_controller.rb
# (Simple CRUD stays in controllers; multi-step workflows use service objects)
class Api::V1::ProductsController < ApplicationController
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
# GET /api/v1/products/999
# => 404 { "error": { "code": "not_found", "message": "Product not found" } }
#
# POST /api/v1/products with invalid data
# => 422 { "error": { "code": "validation_failed", "message": "...", "details": {...} } }
#
# POST /api/v1/products without params key
# => 400 { "error": { "code": "bad_request", "message": "Missing parameter: product" } }

# test/controllers/error_handling_test.rb
class ErrorHandlingTest < ActionDispatch::IntegrationTest
  test "returns 404 JSON for missing records" do
    get api_v1_product_path(id: 999999), as: :json

    assert_response :not_found
    json = JSON.parse(response.body)
    assert_equal "not_found", json.dig("error", "code")
    assert_match "Product", json.dig("error", "message")
  end

  test "returns 422 JSON for validation errors" do
    post api_v1_products_path, params: { product: { name: "" } }, as: :json

    assert_response :unprocessable_entity
    json = JSON.parse(response.body)
    assert_equal "validation_failed", json.dig("error", "code")
    assert json.dig("error", "details").present?
  end

  test "returns 400 JSON for missing parameters" do
    post api_v1_products_path, params: {}, as: :json

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal "bad_request", json.dig("error", "code")
  end

  test "never leaks stack traces in production" do
    # Simulate an unexpected error
    Product.stub(:find, -> (_) { raise "Boom!" }) do
      get api_v1_product_path(id: 1), as: :json
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
		],
	},
	hint: {
		delay: 25,
		text: 'Add an Error Handler node connected to the controller. It intercepts all exceptions and returns consistent JSON errors with code, message, and details.',
	},
};
