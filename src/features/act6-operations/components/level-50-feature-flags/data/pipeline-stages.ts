import type {
	PipelineConnection,
	PipelineStage,
} from '@/components/levels/PipelineFlow';
import type { StageInspectorData } from '@/components/levels/StageInspector';

// ───────────────────────────────────────────────────────────────────
// Observe phase: no flag gate. Request flows straight into the new
// processor, which is a single point of failure with no kill switch.
// ───────────────────────────────────────────────────────────────────

// The observe topology is the system AS IT CURRENTLY EXISTS, before the
// player has built anything. There is no flag gate yet (that is what
// the build will add). The legacy processor is not a routable
// destination yet either (the controller hardcodes the new processor).
// Showing those nodes here would violate the audit-level rule "the
// observe phase visualization must only show components that exist in
// the 'before' state."
export const OBSERVE_STAGES: PipelineStage[] = [
	{
		id: 'client',
		label: 'Client',
		sublabel: 'POST /api/v1/payments',
		position: { x: 120, y: 240 },
		inspectable: true,
	},
	{
		id: 'app-server',
		label: 'App Server',
		sublabel: 'PaymentsController#create',
		// AppServer carries the broken-state energy in observe: it is
		// where the missing toggle / kill switch / scheduling would have
		// lived. Critical = whole-card pulse + ping ripple.
		variant: 'critical',
		badge: 'NO TOGGLE',
		position: { x: 440, y: 240 },
		inspectable: true,
	},
	{
		id: 'new-processor',
		label: 'New Payment Processor',
		sublabel: 'hardcoded, only path',
		variant: 'danger',
		position: { x: 760, y: 240 },
		inspectable: true,
	},
];

// Observe-state edges. Two nodes, one path: client -> app -> new
// processor. Red dots flow when the player fires a probe (single-pass
// burst), communicating "every request is at risk because the new
// processor is the only path."
export const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'client', to: 'app-server', dots: 'danger' },
	{ from: 'app-server', to: 'new-processor', dots: 'danger' },
];

// ───────────────────────────────────────────────────────────────────
// Reward phase: flag gate present. Routes traffic to either path.
// ───────────────────────────────────────────────────────────────────

export const REWARD_STAGES: PipelineStage[] = [
	{
		id: 'client',
		label: 'Client',
		sublabel: 'POST /api/v1/payments',
		position: { x: 60, y: 240 },
	},
	{
		id: 'app-server',
		label: 'App Server',
		sublabel: 'Flipper.enabled?(...)',
		position: { x: 320, y: 240 },
	},
	{
		id: 'flag-gate',
		label: 'Flag Gate',
		sublabel: 'OFF',
		variant: 'active',
		position: { x: 580, y: 240 },
	},
	{
		id: 'new-processor',
		label: 'New Payment Processor',
		sublabel: 'unused',
		variant: 'inactive',
		position: { x: 840, y: 120 },
	},
	{
		id: 'legacy-processor',
		label: 'Legacy Payment Processor',
		sublabel: 'serving 100% of traffic',
		variant: 'active',
		position: { x: 840, y: 360 },
	},
];

// In the reward state most requests are healthy: green flow on the upstream
// edges. The downstream forks (gate -> new vs gate -> legacy) start with
// idle clean dots; SCENARIO_REWARD_OVERRIDES.activeConnections decides
// which fork actually carries the request when a stress scenario fires.
export const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'client', to: 'app-server', dots: 'clean' },
	{ from: 'app-server', to: 'flag-gate', dots: 'clean' },
	{
		from: 'flag-gate',
		to: 'new-processor',
		dots: 'clean',
		sourceHandle: 'top',
		targetHandle: 'left',
	},
	{
		from: 'flag-gate',
		to: 'legacy-processor',
		dots: 'clean',
		sourceHandle: 'bottom',
		targetHandle: 'left',
	},
];

// ───────────────────────────────────────────────────────────────────
// Stage inspector data (observe phase)
// ───────────────────────────────────────────────────────────────────

// Inspector data only for nodes that actually exist in the observe
// topology. The flag-gate and legacy-processor inspectors used to live
// here but those nodes do not exist in observe (they are added by the
// build phase), so showing inspector data for them would lie about the
// "before" state.
export const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	client: {
		stageId: 'client',
		title: 'Client Request',
		description:
			'A user clicks "Pay" in the checkout flow. The browser fires `POST /api/v1/payments` with the cart total and a billing token. From here, the request hits your Rails app.',
	},
	'app-server': {
		stageId: 'app-server',
		title: 'PaymentsController#create',
		description:
			'The controller receives the request, parses params, and decides which payment processor to call. Right now, that decision is hardcoded: every request goes to NewPaymentProcessor. There is no toggle, no kill switch, no way to schedule a release.',
		code: `class PaymentsController < ApplicationController
  def create
    # Hardcoded. No flag.
    NewPaymentProcessor.charge(
      amount_cents: params[:amount_cents],
      user: Current.user
    )
  end
end`,
	},
	'new-processor': {
		stageId: 'new-processor',
		title: 'New Payment Processor',
		description:
			'A new vendor integration. Half-built, occasionally returns 500s on edge cases, and costs roughly 30 minutes of revert-and-redeploy time when it misbehaves at peak. Currently the only path the request can take.',
	},
};

// All discovery unlocks come from probes. No stage-click discoveries:
// the 1:1 PROBE_DISCOVERY_MAP rule wants probes to be the source of
// truth, and there is nothing in the observe topology that would
// uniquely surface a discovery beyond what the probes already cover.
export const STAGE_DISCOVERY_MAP: Record<string, string> = {};

// ───────────────────────────────────────────────────────────────────
// Per-probe pipeline overrides (REQUIRED by .agents/rules/pedagogy.md)
//
// When a probe fires, the orchestrator merges these overrides into the
// observe stages so the player SEES the consequence in the center panel.
// `activeConnections` drives the edge animation: matching ids light up
// with dot flow once. Edge ids follow `${from}-${to}` per PipelineFlow's
// buildEdges convention.
// ───────────────────────────────────────────────────────────────────

export interface ProbeObserveOverride {
	/** Per-stage partial state to merge with the base stage. */
	stages: Record<string, Partial<PipelineStage>>;
	/** Connection ids (`${from}-${to}`) to animate when this probe fires. */
	activeConnections: string[];
}

export const PROBE_OBSERVE_OVERRIDES: Record<string, ProbeObserveOverride> = {
	// A customer pays at peak. Their request hits a new-processor edge
	// case that fails 3% of charges. Engineering can only roll back via
	// a 30-minute redeploy. Each node carries one piece of the pain:
	// AppServer = the operational pain (stuck for 30 min), NewProcessor
	// = the customer pain (3% of charges return 500).
	'rollout-everyone': {
		stages: {
			'app-server': {
				variant: 'critical',
				badge: 'STUCK 30 MIN',
				sublabel: 'no kill switch; only fix is a full redeploy',
			},
			'new-processor': {
				variant: 'critical',
				badge: '3% FAIL',
				sublabel: 'edge case under peak load. customer charge returned 500.',
			},
		},
		activeConnections: ['client-app-server', 'app-server-new-processor'],
	},
	// A customer pays Monday afternoon -- after the deploy, before
	// Marketing's Tuesday 9:00am announcement. Without a runtime
	// toggle, the feature went live the moment the code shipped.
	// The customer hits the new processor unbeknownst to anyone who
	// scheduled the launch for Tuesday.
	'marketing-pin-time': {
		stages: {
			'app-server': {
				variant: 'critical',
				badge: 'NO TIMING CONTROL',
				sublabel: 'feature live the moment code deploys',
			},
			'new-processor': {
				variant: 'critical',
				badge: 'LIVE EARLY',
				sublabel: 'serving customers before Tuesday 9am announcement',
			},
		},
		activeConnections: ['client-app-server', 'app-server-new-processor'],
	},
	// Vendor returns 500s. There is no kill switch. Customer requests
	// are still being routed to a failing service.
	'vendor-flaky': {
		stages: {
			'app-server': {
				variant: 'critical',
				badge: 'NO KILL SWITCH',
				sublabel: 'cannot bypass the new processor',
			},
			'new-processor': {
				variant: 'critical',
				badge: 'TIMEOUT',
				sublabel: 'vendor 5xx, all customer charges failing',
			},
		},
		activeConnections: ['client-app-server', 'app-server-new-processor'],
	},
};

// ───────────────────────────────────────────────────────────────────
// Per-scenario reward overrides
//
// Same shape as PROBE_OBSERVE_OVERRIDES. The reward phase uses these
// to drive visible state changes when a stress scenario fires.
// ───────────────────────────────────────────────────────────────────

export interface ScenarioRewardOverride {
	stages: Record<string, Partial<PipelineStage>>;
	activeConnections: string[];
}

export const SCENARIO_REWARD_OVERRIDES: Record<string, ScenarioRewardOverride> =
	{
		'rollout-everyone': {
			stages: {
				'flag-gate': {
					sublabel: 'flipped OFF when 3% rate detected',
					variant: 'active',
					badge: 'KILLED <1s',
				},
				'new-processor': {
					sublabel: 'edge case bypassed',
					variant: 'inactive',
				},
				'legacy-processor': {
					sublabel: 'serving customer payment instead',
					variant: 'active',
				},
			},
			activeConnections: [
				'client-app-server',
				'app-server-flag-gate',
				'flag-gate-legacy-processor',
			],
		},
		'marketing-pin-time': {
			stages: {
				'flag-gate': {
					sublabel: 'flag OFF until Tuesday 9am',
					variant: 'active',
				},
				'new-processor': {
					sublabel: 'will go live at 9am sharp',
					variant: 'inactive',
				},
				'legacy-processor': {
					sublabel: 'serving Monday traffic',
					variant: 'active',
				},
			},
			activeConnections: [
				'client-app-server',
				'app-server-flag-gate',
				'flag-gate-legacy-processor',
			],
		},
		'vendor-flaky': {
			stages: {
				'flag-gate': {
					sublabel: 'KILLED (kill switch)',
					variant: 'active',
					badge: 'KILL',
				},
				'new-processor': {
					sublabel: 'bypassed',
					variant: 'inactive',
				},
				'legacy-processor': {
					sublabel: 'serving 100% of traffic',
					variant: 'active',
				},
			},
			activeConnections: [
				'client-app-server',
				'app-server-flag-gate',
				'flag-gate-legacy-processor',
			],
		},
		'gradual-5-percent': {
			stages: {
				'flag-gate': {
					sublabel: '5% of actors',
					variant: 'active',
				},
				'new-processor': {
					sublabel: '~5% of users',
					variant: 'active',
				},
				'legacy-processor': {
					sublabel: '~95% of users',
					variant: 'active',
				},
			},
			activeConnections: [
				'client-app-server',
				'app-server-flag-gate',
				'flag-gate-new-processor',
				'flag-gate-legacy-processor',
			],
		},
		'beta-opt-in': {
			stages: {
				'flag-gate': {
					sublabel: 'beta opt-in',
					variant: 'active',
				},
				'new-processor': {
					sublabel: 'beta_user_42 only',
					variant: 'active',
				},
				'legacy-processor': {
					sublabel: 'all other users',
					variant: 'active',
				},
			},
			activeConnections: [
				'client-app-server',
				'app-server-flag-gate',
				'flag-gate-new-processor',
				'flag-gate-legacy-processor',
			],
		},
	};
