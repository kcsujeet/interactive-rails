/**
 * Level 41: CORS
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * MECHANISM-HONEST redesign (2026-07-10). Verified against:
 *   - MDN CORS guide (developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS):
 *     simple requests ARE sent to the server; the browser withholds the
 *     response from scripts when Access-Control-Allow-Origin is missing.
 *     Non-simple requests (DELETE) send an OPTIONS preflight first; if the
 *     preflight fails, the actual request is never sent. CORS protects the
 *     browser user; non-browser clients (curl) are unaffected.
 *   - rack-cors source (cyu/rack-cors lib/rack/cors.rb): preflights are
 *     answered by the middleware directly (`return [200, headers, []]`,
 *     app never called); actual requests ALWAYS pass through to the app
 *     (`@app.call env`), allowed origin or not; a disallowed origin just
 *     gets no headers added.
 *   - Before-state ground truth (project/myapp, rails new --api): a fully
 *     commented-out config/initializers/cors.rb and a commented
 *     `# gem "rack-cors"` Gemfile line ship with the app.
 *
 * The old version showed a "CORS Middleware" gate node blocking requests
 * server-side before they "reached the app". That is the opposite of how
 * CORS works and is the P0 this rewrite fixes: the topology is now just
 * Browser <-> Rails API, and the discard happens visibly at the browser
 * on the response leg.
 */

import { ArrowRight, Check, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
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
	type ProbeConfig,
	ProbeTerminal,
} from '@/components/levels/ProbeTerminal';
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
import {
	type ApiVizState,
	type ClientVizState,
	CorsPipeline,
	type EdgeVizState,
} from './CorsPipeline';

registerLevelCode('act6-level41-cors', () =>
	getCodeFiles('reward', STEP_DEFS.length - 1),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Visualization state + frames
// ──────────────────────────────────────────────

export type AnimFrame = {
	client?: Partial<ClientVizState>;
	api?: Partial<ApiVizState>;
	req?: Partial<EdgeVizState>;
	res?: Partial<EdgeVizState>;
};

const IDLE_EDGE: EdgeVizState = {
	active: false,
	label: '',
	dotColor: 'bg-primary',
};

const OBSERVE_CLIENT: ClientVizState = {
	mode: 'browser',
	origin: 'localhost:3001',
	sublabel: 'storefront, now on its own origin',
	badge: null,
	flash: 'idle',
	consoleLine: null,
};

const OBSERVE_API: ApiVizState = {
	sublabel: 'replies without CORS headers',
	badge: null,
	flash: 'idle',
	corsStrip: null,
};

const REWARD_CLIENT: ClientVizState = {
	mode: 'browser',
	origin: 'localhost:3001',
	sublabel: 'storefront on its own origin',
	badge: null,
	flash: 'idle',
	consoleLine: null,
};

const REWARD_API: ApiVizState = {
	sublabel: 'permission headers on every reply',
	badge: null,
	flash: 'idle',
	corsStrip: null,
};

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

export const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'response-discarded',
		label: 'The API did the work; the browser threw the response away',
	},
	{
		id: 'preflight-gate',
		label: 'A failed preflight means the real request is never sent',
	},
	{
		id: 'browser-only',
		label: 'CORS lives in the browser; curl reads everything',
	},
];

// ──────────────────────────────────────────────
// Probe definitions (observe phase)
// ──────────────────────────────────────────────

export const PROBES: ProbeConfig[] = [
	{
		id: 'fetch-products',
		label: 'Load the storefront from the new origin',
		command:
			'fetch("http://localhost:3000/api/products") // page on localhost:3001',
		responseLines: [
			{ text: 'Rails log: GET /api/products -> 200 OK (12ms)', color: 'green' },
			{ text: 'Browser console:', color: 'muted' },
			{
				text: "Access to fetch at 'http://localhost:3000/api/products'",
				color: 'red',
			},
			{
				text: "from origin 'http://localhost:3001' has been blocked by CORS policy:",
				color: 'red',
			},
			{
				text: 'No Access-Control-Allow-Origin header is present.',
				color: 'red',
			},
			{
				text: 'The response existed. The browser threw it away.',
				color: 'yellow',
			},
		],
		story: [
			'A customer opens the storefront, now served from its own origin (localhost:3001 in development).',
			'The page fetches products from the API on localhost:3000, and the request DOES reach Rails: the log shows 200 OK.',
			'The response comes back without an Access-Control-Allow-Origin header, so the browser discards it before the script can read a byte.',
			'The Rails server did all the work. The customer sees an empty storefront.',
		],
	},
	{
		id: 'preflight-delete',
		label: 'Delete a product from the admin dashboard',
		command:
			'fetch("http://localhost:3000/api/products/1", { method: "DELETE" })',
		responseLines: [
			{
				text: 'Browser: DELETE is not a simple request, asking permission first',
				color: 'cyan',
			},
			{ text: 'OPTIONS /api/products/1 -> 404, no CORS headers', color: 'red' },
			{
				text: 'Preflight failed: the DELETE was never sent.',
				color: 'red',
			},
			{ text: 'Rails log: no DELETE request ever arrived.', color: 'yellow' },
		],
		story: [
			'An admin clicks Delete in the dashboard.',
			'DELETE cannot be sent blind: the browser first asks permission with an OPTIONS preflight, and that preflight DOES reach Rails.',
			'Rails has no answer for it: no route matches OPTIONS, and the reply carries no permission headers. The preflight fails.',
			'So the browser never sends the DELETE at all. The product stays listed, and the button feels broken.',
		],
	},
	{
		id: 'curl-bypass',
		label: 'Fetch the same endpoint with curl',
		command: 'curl http://localhost:3000/api/products',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{
				text: '[{"id":1,"name":"Ceramic Mug"}, ... 42 products]',
				color: 'green',
			},
			{
				text: 'No browser involved, so nobody checks for CORS headers.',
				color: 'muted',
			},
		],
		story: [
			'A developer hits the same endpoint with curl to check whether the API is broken.',
			'It is not: 200 OK and the full product list, every time.',
			'CORS is enforced by browsers to protect their users. curl has no user to protect and reads everything.',
			'The API was never down. What is missing is one response header, and only browsers care.',
		],
	},
];

export const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'fetch-products': ['response-discarded'],
	'preflight-delete': ['preflight-gate'],
	'curl-bypass': ['browser-only'],
};

// ──────────────────────────────────────────────
// Observe animation frames
// ──────────────────────────────────────────────

export const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'fetch-products': [
		{
			client: {
				mode: 'browser',
				origin: 'localhost:3001',
				sublabel: 'fetch("http://localhost:3000/api/products")',
				badge: 'GET',
				flash: 'amber',
			},
			req: {
				active: true,
				label: 'GET + Origin: http://localhost:3001',
				dotColor: 'bg-primary',
			},
		},
		{
			api: {
				sublabel: 'ran the query, returned 42 products',
				badge: '200 OK',
				flash: 'green',
			},
			req: { active: false },
			res: {
				active: true,
				label: 'no Access-Control-Allow-Origin',
				dotColor: 'bg-destructive',
			},
		},
		{
			client: {
				sublabel: 'header missing: response discarded at the door',
				badge: 'DISCARDED',
				flash: 'red',
				consoleLine:
					'Storefront rendered 0 products. Console: blocked by CORS policy.',
			},
			api: { sublabel: 'did the work; nobody saw it', badge: '200 OK' },
			res: { active: false },
		},
	],
	'preflight-delete': [
		{
			client: {
				mode: 'browser',
				origin: 'localhost:3001',
				sublabel: 'Delete clicked. DELETE needs permission first',
				badge: 'OPTIONS',
				flash: 'amber',
			},
			req: {
				active: true,
				label: 'OPTIONS preflight: may I send DELETE?',
				dotColor: 'bg-primary',
			},
		},
		{
			api: {
				sublabel: 'no route answers OPTIONS; no permission headers',
				badge: '404',
				flash: 'red',
			},
			req: { active: false },
			res: {
				active: true,
				label: 'reply carries no permission',
				dotColor: 'bg-destructive',
			},
		},
		{
			client: {
				sublabel: 'preflight failed: the DELETE is never sent',
				badge: 'NEVER SENT',
				flash: 'red',
				consoleLine: 'Product is still listed. The delete button does nothing.',
			},
			res: { active: false },
		},
	],
	'curl-bypass': [
		{
			client: {
				mode: 'terminal',
				sublabel: 'curl http://localhost:3000/api/products',
				badge: 'GET',
				flash: 'amber',
				consoleLine: null,
			},
			req: {
				active: true,
				label: 'GET, no browser attached',
				dotColor: 'bg-primary',
			},
		},
		{
			api: {
				sublabel: 'same endpoint, same answer',
				badge: '200 OK',
				flash: 'green',
			},
			req: { active: false },
			res: {
				active: true,
				label: 'full JSON, delivered untouched',
				dotColor: 'bg-success',
			},
		},
		{
			client: {
				sublabel: 'no browser, no CORS check',
				badge: '200 OK',
				flash: 'green',
				consoleLine: 'all 42 products printed to the terminal',
			},
			res: { active: false },
		},
	],
};

// ──────────────────────────────────────────────
// Reward animation frames
// Honest per the rack-cors source: actual requests always reach the app;
// preflights are answered by the middleware itself; "blocked" happens in
// the visitor's browser, never on the server.
// ──────────────────────────────────────────────

export const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'fetch-products': [
		{
			client: {
				mode: 'browser',
				origin: 'localhost:3001',
				sublabel: 'same fetch, same new origin',
				badge: 'GET',
				flash: 'amber',
			},
			req: {
				active: true,
				label: 'GET + Origin: http://localhost:3001',
				dotColor: 'bg-primary',
			},
		},
		{
			api: {
				sublabel: 'origin is on the list: header added to the reply',
				badge: '200 OK',
				flash: 'green',
				corsStrip: 'allow http://localhost:3001',
			},
			req: { active: false },
			res: {
				active: true,
				label: 'Access-Control-Allow-Origin: http://localhost:3001',
				dotColor: 'bg-success',
			},
		},
		{
			client: {
				sublabel: 'header present: the script receives the data',
				badge: '200 OK',
				flash: 'green',
				consoleLine: 'Storefront rendered 42 products.',
			},
			res: { active: false },
		},
	],
	'preflight-delete': [
		{
			client: {
				mode: 'browser',
				origin: 'localhost:3001',
				sublabel: 'same Delete click: permission check first',
				badge: 'OPTIONS',
				flash: 'amber',
			},
			req: {
				active: true,
				label: 'OPTIONS preflight: may I send DELETE?',
				dotColor: 'bg-primary',
			},
		},
		{
			api: {
				sublabel:
					'rack-cors answers the preflight itself; the app is not called',
				badge: '200',
				flash: 'green',
				corsStrip: 'preflight: DELETE allowed for localhost:3001',
			},
			req: { active: false },
			res: {
				active: true,
				label: 'allowed methods include DELETE',
				dotColor: 'bg-success',
			},
		},
		{
			client: {
				sublabel: 'preflight passed: now the DELETE goes out',
				badge: 'DELETE',
				flash: 'amber',
			},
			res: { active: false },
			req: {
				active: true,
				label: 'DELETE /api/products/1',
				dotColor: 'bg-primary',
			},
		},
		{
			api: {
				sublabel: 'product deleted',
				badge: '200 OK',
				flash: 'green',
				corsStrip: 'allow http://localhost:3001',
			},
			req: { active: false },
			res: { active: true, label: '200 OK', dotColor: 'bg-success' },
		},
		{
			client: {
				sublabel: 'row disappears from the dashboard',
				badge: '200 OK',
				flash: 'green',
				consoleLine: 'Product removed.',
			},
			res: { active: false },
		},
	],
	'curl-bypass': [
		{
			client: {
				mode: 'terminal',
				sublabel: 'same curl command',
				badge: 'GET',
				flash: 'amber',
				consoleLine: null,
			},
			req: {
				active: true,
				label: 'GET, no browser attached',
				dotColor: 'bg-primary',
			},
		},
		{
			api: {
				sublabel: 'nothing changed for non-browser clients',
				badge: '200 OK',
				flash: 'green',
				corsStrip: 'no Origin header: nothing to do',
			},
			req: { active: false },
			res: {
				active: true,
				label: 'full JSON, exactly as before',
				dotColor: 'bg-success',
			},
		},
		{
			client: {
				sublabel: 'no browser, no CORS check',
				badge: '200 OK',
				flash: 'green',
				consoleLine: 'all 42 products printed, same as before the fix',
			},
			res: { active: false },
		},
	],
	'evil-read': [
		{
			client: {
				mode: 'browser',
				origin: 'evil.example.com',
				sublabel: "a malicious page reads the API from a visitor's browser",
				badge: 'GET',
				flash: 'amber',
			},
			req: {
				active: true,
				label: 'GET + Origin: https://evil.example.com',
				dotColor: 'bg-primary',
			},
		},
		{
			api: {
				sublabel: 'the request still runs; origin not on the list: no header',
				badge: '200 OK',
				flash: 'amber',
				corsStrip: 'evil.example.com: not allowed, no header added',
			},
			req: { active: false },
			res: {
				active: true,
				label: 'response without a permission header',
				dotColor: 'bg-destructive',
			},
		},
		{
			client: {
				sublabel:
					"the visitor's browser withholds the response from the script",
				badge: 'WITHHELD',
				flash: 'red',
				consoleLine: 'evil script received: nothing',
			},
			res: { active: false },
		},
	],
	'evil-delete': [
		{
			client: {
				mode: 'browser',
				origin: 'evil.example.com',
				sublabel: 'the malicious page tries a DELETE',
				badge: 'OPTIONS',
				flash: 'amber',
			},
			req: {
				active: true,
				label: 'OPTIONS + Origin: https://evil.example.com',
				dotColor: 'bg-primary',
			},
		},
		{
			api: {
				sublabel:
					'rack-cors answers the preflight: no permission for this origin',
				badge: '200',
				flash: 'amber',
				corsStrip: 'preflight from evil.example.com: denied',
			},
			req: { active: false },
			res: {
				active: true,
				label: 'no permission headers',
				dotColor: 'bg-destructive',
			},
		},
		{
			client: {
				sublabel: 'preflight failed: the DELETE never leaves the page',
				badge: 'NEVER SENT',
				flash: 'red',
				consoleLine: 'No DELETE was ever sent. The product is safe.',
			},
			res: { active: false },
		},
	],
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	client: {
		stageId: 'client',
		title: 'Browser (Same-Origin Policy)',
		description:
			'Browsers protect their users: a script from one origin (scheme + host + port) cannot read responses from another origin unless that server grants permission with a response header. Simple requests (like GET) are sent normally, and the browser withholds the RESPONSE when the header is missing. Riskier requests (like DELETE) trigger a permission check first: an OPTIONS preflight. If the preflight fails, the real request is never sent. Non-browser clients like curl skip all of this.',
	},
	api: {
		stageId: 'api',
		title: 'Rails API',
		description:
			'The API is healthy. It receives the cross-origin GET, runs the query, and returns 200 with data; the browser just refuses to hand that data to the page because no permission header came with it. Nothing in the app ever sees the preflight OPTIONS either: no route matches it, so it 404s. The fix is entirely about response headers, not request handling.',
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// The 3 probe pairs replay with the fix; 2 extras show what stays shut.
// ──────────────────────────────────────────────

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'fetch-products',
		label: 'Load the storefront from the new origin',
		description: 'Same fetch: the response now carries the permission header',
		method: 'GET',
		path: '/api/products',
		actor: 'localhost:3001',
		expectedResult: 'allowed',
		story: [
			'Same customer, same storefront, same fetch.',
			'The request reaches Rails exactly as before. The difference is one response header.',
			'Access-Control-Allow-Origin: http://localhost:3001 comes back, and the browser hands the data to the script.',
			'The storefront renders all 42 products.',
		],
	},
	{
		id: 'preflight-delete',
		label: 'Delete a product from the admin dashboard',
		description: 'The preflight now gets a real answer, so the DELETE follows',
		method: 'DELETE',
		path: '/api/products/1',
		actor: 'localhost:3001',
		expectedResult: 'allowed',
		story: [
			'Same admin, same Delete click.',
			'The browser still asks permission first, and now the preflight gets a real answer: the middleware replies directly with the allowed methods, before the request ever reaches the router.',
			'Permission granted, the browser sends the DELETE, Rails deletes the product, the row disappears.',
			'Two round trips, invisible to the admin. The button just works.',
		],
	},
	{
		id: 'curl-bypass',
		label: 'Fetch the same endpoint with curl',
		description: 'Unchanged: CORS never applied to non-browser clients',
		method: 'GET',
		path: '/api/products',
		actor: 'terminal',
		expectedResult: 'allowed',
		story: [
			'Same curl command from the same terminal.',
			'Nothing changed: curl never checked for CORS headers and still does not.',
			'The config protects browser users; it neither helps nor hinders non-browser clients.',
			'Scripts, mobile apps, and server-to-server calls are unaffected.',
		],
	},
	{
		id: 'evil-read',
		label: 'Read the API from a malicious page',
		description: "The app still runs; the visitor's browser withholds the data",
		method: 'GET',
		path: '/api/products',
		actor: 'evil.example.com',
		expectedResult: 'blocked',
		story: [
			"A visitor lands on a malicious page, and its script calls your API from the visitor's own browser.",
			'The request still reaches Rails and still returns 200: the server is not the wall.',
			"But evil.example.com is not on the origin list, so no permission header is added, and the visitor's browser gives the script nothing.",
			'"Blocked" here means the browser withheld the response on the way in.',
		],
	},
	{
		id: 'evil-delete',
		label: 'Fire a DELETE from a malicious page',
		description:
			'The preflight gets no permission, so the DELETE is never sent',
		method: 'DELETE',
		path: '/api/products/1',
		actor: 'evil.example.com',
		expectedResult: 'blocked',
		story: [
			"The same malicious page escalates: it tries to DELETE a product through its visitor's browser.",
			'DELETE requires a preflight, and the middleware answers it: no permission for this origin.',
			'The browser never sends the DELETE. The destructive request never even leaves the page.',
			'For non-simple requests, the permission check stops the damage before it starts.',
		],
	},
];

// ──────────────────────────────────────────────
// Step definitions (3 steps: 1 terminal + 2 OptionCard)
// ──────────────────────────────────────────────

export const STEP_DEFS: StepDef[] = [
	{ id: 'add-gem', title: 'Install the CORS Middleware' },
	{ id: 'configure-origins', title: 'Name the Allowed Origins' },
	{ id: 'allow-methods', title: 'Declare the Allowed Methods' },
];

const STEP_TYPES: ('terminal' | 'option')[] = ['terminal', 'option', 'option'];

// ──────────────────────────────────────────────
// Step 0: add the gem (terminal)
// ──────────────────────────────────────────────

export const ADD_GEM_COMMANDS: TerminalCommand[] = [
	{
		id: 'wrong-npm',
		label: 'npm install cors',
		command: 'npm install cors',
		correct: false,
		feedback:
			'cors is a Node.js package for Express servers. The missing header has to come from the Rails side, in Ruby.',
	},
	{
		id: 'correct',
		label: 'bundle add rack-cors',
		command: 'bundle add rack-cors',
		correct: true,
	},
	{
		id: 'wrong-gem-install',
		label: 'gem install rack-cors',
		command: 'gem install rack-cors',
		correct: false,
		feedback:
			"That installs into your machine's Ruby, invisibly to the project. Teammates and CI would run without it and ship the same blank storefront.",
	},
];

const ADD_GEM_OUTPUT: TerminalOutputLine[] = [
	{ text: 'Fetching rack-cors 3.0.0', color: 'cyan' },
	{ text: 'Installing rack-cors 3.0.0', color: 'muted' },
	{ text: 'Bundle complete!', color: 'green' },
];

// ──────────────────────────────────────────────
// OptionCard step data
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const CORS_ORIGIN_OPTIONS: StepOption[] = [
	{
		id: 'wildcard',
		label: 'origins "*"',
		correct: false,
		feedback:
			"A wildcard announces that any website on the internet may read this API's responses from its visitors' browsers. The point of the list is to name who is trusted.",
	},
	{
		id: 'correct',
		label: 'origins "http://localhost:3001"',
		correct: true,
	},
	{
		id: 'own-origin',
		label: 'origins "http://localhost:3000"',
		correct: false,
		feedback:
			"That is the API's own address. The list names the origins that calls COME FROM, and the storefront is not served from the API's port.",
	},
];

const HTTP_METHODS_OPTIONS: StepOption[] = [
	{
		id: 'get-only',
		label: 'methods: [:get]',
		correct: false,
		feedback:
			'Reads would work, but every create, update, and delete from the dashboard would still fail its permission check.',
	},
	{
		id: 'any-method',
		label: 'methods: :any',
		correct: false,
		feedback:
			'It works, but it grants every method there is, including ones this API never serves. Grant what the routes actually answer.',
	},
	{
		// Matches the Rails-generated cors.rb template (rails new --api).
		id: 'correct',
		label: 'methods: [:get, :post, :put, :patch, :delete, :options, :head]',
		correct: true,
	},
];

export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Name the Allowed Origins',
		description:
			"The middleware is installed. Name the origins whose browser calls may read this API's responses. The storefront runs on its own origin now.",
		options: CORS_ORIGIN_OPTIONS,
	},
	2: {
		title: 'Declare the Allowed Methods',
		description:
			'Origins are set. Now declare which HTTP methods a permitted origin may use. The dashboard creates, edits, and deletes products.',
		options: HTTP_METHODS_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: ADD_GEM_COMMANDS, outputLines: ADD_GEM_OUTPUT },
	null,
	null,
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

export function getCodeFiles(phase: Phase, completedStep: number) {
	// Before anything: the honest rails-new-generated state. The stub file
	// exists on disk, fully commented out (ground truth: project/myapp).
	// The sample block is elided here so observe never shows the answer DSL.
	const STUB = `# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept
# cross-origin Ajax requests.

# ... a sample config ships below this line, entirely commented out.
# As long as it stays commented, the API sends no CORS headers on
# any response, and browsers discard whatever it returns.`;

	if (phase === 'observe' || completedStep < 0) {
		return [
			{
				filename: 'config/initializers/cors.rb',
				language: 'ruby',
				code: STUB,
				highlight: [],
			},
		];
	}

	const files = [];

	files.push({
		filename: 'Gemfile',
		language: 'ruby',
		code: `source "https://rubygems.org"

gem "rails", "~> 8.0.0"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "jbuilder"
gem "bcrypt", "~> 3.1.7"
gem "rack-cors"`,
		highlight: [8],
	});

	if (completedStep < 1) {
		files.push({
			filename: 'config/initializers/cors.rb',
			language: 'ruby',
			code: STUB,
			highlight: [],
		});
		return files;
	}

	files.push({
		filename: 'config/initializers/cors.rb',
		language: 'ruby',
		code:
			completedStep >= 2
				? `Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "http://localhost:3001"

    resource "/api/*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head]
  end
end`
				: `Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "http://localhost:3001"

    resource "/api/*",
      headers: :any,
      methods: [ ... ]  # which verbs may a permitted origin use?
  end
end`,
		highlight: completedStep >= 2 ? [3, 7] : [3],
	});

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend (reward left panel)
// ──────────────────────────────────────────────

function PipelineLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success shrink-0" />
					<span className="text-foreground">
						Allowed: the browser hands the response to the page
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive shrink-0" />
					<span className="text-foreground">
						Blocked: the visitor's browser withholds it (the server still ran)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level41CORS({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	// ── Observe phase state ──
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);

	// ── Frame-driven visualization state ──
	const [clientState, setClientState] =
		useState<ClientVizState>(OBSERVE_CLIENT);
	const [apiState, setApiState] = useState<ApiVizState>(OBSERVE_API);
	const [reqState, setReqState] = useState<EdgeVizState>(IDLE_EDGE);
	const [resState, setResState] = useState<EdgeVizState>(IDLE_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setClientState(isReward ? REWARD_CLIENT : OBSERVE_CLIENT);
		setApiState(isReward ? REWARD_API : OBSERVE_API);
		setReqState(IDLE_EDGE);
		setResState(IDLE_EDGE);
	}, [isReward]);

	useEffect(() => {
		resetViz();
	}, [resetViz]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.client) {
			setClientState((prev) => ({ ...prev, ...frame.client }));
		}
		if (frame.api) setApiState((prev) => ({ ...prev, ...frame.api }));
		if (frame.req) setReqState((prev) => ({ ...prev, ...frame.req }));
		if (frame.res) setResState((prev) => ({ ...prev, ...frame.res }));
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
							setReqState((prev) => ({ ...prev, active: false }));
							setResState((prev) => ({ ...prev, active: false }));
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

	// ── Observe phase: stage click ──
	const handleStageClick = useCallback(
		(stageId: string) => {
			if (phase !== 'observe') return;
			const data = STAGE_INSPECTOR_MAP[stageId];
			if (!data) return;
			setInspectorData(data);
			setInspectedStages((prev) => {
				if (prev.has(stageId)) return prev;
				const next = new Set(prev);
				next.add(stageId);
				return next;
			});
		},
		[phase],
	);

	// ── Observe phase: probe fire ──
	const handleProbe = useCallback(
		(probeId: string) => {
			const frames = OBSERVE_PROBE_FRAMES[probeId];
			if (frames) runAnimation(frames);
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				// Unlock when the animation lands on the damage frame, so
				// "Build the Fix" never appears mid-flow.
				const endMs = ((frames?.length ?? 1) + 1) * ANIMATION_DURATION_MS;
				const t = setTimeout(() => {
					for (const d of discoveries) discoveryGating.discover(d);
				}, endMs);
				timersRef.current.push(t);
			}
		},
		[discoveryGating, runAnimation],
	);

	// ── Reward phase: scenario fire ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_PROBE_FRAMES[scenarioId];
			if (frames) runAnimation(frames);
		},
		[vizAnimating, stressTest, runAnimation],
	);

	// ── OptionCard step handler ──
	const handleOptionClick = useCallback(
		(option: StepOption) => {
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	// ── Completion ──
	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return {
			valid: true,
			message:
				'CORS is configured: the storefront origin is allowed, preflights get real answers, and every other origin stays locked out.',
		};
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];
	const shuffledOptions = useMemo(
		() =>
			currentOptionConfig
				? shuffleOptions(currentOptionConfig.options, stepper.currentStep)
				: [],
		[currentOptionConfig, stepper.currentStep],
	);

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							The storefront moved onto its own origin this morning:{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								localhost:3001
							</code>{' '}
							in development, calling the API on{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								localhost:3000
							</code>
							. Since then every page is blank. The API is up, the requests
							arrive, the responses return 200, and the browser refuses to hand
							any of it to the page.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								curl
							</code>{' '}
							shows nothing wrong, which is the clue: the enforcement lives in
							the browser, and it is waiting for the API to say which origins
							may read its responses.
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
								Steps
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
							<PipelineLegend />
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
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="CORS"
					levelNumber={41}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 flex flex-col relative min-h-0">
								<CorsPipeline
									api={apiState}
									client={clientState}
									inspectable
									inspectedStages={inspectedStages}
									onStageClick={handleStageClick}
									req={reqState}
									res={resState}
									showCorsStrip={false}
								/>
								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							<div className="px-4 pb-4">
								<ProbeTerminal
									disabled={vizAnimating}
									onProbe={handleProbe}
									probes={PROBES}
									title="CORS Probe"
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
					)}

					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={ADD_GEM_COMMANDS}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													The permission header has to ride on every API
													response, before Rails routing even runs. Install the
													piece that does that.
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
											outputLines={ADD_GEM_OUTPUT}
											stepKey={stepper.currentStep}
											title="Install the CORS Middleware"
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
														name={opt.label}
														selected={opt.correct}
														size="lg"
													/>
												) : (
													<OptionCard
														color="violet"
														key={opt.id}
														mono
														name={opt.label}
														onClick={() => handleOptionClick(opt)}
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
					)}

					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 flex flex-col min-h-0">
								<CorsPipeline
									api={apiState}
									client={clientState}
									inspectable={false}
									inspectedStages={inspectedStages}
									req={reqState}
									res={resState}
									showCorsStrip
								/>
							</div>

							<div className="px-4 pb-4">
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
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'reward'
							? STEP_DEFS.length - 1
							: stepper.isCurrentStepCompleted
								? stepper.currentStep
								: stepper.currentStep - 1,
					)}
					learningGoal="CORS is browser-side protection for browser users: cross-origin requests still reach Rails, but the browser withholds the response unless the API grants permission with an Access-Control-Allow-Origin header, and riskier requests need a preflight answered first. The fix is Rack middleware that names trusted origins and allowed methods; non-browser clients never notice any of it."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level41CORS;
