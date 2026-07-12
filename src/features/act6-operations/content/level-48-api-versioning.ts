import type { Level } from '@/types';

export const level48APIVersioning: Level = {
	id: 'act6-level48-api-versioning',
	actId: 6,
	levelNumber: 48,
	name: 'API Versioning',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Product needs to change the order total from integer cents (1999) to a money object ({ amount: "19.99", currency: "USD" }). But 200 partners depend on the current /api format. Changing it breaks them all.',
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
		goal: 'Ship the new response format alongside the old one so 200 partners keep working untouched, and give v1 a polite, machine-readable retirement plan.',
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
- Give partners 6-12 months to migrate

**Deprecation header format (the RFCs that matter):**

Two RFCs define the wire format. If you want clients (and tooling) to actually read your deprecation signal, follow them:

- **RFC 9745 \`Deprecation\`** carries the date the version became deprecated. Use an HTTP-date string or a Unix timestamp prefixed with \`@\`. \`Deprecation: true\` works in practice but is not RFC-conformant; clients that auto-parse the header (calculating "days since deprecated") will see nothing.
- **RFC 8594 \`Sunset\`** carries the HTTP-date when the version will go away. After that date the server is allowed to return \`410 Gone\`.
- \`Link: <https://api.example.com/api/v2/docs>; rel="successor-version"\` is the standard way to point clients at the replacement.

\`\`\`http
Deprecation: Sat, 01 Jan 2026 00:00:00 GMT
Sunset:      Mon, 01 Jun 2026 00:00:00 GMT
Link:        <https://api.example.com/api/v2/docs>; rel="successor-version"
\`\`\`

**Sunset process (the headers are not enough):**

The headers are the machine-readable announcement. The actual sunset is a process:

1. **Communicate out-of-band**: changelog entry, email to every partner whose API key has hit v1 in the last 30 days, banner in your dev portal. The header is one half of the announcement; humans need the other half.
2. **Track adoption**: log v1 calls per API key per day. Build a dashboard so you can see the migration curve. If 80% of partners migrated in month 1 and 0% migrated in months 2-5, your sunset date is unrealistic.
3. **Reach out to laggards 90 days out**: identify partners still on v1, contact them directly, offer a migration call. Surprise 410s on cutover destroy partner trust.
4. **Gradual enforcement**: 90 days before sunset, headers are already in place. 30 days before, add a banner in dev docs. On sunset day, the route returns \`410 Gone\` with a body that links to the v2 docs. 30 days after, stop logging access and remove the route.
5. **Partner-by-partner override**: feature-flag a "force v2" toggle keyed on API key, so Partner A who migrated cleanly stays on v2 even if Partner B is still on v1. Lets you cut over the willing without dragging the unwilling.

**Contract tests (prove the shape does not change):**

A versioned API is only "frozen" if you can prove it. Without contract tests, a serializer edit that breaks v1 ships green and the failure surfaces only when Partner A's parser explodes in production. Contract tests assert the response shape against a stored schema:

\`\`\`ruby
# spec/contracts/api_v1_order_show_spec.rb
require "rails_helper"
require "json_schemer"

RSpec.describe "API v1 Order#show contract" do
  let(:schema) {
    JSONSchemer.schema(
      Pathname.new(Rails.root.join("spec/contracts/v1/order_show.json"))
    )
  }

  it "returns a v1-shaped response" do
    order = create(:order, total_cents: 1999)
    get "/api/v1/orders/#{order.id}"
    expect(response).to be_successful
    expect(schema.validate(response.parsed_body).to_a).to be_empty
  end
end
\`\`\`

The schema file (\`order_show.json\`) is checked into the repo and treated as the contract. CI runs the spec on every PR; any serializer edit that breaks the v1 shape fails before merge.

For more rigorous setups:
- **\`committee\` gem**: validates every request and response against an OpenAPI 3 spec during the test run. The spec doubles as the public dev docs.
- **Pact (consumer-driven)**: partners publish their expectations as \`pact\` files; your CI runs them against your provider. You learn the moment a change would break Partner A, not three weeks later.

For purely asserting your own response shape, JSON Schema is enough. For partner-driven workflows where you want their expectations to drive your guarantees, Pact is the production-grade tool.`,
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
			'Using `Deprecation: true` instead of an RFC 9745 date string (clients that auto-parse the header cannot calculate days remaining)',
			'No contract tests on the v1 endpoints (a serializer edit silently breaks the v1 shape and ships green)',
			'Sunset headers but no out-of-band partner communication (machine-readable announcement only; humans get surprised)',
			'No partner-by-partner v1-usage dashboard (cannot identify the laggards in the last 90 days)',
			'Hard cutover from 200 to 410 with no gradual enforcement (no warning banner, no opt-in v2 toggle for migrated partners)',
		],
		whenToUse:
			'Whenever you need breaking changes to response shapes, authentication, or request formats. Version from day one for any public API.',
		furtherReading: [
			{
				title: 'Rails API Versioning',
				url: 'https://guides.rubyonrails.org/api_app.html',
			},
			{
				title: 'RFC 9745: The Deprecation HTTP Response Header',
				url: 'https://datatracker.ietf.org/doc/html/rfc9745',
			},
			{
				title: 'RFC 8594: The Sunset HTTP Header Field',
				url: 'https://datatracker.ietf.org/doc/html/rfc8594',
			},
			{
				title: 'committee gem (OpenAPI request/response validation)',
				url: 'https://github.com/interagent/committee',
			},
			{
				title: 'Pact (consumer-driven contract testing)',
				url: 'https://docs.pact.io/',
			},
			{
				title: 'API Versioning Best Practices',
				url: 'https://www.mnot.net/blog/2012/12/04/api-evolution',
			},
		],
		homework: [
			{
				task: 'Freeze v1 and ship v2 side by side: namespace your orders routes under api/v1 and api/v2, give each version its own controller and serializer, and change the shape of the total field only in v2.',
				commands: [
					'curl -s http://localhost:3000/api/v1/orders/1',
					'curl -s http://localhost:3000/api/v2/orders/1',
				],
				verify:
					'v1 returns total as integer cents and v2 returns total as an object with amount and currency, both from the same database row.',
			},
			{
				task: 'Give v1 a machine-readable retirement plan: a before_action that adds an RFC 9745 Deprecation header, an RFC 8594 Sunset header, and a successor-version Link header to every v1 response.',
				commands: ['curl -i http://localhost:3000/api/v1/orders/1'],
				verify:
					'The v1 response carries all three headers with HTTP-date values, and v2 responses carry none of them.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'When v2 launches, every v1 client must be told the old version is going away and when. Two HTTP response headers carry that contract -- one says "deprecated", one says the date it stops working. Set them on every v1 response.',
	},
};
