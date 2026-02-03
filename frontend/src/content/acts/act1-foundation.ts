/**
 * Act 1: Rails Fundamentals
 * "Building the Foundation"
 *
 * Levels 1-8: Stack Choice, Model, CRUD, Controller, Views, MVC Pipeline, Persistence, Associations
 */

import type { Act, Level } from '../../components/game/types';

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
    description: 'Day 1. You are initializing the repository. Your architectural choices today will determine your scaling limits later.',
  },
  startingPipeline: {
    nodes: [
      { id: 'terminal', type: 'terminal', x: 500, y: 300, locked: true },
    ],
    connections: [],
  },
  problem: {
    observation: 'A dark canvas with a blinking Terminal node. Two empty infrastructure slots await your decisions.',
    rootCause: 'No application exists yet.',
    codeExample: `# Day 1: Initialize your Rails application
# Your choices will have long-term consequences...

# Database options:
rails new myapp --database=postgresql  # Production-ready, supports sharding
rails new myapp --database=sqlite3     # Simple, no config, but limited

# Frontend options:
rails new myapp --api                  # React frontend (separate API)
rails new myapp                        # Hotwire/ERB (monolithic)`,
    goal: 'Choose your database and frontend architecture. Drag nodes to the slots.',
    thresholds: {},
  },
  successConditions: [
    { type: 'slot_filled', slotId: 'database-slot' },
    { type: 'slot_filled', slotId: 'frontend-slot' },
  ],
  availableNodes: ['postgresql', 'sqlite', 'react', 'hotwire'],
  unlockedNodes: ['request', 'router', 'controller', 'model', 'database', 'view', 'response'],
  slots: [
    {
      id: 'database-slot',
      label: 'Database System',
      acceptTypes: ['postgresql', 'sqlite'],
      required: true,
      position: { x: 300, y: 200 },
    },
    {
      id: 'frontend-slot',
      label: 'Frontend Architecture',
      acceptTypes: ['react', 'hotwire'],
      required: true,
      position: { x: 700, y: 200 },
    },
  ],
  darkCanvas: true,
  learningContent: {
    title: 'Rails Application Architecture',
    conceptExplanation: `Your initial technology choices cascade throughout the application lifecycle:

**PostgreSQL vs SQLite:**
- PostgreSQL: Production-ready, supports advanced features like sharding
- SQLite: Simple file-based DB, great for development, but cannot scale horizontally

**React vs Hotwire:**
- React: Requires a separate API layer (--api flag), more complex but flexible
- Hotwire: Monolithic approach, simpler architecture, Rails-native

These choices affect what you can do later in the curriculum.`,
    railsCodeExample: `# PostgreSQL setup
rails new myapp --database=postgresql

# config/database.yml
production:
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  url: <%= ENV['DATABASE_URL'] %>`,
    commonMistakes: [
      'Using SQLite in production',
      'Not considering future scaling needs',
      'Choosing React when Hotwire would suffice',
    ],
    whenToUse: 'PostgreSQL for any app that might need to scale. Hotwire for content-focused apps.',
    furtherReading: [
      { title: 'Rails Getting Started', url: 'https://guides.rubyonrails.org/getting_started.html' },
    ],
  },
  hint: {
    delay: 30,
    text: 'Drag PostgreSQL or SQLite to the Database slot. Drag React or Hotwire to the Frontend slot.',
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
    description: 'Time to create your first data model. What does a Post look like?',
  },
  startingPipeline: {
    nodes: [],
    connections: [],
  },
  problem: {
    observation: 'Empty application with no data structure.',
    rootCause: 'No models defined yet.',
    codeExample: `# We need to define what data looks like
# rails generate model Post title:string body:text

class Post < ApplicationRecord
  # What validations should we add?
  # What attributes does it have?
end`,
    goal: 'Design the Post model with appropriate attributes and validations.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'model' },
  ],
  availableNodes: ['model'],
  unlockedNodes: [],
  learningContent: {
    title: 'ActiveRecord Models',
    conceptExplanation: `Models are the M in MVC. They represent your data and business logic.

**Key concepts:**
- Models map to database tables
- Validations ensure data integrity
- Callbacks hook into the lifecycle

Each model inherits from ApplicationRecord which gives you all of ActiveRecord's magic.`,
    railsCodeExample: `# app/models/post.rb
class Post < ApplicationRecord
  validates :title, presence: true, length: { maximum: 255 }
  validates :body, presence: true

  before_save :normalize_title

  private

  def normalize_title
    self.title = title.titleize
  end
end`,
    commonMistakes: [
      'Not adding validations',
      'Putting too much logic in models (fat models)',
      'Forgetting database indexes',
    ],
    whenToUse: 'Create a model for each entity in your domain.',
    furtherReading: [
      { title: 'Active Record Basics', url: 'https://guides.rubyonrails.org/active_record_basics.html' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Define the attributes and validations for your Post model.',
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
    description: 'Your Post model exists but the database is empty. Time to learn ActiveRecord.',
  },
  startingPipeline: {
    nodes: [
      { id: 'model-node', type: 'model', x: 400, y: 300, locked: true, config: { label: 'Post' } },
    ],
    connections: [],
  },
  problem: {
    observation: 'Model exists but no data in the database.',
    rootCause: 'Need to learn how to interact with records using ActiveRecord.',
    codeExample: `# CRUD = Create, Read, Update, Delete
# The four fundamental database operations:

Post.create(title: "Hello")  # Create
Post.all                      # Read (all)
Post.find(1)                  # Read (one)
Post.first.update(title: "")  # Update
Post.last.destroy             # Delete`,
    goal: 'Execute all CRUD operations in the Rails console.',
    thresholds: {},
  },
  successConditions: [
    { type: 'crud_complete', modelType: 'Post' },
  ],
  availableNodes: ['controller', 'view'],
  unlockedNodes: [],
  learningContent: {
    title: 'ActiveRecord CRUD Operations',
    conceptExplanation: `CRUD stands for Create, Read, Update, Delete - the four fundamental database operations.

**ActiveRecord methods:**
- Create: Post.create, Post.new + save
- Read: Post.all, Post.find, Post.find_by, Post.where
- Update: post.update, post.save
- Delete: post.destroy, Post.destroy_all

Every web app uses these constantly.`,
    railsCodeExample: `# CREATE - Make new records
Post.create(title: "Hello", body: "World")
post = Post.new(title: "Draft")
post.save

# READ - Fetch records
Post.all                     # All posts
Post.find(1)                 # By ID (raises if not found)
Post.find_by(title: "Hi")    # By attribute (returns nil)
Post.where(published: true)  # Filter multiple

# UPDATE - Modify records
post = Post.find(1)
post.update(title: "New Title")

# DELETE - Remove records
post.destroy`,
    commonMistakes: [
      'Using find when find_by is safer (no exception)',
      'Forgetting that destroy runs callbacks, delete does not',
      'Not checking if save/update returned true or false',
    ],
    whenToUse: 'Every time you interact with database records.',
    furtherReading: [
      { title: 'Active Record Basics', url: 'https://guides.rubyonrails.org/active_record_basics.html' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Click the commands to execute them in the Rails console.',
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
    type: 'incident',
    description: 'Requests are coming in but nothing happens. We need a traffic director.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
      { id: 'model-node', type: 'model', x: 500, y: 250, locked: true, config: { label: 'Post' } },
    ],
    connections: [],
  },
  problem: {
    observation: 'Requests come in but have nowhere to go.',
    rootCause: 'No controller to handle the request.',
    codeExample: `# Requests need a controller to:
# 1. Receive the request
# 2. Interact with models
# 3. Prepare data for views
# 4. Send the response

class PostsController < ApplicationController
  def index
    @posts = Post.all  # Talk to model
  end                   # Render view automatically
end`,
    goal: 'Create a controller that connects requests to models.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'controller' },
    { type: 'connection', sourceType: 'request', targetType: 'controller' },
    { type: 'connection', sourceType: 'controller', targetType: 'model' },
  ],
  availableNodes: ['router', 'controller'],
  unlockedNodes: [],
  learningContent: {
    title: 'Rails Controllers',
    conceptExplanation: `Controllers are the C in MVC. They orchestrate the request/response cycle.

**Responsibilities:**
- Receive HTTP requests
- Parse parameters
- Call models for data
- Prepare instance variables for views
- Render responses

Keep controllers thin! They should delegate to models and services.`,
    railsCodeExample: `# app/controllers/posts_controller.rb
class PostsController < ApplicationController
  before_action :set_post, only: [:show, :edit, :update, :destroy]

  def index
    @posts = Post.all
  end

  def show
    # @post already set by before_action
  end

  private

  def set_post
    @post = Post.find(params[:id])
  end

  def post_params
    params.require(:post).permit(:title, :body)
  end
end`,
    commonMistakes: [
      'Fat controllers with too much logic',
      'Not using before_action for common setup',
      'Querying database in views instead of controller',
    ],
    whenToUse: 'One controller per resource, following RESTful conventions.',
    furtherReading: [
      { title: 'Action Controller Overview', url: 'https://guides.rubyonrails.org/action_controller_overview.html' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Add a controller between the request and the model.',
  },
};

// ============================================
// Level 5: Views
// ============================================

const level5Views: Level = {
  id: 'act1-level5-views',
  actId: 1,
  levelNumber: 5,
  name: 'Views',
  trigger: {
    type: 'incident',
    description: 'Data loads but users see nothing. We need to render HTML.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 340, y: 250, locked: true },
      { id: 'model-node', type: 'model', x: 500, y: 250, locked: true, config: { label: 'Post' } },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
    ],
  },
  problem: {
    observation: 'Controller returns data but users see a blank page.',
    rootCause: 'No view templates to render the data.',
    codeExample: `# Controller sets instance variables:
def index
  @posts = Post.all
end

# But we need a view to display them:
# app/views/posts/index.html.erb
<h1>Posts</h1>
<% @posts.each do |post| %>
  <p><%= post.title %></p>
<% end %>`,
    goal: 'Add views to render the data as HTML.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'view' },
    { type: 'node_present', nodeType: 'response' },
    { type: 'connection', sourceType: 'model', targetType: 'view' },
  ],
  availableNodes: ['view', 'response', 'database'],
  unlockedNodes: [],
  learningContent: {
    title: 'Rails Views & ERB',
    conceptExplanation: `Views are the V in MVC. They render data into HTML.

**ERB (Embedded Ruby):**
- <%= %> outputs the result
- <% %> executes without output
- Partials with _filename.html.erb
- Layouts wrap views

Views should be dumb! No complex logic, just display data.`,
    railsCodeExample: `<!-- app/views/posts/index.html.erb -->
<h1>All Posts</h1>

<% @posts.each do |post| %>
  <article>
    <h2><%= link_to post.title, post %></h2>
    <p><%= truncate(post.body, length: 100) %></p>
    <small>Posted <%= time_ago_in_words(post.created_at) %> ago</small>
  </article>
<% end %>

<%= link_to "New Post", new_post_path %>`,
    commonMistakes: [
      'Complex logic in views',
      'N+1 queries in view loops',
      'Not using partials for reusability',
    ],
    whenToUse: 'Create a view for each controller action that renders HTML.',
    furtherReading: [
      { title: 'Action View Overview', url: 'https://guides.rubyonrails.org/action_view_overview.html' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Add a View node to render data and a Response node to send it back.',
  },
};

// ============================================
// Level 6: The MVC Pipeline
// ============================================

const level6MVCPipeline: Level = {
  id: 'act1-level6-mvc-pipeline',
  actId: 1,
  levelNumber: 6,
  name: 'The MVC Pipeline',
  trigger: {
    type: 'incident',
    description: 'Time to connect everything. Build the complete request cycle.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
    ],
    connections: [],
  },
  problem: {
    observation: 'Request particles fire but vanish into the void.',
    rootCause: 'No complete MVC pipeline.',
    codeExample: `# The complete Rails request cycle:
# 1. Request comes in
# 2. Router maps URL to controller#action
# 3. Controller handles logic
# 4. Model queries/persists data
# 5. Database stores data
# 6. View renders HTML
# 7. Response sent to client`,
    goal: 'Build a complete MVC pipeline from Request to Response.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'router' },
    { type: 'node_present', nodeType: 'controller' },
    { type: 'node_present', nodeType: 'model' },
    { type: 'node_present', nodeType: 'database' },
    { type: 'node_present', nodeType: 'view' },
    { type: 'node_present', nodeType: 'response' },
    { type: 'pipeline_complete' },
  ],
  availableNodes: ['router', 'controller', 'model', 'database', 'view', 'response'],
  unlockedNodes: [],
  learningContent: {
    title: 'The Complete MVC Pipeline',
    conceptExplanation: `This is the foundation of every Rails application.

**Request Flow:**
Request → Router → Controller → Model → Database
                                ↓
Response ← View ← Controller ←─┘

Understanding this flow is essential for debugging and optimization.`,
    railsCodeExample: `# 1. Router (config/routes.rb)
get '/posts', to: 'posts#index'

# 2. Controller (app/controllers/posts_controller.rb)
def index
  @posts = Post.all
end

# 3. Model (app/models/post.rb)
class Post < ApplicationRecord
end

# 4. View (app/views/posts/index.html.erb)
<%= @posts.each { |p| p.title } %>`,
    commonMistakes: [
      'Skipping layers (controller querying database directly)',
      'Circular dependencies',
      'Not following conventions',
    ],
    whenToUse: 'Every Rails request follows this pattern.',
    furtherReading: [
      { title: 'Rails Guides', url: 'https://guides.rubyonrails.org/' },
    ],
  },
  hint: {
    delay: 30,
    text: 'Connect: Request → Router → Controller → Model → Database → View → Response',
  },
};

// ============================================
// Level 7: Persistence
// ============================================

const level7Persistence: Level = {
  id: 'act1-level7-persistence',
  actId: 1,
  levelNumber: 7,
  name: 'Persistence',
  trigger: {
    type: 'incident',
    description: 'Users are complaining their posts vanish when the server restarts.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 340, y: 250, locked: true },
      { id: 'model-node', type: 'model', x: 500, y: 250, locked: true, config: { label: 'Post' } },
      { id: 'view-node', type: 'view', x: 660, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 820, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
      { id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'view-node' },
      { id: 'c5', sourceNodeId: 'view-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Models glow Blue (Transient). Data disappears on restart.',
    rootCause: 'Models are not connected to persistent storage.',
    codeExample: `# Current state: Data lives in memory only
@posts = []  # Lost on restart!

# After restart:
@posts  # => [] (empty!)

# We need persistent storage:
@posts = Post.all  # Reads from database`,
    goal: 'Connect the models to the Database. Make data survive restarts.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'database' },
    { type: 'connection', sourceType: 'model', targetType: 'database' },
  ],
  availableNodes: ['database'],
  unlockedNodes: [],
  learningContent: {
    title: 'Memory vs Disk: The Persistence Layer',
    conceptExplanation: `Data can live in two places:

**Memory (Transient)**
- Fast but temporary
- Lost on restart/crash
- Good for caches, sessions

**Database (Persistent)**
- Slower but permanent
- Survives restarts
- The source of truth

ActiveRecord maps Models to Database tables.`,
    railsCodeExample: `# config/database.yml
default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

production:
  <<: *default
  url: <%= ENV['DATABASE_URL'] %>

# Migrations create tables
rails generate migration CreatePosts title:string body:text
rails db:migrate`,
    commonMistakes: [
      'Storing important data in instance variables',
      'Not understanding ephemeral filesystems',
      'Using file storage on Heroku/containers',
    ],
    whenToUse: 'Always persist important data to database.',
    furtherReading: [
      { title: 'Active Record Migrations', url: 'https://guides.rubyonrails.org/active_record_migrations.html' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Add a Database node and connect the Model to it.',
  },
};

// ============================================
// Level 8: Associations
// ============================================

const level8Associations: Level = {
  id: 'act1-level8-associations',
  actId: 1,
  levelNumber: 8,
  name: 'Associations',
  trigger: {
    type: 'new_feature',
    description: 'Posts need comments. How do we relate models together?',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 340, y: 250, locked: true },
      { id: 'post-model', type: 'model', x: 500, y: 250, locked: true, config: { label: 'Post' } },
      { id: 'database-node', type: 'database', x: 680, y: 250, locked: true },
      { id: 'view-node', type: 'view', x: 840, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 1000, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
      { id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
      { id: 'c5', sourceNodeId: 'database-node', targetNodeId: 'view-node' },
      { id: 'c6', sourceNodeId: 'view-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Posts load correctly, but there is no way to show comments.',
    rootCause: 'The Comment model does not exist and no association is defined.',
    codeExample: `# Current state:
class Post < ApplicationRecord
  # No associations defined!
end

# We need comments to appear under posts
# But the Post model doesn't know about Comments...`,
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
          consequence: 'Creates a many-to-many relationship',
          correct: false,
        },
      ],
    },
  ],
  learningContent: {
    title: 'ActiveRecord Associations',
    conceptExplanation: `Associations define relationships between models:

**has_many** - A post has many comments (one-to-many)
**belongs_to** - A comment belongs to a post (the inverse)
**has_one** - A user has one profile (one-to-one)
**has_and_belongs_to_many** - Tags and posts (many-to-many)

The Model → Model connection represents these relationships.`,
    railsCodeExample: `# app/models/post.rb
class Post < ApplicationRecord
  has_many :comments, dependent: :destroy
end

# app/models/comment.rb
class Comment < ApplicationRecord
  belongs_to :post
end

# Usage
post = Post.find(1)
post.comments  # Returns all comments for this post`,
    commonMistakes: [
      'Using has_one when you need has_many',
      'Forgetting dependent: :destroy',
      'Not adding foreign key index',
    ],
    whenToUse: 'has_many when one record owns multiple of another type.',
    furtherReading: [
      { title: 'Rails Associations', url: 'https://guides.rubyonrails.org/association_basics.html' },
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
  name: 'Rails Fundamentals',
  tagline: 'Building the Foundation',
  description: 'Learn the core of Rails: Models, Views, Controllers, and how they work together.',
  levels: [
    level1StackChoice,
    level2Model,
    level3CRUD,
    level4Controller,
    level5Views,
    level6MVCPipeline,
    level7Persistence,
    level8Associations,
  ],
  unlockedNodes: ['terminal', 'postgresql', 'sqlite', 'react', 'hotwire'],
  metricsVisible: false,
};
