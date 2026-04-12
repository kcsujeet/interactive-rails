import type { Level } from '@/types';

export const level18ValidationContracts: Level = {
	id: 'act3-level18-validation-contracts',
	actId: 3,
	levelNumber: 18,
	name: 'Validation Contracts',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'The registration service creates a User, Profile, and NotificationPrefs in one call. Validations are scattered inline with early returns, and cross-field rules like "creator accounts must enable weekly digest" are buried between model checks.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 460,
				y: 250,
				locked: true,
				config: { label: 'RegistrationController' },
			},
			{
				id: 'user-model',
				type: 'model',
				x: 680,
				y: 120,
				locked: true,
				config: { label: 'User' },
			},
			{
				id: 'profile-model',
				type: 'model',
				x: 680,
				y: 250,
				locked: true,
				config: { label: 'Profile' },
			},
			{
				id: 'notif-pref-model',
				type: 'model',
				x: 680,
				y: 380,
				locked: true,
				config: { label: 'NotificationPref' },
			},
			{ id: 'database-node', type: 'database', x: 880, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{
				id: 'c2',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'user-model' },
			{
				id: 'c4',
				sourceNodeId: 'controller-node',
				targetNodeId: 'profile-model',
			},
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'notif-pref-model',
			},
			{ id: 'c6', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
			{
				id: 'c7',
				sourceNodeId: 'profile-model',
				targetNodeId: 'database-node',
			},
			{
				id: 'c8',
				sourceNodeId: 'notif-pref-model',
				targetNodeId: 'database-node',
			},
		],
	},
	problem: {
		observation:
			'The registration service (from L16) validates User, Profile, and NotificationPrefs with scattered inline checks. Cross-field rules like "creator role requires weekly digest" are buried between model checks. Only one error is returned per request.',
		rootCause:
			'No validation contract to encapsulate multi-model validation. Scattered inline checks inside the service instead of composable schemas with cross-field rules.',
		codeExample: `# app/services/user_registration.rb
# (Service exists from L16, but validations are scattered inline!)
class UserRegistration < ApplicationService
  def call
    # User validations -- scattered inside the service!
    if @params[:email].blank?
      return Result.new(success?: false, errors: ["Email required"])
    end
    if @params[:password].length < 8
      return Result.new(success?: false, errors: ["Too short"])
    end

    # Profile validations -- more scattered checks!
    if @params[:display_name].blank?
      return Result.new(success?: false, errors: ["Name required"])
    end

    # Notification prefs -- one error per check, not composable
    unless %w[daily weekly monthly never].include?(@params[:digest])
      return Result.new(success?: false, errors: ["Bad digest"])
    end

    # Cross-field rule -- buried between model checks!
    if @params[:role] == "creator" && @params[:digest] != "weekly"
      return Result.new(success?: false, errors: ["Creators need weekly"])
    end

    user = User.create!(email: @params[:email], password: @params[:password])
    Profile.create!(user: user, display_name: @params[:display_name])
    NotificationPref.create!(user: user, email_digest: @params[:digest])

    Result.new(success?: true, user: user, errors: [])
  end
end

# Problems:
# 1. One error per request (early returns)
# 2. Can't reuse validations in another endpoint
# 3. Cross-field rules buried between model checks
# 4. Can't test validations without running the whole service`,
		goal: 'Extract scattered validations into composable schemas with cross-field rules that can be tested independently.',
		thresholds: {},
	},
	successConditions: [{ type: 'form_object_created' }],
	availableNodes: ['form_object'],
	unlockedNodes: ['form_object'],
	learningContent: {
		title: 'Validation Contracts with Dry::Validation',
		goal: `In this level, you'll:\n- learn how to validate complex, multi-model input using validation contracts.\n- separate schema validation (shape and types) from business rules.\n- compose reusable schemas together.\n- keep cross-field logic in one clean place instead of scattered across controllers.`,
		conceptExplanation: `Validation contracts act as a single entry point for multi-model operations. Using \`dry-validation\` and \`dry-schema\`, you get a clean separation between **schema** (shape & types) and **rules** (business logic).

**Why dry-validation over ActiveModel::Model?**
- **Two-layer validation:** Schema checks structure/types first, rules check business logic second
- **Composable:** Contracts can reuse shared schemas and rule sets
- **Immutable:** No mutation, no state, easier to reason about
- **Better errors:** Structured error objects with paths, not just flat strings
- **No Rails coupling:** Works in service objects, CLI tools, anywhere

**Structure:**
1. Define reusable \`Dry::Schema.Params\` in \`app/schemas/\` (one per model or concern)
2. Create a \`Dry::Validation::Contract\` in \`app/contracts/\` that composes schemas with \`&\`
3. \`rule\` blocks define cross-field business logic (runs after all schemas pass)
4. A separate service wraps persistence in a transaction

**Key concepts:**
- \`Dry::Schema.Params { required(:email).filled(:string) }\`: reusable schema (shape + types)
- \`params(UserSchema & ProfileSchema)\`: compose schemas in a contract
- \`rule(:role, :email_digest) { ... }\`: business rules that span multiple fields
- \`key.failure("message")\`: attach errors to specific fields
- \`contract.call(params)\` returns a \`Result\` (success or failure with errors)`,
		railsCodeExample: `# Gemfile
gem "dry-validation"
gem "dry-schema"

# app/schemas/user_schema.rb
UserSchema = Dry::Schema.Params do
  required(:email).filled(:string, format?: URI::MailTo::EMAIL_REGEXP)
  required(:password).filled(:string, min_size?: 8)
  optional(:role).filled(:string)
end

# app/schemas/profile_schema.rb
ProfileSchema = Dry::Schema.Params do
  required(:display_name).filled(:string)
  optional(:bio).filled(:string, max_size?: 500)
  optional(:location).filled(:string)
end

# app/schemas/notif_prefs_schema.rb
NotifPrefsSchema = Dry::Schema.Params do
  required(:email_digest).filled(:string,
    included_in?: %w[daily weekly monthly never])
  optional(:push_enabled).filled(:bool)
  optional(:mentions_only).filled(:bool)
end

# app/contracts/registration_contract.rb
class RegistrationContract < Dry::Validation::Contract
  # Compose reusable schemas - each can be shared across contracts
  params(UserSchema & ProfileSchema & NotifPrefsSchema)

  # Rules: cross-field business logic (runs after all schemas pass)
  rule(:role, :email_digest) do
    if values[:role] == "creator" && values[:email_digest] != "weekly"
      key(:role).failure("creators need weekly digest")
    end
  end
end

# app/services/user_registration.rb (updated from L16)
# Now delegates validation to the contract instead of inline checks
class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(params, contract: RegistrationContract.new)
    super(params)
    @contract = contract
  end

  def call
    validation = @contract.call(@params)
    unless validation.success?
      return Result.new(success?: false, user: nil,
                        errors: validation.errors.to_h)
    end

    attrs = validation.to_h

    ActiveRecord::Base.transaction do
      user = User.create!(
        email: attrs[:email],
        password: attrs[:password],
        role: attrs[:role]
      )
      Profile.create!(
        user: user,
        display_name: attrs[:display_name],
        bio: attrs[:bio]
      )
      NotificationPref.create!(
        user: user,
        email_digest: attrs[:email_digest],
        push_enabled: attrs[:push_enabled]
      )

      Result.new(success?: true, user: user, errors: [])
    end
  end
end

# Controller stays thin (unchanged from L16):
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
    params.expect(registration: [
      :email, :password, :role,
      :display_name, :bio,
      :email_digest, :push_enabled
    ])
  end
end

# test/contracts/registration_contract_test.rb
class RegistrationContractTest < ActiveSupport::TestCase
  setup { @contract = RegistrationContract.new }

  test "valid params pass" do
    result = @contract.call(
      email: "alice@example.com", password: "secure1234",
      role: "member",
      display_name: "Alice", email_digest: "weekly"
    )

    assert result.success?
  end

  test "creator without weekly digest fails" do
    result = @contract.call(
      email: "bob@example.com", password: "secure1234",
      role: "creator",
      display_name: "Bob", email_digest: "monthly"
    )

    assert result.failure?
    assert result.errors[:role].any?
  end

  test "missing email fails schema check" do
    result = @contract.call(
      password: "secure1234",
      role: "member", display_name: "Alice",
      email_digest: "weekly"
    )

    assert result.failure?
    assert result.errors[:email].any?
  end
end`,
		commonMistakes: [
			'Forgetting to wrap persistence in a transaction (partial failures leave orphaned records)',
			'Inlining all validations in the contract params block instead of extracting reusable schemas to app/schemas/',
			'Mixing schema checks and business rules in the same layer (dry-validation separates them)',
			'Not checking result.failure? before using the validated data',
			'Putting cross-model validations in a model callback instead of a contract rule',
		],
		whenToUse:
			'Any endpoint that creates or updates multiple models, or where cross-field validations are needed that do not belong on any single model.',
		furtherReading: [
			{
				title: 'dry-validation',
				url: 'https://dry-rb.org/gems/dry-validation/',
			},
			{
				title: 'dry-schema',
				url: 'https://dry-rb.org/gems/dry-schema/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Validation Contract node between the Controller and the models. The contract validates all inputs, then a service persists them in a single transaction.',
	},
};
