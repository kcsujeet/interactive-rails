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
			'Routes exist but return "uninitialized constant Api::ProductsController".',
		rootCause: 'No controller exists to handle the routed requests.',
		codeExample: `# Controllers handle requests and return JSON in API mode.
# An API controller is a leaner base class than the
# full-stack default: cookie, session, flash, and CSRF
# middleware are skipped because no HTML browser session
# is involved.
#
# The 5 RESTful actions for a JSON API:
#   index   list-all
#   show    read-one
#   create  create-one
#   update  update-one
#   destroy delete-one
# (No new/edit -- those exist only for HTML form pages.)
#
# Two constraints: the controller's class name must match
# both the resource (plural Rails convention) and the
# Ruby module path (mirroring the URL prefix the routes
# live under). Either one wrong and the URL resolves to
# a class Ruby cannot find.
#
# Your job: generate the controller, fill in the five
# actions, and verify the endpoint with curl.`,
		goal: 'End with a controller class behind those routes that returns JSON for each of the 5 RESTful actions, verifiable from the command line.',
		thresholds: {},
	},
	successConditions: [{ type: 'pipeline_complete' }],
	availableNodes: ['controller'],
	unlockedNodes: [],
	learningContent: {
		title: 'API Controllers & JSON Responses',
		goal: `In this level, you'll:\n- build the controller that handles incoming API requests and returns JSON responses.\n- generate the controller class (whose name must match both the resource and the routes' module path) and wire up the five RESTful actions.\n- exercise the endpoint by sending a real HTTP request from the command line.`,
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
class Api::ProductsController < ApplicationController
  before_action :set_product, only: [:show, :update, :destroy]

  def show
    render json: @product
  end

  def update
    if @product.update(params[:product].to_unsafe_h)
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

**A note on parameter handling at this level:**
Rails wraps the request body in an \`ActionController::Parameters\` object at \`params[:product]\`. To pass it to \`Model.new\` or \`record.update\`, you call \`.to_unsafe_h\` to get a plain hash. This is the simplest thing that works, and the lesson here is about the controller layer itself, not about parameter filtering. \`to_unsafe_h\` skips strong-params filtering entirely, a later level reveals this as a security gap and introduces a proper whitelist; for now, lean on the naive shortcut.`,
		railsCodeExample: `# app/controllers/api/products_controller.rb
class Api::ProductsController < ApplicationController
  def index
    products = Product.all
    render json: products
  end

  def show
    product = Product.find(params[:id])
    render json: product
  end

  def create
    product = Product.new(params[:product].to_unsafe_h)
    if product.save
      render json: product, status: :created
    else
      render json: { errors: product.errors }, status: :unprocessable_entity
    end
  end

  def update
    product = Product.find(params[:id])
    if product.update(params[:product].to_unsafe_h)
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
end

# Each action calls .to_unsafe_h on params[:product] to skip
# strong-params filtering. A later level reveals this as unsafe
# and introduces a proper whitelist with params.expect.`,
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
		homework: [
			{
				task: 'Create app/controllers/api/v1/products_controller.rb with index and show actions that render JSON, then hit the endpoint for real.',
				commands: [
					'bin/rails server',
					'curl http://localhost:3000/api/v1/products',
				],
				verify:
					'curl returns a JSON array (empty is fine) instead of a 500 about an uninitialized constant.',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'The controller name has to satisfy two constraints at once: the resource it serves (which is plural in Rails routing) and the module path that mirrors the URL prefix the routes live under. Get either one wrong and the route resolves to a class Ruby cannot find.',
	},
};
