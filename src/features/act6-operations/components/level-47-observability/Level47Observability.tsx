/**
 * Level 47: Observability
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Redesign (2026-07-11). The level's thesis: the error tracker (built at
 * the error-monitoring level) catches what BREAKS; observability is for
 * what is silently wrong (slow, stuck, degraded) and raises nothing.
 * Every probe is an incident where the error tracker stays quiet.
 *
 * What the old version got wrong (audit findings):
 *   - Observe was artifact boxes: "Structured Logs (Not configured)",
 *     "Trace Timeline (Not configured)", "Health Endpoint (Missing
 *     404)". Three placeholder nodes for tools the build installs
 *     (show-only-what-exists violation) and zero customer damage.
 *   - Frames claimed /up returns 404. Rails 8 ships /up
 *     (Rails::HealthController): 200 if the app booted, and per its API
 *     docs it "does not reflect the status of all of your application's
 *     dependencies, such as the database". The docs suggest replacing
 *     the route for app-specific checks, which is exactly step 5.
 *   - Kubernetes / microservices / cross-service vocabulary in a
 *     monolith; "Redis: ok" in a Solid-stack app; tenant_id in the
 *     custom payload (multi-tenancy is a later level).
 *   - The correct health answer called HealthCheckService, which was
 *     never shown anywhere. It is now real, verified code.
 *
 * Observe topology (all of it exists): Customers -> Rails App ->
 * production.log; Solid Queue worker (running since the background-jobs
 * level); uptime monitor pinging /up. The trace timeline appears only
 * in reward, because the build creates it.
 *
 * Doc sources (fetched 2026-07-10):
 *   - api.rubyonrails.org Rails::HealthController (/up semantics)
 *   - lograge README (enabled, Formatters::Json, custom_payload
 *     receives the controller instance)
 *   - opentelemetry.io Ruby getting-started (sdk +
 *     instrumentation-all gems, SDK.configure with service_name and
 *     use_all(), config/initializers/opentelemetry.rb)
 *   - solid_queue source: SolidQueue::Process model heartbeats via
 *     touch(:last_heartbeat_at); README: "Processes send heartbeats,
 *     and the supervisor checks and prunes processes with expired
 *     heartbeats" (process_alive_threshold defaults to 5 minutes)
 *   - rubygems: lograge 0.15.0, opentelemetry-sdk 1.12.1,
 *     opentelemetry-instrumentation-all 0.94.0
 */

import type { Edge, EdgeProps, Node } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getStraightPath } from '@xyflow/react';
import { ArrowRight, Check, X } from 'lucide-react';
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

registerLevelCode('act6-level47-observability', () =>
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

// Zones that exist in the before-world: customers, the app, the log
// file, the Solid Queue worker (background-jobs level), and the uptime
// monitor pinging Rails 8's built-in /up. 'traces' exists only in
// reward: the build creates it.
type ZoneKey =
	| 'customers'
	| 'app'
	| 'logfile'
	| 'worker'
	| 'monitor'
	| 'traces';

type EdgeKey = 'eCust' | 'eLog' | 'eWork' | 'eMon' | 'eTrace';

export type AnimFrame = {
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
	customers: {
		label: 'Customers',
		flash: 'idle',
		sublabel: 'browsing, buying, reviewing',
		badge: null,
	},
	app: {
		label: 'Rails App',
		flash: 'idle',
		sublabel: 'healthy according to the error tracker',
		badge: null,
	},
	logfile: {
		label: 'production.log',
		flash: 'idle',
		sublabel: 'multi-line text, grep only',
		badge: null,
	},
	worker: {
		label: 'Job Worker',
		flash: 'idle',
		sublabel: 'Solid Queue, running',
		badge: null,
	},
	monitor: {
		label: 'Uptime Monitor',
		flash: 'idle',
		sublabel: 'pings /up every minute',
		badge: null,
	},
};

const REWARD_ZONES: Record<string, ZoneVizState> = {
	customers: {
		label: 'Customers',
		flash: 'green',
		sublabel: 'incidents end in minutes now',
		badge: null,
	},
	app: {
		label: 'Rails App',
		flash: 'green',
		sublabel: 'every request measured',
		badge: null,
	},
	logfile: {
		label: 'JSON logs',
		flash: 'green',
		sublabel: 'one queryable line per request',
		badge: null,
	},
	worker: {
		label: 'Job Worker',
		flash: 'green',
		sublabel: 'heartbeat watched by /up',
		badge: null,
	},
	monitor: {
		label: 'Uptime Monitor',
		flash: 'green',
		sublabel: '/up now checks DB + worker',
		badge: null,
	},
	traces: {
		label: 'Trace Timeline',
		flash: 'green',
		sublabel: 'per-request span breakdown',
		badge: null,
	},
};

// ─── Discovery definitions ────────────────────────────────────────────

export const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'slow-invisible',
		label: 'Slow requests raise nothing and cannot be filtered from text logs',
	},
	{
		id: 'no-thread',
		label: "One customer's request cannot be pulled from interleaved logs",
	},
	{
		id: 'no-breakdown',
		label: 'The 3.2 seconds is a black box with no per-step breakdown',
	},
	{
		id: 'boot-only-up',
		label: '/up says 200 while the job worker is dead',
	},
];

// ─── Probe definitions ────────────────────────────────────────────────
// Every probe is an incident where NOTHING raises, so the error tracker
// from the error-monitoring level stays silent. No fix-tool names here.

export const PROBES: ProbeConfig[] = [
	{
		id: 'hunt-slow-checkout',
		label: 'Hunt the lunch-rush checkout slowdown in the logs',
		command: 'grep "Completed" log/production.log | grep checkout | tail -3',
		responseLines: [
			{
				text: 'Completed 200 OK in 2841ms (Views: 12.1ms ...)',
				color: 'yellow',
			},
			{ text: 'Completed 200 OK in 187ms (Views: 9.8ms ...)', color: 'muted' },
			{
				text: 'Completed 200 OK in 3214ms (Views: 11.4ms ...)',
				color: 'yellow',
			},
			{ text: '', color: 'muted' },
			{
				text: 'Durations are trapped inside prose. No sort, no filter, no top-10.',
				color: 'red',
			},
			{
				text: '40 minutes of grep so far. The error tracker: silent (200s raise nothing).',
				color: 'red',
			},
		],
		story: [
			'Lunch rush: checkout is taking seconds and carts are being abandoned.',
			'The error tracker shows nothing, because slow is not broken: every request returns 200.',
			'The only evidence is production.log, where each request is five lines of prose.',
			'You cannot ask "show me every request over one second." You can only grep and squint.',
			'Forty minutes in, there is still no list of slow endpoints, and the lunch rush is ending without its sales.',
		],
	},
	{
		id: 'trace-one-customer',
		label: "Pull one customer's failed order out of the logs",
		command: 'grep -n "14:22:3" log/production.log | head -8',
		responseLines: [
			{ text: '84211: Started POST "/checkout" ...', color: 'muted' },
			{ text: '84212: Started GET "/products/9" ...', color: 'muted' },
			{ text: '84213:   Order Load (1.2ms) ...', color: 'muted' },
			{ text: '84214: Started POST "/checkout" ...', color: 'muted' },
			{ text: '', color: 'muted' },
			{
				text: 'Six concurrent requests interleaved. Which lines are HER request?',
				color: 'red',
			},
			{
				text: 'The error report names the exception, not the request around it.',
				color: 'red',
			},
		],
		story: [
			"Support ticket: a customer's order failed at 14:22 and she was charged nothing, twice.",
			'The error tracker captured the exception, but the question is what happened around it: which params, what came before, how long it took.',
			'Grepping the timestamp returns six concurrent requests braided together.',
			'No shared id ties the lines of one request into one thread.',
			'Support cannot answer the customer, and the refund sits unresolved.',
		],
	},
	{
		id: 'find-bottleneck',
		label: 'Find where checkout spends its 3.2 seconds',
		command:
			'curl -w "total: %{time_total}s\\n" -o /dev/null -s localhost:3000/checkout',
		responseLines: [
			{ text: 'total: 3.214s', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'One number. Database? Payment provider? Rendering? Unknown.',
				color: 'red',
			},
			{
				text: 'Next move: add a timing log, restart, wait for lunch. Repeat per guess.',
				color: 'red',
			},
		],
		story: [
			'The slowdown is real: checkout spends 3.2 seconds somewhere.',
			'The total is the only number that exists. Nothing shows the steps inside.',
			'Is it the database? The payment provider call? Rendering? Each theory means hand-adding a timing log and restarting.',
			'Nothing raises, so the error tracker has nothing to say.',
			'The slow lunch is heading for day 2.',
		],
	},
	{
		id: 'check-worker-health',
		label: 'Check the app is healthy after the 2am restart',
		command: 'curl -s -o /dev/null -w "%{http_code}\\n" localhost:3000/up',
		responseLines: [
			{ text: '200', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: "Rails' built-in /up proves one thing: the app booted.",
				color: 'yellow',
			},
			{
				text: 'The job worker never came back after the restart. No job raises: they just wait.',
				color: 'red',
			},
			{
				text: 'Receipts and confirmations have been silently queued for 4 hours.',
				color: 'red',
			},
		],
		story: [
			'The database blipped at 2am and the app restarted cleanly. The uptime monitor stayed green.',
			"It pings Rails' built-in /up, which returns 200 because the process booted. By design it checks no dependencies.",
			'The job worker did not survive the restart. Jobs do not fail, they just queue, so nothing raises and the error tracker stays silent.',
			'Order confirmations and receipts stop arriving. Four hours later, support tickets are the alarm.',
			'Green monitor, silent tracker, angry customers: the exact gap between "booted" and "working".',
		],
	},
];

export const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'hunt-slow-checkout': ['slow-invisible'],
	'trace-one-customer': ['no-thread'],
	'find-bottleneck': ['no-breakdown'],
	'check-worker-health': ['boot-only-up'],
};

// ─── Observe animation frames ─────────────────────────────────────────

export const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'hunt-slow-checkout': [
		{
			zones: {
				customers: {
					flash: 'red',
					sublabel: 'checkout crawling at lunch rush',
					badge: 'CARTS ABANDONED',
				},
				app: {
					flash: 'amber',
					sublabel: 'all 200s: nothing raises',
					badge: '3.2s',
				},
			},
			edges: {
				eCust: {
					active: true,
					reverse: false,
					label: 'slow checkouts',
					dotColor: '#ef4444',
				},
			},
		},
		{
			zones: {
				logfile: {
					flash: 'amber',
					sublabel: 'grep | sort | squint, 40 minutes in',
					badge: 'GREP',
				},
			},
			edges: {
				eCust: { active: false, label: '' },
				eLog: {
					active: true,
					reverse: false,
					label: 'five lines of prose per request',
					dotColor: '#ef4444',
				},
			},
		},
		{
			zones: {
				logfile: {
					flash: 'red',
					sublabel: 'durations trapped in text: no sort, no filter',
					badge: 'UNQUERYABLE',
				},
				customers: {
					flash: 'red',
					sublabel: 'lunch rush ends, carts still abandoned',
					badge: 'SALES LOST',
				},
			},
			edges: { eLog: { active: false, label: '' } },
		},
	],
	'trace-one-customer': [
		{
			zones: {
				customers: {
					flash: 'amber',
					sublabel: 'ticket: order failed at 14:22, charged twice',
					badge: 'TICKET',
				},
			},
			edges: {
				eCust: {
					active: true,
					reverse: false,
					label: 'what happened to HER request?',
					dotColor: '#f59e0b',
				},
			},
		},
		{
			zones: {
				app: {
					flash: 'amber',
					sublabel: 'error tracker has the exception, not the story',
				},
				logfile: {
					flash: 'amber',
					sublabel: 'grep 14:22: six requests braided together',
					badge: 'INTERLEAVED',
				},
			},
			edges: {
				eCust: { active: false, label: '' },
				eLog: {
					active: true,
					reverse: false,
					label: 'no id ties one request together',
					dotColor: '#ef4444',
				},
			},
		},
		{
			zones: {
				logfile: {
					flash: 'red',
					sublabel: 'her lines are in here somewhere',
					badge: 'NO THREAD',
				},
				customers: {
					flash: 'red',
					sublabel: 'support cannot answer her; refund unresolved',
					badge: 'WAITING',
				},
			},
			edges: { eLog: { active: false, label: '' } },
		},
	],
	'find-bottleneck': [
		{
			zones: {
				app: {
					flash: 'amber',
					sublabel: 'checkout total: 3.2s, breakdown: none',
					badge: '3.2s',
				},
				customers: { flash: 'red', sublabel: 'still waiting at checkout' },
			},
			edges: {
				eCust: {
					active: true,
					reverse: false,
					label: 'POST /checkout',
					dotColor: '#f59e0b',
				},
			},
		},
		{
			zones: {
				logfile: {
					flash: 'red',
					sublabel: 'Completed 200 OK in 3214ms: one number',
					badge: 'ONE NUMBER',
				},
			},
			edges: {
				eCust: { active: false, label: '' },
				eLog: {
					active: true,
					reverse: false,
					label: 'DB? payment provider? rendering?',
					dotColor: '#ef4444',
				},
			},
		},
		{
			zones: {
				app: {
					flash: 'red',
					sublabel: 'guess, add a timing log, restart, repeat',
					badge: 'GUESSWORK',
				},
				customers: {
					flash: 'red',
					sublabel: 'slow lunch heading for day 2',
					badge: 'DAY 2',
				},
			},
			edges: { eLog: { active: false, label: '' } },
		},
	],
	'check-worker-health': [
		{
			zones: {
				app: {
					flash: 'amber',
					sublabel: 'restarted cleanly at 2:07am',
					badge: 'RESTARTED',
				},
				monitor: {
					flash: 'green',
					sublabel: '/up says 200: booted',
					badge: 'GREEN',
				},
			},
			edges: {
				eMon: {
					active: true,
					reverse: false,
					label: 'ping /up -> 200',
					dotColor: '#22c55e',
				},
			},
		},
		{
			zones: {
				worker: {
					flash: 'red',
					sublabel: 'never came back after the restart',
					badge: 'DEAD',
				},
				app: {
					flash: 'amber',
					sublabel: 'jobs queue quietly: nothing raises',
				},
			},
			edges: {
				eMon: { active: false, label: '' },
				eWork: {
					active: true,
					reverse: false,
					label: 'receipts piling up unprocessed',
					dotColor: '#ef4444',
				},
			},
		},
		{
			zones: {
				customers: {
					flash: 'red',
					sublabel: 'receipts and confirmations gone for 4 hours',
					badge: 'NO EMAILS',
				},
				monitor: {
					flash: 'green',
					sublabel: 'still green: /up only proves boot',
					badge: '200',
				},
			},
			edges: { eWork: { active: false, label: '' } },
		},
	],
};

// ─── Reward animation frames ─────────────────────────────────────────

export const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'hunt-slow-checkout': [
		{
			zones: {
				customers: {
					flash: 'amber',
					sublabel: 'same lunch rush, same slowdown',
				},
				logfile: {
					flash: 'amber',
					sublabel: 'jq "select(.duration > 1000)"',
					badge: 'QUERY',
				},
			},
			edges: {
				eLog: {
					active: true,
					reverse: false,
					label: 'one JSON line per request',
					dotColor: '#22c55e',
				},
			},
		},
		{
			zones: {
				logfile: {
					flash: 'green',
					sublabel: '3 slow endpoints, sorted, in 8 seconds',
					badge: '8 SECONDS',
				},
			},
			edges: { eLog: { active: false, label: '' } },
		},
		{
			zones: {
				app: { flash: 'green', sublabel: 'fix targeted at the worst one' },
				customers: {
					flash: 'green',
					sublabel: 'checkout recovers within the same lunch',
					badge: 'SAME HOUR',
				},
			},
		},
	],
	'trace-one-customer': [
		{
			zones: {
				customers: {
					flash: 'amber',
					sublabel: 'same ticket: failed order at 14:22',
					badge: 'TICKET',
				},
				logfile: {
					flash: 'amber',
					sublabel: 'jq "select(.request_id == \\"f3a91c\\")"',
					badge: 'QUERY',
				},
			},
			edges: {
				eLog: {
					active: true,
					reverse: false,
					label: 'request_id from the error report',
					dotColor: '#22c55e',
				},
			},
		},
		{
			zones: {
				logfile: {
					flash: 'green',
					sublabel: 'her request, one thread: params, duration, user',
					badge: 'ONE THREAD',
				},
			},
			edges: { eLog: { active: false, label: '' } },
		},
		{
			zones: {
				customers: {
					flash: 'green',
					sublabel: 'support answers with the full story in minutes',
					badge: 'RESOLVED',
				},
			},
		},
	],
	'find-bottleneck': [
		{
			zones: {
				app: {
					flash: 'amber',
					sublabel: 'same 3.2s checkout, now traced',
					badge: '3.2s',
				},
			},
			edges: {
				eTrace: {
					active: true,
					reverse: false,
					label: 'spans recorded per request',
					dotColor: '#22c55e',
				},
			},
		},
		{
			zones: {
				traces: {
					flash: 'green',
					sublabel: 'DB 180ms | payment provider 2.8s | render 160ms',
					badge: '3 SPANS',
				},
			},
			edges: { eTrace: { active: false, label: '' } },
		},
		{
			zones: {
				traces: {
					flash: 'green',
					sublabel: 'bottleneck has a name: the payment call',
					badge: 'NAMED',
				},
				customers: {
					flash: 'green',
					sublabel: 'timeout + reuse of the payment session shipped',
					badge: 'FIXED',
				},
			},
		},
	],
	'check-worker-health': [
		{
			zones: {
				app: {
					flash: 'amber',
					sublabel: 'same 2am restart, worker dead again',
					badge: 'RESTARTED',
				},
				worker: {
					flash: 'red',
					sublabel: 'no heartbeat for 5 minutes',
					badge: 'DEAD',
				},
			},
			edges: {
				eMon: {
					active: true,
					reverse: false,
					label: 'ping /up (deep checks now)',
					dotColor: '#f59e0b',
				},
			},
		},
		{
			zones: {
				monitor: {
					flash: 'red',
					sublabel: 'job_worker: false -> 503',
					badge: '503',
				},
			},
			edges: {
				eMon: {
					active: true,
					reverse: true,
					label: '{ database: true, job_worker: false }',
					dotColor: '#ef4444',
				},
			},
		},
		{
			zones: {
				monitor: {
					flash: 'amber',
					sublabel: 'pages the on-call at 2:09am',
					badge: 'PAGED',
				},
				customers: {
					flash: 'green',
					sublabel: 'worker restarted; receipts flowing by 2:20',
					badge: '13 MIN',
				},
			},
			edges: { eMon: { active: false, label: '' } },
		},
	],
	'search-by-user': [
		{
			zones: {
				logfile: {
					flash: 'amber',
					sublabel: 'jq "select(.user_id == 42)"',
					badge: 'QUERY',
				},
			},
			edges: {
				eLog: {
					active: true,
					reverse: true,
					label: 'every request carries user_id now',
					dotColor: '#22c55e',
				},
			},
		},
		{
			zones: {
				logfile: {
					flash: 'green',
					sublabel: '23 requests: her whole day, in order',
					badge: '23 REQUESTS',
				},
				customers: {
					flash: 'green',
					sublabel: 'support sees exactly what she saw',
					badge: null,
				},
			},
			edges: { eLog: { active: false, label: '' } },
		},
	],
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	app: {
		stageId: 'app',
		title: 'Rails App',
		description:
			'Healthy according to the error tracker, and that is the trap: the tracker only sees exceptions. Slow requests, stuck queues, and dead workers raise nothing, so today the app can be quietly failing customers while every dashboard stays green.',
	},
	logfile: {
		stageId: 'logfile',
		title: 'production.log',
		description:
			'The only record of what each request did. Every request writes about five lines of human-readable prose, and concurrent requests interleave their lines. grep can find words in it; nobody can ask it questions like "which requests took over a second" or "show me everything request X did".',
		code: `Started POST "/checkout" for 10.0.0.7 at 14:22:31
Processing by CheckoutsController#create as JSON
  Order Load (1.2ms)  SELECT "orders".* ...
Started GET "/products/9" for 10.0.0.4 at 14:22:31
Completed 200 OK in 3214ms (Views: 11.4ms | ActiveRecord: 68.2ms)`,
	},
	worker: {
		stageId: 'worker',
		title: 'Job Worker (Solid Queue)',
		description:
			'Runs receipts, confirmations, and every other background job since the background-jobs level. If it dies, jobs do not fail: they sit in the queue waiting for a worker that will never come. Nothing raises, so nothing alerts.',
	},
	monitor: {
		stageId: 'monitor',
		title: 'Uptime Monitor + /up',
		description:
			"Pings Rails 8's built-in /up endpoint every minute. Per the Rails docs, /up returns 200 if the app booted without exceptions, and deliberately checks none of the app's dependencies. Green here means 'the process exists', not 'the system works'.",
	},
	customers: {
		stageId: 'customers',
		title: 'Customers',
		description:
			'The people who feel every one of these gaps first: slow checkouts, unanswered support tickets, missing receipts. Right now they are the alerting system.',
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {};

// ─── Stress test scenarios (reward) ───────────────────────────────────
// The four probes replay with the fix; one extra shows the support
// superpower structured fields unlock. "Blocked" = the sick state is
// caught by the deep health check before customers become the alarm.

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'hunt-slow-checkout',
		label: 'Hunt the lunch-rush checkout slowdown in the logs',
		description: 'One jq query replaces 40 minutes of grep',
		method: 'QUERY',
		path: 'jq: .duration > 1000',
		actor: 'on-call',
		expectedResult: 'allowed',
		story: [
			'Same lunch rush, same slowdown, same silent error tracker.',
			'The logs are one JSON line per request now, so the question becomes a query: duration over 1000ms.',
			'Eight seconds later there is a sorted list of three slow endpoints, worst first.',
			'The fix ships within the same lunch, not after day two.',
		],
	},
	{
		id: 'trace-one-customer',
		label: "Pull one customer's failed order out of the logs",
		description: 'The request_id from the error report pulls one thread',
		method: 'QUERY',
		path: 'jq: .request_id == "f3a91c"',
		actor: 'support',
		expectedResult: 'allowed',
		story: [
			'Same ticket: her order failed at 14:22.',
			'The error report carries a request_id, and every log line now carries it too.',
			'One query pulls her request out of the braid: params, duration, user, what happened before.',
			'Support answers with the full story in minutes, and the refund goes out.',
		],
	},
	{
		id: 'find-bottleneck',
		label: 'Find where checkout spends its 3.2 seconds',
		description: 'The trace names the step: payment provider, 2.8s',
		method: 'TRACE',
		path: 'span timeline: POST /checkout',
		actor: 'on-call',
		expectedResult: 'allowed',
		story: [
			'Same 3.2-second checkout, but now every request records spans.',
			'The timeline reads: database 180ms, payment provider 2.8s, rendering 160ms.',
			'The bottleneck has a name on the first look, with zero guess-and-restart cycles.',
			'A timeout plus reusing the payment session ships that afternoon.',
		],
	},
	{
		id: 'check-worker-health',
		label: 'Check the app is healthy after the 2am restart',
		description: 'Deep /up returns 503 for the dead worker; the monitor pages',
		method: 'GET',
		path: '/up (deep checks)',
		actor: 'uptime monitor',
		expectedResult: 'blocked',
		story: [
			'Same 2am restart, and the worker dies again.',
			'/up now runs real checks: the database answers, but no worker heartbeat has landed in five minutes.',
			'{ database: true, job_worker: false } comes back as a 503, and the monitor pages at 2:09am.',
			'Receipts are flowing again by 2:20. Customers never notice, because customers are no longer the alarm.',
		],
	},
	{
		id: 'search-by-user',
		label: 'Pull everything one customer did today',
		description: 'user_id on every line turns support into a query',
		method: 'QUERY',
		path: 'jq: .user_id == 42',
		actor: 'support',
		expectedResult: 'allowed',
		story: [
			'A seller reports "the site was weird all morning".',
			'Every log line carries her user_id now.',
			'One query returns her 23 requests in order: the exact pages, timings, and statuses she saw.',
			'Vague reports become concrete timelines.',
		],
	},
];

// ─── Build step definitions ───────────────────────────────────────────

export const STEP_DEFS: StepDef[] = [
	{ id: 'install-lograge', title: 'Install Structured Logging' },
	{ id: 'configure-lograge', title: 'Pick the Log Format' },
	{ id: 'custom-fields', title: 'Attach Request Context' },
	{ id: 'install-otel', title: 'Install Tracing' },
	{ id: 'configure-otel', title: 'Configure the Tracer' },
	{ id: 'health-endpoint', title: 'Deepen the Health Check' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal',
	'option',
	'option',
	'terminal',
	'option',
	'option',
];

// ─── Step 0: install lograge (terminal) ───────────────────────────────

export const INSTALL_LOGRAGE_COMMANDS: TerminalCommand[] = [
	{
		id: 'wrong-generator',
		label: 'bin/rails generate logger:install',
		command: 'bin/rails generate logger:install',
		correct: false,
		feedback:
			'No such generator ships with Rails. Reshaping the request log takes a gem that replaces the default multi-line output.',
	},
	{
		id: 'correct',
		label: 'bundle add lograge',
		command: 'bundle add lograge',
		correct: true,
	},
	{
		id: 'wrong-json-logger',
		label: 'bundle add json_logger',
		command: 'bundle add json_logger',
		correct: false,
		feedback:
			'Not the gem Rails teams standardize on for this. The widely used one condenses each request into a single structured line.',
	},
];

const INSTALL_LOGRAGE_OUTPUT: TerminalOutputLine[] = [
	{ text: 'Fetching lograge 0.15.0', color: 'cyan' },
	{ text: 'Installing lograge 0.15.0', color: 'green' },
	{ text: 'Bundle complete!', color: 'green' },
];

// ─── Option step data ─────────────────────────────────────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

// Step 1: formatter (per the lograge README: KeyValue is the default,
// Json.new emits JSON, Raw.new emits a Ruby hash).
const LOGRAGE_CONFIG_OPTIONS: StepOption[] = [
	{
		id: 'wrong-keyvalue',
		name: 'config.lograge.enabled = true\nconfig.lograge.formatter = Lograge::Formatters::KeyValue.new',
		correct: false,
		feedback:
			'One line per request now, but still flat text: fine for eyeballs, brittle for machines. The log pipeline needs a format it can parse field-by-field without regex.',
	},
	{
		id: 'correct',
		name: 'config.lograge.enabled = true\nconfig.lograge.formatter = Lograge::Formatters::Json.new',
		correct: true,
	},
	{
		id: 'wrong-raw',
		name: 'config.lograge.enabled = true\nconfig.lograge.formatter = Lograge::Formatters::Raw.new',
		correct: false,
		feedback:
			'Raw emits a Ruby hash object, and only Ruby can read a Ruby hash. Log pipelines and query tools are not Ruby processes.',
	},
];

// Step 2: custom fields (per the lograge README: custom_payload
// receives the controller instance; custom_options receives the event).
const CUSTOM_FIELDS_OPTIONS: StepOption[] = [
	{
		id: 'wrong-extra-line',
		name: 'before_action :log_context\n\ndef log_context\n  Rails.logger.info("user=#{Current.user&.id}")\nend',
		correct: false,
		feedback:
			'That adds one more unstructured line to grep through. The fields need to land INSIDE the single structured line each request already emits.',
	},
	{
		id: 'wrong-log-tags',
		name: 'config.log_tags = [ :request_id ]',
		correct: false,
		feedback:
			"log_tags prefixes the DEFAULT logger's lines. The single-line request log you just built comes from a different pipeline with its own hook for extra fields.",
	},
	{
		id: 'correct',
		name: 'config.lograge.custom_payload do |controller|\n  {\n    request_id: controller.request.request_id,\n    user_id: Current.user&.id\n  }\nend',
		correct: true,
	},
];

// ─── Step 3: install OpenTelemetry (terminal) ─────────────────────────

export const INSTALL_OTEL_COMMANDS: TerminalCommand[] = [
	{
		id: 'wrong-newrelic',
		label: 'bundle add newrelic_rpm',
		command: 'bundle add newrelic_rpm',
		correct: false,
		feedback:
			'That locks the trace data into one proprietary backend. The team wants the vendor-neutral standard, so any backend can receive the same data.',
	},
	{
		id: 'correct',
		label: 'bundle add opentelemetry-sdk opentelemetry-instrumentation-all',
		command: 'bundle add opentelemetry-sdk opentelemetry-instrumentation-all',
		correct: true,
	},
	{
		id: 'wrong-sdk-only',
		label: 'bundle add opentelemetry-sdk',
		command: 'bundle add opentelemetry-sdk',
		correct: false,
		feedback:
			'The SDK alone is plumbing: it can export spans but instruments nothing by itself. Rails, Active Record, and the HTTP client each need their instrumentation attached.',
	},
];

const INSTALL_OTEL_OUTPUT: TerminalOutputLine[] = [
	{ text: 'Fetching opentelemetry-sdk 1.12.1', color: 'cyan' },
	{ text: 'Fetching opentelemetry-instrumentation-all 0.94.0', color: 'cyan' },
	{ text: 'Installing opentelemetry-sdk 1.12.1', color: 'green' },
	{
		text: 'Installing opentelemetry-instrumentation-all 0.94.0',
		color: 'green',
	},
	{ text: 'Bundle complete!', color: 'green' },
];

// Step 4: configure the SDK (per opentelemetry.io getting-started:
// SDK.configure with service_name and use_all() in an initializer).
const OTEL_CONFIG_OPTIONS: StepOption[] = [
	{
		id: 'wrong-manual-list',
		name: 'OpenTelemetry::SDK.configure do |c|\n  c.service_name = "myapp"\n  c.use "OpenTelemetry::Instrumentation::Rails"\n  c.use "OpenTelemetry::Instrumentation::ActiveRecord"\nend',
		correct: false,
		feedback:
			'Hand-listing instrumentations means every new gem needs a matching edit here, and the ones you forget stay invisible in traces. The SDK can discover everything in the Gemfile for you.',
	},
	{
		id: 'wrong-no-name',
		name: 'OpenTelemetry::SDK.configure do |c|\n  c.use_all\nend',
		correct: false,
		feedback:
			'Without naming this app, every span lands in the backend as "unknown_service" and cannot be told apart from anything else reporting there.',
	},
	{
		id: 'correct',
		name: 'OpenTelemetry::SDK.configure do |c|\n  c.service_name = "myapp"\n  c.use_all\nend',
		correct: true,
	},
];

// Step 5: deepen /up (the Rails docs: "Replace rails/health#show with
// your own controller action if you have application specific needs").
const HEALTH_CHECK_OPTIONS: StepOption[] = [
	{
		id: 'wrong-keep-default',
		name: '# config/routes.rb (keep as generated)\nget "up" => "rails/health#show", as: :rails_health_check',
		correct: false,
		feedback:
			'That endpoint returns 200 whenever the process has booted; by design it reflects nothing about dependencies. The dead job worker from the 2am incident sails right through it.',
	},
	{
		id: 'correct',
		name: '# config/routes.rb\nget "up" => "health#show", as: :rails_health_check\n\n# app/controllers/health_controller.rb\nclass HealthController < ApplicationController\n  allow_unauthenticated_access\n\n  def show\n    checks = HealthCheckService.call\n    status = checks.values.all? ? :ok : :service_unavailable\n    render json: checks, status: status\n  end\nend',
		correct: true,
	},
	{
		id: 'wrong-authenticated',
		name: '# config/routes.rb\nget "up" => "health#show", as: :rails_health_check\n\n# app/controllers/health_controller.rb\nclass HealthController < ApplicationController\n  def show\n    render json: { status: "ok" }\n  end\nend',
		correct: false,
		feedback:
			'This controller inherits the app-wide login requirement, and the uptime monitor cannot log in: every ping bounces off authentication and the monitor pages you about a perfectly healthy app. It also checks nothing.',
	},
];

// ─── Option step config map ───────────────────────────────────────────

export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Pick the Log Format',
		description:
			'The gem is installed. Each request will now emit ONE line instead of five, and the question is what shape that line takes so tools can query it. Which formatter?',
		options: LOGRAGE_CONFIG_OPTIONS,
	},
	2: {
		title: 'Attach Request Context',
		description:
			'One queryable line per request, but the lunch-rush hunt also needs to answer "whose request?" and "which request?". How do the request id and the user land inside every line?',
		options: CUSTOM_FIELDS_OPTIONS,
	},
	4: {
		title: 'Configure the Tracer',
		description:
			'The tracing gems are installed. Configure the SDK in its initializer so every library in the app reports spans, attributed to this app.',
		options: OTEL_CONFIG_OPTIONS,
	},
	5: {
		title: 'Deepen the Health Check',
		description:
			"Rails' built-in /up answered 200 all through the dead-worker incident, because it only proves the app booted. The uptime monitor needs an answer that reflects whether the system WORKS. What replaces it?",
		options: HEALTH_CHECK_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: INSTALL_LOGRAGE_COMMANDS, outputLines: INSTALL_LOGRAGE_OUTPUT },
	null,
	null,
	{ commands: INSTALL_OTEL_COMMANDS, outputLines: INSTALL_OTEL_OUTPUT },
	null,
	null,
];

// ─── Code preview per phase/step ──────────────────────────────────────

export function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe' || completedStep < 0) {
		return [
			{
				filename: 'log/production.log',
				language: 'text',
				code: `Started POST "/checkout" for 10.0.0.7 at 14:22:31
Processing by CheckoutsController#create as JSON
Started GET "/products/9" for 10.0.0.4 at 14:22:31
  Order Load (1.2ms)  SELECT "orders".* FROM ...
Processing by ProductsController#show as JSON
Completed 200 OK in 3214ms (Views: 11.4ms | ActiveRecord: 68.2ms)
{"method":"POST","path":"/checkout","status":200,"duration_ms":3214,"request_id":"f3a91c"}
Completed 200 OK in 187ms (Views: 9.8ms | ActiveRecord: 3.1ms)

# The middleware level's JSON summary line (line 7) is good, but
# Rails' OWN default logging still writes the prose lines around
# it for every request, interleaved. The SQL, view, and render
# timings only live in that prose, so there is no single
# structured line per request you can sort, filter, or correlate.`,
				highlight: [7],
			},
			{
				filename: 'app/middleware/request_logger.rb',
				language: 'ruby',
				code: `class RequestLogger
  def initialize(app)
    @app = app
  end

  def call(env)
    start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    status, headers, body = @app.call(env)
    duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start

    Rails.logger.info({
      method: env['REQUEST_METHOD'],
      path: env['PATH_INFO'],
      status: status,
      duration_ms: (duration * 1000).round(2),
      request_id: env['HTTP_X_REQUEST_ID']
    }.to_json)

    [status, headers, body]
  end
end

# The middleware level added ONE good JSON summary line per
# request (with request_id). But Rails' OWN default logging
# still emits the five prose lines above for every request,
# interleaved, and that is where the SQL, view, and render
# timings live. The whole request needs to become one
# structured line instead of a summary plus five prose lines.`,
				highlight: [11, 12, 13, 14, 15, 16, 17],
			},
		];
	}

	const files = [];

	// Working on step 0 (the install step): the player has not added the
	// structured-logging gem yet, so the right panel shows the before-state
	// prose log, not a config file that names the tool they are about to pick.
	if (completedStep < 0) {
		files.push({
			filename: 'log/production.log',
			language: 'text',
			code: `Started GET "/products/9" for 10.0.0.4 at 14:22:31
  Product Load (2.1ms)  SELECT "products".* FROM ...
Processing by ProductsController#show as JSON
Completed 200 OK in 187ms (Views: 9.8ms | ActiveRecord: 3.1ms)

# Five prose lines per request, interleaved across requests.
# The SQL, view, and render timings are trapped in that prose,
# so there is no one structured line per request to sort or filter.`,
			highlight: [],
		});
	} else {
		files.push({
			filename: 'config/environments/production.rb',
			language: 'ruby',
			code:
				completedStep >= 2
					? `# Structured request logging
config.lograge.enabled = true
config.lograge.formatter = Lograge::Formatters::Json.new

config.lograge.custom_payload do |controller|
  {
    request_id: controller.request.request_id,
    user_id: Current.user&.id
  }
end`
					: completedStep >= 1
						? `# Structured request logging
config.lograge.enabled = true
config.lograge.formatter = Lograge::Formatters::Json.new

# Each line still answers "what happened" but not
# "whose request" or "which request".`
						: `# Structured logging gem installed (Gemfile).
# Each request still logs five lines of prose;
# the formatter decides what replaces them.`,
			highlight:
				completedStep >= 2
					? [5, 6, 7, 8, 9]
					: completedStep >= 1
						? [2, 3]
						: [3],
		});
	}

	if (completedStep >= 3) {
		files.push({
			filename: 'config/initializers/opentelemetry.rb',
			language: 'ruby',
			code:
				completedStep >= 4
					? `require "opentelemetry/sdk"
require "opentelemetry/instrumentation/all"

OpenTelemetry::SDK.configure do |c|
  c.service_name = "myapp"
  c.use_all
end`
					: `require "opentelemetry/sdk"
require "opentelemetry/instrumentation/all"

# The SDK is loaded but configured to do nothing yet.`,
			highlight: completedStep >= 4 ? [4, 5, 6] : [4],
		});
	}

	if (completedStep >= 5) {
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: `# was: get "up" => "rails/health#show" (boot check only)
get "up" => "health#show", as: :rails_health_check`,
			highlight: [2],
		});
		files.push({
			filename: 'app/controllers/health_controller.rb',
			language: 'ruby',
			code: `class HealthController < ApplicationController
  allow_unauthenticated_access

  def show
    checks = HealthCheckService.call
    status = checks.values.all? ? :ok : :service_unavailable
    render json: checks, status: status
  end
end`,
			highlight: [2, 5, 6],
		});
		files.push({
			filename: 'app/services/health_check_service.rb',
			language: 'ruby',
			code: `class HealthCheckService < ApplicationService
  def call
    {
      database: database_alive?,
      job_worker: worker_alive?
    }
  end

  private

  def database_alive?
    ActiveRecord::Base.connection.execute("SELECT 1")
    true
  rescue ActiveRecord::ConnectionNotEstablished, ActiveRecord::StatementInvalid
    false
  end

  def worker_alive?
    # Solid Queue processes touch last_heartbeat_at every 60s;
    # a worker with no heartbeat for 5 minutes is gone (the
    # supervisor prunes it at the same threshold).
    SolidQueue::Process.where("last_heartbeat_at > ?", 5.minutes.ago).exists?
  end
end`,
			highlight: [4, 5, 12, 22],
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
	customers: 'CU',
	app: 'AP',
	logfile: 'LG',
	worker: 'JW',
	monitor: 'UM',
	traces: 'TR',
};

const ObsZoneNode = memo(function ObsZoneNode({
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

const ObsEdge = memo(function ObsEdge(props: EdgeProps) {
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

const obsNodeTypes = { obs: ObsZoneNode };
const obsEdgeTypes = { obs: ObsEdge };

const POSITIONS: Record<ZoneKey, { x: number; y: number }> = {
	customers: { x: 40, y: 170 },
	app: { x: 300, y: 170 },
	monitor: { x: 300, y: 20 },
	logfile: { x: 560, y: 90 },
	worker: { x: 560, y: 260 },
	traces: { x: 560, y: 400 },
};

const EDGE_DEFS: {
	id: EdgeKey;
	source: ZoneKey;
	target: ZoneKey;
	rewardOnly?: boolean;
}[] = [
	{ id: 'eCust', source: 'customers', target: 'app' },
	{ id: 'eMon', source: 'monitor', target: 'app' },
	{ id: 'eLog', source: 'app', target: 'logfile' },
	{ id: 'eWork', source: 'app', target: 'worker' },
	{ id: 'eTrace', source: 'app', target: 'traces', rewardOnly: true },
];

// ─── Main component ───────────────────────────────────────────────────

export function Level47Observability({ onComplete }: LevelComponentProps) {
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
		return (Object.keys(POSITIONS) as ZoneKey[])
			.filter((key) => key !== 'traces' || isReward)
			.map((key) => ({
				id: key,
				type: 'obs',
				position: POSITIONS[key],
				data: {
					...(zoneStates[key] ?? OBSERVE_ZONES[key] ?? REWARD_ZONES[key]),
					zoneKey: key,
				},
			}));
	}, [zoneStates, isReward]);

	const flowEdges: Edge[] = useMemo(() => {
		return EDGE_DEFS.filter((def) => !def.rewardOnly || isReward).map(
			(def) => ({
				id: def.id,
				source: def.source,
				target: def.target,
				type: 'obs',
				data: edgeStates[def.id] ?? DEFAULT_EDGE,
			}),
		);
	}, [edgeStates, isReward]);

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
				'Observability wired: one queryable JSON line per request with request and user context, spans naming where time goes, and a health check that reflects whether the system works, not just whether it booted.',
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
	const shuffledOptions = useMemo(
		() =>
			currentOptionConfig
				? shuffleOptions(currentOptionConfig.options, stepper.currentStep)
				: [],
		[currentOptionConfig, stepper.currentStep],
	);

	function renderCenter() {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					<div className="flex-1 relative">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={obsEdgeTypes}
							nodes={flowNodes}
							nodeTypes={obsNodeTypes}
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
							title="Incident Probe"
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
											'First: turn five lines of prose per request into one line a machine can query. Install the gem that does that.'}
										{stepper.currentStep === 3 &&
											'Logs say WHAT happened; a trace says WHERE the time went inside one request. Install the vendor-neutral tracing stack.'}
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
									{shuffledOptions.map((opt) =>
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
													: () => {
															stressTest.reset();
															setPhase('reward');
														}
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
						edgeTypes={obsEdgeTypes}
						nodes={flowNodes}
						nodeTypes={obsNodeTypes}
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
							The error tracker you wired up two levels ago catches everything
							that breaks. This week proved that plenty can go wrong without
							anything breaking: checkout crawled through the lunch rush, a
							customer's failed order could not be found in the logs, and a dead
							job worker went unnoticed for four hours while /up stayed green.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							None of it raised an exception, so none of it alerted anyone. Make
							the app observable: every request queryable, every second
							accounted for, and a health answer that means "working", not
							"booted".
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
									Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<Check className="w-4 h-4 text-success shrink-0" />
										<span className="text-foreground">
											Answered: the question took a query, not an afternoon
										</span>
									</div>
									<div className="flex items-center gap-2">
										<X className="w-4 h-4 text-destructive shrink-0" />
										<span className="text-foreground">
											Caught: deep /up returned 503 and the monitor paged
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
										<div className="text-xs text-success/70">Answered</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Caught</div>
									</div>
								</div>
							</div>
						</>
					)}
				</div>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Observability"
					levelNumber={47}
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
								? STEP_DEFS.length
								: -1,
					)}
					learningGoal="The error tracker catches what raises; observability covers what does not: slow requests, stuck queues, dead workers. Structured logs turn questions into queries (one JSON line per request, carrying request_id and user_id), traces name where the time goes inside a request, and a deepened /up answers 'is the system working' instead of 'did the process boot'."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level47Observability;
