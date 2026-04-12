import type { Level } from '@/types';

export const level14StrongParams: Level = {
	id: 'act2-level14-strong-params',
	actId: 2,
	levelNumber: 14,
	name: 'Strong Params',
	trigger: {
		type: 'security_audit',
		description:
			'Your controller passes raw request params directly to the model. A malicious user sends admin: true in the request body and escalates privileges. You need parameter filtering.',
	},
	problem: {
		observation:
			'POST /api/v1/products accepts ANY field in the request body. A user can set user_id to impersonate another seller or set admin: true to escalate privileges. There is no parameter filtering.',
		rootCause:
			'The controller reads params directly (params[:name], params[:user_id]) and passes them to the model. Every key the attacker includes in the request body gets saved to the database.',
		codeExample: `# Current state: NO parameter filtering
class Api::V1::ProductsController < ApplicationController
  def create
    product = Product.create!(
      name: params[:name],
      description: params[:description],
      price: params[:price],
      user_id: params[:user_id],  # Attacker-controlled!
      admin: params[:admin]        # Attacker-controlled!
    )
    render json: product, status: :created
  end
end

# What gets through:
# POST /api/v1/products
# { "name": "Laptop", "user_id": 42, "admin": true }
# => user_id set to 42, admin flag set to true!
#
# Rails 8 provides params.expect() to filter parameters.
# It declares which keys are allowed through a whitelist.`,
		goal: 'Filter incoming parameters through a strict whitelist of allowed fields and set product ownership through the current_user association.',
		thresholds: {},
	},
	learningContent: {
		title: 'Rails 8 Strong Params with params.expect',
		goal: `In this level, you'll:\n- learn how mass assignment attacks work when controllers pass raw params to models.\n- use Rails 8's strong parameters to filter incoming request data.\n- define a safe whitelist that only includes fields users should set.\n- set ownership through the current_user association instead of user-submitted params.`,
		conceptExplanation: `Strong Parameters prevent mass assignment attacks by whitelisting which request params are allowed to reach the model.

**The problem (mass assignment):**
- Without filtering, the controller passes raw params directly to the model
- An attacker can include ANY key in the request body: user_id, admin, role, balance
- Every param gets saved to the database, letting attackers control fields they should not

**Rails 8 \`params.expect()\`:**
- Declares which keys are allowed through a whitelist
- Returns only the permitted params, silently dropping everything else
- Raises an error if the required root key is missing (e.g., \`product:\`)
- Replaces the older \`params.require(:product).permit(:name, :description, :price)\` pattern

**Building a safe whitelist:**
- Only include fields the user is meant to edit (name, description, price)
- Never include ownership fields (user_id), role fields (admin), or internal state
- Use \`current_user.products.create!\` to set ownership, not user-submitted params

**Nested params and arrays:**
- \`params.expect(product: [:name, :description, :price, { tags: [] }])\` allows arrays
- \`params.expect(product: [:name, { variants_attributes: [:size, :color] }])\` allows nested
- Each nesting level needs its own whitelist audit`,
		railsCodeExample: `# BEFORE: no filtering (vulnerable)
class Api::V1::ProductsController < ApplicationController
  def create
    product = Product.create!(
      name: params[:name],
      description: params[:description],
      price: params[:price],
      user_id: params[:user_id]  # attacker sets this!
    )
    render json: product, status: :created
  end
end

# AFTER: params.expect + current_user (secure)
class Api::V1::ProductsController < ApplicationController
  def create
    product = current_user.products.create!(product_params)
    render json: product, status: :created
  end

  def update
    product = current_user.products.find(params[:id])
    product.update!(product_params)
    render json: product
  end

  private

  # Rails 8: params.expect
  def product_params
    params.expect(product: [:name, :description, :price])
  end
  # Missing :product key -> 400 Bad Request (automatic)
  # Extra params like user_id, admin -> silently ignored
end

# Compared to the older pattern:
# def product_params
#   params.require(:product).permit(:name, :description, :price)
# end
# ^ Raises 500 on missing params unless you add rescue_from`,
		commonMistakes: [
			'Whitelisting user_id, admin, or role in permitted params (mass assignment)',
			'Using params.permit! which allows everything through',
			'Forgetting to audit nested params for sensitive fields',
			'Setting ownership via params instead of current_user association',
		],
		whenToUse:
			'Every controller action that accepts user input needs strong params. Use params.expect in Rails 8 for stricter, cleaner parameter filtering.',
		furtherReading: [
			{
				title: 'Rails 8 Release Notes (params.expect)',
				url: 'https://guides.rubyonrails.org/8_0_release_notes.html',
			},
			{
				title: 'Action Controller Parameters',
				url: 'https://api.rubyonrails.org/classes/ActionController/Parameters.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Check which fields are in your params.expect whitelist. Remove any field the user should not be able to set directly.',
	},
};
