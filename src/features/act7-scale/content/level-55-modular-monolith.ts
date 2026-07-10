import type { Level } from '@/types';

export const level55ModularMonolith: Level = {
	id: 'act7-level55-modular-monolith',
	actId: 7,
	levelNumber: 55,
	name: 'Modular Monolith',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'A notifications developer renamed one of their own helper classes. Every test passed, the deploy shipped, and twenty minutes later billing receipts stopped: billing code had been calling that helper directly, and nobody knew. Twelve engineers, two hundred files, no boundaries, no owners.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Three incidents in one month, all with the same root: a safe-looking rename broke receipts in production while CI stayed green; an inventory overselling hotfix stalled two days because inventory and orders rewrite each other; and a 2am refunds incident lost forty minutes to "who owns payment.rb?" (twelve authors, zero owners).',
		rootCause:
			'The code is organized by Rails convention (models/, controllers/), not by business domain. Any file can reference any constant, so cross-domain references accumulate invisibly: nothing declares them, nothing checks them, and the test suite verifies behavior, not boundaries. There is also no recorded ownership, so incidents start with a manhunt.',
		codeExample: `# app/services/invoice_sender.rb  (billing's code)
class InvoiceSender
  def deliver(invoice)
    # Reaches straight into another team's helper class.
    # Nothing declares this reference; nothing checks it.
    body = ReceiptFormatter.format(invoice)
    NotificationMailer.invoice(body).deliver_later
  end
end

# The notifications team renames ReceiptFormatter
# (their own class, their own code):
#   CI: 1,412 tests green. Merged. Deployed.
#   Production, 20 min later:
#     NoMethodError in InvoiceSender
#     Receipts stop. Support tickets pile up
#     against billing, who changed nothing.

# And when it breaks, who gets paged?
#   $ git shortlog -sn app/models/payment.rb
#   12 different authors. No team name anywhere.`,
		goal: 'Carve the flat codebase into domain packages, each with a small public surface, an explicit list of what it may reference, and a named owning team, and make any pull request that reaches across a boundary fail automatically before it can merge.',
		thresholds: {},
	},
	successConditions: [{ type: 'service_created' }],
	availableNodes: ['event_bus'],
	unlockedNodes: [],
	learningContent: {
		title: 'Modular Monolith: Boundaries Enforced in CI',
		goal: `In this level, you'll:\n- see how invisible cross-domain references turn safe internal changes into production incidents.\n- carve one flat codebase into domain packages without splitting the deployable.\n- give each package a small public API and an explicit dependency list.\n- run a boundary check on every pull request so violations fail before merge, never in production.\n- map every package to a named owning team so incidents start with a lookup, not a manhunt.`,
		conceptExplanation: `The modular monolith is the critical step BEFORE any service extraction. It enforces domain boundaries inside a single deployable codebase.

**Why modular monolith?**
- Microservices add network latency, distributed transactions, and operational complexity
- A modular monolith gives you domain isolation WITHOUT the infrastructure cost
- When you DO need to extract a service later, the boundaries are already clean seams

**Real users:** Shopify (the largest Rails app in the world), Gusto, Zendesk. Packwerk is Shopify's tool, built for exactly this.

**How Packwerk actually works (this matters):** Packwerk is STATIC ANALYSIS. It parses your Ruby files, resolves every constant reference (classes, modules), and checks each cross-package reference against the boundaries you declared. It runs as a command, \`bin/packwerk check\`, and the README recommends running it in your CI pipeline. Nothing runs in production; nothing intercepts calls at runtime. A violation fails the pull request BEFORE merge, which is the whole point: the bad reference never reaches production in the first place.

**Packages:**
- A package is simply a folder containing a \`package.yml\`; the folder path is the package name (e.g. \`packs/billing\`)
- \`enforce_dependencies: true\` makes undeclared cross-package references a violation
- \`dependencies:\` lists the packages this one may reference; short lists are the point
- \`enforce_dependencies: strict\` refuses NEW violations entirely while recorded legacy ones burn down over time
- A recommended convention: one public namespace (e.g. \`Notifications::Public::SendReceipt\`) holds what other packages may call; everything else is internal
- Privacy enforcement (a separate check on WHICH constants may be referenced) moved out of core Packwerk into the packwerk-extensions gem; the core tool checks dependencies

**CODEOWNERS:**
- \`.github/CODEOWNERS\` maps paths to owning teams: \`packs/billing/ @myapp/billing-team\`
- PRs touching a pack require that team's review, and incident response starts with a file lookup instead of \`git shortlog\` archaeology

**Eileen Uchitelle's keynote (Rails World 2024):** "The Myth of the Modular Monolith". Modularity cannot fully solve human problems, but it delivers value by reorganizing complexity in ways humans can better understand. The boundaries are for the twelve engineers, not for the CPU.`,
		railsCodeExample: `# === Step 1: Install (gem + binstub, per the README) ===
$ bundle add packwerk && bundle binstub packwerk

# === Step 2: Initialize ===
$ bin/packwerk init
# Created packwerk.yml. The whole app is one
# implicit root package until folders opt in.

# === Step 3: A package is a folder with a package.yml ===
$ mkdir -p packs/billing
$ git mv app/services/invoice_sender.rb packs/billing/app/services/

# packs/billing/package.yml
enforce_dependencies: true
dependencies:
  - packs/notifications
  - packs/orders

# === Step 4: One public namespace per package ===
# packs/notifications/app/public/send_receipt.rb
module Notifications
  module Public
    class SendReceipt
      def self.call(invoice:)
        body = ReceiptFormatter.format(invoice)   # internal, fine HERE
        NotificationMailer.invoice(body).deliver_later
      end
    end
  end
end

# Billing now calls Notifications::Public::SendReceipt.call(...)
# and never touches ReceiptFormatter again. The rename that
# broke production becomes a private, safe change.

# === Step 5: The gate ===
# .github/workflows/ci.yml
- name: Boundary check
  run: bin/packwerk check
# A violating PR fails BEFORE merge. Production never sees it.

# === Step 6: Ownership ===
# .github/CODEOWNERS
packs/billing/        @myapp/billing-team
packs/notifications/  @myapp/notifications-team
packs/orders/         @myapp/orders-team
packs/inventory/      @myapp/inventory-team`,
		commonMistakes: [
			'Treating the boundary check as a runtime guard (it is static analysis run in CI; production never executes it, and a violation that merges anyway WILL run)',
			'One root package for the whole app (one boundary around everything separates nothing)',
			'Declaring every package as a dependency of every other (the old tangle, now written down in YAML)',
			'Running the check manually before releases instead of on every PR in CI (by release time the violation merged weeks ago)',
			'Making packages too granular (one per model defeats the purpose; packages map to domains and teams)',
			'Skipping ownership mapping (boundaries without owners still leave 2am incidents unrouted)',
		],
		whenToUse:
			'When the team grows past the point where everyone can hold the whole codebase in their head (roughly 5-6 engineers), or when a change in one domain keeps breaking another. The modular monolith is the bridge between a tangled monolith and any future extraction.',
		furtherReading: [
			{
				title: 'Packwerk (Shopify)',
				url: 'https://github.com/Shopify/packwerk',
			},
			{
				title: 'Packwerk usage guide (packages, dependencies, strict mode)',
				url: 'https://github.com/Shopify/packwerk/blob/main/USAGE.md',
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
		text: 'A Ruby gem from Shopify adds package boundaries to a Rails monolith: each package declares what it may reference and exposes a small public surface. The check is static analysis, so run it where every pull request already has to pass.',
	},
};
