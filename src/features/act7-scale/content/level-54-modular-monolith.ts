import type { Level } from '@/types';

export const level54ModularMonolith: Level = {
	id: 'act7-level54-modular-monolith',
	actId: 7,
	levelNumber: 54,
	name: 'Modular Monolith',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'The monolith has grown to 200 files. A change to billing breaks notifications. No ownership. No boundaries. Team grew from 3 to 12 engineers and everyone touches everything.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'A billing change broke notifications because there are no boundaries. Every team touches every part of the codebase. PR reviews take days because nobody knows who owns what.',
		rootCause:
			'No domain boundaries enforced. Code is organized by Rails convention (models/, controllers/) not by business domain. Cross-domain coupling is invisible until something breaks.',
		codeExample: `# Everything lives in one flat structure:
# app/models/
#   order.rb          ← Billing domain
#   payment.rb        ← Billing domain
#   notification.rb   ← Notifications domain
#   subscription.rb   ← Billing domain
#   audit.rb          ← Compliance domain
#
# A billing change in order.rb directly calls:
class Order < ApplicationRecord
  after_create :send_notification   # Cross-domain coupling!
  after_update :update_audit_trail  # Cross-domain coupling!

  def send_notification
    Notification.create!(            # Reaches into notifications domain
      user: user,
      message: "Order ##{id} created"
    )
  end

  def update_audit_trail
    Audit.create!(                   # Reaches into compliance domain
      auditable: self,
      action: "updated"
    )
  end
end

# When billing changes Notification's interface,
# notifications break. No one knows until production.`,
		goal: 'Organize code into domain packages with enforced boundaries, public APIs, and ownership rules.',
		thresholds: {},
	},
	successConditions: [{ type: 'service_created' }],
	availableNodes: ['event_bus'],
	unlockedNodes: [],
	learningContent: {
		title: 'Modular Monolith with Packwerk',
		goal: `In this level, you'll:\n- learn how to organize a growing monolith into well-defined domain packages.\n- draw boundaries between domains.\n- mark public APIs versus private internals in each package.\n- enforce those boundaries in CI so teams can work independently without accidentally coupling their code together.`,
		conceptExplanation: `The modular monolith is the critical step BEFORE microservice extraction. It enforces domain boundaries within a single deployable codebase.

**Why modular monolith?**
- Microservices add network latency, distributed transactions, and operational complexity
- A modular monolith gives you domain isolation WITHOUT the infrastructure cost
- When you DO need to extract a service later, the boundaries are already clean

**Real users:** Shopify (the largest Rails app in the world), Zendesk, GitHub. All use Packwerk-style modular monoliths.

**Packwerk packages:**
- Each business domain becomes a "package" with its own \`package.yml\`
- \`enforce_dependencies: true\`: only allow explicit dependencies between packages
- \`enforce_privacy: true\`: only allow access through the package's public API
- \`bin/packwerk check\` catches unauthorized cross-package references at CI time

**CODEOWNERS:**
- \`.github/CODEOWNERS\` assigns domain experts as required reviewers
- PRs to \`components/billing/\` require approval from the billing team
- Branch protection rules enforce it: no merging without domain owner approval

**Eileen Uchitelle's keynote (Rails World 2024):** "The Myth of the Modular Monolith". Modularity can't fully solve human problems, but it delivers value by reorganizing complexity in ways humans can better understand.`,
		railsCodeExample: `# === Step 1: Organize into Packwerk packages ===

# Gemfile
gem 'packwerk'

# Directory structure:
# components/
#   billing/
#     app/models/billing/order.rb
#     app/models/billing/payment.rb
#     app/public/billing_interface.rb  ← Public API
#     package.yml
#   notifications/
#     app/models/notifications/notification.rb
#     app/public/notification_interface.rb
#     package.yml
#   compliance/
#     app/models/compliance/audit.rb
#     app/public/audit_interface.rb
#     package.yml

# === Step 2: Define package.yml ===

# components/billing/package.yml
enforce_dependencies: true
enforce_privacy: true
dependencies:
  - '.'  # Root package only, no direct dependency on notifications!

# components/notifications/package.yml
enforce_dependencies: true
enforce_privacy: true
dependencies:
  - '.'

# === Step 3: Create public APIs ===

# components/billing/app/public/billing_interface.rb
module BillingInterface
  def self.create_order(user:, items:)
    Billing::Order.create!(user: user, items: items)
  end

  def self.process_payment(order_id:)
    order = Billing::Order.find(order_id)
    Billing::PaymentService.charge(order)
  end
end

# components/compliance/app/public/audit_interface.rb
module AuditInterface
  def self.record(auditable:, action:, user: nil)
    Compliance::Audit.create!(
      auditable: auditable,
      action: action,
      user: user
    )
  end
end

# === Step 4: Use public APIs, not direct access ===

# BEFORE (privacy violation, Packwerk will flag this):
Audit.create!(auditable: order, action: "created")

# AFTER (goes through public API):
AuditInterface.record(auditable: order, action: "created")

# === Step 5: CODEOWNERS ===

# .github/CODEOWNERS
components/billing/   @billing-team
components/notifications/  @platform-team
components/compliance/     @compliance-team
config/                    @infra-team

# === Step 6: CI enforcement ===

# bin/packwerk check
# Checking 342 files...
#
# components/billing/app/models/billing/order.rb:15
#   Privacy violation: Notification is private to components/notifications/
#   Use NotificationInterface instead.
#
# 1 violation found. ← CI fails!

# .github/workflows/packwerk.yml
- name: Check package boundaries
  run: bin/packwerk check`,
		commonMistakes: [
			'Organizing by Rails convention (models/, controllers/) instead of by domain',
			'Allowing direct model access across packages (bypassing public APIs)',
			'Not running packwerk check in CI (boundaries only enforced locally)',
			'Making packages too granular (one per model, which defeats the purpose)',
			'Not setting up CODEOWNERS (no ownership enforcement)',
		],
		whenToUse:
			'When your team grows beyond 5-6 engineers, or when a change in one domain frequently breaks another. The modular monolith is the bridge between a tangled monolith and microservices.',
		furtherReading: [
			{
				title: 'Packwerk (Shopify)',
				url: 'https://github.com/Shopify/packwerk',
			},
			{
				title: 'CODEOWNERS (GitHub)',
				url: 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners',
			},
			{
				title:
					'Book: "Rails Scales!", Chapter 9: Packwerk & Modular Boundaries',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Organize code into Packwerk packages by business domain. Define public APIs. Set enforce_dependencies and enforce_privacy to true in package.yml.',
	},
};
