/**
 * Act 5: Infrastructure
 * "Scaling the Stack"
 *
 * Levels 27-31: Load Balancing, CDN, Rate Limiting, Connection Pooling, Zero-Downtime Deployments
 */

import type { Act, Level } from '../../components/game/types';

// ============================================
// Level 27: Load Balancing
// ============================================

const level27LoadBalancing: Level = {
  id: 'act5-level27-load-balancing',
  actId: 5,
  levelNumber: 27,
  name: 'Load Balancing',
  trigger: {
    type: 'scaling',
    description: 'Single server cannot handle traffic. Time to scale horizontally.',
  },
  startingPipeline: { nodes: [], connections: [] },
  problem: {
    observation: 'Single server at 100% CPU. Requests timing out.',
    rootCause: 'No horizontal scaling.',
    codeExample: `# Single server: 1 instance handles all traffic
# With load balancer: Traffic distributed across N instances`,
    goal: 'Configure load balancing with the right strategy.',
    thresholds: {},
  },
  successConditions: [{ type: 'load_balancing_configured' }],
  availableNodes: ['load_balancer'],
  unlockedNodes: ['load_balancer'],
  learningContent: {
    title: 'Load Balancing Strategies',
    conceptExplanation: `Distribute traffic across multiple servers.

**Strategies:**
- Round-robin: Equal distribution
- Least connections: Send to least busy
- IP hash: Sticky sessions
- Weighted: Prefer faster servers`,
    railsCodeExample: `# nginx.conf
upstream rails_app {
  least_conn;  # Load balancing strategy

  server app1.example.com:3000 weight=3;
  server app2.example.com:3000 weight=2;
  server app3.example.com:3000 weight=1;

  keepalive 32;  # Connection pooling
}

server {
  listen 80;

  location / {
    proxy_pass http://rails_app;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}

# For session affinity (if needed)
upstream rails_app {
  ip_hash;  # Same client -> same server
  server app1.example.com:3000;
  server app2.example.com:3000;
}`,
    commonMistakes: ['Sticky sessions when not needed', 'No health checks', 'Uneven distribution'],
    whenToUse: 'When single server cannot handle load.',
    furtherReading: [{ title: 'NGINX Load Balancing', url: 'https://nginx.org/en/docs/http/load_balancing.html' }],
  },
  hint: { delay: 20, text: 'Use least_conn for most Rails apps.' },
};

// ============================================
// Level 28: CDN
// ============================================

const level28CDN: Level = {
  id: 'act5-level28-cdn',
  actId: 5,
  levelNumber: 28,
  name: 'CDN',
  trigger: {
    type: 'performance_alert',
    description: 'Users in Europe experience 2s latency. Server is in US.',
  },
  startingPipeline: { nodes: [], connections: [] },
  problem: {
    observation: 'High latency for users far from origin server.',
    rootCause: 'No edge caching or CDN.',
    codeExample: `# Without CDN: Every request goes to origin
# User (Europe) -> Server (US) = 200ms RTT

# With CDN: Cached at edge
# User (Europe) -> Edge (Europe) = 20ms RTT`,
    goal: 'Configure CDN for static assets and cacheable responses.',
    thresholds: {},
  },
  successConditions: [{ type: 'cdn_configured' }],
  availableNodes: ['cdn'],
  unlockedNodes: ['cdn'],
  learningContent: {
    title: 'CDN Configuration',
    conceptExplanation: `CDN caches content at edge locations worldwide.

**Cache:**
- Static assets (JS, CSS, images)
- API responses with Cache-Control
- Full pages when possible`,
    railsCodeExample: `# config/environments/production.rb
config.action_controller.asset_host = 'https://cdn.example.com'

# Set cache headers
class PostsController < ApplicationController
  def show
    @post = Post.find(params[:id])

    # Cache at CDN for 1 hour
    expires_in 1.hour, public: true

    # Or use stale? for conditional GET
    if stale?(@post)
      render :show
    end
  end

  def index
    # Vary by query params
    expires_in 5.minutes, public: true
    response.headers['Vary'] = 'Accept, Authorization'
  end
end

# Cache-Control header examples
Cache-Control: public, max-age=3600       # CDN caches 1 hour
Cache-Control: private, max-age=0         # No CDN cache
Cache-Control: public, s-maxage=86400     # CDN caches 1 day`,
    commonMistakes: ['Caching private data', 'No cache invalidation strategy', 'Missing Vary headers'],
    whenToUse: 'Static assets always. Dynamic content when possible.',
    furtherReading: [{ title: 'HTTP Caching', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching' }],
  },
  hint: { delay: 20, text: 'Set Cache-Control headers for CDN caching.' },
};

// ============================================
// Level 29: Rate Limiting
// ============================================

const level29RateLimiting: Level = {
  id: 'act5-level29-rate-limiting',
  actId: 5,
  levelNumber: 29,
  name: 'Rate Limiting',
  trigger: {
    type: 'security_incident',
    description: 'Bot attack flooding login endpoint. 100K requests/minute.',
  },
  startingPipeline: { nodes: [], connections: [] },
  problem: {
    observation: 'Excessive requests overwhelming the server.',
    rootCause: 'No rate limiting.',
    codeExample: `# Without rate limiting: Unlimited requests
# With rate limiting: 100 requests per IP per minute`,
    goal: 'Implement rate limiting with Rack::Attack.',
    thresholds: {},
  },
  successConditions: [{ type: 'rate_limiting_configured' }],
  availableNodes: [],
  unlockedNodes: [],
  learningContent: {
    title: 'Rate Limiting with Rack::Attack',
    conceptExplanation: `Protect your app from abuse.

**Strategies:**
- Fixed window: N requests per period
- Sliding window: Smoother distribution
- Token bucket: Burst-friendly`,
    railsCodeExample: `# config/initializers/rack_attack.rb
class Rack::Attack
  # Throttle all requests by IP
  throttle('req/ip', limit: 300, period: 5.minutes) do |req|
    req.ip
  end

  # Stricter limit on login attempts
  throttle('logins/ip', limit: 5, period: 20.seconds) do |req|
    if req.path == '/login' && req.post?
      req.ip
    end
  end

  # Throttle by user for authenticated endpoints
  throttle('api/user', limit: 100, period: 1.minute) do |req|
    if req.path.start_with?('/api/')
      req.env['warden'].user&.id
    end
  end

  # Block suspicious IPs
  blocklist('block bad IPs') do |req|
    BadIp.exists?(ip: req.ip)
  end

  # Allow list for trusted sources
  safelist('allow from trusted') do |req|
    req.ip == '127.0.0.1'
  end
end

# Custom response
Rack::Attack.throttled_responder = lambda do |req|
  [429, {'Content-Type' => 'application/json'}, [{error: 'Rate limit exceeded'}.to_json]]
end`,
    commonMistakes: ['Rate limiting by user only (not IP)', 'Too generous limits', 'No allow list for health checks'],
    whenToUse: 'Every production application.',
    furtherReading: [{ title: 'Rack::Attack', url: 'https://github.com/rack/rack-attack' }],
  },
  hint: { delay: 20, text: 'Use Rack::Attack with different limits per endpoint.' },
};

// ============================================
// Level 30: Connection Pooling
// ============================================

const level30ConnectionPooling: Level = {
  id: 'act5-level30-connection-pooling',
  actId: 5,
  levelNumber: 30,
  name: 'Connection Pooling',
  trigger: {
    type: 'incident',
    description: 'Database error: "too many connections". Pool exhausted.',
  },
  startingPipeline: { nodes: [], connections: [] },
  problem: {
    observation: 'Database connection errors under load.',
    rootCause: 'Connection pool misconfigured.',
    codeExample: `# Error: ActiveRecord::ConnectionTimeoutError
# could not obtain a connection from the pool within 5.000 seconds`,
    goal: 'Adjust pool size and timeout to handle concurrent requests.',
    thresholds: {},
  },
  successConditions: [{ type: 'connection_pool_configured' }],
  availableNodes: [],
  unlockedNodes: [],
  learningContent: {
    title: 'Database Connection Pooling',
    conceptExplanation: `Pool = Pre-established connections for reuse.

**Key settings:**
- pool_size: Number of connections available
- checkout_timeout: How long to wait for a connection

**Rule of thumb:**
Pool should be >= concurrent requests (workers × threads)`,
    railsCodeExample: `# config/database.yml
production:
  adapter: postgresql
  pool: <%= ENV.fetch('RAILS_MAX_THREADS') { 5 } %>
  checkout_timeout: 5
  variables:
    statement_timeout: 5000

# For Puma with multiple workers
# config/puma.rb
workers ENV.fetch('WEB_CONCURRENCY') { 2 }
threads_count = ENV.fetch('RAILS_MAX_THREADS') { 5 }
threads threads_count, threads_count

on_worker_boot do
  ActiveRecord::Base.establish_connection
end

# config/initializers/sidekiq.rb
Sidekiq.configure_server do |config|
  config.redis = { url: ENV['REDIS_URL'], size: 25 }

  database_url = ENV['DATABASE_URL']
  pool_size = Sidekiq[:concurrency] + 5

  ActiveRecord::Base.establish_connection(
    ActiveRecord::Base.connection_config.merge(pool: pool_size)
  )
end

# Using PgBouncer for connection pooling
production:
  adapter: postgresql
  prepared_statements: false  # Required for PgBouncer
  url: <%= ENV['PGBOUNCER_URL'] %>`,
    commonMistakes: ['Pool too small', 'Not accounting for Sidekiq', 'Forgetting worker boot hook'],
    whenToUse: 'Every Rails app with multiple processes/threads.',
    furtherReading: [{ title: 'Rails Connection Pooling', url: 'https://api.rubyonrails.org/classes/ActiveRecord/ConnectionAdapters/ConnectionPool.html' }],
  },
  hint: { delay: 20, text: 'Pool = threads × workers + background jobs.' },
};

// ============================================
// Level 31: Zero-Downtime Deployments
// ============================================

const level31Deployments: Level = {
  id: 'act5-level31-deployments',
  actId: 5,
  levelNumber: 31,
  name: 'Zero-Downtime Deployments',
  trigger: {
    type: 'incident',
    description: 'Users see errors during deployment. Migration locks table.',
  },
  startingPipeline: { nodes: [], connections: [] },
  problem: {
    observation: 'Downtime during deployments.',
    rootCause: 'No deployment strategy for zero-downtime.',
    codeExample: `# BAD: Add column with default (locks table)
add_column :users, :admin, :boolean, default: false

# GOOD: Three-step migration
# 1. Add column without default
# 2. Backfill in batches
# 3. Add default`,
    goal: 'Configure zero-downtime deployment strategy.',
    thresholds: {},
  },
  successConditions: [{ type: 'zero_downtime_configured' }],
  availableNodes: [],
  unlockedNodes: [],
  learningContent: {
    title: 'Zero-Downtime Deployment Strategies',
    conceptExplanation: `Deploy without interrupting users.

**Strategies:**
- Blue-green: Switch traffic atomically
- Rolling: Replace instances one by one
- Canary: Gradual rollout to subset`,
    railsCodeExample: `# Safe migration: Add column
class AddAdminToUsers < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!  # Don't lock table

  def change
    add_column :users, :admin, :boolean
    # Default added in separate migration after backfill
  end
end

# Safe migration: Add index concurrently
class AddIndexToPostsTitle < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def change
    add_index :posts, :title, algorithm: :concurrently
  end
end

# Backfill in batches
class BackfillAdminColumn < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def up
    User.in_batches(of: 10_000) do |batch|
      batch.update_all(admin: false)
    end
  end
end

# Procfile for phased restart
web: bundle exec puma -C config/puma.rb

# puma.rb
on_restart do
  puts 'Graceful restart initiated'
end

# config/initializers/rack_timeout.rb
Rack::Timeout.service_timeout = 15  # Kill long requests`,
    commonMistakes: ['Locking migrations', 'No phased restart', 'Breaking API compatibility'],
    whenToUse: 'Every production deployment.',
    furtherReading: [{ title: 'Strong Migrations', url: 'https://github.com/ankane/strong_migrations' }],
  },
  hint: { delay: 20, text: 'Use disable_ddl_transaction! and CONCURRENTLY.' },
};

// ============================================
// Act 5 Definition
// ============================================

export const actFive: Act = {
  id: 5,
  name: 'Infrastructure',
  tagline: 'Scaling the Stack',
  description: 'Master Rails infrastructure: load balancing, CDN, rate limiting, connection pooling, and zero-downtime deployments.',
  levels: [
    level27LoadBalancing,
    level28CDN,
    level29RateLimiting,
    level30ConnectionPooling,
    level31Deployments,
  ],
  unlockedNodes: ['load_balancer', 'cdn'],
  metricsVisible: true,
};
