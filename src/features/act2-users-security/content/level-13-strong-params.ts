import type { Level } from '@/types';

export const level13StrongParams: Level = {
	id: 'act2-level13-strong-params',
	actId: 2,
	levelNumber: 13,
	name: 'Strong Params',
	startingPipeline: { nodes: [], connections: [] },
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
	trigger: {
		type: 'security_audit',
		description:
			'Marketing has speccd a "featured products" homepage section, curated by admins via a new featured boolean column on Product. Before that ships, a pre-launch security review flags the existing controller: it has been calling params[:product].to_unsafe_h since L7, which mass-assigns every field a request includes. Any logged-in user could self-promote their product to featured (or transfer it to a victim) with a single API call.',
	},
	problem: {
		observation:
			'create and update both call params[:product].to_unsafe_h. Per Rails docs, that returns "an unsafe, unfiltered representation" of the parameters: every key the client sends reaches the model. The featured column was meant to be admin-only, but to_unsafe_h has no concept of "admin-only", it lets any field through.',
		rootCause:
			'There is no parameter filter on the controller. The naive shortcut from L7 (to_unsafe_h) bypasses Rails strong-params machinery entirely. Every column on Product is mass-assignable from request params, including admin-only fields (featured) and server-managed associations (user_id).',
		codeExample: `# Current state: to_unsafe_h bypasses every check
class Api::ProductsController < ApplicationController
  def create
    product = Current.user.products.new(params[:product].to_unsafe_h)
    authorize product
    if product.save
      render json: product, status: :created
    else
      render json: { errors: product.errors.full_messages },
             status: :unprocessable_entity
    end
  end

  def update
    product = Product.find(params[:id])
    authorize product
    if product.update(params[:product].to_unsafe_h)
      render json: product
    else
      render json: { errors: product.errors.full_messages },
             status: :unprocessable_entity
    end
  end
end

# Risks of this layout:
# - to_unsafe_h drops every safety check on ActionController::Parameters.
# - featured: true on POST -> product saved as featured (self-promotion).
# - featured: true on PATCH -> existing product flipped to featured.
# - user_id: 99 on PATCH -> ownership transferred to victim (frame attack).
# - Any future column on Product is automatically mass-assignable.
#
# Rails ships a shape-aware filter for this exact problem: a declared
# whitelist that declares which keys reach the model.`,
		goal: 'Replace the unsafe shortcut with a real whitelist that lists only the fields users are meant to set, so admin-only and server-managed columns cannot be set from request params.',
		thresholds: {},
	},
	learningContent: {
		title: 'Rails 8 Strong Params with params.expect',
		goal: `In this level, you will:\n- learn why mass assignment is the canonical security vulnerability strong params exists to fix.\n- replace params[:product].to_unsafe_h (the naive shortcut) with a proper whitelist.\n- centralize the whitelist into a single private method on the controller.\n- understand why admin-only columns must never appear in the whitelist.`,
		conceptExplanation: `Strong Parameters are a security feature. They prevent **mass assignment**: an attacker including extra fields in a request body and having those fields reach the model unfiltered.

**The mass assignment vulnerability:**
- A controller that hands raw params to a model lets the client set any column.
- Admin-only columns (featured, role, is_admin) become user-controllable.
- Server-managed columns (user_id, id) become spoofable.
- The vulnerability is general: ANY column on the model is mass-assignable through the request body.

**How Rails 8 protects you:**
- ActionController::Parameters wraps every request body.
- Calling .to_h, .new(params[:thing]), or update(params[:thing]) directly raises ActiveModel::ForbiddenAttributesError, Rails forces you to declare what is allowed.
- to_unsafe_h is the explicit escape hatch: it bypasses the protection and returns the raw hash. Per docs, "an unsafe, unfiltered representation of the parameters."
- a declared filter decides which keys reach the model and drops everything else.

**Rails 8 \`params.expect()\`:**
- Declares the allowed shape: \`params.expect(product: [:name, :description, :price])\`.
- Returns only the permitted keys; extra keys like featured or user_id are silently dropped.
- Raises \`ActionController::ParameterMissing\` if the required root key is missing OR has the wrong shape (e.g., a String where a Hash was expected).
- Preferred over the older \`params.require(:product).permit(:name, ...)\` pattern in Rails 8: expect checks the shape, require/permit checks only the keys.

**Building a safe whitelist:**
- Include only fields the user is meant to edit (name, description, price).
- Never include admin-only columns (featured, is_admin, role).
- Never include server-managed fields (id, created_at, updated_at).
- Never include foreign keys to other resources (user_id), set those through associations like Current.user.products.create.

**The audit habit:**
For every controller, ask: "What columns exist on this model? Which should an external client be allowed to set directly?" The answer is the whitelist; everything else is excluded.`,
		railsCodeExample: `# BEFORE: to_unsafe_h bypasses strong-params filtering entirely
class Api::ProductsController < ApplicationController
  def create
    product = Current.user.products.new(params[:product].to_unsafe_h)
    authorize product
    if product.save
      render json: product, status: :created
    else
      render json: { errors: product.errors.full_messages },
             status: :unprocessable_entity
    end
  end

  def update
    product = Product.find(params[:id])
    authorize product
    if product.update(params[:product].to_unsafe_h)
      render json: product
    else
      render json: { errors: product.errors.full_messages },
             status: :unprocessable_entity
    end
  end
end

# Attack:
# POST /api/products body: { product: { name: "x", price: 1, featured: true, user_id: 99 } }
# -> product saved as featured: true, user_id: 99. Frame attack succeeds.

# AFTER: centralized whitelist via params.expect
class Api::ProductsController < ApplicationController
  def create
    product = Current.user.products.new(product_params)
    authorize product
    if product.save
      render json: product, status: :created
    else
      render json: { errors: product.errors.full_messages },
             status: :unprocessable_entity
    end
  end

  def update
    product = Product.find(params[:id])
    authorize product
    if product.update(product_params)
      render json: product
    else
      render json: { errors: product.errors.full_messages },
             status: :unprocessable_entity
    end
  end

  private

  def product_params
    params.expect(product: [:name, :description, :price])
  end
  # featured, user_id, id, role, etc. are silently dropped.
  # Wrong shape (e.g., product=hacked) -> ParameterMissing -> 400.
end`,
		commonMistakes: [
			'Calling to_unsafe_h or permit! to "make the error go away", both bypass the protection entirely.',
			'Whitelisting admin-only columns (featured, is_admin, role) so they "just work", that recreates the vulnerability.',
			'Whitelisting user_id or other foreign keys, set ownership via associations, not request params.',
			'Forgetting to audit nested params (arrays, hashes) for sensitive fields each time the schema grows.',
		],
		whenToUse:
			'Every controller action that accepts user input needs strong params. Use params.expect in Rails 8 for shape-aware filtering with clean 400 responses on malformed bodies.',
		furtherReading: [
			{
				title: 'Rails 8 Release Notes (params.expect)',
				url: 'https://guides.rubyonrails.org/8_0_release_notes.html',
			},
			{
				title: 'Action Controller Parameters',
				url: 'https://api.rubyonrails.org/classes/ActionController/Parameters.html',
			},
			{
				title: 'Rails Security Guide (Mass Assignment)',
				url: 'https://guides.rubyonrails.org/security.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Look at every column on the products table. Which should a logged-in user be allowed to set directly through a request body? Anything that should NOT (admin-curated flags, server-managed columns, foreign keys to other users) needs to stay out of the controller filter.',
	},
};
