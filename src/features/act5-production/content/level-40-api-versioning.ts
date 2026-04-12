import type { Level } from '@/types';

export const level40APIVersioning: Level = {
	id: 'act5-level40-api-versioning',
	actId: 5,
	levelNumber: 40,
	name: 'API Versioning',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Product needs to change the order total from integer cents (1999) to a money object ({ amount: "19.99", currency: "USD" }). But 200 partners depend on the current /api/v1 format. Changing it breaks them all.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'request-v1',
				type: 'request',
				x: 80,
				y: 150,
				locked: true,
				config: { label: 'v1 Client' },
			},
			{
				id: 'request-v2',
				type: 'request',
				x: 80,
				y: 350,
				locked: true,
				config: { label: 'v2 Client' },
			},
			{ id: 'router-node', type: 'router', x: 260, y: 250, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 440,
				y: 250,
				locked: true,
			},
			{
				id: 'model-node',
				type: 'model',
				x: 620,
				y: 250,
				locked: true,
				config: { label: 'Order' },
			},
			{ id: 'database-node', type: 'database', x: 800, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 620, y: 400, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-v1', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'request-v2', targetNodeId: 'router-node' },
			{
				id: 'c3',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c4', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c5', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{
				id: 'c6',
				sourceNodeId: 'database-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'The API returns `{ "total": 1999 }` (integer cents). Product wants to change it to `{ "total": { "amount": "19.99", "currency": "USD" } }` (structured object). 200 partners parse the current format. Deploying the new shape breaks all of them.',
		rootCause:
			'No API versioning strategy. A single controller serves all clients. Any change to the response shape is a breaking change for everyone.',
		codeExample: `# app/controllers/api/orders_controller.rb
class Api::OrdersController < ApplicationController
  def show
    result = FetchOrder.call(id: params[:id])
    if result.success?
      render json: OrderSerializer
        .new(result.order).serializable_hash
    end
  end
end

# app/serializers/order_serializer.rb
class OrderSerializer < BaseSerializer
  attribute :total do |order|
    order.total_cents  # Integer cents (1999)
  end
end

# Partner A expects: { "total": 1999 }
# Product wants:     { "total": { "amount": "19.99", "currency": "USD" } }
# Changing the serializer breaks Partner A!`,
		goal: 'Implement API versioning with namespaced routes and controllers so v1 and v2 coexist. Add deprecation headers to v1 responses.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'router' },
		{ type: 'node_present', nodeType: 'controller' },
		{ type: 'connection', sourceType: 'router', targetType: 'controller' },
	],
	availableNodes: ['controller', 'serializer'],
	unlockedNodes: [],
	learningContent: {
		title: 'API Versioning & Deprecation',
		goal: `In this level, you'll:\n- learn how to evolve your API without breaking existing clients.\n- namespace controllers so multiple API versions coexist side by side.\n- route requests to the correct version.\n- announce deprecation dates in HTTP headers so clients have time to migrate.`,
		conceptExplanation: `API versioning lets you evolve your API without breaking existing clients.

**Three versioning strategies:**

1. **URL path versioning** (recommended for Rails):
   - \`/api/v1/orders\` and \`/api/v2/orders\`
   - Explicit, easy to understand, easy to route
   - Each version gets its own controllers and serializers

2. **Header versioning:**
   - \`Accept: application/vnd.myapp.v2+json\`
   - Cleaner URLs but harder to test and debug
   - Requires custom content negotiation middleware

3. **Query parameter versioning:**
   - \`/api/orders?version=2\`
   - Simple but pollutes query string
   - Easy to forget or misconfigure

**Deprecation strategy:**
- Announce deprecation date in response headers
- Add \`Sunset\` header with retirement date
- Log v1 usage to track migration progress
- Give partners 6-12 months to migrate`,
		railsCodeExample: `# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :orders, only: [:index, :show, :create]
    end

    namespace :v2 do
      resources :orders, only: [:index, :show, :create]
    end
  end
end

# Shared base controller
# app/controllers/api/base_controller.rb
class Api::BaseController < ApplicationController
  before_action :set_default_format

  private

  def set_default_format
    request.format = :json unless params[:format]
  end
end

# V1 controller (frozen - no changes)
# app/controllers/api/v1/orders_controller.rb
module Api
  module V1
    class OrdersController < Api::BaseController
      before_action :add_deprecation_headers

      def show
        order = Order.find(params[:id])
        render json: Api::V1::OrderSerializer.new(order).serializable_hash.to_json
      end

      private

      def add_deprecation_headers
        response.headers['Deprecation'] = 'true'
        response.headers['Sunset'] = 'Sat, 01 Jun 2026 00:00:00 GMT'
        response.headers['Link'] = '<https://api.example.com/api/v2/docs>; rel="successor-version"'
      end
    end
  end
end

# V2 controller (new features)
# app/controllers/api/v2/orders_controller.rb
module Api
  module V2
    class OrdersController < Api::BaseController
      def show
        order = Order.find(params[:id])
        render json: Api::V2::OrderSerializer.new(order).serializable_hash.to_json
      end
    end
  end
end

# V1 serializer (frozen output shape)
# app/serializers/api/v1/order_serializer.rb
module Api
  module V1
    class OrderSerializer < BaseSerializer
      attribute :total do |order|
        order.total_cents  # Integer cents
      end
      attribute :status
      attribute :created_at
    end
  end
end

# V2 serializer (new output shape)
# app/serializers/api/v2/order_serializer.rb
module Api
  module V2
    class OrderSerializer < BaseSerializer
      attribute :total do |order|
        {
          amount: (order.total_cents / 100.0).to_s,
          currency: order.currency
        }
      end
      attribute :status
      attribute :created_at

      attribute :line_items do |order|
        order.line_items.map do |li|
          { product_id: li.product_id, quantity: li.quantity }
        end
      end
    end
  end
end

# Shared model logic stays in one place
# app/models/order.rb
class Order < ApplicationRecord
  has_many :line_items
  belongs_to :user
  # Both v1 and v2 controllers use the same model
end

# Track v1 usage for migration planning
class Api::V1::BaseController < Api::BaseController
  after_action :track_v1_usage

  private

  def track_v1_usage
    Rails.logger.info(
      "[API_V1_USAGE] path=#{request.path} " \\
      "client=#{request.headers['X-Client-Id']} " \\
      "ip=#{request.remote_ip}"
    )
  end
end`,
		commonMistakes: [
			'Modifying v1 controllers after v2 ships (breaks existing integrations)',
			'Not adding deprecation/sunset headers to old versions',
			'Sharing serializers between versions (changes leak across versions)',
			'Not tracking v1 usage to know when it is safe to retire',
			'Too many live versions (maintain at most 2: current and previous)',
		],
		whenToUse:
			'Whenever you need breaking changes to response shapes, authentication, or request formats. Version from day one for any public API.',
		furtherReading: [
			{
				title: 'Rails API Versioning',
				url: 'https://guides.rubyonrails.org/api_app.html',
			},
			{
				title: 'Sunset Header RFC',
				url: 'https://datatracker.ietf.org/doc/html/rfc8594',
			},
			{
				title: 'API Versioning Best Practices',
				url: 'https://www.mnot.net/blog/2012/12/04/api-evolution',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Namespace routes under /api/v1 and /api/v2 with separate controllers and serializers. Add Deprecation and Sunset headers to v1.',
	},
};
