/**
 * Level 16: CORS
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Watch all requests (legitimate and malicious) reach API unblocked
 * Phase 2 (HOW - build): 3 steps (1 terminal + 2 OptionCard) configuring rack-cors
 *   Step 0: bundle add rack-cors (terminal)
 *   Step 1: Configure CORS Origins (OptionCard)
 *   Step 2: Allow HTTP Methods (OptionCard)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Protection" button
 * Phase 4 (ADVANTAGE - reward): CORS shield blocks malicious requests
 *
 * Teaches: rack-cors gem, CORS origin configuration, allowed HTTP methods
 */

import { ArrowRight, Play, Star } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'activate' | 'reward';

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
			"That installs globally, not into your project. Bundler manages project dependencies.",
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
		id: 'disabled',
		label: 'origins false',
		correct: false,
		feedback:
			'Disabling origins blocks all cross-origin requests. Your React frontend needs to reach the API.',
	},
	{
		id: 'specific',
		label: 'origins "https://yourdomain.com", "http://localhost:3001"',
		correct: true,
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
		id: 'full-set',
		label: 'methods: [:get, :post, :put, :patch, :delete, :options]',
		correct: true,
	},
	{
		id: 'any',
		label: 'methods: :any',
		correct: false,
		feedback:
			'Allowing all HTTP methods is overly permissive. Whitelist only what your API actually uses.',
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
// CORS SVG Visualization
// ──────────────────────────────────────────────

function CORSVisualization({
	mode,
}: {
	mode: 'vulnerable' | 'protected';
}) {
	const isProtected = mode === 'protected';

	return (
		<svg
			className="w-full h-full"
			preserveAspectRatio="xMidYMid meet"
			viewBox="0 0 600 400"
		>
			{/* Background grid */}
			<defs>
				<pattern
					height="30"
					id="cors-grid"
					patternUnits="userSpaceOnUse"
					width="30"
				>
					<path
						d="M 30 0 L 0 0 0 30"
						fill="none"
						stroke="currentColor"
						strokeOpacity="0.05"
						strokeWidth="1"
					/>
				</pattern>

				{/* Motion paths */}
				<path d="M 100,160 L 260,200" id="browser-path" />
				<path d="M 100,280 L 260,240" id="malicious-path" />
				<path d="M 340,200 L 500,200" id="api-path" />
				<path d="M 300,220 L 300,330" id="block-path" />
			</defs>

			<rect fill="url(#cors-grid)" height="400" width="600" />

			{/* ── Browser box (top-left) ── */}
			<rect
				fill="none"
				height="50"
				rx="8"
				stroke="currentColor"
				strokeOpacity="0.3"
				strokeWidth="1.5"
				width="130"
				x="20"
				y="130"
			/>
			<text
				fill="currentColor"
				fontSize="12"
				fontWeight="600"
				opacity="0.8"
				textAnchor="middle"
				x="85"
				y="152"
			>
				Browser
			</text>
			<text
				fill="#10b981"
				fontSize="9"
				opacity="0.7"
				textAnchor="middle"
				x="85"
				y="168"
			>
				localhost:3001
			</text>

			{/* ── Malicious Site box (bottom-left) ── */}
			<rect
				fill="none"
				height="50"
				rx="8"
				stroke="#ef4444"
				strokeOpacity="0.4"
				strokeWidth="1.5"
				width="130"
				x="20"
				y="260"
			/>
			<text
				fill="currentColor"
				fontSize="12"
				fontWeight="600"
				opacity="0.8"
				textAnchor="middle"
				x="85"
				y="282"
			>
				Malicious Site
			</text>
			<text
				fill="#ef4444"
				fontSize="9"
				opacity="0.7"
				textAnchor="middle"
				x="85"
				y="298"
			>
				evil.example.com
			</text>

			{/* ── API box with CORS shield (center) ── */}
			<rect
				fill="none"
				height="80"
				rx="8"
				stroke="currentColor"
				strokeOpacity="0.3"
				strokeWidth="1.5"
				width="120"
				x="240"
				y="170"
			/>
			<text
				fill="currentColor"
				fontSize="14"
				fontWeight="600"
				opacity="0.8"
				textAnchor="middle"
				x="300"
				y="200"
			>
				Rails API
			</text>

			{/* CORS shield indicator */}
			{isProtected ? (
				<g transform="translate(300, 232)">
					<rect
						fill="#10b981"
						fillOpacity="0.2"
						height="20"
						rx="4"
						stroke="#10b981"
						strokeWidth="1"
						width="80"
						x="-40"
						y="-8"
					/>
					<text
						fill="#10b981"
						fontSize="10"
						fontWeight="600"
						textAnchor="middle"
						x="0"
						y="5"
					>
						CORS Shield
					</text>
				</g>
			) : (
				<text
					fill="#f59e0b"
					fontSize="10"
					fontWeight="500"
					opacity="0.7"
					textAnchor="middle"
					x="300"
					y="240"
				>
					no CORS config
				</text>
			)}

			{/* ── Database box (right) ── */}
			<rect
				fill="none"
				height="60"
				rx="8"
				stroke="currentColor"
				strokeOpacity="0.3"
				strokeWidth="1.5"
				width="80"
				x="490"
				y="170"
			/>
			<text
				fill="currentColor"
				fontSize="12"
				fontWeight="600"
				opacity="0.8"
				textAnchor="middle"
				x="530"
				y="205"
			>
				Database
			</text>

			{/* ── Connection lines ── */}
			<line
				stroke="#10b981"
				strokeDasharray={isProtected ? 'none' : '4 4'}
				strokeOpacity="0.2"
				strokeWidth="1"
				x1="150"
				x2="240"
				y1="155"
				y2="195"
			/>
			<line
				stroke="#ef4444"
				strokeDasharray="4 4"
				strokeOpacity="0.2"
				strokeWidth="1"
				x1="150"
				x2="240"
				y1="285"
				y2="225"
			/>
			<line
				stroke="currentColor"
				strokeDasharray={isProtected ? 'none' : '4 4'}
				strokeOpacity="0.15"
				strokeWidth="1"
				x1="360"
				x2="490"
				y1="200"
				y2="200"
			/>

			{/* ── Animated dots ── */}
			{!isProtected ? (
				<>
					{/* No CORS: browser blocks ALL cross-origin responses */}
					{/* Browser dot travels toward API then fades (blocked) */}
					<circle fill="#10b981" r="4">
						<animateMotion begin="0s" dur="2s" repeatCount="indefinite">
							<mpath xlinkHref="#browser-path" />
						</animateMotion>
						<animate
							attributeName="opacity"
							dur="2s"
							repeatCount="indefinite"
							values="1;1;0"
						/>
					</circle>
					<circle fill="#10b981" r="4">
						<animateMotion begin="-1s" dur="2s" repeatCount="indefinite">
							<mpath xlinkHref="#browser-path" />
						</animateMotion>
						<animate
							attributeName="opacity"
							begin="-1s"
							dur="2s"
							repeatCount="indefinite"
							values="1;1;0"
						/>
					</circle>

					{/* Malicious dot travels toward API then fades (blocked) */}
					<circle fill="#ef4444" r="4">
						<animateMotion begin="0s" dur="2s" repeatCount="indefinite">
							<mpath xlinkHref="#malicious-path" />
						</animateMotion>
						<animate
							attributeName="opacity"
							dur="2s"
							repeatCount="indefinite"
							values="1;1;0"
						/>
					</circle>
					<circle fill="#ef4444" r="4">
						<animateMotion begin="-1s" dur="2s" repeatCount="indefinite">
							<mpath xlinkHref="#malicious-path" />
						</animateMotion>
						<animate
							attributeName="opacity"
							begin="-1s"
							dur="2s"
							repeatCount="indefinite"
							values="1;1;0"
						/>
					</circle>

					{/* No dots reach the database */}

					{/* BLOCKED labels for both */}
					<text
						fill="#ef4444"
						fontSize="10"
						fontWeight="600"
						textAnchor="middle"
						x="190"
						y="145"
					>
						BLOCKED
						<animate
							attributeName="opacity"
							dur="2s"
							repeatCount="indefinite"
							values="1;0.4;1"
						/>
					</text>
					<text
						fill="#ef4444"
						fontSize="10"
						fontWeight="600"
						textAnchor="middle"
						x="190"
						y="305"
					>
						BLOCKED
						<animate
							attributeName="opacity"
							begin="1s"
							dur="2s"
							repeatCount="indefinite"
							values="1;0.4;1"
						/>
					</text>

					{/* Explanation label */}
					<text
						fill="#ef4444"
						fontSize="10"
						opacity="0.7"
						textAnchor="middle"
						x="300"
						y="370"
					>
						No CORS headers: browser blocks all cross-origin requests
					</text>
				</>
			) : (
				<>
					{/* Protected: browser requests pass, malicious blocked */}
					{/* Browser requests go through */}
					<circle fill="#10b981" r="4">
						<animateMotion begin="0s" dur="2s" repeatCount="indefinite">
							<mpath xlinkHref="#browser-path" />
						</animateMotion>
					</circle>
					<circle fill="#10b981" r="4">
						<animateMotion begin="-1s" dur="2s" repeatCount="indefinite">
							<mpath xlinkHref="#browser-path" />
						</animateMotion>
					</circle>
					<circle fill="#10b981" r="4">
						<animateMotion begin="0s" dur="2.5s" repeatCount="indefinite">
							<mpath xlinkHref="#api-path" />
						</animateMotion>
					</circle>

					{/* Malicious requests get blocked */}
					<circle fill="#ef4444" r="4">
						<animateMotion begin="0s" dur="2s" repeatCount="indefinite">
							<mpath xlinkHref="#malicious-path" />
						</animateMotion>
						<animate
							attributeName="opacity"
							dur="2s"
							repeatCount="indefinite"
							values="1;1;0"
						/>
					</circle>
					<circle fill="#ef4444" r="4">
						<animateMotion begin="0s" dur="1.5s" repeatCount="indefinite">
							<mpath xlinkHref="#block-path" />
						</animateMotion>
						<animate
							attributeName="opacity"
							dur="1.5s"
							repeatCount="indefinite"
							values="1;1;0"
						/>
					</circle>

					{/* Status labels */}
					<text
						fill="#10b981"
						fontSize="10"
						fontWeight="600"
						textAnchor="middle"
						x="190"
						y="145"
					>
						ALLOWED
						<animate
							attributeName="opacity"
							dur="2s"
							repeatCount="indefinite"
							values="1;0.4;1"
						/>
					</text>
					<text
						fill="#ef4444"
						fontSize="10"
						fontWeight="600"
						textAnchor="middle"
						x="300"
						y="360"
					>
						BLOCKED
						<animate
							attributeName="opacity"
							begin="1s"
							dur="2s"
							repeatCount="indefinite"
							values="1;0.4;1"
						/>
					</text>
				</>
			)}
		</svg>
	);
}

// ──────────────────────────────────────────────
// CORS Legend
// ──────────────────────────────────────────────

function CORSLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full bg-success" />
					<span className="text-foreground">Legitimate request (your frontend)</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full bg-destructive" />
					<span className="text-foreground">Malicious request (unknown origin)</span>
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

export function Level16CORS({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [phase, setPhase] = useState<Phase>('observe');
	const [blockedCount, setBlockedCount] = useState(0);

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

	// ── Reward phase: counter interval ──
	useEffect(() => {
		if (phase !== 'reward') return;
		const interval = setInterval(() => {
			setBlockedCount((c) => c + 1);
		}, 3500);
		return () => clearInterval(interval);
	}, [phase]);

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
		setPhase('reward');
		setBlockedCount(0);
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

					{/* Observe phase: legend only */}
					{phase === 'observe' && <CORSLegend />}

					{/* Build / activate / reward phases: step progress */}
					{phase !== 'observe' && (
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

					{/* Reward phase: legend + counter */}
					{phase === 'reward' && (
						<>
							<CORSLegend />

							<div className="p-4">
								<div className="bg-destructive/20 rounded-lg p-3 text-center">
									<div className="text-2xl font-bold text-destructive">
										{blockedCount}
									</div>
									<div className="text-xs text-destructive/70">
										Cross-Origin Attacks Blocked
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
					levelNumber={16}
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
								<CORSVisualization mode="vulnerable" />
							</div>
							<div className="p-6 flex justify-center">
								<Button
									className="gap-2"
									onClick={handleStartBuild}
									size="lg"
								>
									Build the Fix
									<ArrowRight className="w-4 h-4" />
								</Button>
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
								<CORSVisualization mode="protected" />
							</div>
							<div className="p-4 text-center">
								<p className="text-sm text-muted-foreground">
									CORS shield active. Your frontend can reach
									the API while malicious origins are blocked.
									Click Submit to complete the level.
								</p>
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

export default Level16CORS;
