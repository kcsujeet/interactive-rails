/**
 * Level 14: Strong Params
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Watch unfiltered params flow into database
 * Phase 2 (HOW - build): 3 OptionCard steps configuring params.expect
 *   Step 0: Choose the Params Method
 *   Step 1: Define Expected Params
 *   Step 2: Handle Missing Params
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Filtering" button
 * Phase 4 (ADVANTAGE - reward): Filter gate blocks dangerous params
 *
 * Teaches: Rails 8 params.expect, mass assignment protection, strict parameter filtering
 */

import { ArrowRight, Play, Star } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
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
// Step definitions (3 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-method', title: 'Choose the Params Method' },
	{ id: 'define-params', title: 'Define Expected Params' },
	{ id: 'handle-missing', title: 'Handle Missing Params' },
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

// Step 0: Choose the Params Method
const PARAMS_METHOD_OPTIONS: StepOption[] = [
	{
		id: 'permit-all',
		label: 'params.permit!',
		correct: false,
		feedback:
			'permit! allows ALL parameters through. This makes mass assignment worse, not better.',
	},
	{
		id: 'require-permit',
		label: 'params.require(:post).permit(:title, :body)',
		correct: false,
		feedback:
			'This works but returns 500 on missing params. Rails 8 has a stricter alternative that returns 400.',
	},
	{
		id: 'expect',
		label: 'params.expect(post: [:title, :body, :status])',
		correct: true,
	},
];

// Step 1: Define Expected Params
const EXPECTED_PARAMS_OPTIONS: StepOption[] = [
	{
		id: 'with-user-id',
		label: 'params.expect(post: [:title, :body, :user_id])',
		correct: false,
		feedback:
			'user_id should not be settable by the user. Only whitelist fields the user is allowed to change.',
	},
	{
		id: 'correct-params',
		label: 'params.expect(post: [:title, :body, :status])',
		correct: true,
	},
	{
		id: 'no-root-key',
		label: 'params.expect(:title, :body, :status)',
		correct: false,
		feedback:
			'params.expect needs the root key (:post) to scope the expected attributes.',
	},
];

// Step 2: Handle Missing Params
const HANDLE_MISSING_OPTIONS: StepOption[] = [
	{
		id: 'rescue-explicit',
		label: 'rescue ActionController::ParameterMissing',
		correct: false,
		feedback:
			'Explicit rescue is unnecessary. params.expect already returns 400 Bad Request automatically.',
	},
	{
		id: 'rescue-nil',
		label: 'params.expect(post: [:title, :body, :status]) rescue nil',
		correct: false,
		feedback:
			'Silencing the error defeats the purpose. You want invalid requests to fail loudly.',
	},
	{
		id: 'auto-400',
		label: 'Let params.expect return 400 automatically',
		correct: true,
	},
];

// Map from step index -> OptionCard config
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	0: {
		title: 'Choose the Params Method',
		description:
			'The controller currently uses raw params[:post], passing every attribute straight to the model. Rails 8 introduced a stricter alternative to require/permit. Which method should you use?',
		options: PARAMS_METHOD_OPTIONS,
	},
	1: {
		title: 'Define Expected Params',
		description:
			'Now define which attributes the user is allowed to set. The Post model has title, body, status, and user_id columns. Which set of params should you whitelist?',
		options: EXPECTED_PARAMS_OPTIONS,
	},
	2: {
		title: 'Handle Missing Params',
		description:
			'What happens when a request is missing the required :post key or any expected attributes? How should your controller handle it?',
		options: HANDLE_MISSING_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// ParamsFilter SVG Visualization
// ──────────────────────────────────────────────

function ParamsFilterVisualization({
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
					id="params-grid"
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
				<path d="M 100,200 L 220,200" id="safe-path" />
				<path d="M 340,200 L 480,200" id="to-db-path" />
				<path d="M 280,200 L 280,310" id="reject-path" />
			</defs>

			<rect fill="url(#params-grid)" height="400" width="600" />

			{/* ── Request box (left) ── */}
			<rect
				fill="none"
				height="160"
				rx="8"
				stroke="currentColor"
				strokeOpacity="0.2"
				strokeWidth="1.5"
				width="100"
				x="30"
				y="120"
			/>
			<text
				fill="currentColor"
				fontSize="12"
				fontWeight="600"
				opacity="0.7"
				textAnchor="middle"
				x="80"
				y="145"
			>
				Request
			</text>

			{/* Param badges inside request box */}
			<rect
				fill="#10b981"
				fillOpacity="0.15"
				height="20"
				rx="4"
				width="70"
				x="45"
				y="158"
			/>
			<text fill="#10b981" fontSize="10" fontWeight="500" x="52" y="172">
				title
			</text>

			<rect
				fill="#10b981"
				fillOpacity="0.15"
				height="20"
				rx="4"
				width="70"
				x="45"
				y="184"
			/>
			<text fill="#10b981" fontSize="10" fontWeight="500" x="52" y="198">
				body
			</text>

			<rect
				fill="#ef4444"
				fillOpacity="0.15"
				height="20"
				rx="4"
				width="70"
				x="45"
				y="210"
			/>
			<text fill="#ef4444" fontSize="10" fontWeight="500" x="52" y="224">
				user_id
			</text>

			<rect
				fill="#ef4444"
				fillOpacity="0.15"
				height="20"
				rx="4"
				width="70"
				x="45"
				y="236"
			/>
			<text fill="#ef4444" fontSize="10" fontWeight="500" x="52" y="250">
				admin
			</text>

			{/* ── Controller box with filter gate (center) ── */}
			<rect
				fill="none"
				height="60"
				rx="8"
				stroke="currentColor"
				strokeOpacity="0.3"
				strokeWidth="1.5"
				width="140"
				x="210"
				y="170"
			/>
			<text
				fill="currentColor"
				fontSize="14"
				fontWeight="600"
				opacity="0.8"
				textAnchor="middle"
				x="280"
				y="205"
			>
				Controller
			</text>

			{/* Filter gate indicator */}
			{isProtected ? (
				<g transform="translate(280, 245)">
					<rect
						fill="#10b981"
						fillOpacity="0.2"
						height="24"
						rx="4"
						stroke="#10b981"
						strokeWidth="1"
						width="100"
						x="-50"
						y="0"
					/>
					<text
						fill="#10b981"
						fontSize="10"
						fontWeight="600"
						textAnchor="middle"
						x="0"
						y="16"
					>
						params.expect
					</text>
				</g>
			) : (
				<g transform="translate(280, 245)">
					<rect
						fill="none"
						height="24"
						rx="4"
						stroke="#71717a"
						strokeDasharray="3 3"
						strokeWidth="1"
						width="100"
						x="-50"
						y="0"
					/>
					<text
						fill="#f59e0b"
						fontSize="10"
						fontWeight="500"
						textAnchor="middle"
						x="0"
						y="16"
					>
						no filter
					</text>
				</g>
			)}

			{/* ── Database box (right) ── */}
			<rect
				fill="none"
				height="60"
				rx="8"
				stroke="currentColor"
				strokeOpacity="0.3"
				strokeWidth="1.5"
				width="100"
				x="440"
				y="170"
			/>
			<text
				fill="currentColor"
				fontSize="14"
				fontWeight="600"
				opacity="0.8"
				textAnchor="middle"
				x="490"
				y="205"
			>
				Database
			</text>

			{/* ── Connection lines ── */}
			<line
				stroke="currentColor"
				strokeDasharray={isProtected ? 'none' : '4 4'}
				strokeOpacity="0.15"
				strokeWidth="1"
				x1="130"
				x2="210"
				y1="200"
				y2="200"
			/>
			<line
				stroke="currentColor"
				strokeDasharray={isProtected ? 'none' : '4 4'}
				strokeOpacity="0.15"
				strokeWidth="1"
				x1="350"
				x2="440"
				y1="200"
				y2="200"
			/>

			{/* ── Animated dots ── */}
			{!isProtected ? (
				<>
					{/* Vulnerable: all params flow to database */}
					<circle fill="#10b981" r="4">
						<animateMotion begin="0s" dur="2s" repeatCount="indefinite">
							<mpath xlinkHref="#safe-path" />
						</animateMotion>
					</circle>
					<circle fill="#ef4444" r="4">
						<animateMotion begin="-0.5s" dur="2s" repeatCount="indefinite">
							<mpath xlinkHref="#safe-path" />
						</animateMotion>
					</circle>

					{/* All continue to database unfiltered */}
					<circle fill="#10b981" r="4">
						<animateMotion begin="0s" dur="2.5s" repeatCount="indefinite">
							<mpath xlinkHref="#to-db-path" />
						</animateMotion>
					</circle>
					<circle fill="#ef4444" r="4">
						<animateMotion begin="-0.5s" dur="2.5s" repeatCount="indefinite">
							<mpath xlinkHref="#to-db-path" />
						</animateMotion>
					</circle>

					{/* Vulnerability label */}
					<text
						fill="#ef4444"
						fontSize="10"
						opacity="0.7"
						textAnchor="middle"
						x="300"
						y="340"
					>
						All params pass through unfiltered
					</text>
				</>
			) : (
				<>
					{/* Protected: safe params pass, dangerous ones are rejected */}
					{/* Safe params flow through to database */}
					<circle fill="#10b981" r="4">
						<animateMotion begin="0s" dur="2s" repeatCount="indefinite">
							<mpath xlinkHref="#safe-path" />
						</animateMotion>
					</circle>
					<circle fill="#10b981" r="4">
						<animateMotion begin="0s" dur="2.5s" repeatCount="indefinite">
							<mpath xlinkHref="#to-db-path" />
						</animateMotion>
					</circle>

					{/* Dangerous params get rejected downward */}
					<circle fill="#ef4444" r="4">
						<animateMotion begin="0s" dur="1.5s" repeatCount="indefinite">
							<mpath xlinkHref="#reject-path" />
						</animateMotion>
						<animate
							attributeName="opacity"
							dur="1.5s"
							repeatCount="indefinite"
							values="1;1;0"
						/>
					</circle>
					<circle fill="#ef4444" r="4">
						<animateMotion begin="-0.75s" dur="1.5s" repeatCount="indefinite">
							<mpath xlinkHref="#reject-path" />
						</animateMotion>
						<animate
							attributeName="opacity"
							begin="-0.75s"
							dur="1.5s"
							repeatCount="indefinite"
							values="1;1;0"
						/>
					</circle>

					{/* REJECTED label */}
					<text
						fill="#ef4444"
						fontSize="10"
						fontWeight="600"
						textAnchor="middle"
						x="280"
						y="340"
					>
						REJECTED
						<animate
							attributeName="opacity"
							dur="2s"
							repeatCount="indefinite"
							values="1;0.4;1"
						/>
					</text>

					{/* Allowed label */}
					<text
						fill="#10b981"
						fontSize="10"
						fontWeight="600"
						textAnchor="middle"
						x="400"
						y="165"
					>
						ALLOWED
						<animate
							attributeName="opacity"
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
// Params Legend
// ──────────────────────────────────────────────

function ParamsLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full bg-success" />
					<span className="text-foreground">Safe params (whitelisted)</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full bg-destructive" />
					<span className="text-foreground">Dangerous params (blocked)</span>
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

	// Observe phase: show unfiltered controller
	if (phase === 'observe' || (phase === 'build' && furthestStep === 0)) {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::PostsController < ApplicationController
  def create
    post = current_user.posts.create!(params[:post])
    # Accepts ANY params: title, body, user_id, admin...
    # Mass assignment vulnerability!
    render json: post, status: :created
  end

  def update
    post = current_user.posts.find(params[:id])
    post.update!(params[:post])
    # Same problem: no filtering
    render json: post
  end
end`,
			highlight: [3, 11],
		});
		return files;
	}

	// After step 0: controller with params.expect method
	if (furthestStep >= 1) {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code:
				furthestStep >= 3
					? `class Api::V1::PostsController < ApplicationController
  def create
    post = current_user.posts.create!(post_params)
    render json: post, status: :created
  end

  def update
    post = current_user.posts.find(params[:id])
    post.update!(post_params)
    render json: post
  end

  private

  def post_params
    params.expect(post: [:title, :body, :status])
    # Missing :post key or attributes -> 400 Bad Request
    # No rescue needed, Rails handles it automatically
  end
end`
					: furthestStep >= 2
						? `class Api::V1::PostsController < ApplicationController
  def create
    post = current_user.posts.create!(post_params)
    render json: post, status: :created
  end

  def update
    post = current_user.posts.find(params[:id])
    post.update!(post_params)
    render json: post
  end

  private

  def post_params
    params.expect(post: [:title, :body, :status])
  end
end`
						: `class Api::V1::PostsController < ApplicationController
  def create
    post = current_user.posts.create!(post_params)
    render json: post, status: :created
  end

  def update
    post = current_user.posts.find(params[:id])
    post.update!(post_params)
    render json: post
  end

  private

  def post_params
    params.expect(post: [...])  # Which params to allow?
  end
end`,
			highlight:
				furthestStep >= 3 ? [16, 17, 18] : furthestStep >= 2 ? [16] : [16],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level14StrongParams({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [phase, setPhase] = useState<Phase>('observe');
	const [filteredCount, setFilteredCount] = useState(0);

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
			setFilteredCount((c) => c + 1);
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

	const handleActivateFilter = () => {
		setPhase('reward');
		setFilteredCount(0);
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
		return { valid: true, message: 'Strong params are configured!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							The controller passes raw params straight to the model.
							A malicious user can send{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								user_id
							</code>{' '}
							or{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								admin
							</code>{' '}
							in the request body and take over any account.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Rails 8 introduced{' '}
							<span className="text-foreground font-medium">
								params.expect
							</span>{' '}
							as a stricter alternative to require/permit. It returns 400
							Bad Request automatically when required params are missing.
						</p>
					</div>

					{/* Observe phase: legend only */}
					{phase === 'observe' && <ParamsLegend />}

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
							<ParamsLegend />

							<div className="p-4">
								<div className="bg-destructive/20 rounded-lg p-3 text-center">
									<div className="text-2xl font-bold text-destructive">
										{filteredCount}
									</div>
									<div className="text-xs text-destructive/70">
										Dangerous Params Blocked
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
					levelName="Strong Params"
					levelNumber={14}
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
								<ParamsFilterVisualization mode="vulnerable" />
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
					{phase === 'build' && currentOptionConfig && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									{currentOptionConfig.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{currentOptionConfig.description}
								</p>

								{isViewingCompletedStep ? (
									<div className="space-y-2">
										{currentOptionConfig.options.map((opt) => (
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
											{currentOptionConfig.options.map((opt) => (
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
									Strong params configured. Watch dangerous parameters
									get rejected at the filter gate.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateFilter}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Filtering
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward (ADVANTAGE sub-phase b) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<ParamsFilterVisualization mode="protected" />
							</div>
							<div className="p-4 text-center">
								<p className="text-sm text-muted-foreground">
									Filter active. Dangerous params like user_id and admin
									are rejected automatically. Click Submit to complete
									the level.
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

export default Level14StrongParams;
