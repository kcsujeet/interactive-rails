/**
 * Level 15: CORS
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Probe the API from different origins, discover CORS is missing
 * Phase 2 (HOW - build): 3 steps (1 terminal + 2 OptionCard) configuring rack-cors
 *   Step 0: bundle add rack-cors (terminal)
 *   Step 1: Configure CORS Origins (OptionCard)
 *   Step 2: Allow HTTP Methods (OptionCard)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Protection" button
 * Phase 4 (ADVANTAGE - reward): Stress test CORS with requests from various origins
 *
 * Teaches: rack-cors gem, CORS origin configuration, allowed HTTP methods
 */

import { ArrowRight, Check, Play, Star, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
	PipelineFlow,
	PIPELINE_DOTS_CLEAN,
	PIPELINE_DOTS_MIXED,
	type PipelineConnection,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
import { ProbeTerminal, type ProbeConfig } from '@/components/levels/ProbeTerminal';
import { StageInspector, type StageInspectorData } from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useDiscoveryGating, type DiscoveryDef } from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { useStressTest, type StressScenario } from '@/hooks/useStressTest';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'activate' | 'reward';

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
		id: 'fetch-posts',
		label: 'GET /posts from React',
		command: 'fetch("http://localhost:3000/api/v1/posts") // from localhost:3001',
		responseLines: [
			{ text: 'Access to fetch at http://localhost:3000/api/v1/posts', color: 'red' },
			{ text: "from origin 'http://localhost:3001' has been blocked", color: 'red' },
			{ text: 'by CORS policy: No Access-Control-Allow-Origin header', color: 'red' },
			{ text: 'Response Status: (blocked by browser)', color: 'yellow' },
		],
	},
	{
		id: 'preflight-delete',
		label: 'DELETE /posts/1 from React',
		command: 'fetch("http://localhost:3000/api/v1/posts/1", { method: "DELETE" })',
		responseLines: [
			{ text: 'Preflight OPTIONS /api/v1/posts/1', color: 'cyan' },
			{ text: 'Response to preflight: no Access-Control-Allow-Origin', color: 'red' },
			{ text: 'DELETE request never sent (preflight rejected)', color: 'yellow' },
		],
	},
	{
		id: 'curl-bypass',
		label: 'GET /posts via curl',
		command: 'curl http://localhost:3000/api/v1/posts',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{ text: '[{"id":1,"title":"Hello World"}, ...]', color: 'green' },
			{ text: 'curl ignores CORS (no browser = no Same-Origin Policy)', color: 'muted' },
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'fetch-posts': 'browser-blocked',
	'preflight-delete': 'preflight-fails',
	'curl-bypass': 'curl-works',
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	browser: {
		stageId: 'browser',
		title: 'Browser (Same-Origin Policy)',
		description:
			'Browsers enforce the Same-Origin Policy. Requests from one origin (host + port) to another are blocked unless the server sends CORS headers allowing it.',
	},
	preflight: {
		stageId: 'preflight',
		title: 'Preflight Check (OPTIONS)',
		description:
			'For non-simple requests (DELETE, PUT, custom headers), the browser sends an OPTIONS request first. If the server does not respond with CORS headers, the actual request is never sent.',
	},
	cors: {
		stageId: 'cors',
		title: 'CORS Middleware (Missing)',
		description:
			'No rack-cors gem installed. The API sends no Access-Control-Allow-Origin headers, so the browser blocks every cross-origin response.',
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

// Maps probe IDs to pipeline node display state during observe
const PROBE_PIPELINE_MAP: Record<string, { corsSublabel: string; corsBadge: string }> = {
	'fetch-posts': { corsSublabel: 'No headers sent', corsBadge: 'BLOCKED' },
	'preflight-delete': { corsSublabel: 'OPTIONS rejected', corsBadge: 'BLOCKED' },
	'curl-bypass': { corsSublabel: '(bypassed)', corsBadge: '200' },
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
			"That installs globally, not into your project. Bundler manages project dependencies.",
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
			'GET-only blocks all mutations. Your frontend needs to create, update, and delete posts.',
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
		label: 'GET /posts',
		description: 'React frontend fetches posts',
		method: 'GET',
		path: '/api/v1/posts',
		actor: 'localhost:3001',
		expectedResult: 'allowed',
	},
	{
		id: 'frontend-post',
		label: 'POST /posts',
		description: 'React frontend creates a post',
		method: 'POST',
		path: '/api/v1/posts',
		actor: 'localhost:3001',
		expectedResult: 'allowed',
	},
	{
		id: 'frontend-delete',
		label: 'DELETE /posts/1',
		description: 'React frontend deletes a post',
		method: 'DELETE',
		path: '/api/v1/posts/1',
		actor: 'localhost:3001',
		expectedResult: 'allowed',
	},
	{
		id: 'evil-get',
		label: 'GET /posts',
		description: 'Malicious site reads posts',
		method: 'GET',
		path: '/api/v1/posts',
		actor: 'evil.example.com',
		expectedResult: 'blocked',
	},
	{
		id: 'evil-delete',
		label: 'DELETE /posts/1',
		description: 'Malicious site tries to delete',
		method: 'DELETE',
		path: '/api/v1/posts/1',
		actor: 'evil.example.com',
		expectedResult: 'blocked',
	},
	{
		id: 'unknown-post',
		label: 'POST /posts',
		description: 'Unknown origin creates a post',
		method: 'POST',
		path: '/api/v1/posts',
		actor: 'unknown.site.io',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Pipeline stage builders
// ──────────────────────────────────────────────

const OBSERVE_PIPELINE_IDS = ['browser', 'preflight', 'cors', 'api'] as const;

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'browser', to: 'preflight', dots: 'mixed' },
	{ from: 'preflight', to: 'cors', dots: 'mixed' },
	{ from: 'cors', to: 'api' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'browser', to: 'preflight', dots: 'clean' },
	{ from: 'preflight', to: 'cors', dots: 'clean' },
	{ from: 'cors', to: 'api', dots: 'clean' },
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
					<span className="text-foreground">Allowed origin (passes through)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">Blocked origin (rejected by CORS)</span>
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

export function Level15CORS({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, { minRequired: 3 });
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');

	// Observe phase state
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(new Set());
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(null);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

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
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[discoveryGating],
	);

	// ── Observe pipeline stages (reactive to probes + inspections) ──
	const observeStages: PipelineStage[] = useMemo(() => {
		const probeState = lastProbeId ? PROBE_PIPELINE_MAP[lastProbeId] : null;

		return OBSERVE_PIPELINE_IDS.map((id) => {
			const isInspected = inspectedStages.has(id);

			switch (id) {
				case 'browser':
					return {
						id: 'browser',
						label: 'Browser',
						sublabel: probeState ? 'localhost:3001' : 'React Frontend',
						variant: 'default' as const,
						inspectable: true,
						inspected: isInspected,
					};
				case 'preflight':
					return {
						id: 'preflight',
						label: 'Preflight',
						sublabel: probeState
							? lastProbeId === 'preflight-delete'
								? 'OPTIONS rejected'
								: 'checking...'
							: 'OPTIONS check',
						variant: (probeState && lastProbeId === 'preflight-delete'
							? 'danger'
							: 'default') as const,
						badge: probeState && lastProbeId === 'preflight-delete' ? 'FAIL' : undefined,
						inspectable: true,
						inspected: isInspected,
					};
				case 'cors':
					return {
						id: 'cors',
						label: 'CORS Middleware',
						sublabel: probeState
							? probeState.corsSublabel
							: '(not installed)',
						variant: (lastProbeId === 'curl-bypass' ? 'inactive' : probeState ? 'danger' : 'inactive') as const,
						badge: probeState ? probeState.corsBadge : '(missing)',
						inspectable: true,
						inspected: isInspected,
					};
				case 'api':
					return {
						id: 'api',
						label: 'Rails API',
						sublabel: probeState
							? lastProbeId === 'curl-bypass'
								? '200 OK'
								: 'unreachable'
							: 'localhost:3000',
						variant: (probeState && lastProbeId === 'curl-bypass'
							? 'active'
							: 'default') as const,
						inspectable: true,
						inspected: isInspected,
					};
				default:
					return { id, label: id, variant: 'default' as const };
			}
		});
	}, [inspectedStages, lastProbeId]);

	// ── Reward pipeline stages (reactive to stress test results) ──
	const rewardStages: PipelineStage[] = useMemo(() => {
		const lastResult = stressTest.results[stressTest.results.length - 1];
		const lastScenario = lastResult
			? STRESS_SCENARIOS.find((s) => s.id === lastResult.scenarioId)
			: null;
		const isAllowed = lastResult?.result === 'allowed';

		return [
			{
				id: 'browser',
				label: 'Browser',
				sublabel: lastScenario ? lastScenario.actor : 'Any Origin',
				variant: 'default' as const,
			},
			{
				id: 'preflight',
				label: 'Preflight',
				sublabel: lastScenario
					? isAllowed
						? 'OPTIONS 200'
						: 'OPTIONS 403'
					: 'OPTIONS check',
				variant: (lastScenario
					? isAllowed
						? 'active'
						: 'danger'
					: 'active') as const,
			},
			{
				id: 'cors',
				label: 'CORS Middleware',
				sublabel: lastScenario
					? isAllowed
						? `Allow-Origin: ${lastScenario.actor}`
						: 'Origin rejected'
					: 'rack-cors active',
				variant: (lastScenario
					? isAllowed
						? 'active'
						: 'danger'
					: 'active') as const,
				badge: lastScenario
					? isAllowed
						? undefined
						: 'BLOCKED'
					: undefined,
			},
			{
				id: 'api',
				label: 'Rails API',
				sublabel: lastScenario
					? isAllowed
						? `${lastScenario.method} ${lastScenario.path}`
						: 'not reached'
					: 'Protected',
				variant: (lastScenario
					? isAllowed
						? 'active'
						: 'default'
					: 'active') as const,
			},
		];
	}, [stressTest.results]);

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

	const handleActivateProtection = () => {
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

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
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
							curl bypasses this entirely, which is why you never noticed. You need
							the{' '}
							<span className="text-foreground font-medium">
								rack-cors
							</span>{' '}
							gem to tell the browser which origins are allowed.
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveries={discoveryGating.discoveries}
								discoveredCount={discoveryGating.discoveredCount}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build / activate phases: step progress */}
					{(phase === 'build' || phase === 'activate') && (
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
										<div className="text-xs text-success/70">
											Allowed
										</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">
											Blocked
										</div>
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
					levelNumber={15}
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
							<div className="flex-1 relative">
								<PipelineFlow
									connections={OBSERVE_CONNECTIONS}
									onNodeClick={handleStageClick}
									stages={observeStages}
								/>
								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							<div className="px-4 pb-2">
								<ProbeTerminal
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
										Explore the pipeline and fire probes to understand the problem.
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
													CORS must be handled at the Rack
													middleware level. Install the gem
													that provides CORS headers for your
													API.
												</p>
											}
											hasNext={hasNextStep}
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() =>
												stepper.completeStep()
											}
											onNext={stepper.nextStep}
											onWrong={(fb) =>
												stepper.recordWrongAttempt(fb)
											}
											outputLines={addGemOutput}
											stepKey={stepper.currentStep}
											title="Add the rack-cors Gem"
										/>
									)}

								{/* OptionCard steps (1: origins, 2: methods) */}
								{currentStepType === 'option' &&
									currentOptionConfig && (
										<>
											<h3 className="text-lg font-semibold text-foreground">
												{currentOptionConfig.title}
											</h3>
											<p className="text-sm text-muted-foreground">
												{currentOptionConfig.description}
											</p>

											{isViewingCompletedStep ? (
												<div className="space-y-2">
													{currentOptionConfig.options.map(
														(opt) => (
															<OptionCard
																color="violet"
																disabled={
																	!opt.correct
																}
																key={opt.id}
																mono
																name={opt.label}
																selected={
																	opt.correct
																}
																size="lg"
															/>
														),
													)}
												</div>
											) : (
												<>
													<div className="space-y-2">
														{currentOptionConfig.options.map(
															(opt) => (
																<OptionCard
																	color="violet"
																	key={opt.id}
																	mono
																	name={
																		opt.label
																	}
																	onClick={() =>
																		handleOptionClick(
																			opt,
																		)
																	}
																	size="lg"
																/>
															),
														)}
													</div>

													<ErrorFeedback
														message={
															stepper.lastFeedback
														}
														onDismiss={
															stepper.clearFeedback
														}
													/>
												</>
											)}

											{isViewingCompletedStep &&
												hasNextStep && (
													<div className="flex justify-end">
														<Button
															className="gap-2"
															onClick={
																stepper.nextStep
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

					{/* ── Phase 3: Activate (ADVANTAGE sub-phase a) ── */}
					{phase === 'activate' && (
						<div className="flex-1 flex items-center justify-center p-6">
							<div className="max-w-md text-center space-y-6">
								<div className="flex justify-center gap-1">
									{[1, 2, 3].map((s) => (
										<Star
											className={`w-8 h-8 ${
												s <= stepper.starRating
													? 'text-yellow-400 fill-yellow-400'
													: 'text-muted-foreground/30'
											}`}
											key={s}
										/>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									CORS is configured. Watch the shield block
									requests from unauthorized origins.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateProtection}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Protection
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward (ADVANTAGE sub-phase b) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									connections={REWARD_CONNECTIONS}
									stages={rewardStages}
								/>
							</div>

							<div className="px-4 pb-4">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									isAutoFiring={stressTest.isAutoFiring}
									onFire={(id) => stressTest.fireRequest(id)}
									onToggleAutoFire={() => stressTest.toggleAutoFire()}
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
					files={getCodeFiles(phase, stepper.furthestStep)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level15CORS;
