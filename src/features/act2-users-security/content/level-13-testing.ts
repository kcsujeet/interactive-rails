import type { Level } from '@/types';

export const level13Testing: Level = {
	id: 'act2-level13-testing',
	actId: 2,
	levelNumber: 13,
	name: 'Testing',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'A deploy broke the login endpoint. Nobody noticed for 3 hours. Set up RSpec and FactoryBot, then write a request spec to prevent this from happening again.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 220, locked: true },
			{ id: 'auth-node', type: 'authentication', x: 280, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 480, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 680,
				y: 220,
				locked: true,
			},
			{ id: 'policy-node', type: 'policy', x: 680, y: 80, locked: true },
			{
				id: 'product-model',
				type: 'model',
				x: 900,
				y: 220,
				locked: true,
				config: { label: 'Product' },
			},
			{ id: 'database-node', type: 'database', x: 1100, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 680,
				y: 420,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 900, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'auth-node' },
			{ id: 'c2', sourceNodeId: 'auth-node', targetNodeId: 'router-node' },
			{
				id: 'c3',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{
				id: 'c4',
				sourceNodeId: 'controller-node',
				targetNodeId: 'policy-node',
			},
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'product-model',
			},
			{
				id: 'c6',
				sourceNodeId: 'product-model',
				targetNodeId: 'database-node',
			},
			{
				id: 'c7',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c8',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'Zero test coverage. Deploys break features silently. The login endpoint was returning 500 for 3 hours and nobody knew until a user complained.',
		rootCause:
			'No automated tests. No CI. Manual testing is the only safety net.',
		codeExample: `# Current state:
# spec/ directory is empty
# No test framework configured
# No factories for creating test data

# The login endpoint broke because someone
# renamed the 'token' column to 'auth_token'
# but forgot to update the sessions controller:

class Api::V1::SessionsController < ApplicationController
  def create
    user = User.authenticate_by(
      email: params[:email], password: params[:password]
    )
    if user
      session = user.sessions.create!
      render json: { auth_token: session.token },
             status: :created  # session.token => NoMethodError!
    end
  end
end

# A request spec hitting POST /api/v1/sessions
# would have caught this before deploy.`,
		goal: 'Set up a testing framework with test data factories, define a user factory, and write a request spec for the sessions endpoint.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'testing_configured' },
		{ type: 'node_present', nodeType: 'test' },
		{ type: 'connection', sourceType: 'test', targetType: 'request' },
	],
	availableNodes: ['test'],
	unlockedNodes: ['test'],
	learningContent: {
		title: 'RSpec, FactoryBot & Request Specs',
		goal: `In this level, you'll:\n- set up automated testing for your API with a testing framework and test data factories.\n- write request specs that send real HTTP requests and verify JSON responses.\n- create reusable test data with factories instead of fixtures.\n- learn the testing philosophy that keeps Rails apps reliable as they grow.`,
		conceptExplanation: `Testing is not optional for production applications. RSpec is the Ruby community standard.

**Test types (from most to least valuable for APIs):**
- **Request specs** -- Test the full stack (HTTP in, JSON out). Your primary test type for APIs.
- **Model specs** -- Test validations, scopes, and business logic
- **Policy specs** -- Test authorization rules
- **Service specs** -- Test service objects in isolation

**FactoryBot:** Creates test data with sensible defaults. No more fixtures.

**Testing philosophy:**
- Test behavior, not implementation
- Request specs are your highest-value tests
- One happy path + edge cases per endpoint
- Use \`let\` for lazy-loaded test data
- Use \`before\` for shared setup`,
		railsCodeExample: `# Gemfile
group :development, :test do
  gem "rspec-rails"
  gem "factory_bot_rails"
end

group :test do
  gem "shoulda-matchers"
  gem "database_cleaner-active_record"
end

# Setup:
# rails generate rspec:install

# spec/factories/users.rb
FactoryBot.define do
  factory :user do
    email { Faker::Internet.email }
    password { "password123" }
    username { Faker::Internet.username(specifier: 3..20) }
  end
end

# spec/factories/products.rb
FactoryBot.define do
  factory :product do
    user
    name { Faker::Commerce.product_name }
    description { Faker::Lorem.paragraphs(number: 3).join("\\n\\n") }
    price { Faker::Commerce.price(range: 10..500.0) }
    status { "active" }

    trait :draft do
      status { "draft" }
    end
  end
end

# spec/requests/api/v1/products_spec.rb
RSpec.describe "Products API", type: :request do
  let(:user) { create(:user) }
  let(:token) { user.sessions.create!.token }
  let(:headers) { { "Authorization" => "Bearer #{token}" } }

  describe "GET /api/v1/products" do
    it "returns active products" do
      create_list(:product, 3, user: user)
      create(:product, :draft, user: user)

      get "/api/v1/products", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json_response.length).to eq(3)
    end
  end

  describe "POST /api/v1/products" do
    it "creates a product with valid params" do
      post "/api/v1/products",
           params: { product: { name: "Laptop", description: "16-inch display", price: 999.99 } },
           headers: headers
      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("Laptop")
    end

    it "returns 422 with invalid params" do
      post "/api/v1/products",
           params: { product: { name: "", price: -1 } },
           headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["errors"]).to include("Name can't be blank")
    end

    it "returns 401 without authentication" do
      post "/api/v1/products", params: { product: { name: "Laptop", price: 999 } }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /api/v1/products/:id" do
    it "forbids updating another user's product" do
      other_product = create(:product)  # belongs to another user
      patch "/api/v1/products/#{other_product.id}",
            params: { product: { name: "Hacked" } },
            headers: headers
      expect(response).to have_http_status(:forbidden)
    end
  end
end

# spec/support/json_helpers.rb
module JsonHelpers
  def json_response
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.include JsonHelpers, type: :request
end`,
		commonMistakes: [
			'Testing implementation details instead of behavior',
			'Not testing error cases (422, 401, 403)',
			'Using fixtures instead of factories (brittle, hard to maintain)',
			'Slow test suite from not using database_cleaner properly',
			'Testing controller internals instead of HTTP request/response',
		],
		whenToUse:
			'Write request specs for every API endpoint. Write model specs for complex validations and scopes. Write policy specs for authorization rules.',
		furtherReading: [
			{
				title: 'RSpec Rails',
				url: 'https://rspec.info/documentation/6.0/rspec-rails/',
			},
			{
				title: 'FactoryBot Getting Started',
				url: 'https://github.com/thoughtbot/factory_bot/blob/main/GETTING_STARTED.md',
			},
			{
				title: 'Better Specs',
				url: 'https://www.betterspecs.org/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Start by adding the rspec-rails gem with bundle add, then run the install generator to create the spec directory structure.',
	},
};
