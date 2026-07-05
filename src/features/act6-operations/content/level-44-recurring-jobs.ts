import type { Level } from '@/types';

export const level44RecurringJobs: Level = {
	id: 'act6-level44-recurring-jobs',
	actId: 6,
	levelNumber: 44,
	name: 'Recurring Jobs & Scheduling',
	requiresTests: true,
	trigger: {
		type: 'data_growth',
		description:
			'Expired tokens pile up. Old sessions never cleaned. Stale cache entries bloat the database. You have Solid Queue (L36) for one-off jobs, but nothing runs on a schedule.',
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
				config: { label: 'User' },
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
			'Database has 2M expired session tokens, 500K orphaned records, and 100K stale cache entries. Storage growing 5% per week. Nobody cleans up because there is no automated maintenance.',
		rootCause:
			'No scheduled recurring jobs for data maintenance. Cleanup is manual and forgotten.',
		codeExample: `# The database is full of expired data:
Session.where("expires_at < ?", Time.current).count
# => 2,147,832

AuthToken.where("revoked_at < ?", 30.days.ago).count
# => 543,210

AuditLog.where("created_at < ?", 1.year.ago).count
# => 1,234,567

# Nobody runs cleanup because:
# 1. There's no automated scheduling
# 2. Cron jobs are fragile and not tracked
# 3. No visibility into job success/failure

# We need Solid Queue recurring tasks (Rails 8)
# to automate these maintenance operations.`,
		goal: 'Set up recurring background tasks for automated data maintenance.',
		thresholds: {},
	},
	successConditions: [{ type: 'recurring_jobs_configured' }],
	availableNodes: ['background_job', 'scheduler'],
	unlockedNodes: ['scheduler'],
	learningContent: {
		title: 'Recurring Jobs with Solid Queue',
		goal: `In this level, you'll:
- set up recurring background tasks using Rails 8's built-in job scheduler.
- define jobs with cron syntax so they run automatically on a schedule.
- use dedicated queues for maintenance tasks like cleanup and reporting.
- learn why a database-backed scheduler handles recurring jobs natively without external dependencies.`,
		conceptExplanation: `**Solid Queue** is Rails 8's default background job processor. It runs entirely on SQL (no Redis needed) and supports recurring tasks natively.

**Why recurring tasks?**
- Data hygiene: Clean expired tokens, old sessions, orphaned records
- Maintenance: Rebuild search indexes, refresh materialized views
- Business logic: Send digest emails, generate reports, check subscriptions
- Monitoring: Health checks, metric aggregation

**Solid Queue recurring tasks vs cron:**
- Defined in YAML, version-controlled
- Runs inside your Rails app (access to models, mailers, etc.)
- Visible in the Solid Queue dashboard
- No external cron daemon to manage
- Automatic leader election (only one instance runs the task)

**Key concepts:**
- \`config/recurring.yml\` defines the schedule
- Jobs inherit from \`ApplicationJob\` as normal
- Schedule uses cron syntax or human-readable intervals
- Solid Queue handles leader election (no duplicate runs in multi-process)`,
		railsCodeExample: `# ============================
# config/recurring.yml
# ============================
production:
  cleanup_expired_sessions:
    class: CleanupExpiredSessionsJob
    schedule: every hour
    description: "Remove sessions expired more than 24 hours ago"

  cleanup_revoked_tokens:
    class: CleanupRevokedTokensJob
    schedule: "0 2 * * *"  # Daily at 2 AM (cron syntax)
    description: "Remove revoked auth tokens older than 30 days"

  cleanup_old_audit_logs:
    class: CleanupOldAuditLogsJob
    schedule: every Sunday at 3am
    description: "Archive audit logs older than 1 year"

  refresh_analytics:
    class: RefreshAnalyticsJob
    schedule: every 15 minutes
    description: "Refresh materialized views for dashboard"

  send_weekly_digest:
    class: SendWeeklyDigestJob
    schedule: every Monday at 9am
    description: "Send weekly activity digest to subscribed users"

  check_subscription_expirations:
    class: CheckSubscriptionExpirationsJob
    schedule: every day at midnight
    description: "Notify users with expiring subscriptions"

# ============================
# The Jobs
# ============================

# app/jobs/cleanup_expired_sessions_job.rb
class CleanupExpiredSessionsJob < ApplicationJob
  queue_as :maintenance

  def perform
    cutoff = 24.hours.ago
    total_deleted = 0

    Session.where("expires_at < ?", cutoff)
           .in_batches(of: 10_000) do |batch|
      total_deleted += batch.delete_all
      sleep(0.1)  # Reduce DB pressure
    end

    Rails.logger.info(
      "[CleanupExpiredSessions] Removed #{total_deleted} expired sessions"
    )
  end
end

# app/jobs/cleanup_revoked_tokens_job.rb
class CleanupRevokedTokensJob < ApplicationJob
  queue_as :maintenance

  def perform
    cutoff = 30.days.ago
    total_deleted = 0

    AuthToken.where("revoked_at < ?", cutoff)
             .in_batches(of: 5_000) do |batch|
      total_deleted += batch.delete_all
      sleep(0.1)
    end

    Rails.logger.info(
      "[CleanupRevokedTokens] Removed #{total_deleted} tokens older than #{cutoff}"
    )
  end
end

# app/jobs/cleanup_old_audit_logs_job.rb
class CleanupOldAuditLogsJob < ApplicationJob
  queue_as :maintenance

  def perform
    cutoff = 1.year.ago
    total_archived = 0

    # Archive to cold storage before deleting
    AuditLog.where("created_at < ?", cutoff)
            .in_batches(of: 10_000) do |batch|
      ArchiveService.export(batch)
      total_archived += batch.delete_all
    end

    Rails.logger.info(
      "[CleanupOldAuditLogs] Archived #{total_archived} logs older than #{cutoff}"
    )
  end
end

# ============================
# Solid Queue Configuration
# ============================

# config/queue.yml
production:
  dispatchers:
    - polling_interval: 1
      batch_size: 500
      concurrency_maintenance_interval: 300
  workers:
    - queues: [default, mailers]
      threads: 5
      polling_interval: 0.1
    - queues: [maintenance]
      threads: 2
      polling_interval: 1

# Start Solid Queue:
# bin/jobs  (or bundle exec rake solid_queue:start)

# ============================
# Tests
# ============================

# test/jobs/cleanup_expired_sessions_job_test.rb
class CleanupExpiredSessionsJobTest < ActiveJob::TestCase
  test "removes sessions expired more than 24 hours ago" do
    expired = Session.create!(
      user: users(:alice),
      expires_at: 25.hours.ago
    )
    active = Session.create!(
      user: users(:bob),
      expires_at: 1.hour.from_now
    )

    CleanupExpiredSessionsJob.perform_now

    assert_not Session.exists?(expired.id)
    assert Session.exists?(active.id)
  end

  test "does not remove sessions expired less than 24 hours ago" do
    recent = Session.create!(
      user: users(:alice),
      expires_at: 23.hours.ago
    )

    CleanupExpiredSessionsJob.perform_now

    assert Session.exists?(recent.id)
  end
end

# test/jobs/cleanup_revoked_tokens_job_test.rb
class CleanupRevokedTokensJobTest < ActiveJob::TestCase
  test "removes tokens revoked more than 30 days ago" do
    old_token = AuthToken.create!(
      user: users(:alice),
      revoked_at: 31.days.ago
    )
    recent_token = AuthToken.create!(
      user: users(:bob),
      revoked_at: 1.day.ago
    )

    CleanupRevokedTokensJob.perform_now

    assert_not AuthToken.exists?(old_token.id)
    assert AuthToken.exists?(recent_token.id)
  end
end`,
		commonMistakes: [
			'Deleting all matching records in one query (locks table, OOM on large sets)',
			'Not using in_batches for large cleanup operations',
			'Running maintenance jobs on the default queue (blocks user-facing jobs)',
			'No logging or monitoring of recurring job success/failure',
			'Not archiving data before deletion (compliance risk)',
			'Using external cron when Solid Queue recurring tasks handle it natively',
		],
		whenToUse:
			'Any app that creates data with an expiration: sessions, tokens, logs, temporary records. Set up recurring cleanup from the start.',
		furtherReading: [
			{
				title: 'Solid Queue',
				url: 'https://github.com/rails/solid_queue',
			},
			{
				title: 'Active Job Basics',
				url: 'https://guides.rubyonrails.org/active_job_basics.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'You already have the queue from L36. The remaining piece is a scheduler that wakes up on cron-like intervals and enqueues the recurring jobs for you. Solid Queue ships one; you describe what runs when in a single config file.',
	},
};
