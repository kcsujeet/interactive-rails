import type { Level } from '@/types';

export const levelDataLifecycle: Level = {
	id: 'act6-level46-data-lifecycle',
	actId: 6,
	levelNumber: 46,
	name: 'Data Lifecycle',
	trigger: {
		type: 'data_growth',
		description:
			'The orders table has 50M rows. 95% are older than 1 year and never accessed. Queries are slow, backups fail, and migrations take hours.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'controller-node',
				type: 'controller',
				x: 200,
				y: 250,
				locked: true,
			},
			{
				id: 'model-node',
				type: 'model',
				x: 400,
				y: 250,
				locked: true,
				config: { label: 'Order' },
			},
			{ id: 'database-node', type: 'database', x: 600, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c2', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'The database has 50M rows but only 2.5M are accessed regularly. Old data slows every query, backups fail, and migrations take hours.',
		rootCause:
			'No data lifecycle management. All data lives in the same hot storage forever, regardless of access patterns.',
		codeExample: `# The orders table has 50M rows
Order.count  # => 50,000,000

# But only 5% are accessed:
Order.where("created_at > ?", 1.year.ago).count  # => 2,500,000
Order.where("created_at < ?", 1.year.ago).count  # => 47,500,000

# Every query scans the full table:
# EXPLAIN: Seq Scan on orders (rows=50,000,000)
# Even indexed queries are slow; the index itself is 4GB

# Backups take 6 hours and sometimes fail
# pg_dump: 48GB uncompressed
# Migrations: ALTER TABLE on 50M rows = 30 minute lock

# The "assumed requirement" is keeping everything forever.
# But who actually needs a 3-year-old draft order?`,
		goal: 'Classify data by temperature (hot/warm/cold). Archive old data. Implement data destruction policies.',
		thresholds: {},
	},
	successConditions: [{ type: 'queries_optimized' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Data Lifecycle: Hot, Warm & Cold Data',
		goal: `In this level, you'll:
- learn how to manage data as it ages.
- classify data into hot (actively accessed), warm (read-only), and cold (archived) tiers.
- move old data to cheaper storage or destroy it entirely.
- understand why cleaning up unused data is the most impactful scalability optimization you can make.`,
		conceptExplanation: `Most apps never clean up old data. This is a production reality that separates hobby projects from scalable systems.

**Data temperature tiers:**
- **Hot (last 30 days):** Full access, fast queries, primary database. This is your active working set
- **Warm (30-365 days):** Read-only access, occasional lookups. Can live in a separate table or read replica
- **Cold (1yr+):** Export-only, compliance archives. Move to S3, separate DB, or delete entirely

**Performance impact (50M rows vs 2.5M rows):**
\`\`\`
Full table (50M rows):
  Index scan:   ~45ms (4GB index)
  Backup:       6 hours (48GB)
  Migration:    30 min (table lock)

After archiving (2.5M rows):
  Index scan:   ~3ms (200MB index) → 15x faster
  Backup:       20 minutes → 18x faster
  Migration:    30 seconds → 60x faster
\`\`\`

**The Gordian Knot metaphor:** The "assumed requirement" is keeping everything forever. Challenge it. Destroying data is the most effective scalability solution: if the data isn't there, you don't need to query it, index it, back it up, or migrate it.

**Archiving strategies for warm data:**
- **Separate table** (\`archived_orders\`): SQL queries still work. Easy to re-query if needed
- **Redis with AOF persistence**: Key-value access, fast reads for specific lookups
- **S3/object storage**: Cheapest. Export-only. Good for compliance archives
- **Separate database**: Full SQL, but isolated from hot data. Use for analytics

**Data destruction best practices:**
- Define retention policies per data type (orders: 2 years, logs: 90 days, sessions: 30 days)
- Use recurring jobs (Solid Queue) to enforce retention automatically
- Archive before destroying (compliance safety net)
- Delete in batches with \`in_batches\` to avoid table locks`,
		railsCodeExample: `# === Step 1: Classify data by temperature ===

# app/models/concerns/data_lifecycle.rb
module DataLifecycle
  extend ActiveSupport::Concern

  included do
    scope :hot,  -> { where("created_at > ?", 30.days.ago) }
    scope :warm, -> { where(created_at: 1.year.ago..30.days.ago) }
    scope :cold, -> { where("created_at < ?", 1.year.ago) }
  end
end

class Order < ApplicationRecord
  include DataLifecycle
end

# === Step 2: Archive warm data ===

# app/jobs/archive_old_orders_job.rb
class ArchiveOldOrdersJob < ApplicationJob
  queue_as :maintenance

  def perform
    cutoff = 1.year.ago
    total_archived = 0

    Order.cold.in_batches(of: 5_000) do |batch|
      # Export to S3 or separate table
      ArchiveService.export_batch(batch, table: :archived_orders)
      total_archived += batch.delete_all
      sleep(0.1)  # Reduce DB pressure
    end

    Rails.logger.info(
      "[ArchiveOldOrders] Archived #{total_archived} orders older than #{cutoff}"
    )
  end
end

# === Step 3: Separate archived table ===

class CreateArchivedOrders < ActiveRecord::Migration[8.0]
  def change
    create_table :archived_orders do |t|
      t.references :user, null: false
      t.decimal :total, precision: 10, scale: 2
      t.string :status
      t.jsonb :snapshot  # Full order data as JSON
      t.datetime :original_created_at
      t.timestamps
    end
    add_index :archived_orders, :original_created_at
    add_index :archived_orders, :user_id
  end
end

# === Step 4: Retention policy enforcement ===

# config/recurring.yml
production:
  archive_old_orders:
    class: ArchiveOldOrdersJob
    schedule: every Sunday at 2am
    description: "Archive orders older than 1 year"

  destroy_expired_sessions:
    class: DestroyExpiredSessionsJob
    schedule: every hour
    description: "Delete sessions older than 30 days"

  cleanup_old_audit_logs:
    class: CleanupOldAuditLogsJob
    schedule: every Sunday at 3am
    description: "Delete audit logs older than 2 years"

# === Step 5: Query optimization after archiving ===

# Before: 50M rows, 4GB index
Order.where(status: "shipped").order(created_at: :desc).limit(25)
# Seq Scan on orders (cost=0.00..2500000.00 rows=50000000)

# After: 2.5M rows, 200MB index
Order.where(status: "shipped").order(created_at: :desc).limit(25)
# Index Scan using index_orders_on_status_created_at (rows=125000)`,
		commonMistakes: [
			'Keeping all data forever without questioning the requirement',
			'Deleting data in one giant DELETE (locks the table for minutes)',
			'Not archiving before destroying (no recovery path)',
			'Archiving to the same database (does not reduce backup size)',
			'Not automating retention with recurring jobs (manual cleanup is forgotten)',
		],
		whenToUse:
			'Any app with growing data that is accessed less frequently over time: orders, logs, sessions, audit trails, notifications. Start thinking about data lifecycle when your largest table exceeds 10M rows.',
		furtherReading: [
			{
				title: 'PostgreSQL Partitioning',
				url: 'https://www.postgresql.org/docs/current/ddl-partitioning.html',
			},
			{
				title:
					'Book: "Rails Scales!", Chapter 7: Hot/Warm/Cold Data & Archiving',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Classify your data into hot (30 days), warm (30-365 days), and cold (1yr+). Archive cold data to a separate table. Automate with recurring jobs.',
	},
};
