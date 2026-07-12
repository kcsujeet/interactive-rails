import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level16ServiceObjects: Level = {
	id: 'act3-level16-service-objects',
	actId: 3,
	levelNumber: 16,
	name: 'Service Objects',
	requiresTests: true,
	trigger: {
		type: 'refactor_request',
		description:
			'Signup kept growing: UsersController#create now creates the user, sends the welcome email, applies default preferences, logs the customer in, and renders the response. Next week support needs the exact same workflow to bulk-import 500 sellers from a CSV, and none of it can run outside an HTTP request.',
	},
	startingPipeline: standardPipeline(),
	problem: {
		observation:
			'One controller action does five jobs. The workflow cannot be reused from a rake task (it is welded to request and render), cannot be tested without HTTP, and every new signup requirement lands in the same method, which is how it got this long in the first place.',
		rootCause:
			'The business workflow lives in the HTTP layer. Controllers are entry points, not homes: when a multi-step workflow lives inline in an action, its only callers can be HTTP requests, and its only tests can be request tests.',
		codeExample: `# app/controllers/users_controller.rb
class UsersController < ApplicationController
  allow_unauthenticated_access only: :create

  def create
    @user = User.new(user_params)

    if @user.save
      send_welcome_email(@user)                  # job 2

      @user.update!(                             # job 3
        locale: "en",
        timezone: "UTC",
        notification_preference: "email",
      )

      session = @user.sessions.create!(          # job 4
        ip_address: request.remote_ip,
        user_agent: request.user_agent,
      )

      render json: {                             # job 5
        id: @user.id,
        email_address: @user.email_address,
        token: session.token,
      }, status: :created
    else
      render json: { errors: @user.errors.full_messages },
             status: :unprocessable_entity
    end
  end
end

# Support's ask: "import 500 sellers from this CSV."
# There is no way to run jobs 1-3 without faking an
# HTTP request, and no way to test them without one.`,
		goal: 'Move the signup workflow into one dedicated, reusable home with an explicit success-or-failure return value, leaving the controller with only HTTP work: params in, status codes and the login session out.',
		thresholds: {},
	},
	successConditions: [{ type: 'service_created' }],
	availableNodes: ['service'],
	unlockedNodes: ['service'],
	learningContent: {
		title: 'Service Objects & the Result Pattern',
		goal: `In this level, you'll:\n- learn when a controller action has outgrown the controller (multiple jobs, multiple wished-for callers).\n- extract a multi-step workflow into a plain Ruby service class with one public entry point.\n- return an immutable Result the caller branches on, instead of booleans or exceptions.\n- decide what does NOT move: HTTP-context work like session creation stays in the controller.`,
		conceptExplanation: `A service object is a plain Ruby class that owns one multi-step business workflow. Nothing about it is framework magic: a class, a constructor, one public method.

**Why extract?**
- The controller shrinks to HTTP work: parse params, delegate, render by status.
- The workflow becomes callable from anywhere: controller, rake task, console, test. The CSV import that was impossible becomes a loop.
- The workflow becomes testable as plain Ruby: no router, no request, no controller in the test.

**The Result pattern:**
Returning true/false loses every detail; raising exceptions for expected failures makes callers write rescue-as-control-flow. Instead, return a small immutable value:

\`Result = Data.define(:success?, :user, :errors)\`

Ruby's Data.define (Ruby 3.2+) gives you an immutable value object with named fields, equality, and pattern matching in one line. Every caller branches the same way: \`result.success?\`, then \`result.user\` or \`result.errors\`.

**What moves, and what stays:**
- The workflow moves: create the user, send the welcome email, apply default preferences.
- Model validations do NOT move into the service: they stay on the model, and the service simply branches on \`user.save\`. A failure Result carries \`user.errors.full_messages\` through to the caller.
- The login session does NOT move: it needs request context (IP, user agent), and non-HTTP callers must not log anyone in. A CSV import that created 500 sessions would be a bug. HTTP concerns stay in the controller.

**The convention:** a tiny ApplicationService base gives every service a class-level entry point:

\`ApplicationService.call(...)\` delegates to \`new(...).call\`, so every call site reads as one line: \`result = UserRegistration.call(user_params)\`.

**When to extract (and when not to):** multi-step workflows with side effects, workflows needed from more than one entry point, or anything you want to test without HTTP. Do NOT wrap a single \`user.update!(...)\` in a service; trivial CRUD stays inline. Over-extraction is the mirror-image mistake of the fat controller.`,
		railsCodeExample: `# app/services/application_service.rb
class ApplicationService
  def self.call(...)
    new(...).call
  end
end

# app/services/user_registration.rb
class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(params)
    @params = params
  end

  def call
    user = User.new(@params)

    unless user.save
      return Result.new(
        success?: false, user: nil,
        errors: user.errors.full_messages,
      )
    end

    send_welcome_email(user)
    apply_default_preferences(user)

    Result.new(success?: true, user: user, errors: [])
  end

  private

  def send_welcome_email(user)
    Rails.logger.info "TODO welcome email to #{user.email_address}"
  end

  def apply_default_preferences(user)
    user.update!(
      locale: "en",
      timezone: "UTC",
      notification_preference: "email",
    )
  end
end

# app/controllers/users_controller.rb (thin: HTTP only)
class UsersController < ApplicationController
  allow_unauthenticated_access only: :create

  def create
    result = UserRegistration.call(user_params)

    if result.success?
      # HTTP-context work stays here: the session needs the
      # request, and rake imports must not log anyone in.
      session = result.user.sessions.create!(
        ip_address: request.remote_ip,
        user_agent: request.user_agent,
      )
      render json: {
        id: result.user.id,
        email_address: result.user.email_address,
        token: session.token,
      }, status: :created
    else
      render json: { errors: result.errors },
             status: :unprocessable_entity
    end
  end

  private

  def user_params
    params.expect(user: [ :email_address, :password ])
  end
end

# The workflow is now callable from anywhere:

# lib/tasks/seller_import.rake
CSV.foreach(path, headers: true) do |row|
  result = UserRegistration.call(
    email_address: row["email_address"],
    password: SecureRandom.base58(20),
  )
  report << [row["email_address"], result.errors] unless result.success?
end

# test/services/user_registration_test.rb
test "duplicate email returns a failure Result" do
  User.create!(email_address: "taken@example.com", password: "secret123")

  result = UserRegistration.call(
    email_address: "taken@example.com", password: "secret123",
  )

  refute result.success?
  assert_includes result.errors, "Email address has already been taken"
end`,
		commonMistakes: [
			'Dropping fields from the response during the refactor (the fat action returned the session token; the thin one must too, or every client breaks quietly)',
			'Re-validating params inside the service (model validations are the single source of truth; the service branches on user.save and passes the errors through)',
			'Moving session/token creation into the service (it needs request context, and non-HTTP callers like a CSV import must not log users in)',
			'Returning true/false instead of a Result (the caller learns nothing about what went wrong)',
			'Multiple public methods on one service (one workflow, one entry point: #call)',
			'Wrapping a single model save in a service (over-extraction; trivial CRUD stays inline)',
		],
		whenToUse:
			'Multi-step workflows with side effects, workflows needed from more than one entry point (controller, rake task, console, test), or any controller action that has accumulated jobs beyond parse-delegate-render.',
		furtherReading: [
			{
				title: 'Ruby Data.define (official docs)',
				url: 'https://docs.ruby-lang.org/en/master/Data.html',
			},
			{
				title: 'Result Pattern in Ruby (dry-monads, the heavyweight version)',
				url: 'https://dry-rb.org/gems/dry-monads/',
			},
		],
		homework: [
			{
				task: 'Create app/services/application_service.rb in your store_api app so every service gets a one-line entry point: a class-level call that delegates to new(...).call.',
				verify:
					'Any subclass can be invoked as ServiceName.call(...) without instantiating it first.',
			},
			{
				task: 'Extract a UserRegistration service from your UsersController#create: move the workflow (create the user, send the welcome email, apply default preferences) into the service and return Result = Data.define(:success?, :user, :errors). Keep session and token creation in the controller, it needs the request.',
				verify:
					'Signing up over HTTP still returns 201 with the token, and an invalid signup still returns 422 carrying the same model error messages as before.',
			},
			{
				task: 'Prove the workflow is reusable outside HTTP: call the service straight from the Rails console with a fresh email address, the way a CSV import rake task would.',
				commands: [
					'bin/rails console',
					'result = UserRegistration.call(email_address: "import@example.com", password: SecureRandom.base58(20))',
					'result.success?',
				],
				verify:
					'result.success? returns true, the user row exists in the database, and no session was created for it.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Count the jobs in the action, then ask which of them a CSV import would also need. Those move together into one plain Ruby class with a single public method; what needs the HTTP request stays behind. The caller should get back a value it can branch on.',
	},
};
