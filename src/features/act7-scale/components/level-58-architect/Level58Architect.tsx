/**
 * Level 58: The Architect (capstone)
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * The world entering this level (post-L57): a well-factored modular
 * monolith. Packages have boundaries (L55), side effects ride domain
 * events (L56), orders have a state machine (L54), clients enter through
 * the gateway (L57), deploys go through Kamal (L49), reads hit replicas
 * (L51). None of those problems exist anymore, and the capstone must not
 * pretend they do.
 *
 * The REMAINING pain, the honest reason to extract billing:
 *   1. Deploy coupling: a one-line billing fix ships the whole monolith
 *      (2-hour pipeline) while customers keep hitting the bug.
 *   2. Shared database: month-end invoicing saturates the primary and
 *      drags checkout latency for every customer.
 *   3. Shared runtime: a billing memory leak starves the Puma workers
 *      and 503s the entire storefront.
 *
 * Phase 1 (WHY - observe): custom FlowDiagram. Customer, Storefront
 *   monolith, Billing pack (same runtime), shared PostgreSQL, deploy
 *   pipeline. Three probes, one per remaining pain.
 *
 * Phase 2 (HOW - build): 6 steps. Five are architectural DECISIONS with
 *   defensible-but-flawed wrong options (extract or not; strangle vs
 *   big-bang vs database-first; data strategy; communication style;
 *   cutover control) plus one real command (the service skeleton).
 *   This is a design exercise: the artifact is the extraction plan.
 *
 * Phase 3 (ADVANTAGE - reward): the extracted topology (gateway ->
 *   flag gate -> monolith/billing service, event bus between them, two
 *   databases, two deploy targets). The three pains replay and resolve;
 *   two rollout scenarios (5% canary with parity, instant rollback)
 *   close the migration story.
 */

import type { Edge, EdgeProps, Node } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getStraightPath } from '@xyflow/react';
import { ArrowRight, GitBranch, Shield } from 'lucide-react';
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

registerLevelCode('act7-level58-architect', () =>
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

// Observe nodes: customer, storefront, billing (pack), sharedDb, pipeline.
// Reward adds: gateway, flagGate, billingSvc, billingDb, eventBus.
// The billing key means "billing pack" in observe and is NOT rendered in
// reward (the pack becomes the billingSvc node).
type ZoneKey =
	| 'customer'
	| 'storefront'
	| 'billing'
	| 'sharedDb'
	| 'pipeline'
	| 'gateway'
	| 'flagGate'
	| 'billingSvc'
	| 'billingDb'
	| 'eventBus';

type EdgeKey =
	| 'eShop' // customer <-> storefront (observe) / customer <-> gateway (reward)
	| 'eRuntime' // storefront <-> billing pack (same Puma workers)
	| 'eStoreDb' // storefront <-> shared PostgreSQL
	| 'eBillDb' // billing pack <-> shared PostgreSQL (observe)
	| 'eDeploy' // pipeline -> storefront (one deploy unit)
	| 'eGwStore' // gateway -> storefront (reward)
	| 'eGwFlag' // gateway -> flag gate (reward, billing traffic)
	| 'eFlagBill' // flag gate -> billing service (reward)
	| 'eFlagStore' // flag gate -> storefront legacy billing path (reward)
	| 'eBillOwnDb' // billing service -> billing DB (reward)
	| 'eBusOut' // storefront -> event bus (reward)
	| 'eBusIn' // event bus -> billing service (reward)
	| 'eDeployBill'; // pipeline -> billing service (reward, independent)

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
		sublabel: 'browsing + checking out',
		badge: null,
	},
	storefront: {
		label: 'Storefront (monolith)',
		flash: 'idle',
		sublabel: 'orders, inventory, notifications packs',
		badge: null,
	},
	billing: {
		label: 'Billing pack',
		flash: 'red',
		sublabel: 'same runtime, same deploy, same DB',
		badge: null,
	},
	sharedDb: {
		label: 'Shared PostgreSQL',
		flash: 'idle',
		sublabel: 'every pack, one primary',
		badge: null,
	},
	pipeline: {
		label: 'Deploy pipeline',
		flash: 'idle',
		sublabel: 'one queue for every change',
		badge: null,
	},
};

const REWARD_ZONES: Record<string, ZoneVizState> = {
	customer: {
		label: 'Customers',
		flash: 'green',
		sublabel: 'same URLs as always',
		badge: null,
	},
	gateway: {
		label: 'Gateway',
		flash: 'green',
		sublabel: 'stable entry point',
		badge: null,
	},
	flagGate: {
		label: 'Flag gate',
		flash: 'green',
		sublabel: 'billing traffic split',
		badge: '5%',
	},
	storefront: {
		label: 'Storefront (monolith)',
		flash: 'green',
		sublabel: 'still serves 95% of billing',
		badge: null,
	},
	billingSvc: {
		label: 'Billing Service',
		flash: 'green',
		sublabel: 'own runtime, own deploys',
		badge: null,
	},
	sharedDb: {
		label: 'Storefront DB',
		flash: 'green',
		sublabel: 'no billing batch load',
		badge: null,
	},
	billingDb: {
		label: 'Billing DB',
		flash: 'green',
		sublabel: 'backfilled + dual-written',
		badge: null,
	},
	eventBus: {
		label: 'Event bus',
		flash: 'idle',
		sublabel: 'order facts flow both ways',
		badge: null,
	},
	pipeline: {
		label: 'Deploy pipeline',
		flash: 'green',
		sublabel: 'two independent targets',
		badge: null,
	},
};

// ─── Discovery definitions ────────────────────────────────────────────

export const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'deploy-coupled',
		label: 'One deploy queue for every change',
	},
	{
		id: 'db-contention',
		label: 'Billing batch work drags checkout',
	},
	{
		id: 'blast-radius',
		label: 'A billing crash takes the storefront down',
	},
];

// ─── Probe definitions ────────────────────────────────────────────────

export const PROBES: ProbeConfig[] = [
	{
		id: 'hotfix-deploy',
		label: 'Ship a one-line billing hotfix',
		command: 'git push origin billing-fee-fix && kamal deploy',
		responseLines: [
			{ text: 'Building image for the WHOLE monolith...', color: 'yellow' },
			{ text: '47 unrelated commits ride along.', color: 'yellow' },
			{
				text: 'CI 45min + staging 30min + canary 45min = ~2 hours.',
				color: 'red',
			},
			{ text: '', color: 'muted' },
			{
				text: 'Meanwhile: customers keep hitting the wrong fee.',
				color: 'red',
			},
		],
		story: [
			'A rounding bug is overcharging a checkout fee by a few cents, every order.',
			'The fix is one line in the billing pack.',
			'But billing has no deploy of its own: shipping it means building, testing, and canarying the entire monolith, with 47 unrelated commits along for the ride.',
			'Two hours pass before the fix reaches customers who are being overcharged the whole time.',
			'Package boundaries made the code clean; they did nothing for the deploy unit.',
		],
	},
	{
		id: 'month-end-invoicing',
		label: 'Run month-end invoicing during peak',
		command: 'bin/rails billing:generate_invoices  # 2M orders',
		responseLines: [
			{ text: 'Invoicing 2,000,000 orders...', color: 'yellow' },
			{ text: 'Shared primary: CPU 94%, IO saturated.', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'Checkout p95: 180ms -> 2.1s.', color: 'red' },
			{
				text: 'Every customer pays for billing’s batch job.',
				color: 'red',
			},
		],
		story: [
			'Month-end: the billing pack generates two million invoices.',
			'The batch hammers the shared primary: CPU and IO saturate.',
			'Checkout and browsing share that database. Their p95 latency goes from 180ms to 2.1 seconds.',
			'Replicas absorb reads, but invoicing writes, and writes only go one place.',
			'Customers who never touched an invoice feel every month-end.',
		],
	},
	{
		id: 'billing-oom',
		label: 'A billing bug leaks memory at noon',
		command: 'watch kamal app logs --grep "Out of memory"',
		responseLines: [
			{ text: 'billing: invoice PDF renderer leaking ~40MB/min', color: 'red' },
			{ text: 'Puma workers OOM-killed one by one.', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'Storefront 503. Browsing down. Checkout down.', color: 'red' },
			{
				text: 'The bug is in billing; the outage is everywhere.',
				color: 'red',
			},
		],
		story: [
			'A PDF rendering bug in the billing pack starts leaking memory at noon peak.',
			'Billing shares the Puma workers with everything else.',
			'One by one the workers are OOM-killed; the whole storefront starts returning 503s.',
			'Browsing and checkout have no bug, and they are down anyway.',
			'Shared runtime means shared blast radius, no matter how clean the code boundaries are.',
		],
	},
];

export const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'hotfix-deploy': ['deploy-coupled'],
	'month-end-invoicing': ['db-contention'],
	'billing-oom': ['blast-radius'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Only observe zones/edges appear here. The gateway, flag gate, billing
// service, billing DB, and event bus do not exist yet.

const HOTFIX_FRAMES: AnimFrame[] = [
	{
		zones: {
			billing: { flash: 'amber', sublabel: 'one-line fix ready', badge: 'FIX' },
			customer: {
				flash: 'red',
				sublabel: 'still overcharged every order',
				badge: null,
			},
		},
	},
	{
		zones: {
			pipeline: {
				flash: 'amber',
				sublabel: 'building the WHOLE monolith',
				badge: '47 commits',
			},
		},
		edges: {
			eDeploy: {
				active: true,
				reverse: false,
				label: 'full pipeline ~2h',
				dotColor: '#f59e0b',
			},
		},
	},
	{
		zones: {
			pipeline: {
				flash: 'red',
				sublabel: 'CI + staging + canary',
				badge: '2h',
			},
			storefront: {
				flash: 'amber',
				sublabel: 'whole app redeploying for one line',
				badge: null,
			},
			customer: {
				flash: 'red',
				sublabel: 'overcharged for 2 more hours',
				badge: 'FEE BUG',
			},
		},
		edges: { eDeploy: { active: false, label: '' } },
	},
];

const INVOICING_FRAMES: AnimFrame[] = [
	{
		zones: {
			billing: {
				flash: 'amber',
				sublabel: 'invoicing 2M orders...',
				badge: 'BATCH',
			},
		},
		edges: {
			eBillDb: {
				active: true,
				reverse: false,
				label: 'invoice writes flood the primary',
				dotColor: '#ef4444',
			},
		},
	},
	{
		zones: {
			sharedDb: {
				flash: 'red',
				sublabel: 'CPU 94%, IO saturated',
				badge: '94%',
			},
			storefront: {
				flash: 'amber',
				sublabel: 'checkout queries queueing',
				badge: null,
			},
		},
		edges: {
			eStoreDb: {
				active: true,
				reverse: true,
				label: 'checkout p95: 2.1s',
				dotColor: '#ef4444',
			},
		},
	},
	{
		zones: {
			customer: {
				flash: 'red',
				sublabel: 'checkout crawling at month-end',
				badge: '2.1s',
			},
		},
		edges: {
			eShop: {
				active: true,
				reverse: true,
				label: 'slow for everyone',
				dotColor: '#ef4444',
			},
			eBillDb: { active: false, label: '' },
			eStoreDb: { active: false, label: '' },
		},
	},
];

const OOM_FRAMES: AnimFrame[] = [
	{
		zones: {
			billing: {
				flash: 'red',
				sublabel: 'PDF renderer leaking 40MB/min',
				badge: 'LEAK',
			},
		},
	},
	{
		zones: {
			storefront: {
				flash: 'red',
				sublabel: 'Puma workers OOM-killed',
				badge: 'OOM',
			},
		},
		edges: {
			eRuntime: {
				active: true,
				reverse: false,
				label: 'same workers, same fate',
				dotColor: '#ef4444',
			},
		},
	},
	{
		zones: {
			customer: {
				flash: 'red',
				sublabel: 'entire storefront 503',
				badge: '503',
			},
			storefront: { flash: 'red', sublabel: 'down: no bug of its own' },
		},
		edges: {
			eShop: {
				active: true,
				reverse: true,
				label: '503 Service Unavailable',
				dotColor: '#ef4444',
			},
			eRuntime: { active: false, label: '' },
		},
	},
];

export const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'hotfix-deploy': HOTFIX_FRAMES,
	'month-end-invoicing': INVOICING_FRAMES,
	'billing-oom': OOM_FRAMES,
};

// ─── Reward animation frames ──────────────────────────────────────────

const REWARD_HOTFIX_FRAMES: AnimFrame[] = [
	{
		zones: {
			billingSvc: {
				flash: 'amber',
				sublabel: 'same one-line fix ready',
				badge: 'FIX',
			},
		},
	},
	{
		zones: {
			pipeline: {
				flash: 'green',
				sublabel: 'building billing service only',
				badge: '3 min',
			},
			storefront: { flash: 'green', sublabel: 'untouched, still serving' },
		},
		edges: {
			eDeployBill: {
				active: true,
				reverse: false,
				label: 'independent deploy',
				dotColor: '#22c55e',
			},
		},
	},
	{
		zones: {
			billingSvc: {
				flash: 'green',
				sublabel: 'fix live in minutes',
				badge: null,
			},
			customer: { flash: 'green', sublabel: 'correct fee, same afternoon' },
		},
		edges: { eDeployBill: { active: false, label: '' } },
	},
];

const REWARD_INVOICING_FRAMES: AnimFrame[] = [
	{
		zones: {
			billingSvc: {
				flash: 'amber',
				sublabel: 'invoicing 2M orders...',
				badge: 'BATCH',
			},
		},
		edges: {
			eBillOwnDb: {
				active: true,
				reverse: false,
				label: 'writes hit billing DB only',
				dotColor: '#22c55e',
			},
		},
	},
	{
		zones: {
			billingDb: {
				flash: 'amber',
				sublabel: 'busy, and that is fine',
				badge: null,
			},
			sharedDb: { flash: 'green', sublabel: 'no batch load', badge: null },
			storefront: { flash: 'green', sublabel: 'checkout p95 steady' },
		},
	},
	{
		zones: {
			customer: {
				flash: 'green',
				sublabel: 'checkout 180ms at month-end',
				badge: '180ms',
			},
			billingSvc: { flash: 'green', sublabel: 'invoicing done', badge: null },
		},
		edges: { eBillOwnDb: { active: false, label: '' } },
	},
];

const REWARD_OOM_FRAMES: AnimFrame[] = [
	{
		zones: {
			billingSvc: {
				flash: 'red',
				sublabel: 'same PDF leak, same noon peak',
				badge: 'LEAK',
			},
		},
	},
	{
		zones: {
			billingSvc: {
				flash: 'red',
				sublabel: 'billing service down',
				badge: '503',
			},
			storefront: { flash: 'green', sublabel: 'unaffected: own workers' },
			gateway: {
				flash: 'amber',
				sublabel: 'billing section -> fallback',
				badge: 'fallback',
			},
		},
		edges: {
			eFlagBill: {
				active: true,
				reverse: false,
				label: 'crashes alone',
				dotColor: '#ef4444',
			},
		},
	},
	{
		zones: {
			customer: {
				flash: 'green',
				sublabel: 'shopping fine; billing tile "unavailable"',
				badge: null,
			},
			gateway: { flash: 'green', sublabel: 'degraded gracefully' },
		},
		edges: {
			eShop: {
				active: true,
				reverse: true,
				label: '200 OK (partial)',
				dotColor: '#22c55e',
			},
			eFlagBill: { active: false, label: '' },
		},
	},
];

const REWARD_CANARY_FRAMES: AnimFrame[] = [
	{
		zones: {
			flagGate: {
				flash: 'amber',
				sublabel: 'billing traffic split',
				badge: '5%',
			},
		},
		edges: {
			eGwFlag: {
				active: true,
				reverse: false,
				label: 'billing requests',
				dotColor: '#22c55e',
			},
		},
	},
	{
		zones: {
			billingSvc: { flash: 'green', sublabel: 'serving 5%', badge: '5%' },
			storefront: { flash: 'green', sublabel: 'serving 95%', badge: '95%' },
		},
		edges: {
			eFlagBill: {
				active: true,
				reverse: false,
				label: '5% canary',
				dotColor: '#22c55e',
			},
			eFlagStore: {
				active: true,
				reverse: false,
				label: '95% legacy path',
				dotColor: '#22c55e',
			},
		},
	},
	{
		zones: {
			flagGate: {
				flash: 'green',
				sublabel: 'parity: results match on both paths',
				badge: 'PARITY OK',
			},
		},
		edges: {
			eGwFlag: { active: false, label: '' },
			eFlagBill: { active: false, label: '' },
			eFlagStore: { active: false, label: '' },
		},
	},
];

const REWARD_ROLLBACK_FRAMES: AnimFrame[] = [
	{
		zones: {
			flagGate: {
				flash: 'red',
				sublabel: 'parity check found a mismatch',
				badge: 'MISMATCH',
			},
			billingSvc: { flash: 'amber', sublabel: 'rounding differs on one path' },
		},
	},
	{
		zones: {
			flagGate: {
				flash: 'amber',
				sublabel: 'flag -> 0%. No deploy.',
				badge: '0%',
			},
		},
		edges: {
			eFlagStore: {
				active: true,
				reverse: false,
				label: '100% back to monolith',
				dotColor: '#22c55e',
			},
		},
	},
	{
		zones: {
			customer: { flash: 'green', sublabel: 'never noticed a thing' },
			storefront: {
				flash: 'green',
				sublabel: 'serving 100% again',
				badge: '100%',
			},
			billingSvc: {
				flash: 'idle',
				sublabel: 'fix the mismatch, then retry the canary',
				badge: null,
			},
		},
		edges: { eFlagStore: { active: false, label: '' } },
	},
];

export const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'hotfix-deploy': REWARD_HOTFIX_FRAMES,
	'month-end-invoicing': REWARD_INVOICING_FRAMES,
	'billing-oom': REWARD_OOM_FRAMES,
	'canary-5-percent': REWARD_CANARY_FRAMES,
	'instant-rollback': REWARD_ROLLBACK_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	billing: {
		stageId: 'billing',
		title: 'Billing pack',
		description:
			'The code boundaries are clean: enforced dependencies, a public API, its own owners. But packages share everything physical: the Puma workers, the database, and the deploy pipeline. Clean code, shared fate.',
	},
	storefront: {
		stageId: 'storefront',
		title: 'Storefront (monolith)',
		description:
			'Orders, inventory, and notifications packs. They have no billing bugs and no billing batch jobs, and they still inherit billing’s outages, latency, and deploy freezes.',
	},
	sharedDb: {
		stageId: 'sharedDb',
		title: 'Shared PostgreSQL',
		description:
			'One primary for every pack. Replicas absorb reads, but billing’s month-end invoicing is write-heavy, and writes all land here, next to checkout’s.',
	},
	pipeline: {
		stageId: 'pipeline',
		title: 'Deploy pipeline',
		description:
			'One deploy unit. Any change to any pack ships everything: full CI, staging, and canary. A one-line billing fix waits behind the same two-hour pipeline as a storefront redesign.',
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {};

// ─── Stress test scenarios (reward) ───────────────────────────────────

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'hotfix-deploy',
		label: 'Ship a one-line billing hotfix',
		description: 'Billing deploys alone in minutes; monolith untouched',
		method: 'POST',
		path: 'kamal deploy (billing service only)',
		actor: 'billing team',
		expectedResult: 'allowed',
		story: [
			'Same rounding bug, same one-line fix.',
			'Billing now has its own deploy target: the pipeline builds and ships only the billing service.',
			'Three minutes later the fix is live. The monolith never redeployed.',
			'Customers stop being overcharged the same afternoon, not two hours later.',
		],
	},
	{
		id: 'month-end-invoicing',
		label: 'Run month-end invoicing during peak',
		description: 'Batch writes hit the billing DB; checkout stays at 180ms',
		method: 'POST',
		path: 'billing service: generate_invoices (2M orders)',
		actor: 'billing team',
		expectedResult: 'allowed',
		story: [
			'Same month-end, same two million invoices.',
			'The batch now writes to the billing database, which was backfilled and kept in sync during the migration.',
			'The storefront database never sees the load; checkout p95 holds at 180ms.',
			'Billing’s busiest day is invisible to everyone else.',
		],
	},
	{
		id: 'billing-oom',
		label: 'A billing bug leaks memory at noon',
		description:
			'Billing service crashes alone; storefront degrades gracefully',
		method: 'GET',
		path: '/api/v1/dashboard (billing section down)',
		actor: 'customer',
		expectedResult: 'allowed',
		story: [
			'Same PDF-rendering leak, same noon peak.',
			'The leak now kills the billing service’s workers, and only those.',
			'Browsing and checkout run on their own runtime and never notice.',
			'The gateway serves the billing dashboard section as "unavailable" while everything else renders.',
		],
	},
	{
		id: 'canary-5-percent',
		label: 'Route a 5% canary to the service',
		description: 'Flag gate splits billing traffic; parity metrics compared',
		method: 'POST',
		path: 'flag: billing_service -> 5% of actors',
		actor: 'billing team',
		expectedResult: 'allowed',
		story: [
			'The migration cutover begins: the flag gate sends 5% of billing traffic to the new service.',
			'The other 95% keeps flowing through the monolith path, exactly as before.',
			'Both paths report the same metrics; a parity check compares results per request.',
			'Only sustained parity earns the next percentage step.',
		],
	},
	{
		id: 'instant-rollback',
		label: 'Parity fails: flip the flag back',
		description: 'Mismatch found; flag to 0% instantly, no deploy',
		method: 'POST',
		path: 'flag: billing_service -> 0%',
		actor: 'billing team',
		expectedResult: 'blocked',
		story: [
			'The parity check finds a rounding mismatch between the two paths.',
			'The flag drops to 0%: every billing request routes back through the monolith, instantly, with no deploy.',
			'Customers never see the discrepancy; the canary bought information, not an outage.',
			'Fix the mismatch, then retry the canary. That is the whole point of the gradual path.',
		],
	},
];

// ─── Build step definitions ───────────────────────────────────────────
// Five architectural decisions + one real command. The wrong options are
// defensible strategies with real flaws, not API trivia.

export const STEP_DEFS: StepDef[] = [
	{ id: 'extract-or-not', title: 'Decide: Does Billing Leave?' },
	{ id: 'migration-shape', title: 'Decide: What Moves First?' },
	{ id: 'service-skeleton', title: 'Create the Service Skeleton' },
	{ id: 'data-strategy', title: 'Decide: The Data Migration' },
	{ id: 'communication', title: 'Decide: How the Two Halves Talk' },
	{ id: 'cutover-control', title: 'Decide: The Cutover' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'option',
	'option',
	'terminal',
	'option',
	'option',
	'option',
];

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

// Step 0: the judgment call. Extraction is earned by evidence, not fashion.
const EXTRACT_OPTIONS: StepOption[] = [
	{
		id: 'split-everything',
		name: 'Split the whole monolith into microservices:\none service per pack (orders, inventory,\nnotifications, billing), all at once.',
		correct: false,
		feedback:
			'The evidence points at ONE pack: billing has the divergent deploy cadence, the batch workload, and the blast radius. The other packs share fate happily. Splitting everything trades one bottleneck for a distributed dozen: network failures, versioned contracts, and operational surface everywhere, without evidence any other pack needs it.',
	},
	{
		id: 'stay-and-scale',
		name: 'Keep everything in the monolith and buy\nheadroom: bigger boxes, more replicas,\nnicer batch scheduling for invoicing.',
		correct: false,
		feedback:
			'Capacity does not unshare a deploy pipeline or a runtime. The hotfix still ships 47 commits, the leak still kills every Puma worker, and month-end writes still land on the primary no matter how big it is. These pains are structural, not capacity.',
	},
	{
		id: 'correct',
		name: 'Extract billing, and only billing: it has\nits own deploy cadence, its own heavy\nworkload, and a blast radius the rest of\nthe app should not share.',
		correct: true,
	},
];

// Step 1: the shape of the migration.
const SHAPE_OPTIONS: StepOption[] = [
	{
		id: 'big-bang',
		name: 'Big bang: freeze billing changes, rebuild\nit as a service, switch everything over\nin one release weekend.',
		correct: false,
		feedback:
			'Rewrites look easy to specify and rarely are: much of the existing behavior is undocumented edge cases you will only rediscover in production. A one-weekend cutover bets the company on the riskiest possible moment, with no way to learn gradually and no cheap way back.',
	},
	{
		id: 'database-first',
		name: 'Database first: move the billing tables\nto a new database now; move the code\nlater once the data is settled.',
		correct: false,
		feedback:
			'Moving the data out from under code that still lives in the monolith creates cross-database queries overnight, in every place billing data joins storefront data. The code boundary exists and is enforced; it is the safer thing to move first.',
	},
	{
		id: 'correct',
		name: 'Strangle it at the seams that already\nexist: stand up an empty service behind\nthe gateway and the event bus, move\nbehavior over incrementally, monolith\nserves 100% until the new path earns\ntraffic.',
		correct: true,
	},
];

// Step 2 (terminal): the second deployable in the app's history.
export const SKELETON_COMMANDS: TerminalCommand[] = [
	{
		id: 'wrong-engine',
		label: 'bin/rails plugin new billing --mountable',
		command: 'bin/rails plugin new billing --mountable',
		correct: false,
		feedback:
			'A mountable engine still boots inside the monolith’s process: same workers, same deploys, same fate. The whole point is a separately deployable runtime.',
	},
	{
		id: 'wrong-copy',
		label: 'mkdir billing_service && cp -r packs/billing billing_service/',
		command: 'mkdir billing_service && cp -r packs/billing billing_service/',
		correct: false,
		feedback:
			'Copying the pack copies code, not an application: no boot process, no config, no database wiring, no deploy target. The service needs to be a real app that happens to start out mostly empty.',
	},
	{
		id: 'correct',
		label: 'rails new billing_service --api --database=postgresql',
		command: 'rails new billing_service --api --database=postgresql',
		correct: true,
	},
];

const SKELETON_OUTPUT: TerminalOutputLine[] = [
	{ text: 'create  billing_service/app', color: 'green' },
	{ text: 'create  billing_service/config/database.yml', color: 'green' },
	{
		text: 'A second deployable app exists. It serves nothing yet.',
		color: 'cyan',
	},
];

// Step 3: the data migration strategy.
const DATA_OPTIONS: StepOption[] = [
	{
		id: 'overnight-script',
		name: 'One-night migration: schedule a\nmaintenance window, run a script that\ncopies all billing tables, point the\nservice at the new database in the\nmorning.',
		correct: false,
		feedback:
			'Fifty million rows do not copy in a night, and if morning arrives with a mismatch there is no way back: writes have already landed on one side. Irreversible one-shot data moves are the data version of the big-bang cutover.',
	},
	{
		id: 'correct',
		name: 'Backfill + dual-write + verify: copy\nhistory in batches, write every new\nbilling record to BOTH databases during\nthe migration, and run an automated\nparity check. Reads cut over only after\nsustained parity.',
		correct: true,
	},
	{
		id: 'share-forever',
		name: 'Skip the data migration: the billing\nservice connects to the shared\nPostgreSQL. One database, no copying,\nno consistency worries.',
		correct: false,
		feedback:
			'A service on a shared database is not independent: month-end invoicing still saturates the primary checkout uses, and every billing migration still locks tables the storefront reads. This keeps the exact contention you are extracting to escape.',
	},
];

// Step 4: how monolith and service communicate.
const COMMS_OPTIONS: StepOption[] = [
	{
		id: 'sync-calls',
		name: 'Synchronous HTTP: checkout calls the\nbilling service and waits, for every\npayment step.',
		correct: false,
		feedback:
			'A blocking call re-couples checkout’s availability to billing’s: the noon leak would take checkout down again, just over HTTP instead of shared memory. That re-creates the blast radius this extraction removes.',
	},
	{
		id: 'read-the-db',
		name: 'The service reads the monolith’s\ndatabase directly for order data, and\nthe monolith reads billing’s tables\nback.',
		correct: false,
		feedback:
			'Reaching into each other’s tables couples both sides to schemas they do not own: either side’s migration breaks the other at runtime. This is the database version of reaching past a package boundary into private models.',
	},
	{
		id: 'correct',
		name: 'The seams carry it: order facts flow to\nbilling as domain events over the bus;\nclient traffic reaches billing through\nthe gateway. Neither side blocks on the\nother.',
		correct: true,
	},
];

// Step 5: cutover control.
const CUTOVER_OPTIONS: StepOption[] = [
	{
		id: 'deploy-and-switch',
		name: 'When the service is ready, change the\ngateway route and deploy: 100% of\nbilling traffic moves at once.',
		correct: false,
		feedback:
			'One deploy moves every customer onto a path that has never taken production load, and moving them back requires another deploy. The first bad edge case lands on everyone at once.',
	},
	{
		id: 'parallel-forever',
		name: 'Run both paths indefinitely and compare\nresults in a spreadsheet each week;\ncut over whenever it feels stable.',
		correct: false,
		feedback:
			'A parallel run without defined finish criteria never finishes: "feels stable" is not a threshold anyone can act on, and the dual-write tax runs forever. Decide up front what evidence ends the migration.',
	},
	{
		id: 'correct',
		name: 'Flag-gated percentages with exit\ncriteria: 5% -> 25% -> 50% -> 100%,\neach step held until the parity check\nand error budget stay clean; the flag\nflips to 0% instantly if they do not.',
		correct: true,
	},
];

// ─── Option step config map ───────────────────────────────────────────

export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	0: {
		title: 'Decide: Does Billing Leave?',
		description:
			'Three probes, three structural pains, all pointing at one pack. Extraction is a cost, not a victory lap: what does the evidence actually justify?',
		options: EXTRACT_OPTIONS,
	},
	1: {
		title: 'Decide: What Moves First?',
		description:
			'Billing is leaving. There is more than one way to move a load-bearing wall. Which shape keeps customers safe the whole way?',
		options: SHAPE_OPTIONS,
	},
	3: {
		title: 'Decide: The Data Migration',
		description:
			'Fifty million billing rows live in the shared database, with new ones arriving every second. How does the data cross?',
		options: DATA_OPTIONS,
	},
	4: {
		title: 'Decide: How the Two Halves Talk',
		description:
			'Checkout lives in the monolith; payment recording moves to the service. They must exchange facts without inheriting each other’s failures.',
		options: COMMS_OPTIONS,
	},
	5: {
		title: 'Decide: The Cutover',
		description:
			'The service works, the data is in sync. Real customer traffic has to move. What controls the switch?',
		options: CUTOVER_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	null,
	null,
	{ commands: SKELETON_COMMANDS, outputLines: SKELETON_OUTPUT },
	null,
	null,
	null,
];

// ─── Code preview: the extraction plan grows with each decision ──────

const PLAN_HEADER = `# Billing Extraction Plan
#
# Evidence (from the observe phase):
# - a one-line fix waits ~2h behind the full monolith pipeline
# - month-end invoicing drags checkout p95 from 180ms to 2.1s
# - a billing memory leak 503s the entire storefront
`;

const PLAN_DECISION_1 = `
## 1. Scope
Extract billing, and only billing. The other packs share
fate without pain; there is no evidence for splitting them.
(The monolith stays a monolith: smaller, not scattered.)
`;

const PLAN_DECISION_2 = `
## 2. Shape
Strangler fig at the existing seams. The gateway already
owns client traffic; the event bus already carries order
facts. Stand the service up empty behind both; the monolith
serves 100% until the new path earns traffic step by step.
`;

const PLAN_DECISION_3 = `
## 3. Skeleton
\`rails new billing_service --api --database=postgresql\`
A second deployable app with its own database config, its
own Puma workers, and its own Kamal deploy target.
`;

const PLAN_DECISION_4 = `
## 4. Data
Backfill history in batches. Dual-write every new billing
record to both databases for the whole migration window.
An automated parity job compares the two sides; reads cut
over only after sustained parity.
`;

const PLAN_DECISION_5 = `
## 5. Communication
Order facts flow to billing as domain events over the bus.
Client traffic reaches billing through the gateway. No
synchronous checkout -> billing calls; no reading each
other's tables. Neither side can take the other down.
`;

const PLAN_DECISION_6 = `
## 6. Cutover
Flag-gated: 5% -> 25% -> 50% -> 100% of billing traffic.
Each step holds until the parity check and the error
budget stay clean. Any mismatch: flag to 0%, instantly,
no deploy. Exit criteria decided before the first percent.
`;

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'packs/billing/package.yml',
				language: 'yaml',
				code: `# Clean boundaries since the modular monolith work:
enforce_dependencies: true
enforce_privacy: true
dependencies:
  - packs/core

# The boundary is code-deep only. Billing still shares:
#   - the Puma workers   (a leak kills everyone)
#   - the database       (a batch drags everyone)
#   - the deploy unit    (a fix waits on everyone)`,
				highlight: [7, 8, 9, 10],
			},
			{
				filename: 'config/deploy.yml',
				language: 'yaml',
				code: `service: myapp   # ONE deploy unit for every pack

servers:
  web:
    - 192.0.2.10
    - 192.0.2.11

# Any change to any pack ships this whole service:
# full CI + staging + canary, ~2 hours, every time.`,
				highlight: [1, 8, 9],
			},
		];
	}

	const planParts = [PLAN_HEADER];
	if (completedStep >= 0) planParts.push(PLAN_DECISION_1);
	if (completedStep >= 1) planParts.push(PLAN_DECISION_2);
	if (completedStep >= 2) planParts.push(PLAN_DECISION_3);
	if (completedStep >= 3) planParts.push(PLAN_DECISION_4);
	if (completedStep >= 4) planParts.push(PLAN_DECISION_5);
	if (completedStep >= 5) planParts.push(PLAN_DECISION_6);

	const files = [
		{
			filename: 'docs/architecture/billing-extraction.md',
			language: 'markdown',
			code: planParts.join(''),
		},
	];

	if (completedStep >= 2) {
		files.push({
			filename: 'billing_service/config/database.yml',
			language: 'yaml',
			code: `production:
  adapter: postgresql
  database: billing_production
  # Its own database. Backfill + dual-write keep it in
  # sync with the monolith during the migration window.`,
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
	storefront: 'SF',
	billing: 'BP',
	sharedDb: 'DB',
	pipeline: 'CI',
	gateway: 'GW',
	flagGate: 'FG',
	billingSvc: 'BS',
	billingDb: 'BD',
	eventBus: 'EV',
};

const ArchZoneNode = memo(function ArchZoneNode({
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

const ArchEdge = memo(function ArchEdge(props: EdgeProps) {
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

const archNodeTypes = { arch: ArchZoneNode };
const archEdgeTypes = { arch: ArchEdge };

const OBSERVE_POSITIONS: Partial<Record<ZoneKey, { x: number; y: number }>> = {
	customer: { x: 30, y: 30 },
	pipeline: { x: 430, y: 30 },
	storefront: { x: 210, y: 160 },
	billing: { x: 450, y: 160 },
	sharedDb: { x: 320, y: 310 },
};

const OBSERVE_EDGE_DEFS: { id: EdgeKey; source: ZoneKey; target: ZoneKey }[] = [
	{ id: 'eShop', source: 'customer', target: 'storefront' },
	{ id: 'eDeploy', source: 'pipeline', target: 'storefront' },
	{ id: 'eRuntime', source: 'storefront', target: 'billing' },
	{ id: 'eStoreDb', source: 'storefront', target: 'sharedDb' },
	{ id: 'eBillDb', source: 'billing', target: 'sharedDb' },
];

const REWARD_POSITIONS: Partial<Record<ZoneKey, { x: number; y: number }>> = {
	customer: { x: 40, y: 20 },
	gateway: { x: 40, y: 150 },
	flagGate: { x: 250, y: 150 },
	pipeline: { x: 470, y: 20 },
	storefront: { x: 180, y: 290 },
	billingSvc: { x: 470, y: 200 },
	eventBus: { x: 340, y: 400 },
	sharedDb: { x: 40, y: 420 },
	billingDb: { x: 540, y: 350 },
};

const REWARD_EDGE_DEFS: { id: EdgeKey; source: ZoneKey; target: ZoneKey }[] = [
	{ id: 'eShop', source: 'customer', target: 'gateway' },
	{ id: 'eGwStore', source: 'gateway', target: 'storefront' },
	{ id: 'eGwFlag', source: 'gateway', target: 'flagGate' },
	{ id: 'eFlagBill', source: 'flagGate', target: 'billingSvc' },
	{ id: 'eFlagStore', source: 'flagGate', target: 'storefront' },
	{ id: 'eStoreDb', source: 'storefront', target: 'sharedDb' },
	{ id: 'eBillOwnDb', source: 'billingSvc', target: 'billingDb' },
	{ id: 'eBusOut', source: 'storefront', target: 'eventBus' },
	{ id: 'eBusIn', source: 'eventBus', target: 'billingSvc' },
	{ id: 'eDeployBill', source: 'pipeline', target: 'billingSvc' },
];

// ─── Main component ───────────────────────────────────────────────────

export function Level58Architect({ onComplete }: LevelComponentProps) {
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
							// Safety net: stop all edge dots after the last frame.
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

	// ── Hooks ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);

	// ── Flow nodes/edges ──
	const flowNodes: Node[] = useMemo(() => {
		const positions = isReward ? REWARD_POSITIONS : OBSERVE_POSITIONS;
		return Object.entries(positions).map(([key, position]) => ({
			id: key,
			type: 'arch',
			position,
			data: { ...(zoneStates[key] ?? OBSERVE_ZONES[key]), zoneKey: key },
		}));
	}, [zoneStates, isReward]);

	const flowEdges: Edge[] = useMemo(() => {
		const defs = isReward ? REWARD_EDGE_DEFS : OBSERVE_EDGE_DEFS;
		return defs.map((def) => ({
			id: def.id,
			source: def.source,
			target: def.target,
			type: 'arch',
			data: edgeStates[def.id] ?? DEFAULT_EDGE,
		}));
	}, [edgeStates, isReward]);

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
				message: 'Complete all design decisions first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return {
			valid: true,
			message:
				'Extraction designed: billing leaves alone, at the existing seams, with dual-written data, event-carried facts, and a flag-gated cutover that can always turn back.',
		};
	};

	const codePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	function renderCenter() {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					<div className="flex-1 relative">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={archEdgeTypes}
							nodes={flowNodes}
							nodeTypes={archNodeTypes}
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
							title="Architecture Probe"
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
						{currentStepType === 'terminal' && (
							<TerminalChoiceStep
								commands={SKELETON_COMMANDS}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										The plan calls for a separately deployable billing app.
										Nothing in this project has ever run as a second service.
										Create the skeleton.
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
								outputLines={SKELETON_OUTPUT}
								stepKey={stepper.currentStep}
								title="Create the Service Skeleton"
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
						edgeTypes={archEdgeTypes}
						nodes={flowNodes}
						nodeTypes={archNodeTypes}
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
							The app is well-factored: packages have boundaries, side effects
							ride events, clients enter through the gateway. And billing still
							hurts everyone: its hotfixes wait hours behind the shared deploy,
							its month-end batch drags checkout, its bugs take the whole
							storefront down.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							This is the capstone: decide whether billing should leave the
							monolith, and design the migration so customers never feel it
							happen.
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
								Design Decisions
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
									Migration Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<GitBranch className="w-4 h-4 text-success" />
										<span className="text-foreground">
											Two deploy targets, one stable client URL
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Shield className="w-4 h-4 text-warning" />
										<span className="text-foreground">
											Flag gate: canary percentage / instant rollback
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
					levelName="The Architect"
					levelNumber={58}
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
					learningGoal="Extraction is a judgment call, not a destination. The evidence that justifies it is structural pain (deploy cadence, workload isolation, blast radius), and the migration that survives it is gradual: move behavior behind existing seams, keep both paths alive, and make the switch a percentage you can turn back, not a deploy you cannot."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level58Architect;
