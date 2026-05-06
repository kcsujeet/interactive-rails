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
			'A pre-launch review flags the controller for an audit risk: each action lists allowed fields by hand, and the duplicated lists ARE the security boundary. Centralize the whitelist before any future edit accidentally lets a sensitive field through.',
	},
	problem: {
		observation:
			'create and update both spell out the same field list inline. There is no single place to audit "what can users set on a Product?". A future developer adding a new field has to remember to update both — and one missed line is a CVE.',
		rootCause:
			'The controller reads each allowed field by name in every action that builds a Product. The whitelist is duplicated across actions. There is no centralized filter; the security boundary lives in N places at once.',
		codeExample: `# Current state: explicit field-by-field, duplicated per action
class Api::ProductsController < ApplicationController
  def create
    product = Current.user.products.new(
      name: params[:name],
      description: params[:description],
      price: params[:price]
    )
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
    if product.update(
      name: params[:name],
      description: params[:description],
      price: params[:price]
    )
      ...
    end
  end
end

# Risks of this layout:
# - Duplicated whitelist: 2 copies of the same allow-list.
# - Adding a field means editing every action that builds a Product.
# - Malformed body shapes become validation errors instead of clean 400s.
# - Future developer adds user_id: params[:user_id] for "an admin
#   feature" and silently breaks the security boundary.
#
# Rails 8 ships params.expect — a centralized, shape-aware whitelist
# that declares allowed keys in one private method per controller.`,
		goal: 'Move the per-field allow-list into a single private method on the controller and route every Product build through it, so the whitelist lives in one place and the security boundary is one method to audit.',
		thresholds: {},
	},
	learningContent: {
		title: 'Rails 8 Strong Params with params.expect',
		goal: `In this level, you'll:\n- centralize the per-action allow-list into one private method on the controller.\n- use Rails 8's \`params.expect\` to declare allowed keys in a shape-aware way.\n- understand why a centralized whitelist is more auditable than duplicated explicit fields.\n- see the failure mode \`params.expect\` catches that explicit-field extraction silently turns into validation noise.`,
		conceptExplanation: `Strong Parameters give you one place per controller to declare which keys reach the model. Centralization makes the security boundary auditable — you can scan a single private method instead of every action.

**Why centralize the whitelist:**
- One method to audit, one method to forbid sensitive fields.
- Adding a new field means editing one place, not every action.
- Future contributors see the allow-list and can reason about it.
- A reviewer auditing "what can a user set on this resource?" reads one method.

**Rails 8 \`params.expect()\`:**
- Declares which keys are allowed through a centralized whitelist.
- Returns only the permitted keys, silently dropping everything else.
- Raises \`ActionController::ParameterMissing\` if the required root key is missing OR has the wrong shape (e.g., a String where a Hash was expected).
- Preferred over the older \`params.require(:product).permit(:name, :description, :price)\` pattern for new code in Rails 8.

**Why \`params.expect\` is stricter than \`params.require().permit()\`:**
- \`expect\` checks the **shape** of the value at the root key, not just that the key exists.
- If an attacker sends \`product=hacked\` (a plain string) instead of \`product[name]=...\` (a hash with sub-keys), \`params.expect(product: [:name])\` raises \`ActionController::ParameterMissing\` and Rails returns \`400 Bad Request\`.
- The older \`params.require/permit\` pattern can fail in subtler ways: \`require(:product)\` returns the string "hacked", then \`.permit(:name)\` raises \`NoMethodError\` (a 500 stack trace, not a clean 400).
- Use \`expect\` for new code: it fails loudly at the security boundary with the right HTTP status code, which is what API clients expect.

**Building a safe whitelist:**
- Include only fields the user is meant to edit (name, description, price).
- Never include ownership fields (user_id), server-managed fields (id, created_at), or any boolean flag whose meaning the user should not control.
- Set ownership through \`Current.user.products.create!\`, not user-submitted params (the L11 pattern).

**Nested params and arrays:**
- \`params.expect(product: [:name, :description, :price, { tags: [] }])\` allows a tags array.
- \`params.expect(product: [:name, { variants_attributes: [:size, :color] }])\` allows nested hashes.
- Each nesting level needs its own whitelist audit.`,
		railsCodeExample: `# BEFORE: explicit field-by-field, duplicated per action
class Api::ProductsController < ApplicationController
  def create
    product = Current.user.products.new(
      name: params[:name],
      description: params[:description],
      price: params[:price]
    )
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
    if product.update(
      name: params[:name],
      description: params[:description],
      price: params[:price]   # same list, second copy
    )
      render json: product
    else
      render json: { errors: product.errors.full_messages },
             status: :unprocessable_entity
    end
  end
end

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
  # Wrong shape (e.g., product=hacked) -> ParameterMissing -> 400.
  # Extra keys like user_id, role -> silently ignored.
end

# Compared to the older pattern:
# def product_params
#   params.require(:product).permit(:name, :description, :price)
# end
# ^ Permits keys but does not check shape. A string-shape attack
#   surfaces as a 500 NoMethodError instead of a 400 ParameterMissing.`,
		commonMistakes: [
			'Whitelisting user_id, role, or any server-managed field (mass assignment vector).',
			'Using params.permit! which allows everything through.',
			'Forgetting to audit nested params for sensitive fields when arrays or hashes are involved.',
			'Setting ownership via user-submitted params instead of the Current.user association (the L11 pattern).',
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
		text: 'Look at every column on the model and ask "should an external client be able to set this directly?". Anything they should not (server-managed flags, role assignments, foreign keys to other users) needs to be filtered out at the controller layer before the params reach the model.',
	},
};
