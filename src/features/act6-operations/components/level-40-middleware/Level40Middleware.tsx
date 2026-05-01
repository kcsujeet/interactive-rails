/**
 * Level 41: Middleware & Rack
 *
 * Three-phase flow: observe -> build -> reward
 *
 * Phase 1 (observe): 3-node vertical stack visualization.
 *   Client (top) -> Middleware Stack (center, empty in observe) -> Rails App (bottom).
 *   Probes show requests flowing through with no tracking, no logging, and bots getting through.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: Create middleware class file (terminal)
 *   Step 1: Insert middleware into application.rb (terminal)
 *   Step 2: Implement request ID injection (option)
 *   Step 3: Implement request logging (option)
 *   Step 4: Implement bot detection (option)
 *   Step 5: Configure middleware ordering (option)
 *
 * Phase 3 (reward): Same 3 nodes, but middleware stack shows active layers.
 *   Request ID injected, logging active, bots rejected.
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import { ArrowRight } from 'lucide-react';
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
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act6-level40-middleware', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface SimpleNodeState {
	label: string;
	flash: ZoneFlash;
}

interface MiddlewareVizState {
	label: string;
	flash: ZoneFlash;
	// Layer sub-panels (reward only)
	requestIdLabel: string | null;
	requestIdFlash: ZoneFlash;
	loggerLabel: string | null;
	loggerFlash: ZoneFlash;
	botLabel: string | null;
	botFlash: ZoneFlash;
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	client?: Partial<SimpleNodeState>;
	middleware?: Partial<MiddlewareVizState>;
	app?: Partial<SimpleNodeState>;
	/** Client <-> Middleware edge */
	edge1?: Partial<EdgeVizState>;
	/** Middleware <-> App edge */
	edge2?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_CLIENT: SimpleNodeState = { label: 'Idle', flash: 'idle' };

const DEFAULT_MIDDLEWARE: MiddlewareVizState = {
	label: 'Empty Stack',
	flash: 'idle',
	requestIdLabel: null,
	requestIdFlash: 'idle',
	loggerLabel: null,
	loggerFlash: 'idle',
	botLabel: null,
	botFlash: 'idle',
};

const DEFAULT_APP: SimpleNodeState = { label: 'Idle', flash: 'idle' };

const DEFAULT_MIDDLEWARE_REWARD: MiddlewareVizState = {
	label: 'Middleware Stack',
	flash: 'idle',
	requestIdLabel: 'Request ID',
	requestIdFlash: 'green',
	loggerLabel: 'Logger',
	loggerFlash: 'green',
	botLabel: 'Bot Filter',
	botFlash: 'green',
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-cyan-500',
};

// ─── Discovery definitions ─────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'no-request-id', label: 'No request ID for tracing errors' },
	{ id: 'no-logging', label: 'No middleware logging (only Rails log)' },
	{ id: 'bots-undetected', label: 'Bots pass through undetected' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES = [
	{
		id: 'error-no-trace',
		label: 'Customer reports 500 error (no request ID)',
		command: 'curl localhost:3000/api/v1/orders/999',
		responseLines: [
			{ text: '500 Internal Server Error', color: 'red' as const },
			{ text: '# No X-Request-Id header in response', color: 'red' as const },
			{
				text: '# Customer says "it broke" but which request?',
				color: 'red' as const,
			},
			{
				text: '# No way to correlate this error in logs',
				color: 'red' as const,
			},
		],
		story: [
			'A customer reports a 500 error during checkout.',
			'Support asks: "What was the request ID?"',
			'There is no request ID. The response has no X-Request-Id header.',
			'The error is somewhere in the logs but impossible to find.',
		],
	},
	{
		id: 'bot-scrape',
		label: 'Bot scrapes product catalog (undetected)',
		command: 'for i in {1..1000}; do curl localhost:3000/api/v1/products; done',
		responseLines: [
			{
				text: '# 1000 GET /api/v1/products from same user-agent',
				color: 'yellow' as const,
			},
			{ text: '200 OK (x1000)', color: 'green' as const },
			{ text: '# All requests served. No detection.', color: 'red' as const },
			{
				text: '# Bot scraped entire catalog before anyone noticed',
				color: 'red' as const,
			},
		],
		story: [
			'A scraper bot hits GET /api/v1/products 1000 times.',
			'Every request passes straight through to Rails.',
			'No middleware inspects the User-Agent or request pattern.',
			'The bot downloads your entire product catalog undetected.',
		],
	},
	{
		id: 'debug-no-logs',
		label: 'Debug production issue (no middleware logging)',
		command: 'tail -f log/production.log | grep "duration"',
		responseLines: [
			{ text: '# Rails default log:', color: 'cyan' as const },
			{ text: 'Started GET "/api/v1/orders"', color: 'muted' as const },
			{ text: 'Completed 200 OK in 245ms', color: 'muted' as const },
			{
				text: '# No request_id, no user_id, no structured data',
				color: 'red' as const,
			},
			{
				text: '# Cannot correlate requests across services',
				color: 'red' as const,
			},
		],
		story: [
			'A production issue needs debugging.',
			'The only log is Rails default: "Started GET... Completed 200 OK."',
			'No request ID, no timing breakdown, no structured metadata.',
			'Cannot correlate this request with logs from other services.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'error-no-trace': ['no-request-id'],
	'bot-scrape': ['bots-undetected'],
	'debug-no-logs': ['no-logging'],
};

// ─── Observe animation frames ─────────────────────────────────────────

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'error-no-trace': [
		{
			client: { label: 'POST /api/v1/checkout', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'POST /checkout',
				dotColor: 'bg-cyan-500',
			},
			middleware: { label: 'Empty Stack', flash: 'idle' },
		},
		{
			edge1: { active: false },
			middleware: { label: 'Passes through (nothing here)', flash: 'idle' },
			edge2: {
				active: true,
				reverse: false,
				label: 'No request ID added',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Processing...', flash: 'idle' },
		},
		{
			app: { label: '500 Error!', flash: 'red' },
			edge2: {
				active: true,
				reverse: true,
				label: '500 (no X-Request-Id)',
				dotColor: 'bg-red-500',
			},
		},
		{
			edge2: { active: false },
			edge1: {
				active: true,
				reverse: true,
				label: '500 Error',
				dotColor: 'bg-red-500',
			},
			client: { label: '"It broke." Which request?', flash: 'red' },
			middleware: { label: 'No tracing possible', flash: 'red' },
		},
	],
	'bot-scrape': [
		{
			client: { label: 'Bot: 1000x GET /products', flash: 'amber' },
			edge1: {
				active: true,
				reverse: false,
				label: '1000 requests',
				dotColor: 'bg-amber-500',
			},
			middleware: { label: 'Empty Stack', flash: 'idle' },
		},
		{
			edge1: { active: false },
			middleware: { label: 'All pass through', flash: 'amber' },
			edge2: {
				active: true,
				reverse: false,
				label: '1000 requests to Rails',
				dotColor: 'bg-amber-500',
			},
			app: { label: 'Serving all 1000...', flash: 'amber' },
		},
		{
			edge2: { active: false },
			app: { label: 'All 1000 served', flash: 'red' },
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK (x1000)',
				dotColor: 'bg-red-500',
			},
			client: { label: 'Catalog scraped!', flash: 'red' },
		},
		{
			edge1: { active: false },
			middleware: { label: 'No detection, no blocking', flash: 'red' },
		},
	],
	'debug-no-logs': [
		{
			client: { label: 'GET /api/v1/orders', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /orders',
				dotColor: 'bg-cyan-500',
			},
			middleware: { label: 'Empty Stack', flash: 'idle' },
		},
		{
			edge1: { active: false },
			middleware: { label: 'No logging middleware', flash: 'amber' },
			edge2: {
				active: true,
				reverse: false,
				label: 'Passes through',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Processing (245ms)', flash: 'idle' },
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: '200 OK',
				dotColor: 'bg-emerald-500',
			},
			app: { label: 'Done', flash: 'green' },
		},
		{
			edge2: { active: false },
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK',
				dotColor: 'bg-emerald-500',
			},
			client: { label: 'Got response', flash: 'green' },
			middleware: { label: 'No structured log written', flash: 'red' },
			app: { label: 'Only: "Completed 200 in 245ms"', flash: 'amber' },
		},
	],
};

// ─── Reward animation frames ──────────────────────────────────────────

const REWARD_FRAMES: Record<string, AnimFrame[]> = {
	'error-no-trace': [
		{
			client: { label: 'POST /api/v1/checkout', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'POST /checkout',
				dotColor: 'bg-cyan-500',
			},
			middleware: {
				label: 'Middleware Stack',
				flash: 'idle',
				requestIdLabel: 'Injecting ID...',
				requestIdFlash: 'amber',
			},
		},
		{
			edge1: { active: false },
			middleware: {
				label: 'X-Request-Id: abc-123',
				flash: 'green',
				requestIdLabel: 'abc-123',
				requestIdFlash: 'green',
			},
			edge2: {
				active: true,
				reverse: false,
				label: 'Request + ID',
				dotColor: 'bg-emerald-500',
			},
			app: { label: 'Processing...', flash: 'idle' },
		},
		{
			edge2: { active: false },
			app: { label: '500 Error!', flash: 'red' },
			edge1: {
				active: true,
				reverse: true,
				label: '500 + X-Request-Id: abc-123',
				dotColor: 'bg-red-500',
			},
		},
		{
			edge1: { active: false },
			client: { label: 'Error has request ID!', flash: 'green' },
			middleware: { label: 'Log: abc-123 -> 500', flash: 'green' },
			app: { label: 'Traceable via abc-123', flash: 'green' },
		},
	],
	'bot-scrape': [
		{
			client: { label: 'Bot: 1000x GET /products', flash: 'amber' },
			edge1: {
				active: true,
				reverse: false,
				label: '1000 requests',
				dotColor: 'bg-amber-500',
			},
			middleware: {
				label: 'Middleware Stack',
				flash: 'idle',
				botLabel: 'Scanning...',
				botFlash: 'amber',
			},
		},
		{
			edge1: { active: false },
			middleware: {
				label: 'Bot detected!',
				flash: 'amber',
				botLabel: 'BLOCKED',
				botFlash: 'red',
			},
		},
		{
			edge1: {
				active: true,
				reverse: true,
				label: '403 Forbidden',
				dotColor: 'bg-red-500',
			},
			client: { label: 'Blocked at middleware!', flash: 'red' },
			middleware: { label: 'Bot rejected early', flash: 'green' },
			app: { label: 'Never reached', flash: 'idle' },
		},
	],
	'debug-no-logs': [
		{
			client: { label: 'GET /api/v1/orders', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /orders',
				dotColor: 'bg-cyan-500',
			},
			middleware: {
				label: 'Middleware Stack',
				flash: 'idle',
				loggerLabel: 'Logging...',
				loggerFlash: 'amber',
				requestIdLabel: 'abc-456',
				requestIdFlash: 'green',
			},
		},
		{
			edge1: { active: false },
			edge2: {
				active: true,
				reverse: false,
				label: 'Logged + ID injected',
				dotColor: 'bg-emerald-500',
			},
			app: { label: 'Processing (245ms)', flash: 'idle' },
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: '200 OK',
				dotColor: 'bg-emerald-500',
			},
			app: { label: 'Done', flash: 'green' },
			middleware: {
				label: 'Structured log written',
				flash: 'green',
				loggerLabel: 'GET /orders 200 245ms',
				loggerFlash: 'green',
			},
		},
		{
			edge2: { active: false },
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK + X-Request-Id',
				dotColor: 'bg-emerald-500',
			},
			client: { label: 'Response with request ID', flash: 'green' },
		},
	],
	'health-check': [
		{
			client: { label: 'GET /health', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /health',
				dotColor: 'bg-cyan-500',
			},
			middleware: {
				label: 'All layers active',
				flash: 'green',
				requestIdLabel: 'Request ID',
				requestIdFlash: 'green',
				loggerLabel: 'Logger',
				loggerFlash: 'green',
				botLabel: 'Bot Filter',
				botFlash: 'green',
			},
		},
		{
			edge1: { active: false },
			edge2: {
				active: true,
				reverse: false,
				label: 'Enriched request',
				dotColor: 'bg-emerald-500',
			},
			app: { label: 'Processing...', flash: 'idle' },
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: '200 OK',
				dotColor: 'bg-emerald-500',
			},
			app: { label: '200 OK', flash: 'green' },
		},
		{
			edge2: { active: false },
			edge1: {
				active: true,
				reverse: true,
				label: '200 + headers + logged',
				dotColor: 'bg-emerald-500',
			},
			client: { label: 'Full pipeline working', flash: 'green' },
		},
	],
};

// ─── Build step definitions ────────────────────────────────────────────

const STEP_DEFS = [
	{ id: 'create-middleware', title: 'Create Middleware Class' },
	{ id: 'insert-middleware', title: 'Insert Into Stack' },
	{ id: 'request-id', title: 'Implement Request ID' },
	{ id: 'request-logger', title: 'Implement Request Logger' },
	{ id: 'bot-detection', title: 'Implement Bot Detection' },
	{ id: 'ordering', title: 'Configure Middleware Order' },
];

const CREATE_MIDDLEWARE_COMMANDS = [
	{
		id: 'wrong-controller',
		label: 'rails g controller Middleware request_id',
		command: 'rails g controller Middleware request_id',
		correct: false,
		feedback:
			'Middleware is not a controller. It is a plain Ruby class in lib/middleware/ that responds to initialize(app) and call(env).',
	},
	{
		id: 'correct',
		label:
			'mkdir -p lib/middleware && touch lib/middleware/request_id_tracker.rb',
		command:
			'mkdir -p lib/middleware && touch lib/middleware/request_id_tracker.rb',
		correct: true,
	},
	{
		id: 'wrong-initializer',
		label: 'rails g initializer middleware_config',
		command: 'rails g initializer middleware_config',
		correct: false,
		feedback:
			'An initializer configures middleware, but you need to create the middleware class itself first. Middleware lives in lib/middleware/.',
	},
];

const INSERT_MIDDLEWARE_COMMANDS = [
	{
		id: 'wrong-require',
		label: 'require "lib/middleware/request_id_tracker"',
		command: 'ruby -e \'require "lib/middleware/request_id_tracker"\'',
		correct: false,
		feedback:
			'Requiring the file loads it, but does not insert it into the Rack stack. You need config.middleware.use in application.rb.',
	},
	{
		id: 'wrong-after',
		label: 'config.middleware.insert_after(0, RequestIdTracker)',
		command:
			'echo "config.middleware.insert_after(0, RequestIdTracker)" >> config/application.rb',
		correct: false,
		feedback:
			'insert_after(0, ...) inserts after the first middleware. For request tracking, use config.middleware.use to append, or insert_before for specific ordering.',
	},
	{
		id: 'correct',
		label: 'config.middleware.use RequestIdTracker',
		command:
			'echo "config.middleware.use RequestIdTracker" >> config/application.rb',
		correct: true,
	},
];

const REQUEST_ID_OPTIONS = [
	{
		id: 'wrong-controller-filter',
		label: 'Use a before_action in ApplicationController',
		code: `class ApplicationController < ActionController::API
  before_action :set_request_id

  private

  def set_request_id
    request.headers['X-Request-Id'] ||= SecureRandom.uuid
    response.headers['X-Request-Id'] = request.headers['X-Request-Id']
  end
end`,
		correct: false,
		feedback:
			'A controller filter runs after middleware and routing. If the request fails in middleware or routing, no ID is set. Request IDs must be injected at the middleware layer.',
	},
	{
		id: 'correct',
		label: 'Middleware with initialize(app) and call(env)',
		code: `class RequestIdTracker
  def initialize(app)
    @app = app
  end

  def call(env)
    request_id = env['HTTP_X_REQUEST_ID'] || SecureRandom.uuid
    env['HTTP_X_REQUEST_ID'] = request_id
    Thread.current[:request_id] = request_id

    status, headers, body = @app.call(env)
    headers['X-Request-Id'] = request_id
    [status, headers, body]
  ensure
    Thread.current[:request_id] = nil
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-no-thread-local',
		label: 'Middleware without thread-local storage',
		code: `class RequestIdTracker
  def initialize(app)
    @app = app
  end

  def call(env)
    request_id = SecureRandom.uuid
    status, headers, body = @app.call(env)
    headers['X-Request-Id'] = request_id
    [status, headers, body]
  end
end`,
		correct: false,
		feedback:
			'Without Thread.current[:request_id], downstream code (services, jobs) cannot access the request ID for logging. The ID must be available throughout the request lifecycle.',
	},
];

const LOGGER_OPTIONS = [
	{
		id: 'wrong-puts',
		label: 'Use puts for logging',
		code: `class RequestLogger
  def initialize(app)
    @app = app
  end

  def call(env)
    start = Time.now
    status, headers, body = @app.call(env)
    puts "#{env['REQUEST_METHOD']} #{env['PATH_INFO']} #{status}"
    [status, headers, body]
  end
end`,
		correct: false,
		feedback:
			'puts writes to stdout with no structure. Production logging needs structured data (JSON) with timing, request ID, and status for log aggregation tools.',
	},
	{
		id: 'wrong-no-timing',
		label: 'Structured log without timing',
		code: `class RequestLogger
  def initialize(app)
    @app = app
  end

  def call(env)
    status, headers, body = @app.call(env)
    Rails.logger.info({
      method: env['REQUEST_METHOD'],
      path: env['PATH_INFO'],
      status: status
    }.to_json)
    [status, headers, body]
  end
end`,
		correct: false,
		feedback:
			'Without timing data (duration_ms), you cannot identify slow requests. Timing is the most critical metric for production debugging.',
	},
	{
		id: 'correct',
		label: 'Structured JSON log with timing and request ID',
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
end`,
		correct: true,
	},
];

const BOT_OPTIONS = [
	{
		id: 'wrong-controller-check',
		label: 'Check User-Agent in controller',
		code: `class ApplicationController < ActionController::API
  before_action :reject_bots

  private

  def reject_bots
    if request.user_agent&.match?(/bot|crawler|spider/i)
      head :forbidden
    end
  end
end`,
		correct: false,
		feedback:
			'A controller check runs after routing and middleware. The bot request still consumes a Puma thread and triggers all middleware. Reject bots early in the Rack stack.',
	},
	{
		id: 'correct',
		label: 'Middleware that rejects bots before Rails',
		code: `class BotDetector
  BOT_PATTERNS = /bot|crawler|spider|scraper/i

  def initialize(app)
    @app = app
  end

  def call(env)
    user_agent = env['HTTP_USER_AGENT'] || ''
    if user_agent.match?(BOT_PATTERNS)
      [403, { 'Content-Type' => 'application/json' },
       ['{"error":{"code":"FORBIDDEN","message":"Bot detected"}}']]
    else
      @app.call(env)
    end
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-allow-all',
		label: 'Log bot requests but allow them through',
		code: `class BotDetector
  def initialize(app)
    @app = app
  end

  def call(env)
    if env['HTTP_USER_AGENT']&.match?(/bot/i)
      Rails.logger.warn("Bot detected: #{env['HTTP_USER_AGENT']}")
    end
    @app.call(env)
  end
end`,
		correct: false,
		feedback:
			'Logging without blocking still lets the bot consume resources. The middleware should return a 403 immediately, never calling @app.call for known bots.',
	},
];

const ORDERING_OPTIONS = [
	{
		id: 'wrong-random',
		label: 'Add all middleware with config.middleware.use (default order)',
		code: `# config/application.rb
config.middleware.use RequestIdTracker
config.middleware.use BotDetector
config.middleware.use RequestLogger`,
		correct: false,
		feedback:
			'Default append order means BotDetector runs after RequestIdTracker. But if a bot is rejected, the logger never sees it. Order matters: detect bots first, then ID, then log.',
	},
	{
		id: 'wrong-logger-first',
		label: 'Logger first, then bot detector, then request ID',
		code: `# config/application.rb
config.middleware.use RequestLogger
config.middleware.use BotDetector
config.middleware.use RequestIdTracker`,
		correct: false,
		feedback:
			'If the logger runs before the request ID is injected, logs will have no request_id field. Request ID must be injected before logging.',
	},
	{
		id: 'correct',
		label: 'Bot detector first, then request ID, then logger',
		code: `# config/application.rb
# 1. Reject bots early (saves resources)
config.middleware.use BotDetector
# 2. Inject request ID (needed by logger)
config.middleware.use RequestIdTracker
# 3. Log with request ID and timing
config.middleware.use RequestLogger`,
		correct: true,
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{
		commands: CREATE_MIDDLEWARE_COMMANDS,
		outputLines: [
			{
				text: 'Created lib/middleware/request_id_tracker.rb',
				color: 'green' as const,
			},
		],
	},
	{
		commands: INSERT_MIDDLEWARE_COMMANDS,
		outputLines: [
			{
				text: 'Middleware registered in config/application.rb',
				color: 'green' as const,
			},
		],
	},
	null, // request-id: OptionCard
	null, // request-logger: OptionCard
	null, // bot-detection: OptionCard
	null, // ordering: OptionCard
];

// ─── Stress test scenarios ─────────────────────────────────────────────

const STRESS_SCENARIOS = [
	{
		id: 'error-no-trace',
		label: 'Customer reports 500 error (with request ID)',
		description: 'Error response includes X-Request-Id for tracing',
		method: 'POST' as const,
		path: '/api/v1/checkout',
		actor: 'customer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '500 Internal Server Error', color: 'red' },
			{ text: 'X-Request-Id: abc-123-def', color: 'green' },
			{ text: '# Error traceable via request ID in logs', color: 'green' },
		],
		story: [
			'Same customer, same 500 error.',
			'But now the response includes X-Request-Id: abc-123-def.',
			'Support can find the exact request in structured logs.',
			'Debug time: seconds instead of hours.',
		],
	},
	{
		id: 'bot-scrape',
		label: 'Bot scrapes products (blocked by middleware)',
		description: 'Bot detected and rejected at middleware layer with 403',
		method: 'GET' as const,
		path: '/api/v1/products',
		actor: 'bot',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '403 Forbidden', color: 'red' },
			{ text: '# Bot detected by BotDetector middleware', color: 'green' },
			{ text: '# Rejected before reaching Rails', color: 'green' },
		],
		story: [
			'Same scraper bot, same 1000 requests.',
			'But now BotDetector middleware catches it.',
			'Rejected with 403 before touching Rails.',
			'Zero resources wasted on bot traffic.',
		],
	},
	{
		id: 'debug-no-logs',
		label: 'Debug production issue (with structured logs)',
		description:
			'Request logged with method, path, status, duration, request_id',
		method: 'GET' as const,
		path: '/api/v1/orders',
		actor: 'developer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: '{"method":"GET","path":"/api/v1/orders","status":200,"duration_ms":245,"request_id":"abc-456"}',
				color: 'green',
			},
		],
		story: [
			'Same production issue, same request.',
			'But now RequestLogger middleware writes structured JSON.',
			'Log includes method, path, status, duration_ms, and request_id.',
			'Can correlate across services via shared request_id.',
		],
	},
	{
		id: 'health-check',
		label: 'Health check (full pipeline working)',
		description: 'All three middleware layers process the request',
		method: 'GET' as const,
		path: '/health',
		actor: 'monitoring',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'X-Request-Id: present', color: 'green' },
			{ text: 'Structured log: written', color: 'green' },
			{ text: 'Bot check: passed (legitimate)', color: 'green' },
		],
		story: [
			'Monitoring service sends a health check.',
			'BotDetector: not a bot, pass through.',
			'RequestIdTracker: ID injected.',
			'RequestLogger: structured log written.',
			'Full middleware pipeline working.',
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
				filename: 'config/application.rb',
				language: 'ruby',
				code: `# No custom middleware configured
# Only Rails defaults:
# ActionDispatch::RequestId (sets X-Request-Id but no logging)
# Rails::Rack::Logger (basic text logging)
#
# Missing:
# - No structured request logging
# - No bot detection
# - No request correlation across services`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (completedStep >= 0) {
			files.push({
				filename: 'lib/middleware/request_id_tracker.rb',
				language: 'ruby',
				code: `# Middleware class file created
# Next: implement the initialize/call interface`,
			});
		}

		if (completedStep >= 1) {
			files.push({
				filename: 'config/application.rb',
				language: 'ruby',
				code: `# Middleware registered
config.middleware.use RequestIdTracker${completedStep >= 2 ? '' : '\n# Next: implement the class'}`,
			});
		}

		if (completedStep >= 2) {
			files.push({
				filename: 'lib/middleware/request_id_tracker.rb',
				language: 'ruby',
				code: `class RequestIdTracker
  def initialize(app)
    @app = app
  end

  def call(env)
    request_id = env['HTTP_X_REQUEST_ID'] || SecureRandom.uuid
    env['HTTP_X_REQUEST_ID'] = request_id
    Thread.current[:request_id] = request_id

    status, headers, body = @app.call(env)
    headers['X-Request-Id'] = request_id
    [status, headers, body]
  ensure
    Thread.current[:request_id] = nil
  end
end`,
			});
		}

		if (completedStep >= 3) {
			files.push({
				filename: 'lib/middleware/request_logger.rb',
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
end`,
			});
		}

		if (completedStep >= 4) {
			files.push({
				filename: 'lib/middleware/bot_detector.rb',
				language: 'ruby',
				code: `class BotDetector
  BOT_PATTERNS = /bot|crawler|spider|scraper/i

  def initialize(app)
    @app = app
  end

  def call(env)
    user_agent = env['HTTP_USER_AGENT'] || ''
    if user_agent.match?(BOT_PATTERNS)
      [403, { 'Content-Type' => 'application/json' },
       ['{"error":{"code":"FORBIDDEN","message":"Bot detected"}}']]
    else
      @app.call(env)
    end
  end
end`,
			});
		}

		if (completedStep >= 5) {
			files[1] = {
				filename: 'config/application.rb',
				language: 'ruby',
				code: `# Middleware ordered: bot -> id -> logger
config.middleware.use BotDetector
config.middleware.use RequestIdTracker
config.middleware.use RequestLogger`,
			};
		}

		if (files.length === 0) {
			files.push({
				filename: 'lib/middleware/request_id_tracker.rb',
				language: 'ruby',
				code: '# Step 1: Create the middleware class file...',
			});
		}

		return files;
	}

	// reward
	return [
		{
			filename: 'config/application.rb',
			language: 'ruby',
			code: `# Middleware stack (ordered)
config.middleware.use BotDetector
config.middleware.use RequestIdTracker
config.middleware.use RequestLogger`,
		},
		{
			filename: 'lib/middleware/request_id_tracker.rb',
			language: 'ruby',
			code: `class RequestIdTracker
  def initialize(app)
    @app = app
  end

  def call(env)
    request_id = env['HTTP_X_REQUEST_ID'] || SecureRandom.uuid
    env['HTTP_X_REQUEST_ID'] = request_id
    Thread.current[:request_id] = request_id

    status, headers, body = @app.call(env)
    headers['X-Request-Id'] = request_id
    [status, headers, body]
  ensure
    Thread.current[:request_id] = nil
  end
end`,
		},
		{
			filename: 'lib/middleware/request_logger.rb',
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
end`,
		},
		{
			filename: 'lib/middleware/bot_detector.rb',
			language: 'ruby',
			code: `class BotDetector
  BOT_PATTERNS = /bot|crawler|spider|scraper/i

  def initialize(app)
    @app = app
  end

  def call(env)
    user_agent = env['HTTP_USER_AGENT'] || ''
    if user_agent.match?(BOT_PATTERNS)
      [403, { 'Content-Type' => 'application/json' },
       ['{"error":{"code":"FORBIDDEN","message":"Bot detected"}}']]
    else
      @app.call(env)
    end
  end
end`,
		},
	];
}

// ─── Custom React Flow nodes ──────────────────────────────────────────

const FLASH_BORDER: Record<ZoneFlash, string> = {
	idle: 'border-border',
	red: 'border-red-500 dark:border-red-400',
	green: 'border-emerald-500 dark:border-emerald-400',
	amber: 'border-amber-500 dark:border-amber-400',
};

const FLASH_BG: Record<ZoneFlash, string> = {
	idle: 'bg-card',
	red: 'bg-red-50 dark:bg-red-950/30',
	green: 'bg-emerald-50 dark:bg-emerald-950/30',
	amber: 'bg-amber-50 dark:bg-amber-950/30',
};

function flashToStatus(flash: ZoneFlash): FlowNodeData['status'] {
	if (flash === 'green') return 'active';
	if (flash === 'amber') return 'warning';
	if (flash === 'red') return 'error';
	return 'idle';
}

interface ClientNodeData extends SimpleNodeState {
	[key: string]: unknown;
}

const ClientNode = memo(({ data }: { data: ClientNodeData }) => {
	const d = data as ClientNodeData;
	const flowData: FlowNodeData = {
		label: 'Client',
		icon: 'CL',
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

interface MiddlewareNodeData extends MiddlewareVizState {
	[key: string]: unknown;
}

const MiddlewareNode = memo(({ data }: { data: MiddlewareNodeData }) => {
	const d = data as MiddlewareNodeData;
	const showLayers = d.requestIdLabel || d.loggerLabel || d.botLabel;
	const flowData: FlowNodeData = {
		label: 'Middleware',
		icon: 'MW',
		color: '#f59e0b',
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
				{showLayers && (
					<div className="flex gap-1 mt-2 pt-2 border-t border-border">
						{d.botLabel && (
							<div
								className={`flex-1 rounded border ${FLASH_BORDER[d.botFlash]} ${FLASH_BG[d.botFlash]} p-1 text-center transition-colors duration-300`}
							>
								<p className="text-[9px] font-semibold text-foreground truncate">
									{d.botLabel}
								</p>
							</div>
						)}
						{d.requestIdLabel && (
							<div
								className={`flex-1 rounded border ${FLASH_BORDER[d.requestIdFlash]} ${FLASH_BG[d.requestIdFlash]} p-1 text-center transition-colors duration-300`}
							>
								<p className="text-[9px] font-semibold text-foreground truncate">
									{d.requestIdLabel}
								</p>
							</div>
						)}
						{d.loggerLabel && (
							<div
								className={`flex-1 rounded border ${FLASH_BORDER[d.loggerFlash]} ${FLASH_BG[d.loggerFlash]} p-1 text-center transition-colors duration-300`}
							>
								<p className="text-[9px] font-semibold text-foreground truncate">
									{d.loggerLabel}
								</p>
							</div>
						)}
					</div>
				)}
			</FlowNode>
		</>
	);
});

interface AppNodeData extends SimpleNodeState {
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
			</FlowNode>
		</>
	);
});

// ── Custom edge ──

function toDotFill(twClass: string): string {
	if (twClass.includes('emerald')) return '#10b981';
	if (twClass.includes('red')) return '#ef4444';
	if (twClass.includes('amber')) return '#f59e0b';
	if (twClass.includes('cyan')) return '#06b6d4';
	return '#a1a1aa';
}

interface MwEdgeData extends EdgeVizState {
	[key: string]: unknown;
}

const MwEdge = memo(
	({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
		const d = (data ?? DEFAULT_EDGE) as MwEdgeData;
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
								transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 18}px)`,
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

const mwNodeTypes = {
	client: ClientNode,
	middleware: MiddlewareNode,
	app: AppNode,
};
const mwEdgeTypes = { mw: MwEdge };

// ─── Main component ────────────────────────────────────────────────────

export function Level40Middleware({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<'observe' | 'build' | 'reward'>('observe');
	const isReward = phase === 'reward';

	// ── Visualization state ──
	const [clientState, setClientState] =
		useState<SimpleNodeState>(DEFAULT_CLIENT);
	const [mwState, setMwState] =
		useState<MiddlewareVizState>(DEFAULT_MIDDLEWARE);
	const [appState, setAppState] = useState<SimpleNodeState>(DEFAULT_APP);
	const [edge1State, setEdge1State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge2State, setEdge2State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setClientState(DEFAULT_CLIENT);
		setMwState(isReward ? DEFAULT_MIDDLEWARE_REWARD : DEFAULT_MIDDLEWARE);
		setAppState(DEFAULT_APP);
		setEdge1State(DEFAULT_EDGE);
		setEdge2State(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.client) setClientState((prev) => ({ ...prev, ...frame.client }));
		if (frame.middleware)
			setMwState((prev) => ({ ...prev, ...frame.middleware }));
		if (frame.app) setAppState((prev) => ({ ...prev, ...frame.app }));
		if (frame.edge1) setEdge1State((prev) => ({ ...prev, ...frame.edge1 }));
		if (frame.edge2) setEdge2State((prev) => ({ ...prev, ...frame.edge2 }));
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
			const tCleanup = setTimeout(() => {
				setEdge1State((prev) => ({ ...prev, active: false }));
				setEdge2State((prev) => ({ ...prev, active: false }));
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
			if (frames) runAnimation(frames, undefined, ANIMATION_DURATION_MS * 2);
		},
		[vizAnimating, discoveryGating, runAnimation],
	);

	// ── Build phase ──
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const allOptions: Record<number, typeof REQUEST_ID_OPTIONS> = {
				2: REQUEST_ID_OPTIONS,
				3: LOGGER_OPTIONS,
				4: BOT_OPTIONS,
				5: ORDERING_OPTIONS,
			};
			const options = allOptions[stepper.currentStep];
			if (!options) return;
			const option = options.find((o) => o.id === optionId);
			if (!option) return;
			if (option.correct) {
				stepper.completeStep();
			} else {
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
			const frames = REWARD_FRAMES[scenarioId];
			if (frames) {
				setClientState(DEFAULT_CLIENT);
				setMwState(DEFAULT_MIDDLEWARE_REWARD);
				setAppState(DEFAULT_APP);
				setEdge1State(DEFAULT_EDGE);
				setEdge2State(DEFAULT_EDGE);
				runAnimation(frames, undefined, ANIMATION_DURATION_MS * 2);
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
		return { valid: true, message: 'Middleware stack is working!' };
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
	// Vertical layout: Client (top) -> Middleware (middle) -> App (bottom)
	const flowNodes = useMemo(
		(): Node[] => [
			{
				id: 'client',
				type: 'client',
				position: { x: 100, y: 0 },
				data: { ...clientState } satisfies ClientNodeData,
			},
			{
				id: 'middleware',
				type: 'middleware',
				position: { x: 80, y: 100 },
				data: { ...mwState } satisfies MiddlewareNodeData,
			},
			{
				id: 'app',
				type: 'app',
				position: { x: 100, y: 220 },
				data: { ...appState } satisfies AppNodeData,
			},
		],
		[clientState, mwState, appState],
	);

	const flowEdges = useMemo(
		(): Edge[] => [
			{
				id: 'e-client-mw',
				source: 'client',
				target: 'middleware',
				type: 'mw',
				sourceHandle: 'bottom-source',
				targetHandle: 'top-target',
				data: { ...edge1State } satisfies MwEdgeData,
			},
			{
				id: 'e-mw-app',
				source: 'middleware',
				target: 'app',
				type: 'mw',
				sourceHandle: 'bottom-source',
				targetHandle: 'top-target',
				data: { ...edge2State } satisfies MwEdgeData,
			},
		],
		[edge1State, edge2State],
	);

	// ── Build step config ──
	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx <= 1) {
			const termData = TERMINAL_STEP_MAP[idx];
			return {
				type: 'terminal' as const,
				commands: termData?.commands
					? shuffleOptions(termData.commands, idx)
					: undefined,
				outputLines: termData?.outputLines,
			};
		}
		const stepOptions: Record<number, typeof REQUEST_ID_OPTIONS> = {
			2: REQUEST_ID_OPTIONS,
			3: LOGGER_OPTIONS,
			4: BOT_OPTIONS,
			5: ORDERING_OPTIONS,
		};
		return {
			type: 'option' as const,
			options: shuffleOptions(stepOptions[idx], idx),
		};
	}, [stepper.currentStep]);

	const buildCodePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	// ── Render: Left panel ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground mb-2">
							Every request to your Rails app passes through a stack of
							middleware before reaching your controllers. Middleware can log,
							modify, reject, or enrich requests.
						</p>
						<p className="text-sm text-muted-foreground">
							Right now, the stack is empty. Requests arrive with no tracking
							ID, no structured logging, and bots pass through undetected.
							Debugging production issues is impossible.
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
							Write custom Rack middleware for request ID tracking, structured
							logging, and bot detection. Insert them into the middleware stack
							in the correct order.
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
							<span className="text-muted-foreground">
								Processed by middleware
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">
								Blocked by middleware
							</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Processed</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Blocked</div>
					</div>
				</div>
			</div>
		);
	};

	// ── Render: Center panel ──
	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col p-4 gap-4">
					<div className="flex-1 min-h-0">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={mwEdgeTypes}
							nodes={flowNodes}
							nodeTypes={mwNodeTypes}
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
			if (
				currentStepConfig.type === 'terminal' &&
				currentStepConfig.commands &&
				currentStepConfig.outputLines
			) {
				return (
					<div className="flex-1 flex flex-col p-4">
						<TerminalChoiceStep
							commands={currentStepConfig.commands}
							completed={stepper.isCurrentStepCompleted}
							description={
								<p className="text-sm text-muted-foreground">
									{stepper.currentStep === 0 &&
										'Create a middleware class file in lib/middleware/. Middleware is a plain Ruby class, not a controller or initializer.'}
									{stepper.currentStep === 1 &&
										'Register the middleware in config/application.rb so Rails includes it in the Rack stack.'}
								</p>
							}
							hasNext={stepper.currentStep < STEP_DEFS.length - 1}
							initialHistory={buildTerminalHistory(
								TERMINAL_STEP_MAP,
								stepper.currentStep,
							)}
							onCorrect={() => stepper.completeStep()}
							onNext={stepper.nextStep}
							onWrong={(fb) => stepper.recordWrongAttempt(fb)}
							outputLines={currentStepConfig.outputLines}
							stepKey={stepper.currentStep}
							title={STEP_DEFS[stepper.currentStep].title}
						/>
					</div>
				);
			}

			if (currentStepConfig.type === 'option' && currentStepConfig.options) {
				return (
					<div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
						<div>
							<h3 className="text-lg font-semibold text-foreground">
								{STEP_DEFS[stepper.currentStep].title}
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{stepper.currentStep === 2 &&
									'How should the request ID middleware inject and propagate the ID?'}
								{stepper.currentStep === 3 &&
									'How should the request logger middleware structure its output?'}
								{stepper.currentStep === 4 &&
									'How should the bot detection middleware handle suspicious requests?'}
								{stepper.currentStep === 5 &&
									'In what order should the three middleware run?'}
							</p>
						</div>
						{stepper.lastFeedback && (
							<ErrorFeedback message={stepper.lastFeedback} />
						)}
						<div className="space-y-3">
							{currentStepConfig.options.map((opt) => (
								<OptionCard
									disabled={stepper.isCurrentStepCompleted}
									key={opt.id}
									mono
									name={opt.label}
									onClick={() => handleOptionSelect(opt.id)}
									selected={stepper.isCurrentStepCompleted && opt.correct}
								/>
							))}
						</div>
						{stepper.isCurrentStepCompleted &&
							stepper.currentStep < STEP_DEFS.length - 1 && (
								<Button className="gap-2" onClick={stepper.nextStep} size="sm">
									Next Step <ArrowRight className="w-4 h-4" />
								</Button>
							)}
						{stepper.isCurrentStepCompleted &&
							stepper.currentStep === STEP_DEFS.length - 1 && (
								<Button
									className="gap-2"
									onClick={() => setPhase('reward')}
									size="sm"
								>
									Next Step <ArrowRight className="w-4 h-4" />
								</Button>
							)}
					</div>
				);
			}
		}

		// reward
		return (
			<div className="flex-1 flex flex-col p-4 gap-4">
				<div className="flex-1 min-h-0">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={mwEdgeTypes}
						nodes={flowNodes}
						nodeTypes={mwNodeTypes}
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
					levelName="Middleware & Rack"
					levelNumber={41}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={handleValidate}
				/>
				{renderCenterPanel()}
			</CenterPanel>
			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'build' ? buildCodePreviewStep : 0,
					)}
					learningGoal="Rack middleware intercepts every request before Rails. Use it for request IDs, structured logging, and bot detection."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level40Middleware;
