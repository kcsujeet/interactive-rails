import type { Level } from '@/types';

export const level51MultiDatabase: Level = {
	id: 'act7-level51-multi-database',
	actId: 7,
	levelNumber: 51,
	name: 'Multi-Database',
	trigger: {
		type: 'scaling',
		description:
			'Reads are 90% of traffic competing with writes. The primary database is groaning under mixed workloads. Split read/write to separate databases.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Write latency spikes during peak read traffic. Reads and writes compete for shared CPU, memory, and I/O on a single server.',
		rootCause:
			'All reads and writes hit a single database. No read/write splitting configured.',
		codeExample: `# Current: Every query hits the primary database
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class
end

# All reads compete with writes for CPU, memory, and I/O:
Order.where(status: "shipped").order(created_at: :desc) # SELECT ... (heavy read I/O)
Order.create!(customer_id: 42, total: 99_00)            # INSERT ... (competes for same resources)

# Under load:
# - PostgreSQL MVCC means readers don't block writers,
#   but they compete for CPU, memory, disk I/O, and shared buffer cache
# - Heavy analytical reads starve write throughput
# - p99 latency: 800ms and climbing`,
		goal: 'Configure read replicas so reads go to replicas and writes go to the primary.',
		thresholds: {
			maxLatency: 200,
		},
	},
	successConditions: [{ type: 'multi_database_configured' }],
	availableNodes: ['database', 'read_replica'],
	unlockedNodes: ['read_replica'],
	learningContent: {
		title: 'Multi-Database with connects_to',
		goal: `In this level, you'll:\n- learn how to scale your database by splitting reads and writes across multiple servers.\n- configure your application to route reads to replicas and writes to the primary.\n- set up automatic role switching so Rails handles read/write routing transparently.\n- handle the tricky edge cases around replication delay.`,
		conceptExplanation: `Rails 6+ supports multiple databases natively via \`connects_to\`.

**Key concepts:**
- \`connects_to\` declares which databases a model can use
- \`connected_to\` switches the connection at runtime
- Automatic role switching sends reads to replicas after a configurable delay
- \`database_selector\` middleware automates read/write routing

**Read replica benefits:**
- Reads (90% of traffic) offloaded to replicas
- Writes get exclusive access to the primary
- Horizontal read scaling by adding more replicas
- Replicas can serve stale data (replication lag)`,
		railsCodeExample: `# config/database.yml
production:
  primary:
    adapter: postgresql
    database: myapp_primary
    host: primary-db.example.com
  primary_replica:
    adapter: postgresql
    database: myapp_primary
    host: replica-db.example.com
    replica: true

# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end

# Automatic role switching (config/application.rb)
config.active_record.database_selector = { delay: 2.seconds }
config.active_record.database_resolver =
  ActiveRecord::Middleware::DatabaseSelector::Resolver
config.active_record.database_resolver_context =
  ActiveRecord::Middleware::DatabaseSelector::Resolver::Session

# Manual switching when needed
ActiveRecord::Base.connected_to(role: :reading) do
  Order.where(status: "shipped").to_a  # Hits replica
end

ActiveRecord::Base.connected_to(role: :writing) do
  Order.create!(customer_id: 42, total: 99_00)  # Hits primary
end

# In controllers (automatic): GET requests read from replica,
# POST/PUT/PATCH/DELETE write to primary`,
		commonMistakes: [
			'Not accounting for replication lag (user writes then immediately reads stale data)',
			'Forgetting to set replica: true in database.yml (Rails treats it as writable)',
			'Running migrations against replicas instead of primary only',
			'Not configuring the delay parameter for automatic switching',
		],
		whenToUse:
			'When read traffic dominates and a single DB cannot handle the mixed workload.',
		furtherReading: [
			{
				title: 'Multiple Databases with Active Record',
				url: 'https://guides.rubyonrails.org/active_record_multiple_databases.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Rails ships a declaration on ApplicationRecord that lets you map a "writing role" to the primary database and a "reading role" to a replica. Once that is declared, the routing decision is automatic -- writes go one place, reads can go to the other.',
	},
};
