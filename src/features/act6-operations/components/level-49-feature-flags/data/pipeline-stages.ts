import type {
	PipelineConnection,
	PipelineStage,
} from '@/components/levels/PipelineFlow';
import type { StageInspectorData } from '@/components/levels/StageInspector';

// ───────────────────────────────────────────────────────────────────
// Observe phase: no flag gate. Request flows straight into the new
// processor, which is a single point of failure with no kill switch.
// ───────────────────────────────────────────────────────────────────

// Observe stage positions deliberately mirror REWARD_STAGES so the layout
// is identical across phases. Only the variants/badges/sublabels differ:
// observe = broken, reward = working.
export const OBSERVE_STAGES: PipelineStage[] = [
	{
		id: 'client',
		label: 'Client',
		sublabel: 'POST /api/v1/payments',
		position: { x: 60, y: 240 },
		inspectable: true,
	},
	{
		id: 'app-server',
		label: 'App Server',
		sublabel: 'PaymentsController#create',
		variant: 'danger',
		position: { x: 320, y: 240 },
		inspectable: true,
	},
	{
		id: 'flag-gate',
		label: 'Flag Gate',
		sublabel: '(missing)',
		// Critical from the start: there is no toggle, no kill switch,
		// no way to disable the new processor without a redeploy.
		variant: 'critical',
		badge: 'MISSING',
		position: { x: 580, y: 240 },
		inspectable: true,
	},
	{
		id: 'new-processor',
		label: 'New Payment Processor',
		sublabel: '~3% fail at peak',
		variant: 'danger',
		position: { x: 840, y: 120 },
		inspectable: true,
	},
	{
		id: 'legacy-processor',
		label: 'Legacy Payment Processor',
		sublabel: '(wired, but unreachable)',
		variant: 'inactive',
		position: { x: 840, y: 360 },
		inspectable: true,
	},
];

// Observe-state edges. The flag-gate -> legacy edge exists structurally
// (the legacy processor IS wired in, just unreachable from the current
// controller) but carries no dots: nothing routes there until the player
// builds the flag gate. The other three edges carry red dots when probes
// fire, communicating "every request is at risk because the new processor
// is the only path."
export const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'client', to: 'app-server', dots: 'danger' },
	{ from: 'app-server', to: 'flag-gate', dots: 'danger' },
	{
		from: 'flag-gate',
		to: 'new-processor',
		dots: 'danger',
		sourceHandle: 'top',
		targetHandle: 'left',
	},
	{
		from: 'flag-gate',
		to: 'legacy-processor',
		// No dots: the architectural edge is present, but no traffic flows
		// here in the broken state. The static line keeps the Legacy node
		// connected to the rest of the graph so it does not float.
		sourceHandle: 'bottom',
		targetHandle: 'left',
	},
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
			'The controller receives the request, parses params, and decides which payment processor to call. Right now, that decision is hardcoded: every request goes to NewPaymentProcessor. There is no toggle.',
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
	'flag-gate': {
		stageId: 'flag-gate',
		title: 'Flag Gate (missing)',
		description:
			'In the desired state, this stage decides at runtime whether to route to the new processor or the legacy one. Right now this stage does not exist; the controller routes unconditionally.',
	},
	'new-processor': {
		stageId: 'new-processor',
		title: 'New Payment Processor',
		description:
			'A new vendor integration. Half-built, occasionally returns 500s on edge cases, and costs roughly 30 minutes of revert-and-redeploy time when it misbehaves at peak. Currently the only path the request can take.',
	},
	'legacy-processor': {
		stageId: 'legacy-processor',
		title: 'Legacy Payment Processor',
		description:
			'The battle-tested processor. Reliable but boring. In the current setup, it is unreachable: the controller does not call it. If we had a flag gate, this would be the safe fallback.',
	},
};

// Stages that, when clicked in observe phase, mark a discovery
export const STAGE_DISCOVERY_MAP: Record<string, string> = {
	'flag-gate': 'no-kill-switch',
};

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
	'rollout-everyone': {
		stages: {
			'app-server': {
				variant: 'danger',
				sublabel: 'no flag, no rollback',
			},
			'flag-gate': {
				variant: 'critical',
				badge: 'MISSING',
				sublabel: '(would have been the kill switch)',
			},
			'new-processor': {
				variant: 'critical',
				badge: 'FAIL',
				sublabel: '3% of charges 500ing',
			},
		},
		activeConnections: [
			'client-app-server',
			'app-server-flag-gate',
			'flag-gate-new-processor',
		],
	},
	'marketing-pin-time': {
		stages: {
			'app-server': {
				variant: 'danger',
				sublabel: 'looking for a toggle to flip at 9am',
			},
			'flag-gate': {
				variant: 'critical',
				badge: 'NO TOGGLE',
				sublabel: 'no flag, nothing to flip',
			},
			'new-processor': {
				variant: 'inactive',
				sublabel: 'still off, no way to turn on without redeploy',
			},
		},
		// Marketing IS firing a request: they go to the admin tooling and
		// try to flip the launch toggle. The request reaches the gate,
		// but the gate has nothing to flip, so it does NOT continue
		// downstream to the new processor. Animating only the upstream
		// edges visualizes "tried to toggle, gate had no switch."
		activeConnections: ['client-app-server', 'app-server-flag-gate'],
	},
	'vendor-flaky': {
		stages: {
			'app-server': {
				variant: 'danger',
				badge: '30min MTTR',
				sublabel: 'cannot disable feature',
			},
			'flag-gate': {
				variant: 'critical',
				badge: 'MISSING',
				sublabel: '(no kill switch exists)',
			},
			'new-processor': {
				variant: 'critical',
				badge: 'TIMEOUT',
				sublabel: 'vendor 5xx, request still routed here',
			},
		},
		activeConnections: [
			'client-app-server',
			'app-server-flag-gate',
			'flag-gate-new-processor',
		],
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
					sublabel: '100% (full launch)',
					variant: 'active',
				},
				'new-processor': {
					sublabel: 'serving 100% of traffic',
					variant: 'active',
				},
				'legacy-processor': {
					sublabel: 'unused',
					variant: 'inactive',
				},
			},
			activeConnections: [
				'client-app-server',
				'app-server-flag-gate',
				'flag-gate-new-processor',
			],
		},
		'marketing-pin-time': {
			stages: {
				'flag-gate': {
					sublabel: 'flipped at 9:00am',
					variant: 'active',
				},
				'new-processor': {
					sublabel: 'launched on schedule',
					variant: 'active',
				},
				'legacy-processor': {
					sublabel: 'unused',
					variant: 'inactive',
				},
			},
			activeConnections: [
				'client-app-server',
				'app-server-flag-gate',
				'flag-gate-new-processor',
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
		'incident-recovery': {
			stages: {
				'flag-gate': {
					sublabel: 'OFF (incident)',
					variant: 'active',
					badge: 'KILL',
				},
				'new-processor': {
					sublabel: 'no new traffic',
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
	};
