import type { Level } from '@/types';

export const level14Testing: Level = {
	id: 'act2-level14-testing',
	actId: 2,
	levelNumber: 14,
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

class Api::SessionsController < ApplicationController
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

# A request spec hitting POST /api/sessions
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
- Use \`before\` for shared setup

**External APIs: \`WebMock\` and \`VCR\`:**
The moment your service calls Stripe, SendGrid, or any other API, you have a testing problem. Two production-safe answers:

1. \`WebMock\` blocks all real HTTP by default. Failing tests with "Real HTTP connections are disabled" force you to stub explicitly:
\`\`\`ruby
# spec/spec_helper.rb
require "webmock/rspec"
WebMock.disable_net_connect!(allow_localhost: true)

# In a test
stub_request(:post, "https://api.stripe.com/v1/charges")
  .with(body: hash_including(amount: 1000))
  .to_return(status: 200, body: { id: "ch_123" }.to_json)
\`\`\`

2. \`VCR\` records the real call once and replays it forever:
\`\`\`ruby
it "creates a Stripe charge" do
  VCR.use_cassette("stripe_charge_success") do
    result = StripeCharge.call(amount: 1000)
    expect(result).to be_success
  end
end
\`\`\`
The recorded YAML lives in \`spec/cassettes/\`. Re-record on a new API version, scrub secrets via \`config.filter_sensitive_data\`. Both gems live together: VCR for happy paths, WebMock stubs for error paths and edge cases.

**Time and randomness (deterministic tests):**
Tests that pass on Tuesday and fail on Friday at midnight are tests with hidden time dependencies. Rails ships time helpers:

\`\`\`ruby
travel_to Time.zone.local(2026, 1, 15, 9, 0) do
  expect(invoice.due_date).to eq(Date.new(2026, 2, 14))
end

freeze_time
expect(token.created_at).to eq(Time.current)
travel 16.minutes
expect(token).to be_expired
\`\`\`
For randomness, seed it: \`srand(spec_seed)\` at the top of \`rails_helper.rb\`, plus \`Faker::Config.random = Random.new(spec_seed)\` so a failing test reproduces locally. Faker by default uses \`SecureRandom\`, which makes "flaky in CI, passes locally" almost guaranteed.

**Parallel testing for fast suites:**
Past ~500 tests, suite time becomes the developer feedback bottleneck. Rails has built-in parallel testing:

\`\`\`ruby
# spec/rails_helper.rb (or test/test_helper.rb for Minitest)
parallelize(workers: :number_of_processors)
\`\`\`
Each worker gets its own database (\`myapp_test-1\`, \`myapp_test-2\`, ...). Combined with \`bundle exec spring rspec\` and a hot-reloading worker pool, a 10-minute suite drops to under 90 seconds on a 10-core box. For CI parallelism across machines, \`knapsack_pro\` distributes tests by historical timing.

**Fixtures vs factories at scale:**
Factories (FactoryBot) are the default for greenfield apps and are the right choice 95% of the time. But: at 5K+ tests, every test calls \`create(:user)\` and the suite becomes IO-bound on database inserts. Some shops (Shopify, GitHub) have moved key models back to fixtures because Rails fixtures load once, in a single transaction, into the schema. The tradeoff: fixtures are global state, factories are per-test. If a suite is stuck waiting on \`create\` calls, mixing fixtures for "every test needs one of these" entities (a default org, a default plan, a default admin user) and factories for "specific scenarios" is the production answer.

**System specs (Capybara) for end-to-end flows:**
Even an API-only Rails app has end-to-end flows that span multiple services: OAuth callbacks, webhook deliveries, browser-driven onboarding. \`type: :system\` specs run a real browser via Selenium or Cuprite. Slow but irreplaceable for "does the whole stack work?". Limit to 10-20 specs covering the highest-stakes happy paths.

**Coverage as a guardrail, not a target:**
\`SimpleCov\` measures line/branch coverage. Use it to find untested files (\`coverage/index.html\` lists files at 0%), not as a CI gate at "minimum 90%." Targeted coverage gates encourage tests-for-coverage, which optimize the metric without exercising real behavior. The valuable signal is: "this newly-merged file has no tests"; that is enforceable via \`SimpleCov.minimum_coverage_by_file 80\` for new files only.

**Test smells to watch for:**
- Tests that pass when run in isolation but fail in the full suite (order-dependent state leak; \`config.order = :random\` exposes it).
- \`sleep N\` anywhere in a spec (almost always a missing async-wait helper).
- A test that mocks more than three collaborators (the design has too many seams; integration test instead).
- Mocks that drift from reality ("the test passes but production breaks"). Mock at the boundary (HTTP, file system) using WebMock; do not mock your own classes.`,
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

# spec/requests/api/products_spec.rb
RSpec.describe "Products API", type: :request do
  let(:user) { create(:user) }
  let(:token) { user.sessions.create!.token }
  let(:headers) { { "Authorization" => "Bearer #{token}" } }

  describe "GET /api/products" do
    it "returns active products" do
      create_list(:product, 3, user: user)
      create(:product, :draft, user: user)

      get "/api/products", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json_response.length).to eq(3)
    end
  end

  describe "POST /api/products" do
    it "creates a product with valid params" do
      post "/api/products",
           params: { product: { name: "Laptop", description: "16-inch display", price: 999.99 } },
           headers: headers
      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("Laptop")
    end

    it "returns 422 with invalid params" do
      post "/api/products",
           params: { product: { name: "", price: -1 } },
           headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["errors"]).to include("Name can't be blank")
    end

    it "returns 401 without authentication" do
      post "/api/products", params: { product: { name: "Laptop", price: 999 } }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /api/products/:id" do
    it "forbids updating another user's product" do
      other_product = create(:product)  # belongs to another user
      patch "/api/products/#{other_product.id}",
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
			'Letting tests make real HTTP calls (slow, flaky, leaks credentials). Set WebMock.disable_net_connect! and stub everything',
			'Hardcoded times in tests (Time.now + 1.day). Use travel_to / freeze_time so the test is deterministic',
			'sleep N inside a spec (almost always a missing async-wait helper)',
			'Mocking your own classes instead of mocking the boundary. Mock HTTP and the filesystem; integration-test the seam between your classes',
			'No parallel test config past ~500 tests (suite slows past the feedback-loop threshold and gets ignored)',
			'Treating coverage as a CI gate at 90%+ (encourages tests-for-coverage). Use coverage to find files at 0%, not as a forcing function for the rest',
			'Faker generating non-deterministic data without a seeded Faker::Config.random (CI-only flakes that do not reproduce locally)',
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
			{
				title: 'WebMock',
				url: 'https://github.com/bblimke/webmock',
			},
			{
				title: 'VCR',
				url: 'https://github.com/vcr/vcr',
			},
			{
				title: 'Rails parallel testing',
				url: 'https://guides.rubyonrails.org/testing.html#parallel-testing',
			},
			{
				title: 'ActiveSupport time helpers (travel_to, freeze_time)',
				url: 'https://api.rubyonrails.org/classes/ActiveSupport/Testing/TimeHelpers.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Rails 8 ships with Minitest, but the most widely-used Ruby test framework is a separate gem. Add it through Bundler so it lands in the project Gemfile, then run its setup generator -- the standard Rails way to install a test framework.',
	},
};
