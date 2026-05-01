import type { Level } from '@/types';

export const level7Controller: Level = {
	id: 'act1-level7-controller',
	actId: 1,
	levelNumber: 7,
	name: 'The Controller',
	trigger: {
		type: 'new_feature',
		description:
			'Your routes resolve, but every request crashes with "uninitialized constant" -- the controller class they point to does not exist. You have a phone book full of names but no actual people to answer the phone.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation:
			'Routes exist but return "uninitialized constant Api::V1::ProductsController".',
		rootCause: 'No controller exists to handle the routed requests.',
		codeExample: `# Controllers handle requests and return JSON.
# API controllers inherit from ActionController::API
# (skips cookie/session middleware by default).
#
# The 5 RESTful actions:
#   index, show, create, update, destroy
#   (API controllers don't need: new, edit)
#   (also not: list, get, add, remove)
#
# Your job: generate the controller, add actions,
# and test the endpoint with curl.`,
		goal: 'End with a controller class behind those routes that returns JSON for each of the 5 RESTful actions, verifiable from the command line.',
		thresholds: {},
	},
	successConditions: [{ type: 'pipeline_complete' }],
	availableNodes: ['controller'],
	unlockedNodes: [],
	learningContent: {
		title: 'API Controllers & JSON Responses',
		goal: `In this level, you'll:\n- build the controller that handles incoming API requests and returns JSON responses.\n- learn how to generate a controller and wire up the five RESTful actions (index, show, create, update, destroy).\n- test your endpoints with curl from the command line.`,
		conceptExplanation: `Controllers are the C in MVC. In API mode, they receive HTTP requests and return JSON.

**API vs Full-Stack Controllers:**
- API: Inherits from \`ActionController::API\`
- Skips cookie, session, flash, CSRF middleware by default
- Only \`render json:\`, no HTML views

**The 5 RESTful Actions:**
- \`index\`: List all records (GET /products)
- \`show\`: Get one record (GET /products/:id)
- \`create\`: Create a record (POST /products)
- \`update\`: Update a record (PATCH /products/:id)
- \`destroy\`: Delete a record (DELETE /products/:id)

**Testing your API:**
- Use curl or Postman to send requests directly
- No browser frontend is needed yet
- This keeps things simple: one terminal for Rails, one for curl

**\`before_action\` to DRY up shared setup:**
The example below repeats \`Product.find(params[:id])\` in three actions (\`show\`, \`update\`, \`destroy\`). The conventional Rails idiom is a \`before_action\` callback that runs before the listed actions and assigns the shared instance variable:

\`\`\`ruby
class Api::V1::ProductsController < ApplicationController
  before_action :set_product, only: [:show, :update, :destroy]

  def show
    render json: @product
  end

  def update
    if @product.update(product_params)
      render json: @product
    else
      render json: { errors: @product.errors }, status: :unprocessable_entity
    end
  end

  def destroy
    @product.destroy
    head :no_content
  end

  private

  def set_product
    @product = Product.find(params[:id])
  end
end
\`\`\`
A failed \`Product.find\` raises \`ActiveRecord::RecordNotFound\`, which the centralized error handler (taught in L20) converts to a 404. With a single source of truth for "load the product," you get consistent behavior across actions for free.

**Strong parameters: \`params.expect\` is the Rails 8 default:**
The example below uses \`params.require(:product).permit(...)\`, which is the long-standing form. Rails 8 introduced \`params.expect(product: [:name, :description, :price])\` as the production-safe default for new code. \`expect\` enforces the SHAPE of the request (\`product\` must be a hash, not a string), where \`require/permit\` lets a malformed shape slip through with a confusing error message. L14 teaches \`expect\` in detail; from there onward, all new controllers in this curriculum use it.`,
		railsCodeExample: `# app/controllers/api/v1/products_controller.rb
class Api::V1::ProductsController < ApplicationController
  def index
    products = Product.all
    render json: products
  end

  def show
    product = Product.find(params[:id])
    render json: product
  end

  def create
    product = Product.new(product_params)
    if product.save
      render json: product, status: :created
    else
      render json: { errors: product.errors }, status: :unprocessable_entity
    end
  end

  def update
    product = Product.find(params[:id])
    if product.update(product_params)
      render json: product
    else
      render json: { errors: product.errors }, status: :unprocessable_entity
    end
  end

  def destroy
    product = Product.find(params[:id])
    product.destroy
    head :no_content
  end

  private

  def product_params
    params.require(:product).permit(:name, :description, :price)
  end
end

# Parameter filtering keeps user input safe.
# Rails 8 introduces params.expect() for even stricter
# filtering -- you'll learn that in a later level.`,
		commonMistakes: [
			'Inheriting from the full-stack controller base class in an API. It drags in cookie / session / CSRF middleware the API never uses, slowing every request.',
			'Returning 200 OK on a failure path with an error body. Clients have to parse the body to know whether the request succeeded -- when the HTTP status code already exists for that purpose.',
			'Generating a controller whose class name does not match the route module path. The URL resolves, the class lookup fails, and the error message is "uninitialized constant".',
			'Repeating the same record lookup in three actions instead of letting one centralized hook run before each. When the lookup needs to change, you change it three times.',
		],
		whenToUse: 'Every API endpoint needs a controller action.',
		furtherReading: [
			{
				title: 'API App Guide',
				url: 'https://guides.rubyonrails.org/api_app.html',
			},
			{
				title: 'Action Controller Overview',
				url: 'https://guides.rubyonrails.org/action_controller_overview.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'The controller name has to satisfy two constraints at once: the resource it serves (which is plural in Rails routing) and the module path that mirrors the URL prefix the routes live under. Get either one wrong and the route resolves to a class Ruby cannot find.',
	},
};
