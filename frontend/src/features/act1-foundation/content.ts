/**
 * Act 1: The Foundation
 * "Build a working API from nothing"
 *
 * Levels 1-8: Environment, First Boot, Model, CRUD, Routes, Controller, Serializers, Associations
 * App context: E-commerce Product Catalog API
 */

import type { Act, Level } from '@/types';

// ============================================
// Level 1: The Environment (NEW)
// ============================================

const level1Environment: Level = {
	id: 'act1-level1-environment',
	actId: 1,
	levelNumber: 1,
	name: 'The Environment',
	trigger: {
		type: 'initialization',
		description:
			'Before writing any code, set up your dev environment: install asdf for version management, pin Ruby in .tool-versions, install Ruby, and install Rails.',
	},
	startingPipeline: {
		nodes: [{ id: 'terminal', type: 'terminal', x: 500, y: 300, locked: true }],
		connections: [],
	},
	problem: {
		observation:
			'No Ruby or Rails installed. You need a version manager and the right tools before creating any project.',
		rootCause: 'No development environment configured.',
		codeExample: `# A Rails project needs:
# 1. A version manager (asdf), so every project
#    uses the exact Ruby version it was built with
# 2. Ruby (the language)
# 3. Rails (the framework, installed as a Ruby gem)
#
# .tool-versions pins the version per-project:
#   ruby 3.3.6
#
# asdf reads this file and installs/switches
# to the correct version automatically.`,
		goal: 'Set up a version manager, pin Ruby and Rails versions for the project, and install the Rails framework.',
		thresholds: {},
	},
	successConditions: [{ type: 'slot_filled', slotId: 'environment-ready' }],
	availableNodes: [],
	unlockedNodes: [],
	darkCanvas: true,
	learningContent: {
		title: 'Ruby/Rails Development Environment',
		goal: `In this level, you'll:\n- set up your Ruby on Rails development environment from scratch.\n- use a version manager that pins exact Ruby versions per project.\n- configure a version file and install Ruby through the version manager.\n- install the Rails framework as a Ruby gem.`,
		conceptExplanation: `Setting up a consistent dev environment is the first step in any Rails project.

**Why asdf?**
- Manages multiple runtime versions (Ruby, Node, Python, etc.)
- Per-project version pinning via \`.tool-versions\`
- Team members always use the same Ruby version
- No conflicts between projects needing different versions

**The .tool-versions file:**
- Lives in your project root
- Space-separated format: \`ruby 3.3.6\`
- asdf reads it automatically when you \`cd\` into the directory

**Ruby gems:**
- Rails is distributed as a Ruby gem
- \`gem install rails\` installs the Rails CLI
- The \`rails new\` command then generates project scaffolding`,
		railsCodeExample: `# Install asdf (macOS)
brew install asdf

# Add Ruby plugin
asdf plugin add ruby

# Create .tool-versions in project root
echo "ruby 3.3.6" > .tool-versions

# Install the pinned Ruby version
asdf install ruby

# Verify
ruby --version  # => ruby 3.3.6

# Install Rails
gem install rails
rails --version  # => Rails 8.0.0`,
		commonMistakes: [
			'Installing Ruby via Homebrew instead of asdf (version conflicts)',
			'Using wrong .tool-versions format (YAML colons, hyphens)',
			'Forgetting to run asdf install after creating .tool-versions',
		],
		whenToUse:
			'Always set up asdf and .tool-versions at the start of a new Rails project.',
		furtherReading: [
			{
				title: 'asdf Version Manager',
				url: 'https://asdf-vm.com/',
			},
			{
				title: 'Rails Getting Started',
				url: 'https://guides.rubyonrails.org/getting_started.html',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Install asdf with Homebrew, then configure .tool-versions using space-separated format: "ruby 3.3.6".',
	},
};

// ============================================
// Level 2: First Boot (was "Hello, Rails")
// ============================================

const level2FirstBoot: Level = {
	id: 'act1-level2-first-boot',
	actId: 1,
	levelNumber: 2,
	name: 'First Boot',
	trigger: {
		type: 'initialization',
		description:
			'Ruby and Rails are installed. Now create your first application: choose PostgreSQL over SQLite, install it, generate an API-only project, create the database, and boot the server.',
	},
	startingPipeline: {
		nodes: [{ id: 'terminal', type: 'terminal', x: 500, y: 300, locked: true }],
		connections: [],
	},
	problem: {
		observation:
			'No application exists yet. You have Ruby and Rails but no project.',
		rootCause: 'No application created yet.',
		codeExample: `# Rails 8 supports two databases out of the box:
#
# PostgreSQL:
#   - Multi-user, concurrent writes
#   - Sharding, read replicas, advanced queries
#   - The production standard for web APIs
#
# SQLite:
#   - Single-writer, file-based
#   - Great for prototypes and embedded apps
#   - Not ideal for concurrent API requests
#
# The --api flag creates a lean app:
#   ActionController::API (leaner middleware stack)
#
# Your job: pick the right database, install it,
# generate the project, and get the server running.`,
		goal: 'Choose a production-grade database, install it, generate an API-only Rails project, create the database, and boot the server.',
		thresholds: {},
	},
	successConditions: [{ type: 'slot_filled', slotId: 'database-slot' }],
	availableNodes: ['postgres', 'sqlite'],
	unlockedNodes: [
		'request',
		'router',
		'controller',
		'model',
		'database',
		'response',
		'serializer',
	],
	slots: [
		{
			id: 'database-slot',
			label: 'Database System',
			acceptTypes: ['postgres', 'sqlite'],
			required: true,
			position: { x: 500, y: 200 },
		},
	],
	darkCanvas: true,
	learningContent: {
		title: 'Rails 8 API Application',
		goal: `In this level, you'll:\n- create your first Rails 8 application.\n- learn which database engine is the go-to choice for production APIs.\n- generate an API-only project with the right flags.\n- discover how Rails 8 replaces Redis with database-backed adapters for jobs, caching, and WebSockets.`,
		conceptExplanation: `Rails 8 introduces major changes to the default stack:

**PostgreSQL vs SQLite:**
- PostgreSQL: Battle-tested, supports sharding, read replicas, advanced queries, concurrent writes
- SQLite: Rails 8 enables WAL mode and IMMEDIATE transactions by default, but it's still single-writer

**API-only mode (\`--api\`):**
- Inherits from \`ActionController::API\` instead of \`ActionController::Base\`
- Skips cookie, session, and flash middleware by default (can be added back)
- Lighter middleware stack, faster responses
- Perfect for React/mobile frontends

**Rails 8 Defaults (no Redis needed):**
- Solid Queue for background jobs
- Solid Cache for caching
- Solid Cable for WebSockets`,
		railsCodeExample: `# Install PostgreSQL
brew install postgresql@17

# Create a new Rails 8 API app
rails new myapp --api --database=postgresql

# Create the database
cd myapp
rails db:create

# Boot the server
rails server

# Test it
curl -I http://localhost:3000/up
# => HTTP/1.1 200 OK`,
		commonMistakes: [
			'Choosing SQLite for a multi-user API (single-writer limitation)',
			'Forgetting --api flag (includes unnecessary browser middleware)',
			'Running db:migrate before db:create',
			'Using "rails start" instead of "rails server"',
		],
		whenToUse:
			'PostgreSQL for any app serving concurrent users. SQLite only for single-user or embedded apps.',
		furtherReading: [
			{
				title: 'Rails Getting Started',
				url: 'https://guides.rubyonrails.org/getting_started.html',
			},
			{
				title: 'Rails 8 Release Notes',
				url: 'https://guides.rubyonrails.org/8_0_release_notes.html',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'PostgreSQL handles concurrent writes, so pick it for a multi-user API. Install the server with Homebrew before generating the project.',
	},
};

// ============================================
// Level 3: The Model (was Level 2)
// ============================================

const level3Model: Level = {
	id: 'act1-level3-model',
	actId: 1,
	levelNumber: 3,
	name: 'The Model',
	trigger: {
		type: 'new_feature',
		description:
			'Your app is running but the database is empty: no tables, no schema. Define the Product model, choose attribute types, run the generator, and migrate.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation: 'Empty application with no data structure. You need to define what a Product looks like.',
		rootCause: 'No models defined yet.',
		codeExample: `# Rails model conventions:
# - Model names are singular PascalCase (not plural)
# - Table names are plural snake_case (auto-generated)
# - Each attribute has a type: string, text, integer,
#   boolean, datetime, float, decimal...

# string vs text:
#   string  - short content (titles, names), VARCHAR(255)
#   text    - long content (descriptions, bios), unlimited

# decimal vs float:
#   decimal - exact precision (prices, money), NUMERIC
#   float   - approximate (scientific data), not for money

# Your job: name the model, pick the right types,
# generate it, and migrate.`,
		goal: 'Create the Product model: name it correctly, define attributes with proper types, run the generator, and migrate the database.',
		thresholds: {},
	},
	successConditions: [{ type: 'node_present', nodeType: 'model' }],
	availableNodes: ['model'],
	unlockedNodes: [],
	learningContent: {
		title: 'ActiveRecord Models & Migrations',
		goal: `In this level, you'll:\n- define your first data model and learn how Rails maps Ruby classes to database tables.\n- use the model generator and choose the right column types (string, text, decimal).\n- run your first migration to create the table in PostgreSQL.`,
		conceptExplanation: `Models are the M in MVC. They represent your data and business logic.

**Key concepts:**
- Models map to database tables (Product → products table)
- Attributes become database columns
- Each attribute has a type (string, text, integer, decimal, boolean, datetime)
- Migrations are version-controlled database changes

**Rails conventions:**
- Model names are singular (Product, User, Review)
- Table names are plural (products, users, reviews)
- Primary key is \`id\` (auto-generated)
- \`created_at\` and \`updated_at\` are added by \`t.timestamps\``,
		railsCodeExample: `# Generate a model with attributes
rails generate model Product name:string description:text price:decimal

# This creates:
# - app/models/product.rb
# - db/migrate/xxx_create_products.rb

# app/models/product.rb
class Product < ApplicationRecord
  # Attributes: name, description, price, created_at, updated_at
end

# Run the migration
rails db:migrate

# Check the schema
rails db:schema:dump`,
		commonMistakes: [
			'Too many attributes (start minimal, add later)',
			'Wrong data types (string vs text for long content)',
			'Using float for prices (use decimal for exact precision)',
			'Not running migrations after generating them',
		],
		whenToUse: 'Create a model for each entity in your domain.',
		furtherReading: [
			{
				title: 'Active Record Basics',
				url: 'https://guides.rubyonrails.org/active_record_basics.html',
			},
			{
				title: 'Active Record Migrations',
				url: 'https://guides.rubyonrails.org/active_record_migrations.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Rails models use singular PascalCase names. For attributes, think about what type of content each field stores.',
	},
};

// ============================================
// Level 4: CRUD Operations (was Level 3)
// ============================================

const level4CRUD: Level = {
	id: 'act1-level4-crud',
	actId: 1,
	levelNumber: 4,
	name: 'CRUD Operations',
	trigger: {
		type: 'new_feature',
		description:
			'The Product model exists but the database is empty. Use the Rails console to create, read, update, and destroy your first records.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'model-node',
				type: 'model',
				x: 400,
				y: 250,
				locked: true,
				config: { label: 'Product' },
			},
			{ id: 'database-node', type: 'database', x: 600, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation: 'Model exists but no data. The console shows Product.count => 0.',
		rootCause: 'No records have been created yet.',
		codeExample: `# ActiveRecord has methods for each operation:
#
# CREATE - save a new record to the database
#   .create  vs  .new  vs  .insert
#
# READ - fetch records by ID or attributes
#   .find  vs  .select  vs  .where
#
# UPDATE - change and persist attributes
#   .update  vs  assignment  vs  .update_column
#
# DELETE - remove from database
#   .destroy  vs  .delete
#
# Some methods skip validations or callbacks.
# Your job: pick the right one each time.`,
		goal: 'Run each CRUD operation in the Rails console: create a product, read it back, update it, destroy it, and verify it is gone.',
		thresholds: {},
	},
	successConditions: [{ type: 'crud_complete', modelType: 'Product' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'ActiveRecord CRUD',
		goal: `In this level, you'll:\n- learn the four fundamental database operations: creating, reading, updating, and destroying records.\n- work in the Rails console using ActiveRecord methods like create, find, where, update, and destroy.\n- interact with your Product model directly through CRUD operations.`,
		conceptExplanation: `CRUD = Create, Read, Update, Destroy. Every database-backed app needs these four operations.

**Create:** \`Product.create(attrs)\` or \`Product.new(attrs)\` + \`product.save\`
**Read:** \`Product.all\`, \`Product.find(id)\`, \`Product.where(conditions)\`, \`Product.find_by(attr)\`
**Update:** \`product.update(attrs)\` or \`product.attribute = value\` + \`product.save\`
**Destroy:** \`product.destroy\` (removes from DB)

ActiveRecord translates these into SQL queries automatically.`,
		railsCodeExample: `# CREATE - two ways
product = Product.create(name: "Laptop", description: "16-inch display", price: 999.99)
# or
product = Product.new(name: "Laptop", description: "16-inch display", price: 999.99)
product.save

# READ - many ways
Product.all                          # SELECT * FROM products
Product.find(1)                      # SELECT * FROM products WHERE id = 1
Product.where("price > ?", 100)      # SELECT * FROM products WHERE price > 100
Product.find_by(name: "Laptop")      # LIMIT 1
Product.order(created_at: :desc)     # ORDER BY created_at DESC
Product.first                        # LIMIT 1 ORDER BY id ASC
Product.last                         # LIMIT 1 ORDER BY id DESC

# UPDATE
product.update(price: 899.99)        # UPDATE products SET price = 899.99 WHERE id = 1

# DESTROY
product.destroy                      # DELETE FROM products WHERE id = 1
Product.destroy_all                  # DELETE FROM products (careful!)`,
		commonMistakes: [
			'Using Product.delete instead of Product.destroy (skips callbacks)',
			'Not checking if save/update returns false',
			'Using find when find_by would be safer (find raises on not found)',
			'Calling destroy_all without conditions',
		],
		whenToUse: 'These are the building blocks of every Rails feature.',
		furtherReading: [
			{
				title: 'Active Record Query Interface',
				url: 'https://guides.rubyonrails.org/active_record_querying.html',
			},
		],
	},
	hint: {
		delay: 15,
		text: 'Pick the right ActiveRecord method for each operation. Watch for methods that skip callbacks or only work in memory.',
	},
};

// ============================================
// Level 5: Routes & Request Lifecycle (was Level 4)
// ============================================

const level5Routes: Level = {
	id: 'act1-level5-routes',
	actId: 1,
	levelNumber: 5,
	name: 'Routes & Request Lifecycle',
	trigger: {
		type: 'new_feature',
		description:
			'CRUD works in the console, but the outside world can\'t reach your app. Define RESTful routes under /api/v1/ and trace how requests map to controller actions.',
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

// ============================================
// Level 6: The Controller (was Level 5)
// ============================================

const level6Controller: Level = {
	id: 'act1-level6-controller',
	actId: 1,
	levelNumber: 6,
	name: 'The Controller',
	trigger: {
		type: 'new_feature',
		description:
			'Routes are defined but return "uninitialized constant". Generate a controller, add the 5 RESTful actions, and test with curl. For now, curl is your client. No browser frontend yet.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation: 'Routes exist but return "uninitialized constant Api::V1::ProductsController".',
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
		goal: 'Generate the controller, add the 5 RESTful actions, return JSON responses, and test with curl.',
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
- \`index\`: List all records (GET /posts)
- \`show\`: Get one record (GET /posts/:id)
- \`create\`: Create a record (POST /posts)
- \`update\`: Update a record (PATCH /posts/:id)
- \`destroy\`: Delete a record (DELETE /posts/:id)

**Testing your API:**
- Use curl or Postman to send requests directly
- No browser frontend is needed yet
- This keeps things simple: one terminal for Rails, one for curl`,
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
			'Using ActionController::Base in API mode (includes unnecessary middleware)',
			'Forgetting to return proper HTTP status codes',
			'Rendering HTML instead of JSON in API controllers',
			'Not namespacing controllers under Api::V1 to match routes',
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
		text: 'Controller names are plural and must match the route namespace: Api::V1::Products. Actions use Rails conventions like index, show, create.',
	},
};

// ============================================
// Level 7: Serializers (was Level 6)
// ============================================

const level7Serializers: Level = {
	id: 'act1-level7-serializers',
	actId: 1,
	levelNumber: 7,
	name: 'Serializers',
	trigger: {
		type: 'user_complaint',
		description:
			'The API dumps every column as flat JSON. Choose a serializer gem, install it, declare domain attributes, and shape the output into the JSON:API standard.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation: 'API returns all model attributes including internal ones.',
		rootCause: 'No serialization layer to shape the JSON output.',
		codeExample: `# Current: render json: product returns EVERYTHING
{
  "id": 1,
  "name": "Laptop",
  "description": "16-inch display",
  "price": "999.99",
  "created_at": "2024-01-01T00:00:00.000Z",     # Internal
  "updated_at": "2024-01-01T00:00:00.000Z"      # Internal
}

# We want (JSON:API standard):
{
  "data": {
    "id": "1",
    "type": "products",
    "attributes": {
      "name": "Laptop",
      "description": "16-inch display",
      "price": "999.99"
    }
  }
}`,
		goal: 'Install a serializer gem, define a ProductSerializer with only safe attributes, and update the controller to use it.',
		thresholds: {},
	},
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'JSON:API Serialization',
		goal: `In this level, you'll:\n- learn how to control exactly what your API returns to clients.\n- use a serializer gem to shape JSON responses following the JSON:API standard.\n- declare which domain attributes to expose and format prices for display.\n- structure your output the way production APIs do.`,
		conceptExplanation: `Serializers control what data your API exposes. Without them, \`render json: product\` dumps everything.

**Why serialize?**
- Choose which attributes to expose (only domain data, not bookkeeping)
- Format dates, currencies, names
- Include computed fields (full_name, display_price)
- Nest related data (product with reviews)

**The JSON:API standard:**
The industry-standard response format for REST APIs. Used by Stripe, Ember, and thousands of production APIs. It provides:
- Standardized envelope: \`data\`, \`type\`, \`attributes\`, \`relationships\`
- Built-in pagination via \`links\`
- Sparse fieldsets: \`fields[posts]=title,body\`
- Compound documents: \`include=reviews\`
- Standardized error format

**Why jsonapi-serializer?**
- Implements the JSON:API spec out of the box
- 100x faster than ActiveModelSerializers (AMS)
- Production-proven, actively maintained
- Clean DSL: \`attributes\`, \`has_many\`, \`belongs_to\`

**Alternatives and trade-offs:**
- Blueprinter: simpler flat JSON, not standards-compliant, good for internal APIs
- Alba: flexible, supports multiple formats, newer
- Jbuilder: template-based, good for complex views, slower
- ActiveModelSerializers (AMS): legacy, unmaintained. Avoid.`,
		railsCodeExample: `# Gemfile
gem "jsonapi-serializer"

# app/serializers/base_serializer.rb
class BaseSerializer
  include JSONAPI::Serializer
end

# app/serializers/product_serializer.rb
class ProductSerializer < BaseSerializer
  attribute :name
  attribute :description

  attribute :price do |product|
    product.price.to_s
  end

  has_many :reviews, serializer: ReviewSerializer
end

# In controller:
class Api::V1::ProductsController < ApplicationController
  def index
    products = Product.all
    render json: ProductSerializer.new(products).serializable_hash.to_json
  end

  def show
    product = Product.find(params[:id])
    render json: ProductSerializer.new(product).serializable_hash.to_json
  end
end

# JSON:API output:
# {
#   "data": {
#     "id": "1",
#     "type": "products",
#     "attributes": {
#       "name": "Laptop",
#       "description": "16-inch display",
#       "price": "999.99"
#     }
#   }
# }`,
		commonMistakes: [
			'Dumping all columns with render json: (flat, unstructured, no formatting)',
			'Not serializing nested associations (N+1 in serializer)',
			'Over-serializing (returning too much data)',
			'Different shapes for list vs detail endpoints',
		],
		whenToUse:
			'Every API endpoint should use a serializer. Use JSON:API format for public APIs.',
		furtherReading: [
			{
				title: 'jsonapi-serializer',
				url: 'https://github.com/jsonapi-serializer/jsonapi-serializer',
			},
			{
				title: 'JSON:API Specification',
				url: 'https://jsonapi.org/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Look for the gem that implements the JSON:API spec and is actively maintained.',
	},
};

// ============================================
// Level 8: Associations (was Level 7)
// ============================================

const level8Associations: Level = {
	id: 'act1-level8-associations',
	actId: 1,
	levelNumber: 8,
	name: 'Associations',
	trigger: {
		type: 'new_feature',
		description:
			'Products need reviews! Generate the Review model, choose the right association type, configure cascade deletion, and test the relationship.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 460,
				y: 220,
				locked: true,
			},
			{
				id: 'product-model',
				type: 'model',
				x: 660,
				y: 220,
				locked: true,
				config: { label: 'Product' },
			},
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 460,
				y: 420,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 660, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{
				id: 'c2',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'product-model' },
			{ id: 'c4', sourceNodeId: 'product-model', targetNodeId: 'database-node' },
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c6',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'Products load correctly, but there is no way to include reviews in the API response.',
		rootCause:
			'No Review model exists and no association is defined between Product and Review.',
		codeExample: `# Associations link models together:
#   has_many    - one-to-many (parent side)
#   belongs_to  - inverse (child side)
#   has_one     - one-to-one
#   has_and_belongs_to_many - many-to-many
#
# The foreign key lives on the belongs_to side.
# Using "product:references" in a generator adds:
#   - Foreign key column (product_id)
#   - Database index
#   - belongs_to association (automatic!)
#
# When a parent is destroyed, what happens to children?
#   dependent: :destroy, :nullify, :restrict_with_error
#
# Your job: generate Review, set up the relationship,
# and handle cascade deletion.`,
		goal: 'Generate the Review model with product:references, choose the right relationship type, configure dependent destruction, and test the association.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_count', nodeType: 'model', count: 2 },
		{ type: 'connection', sourceType: 'model', targetType: 'model' },
		{ type: 'decision_made', decisionValue: 'has_many' },
	],
	availableNodes: ['model'],
	unlockedNodes: [],
	decisionModals: [
		{
			trigger: { sourceType: 'model', targetType: 'model' },
			question: 'What type of relationship is this?',
			options: [
				{
					label: 'has_one',
					value: 'has_one',
					preview: 'Only one review per product will appear',
					consequence: 'This limits products to a single review',
					correct: false,
				},
				{
					label: 'has_many',
					value: 'has_many',
					preview: 'All reviews for a product will appear',
					consequence: 'Products can have unlimited reviews',
					correct: true,
				},
				{
					label: 'has_and_belongs_to_many',
					value: 'habtm',
					preview: 'Reviews shared between products',
					consequence: 'Creates a many-to-many relationship',
					correct: false,
				},
			],
		},
	],
	learningContent: {
		title: 'ActiveRecord Associations',
		goal: `In this level, you'll:\n- link models together using ActiveRecord associations.\n- learn how has_many and belongs_to create one-to-many relationships.\n- understand where the foreign key lives.\n- set up dependent: :destroy so deleting a product automatically cleans up its reviews.`,
		conceptExplanation: `Associations define relationships between models:

**has_many**: A product has many reviews (one-to-many)
**belongs_to**: A review belongs to a product (the inverse)
**has_one**: A user has one profile (one-to-one)
**has_many :through**: Products have many categories through categorizations (many-to-many)

The foreign key (\`product_id\`) lives on the \`belongs_to\` side (reviews table).
Always add \`dependent: :destroy\` to clean up child records.`,
		railsCodeExample: `# app/models/product.rb
class Product < ApplicationRecord
  has_many :reviews, dependent: :destroy
end

# app/models/review.rb
class Review < ApplicationRecord
  belongs_to :product
end

# Migration for reviews:
create_table :reviews do |t|
  t.references :product, null: false, foreign_key: true
  t.text :body
  t.integer :rating
  t.timestamps
end

# Usage:
product = Product.find(1)
product.reviews                    # All reviews for this product
product.reviews.create(body: "Great laptop!", rating: 5)

# In serializer:
class ProductSerializer < BaseSerializer
  attribute :name
  attribute :description
  has_many :reviews, serializer: ReviewSerializer
end`,
		commonMistakes: [
			'Using has_one when you need has_many',
			'Forgetting dependent: :destroy (orphaned records)',
			'Not adding a foreign key index',
			'Not including associations in the serializer',
		],
		whenToUse: 'has_many when one record owns multiple of another type.',
		furtherReading: [
			{
				title: 'Rails Associations',
				url: 'https://guides.rubyonrails.org/association_basics.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Use product:references in the generator to automatically add the foreign key, index, and belongs_to. Products have many reviews, not just one.',
	},
};

// ============================================
// Act 1 Definition
// ============================================

export const actOne: Act = {
	id: 1,
	name: 'The Foundation',
	tagline: 'Build a working API from nothing.',
	description:
		'Build a Rails 8 API from scratch: environment setup, project creation, models, controllers, routes, serializers, and associations. By the end, you have a working product catalog API.',
	levels: [
		level1Environment,
		level2FirstBoot,
		level3Model,
		level4CRUD,
		level5Routes,
		level6Controller,
		level7Serializers,
		level8Associations,
	],
	unlockedNodes: ['terminal', 'postgres', 'sqlite'],
	metricsVisible: false,
};
