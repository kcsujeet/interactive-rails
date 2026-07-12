/**
 * Level 42: Rate Limiting
 *
 * Three-phase flow: observe -> build -> reward
 *
 * Phase 1 (observe): 3-node fork visualization.
 *   Bot/Attacker (left-top), Customer (left-bottom), Rails App (right).
 *   Probes show bots flooding the app, login brute-forced, legitimate users locked out.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: Add rate_limit to login controller (terminal - Rails 8 built-in)
 *   Step 1: Add rack-attack gem (terminal)
 *   Step 2: Configure per-IP throttle (option)
 *   Step 3: Configure login throttle (option)
 *   Step 4: Configure safelist (option)
 *   Step 5: Configure 429 response (option)
 *
 * Phase 3 (reward): Same 3 nodes, App shows rate limit sub-panels.
 *   Bots get 429. Legitimate users get through.
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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act6-level42-rate-limiting', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface SimpleNodeState {
	label: string;
	flash: ZoneFlash;
}

interface AppVizState {
	label: string;
	flash: ZoneFlash;
	badge: string | null;
	requestCount: string | null;
	ipLimitLabel: string | null;
	ipLimitFlash: ZoneFlash;
	userLimitLabel: string | null;
	userLimitFlash: ZoneFlash;
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	bot?: Partial<SimpleNodeState>;
	customer?: Partial<SimpleNodeState>;
	app?: Partial<AppVizState>;
	edge1?: Partial<EdgeVizState>;
	edge2?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_BOT: SimpleNodeState = { label: 'Idle', flash: 'idle' };
const DEFAULT_CUSTOMER: SimpleNodeState = { label: 'Idle', flash: 'idle' };

const DEFAULT_APP: AppVizState = {
	label: 'No Rate Limiting',
	flash: 'idle',
	badge: null,
	requestCount: null,
	ipLimitLabel: null,
	ipLimitFlash: 'idle',
	userLimitLabel: null,
	userLimitFlash: 'idle',
};

const DEFAULT_APP_REWARD: AppVizState = {
	label: 'Rate Limited',
	flash: 'idle',
	badge: null,
	requestCount: null,
	ipLimitLabel: 'IP: 100/min',
	ipLimitFlash: 'green',
	userLimitLabel: 'Login: 5/min',
	userLimitFlash: 'green',
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-cyan-500',
};

// ─── Discovery definitions ─────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'no-ip-limit', label: 'No per-IP request throttling' },
	{ id: 'login-brute-force', label: 'Login endpoint has no rate limit' },
	{
		id: 'legitimate-blocked',
		label: 'Legitimate users locked out during attack',
	},
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES = [
	{
		id: 'bot-flood',
		label: 'Bot floods API (10K req/sec from one IP)',
		command: 'for i in {1..10000}; do curl localhost:3000/api/products; done',
		responseLines: [
			{
				text: '# 10,000 requests from 1.2.3.4',
				color: 'yellow' as const,
			},
			{ text: '200 OK (x10,000)', color: 'green' as const },
			{
				text: '# All served. Server CPU: 98%',
				color: 'red' as const,
			},
			{
				text: '# No throttle. Every request hits full stack.',
				color: 'red' as const,
			},
		],
		story: [
			'A bot sends 10,000 GET /api/products per second from one IP.',
			'Every request is served. No throttling.',
			'Server CPU hits 98%. Response times spike to 5 seconds.',
			'The entire app slows down for everyone.',
		],
	},
	{
		id: 'brute-force',
		label: 'Attacker brute-forces login endpoint',
		command:
			'for i in {1..1000}; do curl -X POST localhost:3000/api/sessions -d "password=guess$i"; done',
		responseLines: [
			{
				text: '# 1,000 POST /api/sessions from one IP',
				color: 'yellow' as const,
			},
			{ text: '401 Unauthorized (x999)', color: 'red' as const },
			{
				text: '200 OK (x1) - password guessed!',
				color: 'red' as const,
			},
			{
				text: '# No rate limit on login. Brute force succeeds.',
				color: 'red' as const,
			},
		],
		story: [
			'An attacker tries 1,000 password combinations on the login endpoint.',
			'Each attempt gets a fresh response: 401 or 200.',
			'No rate limiting on POST /sessions.',
			'After 1,000 tries, the attacker guesses a weak password.',
		],
	},
	{
		id: 'legitimate-blocked',
		label: 'Customer locked out during bot attack',
		command: 'curl localhost:3000/api/products  # during bot flood',
		responseLines: [
			{
				text: '# Customer tries to browse products',
				color: 'cyan' as const,
			},
			{
				text: '# Server CPU: 98% (bot consuming all resources)',
				color: 'red' as const,
			},
			{ text: '504 Gateway Timeout', color: 'red' as const },
			{
				text: '# Legitimate user cannot load the page',
				color: 'red' as const,
			},
		],
		story: [
			'A real customer tries to browse products.',
			'But the bot flood is consuming all server resources.',
			'The customer gets a 504 Gateway Timeout.',
			'Without rate limiting, bot traffic crowds out real users.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'bot-flood': ['no-ip-limit'],
	'brute-force': ['login-brute-force'],
	'legitimate-blocked': ['legitimate-blocked'],
};

// ─── Observe animation frames ─────────────────────────────────────────

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'bot-flood': [
		{
			bot: { label: '10K req/sec from 1.2.3.4', flash: 'red' },
			edge1: {
				active: true,
				reverse: false,
				label: '10,000 GET /products',
				dotColor: 'bg-red-500',
			},
			app: {
				label: 'Receiving flood...',
				flash: 'idle',
				badge: null,
				requestCount: null,
			},
		},
		{
			app: {
				label: 'Processing all 10K...',
				flash: 'amber',
				requestCount: '10K req/sec',
			},
			edge1: { active: false },
		},
		{
			app: {
				label: 'CPU: 98%!',
				flash: 'red',
				badge: 'OVERLOADED',
				requestCount: '10K req/sec',
			},
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK (x10,000)',
				dotColor: 'bg-red-500',
			},
			bot: { label: 'All served!', flash: 'red' },
		},
		{
			edge1: { active: false },
			app: { label: 'No throttle, no protection', flash: 'red' },
		},
	],
	'brute-force': [
		{
			bot: { label: '1000x POST /sessions', flash: 'red' },
			edge1: {
				active: true,
				reverse: false,
				label: '1000 login attempts',
				dotColor: 'bg-red-500',
			},
			app: {
				label: 'Login endpoint...',
				flash: 'idle',
				badge: null,
				requestCount: null,
			},
		},
		{
			edge1: { active: false },
			app: {
				label: 'Checking passwords...',
				flash: 'amber',
				requestCount: '1000 attempts',
			},
		},
		{
			app: { label: 'Password guessed!', flash: 'red', badge: 'BREACHED' },
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK (password found)',
				dotColor: 'bg-red-500',
			},
			bot: { label: 'Account compromised!', flash: 'red' },
		},
		{
			edge1: { active: false },
			app: { label: 'No login rate limit', flash: 'red' },
		},
	],
	'legitimate-blocked': [
		{
			bot: { label: '10K req/sec (ongoing)', flash: 'red' },
			customer: { label: 'Browsing products...', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: '10K req/sec',
				dotColor: 'bg-red-500',
			},
			app: {
				label: 'CPU: 98%',
				flash: 'red',
				badge: 'OVERLOADED',
				requestCount: '10K/sec',
			},
		},
		{
			edge2: {
				active: true,
				reverse: false,
				label: 'GET /products',
				dotColor: 'bg-cyan-500',
			},
			customer: { label: 'Loading...', flash: 'amber' },
		},
		{
			edge1: { active: false },
			edge2: { active: false },
			app: { label: 'Cannot process', flash: 'red' },
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: '504 Timeout',
				dotColor: 'bg-red-500',
			},
			customer: { label: 'Page wont load!', flash: 'red' },
			bot: { label: 'Still flooding...', flash: 'red' },
		},
	],
};

// ─── Reward animation frames ──────────────────────────────────────────

const REWARD_FRAMES: Record<string, AnimFrame[]> = {
	'bot-flood': [
		{
			bot: { label: '10K req/sec from 1.2.3.4', flash: 'red' },
			edge1: {
				active: true,
				reverse: false,
				label: '10,000 GET /products',
				dotColor: 'bg-red-500',
			},
			app: {
				label: 'Rate limit check...',
				flash: 'idle',
				badge: null,
				requestCount: null,
				ipLimitLabel: 'IP check...',
				ipLimitFlash: 'amber',
			},
		},
		{
			edge1: { active: false },
			app: {
				label: 'IP limit exceeded!',
				flash: 'amber',
				ipLimitLabel: '1.2.3.4: BLOCKED',
				ipLimitFlash: 'red',
			},
		},
		{
			edge1: {
				active: true,
				reverse: true,
				label: '429 Too Many Requests',
				dotColor: 'bg-red-500',
			},
			bot: { label: 'Throttled!', flash: 'red' },
			app: {
				label: 'CPU: 3%',
				flash: 'green',
				badge: 'PROTECTED',
				requestCount: '100/min allowed',
			},
		},
	],
	'brute-force': [
		{
			bot: { label: '1000x POST /sessions', flash: 'red' },
			edge1: {
				active: true,
				reverse: false,
				label: '1000 login attempts',
				dotColor: 'bg-red-500',
			},
			app: {
				label: 'Login rate limit...',
				flash: 'idle',
				badge: null,
				requestCount: null,
				userLimitLabel: 'Login check...',
				userLimitFlash: 'amber',
			},
		},
		{
			edge1: { active: false },
			app: {
				label: 'Login limit: 5/min!',
				flash: 'amber',
				userLimitLabel: 'Login: 5/5 BLOCKED',
				userLimitFlash: 'red',
			},
		},
		{
			edge1: {
				active: true,
				reverse: true,
				label: '429 + Retry-After: 60',
				dotColor: 'bg-red-500',
			},
			bot: { label: 'Blocked after 5 tries', flash: 'red' },
			app: { label: 'Account safe', flash: 'green', badge: 'PROTECTED' },
		},
	],
	'legitimate-blocked': [
		{
			bot: { label: '10K req/sec (ongoing)', flash: 'red' },
			customer: { label: 'Browsing products...', flash: 'idle' },
			edge1: {
				active: true,
				reverse: false,
				label: '10K req/sec',
				dotColor: 'bg-red-500',
			},
			app: {
				label: 'Rate limit check...',
				flash: 'idle',
				badge: null,
				ipLimitLabel: 'IP check...',
				ipLimitFlash: 'amber',
			},
		},
		{
			edge1: {
				active: true,
				reverse: true,
				label: '429 (bot)',
				dotColor: 'bg-red-500',
			},
			app: {
				label: 'Bot IP blocked!',
				flash: 'green',
				ipLimitLabel: 'Bot: BLOCKED',
				ipLimitFlash: 'red',
			},
			bot: { label: 'Throttled', flash: 'red' },
		},
		{
			edge1: { active: false },
			edge2: {
				active: true,
				reverse: false,
				label: 'GET /products',
				dotColor: 'bg-emerald-500',
			},
			customer: { label: 'Loading...', flash: 'idle' },
			app: {
				label: 'CPU: 5%',
				flash: 'green',
				requestCount: 'Bot blocked',
			},
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: '200 OK (fast)',
				dotColor: 'bg-emerald-500',
			},
			customer: { label: 'Products loaded!', flash: 'green' },
			app: {
				label: 'Legitimate users safe',
				flash: 'green',
				badge: 'PROTECTED',
			},
		},
	],
	safelist: [
		{
			customer: { label: 'Internal service (10.0.0.1)', flash: 'idle' },
			edge2: {
				active: true,
				reverse: false,
				label: '500 req/sec (internal)',
				dotColor: 'bg-cyan-500',
			},
			app: {
				label: 'Checking safelist...',
				flash: 'idle',
				badge: null,
				ipLimitLabel: 'Safelist check',
				ipLimitFlash: 'amber',
			},
		},
		{
			edge2: { active: false },
			app: {
				label: '10.0.0.0/8: safelisted',
				flash: 'green',
				ipLimitLabel: 'SAFELISTED',
				ipLimitFlash: 'green',
			},
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: '200 OK (no limit)',
				dotColor: 'bg-emerald-500',
			},
			customer: { label: 'Internal traffic flows freely', flash: 'green' },
			app: { label: 'Safelist bypasses throttle', flash: 'green' },
		},
	],
};

// ─── Build step definitions ────────────────────────────────────────────

const STEP_DEFS = [
	{ id: 'rails-rate-limit', title: 'Add Controller Rate Limit' },
	{ id: 'add-rack-attack', title: 'Install the Throttling Gem' },
	{ id: 'ip-throttle', title: 'Configure IP Throttle' },
	{ id: 'user-throttle', title: 'Configure Login Throttle' },
	{ id: 'safelist', title: 'Configure Safelist' },
	{ id: 'response-429', title: 'Configure 429 Response' },
];

const RAILS_RATE_LIMIT_COMMANDS = [
	{
		id: 'wrong-before-action',
		label: 'before_action :check_rate_limit',
		command:
			'echo "before_action :check_rate_limit" >> app/controllers/api/sessions_controller.rb',
		correct: false,
		feedback:
			'A custom before_action means implementing counting, storage, expiry, and the 429 response yourself. Rails 8 ships this capability natively as a one-line declaration.',
	},
	{
		id: 'correct',
		label: 'rate_limit to: 5, within: 1.minute',
		command:
			'echo "rate_limit to: 5, within: 1.minute" >> app/controllers/api/sessions_controller.rb',
		correct: true,
	},
	{
		id: 'wrong-no-window',
		label: 'rate_limit to: 5',
		command:
			'echo "rate_limit to: 5" >> app/controllers/api/sessions_controller.rb',
		correct: false,
		feedback:
			'This declares a count with no time window. Five per second, per minute, or per day are wildly different policies, and Rails does not know when to reset the counter.',
	},
];

const RACK_ATTACK_COMMANDS = [
	{
		id: 'wrong-throttle-gem',
		label: 'bundle add rack-throttle',
		command: 'bundle add rack-throttle',
		correct: false,
		feedback:
			'rack-throttle is unmaintained and no longer receives security patches. Look for the actively maintained Rack-level rate limiting gem widely adopted in the Rails community.',
	},
	{
		id: 'correct',
		label: 'bundle add rack-attack',
		command: 'bundle add rack-attack',
		correct: true,
	},
	{
		id: 'wrong-middleware',
		label: 'bundle add rack-limiter',
		command: 'bundle add rack-limiter',
		correct: false,
		feedback:
			'rack-limiter is not a standard gem. Look for the widely adopted Rack-level rate limiting solution with throttle, safelist, and blocklist support.',
	},
];

const IP_THROTTLE_OPTIONS = [
	{
		id: 'wrong-no-limit',
		label: 'Throttle at 10,000 requests per minute',
		code: `Rack::Attack.throttle("req/ip", limit: 10000, period: 60) do |req|
  req.ip
end`,
		correct: false,
		feedback:
			'10,000 requests per minute is too high. A bot sending 167 req/sec would still get through. A reasonable limit is 100-300 per minute.',
	},
	{
		id: 'wrong-global',
		label: 'Global throttle (not per-IP)',
		code: `Rack::Attack.throttle("req/global", limit: 100, period: 60) do |req|
  "global"  # Same key for all requests
end`,
		correct: false,
		feedback:
			'A global throttle shares the limit across ALL users. 100 total requests per minute means 100 users each making 1 request would hit the limit.',
	},
	{
		id: 'correct',
		label: 'Throttle at 100 requests per minute per IP',
		code: `Rack::Attack.throttle("req/ip", limit: 100, period: 60) do |req|
  req.ip if req.path.start_with?("/api/")
end`,
		correct: true,
	},
];

const USER_THROTTLE_OPTIONS = [
	{
		id: 'wrong-all-endpoints',
		label: 'Throttle all POST requests at 5/min',
		code: `Rack::Attack.throttle("post/ip", limit: 5, period: 60) do |req|
  req.ip if req.post?
end`,
		correct: false,
		feedback:
			'Throttling ALL POST requests at 5/min would block normal checkout and order creation. Only throttle sensitive endpoints like login.',
	},
	{
		id: 'correct',
		label: 'Throttle login by IP + email combination',
		code: `Rack::Attack.throttle("login/ip", limit: 5, period: 60) do |req|
  if req.path == '/api/sessions' && req.post?
    "#{req.ip}-#{req.params['email']}"
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-no-ip',
		label: 'Throttle login by email only',
		code: `Rack::Attack.throttle("login/email", limit: 5, period: 60) do |req|
  req.params['email'] if req.path == '/api/sessions' && req.post?
end`,
		correct: false,
		feedback:
			'Throttling by email alone lets an attacker try 5 passwords per email, then switch. Combine IP + email for defense in depth.',
	},
];

const SAFELIST_OPTIONS = [
	{
		id: 'wrong-no-safelist',
		label: 'No safelist (rate limit everything)',
		code: `# No safelist configured
# Internal services will be rate limited too`,
		correct: false,
		feedback:
			'Internal services (monitoring, health checks) make frequent requests. Without a safelist, they get throttled and produce false alerts.',
	},
	{
		id: 'wrong-safelist-all',
		label: 'Safelist all authenticated users',
		code: `Rack::Attack.safelist("authenticated") do |req|
  req.env['HTTP_AUTHORIZATION'].present?
end`,
		correct: false,
		feedback:
			'Safelisting all authenticated users defeats the purpose. A single compromised account could flood the API without ever being throttled; trust cannot hinge on something an attacker gets by logging in.',
	},
	{
		id: 'correct',
		label: 'Safelist internal IP ranges',
		code: `Rack::Attack.safelist("internal") do |req|
  req.ip.start_with?("10.") ||
    req.ip.start_with?("172.16.") ||
    req.ip == "127.0.0.1"
end`,
		correct: true,
	},
];

const RESPONSE_429_OPTIONS = [
	{
		id: 'wrong-no-retry-after',
		label: '429 with generic error message',
		code: `Rack::Attack.throttled_responder = lambda do |request|
  [429, { 'Content-Type' => 'application/json' },
   ['{"error":{"code":"RATE_LIMITED","message":"Too many requests"}}']]
end`,
		correct: false,
		feedback:
			'This tells the client it is being throttled but not when to try again. Well-behaved clients back off automatically only when the response says how long to wait.',
	},
	{
		id: 'wrong-503',
		label: 'Return 503 Service Unavailable',
		code: `Rack::Attack.throttled_responder = lambda do |request|
  [503, { 'Content-Type' => 'application/json' },
   ['{"error":{"code":"SERVICE_UNAVAILABLE","message":"Try later"}}']]
end`,
		correct: false,
		feedback:
			'503 means the server is down. 429 means the client is sending too many requests. The distinction matters: 503 triggers circuit breakers, 429 triggers backoff.',
	},
	{
		id: 'correct',
		label: '429 with Retry-After header',
		code: `Rack::Attack.throttled_responder = lambda do |request|
  retry_after = request.env['rack.attack.match_data'][:period]
  [429,
   { 'Content-Type' => 'application/json',
     'Retry-After' => retry_after.to_s },
   ['{"error":{"code":"RATE_LIMITED","message":"Too many requests"}}']]
end`,
		correct: true,
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{
		commands: RAILS_RATE_LIMIT_COMMANDS,
		outputLines: [
			{
				text: 'rate_limit added to SessionsController',
				color: 'green' as const,
			},
		],
	},
	{
		commands: RACK_ATTACK_COMMANDS,
		outputLines: [
			{
				text: 'Bundle complete! 1 Gemfile dependency added.',
				color: 'green' as const,
			},
		],
	},
	null,
	null,
	null,
	null,
];

// ─── Stress test scenarios ─────────────────────────────────────────────

const STRESS_SCENARIOS = [
	{
		id: 'bot-flood',
		label: 'Bot floods API (with IP throttle)',
		description: 'Bot IP blocked after 100 requests',
		method: 'GET' as const,
		path: '/api/products',
		actor: 'bot',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '429 Too Many Requests', color: 'red' },
			{ text: 'Retry-After: 60', color: 'yellow' },
			{ text: '# Bot throttled at IP level', color: 'green' },
		],
		story: [
			'Same bot, same 10K requests.',
			'Rack::Attack throttles at 100/min per IP.',
			'After 100 requests: 429 with Retry-After: 60.',
			'Server CPU stays at 3%.',
		],
	},
	{
		id: 'brute-force',
		label: 'Attacker brute-forces login (with rate limit)',
		description: 'Login blocked after 5 attempts per minute',
		method: 'POST' as const,
		path: '/api/sessions',
		actor: 'attacker',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '429 Too Many Requests', color: 'red' },
			{ text: '# Only 5 login attempts per minute', color: 'green' },
			{ text: '# Brute force infeasible at this rate', color: 'green' },
		],
		story: [
			'Same attacker, same 1000 password guesses.',
			'rate_limit allows only 5 per minute.',
			'After 5 attempts: 429. Must wait 60 seconds.',
			'1000 guesses would take over 3 hours.',
		],
	},
	{
		id: 'legitimate-blocked',
		label: 'Customer browses during attack (protected)',
		description: 'Bot throttled, customer gets through',
		method: 'GET' as const,
		path: '/api/products',
		actor: 'customer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK (120ms)', color: 'green' },
			{ text: '# Bot is rate-limited, server has capacity', color: 'green' },
		],
		story: [
			'Same customer, same product page.',
			'Bot is rate-limited at the IP level.',
			'Server CPU is 3% instead of 98%.',
			'Customer loads the page in 120ms.',
		],
	},
	{
		id: 'safelist',
		label: 'Internal service (safelisted)',
		description: 'Internal monitoring bypasses rate limits',
		method: 'GET' as const,
		path: '/health',
		actor: 'monitoring',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: '# 10.0.0.1 is safelisted', color: 'green' },
		],
		story: [
			'Internal monitoring pings /health 500 times per minute.',
			'10.0.0.0/8 is safelisted.',
			'Internal traffic flows without limits.',
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
				filename: 'app/controllers/api/sessions_controller.rb',
				language: 'ruby',
				code: `module Api
  class SessionsController < Api::BaseController
    # No rate limiting!
    # Accepts unlimited login attempts
    def create
      result = AuthenticateUser.call(
        params: params.expect(session: [:email, :password]))
      if result.success?
        render json: { token: result.token }
      else
        render json: { error: { code: "UNAUTHORIZED",
          message: "Invalid credentials" } },
          status: :unauthorized
      end
    end
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (completedStep >= 0) {
			files.push({
				filename: 'app/controllers/api/sessions_controller.rb',
				language: 'ruby',
				code: `module Api
  class SessionsController < Api::BaseController
    rate_limit to: 5, within: 1.minute
    # 5 login attempts per minute per IP
  end
end`,
			});
		}

		if (completedStep >= 1) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `# Rack-level rate limiting\ngem 'rack-attack'`,
			});
		}

		if (completedStep >= 2) {
			files.push({
				filename: 'config/initializers/rack_attack.rb',
				language: 'ruby',
				code: `Rack::Attack.throttle("req/ip", limit: 100, period: 60) do |req|
  req.ip if req.path.start_with?("/api/")
end${
					completedStep >= 3
						? `

Rack::Attack.throttle("login/ip", limit: 5, period: 60) do |req|
  if req.path == '/api/sessions' && req.post?
    "#{req.ip}-#{req.params['email']}"
  end
end`
						: '\n# Next: login throttle...'
				}${
					completedStep >= 4
						? `

Rack::Attack.safelist("internal") do |req|
  req.ip.start_with?("10.") ||
    req.ip.start_with?("172.16.") ||
    req.ip == "127.0.0.1"
end`
						: ''
				}${
					completedStep >= 5
						? `

Rack::Attack.throttled_responder = lambda do |request|
  retry_after = request.env['rack.attack.match_data'][:period]
  [429,
   { 'Content-Type' => 'application/json',
     'Retry-After' => retry_after.to_s },
   ['{"error":{"code":"RATE_LIMITED","message":"Too many requests"}}']]
end`
						: ''
				}`,
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'app/controllers/api/sessions_controller.rb',
				language: 'ruby',
				code: '# Step 1: Add rate_limit to the login controller...',
			});
		}

		return files;
	}

	return [
		{
			filename: 'app/controllers/api/sessions_controller.rb',
			language: 'ruby',
			code: `module Api
  class SessionsController < Api::BaseController
    rate_limit to: 5, within: 1.minute

    def create
      result = AuthenticateUser.call(
        params: params.expect(session: [:email, :password]))
      if result.success?
        render json: { token: result.token }
      else
        render json: { error: { code: "UNAUTHORIZED",
          message: "Invalid credentials" } },
          status: :unauthorized
      end
    end
  end
end`,
		},
		{
			filename: 'config/initializers/rack_attack.rb',
			language: 'ruby',
			code: `Rack::Attack.throttle("req/ip", limit: 100, period: 60) do |req|
  req.ip if req.path.start_with?("/api/")
end

Rack::Attack.throttle("login/ip", limit: 5, period: 60) do |req|
  if req.path == '/api/sessions' && req.post?
    "#{req.ip}-#{req.params['email']}"
  end
end

Rack::Attack.safelist("internal") do |req|
  req.ip.start_with?("10.") ||
    req.ip.start_with?("172.16.") ||
    req.ip == "127.0.0.1"
end

Rack::Attack.throttled_responder = lambda do |request|
  retry_after = request.env['rack.attack.match_data'][:period]
  [429,
   { 'Content-Type' => 'application/json',
     'Retry-After' => retry_after.to_s },
   ['{"error":{"code":"RATE_LIMITED","message":"Too many requests"}}']]
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

interface BotNodeData extends SimpleNodeState {
	[key: string]: unknown;
}
const BotNode = memo(({ data }: { data: BotNodeData }) => {
	const d = data as BotNodeData;
	const flowData: FlowNodeData = {
		label: 'Bot / Attacker',
		icon: 'BT',
		color: '#ef4444',
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

interface CustomerNodeData extends SimpleNodeState {
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

interface RlAppData extends AppVizState {
	[key: string]: unknown;
}
const RlAppNode = memo(({ data }: { data: RlAppData }) => {
	const d = data as RlAppData;
	const showPanels = d.ipLimitLabel || d.userLimitLabel;
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
				{d.badge && (
					<Badge
						className={`text-[9px] ${
							d.badge === 'PROTECTED'
								? 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
								: 'text-red-700 dark:text-red-400 border-red-300 dark:border-red-700'
						}`}
						variant="outline"
					>
						{d.badge}
					</Badge>
				)}
				{d.requestCount && (
					<p className="text-[10px] text-muted-foreground mt-0.5">
						{d.requestCount}
					</p>
				)}
				{showPanels && (
					<div className="flex gap-1 mt-2 pt-2 border-t border-border">
						{d.ipLimitLabel && (
							<div
								className={`flex-1 rounded border ${FLASH_BORDER[d.ipLimitFlash]} ${FLASH_BG[d.ipLimitFlash]} p-1 text-center transition-colors duration-300`}
							>
								<p className="text-[9px] font-semibold text-foreground truncate">
									{d.ipLimitLabel}
								</p>
							</div>
						)}
						{d.userLimitLabel && (
							<div
								className={`flex-1 rounded border ${FLASH_BORDER[d.userLimitFlash]} ${FLASH_BG[d.userLimitFlash]} p-1 text-center transition-colors duration-300`}
							>
								<p className="text-[9px] font-semibold text-foreground truncate">
									{d.userLimitLabel}
								</p>
							</div>
						)}
					</div>
				)}
			</FlowNode>
		</>
	);
});

function toDotFill(twClass: string): string {
	if (twClass.includes('emerald')) return '#10b981';
	if (twClass.includes('red')) return '#ef4444';
	if (twClass.includes('amber')) return '#f59e0b';
	if (twClass.includes('cyan')) return '#06b6d4';
	return '#a1a1aa';
}

interface RlEdgeData extends EdgeVizState {
	[key: string]: unknown;
}
const RlEdge = memo(
	({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
		const d = (data ?? DEFAULT_EDGE) as RlEdgeData;
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

const rlNodeTypes = { bot: BotNode, customer: CustomerNode, app: RlAppNode };
const rlEdgeTypes = { rl: RlEdge };

// ─── Main component ────────────────────────────────────────────────────

export function Level42RateLimiting({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<'observe' | 'build' | 'reward'>('observe');
	const isReward = phase === 'reward';

	const [botState, setBotState] = useState<SimpleNodeState>(DEFAULT_BOT);
	const [customerState, setCustomerState] =
		useState<SimpleNodeState>(DEFAULT_CUSTOMER);
	const [appState, setAppState] = useState<AppVizState>(DEFAULT_APP);
	const [edge1State, setEdge1State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge2State, setEdge2State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setBotState(DEFAULT_BOT);
		setCustomerState(DEFAULT_CUSTOMER);
		setAppState(isReward ? DEFAULT_APP_REWARD : DEFAULT_APP);
		setEdge1State(DEFAULT_EDGE);
		setEdge2State(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.bot) setBotState((prev) => ({ ...prev, ...frame.bot }));
		if (frame.customer)
			setCustomerState((prev) => ({ ...prev, ...frame.customer }));
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

	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const allOptions: Record<number, typeof IP_THROTTLE_OPTIONS> = {
				2: IP_THROTTLE_OPTIONS,
				3: USER_THROTTLE_OPTIONS,
				4: SAFELIST_OPTIONS,
				5: RESPONSE_429_OPTIONS,
			};
			const options = allOptions[stepper.currentStep];
			if (!options) return;
			const option = options.find((o) => o.id === optionId);
			if (!option) return;
			if (option.correct) stepper.completeStep();
			else stepper.recordWrongAttempt(option.feedback ?? 'Not quite right.');
		},
		[stepper],
	);

	const stressTest = useStressTest(STRESS_SCENARIOS);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_FRAMES[scenarioId];
			if (frames) {
				setBotState(DEFAULT_BOT);
				setCustomerState(DEFAULT_CUSTOMER);
				setAppState(DEFAULT_APP_REWARD);
				setEdge1State(DEFAULT_EDGE);
				setEdge2State(DEFAULT_EDGE);
				runAnimation(frames, undefined, ANIMATION_DURATION_MS * 2);
			}
		},
		[vizAnimating, stressTest, runAnimation],
	);

	const handleValidate = useCallback((): ValidationResult => {
		if (phase !== 'reward')
			return { valid: false, message: 'Complete all phases first.' };
		if (stressTest.results.length < 3)
			return {
				valid: false,
				message: 'Fire at least 3 stress test scenarios.',
			};
		return { valid: true, message: 'Rate limiting is configured!' };
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

	const flowNodes = useMemo(
		(): Node[] => [
			{
				id: 'bot',
				type: 'bot',
				position: { x: 0, y: 0 },
				data: { ...botState } satisfies BotNodeData,
			},
			{
				id: 'customer',
				type: 'customer',
				position: { x: 0, y: 120 },
				data: { ...customerState } satisfies CustomerNodeData,
			},
			{
				id: 'app',
				type: 'app',
				position: { x: 300, y: 30 },
				data: { ...appState } satisfies RlAppData,
			},
		],
		[botState, customerState, appState],
	);

	const flowEdges = useMemo(
		(): Edge[] => [
			{
				id: 'e-bot-app',
				source: 'bot',
				target: 'app',
				type: 'rl',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge1State } satisfies RlEdgeData,
			},
			{
				id: 'e-customer-app',
				source: 'customer',
				target: 'app',
				type: 'rl',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge2State } satisfies RlEdgeData,
			},
		],
		[edge1State, edge2State],
	);

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
		const stepOptions: Record<number, typeof IP_THROTTLE_OPTIONS> = {
			2: IP_THROTTLE_OPTIONS,
			3: USER_THROTTLE_OPTIONS,
			4: SAFELIST_OPTIONS,
			5: RESPONSE_429_OPTIONS,
		};
		return {
			type: 'option' as const,
			options: shuffleOptions(stepOptions[idx], idx),
		};
	}, [stepper.currentStep]);

	const buildCodePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground mb-2">
							In Level 40, you added middleware to intercept requests before
							Rails. Now a bot is sending 10,000 requests per second from a
							single IP, and the login endpoint is being brute-forced.
						</p>
						<p className="text-sm text-muted-foreground">
							Every request hits the full stack. No throttling, no protection.
							Legitimate users are locked out because the server is overloaded.
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
							Add rate limiting at two levels: Rails 8 built-in rate_limit for
							controller actions, and Rack::Attack for IP-level throttling.
						</p>
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						steps={stepper.steps}
					/>
				</div>
			);
		}
		return (
			<div className="space-y-4 p-4">
				<div>
					<h3 className="text-sm font-semibold text-foreground mb-2">Legend</h3>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-emerald-500" />
							<span className="text-muted-foreground">Request allowed</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">Rate limited (429)</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Allowed</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Throttled</div>
					</div>
				</div>
			</div>
		);
	};

	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col p-4 gap-4">
					<div className="flex-1 min-h-0">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={rlEdgeTypes}
							nodes={flowNodes}
							nodeTypes={rlNodeTypes}
						/>
					</div>
					<div className="px-6 pb-4">
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
										'Add a rate limit to the login controller using the Rails 8 built-in rate_limit macro.'}
									{stepper.currentStep === 1 &&
										'Install a Rack-level throttling gem to stop floods before they reach Rails.'}
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
									'How should Rack::Attack throttle requests by IP?'}
								{stepper.currentStep === 3 &&
									'How should the login endpoint be protected from brute force?'}
								{stepper.currentStep === 4 &&
									'How should internal services bypass rate limits?'}
								{stepper.currentStep === 5 &&
									'What should the rate-limited response look like?'}
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
		return (
			<div className="flex-1 flex flex-col p-4 gap-4">
				<div className="flex-1 min-h-0">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={rlEdgeTypes}
						nodes={flowNodes}
						nodeTypes={rlNodeTypes}
					/>
				</div>
				<div className="flex-1 min-h-0 flex flex-col px-6 pb-4">
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
					levelName="Rate Limiting"
					levelNumber={42}
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
					learningGoal="Rate limit at two layers: inside the app for specific actions, and at the Rack layer for raw IP floods that should never reach a controller."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level42RateLimiting;
