import type { Level } from '@/types';

export const level6Routes: Level = {
	id: 'act1-level6-routes',
	actId: 1,
	levelNumber: 6,
	name: 'Routes & Request Lifecycle',
	trigger: {
		type: 'new_feature',
		description:
			'You can read and write Products from the Rails console, but the outside world has no door in. Every HTTP request your server receives gets a 404, because nothing has been told which URLs map to which controller actions.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation: 'GET /products returns 404. No routes are defined.',
		rootCause: 'No routes defined. The outside world cannot reach your app.',
		codeExample: `# config/routes.rb - currently empty!
Rails.application.routes.draw do
  # Nothing here...
end

# Routes map HTTP verbs + URLs to controller actions.
# In a full-stack app, resources generates 7 routes
# (including new/edit for HTML forms).
# In API-only mode, new and edit are excluded --
# leaving 5 RESTful actions:
#   index, show, create, update, destroy
#
# Namespaces nest routes under a URL prefix:
#   /products      => products#index
#   /api/products  => api/products#index
#
# Your job: define the resource, nest it under the
# API namespace, and trace each route to its action.`,
		goal: 'End with the 5 RESTful endpoints for products live under a namespaced API path (something like `/api/products`), each one wired to a controller action.',
		thresholds: {},
	},
	successConditions: [{ type: 'pipeline_complete' }],
	availableNodes: ['router'],
	unlockedNodes: [],
	learningContent: {
		title: 'RESTful Routes & the Request Lifecycle',
		goal: `In this level, you'll:\n- connect your app to the outside world by defining RESTful routes.\n- learn how Rails maps HTTP verbs and URLs to controller actions using resources.\n- namespace routes under /api/ to keep API endpoints organized.\n- trace a request from the moment it arrives to the response that goes back.`,
		conceptExplanation: `Every HTTP request follows this path:

1. **Request** arrives (GET /api/products)
2. **Router** maps URL to controller action (\`routes.rb\`)
3. **Controller** processes the request:
   - Calls **Model** to query/write the database
   - **Database** returns data to the model, which returns it to the controller
4. **Response** sent back to client

The **Router** is the gateway. Without it, requests have no way to reach your controller.

**\`resources :products\`** in an API-only app generates 5 RESTful actions (index, show, create, update, destroy). The \`new\` and \`edit\` actions are excluded because API controllers don't serve HTML forms.
**Namespacing** under \`/api/\` keeps API routes organized and lays the groundwork for adding versioning later when a second client requires it.`,
		railsCodeExample: `# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    resources :products
    # Generates:
    # GET    /api/products          => api/products#index
    # POST   /api/products          => api/products#create
    # GET    /api/products/:id      => api/products#show
    # PATCH  /api/products/:id      => api/products#update
    # PUT    /api/products/:id      => api/products#update
    # DELETE /api/products/:id      => api/products#destroy
  end
end

# Check your routes:
rails routes

# The request lifecycle:
# 1. Client sends: GET /api/products
# 2. Router matches: Api::ProductsController#index
# 3. Controller calls Model: @products = Product.all
# 4. Model queries DB: SELECT * FROM products
# 5. Controller renders: render json: @products
# 6. Response: 200 OK with JSON body`,
		commonMistakes: [
			'Hand-writing each verb-and-path line by line. There is a Rails declaration that generates the standard 5 RESTful routes from a single line; you should reach for it before typing five.',
			'Reaching for `scope` when you wanted `namespace`. `scope` only changes the URL path; `namespace` changes the URL path AND the controller module. Mixing them produces "uninitialized constant" errors.',
			'Putting routes under a URL prefix without the matching controller module. The URL resolves, the controller class lookup fails -- a confusing pair of errors to debug.',
			'Not running the Rails CLI command that prints every route, every verb, every path, every action. It is the fastest way to verify what you actually defined.',
		],
		whenToUse:
			'Every controller needs routes. Use resources for standard CRUD.',
		furtherReading: [
			{
				title: 'Rails Routing',
				url: 'https://guides.rubyonrails.org/routing.html',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'There is one Rails declaration that generates the standard 5 RESTful routes for a model. To put them under a URL prefix and a Ruby module path at the same time, two pieces of routing DSL nest around it -- one per segment of the prefix.',
	},
};
