/**
 * Act 1: The Foundation
 * "Build a working API from nothing"
 *
 * Levels 1-7: Stack Choice, Model, CRUD, Controller, Serializers, Routes & Request Lifecycle, Associations
 * App context: Blog API
 */

import type { Act, Level } from "@/components/game/types";

// ============================================
// Level 1: The Stack Choice
// ============================================

const level1StackChoice: Level = {
	id: 'act1-level1-stack-choice',
	actId: 1,
	levelNumber: 1,
	name: 'The Stack Choice',
	trigger: {
		type: 'initialization',
		description:
			'Day 1. You are initializing the repository. Your database choice today will determine your scaling limits later.',
	},
	startingPipeline: {
		nodes: [{ id: 'terminal', type: 'terminal', x: 500, y: 300, locked: true }],
		connections: [],
	},
	problem: {
		observation:
			'A dark canvas with a blinking Terminal node. An empty infrastructure slot awaits your decision.',
		rootCause: 'No application exists yet.',
		codeExample: `# Day 1: Initialize your Rails 8 API application
# Your database choice will have long-term consequences...

# PostgreSQL: Production-proven, supports sharding & read replicas
rails new myapp --api --database=postgresql

# SQLite: Rails 8 makes it production-ready (WAL mode, IMMEDIATE transactions)
rails new myapp --api --database=sqlite3

# Both generate an API-only app with:
# - ActionController::API (no cookies, sessions, flash)
# - Solid Queue for background jobs
# - Solid Cache for caching
# - Solid Cable for WebSockets`,
		goal: 'Choose your database. Drag the node to the slot.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'slot_filled', slotId: 'database-slot' },
	],
	availableNodes: ['postgresql', 'sqlite'],
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
			acceptTypes: ['postgresql', 'sqlite'],
			required: true,
			position: { x: 500, y: 200 },
		},
	],
	darkCanvas: true,
	learningContent: {
		title: 'Rails 8 API Application',
		conceptExplanation: `Rails 8 introduces major changes to the default stack:

**PostgreSQL vs SQLite:**
- PostgreSQL: Battle-tested, supports sharding, read replicas, advanced queries
- SQLite: Rails 8 enables WAL mode and IMMEDIATE transactions by default, making it production-viable for many apps

**API-only mode (\`--api\`):**
- Inherits from \`ActionController::API\` instead of \`ActionController::Base\`
- No cookies, sessions, flash, or browser middleware
- Lighter middleware stack, faster responses
- Perfect for React/mobile frontends

**Rails 8 Defaults (no Redis needed):**
- Solid Queue for background jobs
- Solid Cache for caching
- Solid Cable for WebSockets`,
		railsCodeExample: `# Create a new Rails 8 API app
rails new myapp --api --database=postgresql

# config/database.yml
production:
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  url: <%= ENV['DATABASE_URL'] %>

# SQLite in Rails 8 (production-ready)
# Automatic WAL mode, IMMEDIATE transactions
# No separate DB server needed`,
		commonMistakes: [
			'Not considering future scaling needs when choosing SQLite',
			'Using full Rails when you only need an API',
			'Not understanding API-only middleware differences',
		],
		whenToUse:
			'PostgreSQL for apps that will need sharding or read replicas. SQLite for simpler apps or prototypes.',
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
		text: 'Drag PostgreSQL or SQLite to the Database slot.',
	},
};

// ============================================
// Level 2: The Model
// ============================================

const level2Model: Level = {
	id: 'act1-level2-model',
	actId: 1,
	levelNumber: 2,
	name: 'The Model',
	trigger: {
		type: 'new_feature',
		description:
			"You're building a blog API. Before writing endpoints, you need to define what a Post looks like in the database.",
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation: 'Empty application with no data structure.',
		rootCause: 'No models defined yet.',
		codeExample: `# We need to define what data looks like
# rails generate model Post title:string body:text published:boolean

class Post < ApplicationRecord
  # What attributes does it have?
  # title, body, published_at, author...
end

# The migration creates the table:
create_table :posts do |t|
  t.string :title
  t.text :body
  t.boolean :published
  t.timestamps
end`,
		goal: 'Select the attributes your Post model needs.',
		thresholds: {},
	},
	successConditions: [{ type: 'node_present', nodeType: 'model' }],
	availableNodes: ['model'],
	unlockedNodes: [],
	learningContent: {
		title: 'ActiveRecord Models & Migrations',
		conceptExplanation: `Models are the M in MVC. They represent your data and business logic.

**Key concepts:**
- Models map to database tables (Post → posts table)
- Attributes become database columns
- Each attribute has a type (string, text, integer, boolean, datetime)
- Migrations are version-controlled database changes

**Rails conventions:**
- Model names are singular (Post, User, Comment)
- Table names are plural (posts, users, comments)
- Primary key is \`id\` (auto-generated)
- \`created_at\` and \`updated_at\` are added by \`t.timestamps\``,
		railsCodeExample: `# Generate a model with attributes
rails generate model Post title:string body:text published:boolean

# This creates:
# - app/models/post.rb
# - db/migrate/xxx_create_posts.rb

# app/models/post.rb
class Post < ApplicationRecord
  # Attributes: title, body, published, created_at, updated_at
end

# Run the migration
rails db:migrate

# Check the schema
rails db:schema:dump`,
		commonMistakes: [
			'Too many attributes (start minimal, add later)',
			'Wrong data types (string vs text for long content)',
			'Forgetting timestamps',
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
		text: 'Select at least title and body as attributes for your Post.',
	},
};

// ============================================
// Level 3: CRUD Operations
// ============================================

const level3CRUD: Level = {
	id: 'act1-level3-crud',
	actId: 1,
	levelNumber: 3,
	name: 'CRUD Operations',
	trigger: {
		type: 'new_feature',
		description:
			'The Post model exists, but the database is empty. You need to create, read, update, and destroy records.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'model-node', type: 'model', x: 400, y: 250, locked: true, config: { label: 'Post' } },
			{ id: 'database-node', type: 'database', x: 600, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation: 'Model exists but no data. The console shows Post.count => 0.',
		rootCause: 'No records have been created yet.',
		codeExample: `# The four operations every model needs:

# CREATE
Post.create(title: "Hello World", body: "My first post")

# READ
Post.all          # All posts
Post.find(1)      # By ID
Post.find_by(title: "Hello World")  # By attribute

# UPDATE
post = Post.find(1)
post.update(title: "Updated Title")

# DESTROY
post.destroy`,
		goal: 'Perform all four CRUD operations on the Post model.',
		thresholds: {},
	},
	successConditions: [{ type: 'crud_complete', modelType: 'Post' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'ActiveRecord CRUD',
		conceptExplanation: `CRUD = Create, Read, Update, Destroy. Every database-backed app needs these four operations.

**Create:** \`Post.create(attrs)\` or \`Post.new(attrs)\` + \`post.save\`
**Read:** \`Post.all\`, \`Post.find(id)\`, \`Post.where(conditions)\`, \`Post.find_by(attr)\`
**Update:** \`post.update(attrs)\` or \`post.attribute = value\` + \`post.save\`
**Destroy:** \`post.destroy\` (removes from DB)

ActiveRecord translates these into SQL queries automatically.`,
		railsCodeExample: `# CREATE - two ways
post = Post.create(title: "Hello", body: "World")
# or
post = Post.new(title: "Hello", body: "World")
post.save

# READ - many ways
Post.all                          # SELECT * FROM posts
Post.find(1)                      # SELECT * FROM posts WHERE id = 1
Post.where(published: true)       # SELECT * FROM posts WHERE published = true
Post.find_by(title: "Hello")      # LIMIT 1
Post.order(created_at: :desc)     # ORDER BY created_at DESC
Post.first                        # LIMIT 1 ORDER BY id ASC
Post.last                         # LIMIT 1 ORDER BY id DESC

# UPDATE
post.update(title: "New Title")   # UPDATE posts SET title = 'New Title' WHERE id = 1

# DESTROY
post.destroy                      # DELETE FROM posts WHERE id = 1
Post.destroy_all                  # DELETE FROM posts (careful!)`,
		commonMistakes: [
			'Using Post.delete instead of Post.destroy (skips callbacks)',
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
		text: 'Use the Rails console to create a post, read it back, update it, and destroy it.',
	},
};

// ============================================
// Level 4: The Controller
// ============================================

const level4Controller: Level = {
	id: 'act1-level4-controller',
	actId: 1,
	levelNumber: 4,
	name: 'The Controller',
	trigger: {
		type: 'new_feature',
		description:
			'HTTP requests arrive at your API, but nothing responds. You need a controller to handle requests and return JSON.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
			{ id: 'model-node', type: 'model', x: 500, y: 250, locked: true, config: { label: 'Post' } },
			{ id: 'database-node', type: 'database', x: 700, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation: 'Requests arrive but get no response. No controller exists.',
		rootCause: 'No controller to handle the request and render JSON.',
		codeExample: `# We need a controller to:
# 1. Receive HTTP requests
# 2. Use the model to get/save data
# 3. Return JSON responses

# Rails 8 API controller:
class Api::V1::PostsController < ApplicationController
  # ApplicationController inherits from ActionController::API
  # (not ActionController::Base — no cookies, sessions, or views)

  def index
    posts = Post.all
    render json: posts
  end

  def create
    post = Post.new(post_params)
    # ...
  end

  private

  def post_params
    # Rails 8: params.expect replaces params.require.permit
    params.expect(post: [:title, :body, :published])
  end
end`,
		goal: 'Add a controller that connects requests to the model and returns JSON.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'controller' },
		{ type: 'connection', sourceType: 'request', targetType: 'controller' },
		{ type: 'connection', sourceType: 'controller', targetType: 'model' },
	],
	availableNodes: ['controller', 'router'],
	unlockedNodes: [],
	learningContent: {
		title: 'API Controllers & params.expect()',
		conceptExplanation: `Controllers are the C in MVC. In API mode, they receive HTTP requests and return JSON.

**API vs Full-Stack Controllers:**
- API: Inherits from \`ActionController::API\`
- No cookies, sessions, flash, CSRF protection
- Only \`render json:\` — no HTML views

**Rails 8: params.expect():**
- Replaces \`params.require(:post).permit(:title, :body)\`
- Returns 400 Bad Request (not 500) if params are tampered
- More explicit about expected parameter structure`,
		railsCodeExample: `# app/controllers/api/v1/posts_controller.rb
class Api::V1::PostsController < ApplicationController
  def index
    posts = Post.all
    render json: posts
  end

  def show
    post = Post.find(params[:id])
    render json: post
  end

  def create
    post = Post.new(post_params)
    if post.save
      render json: post, status: :created
    else
      render json: { errors: post.errors }, status: :unprocessable_entity
    end
  end

  def update
    post = Post.find(params[:id])
    if post.update(post_params)
      render json: post
    else
      render json: { errors: post.errors }, status: :unprocessable_entity
    end
  end

  def destroy
    post = Post.find(params[:id])
    post.destroy
    head :no_content
  end

  private

  # Rails 8: params.expect() — safer than require/permit
  def post_params
    params.expect(post: [:title, :body, :published])
  end
end`,
		commonMistakes: [
			'Using ActionController::Base in API mode (includes unnecessary middleware)',
			'Forgetting to return proper HTTP status codes',
			'Not using params.expect() for safe parameter filtering',
			'Rendering HTML instead of JSON in API controllers',
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
		text: 'Add a Controller node between the Request and Model. Connect Request → Controller → Model.',
	},
};

// ============================================
// Level 5: Serializers
// ============================================

const level5Serializers: Level = {
	id: 'act1-level5-serializers',
	actId: 1,
	levelNumber: 5,
	name: 'Serializers',
	trigger: {
		type: 'user_complaint',
		description:
			'The API returns raw model data including internal columns like password_digest, updated_at, and internal IDs. Clients are confused by the response shape.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 220, locked: true },
			{ id: 'controller-node', type: 'controller', x: 460, y: 220, locked: true },
			{ id: 'model-node', type: 'model', x: 660, y: 220, locked: true, config: { label: 'Post' } },
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{ id: 'response-node', type: 'response', x: 660, y: 400, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation: 'API returns all model attributes including internal ones.',
		rootCause: 'No serialization layer to shape the JSON output.',
		codeExample: `# Current: render json: post returns EVERYTHING
{
  "id": 1,
  "title": "Hello",
  "body": "World",
  "password_digest": "$2a$12...",  # Leaked!
  "internal_notes": "...",          # Internal!
  "created_at": "2024-01-01",
  "updated_at": "2024-01-01"
}

# We want:
{
  "id": 1,
  "title": "Hello",
  "body": "World",
  "published_at": "January 1, 2024"
}`,
		goal: 'Add a serializer to control exactly what the API returns.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'serializer' },
		{ type: 'connection', sourceType: 'controller', targetType: 'serializer' },
	],
	availableNodes: ['serializer'],
	unlockedNodes: [],
	learningContent: {
		title: 'JSON Serialization',
		conceptExplanation: `Serializers control what data your API exposes. Without them, \`render json: post\` dumps everything.

**Why serialize?**
- Hide internal attributes (password_digest, internal IDs)
- Format dates, currencies, names
- Include computed fields (full_name, time_ago)
- Nest related data (post with comments)

**Options:**
- \`as_json\` / \`to_json\` — built-in but limited
- Blueprinter — fast, simple, declarative
- Alba — flexible, fast
- Jbuilder — template-based (JSON views)`,
		railsCodeExample: `# Using Blueprinter (popular for APIs):
# app/blueprints/post_blueprint.rb
class PostBlueprint < Blueprinter::Base
  identifier :id

  fields :title, :body

  field :published_at do |post|
    post.published_at&.strftime("%B %d, %Y")
  end

  # Nested association
  association :comments, blueprint: CommentBlueprint
end

# In controller:
class Api::V1::PostsController < ApplicationController
  def index
    posts = Post.all
    render json: PostBlueprint.render(posts)
  end

  def show
    post = Post.find(params[:id])
    render json: PostBlueprint.render(post)
  end
end

# Output:
# { "id": 1, "title": "Hello", "body": "World", "published_at": "January 01, 2024" }`,
		commonMistakes: [
			'Leaking sensitive attributes (password_digest, tokens)',
			'Not serializing nested associations (N+1 in serializer)',
			'Over-serializing (returning too much data)',
			'Different shapes for list vs detail endpoints',
		],
		whenToUse: 'Every API endpoint should use a serializer.',
		furtherReading: [
			{
				title: 'Blueprinter Gem',
				url: 'https://github.com/procore/blueprinter',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add a Serializer node between the Controller and Response.',
	},
};

// ============================================
// Level 6: Routes & Request Lifecycle
// ============================================

const level6Routes: Level = {
	id: 'act1-level6-routes',
	actId: 1,
	levelNumber: 6,
	name: 'Routes & Request Lifecycle',
	trigger: {
		type: 'new_feature',
		description:
			'The controller exists but clients cannot reach it. No routes are defined. The full request cycle needs to be wired end-to-end.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'controller-node', type: 'controller', x: 420, y: 220, locked: true },
			{ id: 'model-node', type: 'model', x: 640, y: 220, locked: true, config: { label: 'Post' } },
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{ id: 'serializer-node', type: 'serializer', x: 420, y: 420, locked: true },
			{ id: 'response-node', type: 'response', x: 640, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c2', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation: 'GET /api/v1/posts returns 404. No routes mapped.',
		rootCause: 'Routes not configured; request lifecycle not wired.',
		codeExample: `# config/routes.rb — currently empty!
Rails.application.routes.draw do
  # Nothing here...
end

# We need:
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :posts
    end
  end
end

# This creates:
# GET    /api/v1/posts     => api/v1/posts#index
# POST   /api/v1/posts     => api/v1/posts#create
# GET    /api/v1/posts/:id => api/v1/posts#show
# PATCH  /api/v1/posts/:id => api/v1/posts#update
# DELETE /api/v1/posts/:id => api/v1/posts#destroy`,
		goal: 'Wire the full request cycle: Request → Router → Controller → Model → DB → Serializer → Response.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'router' },
		{ type: 'pipeline_complete' },
	],
	availableNodes: ['router'],
	unlockedNodes: [],
	learningContent: {
		title: 'RESTful Routes & the Request Lifecycle',
		conceptExplanation: `Every HTTP request follows this path:

1. **Request** arrives (GET /api/v1/posts)
2. **Router** maps URL to controller action
3. **Controller** processes the request
4. **Model** queries/writes the database
5. **Database** returns data
6. **Serializer** shapes the JSON response
7. **Response** sent back to client

**\`resources :posts\`** generates all 5 RESTful routes at once.
**Namespacing** under \`/api/v1/\` keeps API routes organized and versioned.`,
		railsCodeExample: `# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :posts
      # Generates:
      # GET    /api/v1/posts          => api/v1/posts#index
      # POST   /api/v1/posts          => api/v1/posts#create
      # GET    /api/v1/posts/:id      => api/v1/posts#show
      # PATCH  /api/v1/posts/:id      => api/v1/posts#update
      # PUT    /api/v1/posts/:id      => api/v1/posts#update
      # DELETE /api/v1/posts/:id      => api/v1/posts#destroy
    end
  end
end

# Check your routes:
rails routes

# The request lifecycle:
# 1. Client sends: GET /api/v1/posts
# 2. Router matches: Api::V1::PostsController#index
# 3. Controller: @posts = Post.all
# 4. Model: SELECT * FROM posts
# 5. Serializer: PostBlueprint.render(@posts)
# 6. Response: 200 OK with JSON body`,
		commonMistakes: [
			'Not namespacing API routes under /api/v1',
			'Defining routes manually instead of using resources',
			'Forgetting to nest controllers in matching module paths',
			'Not checking routes with `rails routes`',
		],
		whenToUse: 'Every controller needs routes. Use resources for standard CRUD.',
		furtherReading: [
			{
				title: 'Rails Routing',
				url: 'https://guides.rubyonrails.org/routing.html',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Add a Router node and connect the full pipeline: Request → Router → Controller → Model → DB, Controller → Serializer → Response.',
	},
};

// ============================================
// Level 7: Associations
// ============================================

const level7Associations: Level = {
	id: 'act1-level7-associations',
	actId: 1,
	levelNumber: 7,
	name: 'Associations',
	trigger: {
		type: 'new_feature',
		description:
			'Posts need comments. Users need posts. How do you relate models together and include them in API responses?',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 220, locked: true },
			{ id: 'controller-node', type: 'controller', x: 460, y: 220, locked: true },
			{ id: 'post-model', type: 'model', x: 660, y: 220, locked: true, config: { label: 'Post' } },
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{ id: 'serializer-node', type: 'serializer', x: 460, y: 420, locked: true },
			{ id: 'response-node', type: 'response', x: 660, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'serializer-node' },
			{ id: 'c6', sourceNodeId: 'serializer-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation: 'Posts load correctly, but there is no way to include comments in the API response.',
		rootCause:
			'No Comment model exists and no association is defined between Post and Comment.',
		codeExample: `# Current state:
class Post < ApplicationRecord
  # No associations defined!
end

# API returns:
# { "id": 1, "title": "Hello", "body": "World" }
# No comments!

# We need:
class Post < ApplicationRecord
  has_many :comments, dependent: :destroy
end

class Comment < ApplicationRecord
  belongs_to :post
end`,
		goal: 'Add a Comment model and connect it to Post with the correct relationship.',
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
					preview: 'Only one comment per post will appear',
					consequence: 'This limits posts to a single comment',
					correct: false,
				},
				{
					label: 'has_many',
					value: 'has_many',
					preview: 'All comments for a post will appear',
					consequence: 'Posts can have unlimited comments',
					correct: true,
				},
				{
					label: 'has_and_belongs_to_many',
					value: 'habtm',
					preview: 'Comments shared between posts',
					consequence: 'Creates a many-to-many relationship — wrong for comments',
					correct: false,
				},
			],
		},
	],
	learningContent: {
		title: 'ActiveRecord Associations',
		conceptExplanation: `Associations define relationships between models:

**has_many** — A post has many comments (one-to-many)
**belongs_to** — A comment belongs to a post (the inverse)
**has_one** — A user has one profile (one-to-one)
**has_many :through** — Posts have many tags through taggings (many-to-many)

The foreign key (\`post_id\`) lives on the \`belongs_to\` side (comments table).
Always add \`dependent: :destroy\` to clean up child records.`,
		railsCodeExample: `# app/models/post.rb
class Post < ApplicationRecord
  has_many :comments, dependent: :destroy
end

# app/models/comment.rb
class Comment < ApplicationRecord
  belongs_to :post
end

# Migration for comments:
create_table :comments do |t|
  t.references :post, null: false, foreign_key: true
  t.string :author_name
  t.text :body
  t.timestamps
end

# Usage:
post = Post.find(1)
post.comments                    # All comments for this post
post.comments.create(body: "Nice post!")

# In serializer:
class PostBlueprint < Blueprinter::Base
  identifier :id
  fields :title, :body
  association :comments, blueprint: CommentBlueprint
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
		text: 'Add a Comment model. Connect Post → Comment and choose "has_many".',
	},
};

// ============================================
// Act 1 Definition
// ============================================

export const actOne: Act = {
	id: 1,
	name: 'The Foundation',
	tagline: 'Build a working API from nothing',
	description:
		'Build a Rails 8 API from scratch: models, controllers, serializers, routes, and associations. By the end, you have a working blog API.',
	levels: [
		level1StackChoice,
		level2Model,
		level3CRUD,
		level4Controller,
		level5Serializers,
		level6Routes,
		level7Associations,
	],
	unlockedNodes: ['terminal', 'postgresql', 'sqlite'],
	metricsVisible: false,
};
