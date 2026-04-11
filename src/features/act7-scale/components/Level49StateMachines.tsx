/**
 * Level 49: State Machines
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): Custom state diagram visualization with 5 states.
 *   All transitions shown as bidirectional red dashed arrows (anything goes).
 *   Probes show invalid transitions happening: shipped->pending, delivered->confirmed.
 *
 * Phase 2 (HOW - build): 6 steps (2 terminal + 4 OptionCard)
 *   Step 0: bundle add aasm (terminal)
 *   Step 1: Define states with AASM DSL (OptionCard)
 *   Step 2: Define transition events (OptionCard)
 *   Step 3: Add transition guards (OptionCard)
 *   Step 4: rails generate paper_trail:install && rails db:migrate (terminal)
 *   Step 5: Wire audit trail (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Same state diagram but only valid transitions
 *   shown as solid green arrows. Stress test fires valid and invalid transitions.
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getBezierPath,
	type Node,
} from '@xyflow/react';
import { ArrowRight, Shield, ShieldCheck } from 'lucide-react';
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
} from '@/components/levels/FlowDiagram';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { shuffleOptions } from '@/lib/shuffleOptions';

// ─── Types ────────────────────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';
type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface StateVizData {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	badge: string | null;
	isInitial: boolean;
}

interface TransitionEdgeData {
	[key: string]: unknown;
	active: boolean;
	label: string;
	dotColor: string;
	valid: boolean;
}

interface AnimFrame {
	states?: Record<string, Partial<StateVizData>>;
	edges?: Record<string, Partial<TransitionEdgeData>>;
}

// ─── State node positions ─────────────────────────────────────────────

const STATE_POSITIONS: Record<string, { x: number; y: number }> = {
	pending: { x: 20, y: 100 },
	confirmed: { x: 200, y: 100 },
	shipped: { x: 380, y: 100 },
	delivered: { x: 560, y: 100 },
	cancelled: { x: 200, y: 280 },
};

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_STATE: StateVizData = {
	label: '',
	flash: 'idle',
	badge: null,
	isInitial: false,
};

const DEFAULT_EDGE_DATA: TransitionEdgeData = {
	active: false,
	label: '',
	dotColor: '#a1a1aa',
	valid: false,
};

// ─── Discovery definitions ────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'backward-transition', label: 'Shipped order reverted to pending' },
	{ id: 'skip-states', label: 'Delivered order changed to confirmed' },
	{ id: 'invalid-status', label: 'Arbitrary string set as status' },
	{ id: 'no-audit-trail', label: 'No record of who changed status' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'ship-to-pending',
		label: 'Revert shipped to pending',
		command:
			'order = Order.find(1047); order.update!(status: "pending")  # was "shipped"',
		responseLines: [
			{ text: '=> true', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Order #1047 status changed: shipped -> pending.',
				color: 'yellow',
			},
			{ text: 'Customer already received tracking email.', color: 'muted' },
			{ text: 'Now shows "Pending" in their dashboard.', color: 'red' },
		],
		story: [
			'Order #1047 was shipped yesterday with tracking number.',
			'A support script accidentally runs update!(status: "pending").',
			'The order status goes backwards: shipped -> pending.',
			'Customer sees their tracked shipment revert to "Pending".',
			'No guard prevented the transition. No log of who did it.',
		],
	},
	{
		id: 'deliver-to-confirmed',
		label: 'Reset delivered to confirmed',
		command:
			'order = Order.find(892); order.update!(status: "confirmed")  # was "delivered"',
		responseLines: [
			{ text: '=> true', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Order #892 status changed: delivered -> confirmed.',
				color: 'yellow',
			},
			{
				text: "Customer's completed order vanished from delivery history.",
				color: 'red',
			},
			{ text: 'No validation prevented this backward jump.', color: 'red' },
		],
		story: [
			'Order #892 was delivered last week.',
			'A developer debugging in console sets status to "confirmed".',
			'The delivered order disappears from the customer delivery history.',
			'The customer calls support: "Where is my order?"',
			'Nobody knows the status was changed because there is no audit trail.',
		],
	},
	{
		id: 'set-invalid-status',
		label: 'Set arbitrary status string',
		command: 'Order.where(status: "shipped").update_all(status: "refunded")',
		responseLines: [
			{ text: '=> 847  # rows updated', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: '847 shipped orders now show "refunded".', color: 'yellow' },
			{ text: '"refunded" is not even a defined status.', color: 'red' },
			{
				text: 'No validation, no enum, no constraint. Any string accepted.',
				color: 'red',
			},
		],
		story: [
			'A bulk operation sets 847 orders to "refunded".',
			'"refunded" is not a valid status in the application.',
			'The orders table now contains an undefined state.',
			'Queries filtering by valid statuses miss these 847 orders.',
			'Reports show 847 "ghost" orders that match no known state.',
		],
	},
	{
		id: 'check-audit',
		label: 'Check status change history',
		command: 'Order.find(1047).versions',
		responseLines: [
			{
				text: "NoMethodError: undefined method 'versions' for Order",
				color: 'red',
			},
			{ text: '', color: 'muted' },
			{ text: 'No audit trail configured.', color: 'yellow' },
			{
				text: 'Cannot determine who changed the status or when.',
				color: 'red',
			},
			{ text: 'No PaperTrail, no versioning, no change log.', color: 'red' },
		],
		story: [
			'Support needs to know who changed Order #1047 status.',
			'They try Order.find(1047).versions to check history.',
			'NoMethodError: no versioning gem installed.',
			'The database has no record of previous values.',
			'When? Who? Why? All unknown. The change is untraceable.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'ship-to-pending': ['backward-transition'],
	'deliver-to-confirmed': ['skip-states'],
	'set-invalid-status': ['invalid-status'],
	'check-audit': ['no-audit-trail'],
};

// ─── Observe animation frames ─────────────────────────────────────────

const SHIP_PENDING_FRAMES: AnimFrame[] = [
	{
		states: {
			shipped: { flash: 'amber', badge: 'source' },
			pending: { flash: 'idle', badge: null },
		},
	},
	{
		states: {
			shipped: { flash: 'red', badge: 'shipped' },
			pending: { flash: 'red', badge: 'REVERTED!' },
		},
		edges: {
			'shipped-pending': {
				active: true,
				label: 'No guard!',
				dotColor: '#ef4444',
			},
		},
	},
	{
		states: {
			shipped: { flash: 'idle', badge: null },
			pending: { flash: 'red', badge: 'Backwards!' },
		},
		edges: { 'shipped-pending': { active: false, label: '' } },
	},
];

const DELIVER_CONFIRMED_FRAMES: AnimFrame[] = [
	{
		states: {
			delivered: { flash: 'amber', badge: 'source' },
			confirmed: { flash: 'idle', badge: null },
		},
	},
	{
		states: {
			delivered: { flash: 'red', badge: 'delivered' },
			confirmed: { flash: 'red', badge: 'JUMPED!' },
		},
		edges: {
			'delivered-confirmed': {
				active: true,
				label: 'No guard!',
				dotColor: '#ef4444',
			},
		},
	},
	{
		states: {
			delivered: { flash: 'idle', badge: null },
			confirmed: { flash: 'red', badge: 'Skipped states!' },
		},
	},
];

const INVALID_STATUS_FRAMES: AnimFrame[] = [
	{
		states: {
			shipped: { flash: 'amber', badge: '847 orders' },
		},
	},
	{
		states: {
			shipped: { flash: 'red', badge: '"refunded"?!' },
			pending: { flash: 'red', badge: 'UNKNOWN' },
			confirmed: { flash: 'red', badge: 'UNKNOWN' },
			delivered: { flash: 'red', badge: 'UNKNOWN' },
		},
	},
];

const AUDIT_FRAMES: AnimFrame[] = [
	{
		states: {
			pending: { flash: 'amber', badge: 'Who changed this?' },
		},
	},
	{
		states: {
			pending: { flash: 'red', badge: 'No versions!' },
			shipped: { flash: 'red', badge: 'No trail' },
		},
	},
];

const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'ship-to-pending': SHIP_PENDING_FRAMES,
	'deliver-to-confirmed': DELIVER_CONFIRMED_FRAMES,
	'set-invalid-status': INVALID_STATUS_FRAMES,
	'check-audit': AUDIT_FRAMES,
};

// ─── Reward animation frames ─────────────────────────────────────────

const REWARD_VALID_CONFIRM_FRAMES: AnimFrame[] = [
	{
		states: { pending: { flash: 'green', badge: 'confirm!' } },
		edges: {
			'pending-confirmed': {
				active: true,
				label: 'event: confirm',
				dotColor: '#22c55e',
				valid: true,
			},
		},
	},
	{
		states: {
			pending: { flash: 'idle', badge: null },
			confirmed: { flash: 'green', badge: 'Confirmed' },
		},
		edges: { 'pending-confirmed': { active: false, label: '' } },
	},
];

const REWARD_VALID_SHIP_FRAMES: AnimFrame[] = [
	{
		states: { confirmed: { flash: 'green', badge: 'ship!' } },
		edges: {
			'confirmed-shipped': {
				active: true,
				label: 'guard: tracking?',
				dotColor: '#22c55e',
				valid: true,
			},
		},
	},
	{
		states: {
			confirmed: { flash: 'idle', badge: null },
			shipped: { flash: 'green', badge: 'Shipped' },
		},
	},
];

const REWARD_VALID_DELIVER_FRAMES: AnimFrame[] = [
	{
		states: { shipped: { flash: 'green', badge: 'deliver!' } },
		edges: {
			'shipped-delivered': {
				active: true,
				label: 'event: deliver',
				dotColor: '#22c55e',
				valid: true,
			},
		},
	},
	{
		states: {
			shipped: { flash: 'idle', badge: null },
			delivered: { flash: 'green', badge: 'Delivered' },
		},
	},
];

const REWARD_BLOCKED_BACKWARD_FRAMES: AnimFrame[] = [
	{
		states: { shipped: { flash: 'amber', badge: 'update!(pending)' } },
	},
	{
		states: { shipped: { flash: 'red', badge: 'InvalidTransition!' } },
		edges: {
			'shipped-pending': {
				active: true,
				label: 'BLOCKED',
				dotColor: '#ef4444',
				valid: false,
			},
		},
	},
	{
		states: { shipped: { flash: 'idle', badge: 'Still shipped' } },
		edges: { 'shipped-pending': { active: false, label: '' } },
	},
];

const REWARD_BLOCKED_SKIP_FRAMES: AnimFrame[] = [
	{
		states: { pending: { flash: 'amber', badge: 'deliver!' } },
	},
	{
		states: { pending: { flash: 'red', badge: 'InvalidTransition!' } },
	},
	{
		states: { pending: { flash: 'idle', badge: 'Still pending' } },
	},
];

const REWARD_BLOCKED_GUARD_FRAMES: AnimFrame[] = [
	{
		states: { confirmed: { flash: 'amber', badge: 'ship! (no tracking)' } },
		edges: {
			'confirmed-shipped': {
				active: true,
				label: 'guard check...',
				dotColor: '#f59e0b',
				valid: true,
			},
		},
	},
	{
		states: { confirmed: { flash: 'red', badge: 'Guard failed!' } },
		edges: {
			'confirmed-shipped': {
				active: true,
				label: 'tracking_number_present? => false',
				dotColor: '#ef4444',
				valid: false,
			},
		},
	},
	{
		states: { confirmed: { flash: 'idle', badge: 'Still confirmed' } },
		edges: { 'confirmed-shipped': { active: false, label: '' } },
	},
];

const REWARD_BLOCKED_CANCEL_FRAMES: AnimFrame[] = [
	{
		states: { delivered: { flash: 'amber', badge: 'cancel!' } },
	},
	{
		states: { delivered: { flash: 'red', badge: 'InvalidTransition!' } },
	},
	{
		states: { delivered: { flash: 'idle', badge: 'Still delivered' } },
	},
];

const REWARD_BLOCKED_INVALID_STATUS_FRAMES: AnimFrame[] = [
	{
		states: {
			shipped: { flash: 'amber', badge: 'update_all("refunded")' },
		},
	},
	{
		states: {
			shipped: { flash: 'red', badge: 'AASM rejects!' },
			pending: { flash: 'red', badge: 'Protected' },
			confirmed: { flash: 'red', badge: 'Protected' },
		},
	},
	{
		states: {
			shipped: { flash: 'idle', badge: 'Still shipped' },
			pending: { flash: 'idle', badge: null },
			confirmed: { flash: 'idle', badge: null },
		},
	},
];

const REWARD_AUDIT_TRAIL_FRAMES: AnimFrame[] = [
	{
		states: {
			pending: { flash: 'green', badge: 'versions' },
			confirmed: { flash: 'green', badge: 'versions' },
		},
	},
	{
		states: {
			pending: { flash: 'green', badge: 'v1: pending' },
			confirmed: { flash: 'green', badge: 'v2: confirmed' },
			shipped: { flash: 'green', badge: 'v3: shipped' },
		},
	},
	{
		states: {
			pending: { flash: 'idle', badge: null },
			confirmed: { flash: 'idle', badge: null },
			shipped: { flash: 'idle', badge: 'Audit recorded' },
		},
	},
];

const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'valid-confirm': REWARD_VALID_CONFIRM_FRAMES,
	'valid-ship': REWARD_VALID_SHIP_FRAMES,
	'valid-deliver': REWARD_VALID_DELIVER_FRAMES,
	'backward-ship-pending': REWARD_BLOCKED_BACKWARD_FRAMES,
	'skip-to-delivered': REWARD_BLOCKED_SKIP_FRAMES,
	'ship-no-tracking': REWARD_BLOCKED_GUARD_FRAMES,
	'cancel-delivered': REWARD_BLOCKED_CANCEL_FRAMES,
	'set-invalid-status': REWARD_BLOCKED_INVALID_STATUS_FRAMES,
	'check-audit': REWARD_AUDIT_TRAIL_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	pending: {
		stageId: 'pending',
		title: 'Pending (Initial State)',
		description:
			'Created when customer completes checkout. Currently any code can set status to any other value from here. No transition rules enforced.',
	},
	confirmed: {
		stageId: 'confirmed',
		title: 'Confirmed',
		description:
			'Order payment verified. Should only be reachable from "pending". Currently any status can jump here, even "delivered" orders.',
	},
	shipped: {
		stageId: 'shipped',
		title: 'Shipped',
		description:
			'Order has tracking number and was handed to carrier. Nothing prevents this order from being set back to "pending" or any other status.',
		code: `# Current code: no guards
order = Order.find(1047)
order.update!(status: "pending")  # Works!
# shipped -> pending with no error`,
	},
	delivered: {
		stageId: 'delivered',
		title: 'Delivered (Terminal State)',
		description:
			'Customer received the package. Should be a terminal state. Currently even delivered orders can be set to "cancelled" or "pending".',
	},
	cancelled: {
		stageId: 'cancelled',
		title: 'Cancelled',
		description:
			'Should only be reachable from "pending" or "confirmed" (before shipment). Currently even delivered orders can be cancelled.',
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	shipped: 'backward-transition',
	cancelled: 'no-audit-trail',
};

// ─── Stress test scenarios ────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'valid-confirm',
		label: 'Confirm pending order',
		description: 'pending -> confirmed (valid forward transition)',
		method: 'PATCH',
		path: '/api/v1/orders/1/confirm',
		actor: 'system',
		expectedResult: 'allowed',
	},
	{
		id: 'valid-ship',
		label: 'Ship confirmed order',
		description: 'confirmed -> shipped (with tracking number)',
		method: 'PATCH',
		path: '/api/v1/orders/1/ship',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'valid-deliver',
		label: 'Mark as delivered',
		description: 'shipped -> delivered (valid forward transition)',
		method: 'PATCH',
		path: '/api/v1/orders/1/deliver',
		actor: 'system',
		expectedResult: 'allowed',
	},
	{
		id: 'backward-ship-pending',
		label: 'Revert shipped to pending',
		description: 'shipped -> pending (invalid backward transition)',
		method: 'PATCH',
		path: '/api/v1/orders/1047/revert',
		actor: 'support script',
		expectedResult: 'blocked',
	},
	{
		id: 'skip-to-delivered',
		label: 'Skip to delivered from pending',
		description: 'pending -> delivered (invalid state skip)',
		method: 'PATCH',
		path: '/api/v1/orders/1/deliver',
		actor: 'admin',
		expectedResult: 'blocked',
	},
	{
		id: 'ship-no-tracking',
		label: 'Ship without tracking number',
		description: 'confirmed -> shipped (guard fails: no tracking)',
		method: 'PATCH',
		path: '/api/v1/orders/1/ship',
		actor: 'admin',
		expectedResult: 'blocked',
	},
	{
		id: 'cancel-delivered',
		label: 'Cancel delivered order',
		description: 'delivered -> cancelled (invalid: already delivered)',
		method: 'PATCH',
		path: '/api/v1/orders/892/cancel',
		actor: 'customer',
		expectedResult: 'blocked',
	},
	{
		id: 'set-invalid-status',
		label: 'Set arbitrary status string',
		description:
			'update_all(status: "refunded") (AASM rejects non-event changes)',
		method: 'PATCH',
		path: '/api/v1/orders/bulk/status',
		actor: 'support script',
		expectedResult: 'blocked',
	},
	{
		id: 'check-audit',
		label: 'Check version history',
		description: 'order.versions shows full transition audit trail',
		method: 'GET',
		path: '/api/v1/orders/1047/versions',
		actor: 'admin',
		expectedResult: 'allowed',
	},
];

// ─── Build step definitions ───────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-aasm', title: 'Add AASM Gem' },
	{ id: 'define-states', title: 'Define States' },
	{ id: 'define-transitions', title: 'Define Transition Events' },
	{ id: 'add-guards', title: 'Add Transition Guards' },
	{ id: 'setup-paper-trail', title: 'Set Up PaperTrail' },
	{ id: 'wire-audit', title: 'Wire Audit Trail' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add aasm
	'option', // 1: define states
	'option', // 2: define transitions
	'option', // 3: add guards
	'terminal', // 4: rails generate paper_trail:install
	'option', // 5: wire audit
];

// ─── Step 0: Add AASM (Terminal) ──────────────────────────────────────

const addAasmCommands: TerminalCommand[] = [
	{
		id: 'wrong-state-machines',
		label: 'bundle add state_machines',
		command: 'bundle add state_machines',
		correct: false,
		feedback:
			'state_machines is a different gem. The most widely used state machine library for Rails uses a declarative DSL with events and guards.',
	},
	{
		id: 'correct',
		label: 'bundle add aasm',
		command: 'bundle add aasm',
		correct: true,
	},
	{
		id: 'wrong-gem-install',
		label: 'gem install aasm',
		command: 'gem install aasm',
		correct: false,
		feedback:
			'That installs system-wide, not into your project. Use bundle add to add it to the Gemfile.',
	},
];

const addAasmOutput: TerminalOutputLine[] = [
	{ text: 'Fetching aasm 5.5.0', color: 'cyan' },
	{ text: 'Installing aasm 5.5.0', color: 'muted' },
	{ text: 'Bundle complete! 14 Gemfile dependencies.', color: 'green' },
];

// ─── Step 4: Set Up PaperTrail (Terminal) ─────────────────────────────

const setupPaperTrailCommands: TerminalCommand[] = [
	{
		id: 'wrong-create-versions',
		label: 'rails generate migration CreateVersions',
		command: 'rails generate migration CreateVersions',
		correct: false,
		feedback:
			'A manual migration would miss the required columns and indexes. The gem provides a generator that creates the correct versions table schema.',
	},
	{
		id: 'correct',
		label: 'rails generate paper_trail:install && rails db:migrate',
		command: 'rails generate paper_trail:install && rails db:migrate',
		correct: true,
	},
	{
		id: 'wrong-model',
		label: 'rails generate model Version',
		command: 'rails generate model Version',
		correct: false,
		feedback:
			'The versioning gem manages the Version model internally. Use its dedicated generator to create the versions table with the correct schema.',
	},
];

const setupPaperTrailOutput: TerminalOutputLine[] = [
	{
		text: 'create  db/migrate/20260330000000_create_versions.rb',
		color: 'cyan',
	},
	{ text: '== CreateVersions: migrating ==========', color: 'muted' },
	{
		text: '-- create_table(:versions)',
		color: 'muted',
	},
	{ text: '== CreateVersions: migrated ============', color: 'green' },
];

// ─── OptionCard step options ──────────────────────────────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

const DEFINE_STATES_OPTIONS: StepOption[] = [
	{
		id: 'enum',
		name: 'enum :status, {\n  pending: 0, confirmed: 1,\n  shipped: 2, delivered: 3\n}',
		correct: false,
		feedback:
			'Enums define values but do not enforce transition rules. You need a state machine to control which transitions are valid.',
	},
	{
		id: 'correct',
		name: 'aasm column: :status do\n  state :pending, initial: true\n  state :confirmed\n  state :shipped\n  state :delivered\n  state :cancelled\nend',
		correct: true,
	},
	{
		id: 'validates',
		name: 'validates :status, inclusion: {\n  in: %w[pending confirmed shipped delivered]\n}',
		correct: false,
		feedback:
			'Validation checks the value is in a list but does not prevent invalid transitions like shipped -> pending. You need transition rules.',
	},
];

const DEFINE_TRANSITIONS_OPTIONS: StepOption[] = [
	{
		id: 'any-to-any',
		name: 'event :change_status do\n  transitions from: :any, to: :any\nend',
		correct: false,
		feedback:
			'Allowing any-to-any transitions defeats the purpose. Each event should have specific from/to pairs to enforce a valid workflow.',
	},
	{
		id: 'before-save',
		name: 'before_save :validate_transition',
		correct: false,
		feedback:
			'Custom callbacks are fragile and require manual implementation. The state machine DSL declares transitions declaratively and raises errors automatically.',
	},
	{
		id: 'correct',
		name: 'event :confirm do\n  transitions from: :pending, to: :confirmed\nend\nevent :ship do\n  transitions from: :confirmed, to: :shipped\nend\nevent :deliver do\n  transitions from: :shipped, to: :delivered\nend',
		correct: true,
	},
];

const ADD_GUARDS_OPTIONS: StepOption[] = [
	{
		id: 'correct',
		name: 'event :ship do\n  transitions from: :confirmed, to: :shipped,\n    guard: :tracking_number_present?\nend',
		correct: true,
	},
	{
		id: 'no-guard',
		name: 'event :ship do\n  transitions from: :confirmed, to: :shipped\nend',
		correct: false,
		feedback:
			'Without a guard, any confirmed order can be shipped even without a tracking number. Guards enforce business rules on transitions.',
	},
	{
		id: 'validates',
		name: 'validates :tracking_number,\n  presence: true, if: :shipped?',
		correct: false,
		feedback:
			'This validates after the fact. A guard prevents the transition from happening at all if the condition is not met.',
	},
];

const WIRE_AUDIT_OPTIONS: StepOption[] = [
	{
		id: 'no-scope',
		name: 'has_paper_trail',
		correct: false,
		feedback:
			'Tracking all changes on all columns generates excessive data. Scope it to status changes only for the audit trail.',
	},
	{
		id: 'correct',
		name: 'has_paper_trail on: [:update],\n  only: [:status]',
		correct: true,
	},
	{
		id: 'custom-callback',
		name: 'after_save :log_status_change',
		correct: false,
		feedback:
			'Custom callbacks are fragile and do not capture the full version history (who, when, before/after). The versioning gem handles this automatically.',
	},
];

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Define Valid States',
		description:
			'Order status is currently a plain string. Declare the valid states using the state machine DSL so only defined states are accepted.',
		options: DEFINE_STATES_OPTIONS,
	},
	2: {
		title: 'Define Transition Events',
		description:
			'States are declared. Now define which transitions are valid by creating events with specific from/to pairs. An order should progress forward: pending -> confirmed -> shipped -> delivered.',
		options: DEFINE_TRANSITIONS_OPTIONS,
	},
	3: {
		title: 'Add Transition Guards',
		description:
			'Transitions are defined but some need business rule checks. A shipped order must have a tracking number. How do you enforce this condition on the transition itself?',
		options: ADD_GUARDS_OPTIONS,
	},
	5: {
		title: 'Wire Audit Trail',
		description:
			'The versioning gem is installed. Now configure the Order model to track status changes so every transition is recorded with who, when, and what changed.',
		options: WIRE_AUDIT_OPTIONS,
	},
};

// ─── Terminal step map ────────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addAasmCommands, outputLines: addAasmOutput },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	{ commands: setupPaperTrailCommands, outputLines: setupPaperTrailOutput },
	null, // step 5: OptionCard
];

// ─── Code preview ─────────────────────────────────────────────────────

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/models/order.rb',
				language: 'ruby',
				code: `class Order < ApplicationRecord
  # status is a plain string column
  # No transition rules
  # No guards
  # No audit trail

  # Any code can do:
  #   order.update!(status: "anything")
  # and it just works.
end`,
				highlight: [2, 3, 4, 5],
			},
			{
				filename: 'app/services/orders/confirm_service.rb',
				language: 'ruby',
				code: `class Orders::ConfirmService < ApplicationService
  def call(order_id:)
    order = Order.find(order_id)
    order.update!(status: "confirmed")
    Result.new(order: order, success: true)
  end
end`,
				highlight: [4],
			},
		];
	}

	const files = [];

	if (completedStep >= 0) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `gem "rails", "~> 8.0.0"
gem "aasm"
gem "paper_trail"  # installed in L43`,
			highlight: [2],
		});
	}

	if (completedStep >= 1) {
		let orderCode = 'class Order < ApplicationRecord\n  include AASM\n\n';

		if (completedStep >= 3) {
			orderCode += `  aasm column: :status do
    state :pending, initial: true
    state :confirmed
    state :shipped
    state :delivered
    state :cancelled

    event :confirm do
      transitions from: :pending, to: :confirmed
    end

    event :ship do
      transitions from: :confirmed, to: :shipped,
        guard: :tracking_number_present?
    end

    event :deliver do
      transitions from: :shipped, to: :delivered
    end

    event :cancel do
      transitions from: [:pending, :confirmed],
        to: :cancelled
    end
  end`;
		} else if (completedStep >= 2) {
			orderCode += `  aasm column: :status do
    state :pending, initial: true
    state :confirmed
    state :shipped
    state :delivered
    state :cancelled

    event :confirm do
      transitions from: :pending, to: :confirmed
    end

    event :ship do
      transitions from: :confirmed, to: :shipped
    end

    event :deliver do
      transitions from: :shipped, to: :delivered
    end

    event :cancel do
      transitions from: [:pending, :confirmed],
        to: :cancelled
    end
  end`;
		} else {
			orderCode += `  aasm column: :status do
    state :pending, initial: true
    state :confirmed
    state :shipped
    state :delivered
    state :cancelled
  end`;
		}

		if (completedStep >= 5) {
			orderCode += '\n\n  has_paper_trail on: [:update], only: [:status]';
		}

		orderCode += '\nend';

		files.push({
			filename: 'app/models/order.rb',
			language: 'ruby',
			code: orderCode,
			highlight: completedStep >= 5 ? [2] : [],
		});

		// Service object uses state machine events from step 2 onward
		if (completedStep >= 2) {
			files.push({
				filename: 'app/services/orders/confirm_service.rb',
				language: 'ruby',
				code: `class Orders::ConfirmService < ApplicationService
  def call(order_id:)
    order = Order.find(order_id)
    result = order.confirm!
    Result.new(order: order, success: true)
  rescue AASM::InvalidTransition => e
    Result.new(order: order, success: false, error: e.message)
  end
end`,
				highlight: [4, 6],
			});
		}
	}

	return files;
}

// ─── Custom React Flow nodes ──────────────────────────────────────────

const StateNode = memo(function StateNode({ data }: { data: StateVizData }) {
	const flashClass =
		data.flash === 'green'
			? 'border-success bg-success/10'
			: data.flash === 'red'
				? 'border-destructive bg-destructive/10'
				: data.flash === 'amber'
					? 'border-warning bg-warning/10'
					: 'border-zinc-400 dark:border-zinc-600 bg-card';
	const labelClass =
		data.flash === 'green'
			? 'text-success'
			: data.flash === 'red'
				? 'text-destructive'
				: data.flash === 'amber'
					? 'text-warning'
					: 'text-foreground';
	return (
		<div
			className={`rounded-full border-2 px-5 py-3 text-center min-w-28 transition-all duration-300 ${flashClass} ${data.isInitial ? 'ring-2 ring-offset-2 ring-primary ring-offset-background' : ''}`}
		>
			<FlowHandles />
			<div className={`text-sm font-semibold ${labelClass}`}>{data.label}</div>
			{data.badge && (
				<div className="text-xs font-mono text-muted-foreground mt-0.5">
					{data.badge}
				</div>
			)}
		</div>
	);
});

// ─── Custom edge ──────────────────────────────────────────────────────

const TransitionEdge = memo(function TransitionEdge(props: EdgeProps) {
	const { id, sourceX, sourceY, targetX, targetY, data } = props;
	const d = (data ?? DEFAULT_EDGE_DATA) as TransitionEdgeData;

	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
	});

	const fill = d.dotColor || '#a1a1aa';
	const dots: DotConfig[] = d.active
		? [{ id: `${id}-d0`, color: fill, r: 5, dur: '1s', begin: '0s' }]
		: [];

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				style={{
					stroke: d.active ? fill : d.valid ? '#22c55e' : '#a1a1aa',
					strokeWidth: d.active ? 2.5 : 1.5,
					strokeDasharray: d.valid && !d.active ? undefined : '6 4',
				}}
			/>
			{dots.length > 0 && <AnimatedDots dots={dots} path={edgePath} />}
			{d.label && (
				<EdgeLabelRenderer>
					<div
						className="nodrag nopan pointer-events-none absolute text-xs font-mono text-foreground bg-background/90 px-1.5 py-0.5 rounded border border-border max-w-48 text-center whitespace-nowrap"
						style={{
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 16}px)`,
						}}
					>
						{d.label}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
});

const stateNodeTypes = { state: StateNode };
const stateEdgeTypes = { transition: TransitionEdge };

// ─── Valid transitions for reward phase ───────────────────────────────

const VALID_EDGES = [
	{ id: 'pending-confirmed', source: 'pending', target: 'confirmed' },
	{ id: 'confirmed-shipped', source: 'confirmed', target: 'shipped' },
	{ id: 'shipped-delivered', source: 'shipped', target: 'delivered' },
	{ id: 'pending-cancelled', source: 'pending', target: 'cancelled' },
	{ id: 'confirmed-cancelled', source: 'confirmed', target: 'cancelled' },
];

// Observe: show chaotic bidirectional edges (subset for visual clarity)
const OBSERVE_INVALID_EDGES = [
	{ id: 'shipped-pending', source: 'shipped', target: 'pending' },
	{ id: 'delivered-confirmed', source: 'delivered', target: 'confirmed' },
	{ id: 'delivered-pending', source: 'delivered', target: 'pending' },
	{ id: 'cancelled-shipped', source: 'cancelled', target: 'shipped' },
];

// ─── Main component ───────────────────────────────────────────────────

export function Level49StateMachines({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [stateVizMap, setStateVizMap] = useState<Record<string, StateVizData>>(
		{},
	);
	const [edgeVizMap, setEdgeVizMap] = useState<
		Record<string, TransitionEdgeData>
	>({});
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setStateVizMap({});
		setEdgeVizMap({});
	}, []);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.states) {
			setStateVizMap((prev) => {
				const next = { ...prev };
				for (const [id, partial] of Object.entries(frame.states ?? {})) {
					next[id] = { ...(next[id] ?? DEFAULT_STATE), ...partial };
				}
				return next;
			});
		}
		if (frame.edges) {
			setEdgeVizMap((prev) => {
				const next = { ...prev };
				for (const [id, partial] of Object.entries(frame.edges ?? {})) {
					next[id] = { ...(next[id] ?? DEFAULT_EDGE_DATA), ...partial };
				}
				return next;
			});
		}
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

	// ── Build flow nodes ──
	const flowNodes: Node[] = useMemo(() => {
		const stateNames = [
			'pending',
			'confirmed',
			'shipped',
			'delivered',
			'cancelled',
		];
		return stateNames.map((name) => {
			const pos = STATE_POSITIONS[name];
			const viz = stateVizMap[name];
			return {
				id: name,
				type: 'state',
				position: pos,
				data: {
					label: viz?.label ?? name.charAt(0).toUpperCase() + name.slice(1),
					flash: viz?.flash ?? 'idle',
					badge: viz?.badge ?? null,
					isInitial: name === 'pending',
				} satisfies StateVizData,
			};
		});
	}, [stateVizMap]);

	const flowEdges: Edge[] = useMemo(() => {
		if (isReward) {
			return VALID_EDGES.map((e) => {
				const viz = edgeVizMap[e.id];
				return {
					id: e.id,
					source: e.source,
					target: e.target,
					type: 'transition',
					data: {
						active: viz?.active ?? false,
						label: viz?.label ?? '',
						dotColor: viz?.dotColor ?? '#22c55e',
						valid: true,
					} satisfies TransitionEdgeData,
				};
			});
		}
		// Observe: show valid + invalid edges
		const allEdges = [...VALID_EDGES, ...OBSERVE_INVALID_EDGES];
		return allEdges.map((e) => {
			const isValid = VALID_EDGES.some((v) => v.id === e.id);
			const viz = edgeVizMap[e.id];
			return {
				id: e.id,
				source: e.source,
				target: e.target,
				type: 'transition',
				data: {
					active: viz?.active ?? false,
					label: viz?.label ?? '',
					dotColor: viz?.dotColor ?? (isValid ? '#a1a1aa' : '#ef4444'),
					valid: false,
				} satisfies TransitionEdgeData,
			};
		});
	}, [isReward, edgeVizMap]);

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
			message: 'State machine with guards and audit trail deployed!',
		};
	};

	const codePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Render center ──
	function renderCenter() {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					<div className="flex-1 relative">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={stateEdgeTypes}
							nodes={flowNodes}
							nodeTypes={stateNodeTypes}
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
							title="State Transition Probe"
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
						{/* Terminal steps (0 and 4) */}
						{currentStepType === 'terminal' && stepper.currentStep === 0 && (
							<TerminalChoiceStep
								commands={addAasmCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										Order status is a plain string with no transition rules. Add
										a state machine library that provides a declarative DSL for
										states, events, and guards.
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
								outputLines={addAasmOutput}
								stepKey={stepper.currentStep}
								title="Add State Machine Gem"
							/>
						)}
						{currentStepType === 'terminal' && stepper.currentStep === 4 && (
							<TerminalChoiceStep
								commands={setupPaperTrailCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										PaperTrail is already in your Gemfile from a previous level.
										Now run its generator to create the versions table, then
										migrate the database so it can start recording changes.
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
								outputLines={setupPaperTrailOutput}
								stepKey={stepper.currentStep}
								title="Set Up PaperTrail Versions Table"
							/>
						)}

						{/* OptionCard steps */}
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
											Next Step <ArrowRight className="w-4 h-4" />
										</Button>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			);
		}

		// Reward
		return (
			<div className="flex-1 flex flex-col">
				<div className="flex-1 relative">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={stateEdgeTypes}
						nodes={flowNodes}
						nodeTypes={stateNodeTypes}
					/>
				</div>
				<div className="px-6 pb-2">
					<StressTestPanel
						allowedCount={stressTest.allowedCount}
						blockedCount={stressTest.blockedCount}
						canAutoFire={stressTest.canAutoFire}
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
						<p className="text-sm text-muted-foreground leading-relaxed">
							An order went from "shipped" back to "pending". Customer support
							is flooded. Order status is a plain string column with no
							transition guards, no validation, and no audit trail.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Any code can set any status at any time. A state machine enforces
							valid transitions and records every change.
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
									Transition Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<ShieldCheck className="w-4 h-4 text-success" />
										<span className="text-foreground">
											Valid transition (passes)
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Shield className="w-4 h-4 text-destructive" />
										<span className="text-foreground">
											Invalid transition (blocked)
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
										<div className="text-xs text-success/70">Valid</div>
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
					levelName="State Machines"
					levelNumber={49}
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
					learningGoal="AASM provides a declarative DSL for state machines: define valid states, events with from/to transitions, and guards that check business rules. PaperTrail records every status change with who, when, and what."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level49StateMachines;
