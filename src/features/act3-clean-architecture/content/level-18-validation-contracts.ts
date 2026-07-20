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
			'The registration service creates a User from a rich signup payload (credentials, profile fields, notification preferences). Validations are scattered inline with early returns, and cross-field rules like "creator accounts must enable the weekly digest" are buried between the field checks.',
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
				y: 250,
				locked: true,
				config: { label: 'User' },
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
			{ id: 'c4', sourceNodeId: 'user-model', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'The registration service (from L16) validates a rich signup payload (credentials, profile fields, notification preferences) with scattered inline checks. Cross-field rules like "creator role requires the weekly digest" are buried between the field checks. Only one error is returned per request.',
		rootCause:
			'No validation contract to encapsulate the whole payload. Scattered inline checks inside the service instead of reusable schemas with cross-field rules.',
		codeExample: `# app/services/user_registration.rb
# (Service exists from L16, but validations are scattered inline!)
class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def call
    # Credential validations -- scattered inside the service!
    if @params[:email_address].blank?
      return Result.new(success?: false, user: nil, errors: ["Email required"])
    end
    if @params[:password].length < 8
      return Result.new(success?: false, user: nil, errors: ["Too short"])
    end

    # Profile validations -- more scattered checks!
    if @params[:display_name].blank?
      return Result.new(success?: false, user: nil, errors: ["Name required"])
    end

    # Notification prefs -- one error per check, not composable
    unless %w[daily weekly monthly never].include?(@params[:email_digest])
      return Result.new(success?: false, user: nil, errors: ["Bad digest"])
    end

    # Cross-field rule -- buried between the field checks!
    if @params[:role] == "creator" && @params[:email_digest] != "weekly"
      return Result.new(success?: false, user: nil, errors: ["Creators need weekly"])
    end

    user = User.create!(@params)
    Result.new(success?: true, user: user, errors: [])
  end
end

# Problems:
# 1. One error per request (early returns)
# 2. Can't reuse validations in another endpoint
# 3. Cross-field rules buried between the field checks
# 4. Can't test validations without running the whole service`,
		goal: 'Extract scattered validations into reusable schemas with cross-field rules that can be tested independently.',
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
1. Define reusable \`Dry::Schema.Params\` in \`app/schemas/\` (one per concern)
2. Create a \`Dry::Validation::Contract\` in \`app/contracts/\` that reuses those schemas by passing them to \`params\`
3. \`rule\` blocks define cross-field business logic (runs after all schemas pass)
4. The service calls the contract, then persists the validated data

**Key concepts:**
- \`Dry::Schema.Params { required(:email_address).filled(:string) }\`: reusable schema (shape + types)
- \`params(CredentialsSchema, ProfileSchema)\`: reuse several predefined schemas in one contract by passing them as arguments
- \`rule(:role, :email_digest) { ... }\`: business rules that span multiple fields
- \`key.failure("message")\`: attach errors to specific fields
- \`contract.call(params)\` returns a result (success or failure with errors)

**Contract vs model validation: pick a layer (do not duplicate).**
The contract validates the *request*: is the payload the right shape, are the types right, do the cross-field business rules hold at the boundary? The model keeps the *data-integrity* rules that must hold no matter who writes the row (uniqueness, presence, referential rules), enforced the same way for a signup, an admin edit, or a console session. When a check could live in both, put it where it is cheapest to enforce and hardest to bypass: shape and type checks in the schema (so malformed requests never reach the model), data-integrity guarantees on the model (so no code path can write an invalid row). This is the same "one place for each rule" guidance as L20's Result-vs-rescue_from paragraph: decide the layer, document it, and do not re-implement the same check in both. In this level the contract owns request shape plus the cross-field creator/digest rule; the model still owns email uniqueness and presence.`,
		railsCodeExample: `# Gemfile
gem "dry-validation"  # dry-schema comes along as a dependency

# app/schemas/credentials_schema.rb
# Shape + type checks for the request. Email uniqueness stays on
# the model (data integrity), not here.
CredentialsSchema = Dry::Schema.Params do
  required(:email_address).filled(:string, format?: URI::MailTo::EMAIL_REGEXP)
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
  # Reuse predefined schemas by passing them to params (comma-separated).
  # dry-validation merges them; there is no & operator here.
  params(CredentialsSchema, ProfileSchema, NotifPrefsSchema)

  # Rules: cross-field business logic (runs after all schemas pass)
  rule(:role, :email_digest) do
    if values[:role] == "creator" && values[:email_digest] != "weekly"
      key(:role).failure("creators need weekly digest")
    end
  end
end

# app/services/user_registration.rb (updated from L16)
# Now delegates request validation to the contract instead of inline checks.
# UserRegistration defines its own initialize; ApplicationService (from L16)
# only provides self.call, so there is no super initializer to call.
class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(params)
    @params = params
  end

  def call
    validation = RegistrationContract.new.call(@params)
    unless validation.success?
      return Result.new(success?: false, user: nil,
                        errors: validation.errors.to_h)
    end

    # The model still owns data-integrity rules (email uniqueness,
    # presence). create! raises if the model rejects the row.
    user = User.create!(validation.to_h)
    Result.new(success?: true, user: user, errors: [])
  end
end

# Controller stays thin (unchanged from L16):
# app/controllers/users_controller.rb
class UsersController < ApplicationController
  allow_unauthenticated_access only: :create

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
    params.expect(user: [
      :email_address, :password, :role,
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
      email_address: "alice@example.com", password: "secure1234",
      role: "member",
      display_name: "Alice", email_digest: "weekly"
    )

    assert result.success?
  end

  test "creator without weekly digest fails" do
    result = @contract.call(
      email_address: "bob@example.com", password: "secure1234",
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
    assert result.errors[:email_address].any?
  end
end`,
		commonMistakes: [
			'Re-implementing model data-integrity rules (uniqueness, presence) in the contract instead of letting the model own them (the contract validates request shape; the model guards the row)',
			'Inlining all validations in the contract params block instead of reusing schemas from app/schemas/',
			'Mixing schema checks and business rules in the same layer (dry-validation separates them)',
			'Not checking validation.failure? before using the validated data',
			'Putting a cross-field business rule in a model callback instead of a contract rule',
		],
		whenToUse:
			'Any endpoint with a rich request payload, or where cross-field validations are needed that describe the request rather than the integrity of a single row.',
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
		homework: [
			{
				task: 'Add dry-validation to your store_api app through the bundle CLI.',
				commands: ['bundle add dry-validation'],
				verify:
					'The Gemfile lists dry-validation and the bundle resolves without conflicts.',
			},
			{
				task: 'Create a reusable CredentialsSchema in app/schemas (email_address format and password minimum length) and a RegistrationContract in app/contracts that reuses the schema via params and adds one cross-field rule block. Exercise it from the console.',
				commands: ['bin/rails console'],
				verify:
					'RegistrationContract.new.call(email_address: "", password: "short") returns a failure whose errors include entries for BOTH fields at once, not just the first one.',
			},
			{
				task: 'Replace the scattered early-return checks in your UserRegistration service with a single contract.call at the top, so every validation failure comes back in one response.',
				verify:
					'A signup request with several bad fields returns 422 listing all the errors together instead of one error per round trip.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Validation Contract between the Controller and the model. The contract validates the whole request payload at once, then the service persists the validated data.',
	},
};
