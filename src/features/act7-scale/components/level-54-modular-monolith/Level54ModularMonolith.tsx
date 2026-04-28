/**
 * Level 52: Modular Monolith
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): Custom 2x2 grid visualization of domain packages.
 *   Billing (top-left), Notifications (top-right), Orders (bottom-left),
 *   Inventory (bottom-right). Red dashed arrows criss-cross between boxes
 *   showing undeclared coupling. Probes reveal coupling, circular deps,
 *   unclear ownership, and privacy violations.
 *
 * Phase 2 (HOW - build): 6 steps (2 terminal + 4 OptionCard)
 *   Step 0: bundle add packwerk (terminal)
 *   Step 1: bin/packwerk init (terminal)
 *   Step 2: Configure package.yml (OptionCard)
 *   Step 3: Define public API (OptionCard)
 *   Step 4: Declare dependencies (OptionCard)
 *   Step 5: Set up CODEOWNERS (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Same 2x2 grid but solid colored borders,
 *   valid dependency arrows green, "Public API" labels visible.
 *   Stress test fires valid/invalid dependency and privacy scenarios.
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import { ArrowRight, FileCode, Shield, ShieldAlert } from 'lucide-react';
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

registerLevelCode('act7-level54-modular-monolith', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface PackageVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
	hasPublicApi: boolean;
}

interface EdgeVizState {
	[key: string]: unknown;
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
	isDanger: boolean;
}

interface AnimFrame {
	billing?: Partial<PackageVizState>;
	notifications?: Partial<PackageVizState>;
	orders?: Partial<PackageVizState>;
	inventory?: Partial<PackageVizState>;
	edgeA?: Partial<EdgeVizState>;
	edgeB?: Partial<EdgeVizState>;
	edgeC?: Partial<EdgeVizState>;
	edgeD?: Partial<EdgeVizState>;
	edgeE?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_PKG: PackageVizState = {
	label: '',
	flash: 'idle',
	sublabel: null,
	badge: null,
	hasPublicApi: false,
};

const DEFAULT_BILLING: PackageVizState = {
	...DEFAULT_PKG,
	label: 'Billing',
	flash: 'red',
	sublabel: 'No boundaries',
};

const DEFAULT_NOTIFICATIONS: PackageVizState = {
	...DEFAULT_PKG,
	label: 'Notifications',
	flash: 'red',
	sublabel: 'No boundaries',
};

const DEFAULT_ORDERS: PackageVizState = {
	...DEFAULT_PKG,
	label: 'Orders',
	flash: 'red',
	sublabel: 'No boundaries',
};

const DEFAULT_INVENTORY: PackageVizState = {
	...DEFAULT_PKG,
	label: 'Inventory',
	flash: 'red',
	sublabel: 'No boundaries',
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: '#ef4444',
	isDanger: true,
};

// Reward defaults: solid borders, public API labels
const DEFAULT_BILLING_REWARD: PackageVizState = {
	...DEFAULT_PKG,
	label: 'Billing',
	flash: 'green',
	sublabel: 'enforce_dependencies: true',
	hasPublicApi: true,
};

const DEFAULT_NOTIFICATIONS_REWARD: PackageVizState = {
	...DEFAULT_PKG,
	label: 'Notifications',
	flash: 'green',
	sublabel: 'enforce_privacy: true',
	hasPublicApi: true,
};

const DEFAULT_ORDERS_REWARD: PackageVizState = {
	...DEFAULT_PKG,
	label: 'Orders',
	flash: 'green',
	sublabel: 'dependencies: [billing]',
	hasPublicApi: true,
};

const DEFAULT_INVENTORY_REWARD: PackageVizState = {
	...DEFAULT_PKG,
	label: 'Inventory',
	flash: 'green',
	sublabel: 'enforce_privacy: true',
	hasPublicApi: true,
};

const DEFAULT_EDGE_REWARD: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: '#22c55e',
	isDanger: false,
};

// ─── Discovery definitions ────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'cross-domain-coupling', label: 'Cross-domain coupling detected' },
	{ id: 'circular-deps', label: 'Circular dependency found' },
	{ id: 'no-ownership', label: 'No code ownership defined' },
	{ id: 'no-privacy', label: 'Private methods accessible externally' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'billing-notification-coupling',
		label: 'Grep for cross-domain calls',
		command: 'grep -r "Notification" components/billing/',
		responseLines: [
			{
				text: 'billing/services/invoice_sender.rb:  Notification.deliver(user, invoice)',
				color: 'red',
			},
			{
				text: 'billing/models/payment.rb:  NotificationMailer.receipt(self).deliver_later',
				color: 'red',
			},
			{ text: '', color: 'muted' },
			{
				text: 'Billing directly calls Notification internals.',
				color: 'yellow',
			},
			{
				text: 'If Notification renames a class, Billing breaks silently.',
				color: 'red',
			},
		],
		story: [
			'You search the billing package for references to other domains.',
			'InvoiceSender directly instantiates Notification models.',
			'Payment model calls NotificationMailer internals.',
			'No declared dependency. No public API boundary.',
			'A rename in notifications will break billing at runtime.',
		],
	},
	{
		id: 'circular-dependency',
		label: 'Run packwerk check',
		command: 'bin/packwerk check',
		responseLines: [
			{
				text: 'E: Circular dependency: orders -> inventory -> orders',
				color: 'red',
			},
			{
				text: '  orders/models/order.rb references Inventory::StockItem',
				color: 'yellow',
			},
			{
				text: '  inventory/models/stock_item.rb references Order',
				color: 'yellow',
			},
			{ text: '', color: 'muted' },
			{
				text: 'Cannot deploy orders or inventory independently.',
				color: 'red',
			},
		],
		story: [
			'You run packwerk to check package boundaries.',
			'Orders references Inventory::StockItem for stock checks.',
			'Inventory references Order to track reservations.',
			'Circular dependency: neither can be extracted later.',
			'Changes in one domain force testing both.',
		],
	},
	{
		id: 'who-owns-invoice',
		label: 'Check file ownership',
		command: 'git log --format="%an" components/billing/ | sort -u | wc -l',
		responseLines: [
			{ text: '12', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '12 different authors committed to billing/ in the last month.',
				color: 'yellow',
			},
			{
				text: 'No CODEOWNERS file. No required reviewers for billing PRs.',
				color: 'red',
			},
			{
				text: 'Anyone can merge changes without domain expert review.',
				color: 'red',
			},
		],
		story: [
			'You check who has been committing to the billing package.',
			'12 different engineers touched billing code this month.',
			'No CODEOWNERS file maps billing/ to a responsible team.',
			'PRs merge without billing-domain expert review.',
			'Subtle billing logic bugs ship undetected.',
		],
	},
	{
		id: 'privacy-violation',
		label: 'Test package privacy',
		command:
			'ruby -e "require_relative \'components/billing/models/ledger_entry\'"',
		responseLines: [
			{
				text: '=> true (loaded successfully)',
				color: 'yellow',
			},
			{ text: '', color: 'muted' },
			{
				text: 'LedgerEntry is an internal billing model, but any package can load it.',
				color: 'red',
			},
			{
				text: 'No enforce_privacy. All internal classes are globally accessible.',
				color: 'red',
			},
			{
				text: 'Other teams bypass BillingInterface and call LedgerEntry directly.',
				color: 'yellow',
			},
		],
		story: [
			'You try loading an internal billing model from outside.',
			'LedgerEntry loads without error. No privacy enforcement.',
			'Any package can reach into billing internals directly.',
			'Teams skip the public API and query LedgerEntry.where(...).',
			'Billing team cannot refactor internals without breaking callers.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'billing-notification-coupling': ['cross-domain-coupling'],
	'circular-dependency': ['circular-deps'],
	'who-owns-invoice': ['no-ownership'],
	'privacy-violation': ['no-privacy'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Observe: 4 nodes (Billing, Notifications, Orders, Inventory)
// edgeA = Billing -> Notifications (cross-domain coupling)
// edgeB = Orders -> Inventory (circular dep direction 1)
// edgeC = Inventory -> Orders (circular dep direction 2)
// edgeD = Billing -> Orders (undeclared)
// edgeE = Notifications -> Inventory (undeclared)

const COUPLING_FRAMES: AnimFrame[] = [
	{
		billing: {
			flash: 'amber',
			sublabel: 'Calling Notification internals...',
		},
		notifications: {
			flash: 'amber',
			sublabel: 'Receiving undeclared call',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'Notification.deliver()',
			dotColor: '#ef4444',
			isDanger: true,
		},
	},
	{
		billing: {
			flash: 'red',
			sublabel: 'Undeclared dependency!',
			badge: 'COUPLED',
		},
		notifications: {
			flash: 'red',
			sublabel: 'Internal class exposed',
			badge: 'NO BOUNDARY',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'NotificationMailer.receipt()',
			dotColor: '#ef4444',
			isDanger: true,
		},
	},
	{
		billing: { flash: 'red', sublabel: 'No boundaries', badge: null },
		notifications: { flash: 'red', sublabel: 'No boundaries', badge: null },
		edgeA: { active: false, label: '' },
	},
];

const CIRCULAR_FRAMES: AnimFrame[] = [
	{
		orders: {
			flash: 'amber',
			sublabel: 'References Inventory::StockItem',
		},
		inventory: {
			flash: 'amber',
			sublabel: 'Receiving reference',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'Inventory::StockItem',
			dotColor: '#ef4444',
			isDanger: true,
		},
	},
	{
		orders: {
			flash: 'red',
			sublabel: 'Referenced by Inventory',
			badge: 'CIRCULAR',
		},
		inventory: {
			flash: 'red',
			sublabel: 'References Order model',
			badge: 'CIRCULAR',
		},
		edgeC: {
			active: true,
			reverse: false,
			label: 'Order (back-reference)',
			dotColor: '#ef4444',
			isDanger: true,
		},
	},
	{
		orders: { flash: 'red', sublabel: 'No boundaries', badge: null },
		inventory: { flash: 'red', sublabel: 'No boundaries', badge: null },
		edgeB: { active: false, label: '' },
		edgeC: { active: false, label: '' },
	},
];

const OWNERSHIP_FRAMES: AnimFrame[] = [
	{
		billing: {
			flash: 'amber',
			sublabel: 'Checking git log...',
		},
	},
	{
		billing: {
			flash: 'red',
			sublabel: '12 authors, no owner',
			badge: 'NO CODEOWNERS',
		},
		orders: {
			flash: 'red',
			sublabel: '9 authors, no owner',
			badge: 'NO CODEOWNERS',
		},
	},
	{
		billing: { flash: 'red', sublabel: 'No boundaries', badge: null },
		orders: { flash: 'red', sublabel: 'No boundaries', badge: null },
	},
];

const PRIVACY_FRAMES: AnimFrame[] = [
	{
		billing: {
			flash: 'amber',
			sublabel: 'Testing privacy...',
		},
	},
	{
		billing: {
			flash: 'red',
			sublabel: 'LedgerEntry exposed!',
			badge: 'NO PRIVACY',
		},
		edgeD: {
			active: true,
			reverse: true,
			label: 'LedgerEntry.where(...)',
			dotColor: '#ef4444',
			isDanger: true,
		},
	},
	{
		billing: { flash: 'red', sublabel: 'No boundaries', badge: null },
		edgeD: { active: false, label: '' },
	},
];

const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'billing-notification-coupling': COUPLING_FRAMES,
	'circular-dependency': CIRCULAR_FRAMES,
	'who-owns-invoice': OWNERSHIP_FRAMES,
	'privacy-violation': PRIVACY_FRAMES,
};

// ─── Reward animation frames ─────────────────────────────────────────
// Reward: same 4 nodes but with enforced boundaries and public APIs.

const REWARD_VALID_DEP_FRAMES: AnimFrame[] = [
	{
		orders: {
			flash: 'amber',
			sublabel: 'Calling BillingInterface...',
		},
		billing: {
			flash: 'amber',
			sublabel: 'Receiving declared call',
		},
		edgeD: {
			active: true,
			reverse: true,
			label: 'BillingInterface.create_invoice()',
			dotColor: '#22c55e',
			isDanger: false,
		},
	},
	{
		orders: {
			flash: 'green',
			sublabel: 'Declared dependency',
			badge: 'ALLOWED',
		},
		billing: {
			flash: 'green',
			sublabel: 'Public API used',
			badge: 'ALLOWED',
		},
		edgeD: {
			active: true,
			reverse: true,
			label: 'dependencies: [billing]',
			dotColor: '#22c55e',
			isDanger: false,
		},
	},
];

const REWARD_PUBLIC_API_FRAMES: AnimFrame[] = [
	{
		notifications: {
			flash: 'amber',
			sublabel: 'Calling NotificationInterface...',
		},
		billing: {
			flash: 'idle',
			sublabel: 'enforce_dependencies: true',
		},
		edgeA: {
			active: true,
			reverse: true,
			label: 'NotificationInterface.send()',
			dotColor: '#22c55e',
			isDanger: false,
		},
	},
	{
		notifications: {
			flash: 'green',
			sublabel: 'Public API respected',
			badge: 'ALLOWED',
		},
		edgeA: {
			active: true,
			reverse: true,
			label: 'app/public/ interface',
			dotColor: '#22c55e',
			isDanger: false,
		},
	},
];

const REWARD_CI_CHECK_FRAMES: AnimFrame[] = [
	{
		billing: { flash: 'amber', sublabel: 'Running packwerk check...' },
		notifications: { flash: 'amber', sublabel: 'Running packwerk check...' },
		orders: { flash: 'amber', sublabel: 'Running packwerk check...' },
		inventory: { flash: 'amber', sublabel: 'Running packwerk check...' },
	},
	{
		billing: {
			flash: 'green',
			sublabel: 'All dependencies valid',
			badge: 'CI PASS',
		},
		notifications: {
			flash: 'green',
			sublabel: 'Privacy enforced',
			badge: 'CI PASS',
		},
		orders: {
			flash: 'green',
			sublabel: 'Deps declared',
			badge: 'CI PASS',
		},
		inventory: {
			flash: 'green',
			sublabel: 'No circular deps',
			badge: 'CI PASS',
		},
	},
];

const REWARD_PRIVATE_ACCESS_FRAMES: AnimFrame[] = [
	{
		orders: {
			flash: 'amber',
			sublabel: 'Trying LedgerEntry.where()...',
		},
		billing: {
			flash: 'amber',
			sublabel: 'Privacy check...',
		},
		edgeD: {
			active: true,
			reverse: true,
			label: 'LedgerEntry.where()',
			dotColor: '#ef4444',
			isDanger: true,
		},
	},
	{
		orders: {
			flash: 'red',
			sublabel: 'Privacy violation!',
			badge: 'BLOCKED',
		},
		billing: {
			flash: 'green',
			sublabel: 'enforce_privacy: true',
			badge: 'PROTECTED',
		},
		edgeD: {
			active: true,
			reverse: true,
			label: 'VIOLATION: private constant',
			dotColor: '#ef4444',
			isDanger: true,
		},
	},
];

const REWARD_UNDECLARED_DEP_FRAMES: AnimFrame[] = [
	{
		inventory: {
			flash: 'amber',
			sublabel: 'Trying Notification.deliver()...',
		},
		notifications: {
			flash: 'amber',
			sublabel: 'Dependency check...',
		},
		edgeE: {
			active: true,
			reverse: false,
			label: 'Notification.deliver()',
			dotColor: '#ef4444',
			isDanger: true,
		},
	},
	{
		inventory: {
			flash: 'red',
			sublabel: 'Undeclared dependency!',
			badge: 'BLOCKED',
		},
		notifications: {
			flash: 'green',
			sublabel: 'enforce_dependencies: true',
			badge: 'PROTECTED',
		},
		edgeE: {
			active: true,
			reverse: false,
			label: 'VIOLATION: not in dependencies',
			dotColor: '#ef4444',
			isDanger: true,
		},
	},
];

const REWARD_CIRCULAR_FRAMES: AnimFrame[] = [
	{
		orders: {
			flash: 'amber',
			sublabel: 'Checking for circular deps...',
		},
		inventory: {
			flash: 'amber',
			sublabel: 'Checking for circular deps...',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'Order -> Inventory?',
			dotColor: '#ef4444',
			isDanger: true,
		},
	},
	{
		orders: {
			flash: 'green',
			sublabel: 'Uses InventoryInterface',
			badge: 'REFACTORED',
		},
		inventory: {
			flash: 'green',
			sublabel: 'No back-reference to Order',
			badge: 'CLEAN',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'One-way via public API',
			dotColor: '#22c55e',
			isDanger: false,
		},
	},
];

const REWARD_NO_PRIVACY_FRAMES: AnimFrame[] = [
	{
		billing: {
			flash: 'amber',
			sublabel: 'Trying Invoice.new from outside...',
		},
	},
	{
		billing: {
			flash: 'green',
			sublabel: 'enforce_privacy: true',
			badge: 'BLOCKED',
		},
	},
];

const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'valid-dep-call': REWARD_VALID_DEP_FRAMES,
	'public-api-call': REWARD_PUBLIC_API_FRAMES,
	'ci-check': REWARD_CI_CHECK_FRAMES,
	'private-access': REWARD_PRIVATE_ACCESS_FRAMES,
	'undeclared-dep': REWARD_UNDECLARED_DEP_FRAMES,
	'circular-attempt': REWARD_CIRCULAR_FRAMES,
	'no-privacy-bypass': REWARD_NO_PRIVACY_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	billing: {
		stageId: 'billing',
		title: 'Billing Package',
		description:
			'Handles invoices, payments, and ledger entries. Currently has no package.yml. Any file can reach into billing internals directly. 12 engineers commit here without domain review.',
		code: `# components/billing/
#   app/models/invoice.rb
#   app/models/payment.rb
#   app/models/ledger_entry.rb  (internal)
#   app/services/invoice_sender.rb
# No package.yml. No enforce_dependencies.
# No enforce_privacy. No CODEOWNERS entry.`,
	},
	notifications: {
		stageId: 'notifications',
		title: 'Notifications Package',
		description:
			'Sends emails, SMS, and push notifications. Billing calls Notification classes directly without going through any public API. A class rename here breaks billing at runtime.',
		code: `# components/notifications/
#   app/models/notification.rb
#   app/mailers/notification_mailer.rb
# No package.yml. No public interface.
# Other packages call internals directly.`,
	},
	orders: {
		stageId: 'orders',
		title: 'Orders Package',
		description:
			'Manages order lifecycle and fulfillment. Has a circular dependency with Inventory: Orders references StockItem, and Inventory references Order. Neither package can be deployed or tested independently.',
		code: `# components/orders/
#   app/models/order.rb
#     references Inventory::StockItem
#   app/services/fulfillment_service.rb
# Circular dependency with inventory/`,
	},
	inventory: {
		stageId: 'inventory',
		title: 'Inventory Package',
		description:
			'Tracks stock levels and warehouse locations. References the Order model from the orders package, creating a circular dependency that prevents independent deployment.',
		code: `# components/inventory/
#   app/models/stock_item.rb
#     references Order (back-reference)
#   app/services/stock_checker.rb
# Circular dependency with orders/`,
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	billing: 'cross-domain-coupling',
	orders: 'circular-deps',
};

// ─── Stress test scenarios (reward) ───────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'valid-dep-call',
		label: 'Call declared dependency',
		description: 'Orders calls BillingInterface (declared dep)',
		method: 'GET',
		path: 'Orders -> BillingInterface.create_invoice()',
		actor: 'orders-package',
		expectedResult: 'allowed',
	},
	{
		id: 'public-api-call',
		label: 'Use public API',
		description: 'Billing calls NotificationInterface (public API)',
		method: 'POST',
		path: 'Billing -> NotificationInterface.send()',
		actor: 'billing-package',
		expectedResult: 'allowed',
	},
	{
		id: 'ci-check',
		label: 'Run packwerk check in CI',
		description: 'bin/packwerk check validates all boundaries',
		method: 'GET',
		path: 'bin/packwerk check',
		actor: 'ci-pipeline',
		expectedResult: 'allowed',
	},
	{
		id: 'private-access',
		label: 'Access private model',
		description: 'Orders tries LedgerEntry.where() directly',
		method: 'GET',
		path: 'Orders -> LedgerEntry.where()',
		actor: 'orders-package',
		expectedResult: 'blocked',
	},
	{
		id: 'undeclared-dep',
		label: 'Undeclared dependency',
		description: 'Inventory calls Notification without declaring dep',
		method: 'POST',
		path: 'Inventory -> Notification.deliver()',
		actor: 'inventory-package',
		expectedResult: 'blocked',
	},
	{
		id: 'circular-attempt',
		label: 'Circular dependency check',
		description: 'Inventory back-references Order (was circular)',
		method: 'GET',
		path: 'Inventory -> Order (circular?)',
		actor: 'inventory-package',
		expectedResult: 'blocked',
	},
	{
		id: 'no-privacy-bypass',
		label: 'Bypass privacy boundary',
		description: 'External code tries Invoice.new directly',
		method: 'POST',
		path: 'External -> Invoice.new()',
		actor: 'other-package',
		expectedResult: 'blocked',
	},
];

// ─── Build step definitions ───────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-packwerk', title: 'Install Packwerk' },
	{ id: 'init-packwerk', title: 'Initialize Packwerk' },
	{ id: 'configure-yml', title: 'Configure package.yml' },
	{ id: 'define-public-api', title: 'Define Public API' },
	{ id: 'declare-deps', title: 'Declare Dependencies' },
	{ id: 'setup-codeowners', title: 'Set Up CODEOWNERS' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add packwerk
	'terminal', // 1: bin/packwerk init
	'option', // 2: configure package.yml
	'option', // 3: define public API
	'option', // 4: declare dependencies
	'option', // 5: setup CODEOWNERS
];

// ─── Step 0: Install packwerk (Terminal) ──────────────────────────────

const installPackwerkCommands: TerminalCommand[] = [
	{
		id: 'wrong-npm',
		label: 'npm install packwerk',
		command: 'npm install packwerk',
		correct: false,
		feedback:
			'Packwerk is a Ruby gem, not an npm package. Ruby dependencies are managed with Bundler.',
	},
	{
		id: 'wrong-gem',
		label: 'gem install packwerk',
		command: 'gem install packwerk',
		correct: false,
		feedback:
			'Installing globally with gem install does not add it to your Gemfile. Use Bundler so the dependency is tracked with your project.',
	},
	{
		id: 'correct',
		label: 'bundle add packwerk',
		command: 'bundle add packwerk',
		correct: true,
	},
];

const installPackwerkOutput: TerminalOutputLine[] = [
	{ text: 'Fetching packwerk 3.2.1', color: 'green' },
	{ text: 'Installing packwerk 3.2.1', color: 'green' },
	{ text: 'Added to Gemfile: gem "packwerk", "~> 3.2"', color: 'cyan' },
];

// ─── Step 1: Init packwerk (Terminal) ─────────────────────────────────

const initPackwerkCommands: TerminalCommand[] = [
	{
		id: 'wrong-rails-generate',
		label: 'rails generate packwerk:install',
		command: 'rails generate packwerk:install',
		correct: false,
		feedback:
			'Packwerk uses its own binary, not Rails generators. The init command creates the root packwerk.yml configuration.',
	},
	{
		id: 'correct',
		label: 'bin/packwerk init',
		command: 'bin/packwerk init',
		correct: true,
	},
	{
		id: 'wrong-rake',
		label: 'rake packwerk:init',
		command: 'rake packwerk:init',
		correct: false,
		feedback:
			'Packwerk provides its own CLI binary, not Rake tasks. Use bin/packwerk for all Packwerk commands.',
	},
];

const initPackwerkOutput: TerminalOutputLine[] = [
	{
		text: 'Created packwerk.yml',
		color: 'green',
	},
	{
		text: 'Created package.yml (root package)',
		color: 'green',
	},
	{
		text: 'Run bin/packwerk check to validate package boundaries.',
		color: 'cyan',
	},
];

// ─── Step 2: Configure package.yml (OptionCard) ──────────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

const CONFIGURE_YML_OPTIONS: StepOption[] = [
	{
		id: 'deps-only',
		name: 'enforce_dependencies: true',
		correct: false,
		feedback:
			'Enforcing dependencies catches undeclared references, but without enforce_privacy, any package can still access internal classes directly. You need both enforcement flags.',
	},
	{
		id: 'correct',
		name: 'enforce_dependencies: true\nenforce_privacy: true',
		correct: true,
	},
	{
		id: 'privacy-only',
		name: 'enforce_privacy: true',
		correct: false,
		feedback:
			'Enforcing privacy hides internal classes, but without enforce_dependencies, any package can add references to any other without declaring the relationship.',
	},
];

// ─── Step 3: Define public API (OptionCard) ───────────────────────────

const PUBLIC_API_OPTIONS: StepOption[] = [
	{
		id: 'raw-model',
		name: 'app/models/invoice.rb\n# Expose the model directly',
		correct: false,
		feedback:
			'Exposing raw ActiveRecord models lets callers depend on schema details. If you rename a column, every caller breaks. Service objects in app/public/ create a stable API boundary.',
	},
	{
		id: 'wrong-path',
		name: 'app/services/billing_interface.rb\n# In services, not public',
		correct: false,
		feedback:
			'Files in app/services/ are private to the package. Packwerk only exposes files in the app/public/ directory as the package public API.',
	},
	{
		id: 'correct',
		name: 'app/public/billing_interface.rb\n# Service object in app/public/',
		correct: true,
	},
];

// ─── Step 4: Declare dependencies (OptionCard) ────────────────────────

const DECLARE_DEPS_OPTIONS: StepOption[] = [
	{
		id: 'wrong-wildcard',
		name: 'dependencies:\n  - "*"',
		correct: false,
		feedback:
			'A wildcard dependency defeats the purpose of enforcement. Each package should declare exactly which packages it depends on, no more.',
	},
	{
		id: 'correct',
		name: 'dependencies:\n  - billing\n  - users',
		correct: true,
	},
	{
		id: 'wrong-empty',
		name: 'dependencies: []',
		correct: false,
		feedback:
			'An empty dependency list means the orders package cannot access any other package at all. Orders legitimately needs billing (for invoices) and users (for customer data).',
	},
];

// ─── Step 5: Setup CODEOWNERS (OptionCard) ────────────────────────────

const CODEOWNERS_OPTIONS: StepOption[] = [
	{
		id: 'everyone',
		name: '* @full-team',
		correct: false,
		feedback:
			'Assigning the entire team to everything means no one has specific domain responsibility. Every PR needs the full team, creating bottlenecks.',
	},
	{
		id: 'wrong-generic',
		name: '/components/billing/ @backend-team\n/components/orders/ @backend-team',
		correct: false,
		feedback:
			'A generic backend team does not have domain expertise. CODEOWNERS should map each package to the team that owns that domain.',
	},
	{
		id: 'correct',
		name: '/components/billing/ @billing-team\n/components/orders/ @orders-team\n/components/inventory/ @inventory-team',
		correct: true,
	},
];

// ─── Option step config map ───────────────────────────────────────────

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	2: {
		title: 'Configure Package Enforcement',
		description:
			'Each package needs a package.yml. The billing package has undeclared dependencies and exposed internals. Which enforcement flags should you enable to catch both problems?',
		options: CONFIGURE_YML_OPTIONS,
	},
	3: {
		title: 'Define Public API',
		description:
			'With enforce_privacy enabled, only files in a specific directory are accessible from outside the package. Where should the billing package expose its interface?',
		options: PUBLIC_API_OPTIONS,
	},
	4: {
		title: 'Declare Dependencies',
		description:
			'The orders package needs to call BillingInterface for invoices and access user data. With enforce_dependencies enabled, which dependency list is correct for orders/package.yml?',
		options: DECLARE_DEPS_OPTIONS,
	},
	5: {
		title: 'Set Up CODEOWNERS',
		description:
			'Domain ownership prevents unreviewed changes. Each package needs a responsible team in .github/CODEOWNERS. Which configuration maps packages to domain experts?',
		options: CODEOWNERS_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: installPackwerkCommands, outputLines: installPackwerkOutput },
	{ commands: initPackwerkCommands, outputLines: initPackwerkOutput },
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
	null, // step 5: OptionCard
];

// ─── Code preview per phase/step ──────────────────────────────────────

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'components/billing/invoice_sender.rb',
				language: 'ruby',
				code: `# components/billing/services/invoice_sender.rb
class Billing::InvoiceSender < ApplicationService
  Result = Data.define(:invoice, :success, :error)

  def call(user, invoice)
    # Direct call to Notification internals!
    Notification.deliver(user, invoice)
    NotificationMailer.receipt(invoice).deliver_later
    Result.new(invoice: invoice, success: true, error: nil)
  end
end
# No package.yml. No dependency declaration.
# No enforce_privacy. All internals exposed.`,
				highlight: [5, 6],
			},
			{
				filename: 'components/orders/models/order.rb',
				language: 'ruby',
				code: `# components/orders/models/order.rb
class Order < ApplicationRecord
  def check_stock
    # Direct reference to Inventory internals
    Inventory::StockItem.find_by(sku: sku)
  end
end

# components/inventory/models/stock_item.rb
class Inventory::StockItem < ApplicationRecord
  belongs_to :order  # Back-reference! Circular dep.
end`,
				highlight: [5, 11],
			},
		];
	}

	const files = [];

	// Step 0 complete: packwerk added to Gemfile
	if (completedStep >= 0) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `# Gemfile
gem "rails", "~> 8.0"
gem "packwerk", "~> 3.2"`,
			highlight: [3],
		});
	}

	// Step 1 complete: packwerk.yml created
	if (completedStep >= 1) {
		files.push({
			filename: 'packwerk.yml',
			language: 'yaml',
			code: `# packwerk.yml
include:
  - "components/**/*.rb"
  - "app/**/*.rb"
exclude:
  - "test/**/*"
  - "spec/**/*"`,
			highlight: [3, 4],
		});
	}

	// Step 2 complete: package.yml configured
	if (completedStep >= 2) {
		files.push({
			filename: 'components/billing/package.yml',
			language: 'yaml',
			code:
				completedStep >= 4
					? `# components/billing/package.yml
enforce_dependencies: true
enforce_privacy: true
dependencies:
  - users`
					: `# components/billing/package.yml
enforce_dependencies: true
enforce_privacy: true`,
			highlight: completedStep >= 4 ? [2, 3, 4, 5] : [2, 3],
		});
	}

	// Step 3 complete: public API defined
	if (completedStep >= 3) {
		files.push({
			filename: 'components/billing/app/public/billing_interface.rb',
			language: 'ruby',
			code: `# components/billing/app/public/billing_interface.rb
module BillingInterface
  def self.create_invoice(user:, items:)
    Invoice.create!(user: user, line_items: items)
  end

  def self.find_invoice(id)
    Invoice.find(id)
  end
end
# Only files in app/public/ are accessible
# from outside the billing package.`,
			highlight: [3, 4, 7, 8],
		});
	}

	// Step 4 complete: dependencies declared
	if (completedStep >= 4) {
		files.push({
			filename: 'components/orders/package.yml',
			language: 'yaml',
			code: `# components/orders/package.yml
enforce_dependencies: true
enforce_privacy: true
dependencies:
  - billing
  - users`,
			highlight: [4, 5, 6],
		});
	}

	// Step 5 complete: CODEOWNERS
	if (completedStep >= 5) {
		files.push({
			filename: '.github/CODEOWNERS',
			language: 'bash',
			code: `# .github/CODEOWNERS
/components/billing/   @billing-team
/components/orders/    @orders-team
/components/inventory/ @inventory-team
/components/notifications/ @notifications-team`,
			highlight: [2, 3, 4, 5],
		});
	}

	// Always show root file when no steps complete
	if (files.length === 0) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `# Gemfile
gem "rails", "~> 8.0"
# TODO: add packwerk gem`,
			highlight: [3],
		});
	}

	return files;
}

// ─── Flash to FlowNode status mapping ────────────────────────────────

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

// ─── Custom React Flow nodes ──────────────────────────────────────────

const PackageNode = memo(function PackageNode({
	data,
}: {
	data: PackageVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'PK',
		color: '#71717a',
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
							: 'bg-destructive/20 text-destructive'
					}`}
				>
					{data.badge}
				</div>
			)}
			{data.hasPublicApi && (
				<div className="mt-1 flex items-center justify-center gap-1 text-xs text-success">
					<FileCode className="w-3 h-3" />
					Public API
				</div>
			)}
		</FlowNode>
	);
});

// ─── Custom edge ──────────────────────────────────────────────────────

const PackageEdge = memo(function PackageEdge(props: EdgeProps) {
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
					strokeDasharray: d.isDanger ? '6 4' : undefined,
				}}
			/>
			{dots.length > 0 && <AnimatedDots dots={dots} path={dotPath} />}
			{d.label && (
				<EdgeLabelRenderer>
					<div
						className="nodrag nopan pointer-events-none absolute text-xs font-mono text-foreground bg-background/90 px-1.5 py-0.5 rounded border border-border max-w-64 text-center whitespace-nowrap"
						style={{
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 20}px)`,
						}}
					>
						{d.label}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
});

const pkgNodeTypes = { pkg: PackageNode };
const pkgEdgeTypes = { pkg: PackageEdge };

// ─── Main component ───────────────────────────────────────────────────

export function Level54ModularMonolith({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [billingState, setBillingState] =
		useState<PackageVizState>(DEFAULT_BILLING);
	const [notificationsState, setNotificationsState] = useState<PackageVizState>(
		DEFAULT_NOTIFICATIONS,
	);
	const [ordersState, setOrdersState] =
		useState<PackageVizState>(DEFAULT_ORDERS);
	const [inventoryState, setInventoryState] =
		useState<PackageVizState>(DEFAULT_INVENTORY);
	const [edgeAState, setEdgeAState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBState, setEdgeBState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeCState, setEdgeCState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeDState, setEdgeDState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeEState, setEdgeEState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setBillingState(isReward ? DEFAULT_BILLING_REWARD : DEFAULT_BILLING);
		setNotificationsState(
			isReward ? DEFAULT_NOTIFICATIONS_REWARD : DEFAULT_NOTIFICATIONS,
		);
		setOrdersState(isReward ? DEFAULT_ORDERS_REWARD : DEFAULT_ORDERS);
		setInventoryState(isReward ? DEFAULT_INVENTORY_REWARD : DEFAULT_INVENTORY);
		setEdgeAState(isReward ? DEFAULT_EDGE_REWARD : DEFAULT_EDGE);
		setEdgeBState(isReward ? DEFAULT_EDGE_REWARD : DEFAULT_EDGE);
		setEdgeCState(isReward ? DEFAULT_EDGE_REWARD : DEFAULT_EDGE);
		setEdgeDState(isReward ? DEFAULT_EDGE_REWARD : DEFAULT_EDGE);
		setEdgeEState(isReward ? DEFAULT_EDGE_REWARD : DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.billing)
			setBillingState((prev) => ({ ...prev, ...frame.billing }));
		if (frame.notifications)
			setNotificationsState((prev) => ({ ...prev, ...frame.notifications }));
		if (frame.orders) setOrdersState((prev) => ({ ...prev, ...frame.orders }));
		if (frame.inventory)
			setInventoryState((prev) => ({ ...prev, ...frame.inventory }));
		if (frame.edgeA) setEdgeAState((prev) => ({ ...prev, ...frame.edgeA }));
		if (frame.edgeB) setEdgeBState((prev) => ({ ...prev, ...frame.edgeB }));
		if (frame.edgeC) setEdgeCState((prev) => ({ ...prev, ...frame.edgeC }));
		if (frame.edgeD) setEdgeDState((prev) => ({ ...prev, ...frame.edgeD }));
		if (frame.edgeE) setEdgeEState((prev) => ({ ...prev, ...frame.edgeE }));
	}, []);

	const runAnimation = useCallback(
		(frames: AnimFrame[], onDone?: () => void) => {
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
			setVizAnimating(true);
			resetViz();

			for (const [i, frame] of frames.entries()) {
				const t = setTimeout(() => {
					applyFrame(frame);
					if (i === frames.length - 1) {
						const cleanup = setTimeout(() => {
							setVizAnimating(false);
							onDone?.();
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

	// ── Hooks ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	// ── Inspector ──
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);

	// ── Flow nodes/edges ──
	// 2x2 grid: Billing (top-left), Notifications (top-right),
	//           Orders (bottom-left), Inventory (bottom-right)
	const flowNodes: Node[] = useMemo(
		() => [
			{
				id: 'billing',
				type: 'pkg',
				position: { x: 80, y: 20 },
				data: billingState,
			},
			{
				id: 'notifications',
				type: 'pkg',
				position: { x: 420, y: 20 },
				data: notificationsState,
			},
			{
				id: 'orders',
				type: 'pkg',
				position: { x: 80, y: 220 },
				data: ordersState,
			},
			{
				id: 'inventory',
				type: 'pkg',
				position: { x: 420, y: 220 },
				data: inventoryState,
			},
		],
		[billingState, notificationsState, ordersState, inventoryState],
	);

	const flowEdges: Edge[] = useMemo(
		() => [
			// edgeA: Billing -> Notifications (top row, horizontal)
			{
				id: 'edgeA',
				source: 'billing',
				target: 'notifications',
				type: 'pkg',
				data: edgeAState,
			},
			// edgeB: Orders -> Inventory (bottom row, horizontal)
			{
				id: 'edgeB',
				source: 'orders',
				target: 'inventory',
				type: 'pkg',
				data: edgeBState,
			},
			// edgeC: Inventory -> Orders (reverse of B, for circular dep)
			{
				id: 'edgeC',
				source: 'inventory',
				target: 'orders',
				type: 'pkg',
				data: edgeCState,
			},
			// edgeD: Billing -> Orders (left column, vertical)
			{
				id: 'edgeD',
				source: 'billing',
				target: 'orders',
				type: 'pkg',
				data: edgeDState,
			},
			// edgeE: Notifications -> Inventory (right column, vertical / diagonal)
			{
				id: 'edgeE',
				source: 'notifications',
				target: 'inventory',
				type: 'pkg',
				data: edgeEState,
			},
		],
		[edgeAState, edgeBState, edgeCState, edgeDState, edgeEState],
	);

	// ── Handlers ──
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
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_PROBE_FRAMES[scenarioId];
			if (frames) runAnimation(frames);
		},
		[stressTest, runAnimation],
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
				'Modular monolith configured with enforced boundaries and domain ownership!',
		};
	};

	// ── Code preview index ──
	const codePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	// ── Render ──
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Center panel content ──
	function renderCenter() {
		// Observe phase
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					<div className="flex-1 relative">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={pkgEdgeTypes}
							nodes={flowNodes}
							nodeTypes={pkgNodeTypes}
							onNodeClick={handleNodeClick}
						/>
						{inspectorData && (
							<StageInspector
								data={inspectorData}
								onClose={() => setInspectorData(null)}
							/>
						)}
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={vizAnimating}
							onProbe={handleProbe}
							probes={PROBES}
							title="Package Boundary Probe"
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

		// Build phase
		if (phase === 'build') {
			return (
				<div className="flex-1 overflow-auto p-6">
					<div className="max-w-2xl mx-auto space-y-4">
						{/* Step 0: Terminal - bundle add packwerk */}
						{currentStepType === 'terminal' && stepper.currentStep === 0 && (
							<TerminalChoiceStep
								commands={installPackwerkCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										The monolith has 200+ models with no boundaries. You need a
										tool to define packages and enforce dependency rules. Add
										the package boundary enforcement gem.
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
								outputLines={installPackwerkOutput}
								stepKey={stepper.currentStep}
								title="Install Package Boundary Tool"
							/>
						)}

						{/* Step 1: Terminal - bin/packwerk init */}
						{currentStepType === 'terminal' && stepper.currentStep === 1 && (
							<TerminalChoiceStep
								commands={initPackwerkCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										Packwerk is installed. Initialize it to create the root
										configuration file that defines which directories to scan
										for package boundary violations.
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
								outputLines={initPackwerkOutput}
								stepKey={stepper.currentStep}
								title="Initialize Package Configuration"
							/>
						)}

						{/* OptionCard steps (2-5) */}
						{currentStepType === 'option' && currentOptionConfig && (
							<>
								<h3 className="text-lg font-semibold text-foreground">
									{currentOptionConfig.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{currentOptionConfig.description}
								</p>

								{isViewingCompletedStep ? (
									<div className="space-y-2">
										{shuffleOptions(
											currentOptionConfig.options,
											stepper.currentStep,
										).map((opt) => (
											<OptionCard
												color="violet"
												disabled={!opt.correct}
												key={opt.id}
												mono
												name={opt.name}
												selected={opt.correct}
												size="lg"
											/>
										))}
									</div>
								) : (
									<>
										<div className="space-y-2">
											{shuffleOptions(
												currentOptionConfig.options,
												stepper.currentStep,
											).map((opt) => (
												<OptionCard
													color="violet"
													key={opt.id}
													mono
													name={opt.name}
													onClick={() => handleOptionSelect(opt.id)}
													size="lg"
												/>
											))}
										</div>
										<ErrorFeedback
											message={stepper.lastFeedback}
											onDismiss={stepper.clearFeedback}
										/>
									</>
								)}

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

		// Reward phase
		return (
			<div className="flex-1 flex flex-col">
				<div className="flex-1 relative">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={pkgEdgeTypes}
						nodes={flowNodes}
						nodeTypes={pkgNodeTypes}
					/>
				</div>
				<div className="px-6 pb-2">
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
					{/* Scenario text */}
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your monolith has 200+ models with no boundaries. A billing change
							broke notifications because Billing calls Notification internals
							directly. Orders and Inventory have a circular dependency. No one
							owns any domain.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Use Packwerk to create domain packages with enforced dependencies,
							privacy boundaries, and code ownership.
						</p>
					</div>

					{/* Observe: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build: step progress */}
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

					{/* Reward: boundary counters */}
					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Boundary Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<Shield className="w-4 h-4 text-success" />
										<span className="text-foreground">
											Valid: declared dependency + public API
										</span>
									</div>
									<div className="flex items-center gap-2">
										<ShieldAlert className="w-4 h-4 text-destructive" />
										<span className="text-foreground">
											Violation: private access or undeclared dep
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
										<div className="text-xs text-destructive/70">
											Violations
										</div>
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
					levelNumber={52}
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
					learningGoal="Packwerk enforces package boundaries in a modular monolith. Each domain gets its own package with explicit dependencies, privacy APIs, and code ownership. CI validates boundaries automatically with bin/packwerk check."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level54ModularMonolith;
