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
			"Users can authenticate, and their personal data is encrypted at rest. But User A can still edit and delete User B's products. Authentication tells us WHO is making the request, but nothing checks whether they are ALLOWED to do what they are asking.",
	},
	problem: {
		observation:
			'User A logs in and sends DELETE /api/products/42 -- a product owned by User B. It succeeds. Any authenticated user can modify or destroy any product.',
		rootCause:
			'Authentication verifies identity but there is no authorization layer checking ownership or permissions.',
		codeExample: `# Current state: no ownership check
class Api::ProductsController < ApplicationController
  def destroy
    product = Product.find(params[:id])
    product.destroy  # Any user can delete ANY product!
    head :no_content
  end
end

# Authentication: "Who are you?" (Bearer token, from L9)
# Authorization:  "Are you allowed to do THIS thing to
#                  THIS record?"
#
# Rails ships authentication scaffolding in core, but
# authorization is left to the application: every Rails
# app picks a library or rolls its own. The dominant
# Ruby pattern is to put the rules in their own classes
# (one per model), keyed by the action being attempted,
# so the controller stays one line: "is this allowed?"
# and the answer lives somewhere testable.`,
		goal: 'Add per-record ownership checks so each controller action verifies the current user is allowed to perform it on this specific record, then watch the rules filter requests in real-time.',
		thresholds: {},
	},
	learningContent: {
		title: 'Authorization & Per-Record Ownership Checks',
		goal: `In this level, you'll:\n- learn the difference between authentication ("who are you?") and authorization ("are you allowed to do this?").\n- introduce dedicated rule classes that decide whether a given user is allowed to update or delete a given record.\n- filter list endpoints so users only see records they have permission to access.`,
		conceptExplanation: `Authorization answers "Can this user do this action on this resource?"

**Why it lives in its own layer:**
- Putting the check inline in the controller works for one action but does not scale: every action needs its own ownership condition, and the conditions get duplicated across controllers and tests.
- Putting the check on the model couples persistence to permissions: the same record can be edited by an admin but not a regular user, so "can update" is not a property of the record alone.
- The clean place is a rule layer that takes (current user, target record) and returns a boolean per action. The controller becomes one line: "is this allowed?"

**The Ruby ecosystem standard:**
The dominant Ruby authorization library follows this pattern:
- One rule class per model, named by convention from the model name.
- Each rule class exposes one boolean method per controller action (one for update, one for destroy, etc.).
- The controller calls a single helper that infers the rule class from the record's class, looks up the matching method for the current action, and either lets the request through or raises an authorization error.
- A separate "scope" mechanism filters collections so list endpoints only return records the current user can see.

The library keeps the rules as plain Ruby objects, which makes each one trivial to unit-test.

**Current.user (Rails built-in):**
- Authentication (L9) leaves the logged-in user in a thread-safe, request-scoped \`Current.user\` attribute.
- Anywhere in the request you can read \`Current.user\` instead of threading the user through method arguments.
- Per-request: parallel requests for User A and User B never see each other's user.

**Authentication vs Authorization:**
- Authentication: "Who are you?" (Level 9).
- Authorization: "Are you allowed to do this?" (This level).`,
		railsCodeExample: `# After completing this level you will have:
# 1. added the dominant Ruby authorization library to your
#    Gemfile through the bundle CLI
# 2. mixed its module into ApplicationController so every
#    controller can call its check helper
# 3. run its install generator to create an ApplicationPolicy
#    base class plus the conventional app/policies/ directory
# 4. written a per-model rule class with one boolean method
#    per action (update, destroy) returning true only when
#    the current user owns the record
# 5. called the check helper from the controller's update and
#    destroy actions so unauthorized requests get a 403
# 6. used the library's collection-filter helper inside the
#    index action so users only see records they can access

# After the level the request flow looks like:
#   DELETE /api/products/42 (User A, owner)      -> 204 No Content
#   DELETE /api/products/42 (User B, not owner)  -> 403 Forbidden
# without any ownership branching in the controller itself.`,
		commonMistakes: [
			'Forgetting to call the authorization helper in controller actions. The action runs unprotected and any authenticated user can hit it.',
			'Putting permission rules inline in the controller instead of in dedicated rule classes. They drift across controllers and become impossible to unit-test.',
			'Forgetting to filter index/list queries through the collection-filter mechanism, so users see records they have no right to access.',
			'Confusing authentication (who) with authorization (can). They are different layers; you need both.',
			'Not testing rule edge cases (owner vs stranger; signed-in vs unauthenticated; admin override).',
		],
		whenToUse:
			'Every action that modifies data or returns user-specific content needs an authorization check. Add the rule layer from the start; retrofitting is painful.',
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
		text: 'Look for the dominant Ruby library that puts authorization rules in their own classes (one per model), keyed by the action being attempted. The controller stays one line per action: "is this allowed?" The answer lives somewhere testable.',
	},
};
