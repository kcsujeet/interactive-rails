/**
 * Level 55: Modular Monolith
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * The world entering this level: 200+ files, 12 engineers, no internal
 * boundaries. Billing code calls notifications internals directly, orders
 * and inventory reference each other, and `git shortlog` on payment.rb
 * lists a dozen authors and no owner.
 *
 * The damage is customer-visible, not aesthetic:
 *   1. Hidden coupling: a notifications dev renames THEIR OWN helper,
 *      CI is green (nothing checks cross-domain references), the deploy
 *      ships, and billing's receipt sender starts crashing in production.
 *   2. Circular tangle: orders <-> inventory reference each other, so an
 *      inventory overselling hotfix drags orders code into review and
 *      waits two days while customers keep buying out-of-stock items.
 *   3. No ownership: a 2am refunds incident pages nobody in particular;
 *      40 minutes of pager roulette while refunds stay down.
 *
 * Phase 2 (HOW - build): 7 steps adopting Packwerk (Shopify's static
 *   analysis tool for boundaries) + CODEOWNERS:
 *   install -> init -> define the billing package -> public API namespace
 *   -> declare dependencies -> run the check in CI -> CODEOWNERS.
 *
 * Phase 3 (ADVANTAGE - reward): MECHANISM-HONEST. Packwerk is CI-time
 *   static analysis (per its README), not a runtime firewall. Reward
 *   scenarios are pull requests hitting the CI gate: the bad reference
 *   is blocked BEFORE merge; production never sees it. Nothing is ever
 *   shown "blocked" mid-request at runtime.
 *
 * Doc sources (fetched 2026-07-10):
 *   - https://github.com/Shopify/packwerk (install chain, static analysis)
 *   - Packwerk USAGE.md (enforce_dependencies, dependencies list,
 *     package-is-a-folder, "We recommend running bin/packwerk check in
 *     your CI pipeline", public-constants namespace recommendation)
 *   - Privacy checking lives in packwerk-extensions, not core.
 */

import type { Edge, EdgeProps, Node } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getStraightPath } from '@xyflow/react';
import { ArrowRight, GitPullRequest, Users } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalCommand,
	type TerminalOutputLine,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	AnimatedDots,
	type DotConfig,
	FlowDiagram,
	FlowHandles,
	reversePath,
} from '@/components/levels/FlowDiagram';
import { FlowNode, type FlowNodeData } from '@/components/levels/FlowNode';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act7-level55-modular-monolith', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface ZoneVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
}

interface EdgeVizState {
	[key: string]: unknown;
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

// Same topology in both phases: four domains, the CI pipeline (exists
// since the deployment work), and customers. Only STATE changes between
// observe and reward; that contrast IS the lesson.
type ZoneKey =
	| 'customer'
	| 'ci'
	| 'billing'
	| 'notifications'
	| 'orders'
	| 'inventory';

type EdgeKey =
	| 'eBillNotif' // billing -> notifications (the hidden reference)
	| 'eOrdInv' // orders -> inventory
	| 'eInvOrd' // inventory -> orders (the circle back)
	| 'eCiDeploy' // ci -> notifications (the deploy path)
	| 'eCustomer'; // customer <-> billing (receipts, refunds)

type AnimFrame = {
	zones?: Partial<Record<ZoneKey, Partial<ZoneVizState>>>;
	edges?: Partial<Record<EdgeKey, Partial<EdgeVizState>>>;
};

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: '#ef4444',
};

const OBSERVE_ZONES: Record<string, ZoneVizState> = {
	customer: {
		label: 'Customers',
		flash: 'idle',
		sublabel: 'receipts, refunds, stock',
		badge: null,
	},
	ci: {
		label: 'CI pipeline',
		flash: 'idle',
		sublabel: 'tests pass; references unchecked',
		badge: null,
	},
	billing: {
		label: 'Billing code',
		flash: 'red',
		sublabel: 'reaches into notifications',
		badge: null,
	},
	notifications: {
		label: 'Notifications code',
		flash: 'red',
		sublabel: 'internals used by strangers',
		badge: null,
	},
	orders: {
		label: 'Orders code',
		flash: 'red',
		sublabel: 'references inventory internals',
		badge: null,
	},
	inventory: {
		label: 'Inventory code',
		flash: 'red',
		sublabel: 'references orders back',
		badge: null,
	},
};

const REWARD_ZONES: Record<string, ZoneVizState> = {
	customer: {
		label: 'Customers',
		flash: 'green',
		sublabel: 'never see the caught mistakes',
		badge: null,
	},
	ci: {
		label: 'CI pipeline',
		flash: 'green',
		sublabel: 'boundary check on every PR',
		badge: null,
	},
	billing: {
		label: 'packs/billing',
		flash: 'green',
		sublabel: 'owned; deps declared',
		badge: null,
	},
	notifications: {
		label: 'packs/notifications',
		flash: 'green',
		sublabel: 'public API namespace',
		badge: null,
	},
	orders: {
		label: 'packs/orders',
		flash: 'green',
		sublabel: 'one-way dependency',
		badge: null,
	},
	inventory: {
		label: 'packs/inventory',
		flash: 'green',
		sublabel: 'changes alone now',
		badge: null,
	},
};

// ─── Discovery definitions ────────────────────────────────────────────

export const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'hidden-coupling',
		label: "A safe-looking rename broke another team's feature",
	},
	{
		id: 'circular-tangle',
		label: 'Orders and inventory cannot change independently',
	},
	{
		id: 'no-owner',
		label: 'Nobody owns the code that handles money',
	},
];

// ─── Probe definitions ────────────────────────────────────────────────
// Every probe is an action in the BEFORE world: git, deploys, pagers.
// The boundary tool does not exist yet, so no probe mentions it.

export const PROBES: ProbeConfig[] = [
	{
		id: 'internal-rename',
		label: 'Rename a notifications helper (their own code)',
		command: 'git mv receipt_formatter.rb message_formatter.rb && git push',
		responseLines: [
			{ text: 'CI: 1,412 tests passed. Merged. Deployed.', color: 'green' },
			{ text: '', color: 'muted' },
			{
				text: 'Production, 20 min later: NoMethodError in InvoiceSender',
				color: 'red',
			},
			{
				text: 'billing/invoice_sender.rb called the OLD class directly.',
				color: 'red',
			},
			{ text: 'Receipts stopped. Nobody on notifications knew.', color: 'red' },
		],
		story: [
			'A notifications developer renames a helper class in code their team wrote and owns.',
			'Every test passes. Nothing in CI checks who ELSE references that constant.',
			'The deploy ships. Twenty minutes later, billing’s invoice sender starts crashing: it had been calling the notifications internal directly.',
			'Customers stop receiving receipts, and support tickets pile up against the billing team, who changed nothing.',
			'The reference was invisible: not declared anywhere, checked by nothing.',
		],
	},
	{
		id: 'circular-hotfix',
		label: 'Ship an overselling hotfix to inventory',
		command: 'git diff --stat inventory-oversell-fix',
		responseLines: [
			{ text: 'inventory/stock_check.rb   | 14 +-', color: 'yellow' },
			{ text: 'orders/order.rb            | 22 +-', color: 'red' },
			{ text: 'orders/fulfillment.rb      |  9 +-', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'The "inventory" fix rewrites orders code too.',
				color: 'red',
			},
			{
				text: 'Orders owner is out. Review stalls. Overselling continues.',
				color: 'red',
			},
		],
		story: [
			'Customers are buying items that are already out of stock. Inventory has the fix ready.',
			'But inventory and orders reference each other’s internals both ways, so the "inventory" diff rewrites orders code too.',
			'Now the PR needs an orders review, and the person who understands that code is unreachable.',
			'Two more days of overselling, refund tickets, and apology emails.',
			'Two domains that cannot change independently are one domain with two names.',
		],
	},
	{
		id: 'incident-owner',
		label: 'Page the owner of payment.rb at 2am',
		command: 'git shortlog -sn app/models/payment.rb | head -5',
		responseLines: [
			{ text: '  38  (12 different authors total)', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: '2:04am: refunds endpoint returning 500s.', color: 'red' },
			{ text: '2:11am: who owns this? Slack silence.', color: 'red' },
			{
				text: '2:44am: someone who "touched it once" starts debugging.',
				color: 'red',
			},
		],
		story: [
			'Refunds start failing at 2am.',
			'The on-call engineer opens payment.rb: twelve authors, no owner, no team name anywhere.',
			'Forty minutes of pager roulette before someone who once touched the file volunteers.',
			'Customers wait on refunds the whole time.',
			'Code that handles money has no name attached to it.',
		],
	},
];

export const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'internal-rename': ['hidden-coupling'],
	'circular-hotfix': ['circular-tangle'],
	'incident-owner': ['no-owner'],
};

// ─── Observe animation frames ─────────────────────────────────────────

const RENAME_FRAMES: AnimFrame[] = [
	{
		zones: {
			notifications: {
				flash: 'amber',
				sublabel: 'renames its own helper',
				badge: 'RENAME',
			},
			ci: { flash: 'green', sublabel: '1,412 tests green', badge: 'MERGED' },
		},
		edges: {
			eCiDeploy: {
				active: true,
				reverse: false,
				label: 'deploys cleanly',
				dotColor: '#22c55e',
			},
		},
	},
	{
		zones: {
			billing: {
				flash: 'red',
				sublabel: 'InvoiceSender: NoMethodError',
				badge: '500',
			},
		},
		edges: {
			eCiDeploy: { active: false, label: '' },
			eBillNotif: {
				active: true,
				reverse: false,
				label: 'hidden reference, now broken',
				dotColor: '#ef4444',
			},
		},
	},
	{
		zones: {
			customer: {
				flash: 'red',
				sublabel: 'receipts stopped arriving',
				badge: 'NO RECEIPTS',
			},
			notifications: {
				flash: 'idle',
				sublabel: 'team has no idea',
				badge: null,
			},
		},
		edges: {
			eBillNotif: { active: false, label: '' },
			eCustomer: {
				active: true,
				reverse: false,
				label: 'support tickets rising',
				dotColor: '#ef4444',
			},
		},
	},
];

const CIRCULAR_FRAMES: AnimFrame[] = [
	{
		zones: {
			inventory: {
				flash: 'amber',
				sublabel: 'overselling fix ready',
				badge: 'FIX',
			},
			customer: {
				flash: 'red',
				sublabel: 'buying out-of-stock items',
				badge: 'OVERSOLD',
			},
		},
	},
	{
		zones: {
			orders: {
				flash: 'red',
				sublabel: 'fix drags orders code in',
				badge: 'REVIEW?',
			},
		},
		edges: {
			eOrdInv: {
				active: true,
				reverse: false,
				label: 'orders -> inventory internals',
				dotColor: '#ef4444',
			},
			eInvOrd: {
				active: true,
				reverse: false,
				label: 'inventory -> orders internals',
				dotColor: '#ef4444',
			},
		},
	},
	{
		zones: {
			inventory: {
				flash: 'red',
				sublabel: 'PR stalled 2 days',
				badge: 'STALLED',
			},
			customer: {
				flash: 'red',
				sublabel: 'overselling continues',
				badge: 'DAY 2',
			},
		},
		edges: {
			eOrdInv: { active: false, label: '' },
			eInvOrd: { active: false, label: '' },
		},
	},
];

const OWNER_FRAMES: AnimFrame[] = [
	{
		zones: {
			billing: {
				flash: 'red',
				sublabel: 'refunds returning 500',
				badge: '2:04am',
			},
			customer: { flash: 'red', sublabel: 'refunds stuck', badge: null },
		},
	},
	{
		zones: {
			billing: {
				flash: 'red',
				sublabel: 'payment.rb: 12 authors, 0 owners',
				badge: 'WHO?',
			},
			ci: { flash: 'idle', sublabel: 'no ownership map anywhere' },
		},
	},
	{
		zones: {
			billing: {
				flash: 'red',
				sublabel: 'debugging starts 40 min late',
				badge: '2:44am',
			},
			customer: {
				flash: 'red',
				sublabel: 'refunds down the whole time',
				badge: '40 MIN',
			},
		},
	},
];

export const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'internal-rename': RENAME_FRAMES,
	'circular-hotfix': CIRCULAR_FRAMES,
	'incident-owner': OWNER_FRAMES,
};

// ─── Reward animation frames ──────────────────────────────────────────
// MECHANISM-HONEST: the check runs in CI on pull requests, per the
// Packwerk README recommendation. Nothing blocks at runtime; the bad
// change never reaches production in the first place.

const REWARD_RENAME_FRAMES: AnimFrame[] = [
	{
		zones: {
			notifications: {
				flash: 'amber',
				sublabel: 'same rename, PR opened',
				badge: 'PR',
			},
		},
	},
	{
		zones: {
			ci: {
				flash: 'red',
				sublabel: 'boundary check: billing references this constant',
				badge: 'CHECK FAILED',
			},
		},
		edges: {
			eCiDeploy: {
				active: true,
				reverse: true,
				label: 'PR blocked before merge',
				dotColor: '#ef4444',
			},
		},
	},
	{
		zones: {
			notifications: {
				flash: 'green',
				sublabel: 'rename ships via the public API',
				badge: 'MERGED',
			},
			billing: { flash: 'green', sublabel: 'switched to the public API' },
			customer: {
				flash: 'green',
				sublabel: 'receipts never stopped',
				badge: null,
			},
		},
		edges: { eCiDeploy: { active: false, label: '' } },
	},
];

const REWARD_CIRCULAR_FRAMES: AnimFrame[] = [
	{
		zones: {
			inventory: {
				flash: 'amber',
				sublabel: 'same overselling fix',
				badge: 'FIX',
			},
		},
	},
	{
		zones: {
			orders: {
				flash: 'green',
				sublabel: 'depends on inventory one way only',
				badge: null,
			},
			inventory: {
				flash: 'green',
				sublabel: 'fix touches only packs/inventory',
				badge: null,
			},
		},
		edges: {
			eOrdInv: {
				active: true,
				reverse: false,
				label: 'declared, one-way',
				dotColor: '#22c55e',
			},
		},
	},
	{
		zones: {
			inventory: {
				flash: 'green',
				sublabel: 'merged same day',
				badge: 'SHIPPED',
			},
			customer: {
				flash: 'green',
				sublabel: 'overselling stopped',
				badge: null,
			},
		},
		edges: { eOrdInv: { active: false, label: '' } },
	},
];

const REWARD_OWNER_FRAMES: AnimFrame[] = [
	{
		zones: {
			billing: {
				flash: 'red',
				sublabel: 'same 2am refunds incident',
				badge: '2:04am',
			},
		},
	},
	{
		zones: {
			billing: {
				flash: 'amber',
				sublabel: 'CODEOWNERS: packs/billing -> billing team',
				badge: 'PAGED',
			},
			ci: { flash: 'green', sublabel: 'ownership is a file, not folklore' },
		},
	},
	{
		zones: {
			billing: {
				flash: 'green',
				sublabel: 'right person debugging by 2:08am',
				badge: '2:08am',
			},
			customer: { flash: 'green', sublabel: 'refunds back quickly' },
		},
	},
];

const REWARD_STRICT_FRAMES: AnimFrame[] = [
	{
		zones: {
			ci: {
				flash: 'amber',
				sublabel: 'legacy violations recorded in TODO lists',
				badge: 'ADOPTING',
			},
		},
	},
	{
		zones: {
			ci: {
				flash: 'green',
				sublabel: 'strict mode: no NEW violations can land',
				badge: 'STRICT',
			},
			billing: { flash: 'green', sublabel: 'old debt shrinks PR by PR' },
			orders: { flash: 'green', sublabel: 'boundaries hold from here on' },
		},
	},
];

export const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'internal-rename': REWARD_RENAME_FRAMES,
	'circular-hotfix': REWARD_CIRCULAR_FRAMES,
	'incident-owner': REWARD_OWNER_FRAMES,
	'strict-mode': REWARD_STRICT_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	billing: {
		stageId: 'billing',
		title: 'Billing code',
		description:
			'Invoices, refunds, payments. Its files sit in the same flat app/ directories as everyone else’s and call whatever constants they can see, including other domains’ internals.',
		code: `# app/services/invoice_sender.rb
class InvoiceSender
  def deliver(invoice)
    # Reaches straight into another domain's internals.
    # Nothing declares it; nothing checks it.
    body = ReceiptFormatter.format(invoice)
    NotificationMailer.invoice(body).deliver_later
  end
end`,
	},
	notifications: {
		stageId: 'notifications',
		title: 'Notifications code',
		description:
			'Mailers, formatters, push notifications. Its helpers are referenced by other domains it has never heard of, which makes every internal rename a production gamble.',
	},
	orders: {
		stageId: 'orders',
		title: 'Orders code',
		description:
			'Order lifecycle and fulfillment. References inventory internals directly, and inventory references back: a circle that makes independent change impossible.',
	},
	inventory: {
		stageId: 'inventory',
		title: 'Inventory code',
		description:
			'Stock levels and reservations. Cannot ship a fix without dragging orders code into the diff, because the two reference each other both ways.',
	},
	ci: {
		stageId: 'ci',
		title: 'CI pipeline',
		description:
			'Runs the test suite on every PR and it stays green through all of this: tests check behavior, not boundaries. Nothing in the pipeline knows which domain may reference which.',
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {};

// ─── Stress test scenarios (reward) ───────────────────────────────────
// Reward scenarios are PULL REQUESTS hitting the CI gate, not runtime
// requests. "Blocked" means blocked BEFORE merge.

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'internal-rename',
		label: 'Rename a notifications helper (their own code)',
		description: 'CI boundary check fails the PR before merge',
		method: 'PR',
		path: 'rename ReceiptFormatter (referenced by billing)',
		actor: 'notifications team',
		expectedResult: 'blocked',
		story: [
			'Same developer, same rename, PR opened.',
			'The CI boundary check reads every constant reference and finds billing calling this class.',
			'The PR fails BEFORE merge with the exact file and line; production never sees the break.',
			'The rename ships an hour later with billing switched to the public API. Receipts never stop.',
		],
	},
	{
		id: 'circular-hotfix',
		label: 'Ship an overselling hotfix to inventory',
		description:
			'One-way dependency: the fix touches one pack, merges same day',
		method: 'PR',
		path: 'packs/inventory/stock_check.rb',
		actor: 'inventory team',
		expectedResult: 'allowed',
		story: [
			'Same overselling bug, same fix.',
			'The adoption cleanup broke the circle: orders depends on inventory’s public API, one way only.',
			'The fix touches only packs/inventory, needs only the inventory owner’s review, and merges the same day.',
			'Overselling stops in hours, not days.',
		],
	},
	{
		id: 'incident-owner',
		label: 'Page the owner of payment.rb at 2am',
		description: 'CODEOWNERS routes the page to the billing team in minutes',
		method: 'PAGE',
		path: '.github/CODEOWNERS: packs/billing/ -> billing team',
		actor: 'on-call',
		expectedResult: 'allowed',
		story: [
			'Same 2am refunds incident.',
			'Ownership is a file now: packs/billing/ maps to the billing team.',
			'The page reaches the right people at 2:08 instead of 2:44.',
			'Refunds are back before most customers notice.',
		],
	},
	{
		id: 'strict-mode',
		label: 'Turn the boundary check to strict',
		description: 'Legacy violations grandfathered; no NEW ones can land',
		method: 'PR',
		path: 'packs/*/package.yml: enforce_dependencies: strict',
		actor: 'platform team',
		expectedResult: 'allowed',
		story: [
			'Adoption is honest about the past: existing violations are recorded, not fixed overnight.',
			'Strict mode draws the line: recorded debt stays visible, but no NEW violation can merge.',
			'Old debt shrinks pull request by pull request; the boundary holds from here on.',
			'The tangle stops growing the day the gate turns on.',
		],
	},
];

// ─── Build step definitions ───────────────────────────────────────────

export const STEP_DEFS: StepDef[] = [
	{ id: 'install', title: 'Install the Boundary Checker' },
	{ id: 'init', title: 'Initialize the Configuration' },
	{ id: 'define-package', title: 'Carve Out the Billing Package' },
	{ id: 'public-api', title: 'Give the Package a Public API' },
	{ id: 'declare-deps', title: 'Declare Dependencies' },
	{ id: 'ci-gate', title: 'Put the Check in CI' },
	{ id: 'codeowners', title: 'Name the Owners' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal',
	'terminal',
	'option',
	'option',
	'option',
	'option',
	'option',
];

// Step 0: install (per the Packwerk README: gem + binstub).
export const INSTALL_COMMANDS: TerminalCommand[] = [
	{
		id: 'wrong-gem-install',
		label: 'gem install packwerk',
		command: 'gem install packwerk',
		correct: false,
		feedback:
			'A system-wide install lands only on your machine. The other eleven engineers and the CI runners never get it, and this tool has to run everywhere the code does.',
	},
	{
		id: 'correct',
		label: 'bundle add packwerk && bundle binstub packwerk',
		command: 'bundle add packwerk && bundle binstub packwerk',
		correct: true,
	},
	{
		id: 'wrong-extensions-first',
		label: 'bundle add packwerk-extensions',
		command: 'bundle add packwerk-extensions',
		correct: false,
		feedback:
			'That package extends a checker you have not installed yet. The core tool comes first; extensions can layer on later if you need them.',
	},
];

const INSTALL_OUTPUT: TerminalOutputLine[] = [
	{ text: 'Fetching packwerk 3.2.1', color: 'green' },
	{ text: 'Generated binstub: bin/packwerk', color: 'cyan' },
];

// Step 1: init.
export const INIT_COMMANDS: TerminalCommand[] = [
	{
		id: 'wrong-generator',
		label: 'bin/rails generate packwerk:install',
		command: 'bin/rails generate packwerk:install',
		correct: false,
		feedback:
			'This tool does not hook into Rails generators. It ships its own binstub with its own subcommands.',
	},
	{
		id: 'wrong-check-first',
		label: 'bin/packwerk check',
		command: 'bin/packwerk check',
		correct: false,
		feedback:
			'Checking before any configuration exists has nothing to verify against. Scaffold the configuration first, then define packages, then check.',
	},
	{
		id: 'correct',
		label: 'bin/packwerk init',
		command: 'bin/packwerk init',
		correct: true,
	},
];

const INIT_OUTPUT: TerminalOutputLine[] = [
	{ text: 'Created packwerk.yml', color: 'green' },
	{ text: 'The whole app is one implicit root package so far.', color: 'cyan' },
];

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

// Step 2: define the billing package. A package IS a folder with a
// package.yml (per USAGE.md); the code moves under it.
const PACKAGE_OPTIONS: StepOption[] = [
	{
		id: 'root-only',
		name: '# Keep one package.yml at the project root.\n# All code stays where it is; the tool is\n# installed, so the boundaries exist. Right?',
		correct: false,
		feedback:
			'One root package means one boundary drawn around everything, which separates nothing. Domains get boundaries by becoming packages of their own.',
	},
	{
		id: 'correct',
		name: '# Move billing’s code under its own folder\n# and mark the folder as a package:\n\nmkdir -p packs/billing\ngit mv app/services/invoice_sender.rb \\\n  packs/billing/app/services/\n# ... (billing models, jobs move too)\n\n# packs/billing/package.yml\nenforce_dependencies: true',
		correct: true,
	},
	{
		id: 'ruby-dsl',
		name: '# config/initializers/packages.rb\nPackages.define do\n  package :billing do\n    path "app/billing"\n  end\nend',
		correct: false,
		feedback:
			'There is no Ruby DSL for this tool, and packages are never declared in an initializer. Central Ruby config recreates the far-from-the-code problem that boundaries are supposed to fix.',
	},
];

// Step 3: the public API namespace (USAGE.md recommends a namespace
// holding the package's public constants).
const PUBLIC_API_OPTIONS: StepOption[] = [
	{
		id: 'readme-convention',
		name: '# packs/notifications/README.md\n#\n# "Please only call NotificationMailer\n# and ReceiptFormatter.format from\n# outside this pack. Thanks!"',
		correct: false,
		feedback:
			'A README is a request, not a boundary. Nothing fails when someone ignores it, so under deadline pressure someone will. The public surface needs to live in code.',
	},
	{
		id: 'everything-public',
		name: '# Treat every constant in the pack as\n# public API. Callers can keep using\n# whatever they already use; nothing\n# breaks during adoption.',
		correct: false,
		feedback:
			'A boundary that includes everything excludes nothing: every internal rename is still a breaking change for unknown callers. The point is a surface smaller than the whole pack.',
	},
	{
		id: 'correct',
		name: '# One namespace holds what others may\n# call; everything else is internal:\n\nmodule Notifications\n  module Public\n    class SendReceipt\n      def self.call(invoice:)\n        # wraps the pack internals\n      end\n    end\n  end\nend',
		correct: true,
	},
];

// Step 4: declare dependencies (USAGE.md list syntax).
const DEPS_OPTIONS: StepOption[] = [
	{
		id: 'all-on-all',
		name: '# Every pack lists every other pack:\ndependencies:\n  - packs/billing\n  - packs/notifications\n  - packs/orders\n  - packs/inventory',
		correct: false,
		feedback:
			'A fully-connected dependency list is the old tangle, now written down in YAML. Declaring everything permits everything; the list only means something when it is short.',
	},
	{
		id: 'correct',
		name: '# packs/billing/package.yml\nenforce_dependencies: true\ndependencies:\n  - packs/notifications\n  - packs/orders\n# What billing may reference, written down.\n# Anything else fails the check.',
		correct: true,
	},
	{
		id: 'none-declared',
		name: '# Declare no dependencies anywhere.\n# The checker will list what it finds,\n# and the lists can be tidied someday.\ndependencies: []',
		correct: false,
		feedback:
			'With nothing declared, every real reference lands in the violation backlog forever and the report becomes noise nobody reads. Declare the references you mean to keep; the leftover list is then the actual debt.',
	},
];

// Step 5: the gate. Per the README: run the check in CI.
const CI_OPTIONS: StepOption[] = [
	{
		id: 'manual-releases',
		name: '# Run the boundary check by hand before\n# each release, from the release\n# checklist doc.',
		correct: false,
		feedback:
			'A manual step runs when someone remembers, which is never during the deadline that matters. By release time the violating code has been merged for weeks.',
	},
	{
		id: 'pre-commit',
		name: '# .git/hooks/pre-commit\nbin/packwerk check || exit 1\n# Every engineer’s machine, every commit.',
		correct: false,
		feedback:
			'Local hooks are per-machine, unversioned, and skippable with a flag. Eleven of twelve engineers will have it; the twelfth ships the violation. A gate only counts if nobody can route around it.',
	},
	{
		id: 'correct',
		name: '# .github/workflows/ci.yml\n- name: Boundary check\n  run: bin/packwerk check\n# Every PR, every branch, no exceptions.\n# A reference violation fails the build\n# BEFORE merge, never in production.',
		correct: true,
	},
];

// Step 6: CODEOWNERS.
const OWNERS_OPTIONS: StepOption[] = [
	{
		id: 'single-owner',
		name: '# .github/CODEOWNERS\n* @cto\n# One responsible adult for everything.',
		correct: false,
		feedback:
			'One name on 200 files is a bottleneck at review time and a mystery at incident time: the CTO approves everything and knows the internals of nothing. Ownership works when it maps to the people who work in the code.',
	},
	{
		id: 'correct',
		name: '# .github/CODEOWNERS\npacks/billing/        @myapp/billing-team\npacks/notifications/  @myapp/notifications-team\npacks/orders/         @myapp/orders-team\npacks/inventory/      @myapp/inventory-team',
		correct: true,
	},
	{
		id: 'rely-on-blame',
		name: '# No owners file. git blame knows who\n# touched what; ask the last committer.',
		correct: false,
		feedback:
			'The last committer fixed a typo in 2024 and knows nothing else about the file. Blame records edits, not responsibility, which is exactly how tonight’s incident lost forty minutes.',
	},
];

// ─── Option step config map ───────────────────────────────────────────

export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	2: {
		title: 'Carve Out the Billing Package',
		description:
			'The tool is configured, but so far the whole app is one implicit package. Where does the billing boundary actually come from?',
		options: PACKAGE_OPTIONS,
	},
	3: {
		title: 'Give the Package a Public API',
		description:
			'The rename broke billing because billing called a notifications INTERNAL. Other packs need something they are allowed to call. What defines that surface?',
		options: PUBLIC_API_OPTIONS,
	},
	4: {
		title: 'Declare Dependencies',
		description:
			'With boundaries drawn, each package states what it may reference. How should billing declare its needs?',
		options: DEPS_OPTIONS,
	},
	5: {
		title: 'Put the Check in CI',
		description:
			'The check exists; now it needs to run where it can actually stop a bad merge. Where does it live?',
		options: CI_OPTIONS,
	},
	6: {
		title: 'Name the Owners',
		description:
			'The 2am incident lost forty minutes to pager roulette. Ownership should be a lookup, not folklore. What goes in the owners file?',
		options: OWNERS_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: INSTALL_COMMANDS, outputLines: INSTALL_OUTPUT },
	{ commands: INIT_COMMANDS, outputLines: INIT_OUTPUT },
	null,
	null,
	null,
	null,
	null,
];

// ─── Code preview per phase/step ──────────────────────────────────────

export function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/services/invoice_sender.rb',
				language: 'ruby',
				code: `class InvoiceSender
  def deliver(invoice)
    # Billing code calling a notifications internal.
    # No declaration anywhere; nothing checks it.
    body = ReceiptFormatter.format(invoice)
    NotificationMailer.invoice(body).deliver_later
  end
end`,
				highlight: [5, 6],
			},
			{
				filename: 'docs/ownership.md',
				language: 'markdown',
				code: `# Who owns what?

    $ git shortlog -sn app/models/payment.rb
    12 different authors. No team name anywhere.

    $ ls app/models | wc -l
    87 files, four domains, one flat directory.

Orders references inventory internals; inventory
references orders back. Billing calls notifications
helpers directly. Every test is green.`,
			},
		];
	}

	const files = [];

	if (completedStep >= 0) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `# Boundary checking: static analysis of constant
# references. Not a runtime layer.
gem "packwerk"`,
		});
	}

	if (completedStep >= 1) {
		files.push({
			filename: 'packwerk.yml',
			language: 'yaml',
			code: `# Generated by bin/packwerk init.
# So far the whole app is one implicit root package.`,
		});
	}

	if (completedStep >= 2) {
		files.push({
			filename: 'packs/billing/package.yml',
			language: 'yaml',
			code:
				completedStep >= 4
					? `enforce_dependencies: true
dependencies:
  - packs/notifications
  - packs/orders`
					: `enforce_dependencies: true`,
		});
	}

	if (completedStep >= 3) {
		files.push({
			filename: 'packs/notifications/app/public/send_receipt.rb',
			language: 'ruby',
			code: `module Notifications
  module Public
    # The surface other packs may call.
    # Everything outside Public is internal.
    class SendReceipt
      def self.call(invoice:)
        body = ReceiptFormatter.format(invoice)
        NotificationMailer.invoice(body).deliver_later
      end
    end
  end
end`,
		});
	}

	if (completedStep >= 5) {
		files.push({
			filename: '.github/workflows/ci.yml',
			language: 'yaml',
			code: `# The gate. A reference violation fails the PR
# before merge; production never sees it.
- name: Boundary check
  run: bin/packwerk check`,
		});
	}

	if (completedStep >= 6) {
		files.push({
			filename: '.github/CODEOWNERS',
			language: 'text',
			code: `packs/billing/        @myapp/billing-team
packs/notifications/  @myapp/notifications-team
packs/orders/         @myapp/orders-team
packs/inventory/      @myapp/inventory-team`,
		});
	}

	return files;
}

// ─── Node/edge rendering ──────────────────────────────────────────────

function flashToStatus(flash: ZoneFlash): FlowNodeData['status'] {
	switch (flash) {
		case 'green':
			return 'active';
		case 'red':
			return 'error';
		case 'amber':
			return 'warning';
		default:
			return 'idle';
	}
}

const ZONE_ICONS: Record<ZoneKey, string> = {
	customer: 'CU',
	ci: 'CI',
	billing: 'BI',
	notifications: 'NO',
	orders: 'OR',
	inventory: 'IN',
};

const PackZoneNode = memo(function PackZoneNode({
	data,
}: {
	data: ZoneVizState & { zoneKey: ZoneKey };
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: ZONE_ICONS[data.zoneKey],
		color: '#6366f1',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
			{data.badge && (
				<div
					className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-mono ${
						data.flash === 'green'
							? 'bg-success/20 text-success'
							: data.flash === 'red'
								? 'bg-destructive/20 text-destructive'
								: 'bg-muted text-muted-foreground'
					}`}
				>
					{data.badge}
				</div>
			)}
		</FlowNode>
	);
});

const PackEdge = memo(function PackEdge(props: EdgeProps) {
	const { id, sourceX, sourceY, targetX, targetY, data } = props;
	const d = (data ?? DEFAULT_EDGE) as EdgeVizState;

	const [edgePath, labelX, labelY] = getStraightPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
	});

	const dotPath = d.reverse ? reversePath(edgePath) : edgePath;
	const fill = d.dotColor || '#ef4444';

	const dots: DotConfig[] = d.active
		? Array.from({ length: 3 }, (_, i) => ({
				id: `${id}-d${i}`,
				color: fill,
				r: 5,
				dur: '1.2s',
				begin: i === 0 ? '0s' : `-${i * 0.4}s`,
			}))
		: [];

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				style={{
					stroke: d.active ? fill : '#a1a1aa',
					strokeWidth: 2,
					strokeDasharray: d.active ? undefined : '6 4',
				}}
			/>
			{dots.length > 0 && <AnimatedDots dots={dots} path={dotPath} />}
			{d.label && (
				<EdgeLabelRenderer>
					<div
						className="nodrag nopan pointer-events-none absolute text-xs font-mono text-foreground bg-background/90 px-1.5 py-0.5 rounded border border-border max-w-64 text-center whitespace-nowrap"
						style={{
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 18}px)`,
						}}
					>
						{d.label}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
});

const packNodeTypes = { pack: PackZoneNode };
const packEdgeTypes = { pack: PackEdge };

const POSITIONS: Record<ZoneKey, { x: number; y: number }> = {
	customer: { x: 40, y: 20 },
	ci: { x: 460, y: 20 },
	billing: { x: 120, y: 170 },
	notifications: { x: 420, y: 170 },
	orders: { x: 120, y: 330 },
	inventory: { x: 420, y: 330 },
};

const EDGE_DEFS: { id: EdgeKey; source: ZoneKey; target: ZoneKey }[] = [
	{ id: 'eCustomer', source: 'customer', target: 'billing' },
	{ id: 'eCiDeploy', source: 'ci', target: 'notifications' },
	{ id: 'eBillNotif', source: 'billing', target: 'notifications' },
	{ id: 'eOrdInv', source: 'orders', target: 'inventory' },
	{ id: 'eInvOrd', source: 'inventory', target: 'orders' },
];

// ─── Main component ───────────────────────────────────────────────────

export function Level55ModularMonolith({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	const [zoneStates, setZoneStates] =
		useState<Record<string, ZoneVizState>>(OBSERVE_ZONES);
	const [edgeStates, setEdgeStates] = useState<Record<string, EdgeVizState>>(
		{},
	);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setZoneStates(structuredClone(isReward ? REWARD_ZONES : OBSERVE_ZONES));
		setEdgeStates({});
	}, [isReward]);

	useEffect(() => {
		resetViz();
	}, [resetViz]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.zones) {
			setZoneStates((prev) => {
				const next = { ...prev };
				for (const [key, patch] of Object.entries(frame.zones ?? {})) {
					next[key] = { ...next[key], ...patch };
				}
				return next;
			});
		}
		if (frame.edges) {
			setEdgeStates((prev) => {
				const next = { ...prev };
				for (const [key, patch] of Object.entries(frame.edges ?? {})) {
					next[key] = { ...DEFAULT_EDGE, ...next[key], ...patch };
				}
				return next;
			});
		}
	}, []);

	const runAnimation = useCallback(
		(frames: AnimFrame[]) => {
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
			setVizAnimating(true);
			resetViz();

			for (const [i, frame] of frames.entries()) {
				const t = setTimeout(() => {
					applyFrame(frame);
					if (i === frames.length - 1) {
						const cleanup = setTimeout(() => {
							setEdgeStates((prev) => {
								const next: Record<string, EdgeVizState> = {};
								for (const [k, v] of Object.entries(prev)) {
									next[k] = { ...v, active: false };
								}
								return next;
							});
							setVizAnimating(false);
						}, ANIMATION_DURATION_MS);
						timersRef.current.push(cleanup);
					}
				}, i * ANIMATION_DURATION_MS);
				timersRef.current.push(t);
			}
		},
		[applyFrame, resetViz],
	);

	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, []);

	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);

	const flowNodes: Node[] = useMemo(() => {
		return Object.entries(POSITIONS).map(([key, position]) => ({
			id: key,
			type: 'pack',
			position,
			data: { ...(zoneStates[key] ?? OBSERVE_ZONES[key]), zoneKey: key },
		}));
	}, [zoneStates]);

	const flowEdges: Edge[] = useMemo(() => {
		return EDGE_DEFS.map((def) => ({
			id: def.id,
			source: def.source,
			target: def.target,
			type: 'pack',
			data: edgeStates[def.id] ?? DEFAULT_EDGE,
		}));
	}, [edgeStates]);

	const handleNodeClick = useCallback(
		(nodeId: string) => {
			if (phase !== 'observe') return;
			const data = STAGE_INSPECTOR_MAP[nodeId];
			if (!data) return;
			setInspectorData(data);
			const discoveryId = STAGE_DISCOVERY_MAP[nodeId];
			if (discoveryId) discoveryGating.discover(discoveryId);
		},
		[phase, discoveryGating],
	);

	const handleProbe = useCallback(
		(probeId: string) => {
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}
			const frames = OBSERVE_PROBE_FRAMES[probeId];
			if (frames) runAnimation(frames);
		},
		[discoveryGating, runAnimation],
	);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_PROBE_FRAMES[scenarioId];
			if (frames) runAnimation(frames);
		},
		[vizAnimating, stressTest, runAnimation],
	);

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const config = OPTION_STEP_CONFIG[stepper.currentStep];
			if (!config) return;
			const option = config.options.find((o) => o.id === optionId);
			if (!option) return;
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all build steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return {
			valid: true,
			message:
				'Boundaries enforced: packages with declared dependencies and public APIs, the check gating every PR in CI, and every pack with a named owner.',
		};
	};

	const codePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];
	const currentTerminal = SHELL_STEP_MAP[stepper.currentStep];

	function renderCenter() {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					<div className="flex-1 relative">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={packEdgeTypes}
							nodes={flowNodes}
							nodeTypes={packNodeTypes}
							onNodeClick={handleNodeClick}
						/>
						{inspectorData && (
							<StageInspector
								data={inspectorData}
								onClose={() => setInspectorData(null)}
							/>
						)}
					</div>
					<div className="px-6 pb-4">
						<ProbeTerminal
							disabled={vizAnimating}
							onProbe={handleProbe}
							probes={PROBES}
							title="Team Probe"
						/>
					</div>
					{discoveryGating.isUnlocked && (
						<div className="p-4 flex justify-center animate-in fade-in duration-500">
							<Button
								className="gap-2"
								onClick={() => setPhase('build')}
								size="lg"
							>
								Build the Fix
								<ArrowRight className="w-4 h-4" />
							</Button>
						</div>
					)}
				</div>
			);
		}

		if (phase === 'build') {
			return (
				<div className="flex-1 overflow-auto p-6">
					<div className="max-w-2xl mx-auto space-y-4">
						{currentStepType === 'terminal' && currentTerminal && (
							<TerminalChoiceStep
								commands={currentTerminal.commands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										{stepper.currentStep === 0 &&
											'Bring in the tool that reads every constant reference and checks it against declared boundaries. The whole team and CI need it.'}
										{stepper.currentStep === 1 &&
											'Scaffold the configuration so packages can be defined.'}
									</p>
								}
								hasNext={hasNextStep}
								initialHistory={buildTerminalHistory(
									SHELL_STEP_MAP,
									stepper.currentStep,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={currentTerminal.outputLines}
								stepKey={stepper.currentStep}
								title={STEP_DEFS[stepper.currentStep].title}
							/>
						)}

						{currentStepType === 'option' && currentOptionConfig && (
							<>
								<h3 className="text-lg font-semibold text-foreground">
									{currentOptionConfig.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{currentOptionConfig.description}
								</p>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>

								<div className="space-y-2">
									{shuffleOptions(
										currentOptionConfig.options,
										stepper.currentStep,
									).map((opt) =>
										isViewingCompletedStep ? (
											<OptionCard
												color="violet"
												disabled={!opt.correct}
												key={opt.id}
												mono
												name={opt.name}
												selected={opt.correct}
												size="lg"
											/>
										) : (
											<OptionCard
												color="violet"
												key={opt.id}
												mono
												name={opt.name}
												onClick={() => handleOptionSelect(opt.id)}
												size="lg"
											/>
										),
									)}
								</div>

								{isViewingCompletedStep && (
									<div className="flex justify-end">
										<Button
											className="gap-2"
											onClick={
												hasNextStep
													? stepper.nextStep
													: () => setPhase('reward')
											}
											size="sm"
										>
											Next Step
											<ArrowRight className="w-4 h-4" />
										</Button>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			);
		}

		return (
			<div className="flex-1 flex flex-col">
				<div className="flex-1 relative">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={packEdgeTypes}
						nodes={flowNodes}
						nodeTypes={packNodeTypes}
					/>
				</div>
				<div className="px-6 pb-4">
					<StressTestPanel
						allowedCount={stressTest.allowedCount}
						blockedCount={stressTest.blockedCount}
						canAutoFire={stressTest.canAutoFire}
						disabled={vizAnimating}
						isAutoFiring={stressTest.isAutoFiring}
						onFire={handleFireScenario}
						onToggleAutoFire={stressTest.toggleAutoFire}
						results={stressTest.results}
						scenarios={STRESS_SCENARIOS}
					/>
				</div>
			</div>
		);
	}

	return (
		<LevelLayout>
			<LeftPanel>
				<div className="flex flex-col h-full overflow-y-auto">
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Twelve engineers, two hundred files, no internal boundaries. A
							notifications rename broke billing receipts in production, an
							inventory hotfix is stuck in a circular review, and a 2am incident
							lost forty minutes to "who owns this file?"
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Carve the tangle into domain packages with enforced dependencies,
							a public API surface, a boundary check that gates every pull
							request in CI, and a named owner for every pack.
						</p>
					</div>

					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{phase === 'build' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Build Steps
							</div>
							<StepProgress
								currentStep={stepper.currentStep}
								onStepClick={stepper.goToStep}
								steps={stepper.steps}
							/>
						</div>
					)}

					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Boundary Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<GitPullRequest className="w-4 h-4 text-warning" />
										<span className="text-foreground">
											Blocked = the PR fails in CI, before merge
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Users className="w-4 h-4 text-success" />
										<span className="text-foreground">
											Every pack has a named owning team
										</span>
									</div>
								</div>
							</div>
							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Allowed</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Blocked</div>
									</div>
								</div>
							</div>
						</>
					)}
				</div>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={7}
					levelName="Modular Monolith"
					levelNumber={55}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>
				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{renderCenter()}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'build'
							? codePreviewStep
							: phase === 'reward'
								? STEP_DEFS.length - 1
								: -1,
					)}
					learningGoal="Boundaries inside one app: each domain becomes a package with a declared dependency list and a small public surface, a static check reads every constant reference and fails the pull request that crosses a line, and ownership becomes a file lookup instead of folklore. The check runs at CI time; production never meets the mistake."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level55ModularMonolith;
