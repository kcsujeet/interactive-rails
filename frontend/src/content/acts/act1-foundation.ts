/**
 * Act I: The Foundation
 * "Getting it Running."
 *
 * Levels 1-5: Project Setup, MVC, Associations, Persistence, Security
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
    description: 'Day 1. You are initializing the repository. Your architectural choices today will determine your scaling limits in Act IV.',
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
- PostgreSQL: Production-ready, supports advanced features like sharding (Level 22)
- SQLite: Simple file-based DB, great for development, but cannot scale horizontally

**React vs Hotwire:**
- React: Requires a separate API layer (--api flag), more complex but flexible
- Hotwire: Monolithic approach, simpler architecture, Rails-native

These choices are permanent. SQLite users will face limitations in Act IV.`,
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
// Level 2: The First Request (MVC)
// ============================================

const level2FirstRequest: Level = {
  id: 'act1-level2-first-request',
  actId: 1,
  levelNumber: 2,
  name: 'The First Request',
  trigger: {
    type: 'incident',
    description: 'The server is booting, but localhost:3000 is hitting a 404 Error.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
    ],
    connections: [],
  },
  problem: {
    observation: 'A Request node is firing red particles into the void. They disappear with a "poof".',
    rootCause: 'No MVC pipeline exists to handle the request.',
    codeExample: `# Current state: Request goes nowhere
# GET /posts => 404 Not Found

# You need to build:
# 1. Router - maps URL to controller
# 2. Controller - handles request logic
# 3. Model - represents data
# 4. Database - stores data
# 5. View - renders response
# 6. Response - sends back to client`,
    goal: 'Build the MVC pipeline. Connect Request to Response through the proper Rails components.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'router' },
    { type: 'node_present', nodeType: 'controller' },
    { type: 'node_present', nodeType: 'model' },
    { type: 'node_present', nodeType: 'database' },
    { type: 'node_present', nodeType: 'view' },
    { type: 'node_present', nodeType: 'response' },
    { type: 'connection', sourceType: 'request', targetType: 'router' },
    { type: 'connection', sourceType: 'router', targetType: 'controller' },
    { type: 'connection', sourceType: 'controller', targetType: 'model' },
    { type: 'connection', sourceType: 'model', targetType: 'database' },
    { type: 'connection', sourceType: 'database', targetType: 'view' },
    { type: 'connection', sourceType: 'view', targetType: 'response' },
  ],
  availableNodes: ['router', 'controller', 'model', 'database', 'view', 'response'],
  unlockedNodes: [],
  learningContent: {
    title: 'The Rails Request/Response Cycle',
    conceptExplanation: `Every Rails request follows the MVC pattern:

1. **Request** → Browser sends HTTP request
2. **Router** → routes.rb maps URL to controller action
3. **Controller** → ApplicationController handles logic
4. **Model** → ActiveRecord queries data
5. **Database** → PostgreSQL/SQLite stores data
6. **View** → ERB template renders HTML
7. **Response** → HTML sent back to browser

This is the foundation of every Rails application.`,
    railsCodeExample: `# config/routes.rb
Rails.application.routes.draw do
  resources :posts
end

# app/controllers/posts_controller.rb
class PostsController < ApplicationController
  def index
    @posts = Post.all
  end
end

# app/views/posts/index.html.erb
<h1>Posts</h1>
<% @posts.each do |post| %>
  <p><%= post.title %></p>
<% end %>`,
    commonMistakes: [
      'Skipping the router and going directly to controller',
      'Querying database directly in views',
      'Not understanding the request lifecycle',
    ],
    whenToUse: 'Every single Rails request follows this pattern.',
    furtherReading: [
      { title: 'Rails Routing', url: 'https://guides.rubyonrails.org/routing.html' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Drag nodes from the palette. Connect them: Request → Router → Controller → Model → Database → View → Response',
  },
};

// ============================================
// Level 3: Semantic Associations
// ============================================

const level3Associations: Level = {
  id: 'act1-level3-associations',
  actId: 1,
  levelNumber: 3,
  name: 'Semantic Associations',
  trigger: {
    type: 'new_feature',
    description: 'We have a Blog, but we can\'t show Comments. The data isn\'t linking.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 340, y: 250, locked: true },
      { id: 'post-model', type: 'model', x: 500, y: 250, locked: true, config: { label: 'Post' } },
      { id: 'database-node', type: 'database', x: 680, y: 250, locked: true },
      { id: 'view-node', type: 'view', x: 840, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 980, y: 250, locked: true },
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
    observation: 'Posts load correctly, but the comments section is empty.',
    rootCause: 'The Comment model doesn\'t exist in the pipeline, and no association is defined.',
    codeExample: `# Current state:
class Post < ApplicationRecord
  # No associations defined!
end

# We need comments to appear under posts
# But the Post model doesn't know about Comments...`,
    goal: 'Add a Comment model and connect it to Post with the correct relationship type.',
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
    title: 'ActiveRecord Associations: has_many / belongs_to',
    conceptExplanation: `Rails associations define relationships between models:

**has_many** - A post has many comments (one-to-many)
**belongs_to** - A comment belongs to a post (the inverse)
**has_one** - A user has one profile (one-to-one)
**has_and_belongs_to_many** - Tags and posts (many-to-many)

The Model → Model connection in the pipeline represents these relationships.`,
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
      'Forgetting dependent: :destroy leaves orphan records',
      'Not adding foreign key index to the database',
    ],
    whenToUse: 'has_many when one record owns multiple of another type.',
    furtherReading: [
      { title: 'Rails Associations', url: 'https://guides.rubyonrails.org/association_basics.html' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Drag a Model node (Comment) to the canvas. Connect Post → Comment. Choose "has_many" in the dialog.',
  },
};

// ============================================
// Level 4: Persistence Layer
// ============================================

const level4Persistence: Level = {
  id: 'act1-level4-persistence',
  actId: 1,
  levelNumber: 4,
  name: 'Persistence Layer',
  trigger: {
    type: 'incident',
    description: 'Users are complaining their posts vanish when the Dyno restarts.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 340, y: 250, locked: true },
      { id: 'post-model', type: 'model', x: 500, y: 180, locked: true, config: { label: 'Post' } },
      { id: 'comment-model', type: 'model', x: 500, y: 320, locked: true, config: { label: 'Comment' } },
      { id: 'view-node', type: 'view', x: 700, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 860, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
      { id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'comment-model' },
      { id: 'c5', sourceNodeId: 'post-model', targetNodeId: 'view-node' },
      { id: 'c6', sourceNodeId: 'comment-model', targetNodeId: 'view-node' },
      { id: 'c7', sourceNodeId: 'view-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Models are glowing Blue (Transient). Data disappears on restart.',
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
    { type: 'path_exists', pathFrom: 'post-model', pathTo: 'database' },
  ],
  availableNodes: ['database'],
  unlockedNodes: [],
  simulationEvents: [
    {
      type: 'restart',
      timestamp: 0,
      description: 'Server restarted - transient data cleared',
    },
  ],
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

ActiveRecord maps Models to Database tables. Without this connection, data exists only in memory.`,
    railsCodeExample: `# config/database.yml
default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

development:
  <<: *default
  database: myapp_development

production:
  <<: *default
  url: <%= ENV['DATABASE_URL'] %>`,
    commonMistakes: [
      'Storing important data in instance variables instead of database',
      'Not understanding that Heroku dynos restart frequently',
      'Using file storage on ephemeral filesystems',
    ],
    whenToUse: 'Always persist important data. Use memory only for caches.',
    furtherReading: [
      { title: 'Active Record Basics', url: 'https://guides.rubyonrails.org/active_record_basics.html' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Place a Database node. Connect both Model nodes to it. Click "Simulate Restart" to verify.',
  },
};

// ============================================
// Level 5: Environment Security
// ============================================

const level5Security: Level = {
  id: 'act1-level5-security',
  actId: 1,
  levelNumber: 5,
  name: 'Environment Security',
  trigger: {
    type: 'incident',
    description: 'The build failed. CI/CD cannot connect to the database.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'router-node', type: 'router', x: 200, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 340, y: 250, locked: true },
      { id: 'post-model', type: 'model', x: 500, y: 180, locked: true, config: { label: 'Post' } },
      { id: 'comment-model', type: 'model', x: 500, y: 320, locked: true, config: { label: 'Comment' } },
      { id: 'database-node', type: 'database', x: 680, y: 250, locked: true },
      { id: 'view-node', type: 'view', x: 840, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 980, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
      { id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
      { id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'comment-model' },
      { id: 'c5', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
      { id: 'c6', sourceNodeId: 'comment-model', targetNodeId: 'database-node' },
      { id: 'c7', sourceNodeId: 'database-node', targetNodeId: 'view-node' },
      { id: 'c8', sourceNodeId: 'view-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Database node shows "Access Denied" lock icon. CI/CD build is failing.',
    rootCause: 'Database credentials are not properly configured via environment variables.',
    codeExample: `# CI/CD Error:
PG::ConnectionBad: could not connect to server
FATAL:  password authentication failed for user "postgres"

# The database password is hardcoded!
# config/database.yml
production:
  password: "supersecret123"  # WRONG: Exposed in git!`,
    goal: 'Add an ENV node and configure it to securely provide database credentials.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'env' },
    { type: 'connection', sourceType: 'env', targetType: 'database' },
    { type: 'decision_made', decisionValue: 'encrypted' },
  ],
  availableNodes: ['env'],
  unlockedNodes: [],
  decisionModals: [
    {
      trigger: { sourceType: 'env', targetType: 'database' },
      question: 'How should secrets be stored?',
      options: [
        {
          label: 'Publicly Visible',
          value: 'public',
          preview: 'Secrets visible in git history',
          consequence: 'SECURITY LEAK: Credentials exposed!',
          correct: false,
        },
        {
          label: 'Encrypted (credentials.yml.enc)',
          value: 'encrypted',
          preview: 'Secrets encrypted with master key',
          consequence: 'Secure: Only decrypted at runtime',
          correct: true,
        },
      ],
    },
  ],
  simulationEvents: [
    {
      type: 'leak',
      timestamp: 0,
      description: 'Security leak detected! Credentials exposed in repository.',
      affectedNodes: ['env', 'database-node'],
    },
  ],
  learningContent: {
    title: 'Environment Variables & Secrets Management',
    conceptExplanation: `Never commit secrets to version control!

**Rails Credentials (Recommended)**
- Encrypted file: config/credentials.yml.enc
- Decrypted with RAILS_MASTER_KEY
- Safe to commit to git

**Environment Variables**
- Set in deployment environment
- Not in codebase
- Used via ENV['KEY']

The ENV node represents your secrets management layer.`,
    railsCodeExample: `# Edit credentials
rails credentials:edit

# config/credentials.yml.enc (decrypted)
database:
  password: supersecret123

# config/database.yml
production:
  password: <%= Rails.application.credentials.dig(:database, :password) %>

# Or with ENV variables
production:
  url: <%= ENV['DATABASE_URL'] %>`,
    commonMistakes: [
      'Committing .env files with real secrets',
      'Using the same credentials in dev and production',
      'Not rotating credentials after a leak',
    ],
    whenToUse: 'Always use encrypted credentials or environment variables for secrets.',
    furtherReading: [
      { title: 'Rails Credentials', url: 'https://guides.rubyonrails.org/security.html#custom-credentials' },
    ],
  },
  hint: {
    delay: 20,
    text: 'Drag the ENV node onto the canvas. Connect it to Database. Select "Encrypted" in the dialog.',
  },
};

// ============================================
// Act I Definition
// ============================================

export const actOne: Act = {
  id: 1,
  name: 'The Foundation',
  tagline: 'Getting it Running.',
  description: 'Project Setup, MVC, Associations, Persistence, and Security. Build the base for everything that follows.',
  levels: [
    level1StackChoice,
    level2FirstRequest,
    level3Associations,
    level4Persistence,
    level5Security,
  ],
  unlockedNodes: ['terminal', 'postgresql', 'sqlite', 'react', 'hotwire'],
  metricsVisible: false, // No performance metrics in Act I
};
