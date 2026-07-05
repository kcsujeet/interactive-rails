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
# REST gives you 5 standard actions for an API-only app
# (the HTML form pages new and edit are not needed):
#   index   GET   /products       -- list
#   show    GET   /products/:id   -- read one
#   create  POST  /products       -- create
#   update  PATCH /products/:id   -- update
#   destroy DELETE /products/:id  -- delete
#
# Hand-writing each verb-and-path line by line is tedious
# and easy to get wrong. Rails has a single declaration
# that generates all five from the model name. To keep
# API endpoints organised under a URL prefix AND a Ruby
# module path, the routing DSL has a separate construct.
#
# Your job: declare the five RESTful endpoints and nest
# them under an API URL prefix, then verify with the
# Rails CLI command that prints every route.`,
		goal: 'End with the 5 RESTful endpoints for products live under a namespaced API path (something like `/api/products`), each one wired to a controller action.',
		thresholds: {},
	},
	successConditions: [{ type: 'pipeline_complete' }],
	availableNodes: ['router'],
	unlockedNodes: [],
	learningContent: {
		title: 'RESTful Routes & the Request Lifecycle',
		goal: `In this level, you'll:\n- connect your app to the outside world by declaring the 5 RESTful endpoints for a resource.\n- nest those endpoints under a URL prefix and a matching Ruby module path so API code lives in its own namespace.\n- verify what the router knows by listing every defined route from the command line.\n- trace a request from the moment it arrives to the response that goes back.`,
		conceptExplanation: `Every HTTP request follows this path:

1. **Request** arrives (GET /api/products).
2. **Router** maps URL to controller action (\`routes.rb\`).
3. **Controller** processes the request:
   - Calls **Model** to query/write the database.
   - **Database** returns data to the model, which returns it to the controller.
4. **Response** sent back to client.

The **Router** is the gateway. Without it, requests have no way to reach your controller.

**The 5 RESTful actions for an API:**
For each resource (Product, Review, User) you typically expose five HTTP endpoints: list-all, show-one, create-one, update-one, delete-one. In a JSON API there are no HTML form pages, so the two actions that exist only to render forms (new, edit) are excluded.

**One declaration generates all five:**
Hand-writing each of the five verb-and-path lines is repetitive and easy to get wrong. Rails ships a single routing declaration that takes the resource name and produces all five routes by convention.

**Nesting under a URL prefix and a Ruby module:**
A URL prefix (\`/api/\`) keeps API routes organised and lays the groundwork for versioning later when a second client requires it. The Rails router has two constructs that look similar but behave differently:
- One only changes the URL path, leaving controllers in the top-level namespace.
- The other changes the URL path AND the Ruby module path, so the matching controllers must live in an \`Api::\` module. Use this for API endpoints; it keeps the controller class structure mirroring the URL structure.`,
		railsCodeExample: `# After completing this level you will have:
# 1. declared the 5 RESTful endpoints for the Product resource
#    using the single route declaration that generates them all
# 2. nested those endpoints under an API URL prefix using the
#    routing construct that also nests the matching controllers
#    in a Ruby module (so URL and class structure match)
# 3. verified the result by running the Rails CLI command that
#    prints every defined route

# Verify (after the level):
# Each line of the route printout will look something like:
#   GET    /api/products       api/products#index
#   POST   /api/products       api/products#create
#   GET    /api/products/:id   api/products#show
#   PATCH  /api/products/:id   api/products#update
#   DELETE /api/products/:id   api/products#destroy`,
		commonMistakes: [
			'Hand-writing each verb-and-path line by line. There is a Rails declaration that generates the standard 5 RESTful routes from a single line; you should reach for it before typing five.',
			'Putting routes under a URL prefix without the matching controller module. The URL resolves, the controller class lookup fails -- a confusing pair of errors to debug. Pick the routing construct that adjusts both the URL and the Ruby module path.',
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
		homework: [
			{
				task: 'In config/routes.rb, nest `resources :products` inside `namespace :api` and `namespace :v1`, then list what Rails generated.',
				commands: ['bin/rails routes -g products'],
				verify:
					'Five routes appear under /api/v1/products, mapped to api/v1/products#index, #show, #create, #update, and #destroy.',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'There is one Rails declaration that generates the standard 5 RESTful routes for a model. To put them under a URL prefix and a Ruby module path at the same time, two pieces of routing DSL nest around it -- one per segment of the prefix.',
	},
};
