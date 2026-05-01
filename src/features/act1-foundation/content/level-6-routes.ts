import type { Level } from '@/types';

export const level6Routes: Level = {
	id: 'act1-level6-routes',
	actId: 1,
	levelNumber: 6,
	name: 'Routes & Request Lifecycle',
	trigger: {
		type: 'new_feature',
		description:
			"CRUD works in the console, but the outside world can't reach your app. Define RESTful routes under /api/v1/ and trace how requests map to controller actions.",
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
#   /products        => products#index
#   /api/v1/products => api/v1/products#index
#
# Your job: define the resource, nest it properly,
# and trace each route to its action.`,
		goal: 'Define a resource, wrap it in API namespaces, view the generated routes, and trace each one to its controller action.',
		thresholds: {},
	},
	successConditions: [{ type: 'pipeline_complete' }],
	availableNodes: ['router'],
	unlockedNodes: [],
	learningContent: {
		title: 'RESTful Routes & the Request Lifecycle',
		goal: `In this level, you'll:\n- connect your app to the outside world by defining RESTful routes.\n- learn how Rails maps HTTP verbs and URLs to controller actions using resources.\n- namespace routes under /api/v1/ for versioning.\n- trace a request from the moment it arrives to the response that goes back.`,
		conceptExplanation: `Every HTTP request follows this path:

1. **Request** arrives (GET /api/v1/products)
2. **Router** maps URL to controller action (\`routes.rb\`)
3. **Controller** processes the request:
   - Calls **Model** to query/write the database
   - **Database** returns data to the model, which returns it to the controller
4. **Response** sent back to client

The **Router** is the gateway. Without it, requests have no way to reach your controller.

**\`resources :products\`** in an API-only app generates 5 RESTful actions (index, show, create, update, destroy). The \`new\` and \`edit\` actions are excluded because API controllers don't serve HTML forms.
**Namespacing** under \`/api/v1/\` keeps API routes organized and versioned.`,
		railsCodeExample: `# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :products
      # Generates:
      # GET    /api/v1/products          => api/v1/products#index
      # POST   /api/v1/products          => api/v1/products#create
      # GET    /api/v1/products/:id      => api/v1/products#show
      # PATCH  /api/v1/products/:id      => api/v1/products#update
      # PUT    /api/v1/products/:id      => api/v1/products#update
      # DELETE /api/v1/products/:id      => api/v1/products#destroy
    end
  end
end

# Check your routes:
rails routes

# The request lifecycle:
# 1. Client sends: GET /api/v1/products
# 2. Router matches: Api::V1::ProductsController#index
# 3. Controller calls Model: @products = Product.all
# 4. Model queries DB: SELECT * FROM products
# 5. Controller renders: render json: @products
# 6. Response: 200 OK with JSON body`,
		commonMistakes: [
			'Not namespacing API routes under /api/v1',
			'Defining routes manually instead of using resources',
			'Forgetting to nest controllers in matching module paths',
			'Not checking routes with `rails routes`',
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
		text: 'Start with resources :products, then wrap it in namespace :api and namespace :v1 (outermost first).',
	},
};
