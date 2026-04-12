import type { Level } from '@/types';

export const level37Realtime: Level = {
	id: 'act5-level37-realtime',
	actId: 5,
	levelNumber: 37,
	name: 'Real-Time',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Users want live notifications when their payments complete. The ProcessPayment service has no way to push updates. HTTP polling every 2 seconds is killing the server with 50,000 concurrent users.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation:
			'50,000 users polling every 2 seconds = 25,000 requests/second. 99% of polls return empty. Server CPU at 95%. The ProcessPayment service creates records but has no real-time push mechanism.',
		rootCause:
			'HTTP polling wastes resources when there are no new events. Need server-push via WebSockets to only send data when something actually changes.',
		codeExample: `# The ProcessPayment service completes payments,
# but has no way to notify users in real-time.
# Clients must poll GET /notifications every 2 seconds.
#
# 50K users x 0.5 req/sec = 25K wasted requests/sec
# 99% return empty arrays. CPU at 95%.
#
# app/services/process_payment.rb
class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def call
    validation = PaymentContract.new.call(@params)
    return failure(validation) if validation.failure?

    payment = @user.payments.create!(amount: @params[:amount])
    # No way to tell the user their payment completed!
    # They find out on their next poll cycle (up to 2s delay)
    Result.new(success?: true, payment:, errors: {})
  end
end`,
		goal: 'Replace HTTP polling with WebSocket push for real-time notifications, authenticate connections, and build a broadcast service.',
		thresholds: {},
	},
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Real-Time with Action Cable & Solid Cable',
		goal: `In this level, you'll:\n- Replace HTTP polling with WebSocket push for real-time notifications\n- Install a database-backed WebSocket adapter (no Redis required)\n- Authenticate WebSocket connections via encrypted cookies\n- Build a broadcast service that pushes updates when records are created`,
		conceptExplanation: `Action Cable integrates WebSockets with Rails. Rails 8 uses Solid Cable as the default adapter, storing pub/sub messages in the database instead of Redis.

**Solid Cable (Rails 8 default):**
- Uses the database for pub/sub instead of Redis
- No additional infrastructure needed
- Handles most apps (< 100K concurrent connections)
- Automatic message pruning via configurable retention

**Action Cable concepts:**
- **Channel**: Like a controller for WebSockets (subscribe/unsubscribe/receive)
- **Stream**: A named broadcast target (e.g., "notifications:user_42")
- **Connection**: The WebSocket connection with authentication
- **Subscription**: Client subscribes to a channel to receive pushes`,
		railsCodeExample: `# config/cable.yml (Solid Cable, no Redis!)
production:
  adapter: solid_cable
  polling_interval: 0.1.seconds
  message_retention: 1.day

# app/channels/application_cable/connection.rb
module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      verified = User.find_by(id: cookies.encrypted[:user_id])
      verified || reject_unauthorized_connection
    end
  end
end

# app/channels/notifications_channel.rb
class NotificationsChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
  end
end

# app/services/broadcast_notification.rb
class BroadcastNotification < ApplicationService
  Result = Data.define(:success?, :notification, :errors)

  def initialize(user:, title:, body:)
    @user = user
    @title = title
    @body = body
  end

  def call
    validation = NotificationContract.new.call(
      title: @title, body: @body
    )
    if validation.failure?
      return Result.new(
        success?: false, notification: nil,
        errors: validation.errors.to_h
      )
    end

    notification = @user.notifications.create!(
      title: @title, body: @body
    )
    # after_create_commit on Notification broadcasts automatically
    Result.new(success?: true, notification:, errors: {})
  end
end

# app/models/notification.rb
class Notification < ApplicationRecord
  belongs_to :user
  validates :title, :body, presence: true

  after_create_commit :broadcast_to_user

  private

  def broadcast_to_user
    NotificationsChannel.broadcast_to(
      user,
      NotificationSerializer.new(self).serializable_hash
    )
  end
end`,
		commonMistakes: [
			'Not authenticating WebSocket connections (anyone can subscribe)',
			'Broadcasting too much data (send IDs, let client fetch details)',
			'Using Redis when Solid Cable is sufficient (unnecessary infrastructure)',
			'Broadcasting in the request cycle instead of via model callbacks',
		],
		whenToUse:
			'Live notifications, chat, real-time dashboards, collaborative editing. Replace polling whenever events are infrequent relative to poll interval.',
		furtherReading: [
			{
				title: 'Action Cable Overview',
				url: 'https://guides.rubyonrails.org/action_cable_overview.html',
			},
			{
				title: 'Solid Cable (Rails 8)',
				url: 'https://github.com/rails/solid_cable',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Install solid_cable, generate a NotificationsChannel, authenticate connections via encrypted cookies, then build a service that creates notifications with after_create_commit broadcasting.',
	},
};
