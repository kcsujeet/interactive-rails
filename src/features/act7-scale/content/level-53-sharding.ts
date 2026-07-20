import type { Level } from '@/types';

export const level53Sharding: Level = {
	id: 'act7-level53-sharding',
	actId: 7,
	levelNumber: 53,
	name: 'Database Sharding',
	trigger: {
		type: 'scaling',
		description:
			'10M users. Single database at capacity. Writes are bottlenecked. Vertical scaling has hit its ceiling. Time to shard by tenant, the isolation boundary you drew in L52.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Write throughput plateaued. The orders table has 1.6 billion rows. Migrations take hours. Backups are failing. Single PostgreSQL instance at maximum IOPS.',
		rootCause:
			'Single database cannot handle the write volume. Vertical scaling is maxed out. Data must be horizontally partitioned across multiple database servers.',
		codeExample: `# Current: Single database, 1.6B rows, write bottleneck
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end

# The orders table has 1.6B rows (Acme 800M + Globex 500M + Initech 300M)
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
Orders table:    1.6 billion rows (Acme 800M + Globex 500M + Initech 300M)
INSERT latency:  200ms+ (was 5ms a year ago)
Index rebuilds:  4+ hours
pg_dump:         Fails after 6 hours (out of disk)
Autovacuum:      Cannot keep up
Even with read replicas → WRITES are the bottleneck
\`\`\`

**With sharding (3 shards by tenant_id):**
\`\`\`
Shard sizes:     uneven, because tenants are uneven.
                 Acme 800M (hot shard), Globex 500M, Initech 300M.
INSERT latency:  ~5ms (back to normal): each shard is small
                 enough to vacuum, index, and back up.
Shard selection: company_id % 3 → shard_one/shard_two/shard_three
\`\`\`
Modulo-by-tenant does NOT balance load: a big tenant makes a hot shard (see the trade-offs below). It keeps each tenant on one shard, which is what makes single-tenant queries fast. Rebalancing a hot tenant onto its own shard is a later, deliberate step.

**ShardRecord abstract class pattern:**
Only sharded models inherit from \`ShardRecord\`. Global models (users, tenants) stay on \`ApplicationRecord\`. This is critical: you cannot shard the users table because login must work cross-shard.

**Shard key selection is critical:**
- Tenant ID (company_id): Natural for B2B SaaS, all tenant data on one shard
- User ID: Good for consumer apps, even distribution
- Geographic region: Good for data sovereignty requirements

**Automatic shard switching (use the framework, do not hand-roll):**
Rails ships a built-in shard selector. You give it a resolver that returns the shard for the current request (derived from the authenticated tenant, never client input), and it switches the connection before the controller runs. Hand-rolling Rack middleware for this re-implements what the framework provides (the same trap L51 flagged for read/write splitting).

\`\`\`ruby
config.active_record.shard_selector = { lock: true }
config.active_record.shard_resolver = ->(request) do
  ShardRouting.shard_for(ActsAsTenant.current_tenant.id)
end
\`\`\`

**Granular vs global connection switching:**
- \`connects_to shards:\` on \`ShardRecord\` declares the shard mappings.
- \`ShardRecord.connected_to(shard: :shard_one) { ... }\` switches ONLY the sharded models (granular). This is what you want.
- \`ActiveRecord::Base.connected_to(shard: ...)\` tries to switch EVERY connection handler globally, including global models (User, Company) that have no shard pool, so it raises \`ActiveRecord::ConnectionNotEstablished\`.
- \`ShardRecord.connected_to(shard: :shard_one, role: :reading) { ... }\` combines shard + role (only if each shard also has a reading role declared).

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
# (Each shard here has a writing role only. Add reading roles
#  and matching *_replica entries in database.yml if you later
#  give each shard its own read replica.)
class ShardRecord < ApplicationRecord
  self.abstract_class = true

  connects_to shards: {
    shard_one: { writing: :primary_shard_one },
    shard_two: { writing: :primary_shard_two },
    shard_three: { writing: :primary_shard_three }
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

# === Automatic shard switching (Rails built-in) ===
# Do NOT hand-roll Rack middleware for this (that is the same
# trap L51 called out for read/write splitting). Rails ships a
# shard selector: give it a resolver that returns the shard for
# the current request, and it switches the connection for you.
# app/lib/shard_routing.rb
module ShardRouting
  SHARDS = %i[shard_one shard_two shard_three].freeze

  def self.shard_for(tenant_id)
    SHARDS[tenant_id % SHARDS.size]
  end
end

# config/application.rb
config.active_record.shard_selector = { lock: true }
config.active_record.shard_resolver = ->(request) do
  tenant = ActsAsTenant.current_tenant   # from the authenticated tenant, never client input
  ShardRouting.shard_for(tenant.id)
end

# Granular switching: ShardRecord.connected_to only moves the
# sharded models. Global models (User, Company) keep using the
# primary. ActiveRecord::Base.connected_to would try to move
# EVERY connection handler, and the global models have no
# shard_one/two/three pool, so it raises ConnectionNotEstablished.

# Migrations run on ALL shards:
# lib/tasks/db.rake
namespace :db do
  task migrate_all_shards: :environment do
    ShardRouting::SHARDS.each do |shard|
      puts "Migrating #{shard}..."
      ShardRecord.connected_to(shard: shard) do
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
    ShardRouting::SHARDS.sum do |shard|
      ShardRecord.connected_to(shard: shard) { Order.count }
    end
  end
end

# Testing with shards:
RSpec.describe Order do
  it 'routes to correct shard' do
    tenant = create(:company, id: 1)  # shard_two (1 % 3 = 1)

    ShardRecord.connected_to(shard: :shard_two) do
      order = create(:order, company: tenant)
      expect(Order.find(order.id)).to eq(order)
    end

    ShardRecord.connected_to(shard: :shard_one) do
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
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
		homework: [
			{
				task: 'Stand up two local shards: add primary_shard_one and primary_shard_two entries to config/database.yml as two new local PostgreSQL databases, create them, and add a ShardRecord abstract class with connects_to shards pointing at both.',
				commands: ['bin/rails db:create'],
				verify:
					'db:create reports both shard databases created, and the console loads ShardRecord without connection errors.',
			},
			{
				task: 'Observe shard isolation: load your schema into each shard (the per-database rake tasks appear once database.yml lists them), move a practice model onto ShardRecord, then create a record inside ShardRecord.connected_to(shard: :shard_one) and count from the other shard.',
				commands: [
					"bin/rails runner 'ShardRecord.connected_to(shard: :shard_two) { puts Order.count }'",
				],
				verify:
					'The record created on shard_one is invisible from shard_two: two shards are two fully separate databases.',
			},
			{
				task: 'Write the router: a shard_for(tenant_id) helper that picks a shard with modulo over the shard list.',
				verify:
					'In the console, shard_for(0) returns :shard_one and shard_for(1) returns :shard_two, and the same tenant id always maps to the same shard.',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Same `connects_to` declaration, different argument: instead of a writing/reading split, you list multiple shards and pick which one a given query lands on. The picker is usually a hash of the tenant id so a single tenant always lives on a single shard.',
	},
};
