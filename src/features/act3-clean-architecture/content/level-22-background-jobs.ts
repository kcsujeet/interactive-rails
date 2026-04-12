import type { Level } from '@/types';

export const level22BackgroundJobs: Level = {
	id: 'act3-level22-background-jobs',
	actId: 3,
	levelNumber: 22,
	name: 'Background Jobs',
	requiresTests: true,
	trigger: {
		type: 'performance_alert',
		description:
			'Email sending blocks the HTTP response for 3 seconds. Users stare at a loading spinner while the mailer talks to the SMTP server. The external profile sync adds another 2 seconds. Move it all to background jobs.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 240, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 400,
				y: 220,
				locked: true,
				config: { label: 'RegistrationsController' },
			},
			{
				id: 'service-node',
				type: 'service',
				x: 600,
				y: 220,
				locked: true,
				config: { label: 'UserRegistration' },
			},
			{
				id: 'user-model',
				type: 'model',
				x: 800,
				y: 140,
				locked: true,
				config: { label: 'User' },
			},
			{
				id: 'mailer-node',
				type: 'mailer',
				x: 800,
				y: 380,
				locked: true,
				config: { label: 'UserMailer' },
			},
			{ id: 'database-node', type: 'database', x: 980, y: 140, locked: true },
			{ id: 'response-node', type: 'response', x: 980, y: 380, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{
				id: 'c2',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{
				id: 'c3',
				sourceNodeId: 'controller-node',
				targetNodeId: 'service-node',
			},
			{ id: 'c4', sourceNodeId: 'service-node', targetNodeId: 'user-model' },
			{ id: 'c5', sourceNodeId: 'service-node', targetNodeId: 'mailer-node' },
			{ id: 'c6', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{
				id: 'c7',
				sourceNodeId: 'controller-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'Registration takes 5+ seconds because the mailer calls the SMTP server synchronously (3s) and the external profile sync adds another 2s. Users think the app is broken.',
		rootCause:
			'Side effects (email, profile sync, preferences setup) are executed inline during the request cycle instead of being offloaded to background jobs.',
		codeExample: `# app/services/user_registration.rb -- currently synchronous
class UserRegistration < ApplicationService
  def call
    user = User.create!(@params)

    # These block the HTTP response!
    UserMailer.welcome(user).deliver_now       # 2-3 seconds
    ExternalProfileSync.call(user)              # 1-2 seconds
    DefaultPreferences.apply!(user)              # 0.5 seconds

    Result.new(success?: true, user: user, errors: [])
  end
end

# Total response time: 4-6 seconds (should be < 200ms)
# If the email server is slow, every user waits
# If the external profile sync times out, registration times out
# If profile setup fails, the entire registration fails`,
		goal: 'Move slow side effects out of the request cycle into background jobs using Rails 8 defaults.',
		thresholds: {},
	},
	successConditions: [{ type: 'background_jobs_configured' }],
	availableNodes: ['background_job'],
	unlockedNodes: ['background_job'],
	learningContent: {
		title: 'Background Jobs with Solid Queue (Rails 8)',
		goal: `In this level, you'll:\n- learn how to move slow work like email delivery and external API calls out of the request cycle.\n- use Rails 8's database-backed job processor (no Redis required).\n- design your jobs to be idempotent so they're safe to retry.`,
		conceptExplanation: `Background jobs move slow or unreliable work out of the HTTP request cycle. Rails 8 ships with Solid Queue as the default job backend -- no Redis required.

**Solid Queue (Rails 8 default):**
- Database-backed job queue (uses your existing database)
- No Redis or external dependencies needed
- Supports queues, priorities, retries, and concurrency controls
- Built-in features: unique jobs, recurring jobs, pausing queues
- Stores jobs in your database -- easy to inspect, debug, and monitor

**ActiveJob:**
- Rails' unified API for background jobs
- \`perform_later\` enqueues the job (returns immediately)
- \`perform_now\` runs inline (useful for testing)
- Automatic retries with configurable backoff strategies
- \`retry_on\` and \`discard_on\` for error handling

**What to background:**
- Email delivery (\`deliver_later\` instead of \`deliver_now\`)
- External API calls (webhooks, third-party services)
- File processing (image resizing, PDF generation, CSV exports)
- Data exports, reports, and batch operations
- Anything that takes more than ~100ms

**Idempotency is critical:**
Jobs may run more than once (retries, queue restarts). Design every job to be safe to re-run.`,
		railsCodeExample: `# config/application.rb -- Rails 8 default
config.active_job.queue_adapter = :solid_queue

# config/queue.yml -- Solid Queue configuration
default: &default
  dispatchers:
    - polling_interval: 1
      batch_size: 500
  workers:
    - queues: "*"
      threads: 5
      polling_interval: 0.1

production:
  <<: *default
  workers:
    - queues: [default, mailers]
      threads: 5
      polling_interval: 0.1
    - queues: [low_priority]
      threads: 2
      polling_interval: 5

# app/jobs/sync_external_profile_job.rb
class SyncExternalProfileJob < ApplicationJob
  queue_as :default

  # Solid Queue: retry with exponential backoff
  retry_on Net::OpenTimeout, wait: :polynomially_longer, attempts: 5
  discard_on ActiveRecord::RecordNotFound  # Don't retry if user was deleted

  def perform(user_id)
    user = User.find(user_id)
    return if user.external_profile_synced?  # Idempotent!

    ExternalProfileService.sync(
      email: user.email,
      name: user.name,
      metadata: { user_id: user.id }
    )

    user.update!(external_profile_synced: true)
  end
end

# app/jobs/apply_default_prefs_job.rb
class ApplyDefaultPrefsJob < ApplicationJob
  queue_as :low_priority

  retry_on Net::OpenTimeout, wait: 30.seconds, attempts: 3

  def perform(user_id)
    user = User.find(user_id)
    DefaultPreferences.apply!(user)
  end
end

# app/services/user_registration.rb -- now async!
class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(params)
    @params = params
  end

  def call
    user = User.create!(@params)

    # All side effects are now background jobs
    UserMailer.welcome(user).deliver_later                # Queued!
    SyncExternalProfileJob.perform_later(user.id)         # Queued!
    ApplyDefaultPrefsJob.perform_later(user.id)            # Queued!

    # Response returns instantly (< 200ms)
    Result.new(success?: true, user: user, errors: [])
  rescue ActiveRecord::RecordInvalid => e
    Result.new(success?: false, user: nil, errors: e.record.errors.full_messages)
  end
end

# test/jobs/sync_external_profile_job_test.rb
class SyncExternalProfileJobTest < ActiveJob::TestCase
  test "enqueues job on registration" do
    assert_enqueued_with(job: SyncExternalProfileJob) do
      SyncExternalProfileJob.perform_later(users(:alice).id)
    end
  end

  test "is idempotent -- skips if already synced" do
    user = users(:alice)
    user.update!(external_profile_synced: true)

    # Should not call external service
    assert_no_changes -> { user.reload.external_profile_synced } do
      SyncExternalProfileJob.perform_now(user.id)
    end
  end

  test "retries on transient network errors" do
    perform_enqueued_jobs do
      assert_performed_with(job: SyncExternalProfileJob) do
        SyncExternalProfileJob.perform_later(users(:alice).id)
      end
    end
  end
end

# test/services/user_registration_test.rb
class UserRegistrationTest < ActiveSupport::TestCase
  test "registration enqueues all background jobs" do
    result = UserRegistration.call(
      email: "new@example.com", password: "secure123", name: "Alice"
    )

    assert result.success?
    assert_enqueued_jobs 3  # welcome email + profile sync + preferences
  end
end

# Running Solid Queue workers:
# bin/jobs start                    -- start all workers
# bin/jobs start --queues=mailers   -- start worker for specific queue

# Monitoring in Rails console:
# SolidQueue::Job.where(queue_name: "default").count
# SolidQueue::FailedExecution.last(10)`,
		commonMistakes: [
			'Passing ActiveRecord objects instead of IDs to perform_later (objects get serialized and may be stale on deserialization)',
			'Not making jobs idempotent (they may run more than once on retry or queue restart)',
			'Using deliver_now instead of deliver_later in production (blocks the request)',
			'Not setting retry policies with retry_on (jobs fail silently and are lost)',
			'Not separating queues by priority (time-sensitive email should not wait behind analytics)',
			'Forgetting that Solid Queue uses your database (monitor DB load under heavy job throughput)',
		],
		whenToUse:
			'Any operation that takes more than 100ms, calls an external service, or does not need to complete before the HTTP response is sent.',
		furtherReading: [
			{
				title: 'Active Job Basics',
				url: 'https://guides.rubyonrails.org/active_job_basics.html',
			},
			{
				title: 'Solid Queue (Rails 8 default)',
				url: 'https://github.com/rails/solid_queue',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Background Job node between the service and the mailer. Jobs process asynchronously so the HTTP response returns instantly.',
	},
};
