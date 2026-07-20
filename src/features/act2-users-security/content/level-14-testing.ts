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
			"By Act 2 you've built strong params, authorization, and encryption. Each one prevents a real customer-facing failure. But nothing is automatically checking that those rules still hold after the next refactor. The next regression that ships will reach customers, a spam product pinned FEATURED on the homepage, a stranger deleting someone's listing, a column rename taking login down overnight, and you'll find out hours later, after the damage is done.",
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
			"The protections from earlier levels live only in the code that implements them. The next refactor that breaks one of them lands in customers' homepages, account pages, or login screens before anyone notices. The damage is real: refund requests, support tickets, lost revenue, hours of overnight downtime.",
		rootCause:
			'Rails ships an empty test/ scaffold from "rails new" but no real checks have been written. The only way to verify those protections still hold is to remember every rule and click through the app by hand after every change.',
		codeExample: `# These protections already exist in your code.
# Each one prevents a real customer-facing failure.
# Nothing checks they stay correct after a refactor.

# 1. The products controller filters which fields
#    a regular user can set. Without it, a posted
#    \`featured: true\` lands on the homepage.

# 2. The destroy action authorizes the user against
#    the product. Without it, anyone can DELETE
#    anyone's product.

# 3. Sign-up, login, and lookups all read and write
#    through the encrypted email column. Renaming
#    that column breaks login for every customer.

# Running \`bundle exec rspec\` does nothing, rspec
# is not even installed. No automated check runs
# when a teammate edits the controller, a policy,
# or a migration. The first signal that something
# broke is a customer noticing.`,
		goal: "Write automated checks that fire before any code reaches a customer. Wire in a real testing framework, configure test-data factories, and create an automated spec that exercises the products endpoint end-to-end through real HTTP. After this level, any refactor that breaks a protection from earlier levels turns up as a red test on the developer's machine instead of a damaged homepage, deleted product, or 500 on login.",
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
		goal: `In this level, you'll:\n- write automated checks that fire before any code reaches a customer.\n- write each protection from earlier levels down as a plain-English \`it "..."\` example.\n- generate test data dynamically with factories instead of static fixtures.\n- learn the testing philosophy that keeps Rails apps reliable as they grow.`,
		conceptExplanation: `Testing is how you write the rules of your app down so a machine can check them on every change, before customers see the damage of a broken rule.

A test is a plain-English assertion about how the app should behave, plus a small piece of code that proves it. RSpec's \`it "blocks a non-owner from updating"\` IS the test name; the body sets up the situation, makes the request, and checks the outcome holds. When a teammate's refactor breaks the rule, the example fails on their machine in 0.3 seconds instead of on a real customer hours later.

RSpec is the Ruby community standard.

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
Past ~500 tests, suite time becomes the developer feedback bottleneck. Rails ships built-in parallel testing, but it is Minitest-only: \`parallelize(workers: :number_of_processors)\` lives in \`test/test_helper.rb\` inside \`ActiveSupport::TestCase\` (per the [Rails testing guide](https://guides.rubyonrails.org/testing.html#parallel-testing)). It is not available to RSpec: \`rails_helper.rb\` has no \`parallelize\` method.

For an RSpec suite, the equivalent is the \`parallel_tests\` gem (per its [README](https://github.com/grosser/parallel_tests)):

\`\`\`bash
# Create one test database per process, then load the schema into each
bin/rake parallel:create
bin/rake parallel:prepare
# Run the suite split across all cores
bin/rake parallel:spec
\`\`\`
Each process gets its own database (\`store_api_test\`, \`store_api_test2\`, ...) keyed off \`ENV["TEST_ENV_NUMBER"]\` in \`config/database.yml\`. A 10-minute suite drops to a couple of minutes on a 10-core box. For CI parallelism across machines, \`knapsack_pro\` distributes tests by historical timing.

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
# email_address (not email): the Rails 8 auth generator names the column
# email_address, and this app keeps that name. has_secure_password reads the
# virtual password attribute; there is no username column on this schema.
FactoryBot.define do
  factory :user do
    sequence(:email_address) { |n| "user#{n}@example.com" }
    password { "password123" }
  end
end

# spec/factories/products.rb
# Product has name, description, price, and belongs_to :user. No status enum.
FactoryBot.define do
  factory :product do
    sequence(:name) { |n| "Product #{n}" }
    description { "A high-quality product crafted with care." }
    price { 19.99 }
    user
  end
end

# spec/requests/api/products_spec.rb
RSpec.describe "Products API", type: :request do
  let(:user)       { create(:user) }
  let(:other_user) { create(:user) }
  let(:headers) do
    session = user.sessions.create!(ip_address: "127.0.0.1", user_agent: "rspec")
    { "Authorization" => "Bearer #{session.token}" }
  end

  describe "GET /api/products" do
    it "returns the product list to an authenticated user" do
      create_list(:product, 3, user: user)

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
      other_product = create(:product, user: other_user)
      patch "/api/products/#{other_product.id}",
            params: { product: { name: "Hijacked" } },
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
			'Mixing test-data styles at random. This curriculum standardizes on factories (FactoryBot) so each spec builds exactly the records it needs. Fixtures are a valid, deliberate choice some large suites make for shared baseline records, but picking one convention per project and sticking to it beats scattering both',
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
			'Write request specs for every endpoint that has rules customers depend on. Write model specs for validations and scopes. Write policy specs for authorization rules. The goal: every protection in your code has at least one example that fails when the protection is removed.',
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
		homework: [
			{
				task: 'Install RSpec and FactoryBot in your store_api app and scaffold the RSpec configuration.',
				commands: [
					'bundle add rspec-rails --group "development, test"',
					'bin/rails generate rspec:install',
					'bundle add factory_bot_rails --group "development, test"',
				],
				verify:
					'.rspec, spec/spec_helper.rb, and spec/rails_helper.rb exist, and bundle exec rspec runs with 0 examples, 0 failures.',
			},
			{
				task: 'Write user and product factories, then wire FactoryBot helpers into RSpec through a spec/support file that rails_helper autoloads (uncomment the spec/support glob line).',
				verify:
					'A spec calling create(:product) builds a valid product owned by a factory-created user without any manual setup.',
			},
			{
				task: 'Write a request spec for your products endpoint that pins down the protections from earlier levels: 401 without a token, 422 for invalid params, and 403 when a non-owner updates. Run the suite.',
				commands: ['bundle exec rspec'],
				verify:
					'All examples pass green, and temporarily deleting the authorize call in the controller turns the 403 example red.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Start by adding a real testing framework to the project, then scaffold its config files with the gem-provided generator. Once that is in place, every protection from earlier levels can be written down as a runnable example.',
	},
};
