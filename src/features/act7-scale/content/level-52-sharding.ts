import type { Level } from '@/types';

export const level52Sharding: Level = {
	id: 'act7-level52-sharding',
	actId: 7,
	levelNumber: 52,
	name: 'Database Sharding',
	trigger: {
		type: 'scaling',
		description:
			'10M users. Single database at capacity. Writes are bottlenecked. Vertical scaling has hit its ceiling. Time to shard by tenant.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Write throughput plateaued. Largest table has 2 billion rows. Migrations take hours. Backups are failing. Single PostgreSQL instance at maximum IOPS.',
		rootCause:
			'Single database cannot handle the write volume. Vertical scaling is maxed out. Data must be horizontally partitioned across multiple database servers.',
		codeExample: `# Current: Single database, 2B rows, write bottleneck
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end

# The orders table alone has 800M rows
# INSERT latency: 200ms+ (was 5ms a year ago)
# Index rebuilds: 4+ hours
# pg_dump: fails after 6 hours (out of disk)
# Autovacuum: cannot keep up

# Even with read replicas, WRITES are the bottleneck
# Cannot add more write capacity to a single server`,
		goal: 'Implement horizontal sharding by tenant so writes are distributed across multiple databases.',
		thresholds: {
			maxLatency: 100,
		},
	},
	successConditions: [{ type: 'sharding_configured' }],
	availableNodes: ['shard', 'shard_router'],
	unlockedNodes: ['shard', 'shard_router'],
	learningContent: {
		title: 'Horizontal Database Sharding',
		goal: `In this level, you'll:\n- learn how to scale beyond a single database by splitting data across multiple shards.\n- choose a shard key like tenant_id that keeps related data together.\n- configure multiple database shards with automatic routing.\n- set up automatic query routing so your application reads and writes to the correct shard transparently.`,
		conceptExplanation: `Sharding splits data across multiple database servers (shards).

**The capacity wall (without sharding):**
\`\`\`
Orders table:    2 billion rows, 800M in largest table
INSERT latency:  200ms+ (was 5ms a year ago)
Index rebuilds:  4+ hours
pg_dump:         Fails after 6 hours (out of disk)
Autovacuum:      Cannot keep up
Even with read replicas → WRITES are the bottleneck
\`\`\`

**With sharding (3 shards by tenant_id):**
\`\`\`
Each shard:      ~660M rows (manageable)
INSERT latency:  ~5ms (back to normal)
Shard selection: company_id % 3 → shard_one/shard_two/shard_three
\`\`\`

**ShardRecord abstract class pattern:**
Only sharded models inherit from \`ShardRecord\`. Global models (users, tenants) stay on \`ApplicationRecord\`. This is critical: you cannot shard the users table because login must work cross-shard.

**Shard key selection is critical:**
- Tenant ID (company_id): Natural for B2B SaaS, all tenant data on one shard
- User ID: Good for consumer apps, even distribution
- Geographic region: Good for data sovereignty requirements

**Middleware-based shard switching:**
Middleware detects company_id from JWT/subdomain, connects to the correct shard before the controller runs. Uses modular hashing: \`company_id % 3\` → shard selection.

**Rails 6.1+ native sharding:**
- \`connects_to\` supports multiple shards
- \`connected_to(shard: :shard_one) { ... }\` for block-scoped connection
- \`connected_to(shard: :shard_one, role: :reading) { ... }\` for shard + role
- Without connecting: \`ActiveRecord::ConnectionNotEstablished\`

**The cost of sharding (from the book):**
- Analytics requires querying ALL shards + aggregating in memory
- Accounts may need rebalancing (some users generate orders of magnitude more data → hot shard)
- Regional segregation (EU data can't live on US shard) adds more complexity
- A reviewer recommended removing the sharding chapter entirely: "most projects don't need it"
- Author's response: "For many companies, sharding is one of the key decisions that allowed them to scale."

**Trade-offs:**
- Cross-shard queries are expensive (avoid them)
- Cross-shard transactions are impossible (use eventual consistency)
- Rebalancing shards is painful (plan capacity ahead)
- Migrations must run on ALL shards`,
		railsCodeExample: `# config/database.yml
production:
  primary:
    adapter: postgresql
    database: myapp_primary
    host: primary-db.example.com
  primary_replica:
    adapter: postgresql
    database: myapp_primary
    host: primary-replica.example.com
    replica: true
  primary_shard_one:
    adapter: postgresql
    database: myapp_shard_1
    host: shard1.example.com
  primary_shard_two:
    adapter: postgresql
    database: myapp_shard_2
    host: shard2.example.com
  primary_shard_three:
    adapter: postgresql
    database: myapp_shard_3
    host: shard3.example.com

# app/models/application_record.rb
# Global models (users, tenants) use the primary database.
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end

# === ShardRecord abstract class pattern ===
# Only sharded models inherit from ShardRecord.
# Global models (users, tenants) stay on ApplicationRecord.
class ShardRecord < ActiveRecord::Base
  self.abstract_class = true

  connects_to shards: {
    shard_one: { writing: :primary_shard_one, reading: :primary_shard_one_replica },
    shard_two: { writing: :primary_shard_two, reading: :primary_shard_two_replica },
    shard_three: { writing: :primary_shard_three, reading: :primary_shard_three_replica }
  }
end

# Sharded models:
class Order < ShardRecord
  acts_as_tenant :company
end

# Global models stay on ApplicationRecord (single DB):
class User < ApplicationRecord
  # NOT sharded, lives in the global database
end

# === Middleware shard switching ===
# Resolves the shard at the Rack level, before controllers run.
# app/middleware/shard_resolver.rb
class ShardResolver
  SHARD_MAP = {
    0 => :shard_one,
    1 => :shard_two,
    2 => :shard_three
  }.freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    tenant_id = extract_tenant_id(env)
    shard = self.class.shard_for(tenant_id)

    ActiveRecord::Base.connected_to(shard: shard) do
      @app.call(env)
    end
  end

  def self.shard_for(tenant_id)
    shard_index = tenant_id % SHARD_MAP.size
    SHARD_MAP[shard_index]
  end

  private

  def extract_tenant_id(env)
    # From JWT, subdomain, or header (depends on your auth strategy)
    env['current_tenant_id'] || 0
  end
end

# config/application.rb
config.middleware.use ShardResolver

# Migrations run on ALL shards:
# lib/tasks/db.rake
namespace :db do
  task migrate_all_shards: :environment do
    [:shard_one, :shard_two, :shard_three].each do |shard|
      puts "Migrating #{shard}..."
      ActiveRecord::Base.connected_to(shard: shard) do
        ActiveRecord::MigrationContext.new(
          ActiveRecord::Migrator.migrations_paths
        ).migrate
      end
    end
  end
end

# Cross-shard aggregation (admin only, expensive):
class AdminReportService
  def total_orders_count
    total = 0
    [:shard_one, :shard_two, :shard_three].each do |shard|
      ActiveRecord::Base.connected_to(shard: shard) do
        total += Order.count
      end
    end
    total
  end
end

# Testing with shards:
RSpec.describe Order do
  it 'routes to correct shard' do
    tenant = create(:tenant, id: 1)  # shard_two (1 % 3 = 1)

    ActiveRecord::Base.connected_to(shard: :shard_two) do
      order = create(:order, tenant: tenant)
      expect(Order.find(order.id)).to eq(order)
    end

    ActiveRecord::Base.connected_to(shard: :shard_one) do
      expect(Order.count).to eq(0)  # Not on this shard
    end
  end
end`,
		commonMistakes: [
			'Choosing a shard key that causes hot spots (e.g., timestamp-based)',
			'Attempting cross-shard JOINs (they do not work)',
			'Forgetting to run migrations on all shards',
			'Not planning for shard rebalancing when adding new shards',
		],
		whenToUse:
			'When a single database cannot handle write throughput even with vertical scaling maxed out.',
		furtherReading: [
			{
				title: 'Rails Horizontal Sharding',
				url: 'https://guides.rubyonrails.org/active_record_multiple_databases.html#horizontal-sharding',
			},
			{
				title: 'Vitess (MySQL Sharding)',
				url: 'https://vitess.io/',
			},
			{
				title: 'Citus (PostgreSQL Sharding)',
				url: 'https://www.citusdata.com/',
			},
			{
				title: 'Rails Scales!, Chapter 6: Horizontal Sharding',
				url: 'https://pragprog.com/titles/cpscale/rails-scales/',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Use Rails connects_to with shards. Route by tenant_id using consistent hashing.',
	},
};
