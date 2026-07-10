import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level35ActionMailer: Level = {
	id: 'act5-level35-action-mailer',
	actId: 5,
	levelNumber: 35,
	name: 'Action Mailer',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Users forget their passwords and have no way to reset them. Build a password reset flow with secure token generation and email delivery.',
	},
	startingPipeline: standardPipeline({
		modelId: 'user-model',
		modelLabel: 'User',
	}),
	problem: {
		observation:
			'Users who forget their passwords are locked out permanently. Support tickets are piling up asking for manual password resets. There is no self-service flow.',
		rootCause:
			'No password reset flow exists. No mailer is configured to send reset tokens to users.',
		codeExample: `# Currently: no way to reset a password!
# Users must email support, who manually runs:
#   user = User.find_by(email: "...")
#   user.update!(password: "temporary123")
# Then tells the user to change it. Not scalable!

# What we need:
# 1. POST /api/password_resets -- generate token, send email
# 2. PUT  /api/password_resets/:token -- verify token, update password

# Rails 8 can mint expiring, self-contained tokens -- no more
# rolling your own token columns or expiry logic!
# But we need a mailer to deliver the token to the user.`,
		goal: 'Build a password reset flow with secure, expiring tokens and email delivery.',
		thresholds: {},
	},
	successConditions: [{ type: 'mailer_configured' }],
	availableNodes: ['mailer'],
	unlockedNodes: ['mailer'],
	learningContent: {
		title: 'Action Mailer & generates_token_for (Rails 8)',
		goal: `In this level, you'll:\n- build a complete password reset flow with email delivery and secure tokens.\n- learn how to send emails asynchronously from a Rails application.\n- generate secure, stateless tokens that auto-expire without database storage.\n- verify tokens without storing anything in the database.`,
		conceptExplanation: `Action Mailer handles email delivery in Rails. Combined with Rails 8's \`generates_token_for\`, you get secure, expiring tokens without storing them in the database.

**generates_token_for (Rails 8):**
- Generates signed, expiring tokens using \`ActiveRecord::Base.generates_token_for\`
- Tokens are derived from the model's attributes -- they auto-expire when the attribute changes
- No token column needed in the database (stateless!)
- Verifies with \`Model.find_by_token_for(:purpose, token)\`
- Returns \`nil\` if the token is expired, tampered with, or already used

**Action Mailer:**
- Mailers are like controllers for email (each method = one email template)
- Templates live in \`app/views/mailer_name/\`
- Use \`deliver_later\` to send via background job (never \`deliver_now\` in production)
- Preview mailers in the browser at \`/rails/mailers\` during development
- Test with \`assert_emails\` and \`assert_enqueued_emails\`

**Security best practices:**
- Always return the same response whether the email exists or not (prevents enumeration)
- Use short-lived tokens (15 minutes for password reset)
- Invalidate tokens after use (generates_token_for does this automatically when password changes)`,
		railsCodeExample: `# app/models/user.rb
class User < ApplicationRecord
  has_secure_password

  # Rails 8: generates_token_for
  # Token expires in 15 minutes or when password changes
  generates_token_for :password_reset, expires_in: 15.minutes do
    password_salt&.last(10)  # Invalidates when password changes
  end

  # You can define tokens for other purposes too:
  generates_token_for :email_verification, expires_in: 24.hours do
    email
  end
end

# app/mailers/application_mailer.rb
class ApplicationMailer < ActionMailer::Base
  default from: "noreply@socialplatform.com"
  layout "mailer"
end

# app/mailers/user_mailer.rb
class UserMailer < ApplicationMailer
  def password_reset(user)
    @user = user
    @token = user.generate_token_for(:password_reset)
    @reset_url = "https://socialplatform.com/reset-password?token=#{@token}"

    mail(
      to: @user.email,
      subject: "Reset your password"
    )
  end

  def welcome(user)
    @user = user
    mail(to: @user.email, subject: "Welcome to SocialPlatform!")
  end
end

# app/views/user_mailer/password_reset.html.erb
<h1>Password Reset</h1>
<p>Hi <%= @user.name %>,</p>
<p>Click the link below to reset your password. This link expires in 15 minutes.</p>
<p><%= link_to "Reset Password", @reset_url %></p>
<p>If you didn't request this, you can safely ignore this email.</p>

# app/controllers/api/password_resets_controller.rb
class Api::PasswordResetsController < ApplicationController
  skip_before_action :authenticate_user

  # POST /api/password_resets
  def create
    user = User.find_by(email: params[:email])

    # Always return success (don't leak whether email exists)
    if user
      UserMailer.password_reset(user).deliver_later
    end

    render json: { message: "If that email exists, we sent reset instructions." }
  end

  # PUT /api/password_resets/:token
  def update
    user = User.find_by_token_for(:password_reset, params[:token])

    if user.nil?
      render json: {
        error: { code: "invalid_token", message: "Token is invalid or expired" }
      }, status: :unprocessable_entity
      return
    end

    if user.update(password: params[:password])
      # Token is now invalid because password_salt changed!
      render json: { message: "Password updated successfully" }
    else
      render json: {
        error: { code: "validation_failed", details: user.errors.messages }
      }, status: :unprocessable_entity
    end
  end
end

# test/mailers/user_mailer_test.rb
class UserMailerTest < ActionMailer::TestCase
  test "password_reset email contains reset link" do
    user = users(:alice)
    email = UserMailer.password_reset(user)

    assert_emails 1 do
      email.deliver_now
    end

    assert_equal ["noreply@socialplatform.com"], email.from
    assert_equal [user.email], email.to
    assert_match "Reset your password", email.subject
    assert_match "expires in 15 minutes", email.body.encoded
    assert_match "reset-password?token=", email.body.encoded
  end
end

# test/controllers/password_resets_controller_test.rb
class PasswordResetsControllerTest < ActionDispatch::IntegrationTest
  test "create always returns success (no email enumeration)" do
    post api_password_resets_path,
      params: { email: "nonexistent@example.com" }, as: :json

    assert_response :ok
    assert_match "If that email exists", JSON.parse(response.body)["message"]
  end

  test "valid token resets password" do
    user = users(:alice)
    token = user.generate_token_for(:password_reset)

    put api_password_reset_path(token),
      params: { password: "newsecure123" }, as: :json

    assert_response :ok
    assert user.reload.authenticate("newsecure123")
  end

  test "expired token is rejected" do
    user = users(:alice)
    token = user.generate_token_for(:password_reset)

    travel 20.minutes  # Token expired (15 min limit)

    put api_password_reset_path(token),
      params: { password: "newsecure123" }, as: :json

    assert_response :unprocessable_entity
    json = JSON.parse(response.body)
    assert_equal "invalid_token", json.dig("error", "code")
  end

  test "token is single-use (invalidated after password change)" do
    user = users(:alice)
    token = user.generate_token_for(:password_reset)

    # First use: succeeds
    put api_password_reset_path(token),
      params: { password: "newsecure123" }, as: :json
    assert_response :ok

    # Second use: fails (password_salt changed)
    put api_password_reset_path(token),
      params: { password: "another_password" }, as: :json
    assert_response :unprocessable_entity
  end
end`,
		commonMistakes: [
			'Using deliver_now in production (blocks the HTTP response for 2-3 seconds)',
			'Leaking whether an email exists in the response (enables account enumeration attacks)',
			'Storing reset tokens in the database (generates_token_for eliminates this entirely)',
			'Not setting token expiration (tokens should be short-lived, 15-30 minutes)',
			'Forgetting that the token auto-invalidates after password change (no manual cleanup needed)',
		],
		whenToUse:
			'Any feature that requires email delivery: password resets, welcome emails, notifications, order confirmations, weekly digests.',
		furtherReading: [
			{
				title: 'Action Mailer Basics',
				url: 'https://guides.rubyonrails.org/action_mailer_basics.html',
			},
			{
				title: 'Rails 8 generates_token_for',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/TokenFor/ClassMethods.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Two pieces: a class that composes the email (subject, body, recipient) using ERB templates, and a token mechanism for the password-reset link that does not require storing reset tokens in the database. Rails 7.1+ ships a built-in helper for the second piece.',
	},
};
