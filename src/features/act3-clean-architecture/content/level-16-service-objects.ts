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
			'The RegistrationsController#create action is 80 lines long. It creates a user, logs a welcome message, and subscribes to the newsletter. Too much logic in one controller action.',
	},
	startingPipeline: standardPipeline(),
	problem: {
		observation:
			'The create action handles user creation, welcome logging, and newsletter subscription all inline. It is 80 lines, untestable, and breaks when any step fails.',
		rootCause:
			'Business logic is embedded in the controller instead of being extracted into a dedicated service object.',
		codeExample: `# app/controllers/api/v1/registrations_controller.rb
class Api::V1::RegistrationsController < ApplicationController
  def create
    @user = User.new(user_params)

    # Inline validation checks
    if params[:email].blank?
      return render json: { error: "Email required" }, status: 422
    end
    if params[:password].length < 8
      return render json: { error: "Too short" }, status: 422
    end
    if params[:display_name].blank?
      return render json: { error: "Name required" }, status: 422
    end

    if @user.save
      # Log welcome message inline
      Rails.logger.info("User #{@user.id} registered")

      # Set default preferences inline
      DefaultPreferences.apply!(@user)

      # Generate session token inline
      token = @user.generate_token_for(:session)

      render json: @user, status: :created
    else
      render json: { errors: @user.errors }, status: :unprocessable_entity
    end
  rescue StandardError => e
    @user&.destroy  # Orphaned records!
    render json: { error: e.message }, status: :internal_server_error
  end
end

# Problems:
# 1. Controller does too many things (SRP violation)
# 2. Side effects block the response
# 3. Failure in any step leaves orphaned records
# 4. Impossible to test steps independently`,
		goal: 'Extract the registration workflow into a PORO service object with a Result pattern.',
		thresholds: {},
	},
	successConditions: [{ type: 'service_created' }],
	availableNodes: ['service'],
	unlockedNodes: ['service'],
	learningContent: {
		title: 'Service Objects & the Result Pattern',
		goal: `In this level, you'll:\n- learn how to extract bloated controller logic into service objects (plain Ruby classes with a single responsibility).\n- use the Result pattern to handle success and failure explicitly.\n- keep your controllers thin and your business logic testable in isolation.`,
		conceptExplanation: `Service objects (Plain Old Ruby Objects) encapsulate multi-step business logic outside of controllers and models.

**Why use service objects?**
- Controllers stay thin (just HTTP concerns)
- Business logic is testable in isolation
- Steps can be composed and reused
- Error handling becomes explicit with the Result pattern

**The Result pattern:**
Instead of raising exceptions or returning booleans, return a Result object with \`.success?\`, \`.failure?\`, \`.value\`, and \`.error\`. This makes the caller's logic clean and explicit.

**When to extract:**
- Controller action exceeds ~15 lines of business logic
- Multiple models are created/updated in one action
- External API calls are involved
- The same workflow is needed from multiple entry points

**Ruby's Data.define (Ruby 3.2+):**
Data classes are immutable value objects -- perfect for Results. They give you \`.new\`, \`==\`, pattern matching, and immutability for free.`,
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
    # Inline validation checks (carried from controller)
    if @params[:email].blank?
      return Result.new(success?: false, user: nil, errors: ["Email required"])
    end
    if @params[:password].length < 8
      return Result.new(success?: false, user: nil, errors: ["Password too short"])
    end

    user = User.new(@params)

    unless user.save
      return Result.new(success?: false, user: nil, errors: user.errors.full_messages)
    end

    # Side effects (isolated, testable)
    Rails.logger.info("User #{user.id} registered")
    user.update!(locale: "en", timezone: "UTC",
                 notification_preference: "email")
    token = user.generate_token_for(:session)

    Result.new(success?: true, user: user, errors: [])
  end
end

# app/controllers/api/v1/registrations_controller.rb
class Api::V1::RegistrationsController < ApplicationController
  def create
    result = UserRegistration.call(registration_params)

    if result.success?
      render json: UserSerializer.new(result.user).serializable_hash.to_json, status: :created
    else
      render json: { errors: result.errors }, status: :unprocessable_entity
    end
  end

  private

  def registration_params
    params.expect(user: [:email, :password, :name])
  end
end

# Test the service in isolation:
# test/services/user_registration_test.rb
class UserRegistrationTest < ActiveSupport::TestCase
  test "successful registration creates user and logs welcome" do
    result = UserRegistration.call(
      email: "new@example.com",
      password: "secure123",
      name: "Alice"
    )

    assert result.success?
    assert_equal "new@example.com", result.user.email
  end

  test "duplicate email returns failure result" do
    User.create!(email: "taken@example.com", password: "x", name: "X")
    result = UserRegistration.call(
      email: "taken@example.com",
      password: "secure123",
      name: "Alice"
    )

    refute result.success?
    assert_includes result.errors, "Email has already been taken"
  end
end`,
		commonMistakes: [
			'Multiple public methods (keep it to one: .call)',
			'Passing ActiveRecord objects instead of primitives (harder to test, serialize, and parallelize)',
			'Not using a Result object (returning true/false loses context about what went wrong)',
			'Putting service logic back in callbacks (hides control flow)',
			'Making services that are just thin wrappers around a single model save (over-extraction)',
		],
		whenToUse:
			'Multi-step workflows, external API integrations, any controller action over 15 lines of business logic, or logic reused from multiple entry points (controller, job, rake task).',
		furtherReading: [
			{
				title: 'Service Objects in Rails',
				url: 'https://www.toptal.com/ruby-on-rails/rails-service-objects-tutorial',
			},
			{
				title: 'Result Pattern in Ruby (dry-monads)',
				url: 'https://dry-rb.org/gems/dry-monads/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Service node and connect the Controller to it. The service handles the multi-step registration workflow so the controller stays thin.',
	},
};
