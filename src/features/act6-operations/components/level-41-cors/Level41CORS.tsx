/**
 * Level 41: CORS
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Probe the API from different origins, discover CORS is missing
 * Phase 2 (HOW - build): 3 steps (1 terminal + 2 OptionCard) configuring rack-cors
 *   Step 0: bundle add rack-cors (terminal)
 *   Step 1: Configure CORS Origins (OptionCard)
 *   Step 2: Allow HTTP Methods (OptionCard)
 * Phase 3 (ADVANTAGE - reward): Stress test CORS with requests from various origins
 *
 * Visualization: 3-zone horizontal flow
 *   [Browser/Client] --FC1--> [CORS Middleware Gate] --FC2--> [Rails API]
 *
 * Teaches: rack-cors gem, CORS origin configuration, allowed HTTP methods
 */

import {
	ArrowRight,
	Check,
	Globe,
	Server,
	Shield,
	Terminal,
	X,
} from 'lucide-react';
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
import { FlowConnector } from '@/components/levels/FlowConnector';
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
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act6-level41-cors', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'browser-blocked', label: 'Browser blocks frontend requests' },
	{ id: 'preflight-fails', label: 'Preflight OPTIONS request fails' },
	{ id: 'curl-works', label: 'curl bypasses CORS entirely' },
	{ id: 'no-middleware', label: 'No CORS middleware installed' },
];

// ──────────────────────────────────────────────
// Probe definitions (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'fetch-products',
		label: 'GET /products from React',
		command:
			'fetch("http://localhost:3000/api/v1/products") // from localhost:3001',
		responseLines: [
			{
				text: 'Access to fetch at http://localhost:3000/api/v1/products',
				color: 'red',
			},
			{
				text: "from origin 'http://localhost:3001' has been blocked",
				color: 'red',
			},
			{
				text: 'by CORS policy: No Access-Control-Allow-Origin header',
				color: 'red',
			},
			{ text: 'Response Status: (blocked by browser)', color: 'yellow' },
		],
		story: [
			'The React frontend on localhost:3001 fetches products from the Rails API on localhost:3000.',
			'The browser checks the response for an Access-Control-Allow-Origin header.',
			'No CORS headers are present in the Rails response.',
			'The browser blocks the response entirely. The storefront shows no products.',
		],
	},
	{
		id: 'preflight-delete',
		label: 'DELETE /products/1 from React',
		command:
			'fetch("http://localhost:3000/api/v1/products/1", { method: "DELETE" })',
		responseLines: [
			{ text: 'Preflight OPTIONS /api/v1/products/1', color: 'cyan' },
			{
				text: 'Response to preflight: no Access-Control-Allow-Origin',
				color: 'red',
			},
			{
				text: 'DELETE request never sent (preflight rejected)',
				color: 'yellow',
			},
		],
		story: [
			'An admin clicks "Delete" in the React dashboard, triggering a DELETE request.',
			'The browser sends a preflight OPTIONS request first (DELETE is not a "simple" method).',
			'The Rails API responds to OPTIONS with no CORS headers.',
			'The browser rejects the preflight and never sends the actual DELETE request.',
		],
	},
	{
		id: 'curl-bypass',
		label: 'GET /products via curl',
		command: 'curl http://localhost:3000/api/v1/products',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{ text: '[{"id":1,"name":"Hello World"}, ...]', color: 'green' },
			{
				text: 'curl ignores CORS (no browser = no Same-Origin Policy)',
				color: 'muted',
			},
		],
		story: [
			'A developer tests the same endpoint using curl from the terminal.',
			'curl is not a browser and does not enforce the Same-Origin Policy.',
			'The API returns 200 OK with the full product list.',
			'This proves the API works fine; the block is a browser-only security feature.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'fetch-products': 'browser-blocked',
	'preflight-delete': 'preflight-fails',
	'curl-bypass': 'curl-works',
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase) - 3 zones
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	browser: {
		stageId: 'browser',
		title: 'Browser (Same-Origin Policy)',
		description:
			'Browsers enforce the Same-Origin Policy. Requests from one origin (host + port) to another are blocked unless the server sends CORS headers allowing it. For non-simple requests (DELETE, PUT, custom headers), the browser sends an OPTIONS preflight request first. If the server does not respond with CORS headers, the actual request is never sent.',
	},
	cors: {
		stageId: 'cors',
		title: 'CORS Middleware (Missing)',
		description:
			'No rack-cors gem installed. The API sends no Access-Control-Allow-Origin headers, so the browser blocks every cross-origin response. This Rack middleware needs to be the first thing requests hit.',
		code: `# config/initializers/cors.rb
# FILE DOES NOT EXIST
# No CORS middleware in the Rack stack`,
	},
	api: {
		stageId: 'api',
		title: 'Rails API',
		description:
			'The API processes requests normally. curl works fine because it does not enforce CORS. The problem is the missing CORS headers in the response, not the request handling.',
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	cors: 'no-middleware',
};

// Maps probe IDs to CORS gate display state during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ gateSublabel: string; gateBadge: string }
> = {
	'fetch-products': { gateSublabel: 'No headers sent', gateBadge: 'BLOCKED' },
	'preflight-delete': {
		gateSublabel: 'OPTIONS rejected',
		gateBadge: 'BLOCKED',
	},
	'curl-bypass': { gateSublabel: '(bypassed)', gateBadge: '200' },
};

// ──────────────────────────────────────────────
// Flow animation messages (per probe / scenario)
// 3 messages per flow = 3 zones (Client, CORS Gate, API)
// ──────────────────────────────────────────────

const OBSERVE_FLOW: Record<string, string[]> = {
	'fetch-products': [
		'fetch() from localhost:3001',
		'No CORS headers, browser blocks response',
		'Response blocked before reaching app',
	],
	'preflight-delete': [
		'OPTIONS preflight from localhost:3001',
		'OPTIONS rejected, no CORS config',
		'DELETE never sent',
	],
	'curl-bypass': [
		'curl from terminal (no browser)',
		'(bypassed, no browser enforcement)',
		'200 OK, data returned',
	],
};

const REWARD_FLOW: Record<string, string[]> = {
	'frontend-get': [
		'GET from localhost:3001',
		'rack-cors: origin allowed',
		'200 OK',
	],
	'frontend-post': [
		'POST from localhost:3001',
		'Preflight passes, origin allowed',
		'201 Created',
	],
	'frontend-delete': [
		'DELETE from localhost:3001',
		'Preflight passes, origin allowed',
		'200 OK',
	],
	'evil-get': [
		'GET from evil.example.com',
		'rack-cors: origin rejected',
		'BLOCKED',
	],
	'evil-delete': [
		'DELETE from evil.example.com',
		'Preflight fails, origin rejected',
		'BLOCKED',
	],
	'unknown-post': [
		'POST from unknown.site.io',
		'rack-cors: origin rejected',
		'BLOCKED',
	],
};

// ──────────────────────────────────────────────
// Step definitions (3 steps: 1 terminal + 2 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-gem', title: 'Add the rack-cors Gem' },
	{ id: 'configure-origins', title: 'Configure CORS Origins' },
	{ id: 'allow-methods', title: 'Allow HTTP Methods' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add rack-cors
	'option', // 1: configure origins
	'option', // 2: allow methods
];

// ──────────────────────────────────────────────
// Step 0: Add rack-cors Gem (Terminal)
// ──────────────────────────────────────────────

const addGemCommands: TerminalCommand[] = [
	{
		id: 'wrong-npm',
		label: 'npm install cors',
		command: 'npm install cors',
		correct: false,
		feedback:
			'cors is a Node.js package. This is a Rails API, so you need the Ruby equivalent.',
	},
	{
		id: 'wrong-gem-install',
		label: 'gem install rack-cors',
		command: 'gem install rack-cors',
		correct: false,
		feedback:
			'That installs globally, not into your project. Bundler manages project dependencies.',
	},
	{
		id: 'correct',
		label: 'bundle add rack-cors',
		command: 'bundle add rack-cors',
		correct: true,
	},
];

const addGemOutput: TerminalOutputLine[] = [
	{ text: 'Fetching rack-cors 2.0.2', color: 'cyan' },
	{ text: 'Installing rack-cors 2.0.2', color: 'muted' },
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

// Step 1: Configure CORS Origins
const CORS_ORIGIN_OPTIONS: StepOption[] = [
	{
		id: 'wildcard',
		label: 'origins "*"',
		correct: false,
		feedback:
			'Wildcard origins allow ANY website to call your API. That defeats the purpose of CORS entirely.',
	},
	{
		id: 'specific',
		label: 'origins "https://yourdomain.com", "http://localhost:3001"',
		correct: true,
	},
	{
		id: 'disabled',
		label: 'origins false',
		correct: false,
		feedback:
			'Disabling origins blocks all cross-origin requests. Your React frontend needs to reach the API.',
	},
];

// Step 2: Allow HTTP Methods
const HTTP_METHODS_OPTIONS: StepOption[] = [
	{
		id: 'get-only',
		label: 'methods: [:get]',
		correct: false,
		feedback:
			'GET-only blocks all mutations. Your frontend needs to create, update, and delete products.',
	},
	{
		id: 'any',
		label: 'methods: :any',
		correct: false,
		feedback:
			'Allowing all HTTP methods is overly permissive. Whitelist only what your API actually uses.',
	},
	{
		id: 'full-set',
		label: 'methods: [:get, :post, :put, :patch, :delete, :options]',
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addGemCommands, outputLines: addGemOutput },
	null, // step 1: OptionCard (configure origins)
	null, // step 2: OptionCard (allow methods)
];

// ──────────────────────────────────────────────
// OptionCard step configs
// ──────────────────────────────────────────────

const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	1: {
		title: 'Configure CORS Origins',
		description:
			'The rack-cors gem is installed. Now configure which origins can call your API. The React frontend runs on a different port during development.',
		options: CORS_ORIGIN_OPTIONS,
	},
	2: {
		title: 'Allow HTTP Methods',
		description:
			'Origins are set. Now specify which HTTP methods the frontend is allowed to use when calling your API.',
		options: HTTP_METHODS_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'frontend-get',
		label: 'GET /products (from localhost)',
		description: 'React frontend fetches products',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'localhost:3001',
		expectedResult: 'allowed',
	},
	{
		id: 'frontend-post',
		label: 'POST /products (from localhost)',
		description: 'React frontend creates a product',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'localhost:3001',
		expectedResult: 'allowed',
	},
	{
		id: 'frontend-delete',
		label: 'DELETE /products/1 (from localhost)',
		description: 'React frontend deletes a product',
		method: 'DELETE',
		path: '/api/v1/products/1',
		actor: 'localhost:3001',
		expectedResult: 'allowed',
	},
	{
		id: 'evil-get',
		label: 'GET /products (from evil.com)',
		description: 'Malicious site reads products',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'evil.example.com',
		expectedResult: 'blocked',
	},
	{
		id: 'evil-delete',
		label: 'DELETE /products/1 (from evil.com)',
		description: 'Malicious site tries to delete',
		method: 'DELETE',
		path: '/api/v1/products/1',
		actor: 'evil.example.com',
		expectedResult: 'blocked',
	},
	{
		id: 'unknown-post',
		label: 'POST /products (from unknown)',
		description: 'Unknown origin creates a product',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'unknown.site.io',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Pipeline Legend
// ──────────────────────────────────────────────

function PipelineLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">
						Allowed origin (passes through)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Blocked origin (rejected by CORS)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: no cors.rb, browser CORS error
	if (phase === 'observe' || (phase === 'build' && furthestStep === 0)) {
		files.push({
			filename: 'config/initializers/cors.rb',
			language: 'ruby',
			code: `# CORS NOT CONFIGURED
# curl works fine (bypasses browser security)
# But the React frontend gets:
# "Access to XMLHttpRequest has been blocked by CORS policy"`,
			highlight: [],
		});
		return files;
	}

	// After step 0: Gemfile with rack-cors added
	if (furthestStep >= 1) {
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
	}

	// After step 1: cors.rb with specific origins
	if (furthestStep >= 2) {
		files.push({
			filename: 'config/initializers/cors.rb',
			language: 'ruby',
			code:
				furthestStep >= 3
					? `Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "https://yourdomain.com", "http://localhost:3001"
    resource "/api/*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options],
      expose: ["Authorization"],
      max_age: 600
  end
end`
					: `Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "https://yourdomain.com", "http://localhost:3001"
    resource "/api/*",
      headers: :any,
      methods: [...]  # Which HTTP methods to allow?
  end
end`,
			highlight: furthestStep >= 3 ? [3, 6] : [3],
		});
	}

	return files;
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

	// Observe phase state
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);

	// ── Flow animation state ──
	const [flowPhase, setFlowPhase] = useState(-1);
	const [flowMessages, setFlowMessages] = useState<string[]>([]);
	const flowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearFlow = useCallback(() => {
		for (const t of flowTimeoutsRef.current) clearTimeout(t);
		flowTimeoutsRef.current = [];
	}, []);

	const runFlow = useCallback(
		(messages: string[]) => {
			clearFlow();
			setFlowMessages(messages);
			const totalPhases = messages.length * 2 - 1;
			const delay = 1500;

			setFlowPhase(0);

			for (let p = 1; p <= totalPhases; p++) {
				const t = setTimeout(() => {
					setFlowPhase(p);
				}, delay * p);
				flowTimeoutsRef.current.push(t);
			}

			const endT = setTimeout(
				() => {
					setFlowPhase(-1);
				},
				delay * (totalPhases + 1),
			);
			flowTimeoutsRef.current.push(endT);
		},
		[clearFlow],
	);

	useEffect(() => {
		return () => clearFlow();
	}, [clearFlow]);

	// ── Observe phase: handle stage click ──
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

			// Trigger discovery if mapped
			const discoveryId = STAGE_DISCOVERY_MAP[stageId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, discoveryGating],
	);

	// ── Observe phase: handle probe fire ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			const messages = OBSERVE_FLOW[probeId];
			if (messages) runFlow(messages);
			// Mark all zones as inspected immediately (removes ? indicators)
			setInspectedStages(new Set(['browser', 'cors', 'api']));

			// Defer discovery until animation ends so "Build the Fix" doesn't appear mid-flow
			// Animation ends at delay * (totalPhases + 1) where totalPhases = messages.length * 2 - 1
			const totalPhases = (messages?.length ?? 3) * 2 - 1;
			const delay = 1500;
			const endMs = delay * (totalPhases + 1);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				const t = setTimeout(() => {
					discoveryGating.discover(discoveryId);
				}, endMs);
				flowTimeoutsRef.current.push(t);
			}
		},
		[discoveryGating, runFlow],
	);

	// ── Probe display state (gated behind flow reaching each zone) ──
	const probeState = lastProbeId ? PROBE_PIPELINE_MAP[lastProbeId] : null;
	const isCurlProbe = lastProbeId === 'curl-bypass';
	// Zone 1 (CORS gate) shows result only after flow reaches it (phase 2) or animation is done (-1)
	const gateRevealed = probeState && (flowPhase >= 2 || flowPhase === -1);
	// Zone 2 (API) shows result only after flow reaches it (phase 4) or animation is done (-1)
	const apiRevealed = probeState && (flowPhase >= 4 || flowPhase === -1);

	// ── Latest stress test result (for reward visualization) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const lastScenario = lastResult
		? STRESS_SCENARIOS.find((s) => s.id === lastResult.scenarioId)
		: null;
	const isAllowed = lastResult?.result === 'allowed';

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

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleStartReward = () => {
		stressTest.reset();
		setPhase('reward');
	};

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
		return { valid: true, message: 'CORS is configured!' };
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
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your API is secured and tested. Until now, you have been using{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								curl
							</code>{' '}
							to send requests directly. But a React frontend on{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								localhost:3001
							</code>{' '}
							needs to call the API on{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								localhost:3000
							</code>
							. Browsers block cross-origin requests by default.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							curl bypasses this entirely, which is why you never noticed. You
							need the{' '}
							<span className="text-foreground font-medium">rack-cors</span> gem
							to tell the browser which origins are allowed.
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build phase: step progress */}
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

					{/* Reward phase: legend + dual counters */}
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
					actNumber={2}
					levelName="CORS"
					levelNumber={41}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col">
							{/* 3-Zone Horizontal Flow: Client -> CORS Gate -> API */}
							<div className="flex-1 flex items-center gap-0 px-4 py-4 relative">
								{/* Zone 0: Client (Browser / curl) */}
								<button
									className={`flex-1 flex flex-col border rounded-lg bg-card overflow-hidden cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-ring/30 self-stretch ${
										flowPhase === 0
											? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
											: !inspectedStages.has('browser')
												? 'ring-1 ring-primary/20'
												: ''
									}`}
									onClick={() => handleStageClick('browser')}
									type="button"
								>
									{/* Header: browser chrome or terminal style */}
									{isCurlProbe ? (
										<div className="flex items-center gap-1.5 px-3 py-2 border-b bg-card">
											<Terminal className="w-3 h-3 text-zinc-400" />
											<div className="text-xs text-zinc-400 ml-auto font-mono">
												$ curl
											</div>
										</div>
									) : (
										<div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/50">
											<div className="flex gap-1">
												<div className="w-2 h-2 rounded-full bg-red-400/70 dark:bg-red-400/50" />
												<div className="w-2 h-2 rounded-full bg-yellow-400/70 dark:bg-yellow-400/50" />
												<div className="w-2 h-2 rounded-full bg-green-400/70 dark:bg-green-400/50" />
											</div>
											<div className="text-xs text-muted-foreground ml-auto font-mono">
												localhost:3001
											</div>
										</div>
									)}
									<div className="flex-1 p-3 space-y-2">
										<div className="flex items-center gap-1.5">
											{isCurlProbe ? (
												<Terminal className="w-3.5 h-3.5 text-muted-foreground" />
											) : (
												<Globe className="w-3.5 h-3.5 text-muted-foreground" />
											)}
											<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
												{isCurlProbe ? 'Terminal' : 'Browser'}
											</span>
											{!inspectedStages.has('browser') && flowPhase !== 0 && (
												<span className="text-primary text-sm animate-pulse font-bold ml-auto">
													?
												</span>
											)}
										</div>
										<pre className="text-xs font-mono text-foreground/70 leading-relaxed whitespace-pre-wrap">
											{isCurlProbe
												? 'curl http://localhost:3000\n  /api/v1/products'
												: `fetch("http://localhost:3000
  /api/v1/products")`}
										</pre>
										{flowMessages[0] &&
											(flowPhase >= 0 || flowPhase === -1) && (
												<div
													className={`text-xs text-primary font-medium ${flowPhase === 0 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
												>
													{flowMessages[0]}
												</div>
											)}
									</div>
								</button>

								{/* FC1: Client -> CORS Gate */}
								<div className="w-16 shrink-0 flex items-center justify-center">
									<FlowConnector
										active={flowPhase === 1}
										className="relative h-4 w-full"
										direction="horizontal"
										dotColor={
											isCurlProbe
												? 'bg-success'
												: lastProbeId
													? 'bg-destructive'
													: 'bg-primary'
										}
									/>
								</div>

								{/* Zone 1: CORS Middleware Gate */}
								<button
									className={`flex-1 flex flex-col items-center justify-center border-2 rounded-lg p-4 cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-ring/30 self-stretch ${
										flowPhase === 2
											? isCurlProbe
												? 'ring-2 ring-muted-foreground/30 shadow-lg border-dashed border-muted-foreground/30 bg-muted/20 dark:bg-muted/10'
												: 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
											: gateRevealed
												? isCurlProbe
													? 'border-dashed border-muted-foreground/30 bg-muted/20 dark:bg-muted/10'
													: 'border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
												: 'border-dashed border-muted-foreground/30 bg-muted/20 dark:bg-muted/10'
									} ${
										flowPhase !== 2 && !inspectedStages.has('cors')
											? 'ring-1 ring-primary/20'
											: ''
									}`}
									onClick={() => handleStageClick('cors')}
									type="button"
								>
									<div className="flex items-center justify-center gap-1.5">
										<Shield
											className={`w-4 h-4 ${
												gateRevealed && !isCurlProbe
													? 'text-destructive'
													: 'text-muted-foreground/50'
											}`}
										/>
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											CORS Middleware
										</span>
									</div>
									<div
										className={`text-xs font-mono mt-1.5 ${
											gateRevealed && !isCurlProbe
												? 'text-destructive'
												: 'text-muted-foreground/50'
										}`}
									>
										{gateRevealed ? probeState.gateSublabel : '(not installed)'}
									</div>
									{gateRevealed && !isCurlProbe && (
										<div className="text-xs font-bold text-destructive mt-0.5">
											{probeState.gateBadge}
										</div>
									)}
									{flowMessages[1] && (flowPhase >= 2 || flowPhase === -1) && (
										<div
											className={`text-xs font-medium mt-1.5 ${flowPhase === 2 ? 'animate-in fade-in duration-300' : 'opacity-70'} ${
												isCurlProbe
													? 'text-muted-foreground'
													: 'text-destructive'
											}`}
										>
											{flowMessages[1]}
										</div>
									)}
									{!inspectedStages.has('cors') && flowPhase !== 2 && (
										<div className="text-primary text-sm animate-pulse font-bold mt-1">
											?
										</div>
									)}
								</button>

								{/* FC2: CORS Gate -> API */}
								<div className="w-16 shrink-0 flex items-center justify-center">
									<FlowConnector
										active={flowPhase === 3}
										className="relative h-4 w-full"
										direction="horizontal"
										dotColor={
											isCurlProbe
												? 'bg-success'
												: lastProbeId
													? 'bg-destructive'
													: 'bg-primary'
										}
									/>
								</div>

								{/* Zone 2: Rails API */}
								<button
									className={`flex-1 flex flex-col items-center justify-center border rounded-lg p-4 cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-ring/30 self-stretch ${
										flowPhase === 4
											? isCurlProbe
												? 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success/50 bg-success/5 dark:bg-success/10'
												: 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-border bg-card opacity-50'
											: apiRevealed
												? isCurlProbe
													? 'border-success/50 bg-success/5 dark:bg-success/10'
													: 'border-border bg-card opacity-50'
												: 'border-border bg-card'
									} ${
										flowPhase !== 4 && !inspectedStages.has('api')
											? 'ring-1 ring-primary/20'
											: ''
									}`}
									onClick={() => handleStageClick('api')}
									type="button"
								>
									<div className="flex items-center justify-center gap-1.5">
										<Server
											className={`w-4 h-4 ${
												isCurlProbe && apiRevealed
													? 'text-success'
													: 'text-muted-foreground'
											}`}
										/>
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											Rails API
										</span>
									</div>
									<div
										className={`text-xs font-mono mt-1.5 ${
											isCurlProbe && apiRevealed
												? 'text-success font-bold'
												: apiRevealed && !isCurlProbe
													? 'text-destructive'
													: 'text-muted-foreground'
										}`}
									>
										{apiRevealed
											? isCurlProbe
												? '200 OK'
												: 'not reached'
											: 'localhost:3000'}
									</div>
									{flowMessages[2] && (flowPhase >= 4 || flowPhase === -1) && (
										<div
											className={`text-xs font-medium mt-1.5 ${flowPhase === 4 ? 'animate-in fade-in duration-300' : 'opacity-70'} ${
												isCurlProbe ? 'text-success' : 'text-destructive'
											}`}
										>
											{flowMessages[2]}
										</div>
									)}
									{!inspectedStages.has('api') && flowPhase !== 4 && (
										<div className="text-primary text-sm animate-pulse font-bold mt-1">
											?
										</div>
									)}
								</button>

								{/* Stage Inspector overlay */}
								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							<div className="px-4 pb-2">
								<ProbeTerminal
									disabled={flowPhase !== -1}
									onProbe={handleProbe}
									probes={PROBES}
									title="CORS Probe"
								/>
							</div>

							<div className="p-4 flex justify-center">
								{discoveryGating.isUnlocked ? (
									<Button
										className="gap-2 animate-in fade-in duration-500"
										onClick={handleStartBuild}
										size="lg"
									>
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								) : (
									<p className="text-xs text-muted-foreground">
										Explore the zones and fire probes to understand the problem.
									</p>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Terminal step (0: gem install) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={addGemCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													CORS must be handled at the Rack middleware level.
													Install the gem that provides CORS headers for your
													API.
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
											outputLines={addGemOutput}
											stepKey={stepper.currentStep}
											title="Add the rack-cors Gem"
										/>
									)}

								{/* OptionCard steps (1: origins, 2: methods) */}
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
												{shuffledOptions.map((opt) => (
													<OptionCard
														color="violet"
														disabled={!opt.correct}
														key={opt.id}
														mono
														name={opt.label}
														selected={opt.correct}
														size="lg"
													/>
												))}
											</div>
										) : (
											<>
												<div className="space-y-2">
													{shuffledOptions.map((opt) => (
														<OptionCard
															color="violet"
															key={opt.id}
															mono
															name={opt.label}
															onClick={() => handleOptionClick(opt)}
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

										{isViewingCompletedStep && hasNextStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={stepper.nextStep}
													size="sm"
												>
													Next Step
													<ArrowRight className="w-4 h-4" />
												</Button>
											</div>
										)}

										{isViewingCompletedStep && !hasNextStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={handleStartReward}
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

					{/* ── Phase 3: Reward (ADVANTAGE) - 3-Zone with active CORS ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							{/* 3-Zone Horizontal Flow: Client -> CORS Gate -> API */}
							<div className="flex-1 flex items-center gap-0 px-4 py-4">
								{/* Zone 0: Client */}
								<div
									className={`flex-1 flex flex-col border rounded-lg bg-card overflow-hidden transition-all duration-300 self-stretch ${
										flowPhase === 0
											? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
											: ''
									}`}
								>
									{/* Browser chrome header */}
									<div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/50">
										<div className="flex gap-1">
											<div className="w-2 h-2 rounded-full bg-red-400/70 dark:bg-red-400/50" />
											<div className="w-2 h-2 rounded-full bg-yellow-400/70 dark:bg-yellow-400/50" />
											<div className="w-2 h-2 rounded-full bg-green-400/70 dark:bg-green-400/50" />
										</div>
										<div className="text-xs text-muted-foreground ml-auto font-mono">
											{lastScenario ? lastScenario.actor : 'Any Origin'}
										</div>
									</div>
									<div className="flex-1 p-3 flex flex-col items-center justify-center gap-2">
										<Globe
											className={`w-6 h-6 ${
												lastScenario
													? isAllowed
														? 'text-success'
														: 'text-destructive'
													: 'text-muted-foreground'
											}`}
										/>
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											Browser
										</div>
										{lastScenario && (
											<div className="text-xs font-mono text-muted-foreground">
												{lastScenario.method} {lastScenario.path}
											</div>
										)}
										{flowMessages[0] &&
											(flowPhase >= 0 || flowPhase === -1) && (
												<div
													className={`text-xs text-primary font-medium ${flowPhase === 0 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
												>
													{flowMessages[0]}
												</div>
											)}
									</div>
								</div>

								{/* FC1: Client -> CORS Gate */}
								<div className="w-16 shrink-0 flex items-center justify-center">
									<FlowConnector
										active={flowPhase === 1}
										className="relative h-4 w-full"
										direction="horizontal"
										dotColor={
											isAllowed
												? 'bg-success'
												: lastResult
													? 'bg-destructive'
													: 'bg-primary'
										}
									/>
								</div>

								{/* Zone 1: CORS Middleware Gate (active) */}
								<div
									className={`flex-1 flex flex-col items-center justify-center border-2 rounded-lg p-4 transition-all duration-300 self-stretch ${
										flowPhase === 2
											? isAllowed
												? 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success bg-success/10 dark:bg-success/15'
												: 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive bg-destructive/5 dark:bg-destructive/10'
											: lastResult
												? isAllowed
													? 'border-success bg-success/10 dark:bg-success/15'
													: 'border-destructive bg-destructive/5 dark:bg-destructive/10'
												: 'border-success/50 bg-success/5 dark:bg-success/10'
									}`}
								>
									<div className="flex items-center justify-center gap-1.5">
										<Shield
											className={`w-4 h-4 ${
												lastResult
													? isAllowed
														? 'text-success'
														: 'text-destructive'
													: 'text-success'
											}`}
										/>
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											rack-cors
										</span>
									</div>
									<div
										className={`text-xs font-mono mt-1.5 ${
											lastResult
												? isAllowed
													? 'text-success'
													: 'text-destructive font-bold'
												: 'text-success/70'
										}`}
									>
										{lastResult
											? isAllowed
												? `Allow: ${lastScenario?.actor}`
												: 'Origin rejected'
											: 'Active'}
									</div>
									{lastResult && !isAllowed && (
										<div className="text-xs font-bold text-destructive mt-0.5">
											BLOCKED
										</div>
									)}
									{flowMessages[1] && (flowPhase >= 2 || flowPhase === -1) && (
										<div
											className={`text-xs font-medium mt-1.5 ${flowPhase === 2 ? 'animate-in fade-in duration-300' : 'opacity-70'} ${
												isAllowed ? 'text-success' : 'text-destructive'
											}`}
										>
											{flowMessages[1]}
										</div>
									)}
								</div>

								{/* FC2: CORS Gate -> API */}
								<div className="w-16 shrink-0 flex items-center justify-center">
									<FlowConnector
										active={flowPhase === 3}
										className="relative h-4 w-full"
										direction="horizontal"
										dotColor={
											isAllowed
												? 'bg-success'
												: lastResult
													? 'bg-destructive'
													: 'bg-primary'
										}
									/>
								</div>

								{/* Zone 2: Rails API */}
								<div
									className={`flex-1 flex flex-col items-center justify-center border rounded-lg p-4 transition-all duration-300 self-stretch ${
										flowPhase === 4
											? isAllowed
												? 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success/50 bg-success/5 dark:bg-success/10'
												: 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-border bg-card opacity-50'
											: lastResult
												? isAllowed
													? 'border-success/50 bg-success/5 dark:bg-success/10'
													: 'border-border bg-card opacity-50'
												: 'border-success/30 bg-card'
									}`}
								>
									<div className="flex items-center justify-center gap-1.5">
										<Server
											className={`w-4 h-4 ${
												lastResult && isAllowed
													? 'text-success'
													: 'text-muted-foreground'
											}`}
										/>
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											Rails API
										</span>
									</div>
									<div
										className={`text-xs font-mono mt-1.5 ${
											lastResult
												? isAllowed
													? 'text-success font-bold'
													: 'text-destructive'
												: 'text-muted-foreground'
										}`}
									>
										{lastResult
											? isAllowed
												? `${lastScenario?.method} ${lastScenario?.path}`
												: 'not reached'
											: 'Protected'}
									</div>
									{flowMessages[2] && (flowPhase >= 4 || flowPhase === -1) && (
										<div
											className={`text-xs font-medium mt-1.5 ${flowPhase === 4 ? 'animate-in fade-in duration-300' : 'opacity-70'} ${
												isAllowed ? 'text-success' : 'text-destructive'
											}`}
										>
											{flowMessages[2]}
										</div>
									)}
								</div>
							</div>

							<div className="px-4 pb-4">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={flowPhase !== -1}
									isAutoFiring={stressTest.isAutoFiring}
									onFire={(id) => {
										stressTest.fireRequest(id);
										const messages = REWARD_FLOW[id];
										if (messages) runFlow(messages);
									}}
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
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level41CORS;
