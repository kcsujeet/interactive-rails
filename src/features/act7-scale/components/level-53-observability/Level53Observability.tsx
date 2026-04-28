/**
 * Level 51: Observability
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): Split-view visualization with 4 nodes:
 *   unstructured-log (active, scrolling text), structured-log (grayed),
 *   trace-timeline (grayed), health-endpoint (grayed/missing).
 *   Probes reveal lack of structured search, correlation, tracing, and health checks.
 *
 * Phase 2 (HOW - build): 6 steps (2 terminal + 4 OptionCard)
 *   Step 0: bundle add lograge (terminal)
 *   Step 1: Configure Lograge JSON formatter (OptionCard)
 *   Step 2: Add custom log fields (OptionCard)
 *   Step 3: bundle add opentelemetry-sdk opentelemetry-instrumentation-all (terminal)
 *   Step 4: Configure OpenTelemetry with use_all (OptionCard)
 *   Step 5: Add health check endpoint (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Visualization transforms: structured logs (JSON,
 *   highlighted), trace timeline showing spans, health endpoint green.
 *   6 stress scenarios (all allowed). Diagnosed counter (green).
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import { Activity, ArrowRight, FileText, Heart } from 'lucide-react';
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

registerLevelCode('act7-level53-observability', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface LogNodeData {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
	isStructured: boolean;
}

interface TraceNodeData {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
}

interface HealthNodeData {
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

interface AnimFrame {
	unstructuredLog?: Partial<LogNodeData>;
	structuredLog?: Partial<LogNodeData>;
	trace?: Partial<TraceNodeData>;
	health?: Partial<HealthNodeData>;
	edgeA?: Partial<EdgeVizState>;
	edgeB?: Partial<EdgeVizState>;
	edgeC?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_UNSTRUCTURED: LogNodeData = {
	label: 'Current Logs',
	flash: 'red',
	sublabel: 'Unstructured text output',
	badge: null,
	isStructured: false,
};

const DEFAULT_STRUCTURED: LogNodeData = {
	label: 'Structured Logs',
	flash: 'idle',
	sublabel: 'Not configured',
	badge: null,
	isStructured: true,
};

const DEFAULT_TRACE: TraceNodeData = {
	label: 'Trace Timeline',
	flash: 'idle',
	sublabel: 'Not configured',
	badge: null,
};

const DEFAULT_HEALTH: HealthNodeData = {
	label: 'Health Endpoint',
	flash: 'idle',
	sublabel: 'Missing (404)',
	badge: null,
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: '#ef4444',
};

const DEFAULT_UNSTRUCTURED_REWARD: LogNodeData = {
	label: 'Lograge (JSON)',
	flash: 'green',
	sublabel: 'Structured, searchable',
	badge: null,
	isStructured: true,
};

const DEFAULT_STRUCTURED_REWARD: LogNodeData = {
	label: 'Custom Fields',
	flash: 'green',
	sublabel: 'tenant_id, request_id, user_id',
	badge: null,
	isStructured: true,
};

const DEFAULT_TRACE_REWARD: TraceNodeData = {
	label: 'OpenTelemetry',
	flash: 'green',
	sublabel: 'Distributed tracing active',
	badge: null,
};

const DEFAULT_HEALTH_REWARD: HealthNodeData = {
	label: '/up',
	flash: 'green',
	sublabel: 'All components healthy',
	badge: null,
};

// ─── Discovery definitions ────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'no-structured-search', label: 'Cannot search logs by field' },
	{ id: 'no-correlation', label: 'No request_id to correlate errors' },
	{ id: 'no-tracing', label: 'No tracing to find bottlenecks' },
	{ id: 'no-health-check', label: 'No health check endpoint' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'find-slow-request',
		label: 'Search logs for slow requests',
		command: 'grep "duration" log/production.log | sort -t= -k2 -rn | head -5',
		responseLines: [
			{
				text: 'Started GET "/api/v1/products" at 2024-03-15 14:22:33',
				color: 'muted',
			},
			{
				text: 'Processing by ProductsController#index as JSON',
				color: 'muted',
			},
			{ text: 'Completed 200 OK in 2841ms', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: 'No structured duration field. Cannot sort or filter by latency.',
				color: 'red',
			},
			{
				text: 'grep only finds text patterns, not queryable metrics.',
				color: 'red',
			},
		],
		story: [
			'You need to find which requests are slow.',
			'grep for "duration" returns multi-line unstructured text.',
			'No JSON fields to sort by. Parsing is brittle and error-prone.',
			'With structured logs, you could query: duration > 1000ms.',
			'Currently impossible to build dashboards or alerts on this data.',
		],
	},
	{
		id: 'correlate-error',
		label: 'Correlate error to originating request',
		command: 'grep "NoMethodError" log/production.log',
		responseLines: [
			{
				text: 'NoMethodError (undefined method `total` for nil:NilClass)',
				color: 'red',
			},
			{ text: '  app/services/checkout_service.rb:42', color: 'muted' },
			{ text: '', color: 'muted' },
			{
				text: 'Which request caused this? No request_id in the log line.',
				color: 'red',
			},
			{
				text: 'Cannot link this error to a specific user or request.',
				color: 'red',
			},
		],
		story: [
			'An error appears in production logs: NoMethodError.',
			'You see the stack trace, but not which request triggered it.',
			'No request_id, no user_id, no tenant_id in the log output.',
			'You cannot tell which customer was affected.',
			'Without correlation IDs, debugging requires guesswork.',
		],
	},
	{
		id: 'find-bottleneck',
		label: 'Find where time is spent in a request',
		command:
			'curl -w "\\nTotal: %{time_total}s\\n" localhost:3000/api/v1/checkout',
		responseLines: [
			{ text: '{"order_id": 4521, "status": "confirmed"}', color: 'muted' },
			{ text: 'Total: 3.2s', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Request took 3.2s but no breakdown available.',
				color: 'red',
			},
			{
				text: 'Is it the DB query? External API? Serialization? Unknown.',
				color: 'red',
			},
		],
		story: [
			'Checkout takes 3.2 seconds. Customers are complaining.',
			'You know the total time but not where it is spent.',
			'No spans showing DB queries, external API calls, or serialization.',
			'Without tracing, you have to add debug logging manually.',
			'Each deploy to add a timer takes 15 minutes. Multiply by 10 services.',
		],
	},
	{
		id: 'check-health',
		label: 'Check application health endpoint',
		command: 'curl -s -o /dev/null -w "%{http_code}" localhost:3000/up',
		responseLines: [
			{ text: '404', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No health check endpoint configured.',
				color: 'red',
			},
			{
				text: 'Load balancer cannot determine if this instance is healthy.',
				color: 'red',
			},
			{
				text: 'Kubernetes readiness probes have nothing to check.',
				color: 'yellow',
			},
		],
		story: [
			'You try to check if the application is ready to serve traffic.',
			'curl /up returns 404. No health endpoint exists.',
			'The load balancer sends traffic to unhealthy instances.',
			'Kubernetes readiness probes fail, causing unnecessary restarts.',
			'A simple endpoint checking DB, Redis, and disk would prevent this.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'find-slow-request': ['no-structured-search'],
	'correlate-error': ['no-correlation'],
	'find-bottleneck': ['no-tracing'],
	'check-health': ['no-health-check'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Observe: 4 nodes. edgeA = unstructured -> structured, edgeB = structured -> trace

const SLOW_REQUEST_FRAMES: AnimFrame[] = [
	{
		unstructuredLog: {
			label: 'grep "duration"',
			flash: 'amber',
			sublabel: 'Searching text...',
			badge: '2841ms',
		},
		structuredLog: {
			flash: 'idle',
			sublabel: 'Not configured',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'No structured search',
			dotColor: '#ef4444',
		},
	},
	{
		unstructuredLog: {
			label: 'Current Logs',
			flash: 'red',
			sublabel: 'Cannot filter by duration',
			badge: 'grep only',
		},
		edgeA: { active: false, label: '' },
	},
];

const CORRELATE_ERROR_FRAMES: AnimFrame[] = [
	{
		unstructuredLog: {
			label: 'grep "NoMethodError"',
			flash: 'amber',
			sublabel: 'Found error, but...',
			badge: 'no request_id',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'No correlation IDs',
			dotColor: '#ef4444',
		},
	},
	{
		unstructuredLog: {
			label: 'Current Logs',
			flash: 'red',
			sublabel: 'Cannot link error to request',
			badge: 'isolated',
		},
		edgeA: { active: false, label: '' },
	},
];

const BOTTLENECK_FRAMES: AnimFrame[] = [
	{
		unstructuredLog: {
			label: 'curl /checkout',
			flash: 'amber',
			sublabel: 'Total: 3.2s',
		},
		trace: {
			flash: 'idle',
			sublabel: 'Not configured',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'No span breakdown',
			dotColor: '#ef4444',
		},
	},
	{
		unstructuredLog: {
			label: 'Current Logs',
			flash: 'red',
			sublabel: 'Only total time visible',
			badge: '3.2s unknown',
		},
		trace: {
			flash: 'idle',
			sublabel: 'Not configured',
		},
		edgeB: { active: false, label: '' },
	},
];

const HEALTH_CHECK_FRAMES: AnimFrame[] = [
	{
		health: {
			label: 'curl /up',
			flash: 'red',
			sublabel: '404 Not Found',
			badge: 'missing',
		},
		edgeC: {
			active: true,
			reverse: true,
			label: '404 Not Found',
			dotColor: '#ef4444',
		},
	},
	{
		health: {
			label: 'Health Endpoint',
			flash: 'red',
			sublabel: 'Load balancer blind',
			badge: '404',
		},
		edgeC: { active: false, label: '' },
	},
];

const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'find-slow-request': SLOW_REQUEST_FRAMES,
	'correlate-error': CORRELATE_ERROR_FRAMES,
	'find-bottleneck': BOTTLENECK_FRAMES,
	'check-health': HEALTH_CHECK_FRAMES,
};

// ─── Reward animation frames ─────────────────────────────────────────

const REWARD_SLOW_REQUEST_FRAMES: AnimFrame[] = [
	{
		unstructuredLog: {
			label: 'Lograge JSON',
			flash: 'green',
			sublabel: 'Querying duration > 1000ms',
			badge: 'structured',
		},
		structuredLog: {
			label: 'Custom Fields',
			flash: 'green',
			sublabel: 'request_id, user_id attached',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'jq ".duration > 1000"',
			dotColor: '#22c55e',
		},
	},
	{
		unstructuredLog: {
			label: 'Lograge (JSON)',
			flash: 'green',
			sublabel: 'Found 3 slow requests',
			badge: 'filtered',
		},
		edgeA: { active: false, label: '' },
	},
];

const REWARD_CORRELATE_FRAMES: AnimFrame[] = [
	{
		unstructuredLog: {
			label: 'Lograge JSON',
			flash: 'green',
			sublabel: 'Searching by request_id...',
		},
		structuredLog: {
			label: 'Custom Fields',
			flash: 'green',
			sublabel: 'request_id: abc-123',
			badge: 'correlated',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'jq ".request_id == abc-123"',
			dotColor: '#22c55e',
		},
	},
	{
		unstructuredLog: {
			label: 'Lograge (JSON)',
			flash: 'green',
			sublabel: 'Error linked to user #42',
			badge: 'traced',
		},
		edgeA: { active: false, label: '' },
	},
];

const REWARD_TRACE_FRAMES: AnimFrame[] = [
	{
		trace: {
			label: 'OpenTelemetry',
			flash: 'green',
			sublabel: 'Span breakdown: checkout',
			badge: '3 spans',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'DB: 200ms, API: 2.8s, Render: 200ms',
			dotColor: '#22c55e',
		},
	},
	{
		trace: {
			label: 'OpenTelemetry',
			flash: 'green',
			sublabel: 'Bottleneck: external API (2.8s)',
			badge: 'identified',
		},
		edgeB: { active: false, label: '' },
	},
];

const REWARD_HEALTH_FRAMES: AnimFrame[] = [
	{
		health: {
			label: '/up',
			flash: 'green',
			sublabel: 'Checking components...',
			badge: null,
		},
		edgeC: {
			active: true,
			reverse: true,
			label: '200 OK',
			dotColor: '#22c55e',
		},
	},
	{
		health: {
			label: '/up',
			flash: 'green',
			sublabel: 'DB: ok, Redis: ok, Disk: ok',
			badge: '200 OK',
		},
		edgeC: { active: false, label: '' },
	},
];

const REWARD_CROSS_SERVICE_FRAMES: AnimFrame[] = [
	{
		trace: {
			label: 'OpenTelemetry',
			flash: 'green',
			sublabel: 'Cross-service trace',
			badge: '5 spans',
		},
		unstructuredLog: {
			label: 'Lograge (JSON)',
			flash: 'green',
			sublabel: 'trace_id propagated',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'trace_id: xyz-789',
			dotColor: '#22c55e',
		},
	},
	{
		trace: {
			label: 'OpenTelemetry',
			flash: 'green',
			sublabel: 'Full request journey visible',
			badge: 'distributed',
		},
		edgeB: { active: false, label: '' },
	},
];

const REWARD_SEARCH_USER_FRAMES: AnimFrame[] = [
	{
		structuredLog: {
			label: 'Custom Fields',
			flash: 'green',
			sublabel: 'Filtering by user_id: 42',
			badge: 'searching',
		},
		edgeA: {
			active: true,
			reverse: true,
			label: 'jq ".user_id == 42"',
			dotColor: '#22c55e',
		},
	},
	{
		structuredLog: {
			label: 'Custom Fields',
			flash: 'green',
			sublabel: '23 requests from user #42',
			badge: 'found',
		},
		edgeA: { active: false, label: '' },
	},
];

const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'find-slow-request': REWARD_SLOW_REQUEST_FRAMES,
	'correlate-error': REWARD_CORRELATE_FRAMES,
	'find-bottleneck': REWARD_TRACE_FRAMES,
	'check-health': REWARD_HEALTH_FRAMES,
	'cross-service-trace': REWARD_CROSS_SERVICE_FRAMES,
	'search-by-user': REWARD_SEARCH_USER_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	'unstructured-log': {
		stageId: 'unstructured-log',
		title: 'Current Logs (Unstructured)',
		description:
			'Rails default logger outputs multi-line human-readable text. Each request generates 5+ log lines with no consistent format. Searching requires grep and regex. Cannot be indexed or queried by field.',
		code: `# Default Rails log output:
Started GET "/api/v1/products" for 10.0.0.1 at 2024-03-15
Processing by ProductsController#index as JSON
  Product Load (2.1ms)  SELECT "products".*
  Rendered products/index (1.2ms)
Completed 200 OK in 45ms (Views: 1.2ms | ActiveRecord: 2.1ms)`,
	},
	'structured-log': {
		stageId: 'structured-log',
		title: 'Structured Logs (Not Configured)',
		description:
			'Structured logging outputs one JSON line per request with queryable fields: method, path, status, duration, controller, action. Tools like jq, Datadog, or Elasticsearch can index and search these fields instantly.',
	},
	trace: {
		stageId: 'trace',
		title: 'Trace Timeline (Not Configured)',
		description:
			'Distributed tracing breaks a request into spans showing exactly where time is spent: DB queries, external API calls, serialization. Without it, you only know the total time, not the breakdown.',
	},
	health: {
		stageId: 'health',
		title: 'Health Endpoint (Missing)',
		description:
			'A health check endpoint (/up) reports application readiness. Load balancers, Kubernetes probes, and monitoring systems need this to know if an instance can serve traffic. Without it, traffic goes to unhealthy instances.',
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	'unstructured-log': 'no-structured-search',
	'structured-log': 'no-correlation',
	trace: 'no-tracing',
	health: 'no-health-check',
};

// ─── Stress test scenarios (reward) ───────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'find-slow-request',
		label: 'Search logs for slow requests',
		description: 'Query structured JSON logs by duration field',
		method: 'GET',
		path: '/logs?duration_gt=1000',
		actor: 'operator',
		expectedResult: 'allowed',
	},
	{
		id: 'correlate-error',
		label: 'Correlate error to request',
		description: 'Search by request_id to find full context',
		method: 'GET',
		path: '/logs?request_id=abc-123',
		actor: 'operator',
		expectedResult: 'allowed',
	},
	{
		id: 'find-bottleneck',
		label: 'Find where time is spent in a request',
		description: 'View span breakdown for slow endpoint',
		method: 'GET',
		path: '/traces?endpoint=/checkout',
		actor: 'operator',
		expectedResult: 'allowed',
	},
	{
		id: 'check-health',
		label: 'Check application health endpoint',
		description: 'Hit /up endpoint for component status',
		method: 'GET',
		path: '/up',
		actor: 'load-balancer',
		expectedResult: 'allowed',
	},
	{
		id: 'cross-service-trace',
		label: 'Trace across services',
		description: 'Follow trace_id across microservices',
		method: 'GET',
		path: '/traces?trace_id=xyz-789',
		actor: 'operator',
		expectedResult: 'allowed',
	},
	{
		id: 'search-by-user',
		label: 'Search logs by user_id',
		description: 'Filter all requests from specific user',
		method: 'GET',
		path: '/logs?user_id=42',
		actor: 'operator',
		expectedResult: 'allowed',
	},
];

// ─── Build step definitions ───────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'install-lograge', title: 'Install Lograge' },
	{ id: 'configure-lograge', title: 'Configure JSON Formatter' },
	{ id: 'custom-fields', title: 'Add Custom Log Fields' },
	{ id: 'install-otel', title: 'Install OpenTelemetry' },
	{ id: 'configure-otel', title: 'Configure OpenTelemetry' },
	{ id: 'health-endpoint', title: 'Add Health Check Endpoint' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add lograge
	'option', // 1: configure lograge
	'option', // 2: custom fields
	'terminal', // 3: bundle add otel
	'option', // 4: configure otel
	'option', // 5: health check
];

// ─── Step 0: Install Lograge (Terminal) ──────────────────────────────

const installLogrageCommands: TerminalCommand[] = [
	{
		id: 'wrong-rails-logger',
		label: 'rails generate logger:install',
		command: 'rails generate logger:install',
		correct: false,
		feedback:
			'There is no built-in Rails logger generator. Structured logging requires a gem that replaces the default multi-line format with single-line JSON output.',
	},
	{
		id: 'wrong-json-logger',
		label: 'bundle add json_logger',
		command: 'bundle add json_logger',
		correct: false,
		feedback:
			'json_logger is not the standard gem for Rails structured logging. The most widely used gem replaces the default Rails logger with a single-line, structured format.',
	},
	{
		id: 'correct',
		label: 'bundle add lograge',
		command: 'bundle add lograge',
		correct: true,
	},
];

const installLogrageOutput: TerminalOutputLine[] = [
	{ text: 'Fetching lograge 0.14.0', color: 'cyan' },
	{ text: 'Installing lograge 0.14.0', color: 'green' },
	{ text: 'Bundle complete! lograge added to Gemfile.', color: 'green' },
];

// ─── Step 1: Configure Lograge JSON (OptionCard) ─────────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

const LOGRAGE_CONFIG_OPTIONS: StepOption[] = [
	{
		id: 'wrong-text',
		name: 'config.lograge.enabled = true\nconfig.lograge.formatter = Lograge::Formatters::KeyValue.new',
		correct: false,
		feedback:
			'KeyValue format is still text-based and hard to parse. JSON output is needed so log aggregation tools (Datadog, ELK) can index fields automatically.',
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
			'Raw format outputs a Ruby hash, not JSON. External tools cannot parse Ruby hashes. JSON is the standard interchange format for log aggregation.',
	},
];

// ─── Step 2: Custom log fields (OptionCard) ──────────────────────────

const CUSTOM_FIELDS_OPTIONS: StepOption[] = [
	{
		id: 'wrong-before-action',
		name: 'before_action :log_context\n\ndef log_context\n  Rails.logger.info("user=#{current_user&.id}")\nend',
		correct: false,
		feedback:
			'Adding a separate log line does not attach fields to the Lograge output. Lograge has a built-in hook for appending custom fields to every request log line.',
	},
	{
		id: 'wrong-tagged',
		name: 'config.log_tags = [:request_id, :user_id]',
		correct: false,
		feedback:
			'log_tags is for the default Rails logger, not Lograge. Lograge has its own hook for merging custom fields into its JSON output for each request.',
	},
	{
		id: 'correct',
		name: 'config.lograge.custom_payload do |controller|\n  {\n    tenant_id: controller.current_tenant&.id,\n    request_id: controller.request.request_id,\n    user_id: controller.current_user&.id\n  }\nend',
		correct: true,
	},
];

// ─── Step 3: Install OpenTelemetry (Terminal) ────────────────────────

const installOtelCommands: TerminalCommand[] = [
	{
		id: 'wrong-newrelic',
		label: 'bundle add newrelic_rpm',
		command: 'bundle add newrelic_rpm',
		correct: false,
		feedback:
			'New Relic is a proprietary APM tool, not an open standard. OpenTelemetry is vendor-neutral, so you can send traces to any backend (Jaeger, Zipkin, Datadog).',
	},
	{
		id: 'correct',
		label: 'bundle add opentelemetry-sdk opentelemetry-instrumentation-all',
		command: 'bundle add opentelemetry-sdk opentelemetry-instrumentation-all',
		correct: true,
	},
	{
		id: 'wrong-partial',
		label: 'bundle add opentelemetry-sdk',
		command: 'bundle add opentelemetry-sdk',
		correct: false,
		feedback:
			'The SDK alone does not instrument anything. You also need the instrumentation-all meta-gem to automatically trace Rails, ActiveRecord, Faraday, and other libraries.',
	},
];

const installOtelOutput: TerminalOutputLine[] = [
	{ text: 'Fetching opentelemetry-sdk 1.4.0', color: 'cyan' },
	{ text: 'Fetching opentelemetry-instrumentation-all 0.60.0', color: 'cyan' },
	{ text: 'Installing opentelemetry-sdk 1.4.0', color: 'green' },
	{
		text: 'Installing opentelemetry-instrumentation-all 0.60.0',
		color: 'green',
	},
	{ text: 'Bundle complete! OpenTelemetry gems added.', color: 'green' },
];

// ─── Step 4: Configure OpenTelemetry (OptionCard) ────────────────────

const OTEL_CONFIG_OPTIONS: StepOption[] = [
	{
		id: 'wrong-manual',
		name: 'OpenTelemetry::SDK.configure do |c|\n  c.service_name = "ecommerce"\n  c.use "OpenTelemetry::Instrumentation::Rails"\n  c.use "OpenTelemetry::Instrumentation::ActiveRecord"\nend',
		correct: false,
		feedback:
			'Listing instrumentations manually means you miss new ones when adding gems. The use_all method auto-detects and instruments every supported library in your Gemfile.',
	},
	{
		id: 'wrong-no-name',
		name: 'OpenTelemetry::SDK.configure do |c|\n  c.use_all\nend',
		correct: false,
		feedback:
			'Missing service_name. Without it, traces show "unknown_service" in your tracing backend. Every service must identify itself so you can filter and search by service.',
	},
	{
		id: 'correct',
		name: 'OpenTelemetry::SDK.configure do |c|\n  c.service_name = "ecommerce"\n  c.use_all\nend',
		correct: true,
	},
];

// ─── Step 5: Health check endpoint (OptionCard) ──────────────────────

const HEALTH_CHECK_OPTIONS: StepOption[] = [
	{
		id: 'wrong-simple',
		name: 'Rails.application.routes.draw do\n  get "/up", to: proc { [200, {}, ["OK"]] }\nend',
		correct: false,
		feedback:
			'A static 200 response tells you nothing. The endpoint should verify critical dependencies (database, Redis, disk) so the load balancer knows if the instance can actually serve requests.',
	},
	{
		id: 'correct',
		name: 'Rails.application.routes.draw do\n  get "/up", to: "health#show"\nend\n\nclass HealthController < ApplicationController\n  def show\n    result = HealthCheckService.call\n    status = result.values.all? ? :ok : :service_unavailable\n    render json: result, status: status\n  end\nend',
		correct: true,
	},
	{
		id: 'wrong-private',
		name: 'Rails.application.routes.draw do\n  get "/up", to: "health#show"\nend\n\nclass HealthController < ApplicationController\n  before_action :authenticate_user!\n  def show\n    render json: { status: "ok" }\n  end\nend',
		correct: false,
		feedback:
			'Health checks must be unauthenticated. Load balancers and Kubernetes probes cannot authenticate. Adding before_action :authenticate_user! blocks all health checks.',
	},
];

// ─── Option step config map ───────────────────────────────────────────

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Configure Lograge Formatter',
		description:
			'Lograge is installed. Now configure it to output one JSON line per request instead of the default multi-line text. Which formatter produces machine-readable JSON output?',
		options: LOGRAGE_CONFIG_OPTIONS,
	},
	2: {
		title: 'Add Custom Log Fields',
		description:
			'JSON logs are working, but they only include default fields (method, path, status, duration). You need tenant_id, request_id, and user_id on every log line for debugging. How do you add custom fields to Lograge output?',
		options: CUSTOM_FIELDS_OPTIONS,
	},
	4: {
		title: 'Configure OpenTelemetry',
		description:
			'OpenTelemetry gems are installed. Configure the SDK to instrument all supported libraries automatically and identify this service in trace data.',
		options: OTEL_CONFIG_OPTIONS,
	},
	5: {
		title: 'Add Health Check Endpoint',
		description:
			'The application has no health endpoint. Load balancers and Kubernetes need a way to check if this instance is ready to serve traffic. What kind of health check should you add?',
		options: HEALTH_CHECK_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: installLogrageCommands, outputLines: installLogrageOutput },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	{ commands: installOtelCommands, outputLines: installOtelOutput },
	null, // step 4: OptionCard
	null, // step 5: OptionCard
];

// ─── Code preview per phase/step ──────────────────────────────────────

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/middleware/request_logger.rb',
				language: 'ruby',
				code: `class RequestLogger
  def initialize(app)
    @app = app
  end

  def call(env)
    start = Time.now
    status, headers, body = @app.call(env)
    duration = ((Time.now - start) * 1000).round(1)

    Rails.logger.info(
      "method=#{env['REQUEST_METHOD']} " \\
      "path=#{env['PATH_INFO']} " \\
      "status=#{status} duration=#{duration}ms"
    )

    [status, headers, body]
  end
end

# L41's middleware logs basics, but:
# - No JSON format (cannot index or search by field)
# - No request_id or user_id correlation
# - No distributed tracing across services
# - No health endpoint for load balancers`,
				highlight: [24, 25, 26, 27],
			},
		];
	}

	const files = [];

	// Step 0 complete: lograge installed
	if (completedStep >= 0) {
		files.push({
			filename: 'config/environments/production.rb',
			language: 'ruby',
			code:
				completedStep >= 1
					? completedStep >= 2
						? `# config/environments/production.rb
config.lograge.enabled = true
config.lograge.formatter = Lograge::Formatters::Json.new

config.lograge.custom_payload do |controller|
  {
    tenant_id: controller.current_tenant&.id,
    request_id: controller.request.request_id,
    user_id: controller.current_user&.id
  }
end`
						: `# config/environments/production.rb
config.lograge.enabled = true
config.lograge.formatter = Lograge::Formatters::Json.new

# TODO: add custom log fields`
					: `# config/environments/production.rb
# Lograge gem installed
# TODO: configure formatter`,
			highlight:
				completedStep >= 2
					? [5, 6, 7, 8, 9, 10, 11]
					: completedStep >= 1
						? [2, 3]
						: [3],
		});
	} else {
		files.push({
			filename: 'config/environments/production.rb',
			language: 'ruby',
			code: `# config/environments/production.rb
# Default Rails logger (multi-line, unstructured)
# TODO: install structured logging gem`,
			highlight: [3],
		});
	}

	// Step 3+ complete: OpenTelemetry installed
	if (completedStep >= 3) {
		files.push({
			filename: 'config/initializers/opentelemetry.rb',
			language: 'ruby',
			code:
				completedStep >= 4
					? `# config/initializers/opentelemetry.rb
require "opentelemetry/sdk"
require "opentelemetry/instrumentation/all"

OpenTelemetry::SDK.configure do |c|
  c.service_name = "ecommerce"
  c.use_all
end`
					: `# config/initializers/opentelemetry.rb
require "opentelemetry/sdk"
require "opentelemetry/instrumentation/all"

# TODO: configure SDK`,
			highlight: completedStep >= 4 ? [5, 6, 7] : [5],
		});
	}

	// Step 5 complete: health endpoint
	if (completedStep >= 5) {
		files.push({
			filename: 'app/controllers/health_controller.rb',
			language: 'ruby',
			code: `class HealthController < ApplicationController
  def show
    result = HealthCheckService.call
    status = result.values.all? ? :ok : :service_unavailable
    render json: result, status: status
  end
end`,
			highlight: [3, 4, 5],
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

const LogNode = memo(function LogNode({ data }: { data: LogNodeData }) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'LG',
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

const TraceNode = memo(function TraceNode({ data }: { data: TraceNodeData }) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'TR',
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
				<div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-mono">
					{data.badge}
				</div>
			)}
		</FlowNode>
	);
});

const HealthNode = memo(function HealthNode({
	data,
}: {
	data: HealthNodeData;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'HC',
		color: '#ef4444',
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
		</FlowNode>
	);
});

// ─── Custom edge ──────────────────────────────────────────────────────

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
});

const obsNodeTypes = {
	'unstructured-log': LogNode,
	'structured-log': LogNode,
	trace: TraceNode,
	health: HealthNode,
};
const obsEdgeTypes = { obs: ObsEdge };

// ─── Main component ───────────────────────────────────────────────────

export function Level53Observability({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [unstructuredState, setUnstructuredState] =
		useState<LogNodeData>(DEFAULT_UNSTRUCTURED);
	const [structuredState, setStructuredState] =
		useState<LogNodeData>(DEFAULT_STRUCTURED);
	const [traceState, setTraceState] = useState<TraceNodeData>(DEFAULT_TRACE);
	const [healthState, setHealthState] =
		useState<HealthNodeData>(DEFAULT_HEALTH);
	const [edgeAState, setEdgeAState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBState, setEdgeBState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeCState, setEdgeCState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setUnstructuredState(
			isReward ? DEFAULT_UNSTRUCTURED_REWARD : DEFAULT_UNSTRUCTURED,
		);
		setStructuredState(
			isReward ? DEFAULT_STRUCTURED_REWARD : DEFAULT_STRUCTURED,
		);
		setTraceState(isReward ? DEFAULT_TRACE_REWARD : DEFAULT_TRACE);
		setHealthState(isReward ? DEFAULT_HEALTH_REWARD : DEFAULT_HEALTH);
		setEdgeAState(DEFAULT_EDGE);
		setEdgeBState(DEFAULT_EDGE);
		setEdgeCState(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.unstructuredLog)
			setUnstructuredState((prev) => ({ ...prev, ...frame.unstructuredLog }));
		if (frame.structuredLog)
			setStructuredState((prev) => ({ ...prev, ...frame.structuredLog }));
		if (frame.trace) setTraceState((prev) => ({ ...prev, ...frame.trace }));
		if (frame.health) setHealthState((prev) => ({ ...prev, ...frame.health }));
		if (frame.edgeA) setEdgeAState((prev) => ({ ...prev, ...frame.edgeA }));
		if (frame.edgeB) setEdgeBState((prev) => ({ ...prev, ...frame.edgeB }));
		if (frame.edgeC) setEdgeCState((prev) => ({ ...prev, ...frame.edgeC }));
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
	const flowNodes: Node[] = useMemo(() => {
		return [
			{
				id: 'unstructured-log',
				type: 'unstructured-log',
				position: { x: 30, y: 20 },
				data: unstructuredState,
			},
			{
				id: 'structured-log',
				type: 'structured-log',
				position: { x: 350, y: 20 },
				data: structuredState,
			},
			{
				id: 'trace',
				type: 'trace',
				position: { x: 30, y: 220 },
				data: traceState,
			},
			{
				id: 'health',
				type: 'health',
				position: { x: 350, y: 220 },
				data: healthState,
			},
		];
	}, [unstructuredState, structuredState, traceState, healthState]);

	const flowEdges: Edge[] = useMemo(() => {
		return [
			{
				id: 'edgeA',
				source: 'unstructured-log',
				target: 'structured-log',
				type: 'obs',
				data: edgeAState,
			},
			{
				id: 'edgeB',
				source: 'unstructured-log',
				target: 'trace',
				type: 'obs',
				data: edgeBState,
			},
			{
				id: 'edgeC',
				source: 'structured-log',
				target: 'health',
				type: 'obs',
				data: edgeCState,
			},
		];
	}, [edgeAState, edgeBState, edgeCState]);

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
				'Observability configured! Structured logs, tracing, and health checks active.',
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
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={vizAnimating}
							onProbe={handleProbe}
							probes={PROBES}
							title="Observability Probe"
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
						{/* Step 0: Install Lograge (Terminal) */}
						{currentStepType === 'terminal' && stepper.currentStep === 0 && (
							<TerminalChoiceStep
								commands={installLogrageCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										Rails default logger outputs multi-line unstructured text.
										Install a gem that replaces this with single-line structured
										output so log aggregation tools can index and search your
										logs.
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
								outputLines={installLogrageOutput}
								stepKey={stepper.currentStep}
								title="Install Structured Logging"
							/>
						)}

						{/* Step 3: Install OpenTelemetry (Terminal) */}
						{currentStepType === 'terminal' && stepper.currentStep === 3 && (
							<TerminalChoiceStep
								commands={installOtelCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										Structured logs tell you what happened. Now you need
										distributed tracing to see where time is spent within each
										request. Install the tracing SDK and auto-instrumentation
										gems.
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
								outputLines={installOtelOutput}
								stepKey={stepper.currentStep}
								title="Install Distributed Tracing"
							/>
						)}

						{/* OptionCard steps (1, 2, 4, 5) */}
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
						edgeTypes={obsEdgeTypes}
						nodes={flowNodes}
						nodeTypes={obsNodeTypes}
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
					{/* Scenario text */}
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your RequestLogger middleware from L41 logs basic request/response
							data, but it is not enough. Exceptions lack context, there is no
							per-field search, no distributed tracing across services, and no
							health endpoint for load balancers.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							When PagerDuty fires at 3 AM, the team cannot diagnose the root
							cause. You need structured, searchable logs, request tracing, and
							a way for infrastructure to know if an instance is healthy.
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

					{/* Reward: diagnosed counter */}
					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Observability Stack
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<FileText className="w-4 h-4 text-success" />
										<span className="text-foreground">
											Lograge: structured JSON logs
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Activity className="w-4 h-4 text-success" />
										<span className="text-foreground">
											OpenTelemetry: distributed tracing
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Heart className="w-4 h-4 text-success" />
										<span className="text-foreground">
											/up: health check endpoint
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
										<div className="text-xs text-success/70">Diagnosed</div>
									</div>
									<div className="bg-muted rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-foreground">
											{stressTest.results.length}
										</div>
										<div className="text-xs text-muted-foreground">
											Total Fired
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
					levelName="Observability"
					levelNumber={51}
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
					learningGoal="Observability combines structured logging (Lograge), distributed tracing (OpenTelemetry), and health checks to make production debugging fast and systematic. One JSON line per request, spans showing time breakdown, and an endpoint for load balancers."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level53Observability;
