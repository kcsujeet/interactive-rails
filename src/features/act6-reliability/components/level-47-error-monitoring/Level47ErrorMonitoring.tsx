/**
 * Level 47: Structured Error Monitoring
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): 2-node horizontal (Customer, Rails App).
 *   Errors happen in the app but go nowhere. No grouping, no context, no alerts.
 *   Probes show errors vanishing into stdout with no user_id or request_id.
 *
 * Phase 2 (HOW - build): 6 steps (all OptionCard)
 *   Configure error handler middleware, add context, configure grouping,
 *   set up alerting, implement error budgets, wire into middleware stack.
 *
 * Phase 3 (ADVANTAGE - reward): 3 nodes (Customer, Rails App, Error Monitor).
 *   Errors flow to the Error Monitor node which shows grouped errors with context.
 *   Stress test replays observe flows with monitoring applied.
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import { AlertTriangle, ArrowRight, Bell, Bug } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
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
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act6-level47-error-monitoring', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface CustomerVizState {
	label: string;
	flash: ZoneFlash;
}

interface AppVizState {
	label: string;
	flash: ZoneFlash;
	errorLog: string | null;
	errorCount: number;
}

interface MonitorVizState {
	label: string;
	flash: ZoneFlash;
	grouped: string | null;
	context: string | null;
	alertStatus: string | null;
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	customer?: Partial<CustomerVizState>;
	app?: Partial<AppVizState>;
	monitor?: Partial<MonitorVizState>;
	/** Customer <-> App edge */
	edge?: Partial<EdgeVizState>;
	/** App <-> Monitor edge (reward only) */
	edgeB?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_CUSTOMER: CustomerVizState = {
	label: 'Idle',
	flash: 'idle',
};

const DEFAULT_APP: AppVizState = {
	label: 'Idle',
	flash: 'idle',
	errorLog: null,
	errorCount: 0,
};

const DEFAULT_MONITOR: MonitorVizState = {
	label: 'Idle',
	flash: 'idle',
	grouped: null,
	context: null,
	alertStatus: null,
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-cyan-500',
};

const DEFAULT_APP_REWARD: AppVizState = {
	label: 'Monitoring active',
	flash: 'green',
	errorLog: null,
	errorCount: 0,
};

const DEFAULT_MONITOR_REWARD: MonitorVizState = {
	label: 'Listening',
	flash: 'green',
	grouped: 'By exception class',
	context: 'user_id, request_id',
	alertStatus: 'OK (0.0%)',
};

// ─── Discovery definitions ─────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'no-context', label: 'Errors lack user/request context' },
	{ id: 'no-grouping', label: 'Identical errors not grouped' },
	{ id: 'no-alerting', label: 'No alerting when error rate spikes' },
];

// ─── Probe definitions ─────────────────────────────────────────────────

const PROBES = [
	{
		id: 'unnoticed-500',
		label: 'Customer hits 500 error (unnoticed)',
		command: 'curl -X GET localhost:3000/api/v1/products/999',
		responseLines: [
			{
				text: '# ActiveRecord::RecordNotFound in ProductsController#show',
				color: 'red' as const,
			},
			{
				text: '# Request logged (L41), but exception not captured',
				color: 'yellow' as const,
			},
			{
				text: '# No error context, no grouping, no alert triggered',
				color: 'red' as const,
			},
			{
				text: '500 Internal Server Error',
				color: 'red' as const,
			},
		],
		story: [
			'Customer browses your store, clicks on product #999.',
			'Product was deleted last week. Rails raises RecordNotFound.',
			'L41 request logger captures the request, but not the exception itself.',
			'No error context: no user_id, no breadcrumbs, no stack trace captured.',
			'The team finds out when the customer tweets about it.',
		],
	},
	{
		id: 'duplicate-errors',
		label: 'Same error happens 50 times',
		command:
			'for i in {1..50}; do curl localhost:3000/api/v1/products/999; done',
		responseLines: [
			{
				text: '# 50 identical RecordNotFound errors in logs',
				color: 'yellow' as const,
			},
			{
				text: '# Each one looks like a separate, unique issue',
				color: 'red' as const,
			},
			{
				text: '# No grouping: 50 log lines, no count, no dedup',
				color: 'red' as const,
			},
			{
				text: '# Debugging means searching through a wall of text',
				color: 'red' as const,
			},
		],
		story: [
			'50 customers all hit the same deleted product.',
			'50 identical RecordNotFound errors flood the logs.',
			'Without grouping, each looks like a separate problem.',
			'A developer scanning logs sees 50 "different" errors.',
			'They waste time investigating each one individually.',
		],
	},
	{
		id: 'no-alert',
		label: 'Error rate crosses 1% (no alert)',
		command: 'ab -n 1000 -c 10 localhost:3000/api/v1/checkout',
		responseLines: [
			{
				text: '# 15 of 1000 requests returned 500 (1.5% error rate)',
				color: 'yellow' as const,
			},
			{
				text: '# Error budget exceeded: SLO is 99% (1% budget)',
				color: 'red' as const,
			},
			{
				text: '# No alerting configured. Nobody knows.',
				color: 'red' as const,
			},
			{
				text: '# Customers complain on Twitter 2 hours later.',
				color: 'red' as const,
			},
		],
		story: [
			'Traffic spike hits checkout endpoint.',
			'15 out of 1000 requests fail (1.5% error rate).',
			'Your SLO is 99% uptime, so the 1% error budget is blown.',
			'But no alert fires. Nobody on the team knows.',
			'Two hours later, a customer tweets "your checkout is broken."',
			'By then, 500+ orders were lost.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'unnoticed-500': ['no-context'],
	'duplicate-errors': ['no-grouping'],
	'no-alert': ['no-alerting'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Observe: 2 nodes only (Customer, App). No Monitor node.
// edge = Customer <-> App

const UNNOTICED_500_FRAMES: AnimFrame[] = [
	// Frame 0: Customer sends request
	{
		customer: { label: 'GET /products/999', flash: 'idle' },
		app: { label: 'Processing request...', flash: 'idle', errorCount: 0 },
		edge: {
			active: true,
			reverse: false,
			label: 'GET /api/v1/products/999',
			dotColor: 'bg-cyan-500',
		},
	},
	// Frame 1: App raises RecordNotFound
	{
		customer: { label: 'Waiting...', flash: 'idle' },
		app: {
			label: 'RecordNotFound!',
			flash: 'red',
			errorLog: 'puts error to stdout...',
			errorCount: 1,
		},
		edge: { active: false, label: '' },
	},
	// Frame 2: Error vanishes into logs, nobody notices
	{
		customer: { label: 'Waiting...', flash: 'amber' },
		app: {
			label: 'Error lost in stdout',
			flash: 'red',
			errorLog: 'No user_id, no request_id',
		},
	},
	// Frame 3: Customer gets 500
	{
		customer: { label: '500 error. Leaves site.', flash: 'red' },
		app: {
			label: 'Nobody noticed',
			flash: 'red',
			errorLog: 'Log scrolls away',
		},
		edge: {
			active: true,
			reverse: true,
			label: '500 Internal Server Error',
			dotColor: 'bg-red-500',
		},
	},
];

const DUPLICATE_ERRORS_FRAMES: AnimFrame[] = [
	// Frame 0: 50 requests arrive
	{
		customer: { label: '50 customers browsing', flash: 'idle' },
		app: { label: 'Processing requests...', flash: 'idle', errorCount: 0 },
		edge: {
			active: true,
			reverse: false,
			label: '50x GET /products/999',
			dotColor: 'bg-red-500',
		},
	},
	// Frame 1: Errors pile up
	{
		customer: { label: 'All getting errors...', flash: 'amber' },
		app: {
			label: '50 RecordNotFound errors',
			flash: 'red',
			errorLog: '50 separate log entries',
			errorCount: 50,
		},
		edge: { active: false, label: '' },
	},
	// Frame 2: No grouping, looks like 50 different issues
	{
		customer: { label: 'Frustrated customers', flash: 'red' },
		app: {
			label: 'No grouping!',
			flash: 'red',
			errorLog: '50 identical lines, no dedup',
		},
	},
	// Frame 3: Developer confused
	{
		customer: { label: '50 angry users', flash: 'red' },
		app: {
			label: 'Debug nightmare',
			flash: 'red',
			errorLog: 'Which error matters?',
		},
		edge: {
			active: true,
			reverse: true,
			label: '50x 500 errors',
			dotColor: 'bg-red-500',
		},
	},
];

const NO_ALERT_FRAMES: AnimFrame[] = [
	// Frame 0: Load test fires
	{
		customer: { label: '1000 checkout requests', flash: 'idle' },
		app: { label: 'High traffic...', flash: 'idle', errorCount: 0 },
		edge: {
			active: true,
			reverse: false,
			label: '1000 requests',
			dotColor: 'bg-cyan-500',
		},
	},
	// Frame 1: Error rate climbs
	{
		customer: { label: 'Some failing...', flash: 'amber' },
		app: {
			label: '15 errors / 1000 req',
			flash: 'amber',
			errorLog: 'Error rate: 1.5%',
			errorCount: 15,
		},
		edge: { active: false, label: '' },
	},
	// Frame 2: Budget exceeded, no alert
	{
		customer: { label: 'Checkout broken', flash: 'red' },
		app: {
			label: '1% budget exceeded!',
			flash: 'red',
			errorLog: 'No alert configured',
		},
	},
	// Frame 3: Twitter complaint hours later
	{
		customer: { label: 'Complains on Twitter', flash: 'red' },
		app: {
			label: 'Found out 2h later',
			flash: 'red',
			errorLog: 'Via customer tweet',
		},
		edge: {
			active: true,
			reverse: true,
			label: 'Twitter: "checkout broken"',
			dotColor: 'bg-red-500',
		},
	},
];

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'unnoticed-500': UNNOTICED_500_FRAMES,
	'duplicate-errors': DUPLICATE_ERRORS_FRAMES,
	'no-alert': NO_ALERT_FRAMES,
};

// ─── Reward animation frames ──────────────────────────────────────────
// Reward: 3 nodes (Customer, App, Monitor). edgeB = App <-> Monitor

const REWARD_CAPTURED_FRAMES: AnimFrame[] = [
	// Frame 0: Customer sends request
	{
		customer: { label: 'GET /products/999', flash: 'idle' },
		app: { label: 'Processing...', flash: 'idle', errorCount: 0 },
		monitor: { ...DEFAULT_MONITOR_REWARD },
		edge: {
			active: true,
			reverse: false,
			label: 'GET /api/v1/products/999',
			dotColor: 'bg-cyan-500',
		},
		edgeB: { active: false, label: '' },
	},
	// Frame 1: Error raised, captured with context
	{
		customer: { label: 'Waiting...', flash: 'idle' },
		app: {
			label: 'RecordNotFound! Captured.',
			flash: 'amber',
			errorLog: 'user_id: 42, req: abc123',
			errorCount: 1,
		},
		edge: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: false,
			label: 'Error + context',
			dotColor: 'bg-amber-500',
		},
		monitor: {
			label: 'Error received!',
			flash: 'amber',
			context: 'user:42, req:abc123',
		},
	},
	// Frame 2: Monitor groups and alerts
	{
		app: { label: 'Error reported', flash: 'green' },
		edgeB: { active: false, label: '' },
		monitor: {
			label: 'Grouped + alerted',
			flash: 'green',
			grouped: 'RecordNotFound (1)',
			alertStatus: 'Slack notified',
		},
	},
	// Frame 3: Customer gets clean error, team notified
	{
		customer: { label: '404 Not Found (clean)', flash: 'amber' },
		app: { label: 'Handled gracefully', flash: 'green' },
		edge: {
			active: true,
			reverse: true,
			label: '404 Not Found',
			dotColor: 'bg-amber-500',
		},
		monitor: {
			label: 'Team notified in 30s',
			flash: 'green',
			alertStatus: 'Alert sent',
		},
	},
];

const REWARD_GROUPED_FRAMES: AnimFrame[] = [
	// Frame 0: 50 requests arrive
	{
		customer: { label: '50 customers browsing', flash: 'idle' },
		app: { label: 'Processing...', flash: 'idle', errorCount: 0 },
		monitor: { ...DEFAULT_MONITOR_REWARD },
		edge: {
			active: true,
			reverse: false,
			label: '50x GET /products/999',
			dotColor: 'bg-red-500',
		},
		edgeB: { active: false, label: '' },
	},
	// Frame 1: Errors captured and forwarded to monitor
	{
		customer: { label: 'Getting errors...', flash: 'amber' },
		app: {
			label: '50 errors captured',
			flash: 'amber',
			errorLog: 'All with context',
			errorCount: 50,
		},
		edge: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: false,
			label: '50 errors with context',
			dotColor: 'bg-amber-500',
		},
		monitor: { label: 'Receiving errors...', flash: 'amber' },
	},
	// Frame 2: Monitor groups them into 1 entry
	{
		app: { label: 'All reported', flash: 'green' },
		edgeB: { active: false, label: '' },
		monitor: {
			label: '1 group, 50 occurrences',
			flash: 'green',
			grouped: 'RecordNotFound (50)',
			alertStatus: 'Critical: 50 hits',
		},
	},
	// Frame 3: Team sees one group, not 50 lines
	{
		customer: { label: 'Getting 404s (clean)', flash: 'amber' },
		app: { label: 'Handled gracefully', flash: 'green' },
		edge: {
			active: true,
			reverse: true,
			label: '50x 404 Not Found',
			dotColor: 'bg-amber-500',
		},
		monitor: {
			label: 'Fix the deleted product',
			flash: 'green',
			grouped: 'RecordNotFound (50)',
			context: '50 users affected',
		},
	},
];

const REWARD_BUDGET_FRAMES: AnimFrame[] = [
	// Frame 0: High traffic
	{
		customer: { label: '1000 checkout requests', flash: 'idle' },
		app: { label: 'High traffic...', flash: 'idle', errorCount: 0 },
		monitor: { ...DEFAULT_MONITOR_REWARD },
		edge: {
			active: true,
			reverse: false,
			label: '1000 requests',
			dotColor: 'bg-cyan-500',
		},
		edgeB: { active: false, label: '' },
	},
	// Frame 1: Errors accumulate, budget tracked
	{
		customer: { label: 'Some failing...', flash: 'amber' },
		app: {
			label: '15 errors captured',
			flash: 'amber',
			errorLog: 'All with breadcrumbs',
			errorCount: 15,
		},
		edge: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: false,
			label: '15 errors + context',
			dotColor: 'bg-amber-500',
		},
		monitor: {
			label: 'Budget tracking...',
			flash: 'amber',
			alertStatus: '1.5% (budget: 1%)',
		},
	},
	// Frame 2: Budget alert fires immediately
	{
		app: { label: 'Errors reported', flash: 'green' },
		edgeB: { active: false, label: '' },
		monitor: {
			label: 'BUDGET ALERT!',
			flash: 'red',
			alertStatus: 'EXCEEDED 1% budget',
			grouped: 'PaymentError (15)',
		},
	},
	// Frame 3: Team responds in minutes, not hours
	{
		customer: { label: 'Team fixing it', flash: 'amber' },
		app: { label: 'On-call paged', flash: 'green' },
		edge: { active: false, label: '' },
		monitor: {
			label: 'On-call paged at 1.5%',
			flash: 'green',
			alertStatus: 'PagerDuty notified',
			context: 'Fixed in 15 min',
		},
	},
];

const REWARD_BREADCRUMB_FRAMES: AnimFrame[] = [
	// Frame 0: Customer hits error with breadcrumbs
	{
		customer: { label: 'POST /checkout', flash: 'idle' },
		app: { label: 'Processing checkout...', flash: 'idle', errorCount: 0 },
		monitor: { ...DEFAULT_MONITOR_REWARD },
		edge: {
			active: true,
			reverse: false,
			label: 'POST /api/v1/checkout',
			dotColor: 'bg-cyan-500',
		},
		edgeB: { active: false, label: '' },
	},
	// Frame 1: Error with full breadcrumb trail
	{
		customer: { label: 'Waiting...', flash: 'idle' },
		app: {
			label: 'Stripe timeout! Captured.',
			flash: 'amber',
			errorLog: 'breadcrumbs: 5 steps',
			errorCount: 1,
		},
		edge: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: false,
			label: 'Error + breadcrumbs',
			dotColor: 'bg-amber-500',
		},
		monitor: {
			label: 'Full trace received',
			flash: 'amber',
			context: 'cart -> address -> pay',
		},
	},
	// Frame 2: Breadcrumbs show exact user journey
	{
		app: { label: 'Context attached', flash: 'green' },
		edgeB: { active: false, label: '' },
		monitor: {
			label: 'Breadcrumb trail',
			flash: 'green',
			grouped: 'Faraday::TimeoutError (1)',
			context: 'cart -> address -> pay',
			alertStatus: 'Stripe slow today',
		},
	},
	// Frame 3: Debug in minutes with full context
	{
		customer: { label: 'Try again message', flash: 'amber' },
		app: { label: 'Graceful fallback', flash: 'green' },
		edge: {
			active: true,
			reverse: true,
			label: '503 Try again later',
			dotColor: 'bg-amber-500',
		},
		monitor: {
			label: 'Root cause: Stripe',
			flash: 'green',
			alertStatus: 'Debugging: 5 min',
		},
	},
];

const REWARD_FRAME_MAP: Record<string, AnimFrame[]> = {
	'unnoticed-500': REWARD_CAPTURED_FRAMES,
	'duplicate-errors': REWARD_GROUPED_FRAMES,
	'no-alert': REWARD_BUDGET_FRAMES,
	breadcrumbs: REWARD_BREADCRUMB_FRAMES,
};

// ─── Build step definitions ────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'error-handler', title: 'Configure Error Handler Middleware' },
	{ id: 'error-context', title: 'Add Error Context' },
	{ id: 'error-grouping', title: 'Configure Error Grouping' },
	{ id: 'alerting', title: 'Set Up Alerting Thresholds' },
	{ id: 'error-budgets', title: 'Implement Error Budgets' },
	{ id: 'wire-middleware', title: 'Wire Into Middleware Stack' },
];

// Step 0: Configure error handler middleware
const ERROR_HANDLER_OPTIONS = [
	{
		id: 'wrong-rescue-only',
		name: 'rescue_from in ApplicationController',
		description: 'Catch errors in the controller layer only',
		correct: false,
		feedback:
			'rescue_from only catches controller-level errors. Errors in middleware, background jobs, and services are invisible to this approach.',
	},
	{
		id: 'wrong-begin-rescue',
		name: 'begin/rescue in every method',
		description: 'Wrap each method in its own error handler',
		correct: false,
		feedback:
			'Wrapping every method is unmaintainable and misses errors in middleware and framework code. You need a centralized error reporting layer.',
	},
	{
		id: 'correct',
		name: 'Rails.error.subscribe(ErrorSubscriber.new)',
		description: 'Subscribe a centralized error reporter to Rails.error',
		correct: true,
		feedback: '',
	},
];

// Step 1: Add error context
const ERROR_CONTEXT_OPTIONS = [
	{
		id: 'wrong-logger-tag',
		name: 'Rails.logger.tagged(user_id)',
		description: 'Tag logs with user_id for grep-based debugging',
		correct: false,
		feedback:
			'Logger tagging only helps with log searching. It does not attach structured context to error reports for grouping and alerting.',
	},
	{
		id: 'correct',
		name: 'Rails.error.set_context(user_id:, request_id:, breadcrumbs:)',
		description:
			'Attach structured context to all error reports via before_action',
		correct: true,
		feedback: '',
	},
	{
		id: 'wrong-thread-local',
		name: 'Thread.current[:user_id] = current_user.id',
		description: 'Store context in thread-local storage',
		correct: false,
		feedback:
			'Thread-local storage is fragile and leaks between requests in threaded servers. The framework provides a proper context API for this.',
	},
];

// Step 2: Configure error grouping
const ERROR_GROUPING_OPTIONS = [
	{
		id: 'wrong-by-message',
		name: 'Group by error.message',
		description: 'Group errors by their full message string',
		correct: false,
		feedback:
			'Error messages often include dynamic data (IDs, timestamps). Grouping by message creates thousands of "unique" groups for the same root cause.',
	},
	{
		id: 'wrong-by-controller',
		name: 'Group by controller#action',
		description: 'Group errors by the controller action that raised them',
		correct: false,
		feedback:
			'Grouping by controller merges different exception types into one group. A RecordNotFound and a Timeout in the same action are different problems.',
	},
	{
		id: 'correct',
		name: 'Group by exception class + controller#action fingerprint',
		description: 'Combine exception class and origin for accurate dedup',
		correct: true,
		feedback: '',
	},
];

// Step 3: Set up alerting thresholds
const ALERTING_OPTIONS = [
	{
		id: 'wrong-every-error',
		name: 'Alert on every single error',
		description: 'Send a Slack message for each error occurrence',
		correct: false,
		feedback:
			'Alerting on every error causes alert fatigue. 50 identical errors means 50 notifications. The team starts ignoring alerts entirely.',
	},
	{
		id: 'correct',
		name: 'Alert on new error groups + rate thresholds',
		description:
			'Notify on first occurrence of a new group, then on rate spikes',
		correct: true,
		feedback: '',
	},
	{
		id: 'wrong-daily-digest',
		name: 'Daily email digest of all errors',
		description: 'Send a summary email once per day',
		correct: false,
		feedback:
			'Daily digests mean you discover production problems up to 24 hours late. Customers will find the bug long before your team does.',
	},
];

// Step 4: Implement error budgets
const ERROR_BUDGET_OPTIONS = [
	{
		id: 'wrong-zero-errors',
		name: 'Target: zero errors in production',
		description: 'Any error means something is broken, aim for zero',
		correct: false,
		feedback:
			'Zero errors is unrealistic. Bots, bad inputs, and network blips cause errors in healthy systems. An error budget sets a realistic threshold.',
	},
	{
		id: 'wrong-fixed-count',
		name: 'Alert when errors > 100 per hour',
		description: 'Fixed count threshold for alerting',
		correct: false,
		feedback:
			'Fixed counts do not scale with traffic. 100 errors during 1M requests is fine (0.01%), but 100 errors during 1000 requests is a crisis (10%).',
	},
	{
		id: 'correct',
		name: 'Error budget: 1% of requests (SLO 99%)',
		description: 'Percentage-based budget that scales with traffic volume',
		correct: true,
		feedback: '',
	},
];

// Step 5: Wire into middleware stack
const WIRE_MIDDLEWARE_OPTIONS = [
	{
		id: 'wrong-after-routing',
		name: 'config.middleware.use ErrorReporter',
		description: 'Append error reporter to end of middleware stack',
		correct: false,
		feedback:
			'Appending to the end means errors in earlier middleware are missed. The error reporter must wrap the entire stack to catch everything.',
	},
	{
		id: 'correct',
		name: 'config.middleware.insert_before 0, ErrorReporter',
		description: 'Insert at the top to wrap all other middleware',
		correct: true,
		feedback: '',
	},
	{
		id: 'wrong-initializer',
		name: 'Rails.application.config.after_initialize { ErrorReporter.start }',
		description: 'Start the reporter in an initializer',
		correct: false,
		feedback:
			'An initializer starts the reporter but does not insert it into the middleware stack. Without middleware wrapping, errors in the Rack pipeline are invisible.',
	},
];

// ─── Terminal step map (all OptionCard, so all null) ──────────────────

const _TERMINAL_STEP_MAP: null[] = [
	null, // step 0: OptionCard
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
	null, // step 5: OptionCard
];

// ─── Stress test scenarios ─────────────────────────────────────────────

const STRESS_SCENARIOS = [
	{
		id: 'unnoticed-500',
		label: 'Customer hits 500 error (unnoticed)',
		description: 'Same 500 error, now captured with full context and alert',
		method: 'GET',
		path: '/api/v1/products/999',
		actor: 'customer',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: 'GET /api/v1/products/999 -> RecordNotFound', color: 'cyan' },
			{ text: 'Context: user_id=42, request_id=abc123', color: 'green' },
			{
				text: 'Grouped: RecordNotFound in ProductsController#show',
				color: 'green',
			},
			{ text: 'Alert: Slack notification sent in 30s', color: 'green' },
		],
		story: [
			'Same customer, same deleted product, same RecordNotFound.',
			'But now the error is captured with user_id and request_id.',
			'Grouped into "RecordNotFound in ProductsController#show".',
			'Team gets a Slack alert within 30 seconds.',
			'Customer gets a clean 404 instead of a cryptic 500.',
		],
	},
	{
		id: 'duplicate-errors',
		label: 'Same error happens 50 times',
		description: 'Same 50 errors, now grouped into 1 entry with count',
		method: 'GET',
		path: '/api/v1/products/999',
		actor: 'customer',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '50x RecordNotFound -> 1 error group', color: 'cyan' },
			{ text: 'Group: RecordNotFound (50 occurrences)', color: 'green' },
			{ text: 'Context: 50 unique user_ids affected', color: 'green' },
			{ text: 'Priority: Critical (highest frequency group)', color: 'red' },
		],
		story: [
			'Same 50 customers, same deleted product.',
			'But now all 50 errors collapse into a single group.',
			'Dashboard shows: "RecordNotFound, 50 occurrences, 50 users."',
			'Developer sees one issue to fix, not 50 mysterious log lines.',
			'Fix the deleted product reference, resolve 50 errors at once.',
		],
	},
	{
		id: 'no-alert',
		label: 'Error rate crosses 1% (with alert)',
		description: 'Same traffic spike, but error budget alert fires immediately',
		method: 'POST',
		path: '/api/v1/checkout',
		actor: 'customer',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '15/1000 requests failed (1.5% error rate)', color: 'cyan' },
			{ text: 'Error budget: 1% exceeded! (1.5%)', color: 'red' },
			{ text: 'Alert: PagerDuty on-call paged immediately', color: 'green' },
			{ text: 'Team responding within 5 minutes', color: 'green' },
		],
		story: [
			'Same traffic spike, same 15 failures.',
			'But now the error budget monitor catches it instantly.',
			'At 1.5% error rate, the 1% budget threshold is breached.',
			'PagerDuty pages the on-call engineer within seconds.',
			'Team responds in 5 minutes, not 2 hours from a tweet.',
		],
	},
	{
		id: 'breadcrumbs',
		label: 'Error with breadcrumbs',
		description: 'Stripe timeout captured with full user journey breadcrumbs',
		method: 'POST',
		path: '/api/v1/checkout',
		actor: 'customer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'POST /api/v1/checkout -> Faraday::TimeoutError', color: 'cyan' },
			{
				text: 'Breadcrumbs: cart -> address -> payment -> stripe',
				color: 'green',
			},
			{
				text: 'Context: user_id=99, cart_id=456, amount=$89.00',
				color: 'green',
			},
			{ text: 'Root cause identified: Stripe API slow (>10s)', color: 'green' },
		],
		story: [
			'Customer goes through checkout: cart, address, payment.',
			'Stripe times out during the payment step.',
			'Error captured with full breadcrumb trail of the user journey.',
			'Developer sees exactly where the failure happened in the flow.',
			'Root cause: Stripe API is slow today, not a code bug.',
		],
	},
];

// ─── Code preview builder ──────────────────────────────────────────────

function getCodeFiles(
	phase: 'observe' | 'build' | 'reward',
	completedStep: number,
) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/controllers/application_controller.rb',
				language: 'ruby',
				code: `class ApplicationController < ActionController::API
  # No error monitoring configured
  # Errors go to Rails.logger (stdout) and vanish

  rescue_from StandardError do |e|
    Rails.logger.error(e.message)
    # No user_id, no request_id, no breadcrumbs
    # No grouping, no alerting, no error budgets
    render json: { error: "Internal error" },
      status: :internal_server_error
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (completedStep < 0) {
			return [
				{
					filename: 'app/controllers/application_controller.rb',
					language: 'ruby',
					code: `class ApplicationController < ActionController::API
  # Errors go to stdout with no structure...
  # Step 1: Configure a centralized error reporter
end`,
				},
			];
		}

		if (completedStep >= 0) {
			files.push({
				filename: 'config/initializers/error_subscriber.rb',
				language: 'ruby',
				code: `# Centralized error reporting
Rails.error.subscribe(ErrorSubscriber.new)

class ErrorSubscriber
  def report(error, handled:, severity:, context:, source:)
    ErrorTracker.record(
      exception_class: error.class.name,
      message: error.message,
      severity: severity,
      handled: handled
    )
  end
end`,
			});
		}

		if (completedStep >= 1) {
			files.push({
				filename: 'app/controllers/application_controller.rb',
				language: 'ruby',
				code: `class ApplicationController < ActionController::API
  before_action :set_error_context

  private

  def set_error_context
    Rails.error.set_context(
      user_id: current_user&.id,
      request_id: request.request_id,
      breadcrumbs: []
    )
  end
end`,
			});
		}

		if (completedStep >= 2) {
			files.push({
				filename: 'app/services/error_tracker.rb',
				language: 'ruby',
				code: `class ErrorTracker
  def self.record(exception_class:, message:, severity:, handled:, context: {})
    fingerprint = [
      exception_class,
      context[:controller_action]
    ].compact.join(":")

    group = ErrorGroup.find_or_create_by(fingerprint: fingerprint)
    group.increment!(:occurrence_count)
    group.update!(last_seen_at: Time.current)${
			completedStep >= 3
				? `

    check_alert_thresholds(group)`
				: ''
		}${
			completedStep >= 4
				? `
    check_error_budget`
				: ''
		}
  end
end`,
			});
		}

		if (completedStep >= 5) {
			files.push({
				filename: 'config/application.rb',
				language: 'ruby',
				code: `module MyApp
  class Application < Rails::Application
    config.load_defaults 8.0

    # Error reporter at the top of the middleware stack
    config.middleware.insert_before 0, ErrorReporter

    config.api_only = true
  end
end`,
			});
		}

		return files;
	}

	// reward
	return [
		{
			filename: 'config/initializers/error_subscriber.rb',
			language: 'ruby',
			code: `# Rails 8 Error Reporter
Rails.error.subscribe(ErrorSubscriber.new)

class ErrorSubscriber
  def report(error, handled:, severity:, context:, source:)
    ErrorTracker.record(
      exception_class: error.class.name,
      message: error.message,
      severity: severity,
      user_id: context[:user_id],
      request_id: context[:request_id],
      breadcrumbs: context[:breadcrumbs],
      handled: handled
    )
  end
end`,
		},
		{
			filename: 'app/controllers/application_controller.rb',
			language: 'ruby',
			code: `class ApplicationController < ActionController::API
  before_action :set_error_context

  private

  def set_error_context
    Rails.error.set_context(
      user_id: current_user&.id,
      request_id: request.request_id,
      breadcrumbs: []
    )
  end
end`,
		},
		{
			filename: 'app/services/error_tracker.rb',
			language: 'ruby',
			code: `class ErrorTracker
  def self.record(exception_class:, message:, severity:,
                   user_id: nil, request_id: nil,
                   breadcrumbs: [], handled: false)
    fingerprint = [
      exception_class,
      context[:controller_action]
    ].compact.join(":")

    group = ErrorGroup.find_or_create_by(fingerprint: fingerprint)
    group.increment!(:occurrence_count)
    group.update!(last_seen_at: Time.current)

    check_alert_thresholds(group)
    check_error_budget
  end

  def self.check_alert_thresholds(group)
    if group.occurrence_count == 1
      AlertService.notify(:new_error, group)
    end
    if group.occurrence_count_in_window(5.minutes) > 10
      AlertService.notify(:rate_spike, group)
    end
  end

  def self.check_error_budget
    rate = ErrorBudget.current_error_rate
    if rate > 0.01 # 1% budget
      AlertService.page_oncall(:budget_exceeded, rate)
    end
  end
end`,
		},
		{
			filename: 'config/application.rb',
			language: 'ruby',
			code: `module MyApp
  class Application < Rails::Application
    config.load_defaults 8.0

    # Error reporter wraps entire middleware stack
    config.middleware.insert_before 0, ErrorReporter

    config.api_only = true
  end
end`,
		},
	];
}

// ─── Custom React Flow nodes ──────────────────────────────────────────

function flashToStatus(flash: ZoneFlash): FlowNodeData['status'] {
	if (flash === 'green') return 'active';
	if (flash === 'amber') return 'warning';
	if (flash === 'red') return 'error';
	return 'idle';
}

interface CustomerNodeData extends CustomerVizState {
	[key: string]: unknown;
}

const CustomerNode = memo(({ data }: { data: CustomerNodeData }) => {
	const d = data as CustomerNodeData;
	const flowData: FlowNodeData = {
		label: 'Customer',
		icon: 'CU',
		color: '#3b82f6',
		status: flashToStatus(d.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<>
			<FlowHandles />
			<FlowNode data={flowData}>
				<p className="text-xs text-foreground font-medium truncate">
					{d.label}
				</p>
			</FlowNode>
		</>
	);
});

interface AppNodeData extends AppVizState {
	[key: string]: unknown;
}

const AppNode = memo(({ data }: { data: AppNodeData }) => {
	const d = data as AppNodeData;
	const flowData: FlowNodeData = {
		label: 'Rails App',
		icon: 'RA',
		color: '#8b5cf6',
		status: flashToStatus(d.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<>
			<FlowHandles />
			<FlowNode data={flowData}>
				<p className="text-xs text-foreground font-medium truncate">
					{d.label}
				</p>
				{d.errorLog && (
					<p className="text-[10px] text-muted-foreground mt-1 truncate">
						{d.errorLog}
					</p>
				)}
				{d.errorCount > 0 && (
					<div className="mt-1.5 flex items-center gap-1.5">
						<Bug className="w-3 h-3 text-red-500 dark:text-red-400" />
						<span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
							{d.errorCount} error{d.errorCount !== 1 ? 's' : ''}
						</span>
					</div>
				)}
			</FlowNode>
		</>
	);
});

interface MonitorNodeData extends MonitorVizState {
	[key: string]: unknown;
}

const MonitorNode = memo(({ data }: { data: MonitorNodeData }) => {
	const d = data as MonitorNodeData;
	const flowData: FlowNodeData = {
		label: 'Error Monitor',
		icon: 'EM',
		color: '#6366f1',
		status: flashToStatus(d.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<>
			<FlowHandles />
			<FlowNode data={flowData}>
				<p className="text-xs text-foreground font-medium truncate">
					{d.label}
				</p>
				{d.grouped && (
					<div className="mt-1.5 flex items-center gap-1">
						<Bug className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
						<span className="text-[10px] text-foreground truncate">
							{d.grouped}
						</span>
					</div>
				)}
				{d.context && (
					<p className="text-[10px] text-muted-foreground mt-0.5 truncate">
						{d.context}
					</p>
				)}
				{d.alertStatus && (
					<div className="mt-1.5 flex items-center gap-1">
						{d.alertStatus.startsWith('EXCEEDED') ||
						d.alertStatus.startsWith('Critical') ? (
							<AlertTriangle className="w-3 h-3 text-red-500 dark:text-red-400 shrink-0" />
						) : (
							<Bell className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" />
						)}
						<span className="text-[10px] font-semibold text-foreground truncate">
							{d.alertStatus}
						</span>
					</div>
				)}
			</FlowNode>
		</>
	);
});

// ─── Custom edge ──────────────────────────────────────────────────────

function toDotFill(twClass: string): string {
	if (twClass.includes('emerald')) return '#10b981';
	if (twClass.includes('red')) return '#ef4444';
	if (twClass.includes('amber')) return '#f59e0b';
	if (twClass.includes('cyan')) return '#06b6d4';
	return '#a1a1aa';
}

interface ErrorEdgeData extends EdgeVizState {
	[key: string]: unknown;
}

const ErrorEdge = memo(
	({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
		const d = (data ?? DEFAULT_EDGE) as ErrorEdgeData;
		const [edgePath, labelX, labelY] = getStraightPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
		});

		const fill = toDotFill(d.dotColor);
		const dotPath = d.reverse ? reversePath(edgePath) : edgePath;

		const dots: DotConfig[] = d.active
			? [0, 1, 2].map((i) => ({
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
						strokeDasharray: '6 4',
					}}
				/>
				{dots.length > 0 && <AnimatedDots dots={dots} path={dotPath} />}
				{d.label && (
					<EdgeLabelRenderer>
						<div
							className="nodrag nopan pointer-events-none absolute text-[10px] font-mono text-foreground bg-background/90 px-1.5 py-0.5 rounded border border-border max-w-64 text-center whitespace-nowrap"
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
	},
);

const errorNodeTypes = {
	customer: CustomerNode,
	app: AppNode,
	monitor: MonitorNode,
};
const errorEdgeTypes = { error: ErrorEdge };

// ─── Build step options map ─────────────────────────────────────────────

const STEP_OPTIONS: Record<number, typeof ERROR_HANDLER_OPTIONS> = {
	0: ERROR_HANDLER_OPTIONS,
	1: ERROR_CONTEXT_OPTIONS,
	2: ERROR_GROUPING_OPTIONS,
	3: ALERTING_OPTIONS,
	4: ERROR_BUDGET_OPTIONS,
	5: WIRE_MIDDLEWARE_OPTIONS,
};

const STEP_DESCRIPTIONS: Record<number, string> = {
	0: 'How should the app capture and report errors from all layers, not just controllers?',
	1: 'What context should be attached to every error so you can trace it back to a specific user and request?',
	2: 'How should identical errors be grouped so 50 occurrences show as one issue, not 50 separate ones?',
	3: 'When should the team be notified about errors? Every single one, or something smarter?',
	4: 'How should you measure whether your error rate is acceptable? A fixed count or a percentage?',
	5: 'Where in the middleware stack should the error reporter go to catch all errors?',
};

// ─── Main component ────────────────────────────────────────────────────

export function Level47ErrorMonitoring({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<'observe' | 'build' | 'reward'>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [customerState, setCustomerState] =
		useState<CustomerVizState>(DEFAULT_CUSTOMER);
	const [appState, setAppState] = useState<AppVizState>(DEFAULT_APP);
	const [monitorState, setMonitorState] =
		useState<MonitorVizState>(DEFAULT_MONITOR);
	const [edgeState, setEdgeState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBState, setEdgeBState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setCustomerState(DEFAULT_CUSTOMER);
		setAppState(isReward ? DEFAULT_APP_REWARD : DEFAULT_APP);
		setMonitorState(isReward ? DEFAULT_MONITOR_REWARD : DEFAULT_MONITOR);
		setEdgeState(DEFAULT_EDGE);
		setEdgeBState(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.customer)
			setCustomerState((prev) => ({ ...prev, ...frame.customer }));
		if (frame.app) setAppState((prev) => ({ ...prev, ...frame.app }));
		if (frame.monitor)
			setMonitorState((prev) => ({ ...prev, ...frame.monitor }));
		if (frame.edge) setEdgeState((prev) => ({ ...prev, ...frame.edge }));
		if (frame.edgeB) setEdgeBState((prev) => ({ ...prev, ...frame.edgeB }));
	}, []);

	const runAnimation = useCallback(
		(frames: AnimFrame[], onDone?: () => void, frameDelay?: number) => {
			const delay = frameDelay ?? ANIMATION_DURATION_MS;
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
			resetViz();
			setVizAnimating(true);

			const newTimers: ReturnType<typeof setTimeout>[] = [];
			for (let i = 0; i < frames.length; i++) {
				const t = setTimeout(() => applyFrame(frames[i]), i * delay);
				newTimers.push(t);
			}
			// Stop all dots after last frame
			const tCleanup = setTimeout(() => {
				setEdgeState((prev) => ({ ...prev, active: false }));
				setEdgeBState((prev) => ({ ...prev, active: false }));
			}, frames.length * delay);
			newTimers.push(tCleanup);
			const tEnd = setTimeout(
				() => {
					setVizAnimating(false);
					onDone?.();
				},
				frames.length * delay + 100,
			);
			newTimers.push(tEnd);
			timersRef.current = newTimers;
		},
		[resetViz, applyFrame],
	);

	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, []);

	// ── Observe phase ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});

	const handleProbe = useCallback(
		(probeId: string) => {
			if (vizAnimating) return;
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}
			const frames = PROBE_FRAMES[probeId];
			if (frames) runAnimation(frames, undefined, ANIMATION_DURATION_MS * 1.5);
		},
		[vizAnimating, discoveryGating, runAnimation],
	);

	// ── Build phase ──
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const options = STEP_OPTIONS[stepper.currentStep];
			if (!options) return;
			const option = options.find((o) => o.id === optionId);
			if (!option) return;
			if (option.correct) {
				setWrongFeedback(null);
				stepper.completeStep();
			} else {
				setWrongFeedback(option.feedback ?? 'Not quite right.');
				stepper.recordWrongAttempt(option.feedback ?? 'Not quite right.');
			}
		},
		[stepper],
	);

	// ── Reward phase ──
	const stressTest = useStressTest(STRESS_SCENARIOS);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_FRAME_MAP[scenarioId];
			if (frames) {
				setCustomerState(DEFAULT_CUSTOMER);
				setAppState(DEFAULT_APP_REWARD);
				setMonitorState(DEFAULT_MONITOR_REWARD);
				setEdgeState(DEFAULT_EDGE);
				setEdgeBState(DEFAULT_EDGE);
				runAnimation(frames, undefined, ANIMATION_DURATION_MS * 1.5);
			}
		},
		[vizAnimating, stressTest, runAnimation],
	);

	// ── Header handlers ──
	const handleValidate = useCallback((): ValidationResult => {
		if (phase !== 'reward') {
			return { valid: false, message: 'Complete all phases first.' };
		}
		if (stressTest.results.length < 3) {
			return {
				valid: false,
				message: 'Fire at least 3 stress test scenarios.',
			};
		}
		return {
			valid: true,
			message: 'Structured error monitoring configured!',
		};
	}, [phase, stressTest.results.length]);

	const handleComplete = useCallback(() => {
		onComplete?.({ stars: stepper.starRating });
	}, [onComplete, stepper.starRating]);

	const handleReset = useCallback(() => {
		setPhase('observe');
		setVizAnimating(false);
		resetViz();
		stressTest.reset();
		for (const t of timersRef.current) clearTimeout(t);
		timersRef.current = [];
	}, [resetViz, stressTest]);

	// ── Flow nodes & edges ──
	const flowNodes = useMemo((): Node[] => {
		const nodes: Node[] = [
			{
				id: 'customer',
				type: 'customer',
				position: { x: 0, y: 30 },
				data: { ...customerState } satisfies CustomerNodeData,
			},
			{
				id: 'app',
				type: 'app',
				position: { x: 260, y: 15 },
				data: { ...appState } satisfies AppNodeData,
			},
		];

		if (isReward) {
			nodes.push({
				id: 'monitor',
				type: 'monitor',
				position: { x: 550, y: 0 },
				data: { ...monitorState } satisfies MonitorNodeData,
			});
		}

		return nodes;
	}, [customerState, appState, monitorState, isReward]);

	const flowEdges = useMemo((): Edge[] => {
		const edges: Edge[] = [
			{
				id: 'e-customer-app',
				source: 'customer',
				target: 'app',
				type: 'error',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edgeState } satisfies ErrorEdgeData,
			},
		];

		if (isReward) {
			edges.push({
				id: 'e-app-monitor',
				source: 'app',
				target: 'monitor',
				type: 'error',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edgeBState } satisfies ErrorEdgeData,
			});
		}

		return edges;
	}, [edgeState, edgeBState, isReward]);

	// ── Build step config ──
	const buildCodePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	const shuffledOptions = useMemo(() => {
		const options = STEP_OPTIONS[stepper.currentStep];
		if (!options) return [];
		return shuffleOptions(options, stepper.currentStep);
	}, [stepper.currentStep]);

	// ── Render ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground">
							Your request logger from Level 41 captures requests, but when
							exceptions occur, they vanish into the log with no error-specific
							context. Nobody notices 500 errors until customers complain.
						</p>
					</div>
					<DiscoveryChecklist
						discoveredCount={discoveryGating.discoveredCount}
						discoveries={discoveryGating.discoveries}
						minRequired={discoveryGating.minRequired}
					/>
					{discoveryGating.isUnlocked && (
						<Button
							className="w-full animate-in fade-in duration-500"
							onClick={() => setPhase('build')}
						>
							Build the Fix <ArrowRight className="w-4 h-4 ml-2" />
						</Button>
					)}
				</div>
			);
		}

		if (phase === 'build') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Building
						</h3>
						<p className="text-sm text-muted-foreground">
							Set up structured error monitoring: centralized reporting, context
							enrichment, grouping, alerting, and error budgets.
						</p>
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						steps={stepper.steps}
					/>
				</div>
			);
		}

		// reward
		return (
			<div className="space-y-4 p-4">
				<div>
					<h3 className="text-sm font-semibold text-foreground mb-2">Legend</h3>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-emerald-500" />
							<span className="text-muted-foreground">Error captured</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">Alert triggered</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Captured</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Alerted</div>
					</div>
				</div>
				{stressTest.canAutoFire && (
					<Button
						className="w-full"
						onClick={() => stressTest.toggleAutoFire(handleFireScenario)}
						variant="outline"
					>
						{stressTest.isAutoFiring ? 'Stop Auto-Fire' : 'Auto-Fire All'}
					</Button>
				)}
			</div>
		);
	};

	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					<div className="flex-1 relative">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={errorEdgeTypes}
							nodes={flowNodes}
							nodeTypes={errorNodeTypes}
						/>
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={vizAnimating}
							onProbe={handleProbe}
							probes={PROBES}
						/>
					</div>
				</div>
			);
		}

		if (phase === 'build') {
			return (
				<div className="flex-1 flex flex-col p-4 gap-4 overflow-auto min-h-0">
					<div>
						<h3 className="text-lg font-semibold text-foreground">
							{STEP_DEFS[stepper.currentStep].title}
						</h3>
						<p className="text-sm text-muted-foreground mt-1">
							{STEP_DESCRIPTIONS[stepper.currentStep]}
						</p>
					</div>
					{wrongFeedback && !stepper.isCurrentStepCompleted && (
						<ErrorFeedback message={wrongFeedback} />
					)}
					<div className="space-y-3">
						{shuffledOptions.map((opt) => (
							<OptionCard
								description={opt.description}
								disabled={stepper.isCurrentStepCompleted}
								key={opt.id}
								name={opt.name}
								onClick={() => handleOptionSelect(opt.id)}
								selected={stepper.isCurrentStepCompleted && opt.correct}
							/>
						))}
					</div>
					{stepper.isCurrentStepCompleted && (
						<Button
							className="w-fit gap-2"
							onClick={
								stepper.currentStep < STEP_DEFS.length - 1
									? () => {
											setWrongFeedback(null);
											stepper.nextStep();
										}
									: () => setPhase('reward')
							}
							size="sm"
						>
							Next Step <ArrowRight className="w-4 h-4" />
						</Button>
					)}
				</div>
			);
		}

		// reward
		return (
			<div className="flex-1 flex flex-col">
				<div className="flex-1 relative">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={errorEdgeTypes}
						nodes={flowNodes}
						nodeTypes={errorNodeTypes}
					/>
				</div>
				<div className="flex-1 min-h-0 flex flex-col px-6 pb-2">
					<StressTestPanel
						allowedCount={stressTest.allowedCount}
						blockedCount={stressTest.blockedCount}
						canAutoFire={stressTest.canAutoFire}
						className="flex-1 flex flex-col"
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
	};

	return (
		<LevelLayout>
			<LeftPanel>{renderLeftPanel()}</LeftPanel>
			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Error Monitoring"
					levelNumber={47}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={handleValidate}
				/>
				{renderCenterPanel()}
			</CenterPanel>
			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(phase, buildCodePreviewStep)}
					learningGoal="Rails.error provides a unified error reporting interface. Subscribe to errors, enrich context, and configure grouping, alerts, and budgets."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level47ErrorMonitoring;
