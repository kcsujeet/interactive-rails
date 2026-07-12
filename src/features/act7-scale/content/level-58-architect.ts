import type { Level } from '@/types';

export const level58Architect: Level = {
	id: 'act7-level58-architect',
	actId: 7,
	levelNumber: 58,
	name: 'The Architect',
	isCapstone: true,
	trigger: {
		type: 'architecture',
		description:
			'The app is well-factored: package boundaries, domain events, a gateway, a state machine on orders. And billing still hurts everyone around it: its hotfixes wait hours behind the shared deploy pipeline, its month-end batch drags checkout for every customer, and its bugs take the whole storefront down. Decide whether billing should leave the monolith, and design the migration.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Three structural pains, all pointing at one pack: a one-line billing fix ships behind the full two-hour monolith pipeline while customers keep hitting the bug; month-end invoicing saturates the shared primary and drags checkout p95 from 180ms to 2.1s; a billing memory leak starves the shared Puma workers and 503s the entire storefront.',
		rootCause:
			'The package boundary is code-deep only. Billing shares everything physical with the rest of the app: the runtime, the database, and the deploy unit. Clean modules cannot fix shared fate; only a separate deployable can, and moving to one safely is an architecture problem, not a refactor.',
		codeExample: `# The boundary is clean. The fate is shared.

# packs/billing/package.yml (since the modular monolith work)
enforce_dependencies: true
dependencies:
  - packs/notifications
  - packs/orders

# And yet:
#
# 1. DEPLOY  a one-line billing fix ships the whole app:
#            47 unrelated commits, full CI + staging +
#            canary, ~2 hours while the bug keeps charging
#            customers the wrong fee.
#
# 2. DATABASE  month-end invoicing writes 2M rows against
#              the same primary checkout uses:
#              checkout p95 180ms -> 2.1s, every month-end.
#
# 3. RUNTIME  a billing PDF renderer leaks memory, the
#             shared Puma workers die one by one, and
#             browsing + checkout return 503 with no bug
#             of their own.
#
# No package.yml setting fixes any of these.`,
		goal: 'Decide whether billing has earned its own service, then design a migration where customers never feel the move: behavior transfers gradually, the data crosses safely, the two halves cannot take each other down, and every step of the cutover can be turned back instantly.',
		thresholds: {},
	},
	successConditions: [{ type: 'microservice_extracted' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'The Architect: Designing a Service Extraction',
		goal: `In this capstone level, you'll:\n- learn the judgment call: what evidence justifies extracting a service, and what does not.\n- design a strangler-fig migration that rides the seams you already built.\n- plan a data migration that is reversible at every step until it is finished.\n- keep two halves of one system from inheriting each other's failures.\n- control a cutover with percentages and exit criteria instead of a single risky deploy.`,
		conceptExplanation: `This is the capstone, and it is a design exercise: the artifact is the plan, and every step is a decision with real alternatives.

**1. The judgment call (extract or not).**
Extraction is a cost: a second app to deploy, monitor, and page on, plus a network where a method call used to be. It is justified by structural evidence, not by fashion. The evidence here: billing has its own deploy cadence (hotfixes cannot wait for the monolith pipeline), its own workload profile (month-end batch writes), and a blast radius the rest of the app should not share. One pack shows that evidence, so one pack leaves. As Jason Warner (former GitHub CTO) put it: "One of the biggest architectural mistakes of the past decade was going full microservice." Stick with the monolith as long as possible, and no longer.

**2. The strangler fig (how it moves).**
Martin Fowler's strangler fig pattern: grow the new system around the edges of the old, moving behavior incrementally while the old system keeps serving ([source](https://martinfowler.com/bliki/StranglerFigApplication.html)). Big-bang rewrites fail for documented reasons: "replacements seem easy to specify, but often it's hard to figure out the details of existing behavior," and users cannot wait. The transitional architecture (dual paths, a routing gate, parity checks) looks like waste and is not: "the reduced risk and earlier value from the gradual approach outweigh its costs."

The seams were already built, level by level: the gateway (Act 7, Level 57) means clients see one stable URL whichever half serves them. The event bus (Act 7, Level 56) means order facts can reach billing without a blocking call. The flag gate (Act 6, Level 50) means traffic moves by percentage, not by deploy.

**3. The data migration (backfill + dual-write + verify).**
History crosses in batches (backfill). New records are written to BOTH databases for the whole migration window (dual-write), so neither side falls behind. An automated parity job compares the two sides continuously; reads cut over only after sustained parity. The property that matters: every step is reversible until the moment you decide it is finished. A one-night copy script has no way back the morning after.

**4. Communication (facts, not calls).**
Checkout stays in the monolith; payment recording moves to the service. They exchange facts as domain events over the bus, and client traffic reaches billing through the gateway. No synchronous checkout-to-billing calls (that re-couples availability, the exact blast radius being removed) and no reading each other's tables (that couples both sides to schemas they do not own).

**5. The cutover (percentages with exit criteria).**
Flag-gated: 5% -> 25% -> 50% -> 100%, each step held until the parity check and the error budget stay clean. Rollback is a flag flip to 0%: instant, no deploy. The criteria that end the migration are decided before the first percent moves; a parallel run without exit criteria never finishes.

**The concepts this level composes** (each taught earlier, applied together here):

**1. Multi-Database (Act 7, Level 51):** the billing service gets its own writer and replica.
**2. State Machines (Act 7, Level 54):** the payment lifecycle guards travel with the billing code.
**3. Multi-Tenancy (Act 7, Level 53):** tenant scoping applies inside the service exactly as it did in the pack.
**4. Observability (Act 6, Level 47):** parity metrics and error budgets are what make the gradual cutover decidable.
**5. Modular Monolith (Act 7, Level 55):** the enforced package boundary is why the extraction has a clean edge to cut along.
**6. Domain Events (Act 7, Level 56):** the bus carries order facts across the process boundary unchanged.
**7. API Gateway (Act 7, Level 57):** the seam that makes extraction invisible: shipped apps already call one stable URL, so billing can move out behind it. Auth stays at the edge, and the billing section swaps from an in-process package reader to a call to the new service without clients noticing.
**8. Sharding (Act 7, Level 52):** billing data keeps its tenant-keyed layout in its new home.

**A note on the modular monolith (from the book):**
Eileen Uchitelle's keynote ("The Myth of the Modular Monolith", Rails World 2024) argues that modularity can't fully solve human problems, but it delivers value by reorganizing complexity in ways humans can better understand. The key insight: enforce boundaries with tools (Packwerk, CODEOWNERS), not just conventions. This level is the payoff of that discipline: because the boundary was enforced for three acts, the extraction has a seam to cut along instead of a tangle to unpick.`,
		railsCodeExample: `# The extraction plan, as decided in this level:

## 1. Scope
Extract billing, and only billing. The evidence is
structural: deploy cadence, workload isolation, blast
radius. No other pack shows it.

## 2. Shape (strangler fig)
Stand the service up empty behind the existing seams.
The monolith serves 100% until the new path earns traffic.

## 3. Skeleton
$ rails new billing_service --api --database=postgresql
# A second deployable: own workers, own DB, own deploys.

## 4. Data
Backfill history in batches. Dual-write new records to
both databases. Automated parity job gates every cutover
step. Reversible until declared finished.

## 5. Communication
# Monolith side: checkout publishes the fact
broadcast(:order_placed, order_id: order.id, total: order.total)
# Billing service consumes it from the bus and records
# the payment in its own database. Client reads arrive
# through the gateway's billing section.

## 6. Cutover
Flag-gated: 5 -> 25 -> 50 -> 100 percent of billing
traffic, each step held until parity + error budget stay
clean. Rollback = flag to 0%. No deploy in either
direction.`,
		commonMistakes: [
			'Extracting by fashion instead of evidence (a service you did not need costs a network hop, a pager rotation, and a versioned contract, forever)',
			'Big-bang cutover (the undocumented edge cases you forgot are discovered by customers, all at once, with no cheap way back)',
			'Moving the database before the code (cross-database joins appear overnight in every place billing data meets storefront data)',
			'Synchronous calls between the halves (re-couples availability; the noon leak takes checkout down again, just over HTTP)',
			'Sharing one database "temporarily" (the contention you are escaping comes along for the ride, and temporary becomes permanent)',
			'A parallel run with no exit criteria (without a parity threshold and an error budget, the migration never ends and the dual-write tax runs forever)',
		],
		whenToUse:
			'When one domain shows structural evidence (deploy cadence, workload isolation, blast radius, team ownership) that the shared runtime is the bottleneck. Extract that domain, not everything.',
		furtherReading: [
			{
				title: 'Strangler Fig Application (Martin Fowler)',
				url: 'https://martinfowler.com/bliki/StranglerFigApplication.html',
			},
			{
				title: 'The Myth of the Modular Monolith (Rails World 2024)',
				url: 'https://www.youtube.com/watch?v=y2NwK9zTdjM',
			},
			{
				title: 'Microservices: API Gateway pattern',
				url: 'https://microservices.io/patterns/apigateway.html',
			},
		],
		homework: [
			{
				task: 'Write the judgment call: a one-page extraction memo in docs/ of your project that names the structural evidence for extracting billing (deploy cadence, workload isolation, blast radius), the evidence against, and your decision.',
				verify:
					'You can read the memo aloud and state the decision plus its strongest counterargument in under a minute.',
			},
			{
				task: 'Design the migration in docs/: the strangler-fig stages (empty service behind the gateway, backfill, dual-write, parity checks, flag-gated 5/25/50/100 percent cutover), and for each stage write its exit criterion and its rollback step.',
				verify:
					'Every stage in the plan has both an exit criterion and a rollback, and you can explain the rollback path from any stage aloud in under a minute.',
			},
			{
				task: 'Prove two deployables can coexist on your laptop: scaffold the skeleton service and run it next to your main app on a different port.',
				commands: [
					'rails new billing_service --api --database=postgresql',
					'cd billing_service && bin/rails server -p 3001',
				],
				verify:
					'curl http://localhost:3001/up returns 200 while your main app still answers on port 3000.',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'The three pains share one shape: billing shares something physical with everyone else. Ask what each pain would look like if billing had its own runtime, its own database, and its own deploys, and what has to be true for it to get there without customers noticing.',
	},
};
