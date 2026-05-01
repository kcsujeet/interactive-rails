import type { Level } from '@/types';

export const level11Authorization: Level = {
	id: 'act2-level11-authorization',
	actId: 2,
	levelNumber: 11,
	name: 'Authorization',
	startingPipeline: { nodes: [], connections: [] },
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
	trigger: {
		type: 'security_incident',
		description:
			"Users can authenticate, data is validated, and emails are normalized. But User A can still edit User B's products. Authentication tells us WHO is making the request, but nothing checks whether they are ALLOWED to do what they are asking.",
	},
	problem: {
		observation:
			'User A logs in and sends DELETE /api/v1/products/42 -- a product owned by User B. It succeeds. Any authenticated user can modify or destroy any product.',
		rootCause:
			'Authentication verifies identity but there is no authorization layer checking ownership or permissions.',
		codeExample: `# Current state: no authorization
class Api::V1::ProductsController < ApplicationController
  def destroy
    product = Product.find(params[:id])
    product.destroy  # Any user can delete ANY product!
    head :no_content
  end
end

# Authentication: "Who are you?" (Bearer token)
# Authorization:  "Can you do this?" (???)
#
# Rails ships authentication (Level 9) but NOT authorization.
# The community standard is Pundit (gem "pundit").
# Pundit gives each model a policy class (ProductPolicy),
# where each method maps to a controller action:
#   destroy? -> "Can this user delete this product?"
#   update?  -> "Can this user edit this product?"`,
		goal: 'Add policy-based authorization so each controller action checks whether the current user is allowed to perform it, then watch it filter requests in real-time.',
		thresholds: {},
	},
	learningContent: {
		title: 'Authorization with Pundit & Current.user',
		goal: `In this level, you'll:\n- learn the difference between authentication ("who are you?") and authorization ("are you allowed to do this?").\n- implement policy classes that control which users can update or delete specific records.\n- scope queries so users only see data they have permission to access.`,
		conceptExplanation: `Authorization answers "Can this user do this action on this resource?"

**Pundit** provides a clean, policy-based pattern:
- One policy class per model, named by convention: \`Product\` -> \`ProductPolicy\`, \`Review\` -> \`ReviewPolicy\`
- When you call \`authorize product\`, Pundit infers \`ProductPolicy\` from the record's class and calls the method matching the current action (e.g. \`destroy?\`)
- Each method corresponds to a controller action (\`update?\`, \`destroy?\`)
- Policies are plain Ruby objects, easy to test
- Scopes filter collections based on user permissions

**Current.user (Rails built-in):**
- Thread-safe, request-scoped attributes
- Set in a \`before_action\`, available everywhere in the request
- Replaces passing \`current_user\` through method arguments

**Authentication vs Authorization:**
- Authentication: "Who are you?" (Level 9)
- Authorization: "Are you allowed to do this?" (This level)`,
		railsCodeExample: `# app/policies/product_policy.rb
class ProductPolicy < ApplicationPolicy
  def show?
    true  # Anyone can view active products
  end

  def create?
    user.present?  # Any authenticated user can create
  end

  def update?
    owner_or_admin?
  end

  def destroy?
    owner_or_admin?
  end

  private

  def owner_or_admin?
    record.user == user || user.admin?
  end

  class Scope < ApplicationPolicy::Scope
    def resolve
      if user.admin?
        scope.all
      else
        scope.where(status: "active")
      end
    end
  end
end

# app/models/current.rb (Rails built-in)
class Current < ActiveSupport::CurrentAttributes
  attribute :user, :session
end

# Set Current.user in authentication concern
module ApiAuthentication
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_user
  end

  private

  def authenticate_user
    authenticate_or_request_with_http_token do |token, _options|
      session = Session.find_by(token: token)
      Current.user = session&.user
    end
  end
end

# app/controllers/api/v1/products_controller.rb
class Api::V1::ProductsController < ApplicationController
  include Pundit::Authorization

  def index
    products = policy_scope(Product)
    render json: ProductSerializer.new(products).serializable_hash.to_json
  end

  def update
    product = Product.find(params[:id])
    authorize product  # Raises Pundit::NotAuthorizedError if denied
    if product.update(product_params)
      render json: ProductSerializer.new(product).serializable_hash.to_json
    else
      render json: { errors: product.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    product = Product.find(params[:id])
    authorize product
    product.destroy
    head :no_content
  end
end

# Handle authorization failures globally
class ApplicationController < ActionController::API
  include Pundit::Authorization

  rescue_from Pundit::NotAuthorizedError do |e|
    render json: { error: "Not authorized" }, status: :forbidden
  end
end`,
		commonMistakes: [
			'Forgetting to call authorize in controller actions (use after_action :verify_authorized)',
			'Checking permissions in the controller instead of the policy',
			'Not scoping index queries with policy_scope (leaking private data)',
			'Confusing authentication (who) with authorization (can)',
			'Not testing policy edge cases (admin vs owner vs stranger)',
		],
		whenToUse:
			'Every action that modifies data or returns user-specific content needs authorization. Add Pundit policies from the start.',
		furtherReading: [
			{
				title: 'Pundit',
				url: 'https://github.com/varvet/pundit',
			},
			{
				title: 'CurrentAttributes',
				url: 'https://api.rubyonrails.org/classes/ActiveSupport/CurrentAttributes.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'The convention is one policy class per model, with predicate methods that mirror controller actions one-to-one. Discovering the naming convention is half the work; the other half is choosing where to call the check from inside the controller action.',
	},
};
