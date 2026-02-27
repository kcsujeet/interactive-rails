/**
 * Level 31: HTTP Caching & CDNs
 *
 * 4-step click-to-select progression teaching Cache-Control headers,
 * ETags, 304 responses, and CDN configuration.
 * Steps: Cache-Control Headers -> ETag / 304 Responses -> Static Asset Strategy -> User-Specific Caching
 */

import { useState } from 'react';
import {
	ArrowRight,
	Clock,
	Globe,
	Lock,
	Server,
	Shield,
	Zap,
} from 'lucide-react';
import {
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	StepProgress,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useStepGating, type StepDef } from '@/hooks/useStepGating';

// --- Step Definitions ---

const STEP_DEFS: StepDef[] = [
	{ id: 'cache-control', title: 'Cache-Control Headers' },
	{ id: 'etag', title: 'ETag / 304 Responses' },
	{ id: 'static-assets', title: 'Static Asset Strategy' },
	{ id: 'user-data', title: 'User-Specific Caching' },
];

// --- Step Scenarios & Options ---

interface StepOption {
	id: string;
	label: string;
	code: string;
	correct: boolean;
	feedback?: string;
}

interface StepScenario {
	title: string;
	description: string;
	context: string;
	icon: typeof Globe;
	options: StepOption[];
}

const STEP_SCENARIOS: StepScenario[] = [
	{
		title: 'Public Product Catalog',
		description:
			'A public product catalog endpoint. Same data served to all users. Changes once per hour.',
		context: `# GET /api/products
class ProductsController < ApplicationController
  def index
    @products = Product.all
    # Which Cache-Control header?
    render json: @products
  end
end`,
		icon: Globe,
		options: [
			{
				id: 'private-no-store',
				label: 'private, no-store',
				code: 'Cache-Control: private, no-store',
				correct: false,
				feedback:
					'This prevents ALL caching -- both browser and CDN. For public data that rarely changes, you want caches to store and serve it.',
			},
			{
				id: 'public-s-max-age',
				label: 'public, s-max-age=3600',
				code: 'Cache-Control: public, s-max-age=3600',
				correct: true,
			},
			{
				id: 'no-cache-revalidate',
				label: 'no-cache, must-revalidate',
				code: 'Cache-Control: no-cache, must-revalidate',
				correct: false,
				feedback:
					'This forces revalidation on every single request -- far too aggressive for data that only changes once per hour.',
			},
		],
	},
	{
		title: 'Post Detail Endpoint',
		description:
			'Single post detail endpoint. Post changes infrequently. Want to avoid re-serializing unchanged data.',
		context: `# GET /api/posts/:id
class PostsController < ApplicationController
  def show
    @post = Post.find(params[:id])
    # Which caching approach?
    render json: @post
  end
end`,
		icon: Server,
		options: [
			{
				id: 'expires-in',
				label: 'expires_in 24.hours, public: true',
				code: 'expires_in 24.hours, public: true',
				correct: false,
				feedback:
					'Time-based expiration means clients have no way to know when the post is actually updated -- they may serve stale data or miss updates entirely.',
			},
			{
				id: 'fresh-when',
				label: 'fresh_when last_modified: @post.updated_at',
				code: 'fresh_when last_modified: @post.updated_at',
				correct: false,
				feedback:
					'Last-Modified only has 1-second precision -- if the post is updated twice in the same second, the second update could be missed.',
			},
			{
				id: 'stale',
				label: 'stale? @post',
				code: 'stale? @post',
				correct: true,
			},
		],
	},
	{
		title: 'Fingerprinted Static Assets',
		description:
			'CSS/JS bundles with fingerprinted filenames (e.g., app-a1b2c3.js). New deploy = new filename.',
		context: `# Static asset serving
# Files like: app-a1b2c3.js, style-d4e5f6.css
# Fingerprint changes on every deploy
#
# config/environments/production.rb
config.public_file_server.headers = {
  # Which Cache-Control header?
}`,
		icon: Zap,
		options: [
			{
				id: 'max-age-1day',
				label: 'public, max-age=86400',
				code: 'Cache-Control: public, max-age=86400',
				correct: false,
				feedback:
					'Only caches for 1 day -- fingerprinted assets can be cached forever since the URL changes on every deploy.',
			},
			{
				id: 'no-cache',
				label: 'no-cache',
				code: 'Cache-Control: no-cache',
				correct: false,
				feedback:
					'Forces revalidation on every request -- completely defeats the purpose of fingerprinted filenames which guarantee uniqueness.',
			},
			{
				id: 'immutable',
				label: 'public, max-age=31536000, immutable',
				code: 'Cache-Control: public, max-age=31536000, immutable',
				correct: true,
			},
		],
	},
	{
		title: 'User Order History',
		description:
			"Dashboard showing user's own order history. Different for every user.",
		context: `# GET /api/dashboard/orders
class DashboardController < ApplicationController
  before_action :authenticate_user!

  def orders
    @orders = current_user.orders.recent
    # Which Cache-Control header?
    render json: @orders
  end
end`,
		icon: Shield,
		options: [
			{
				id: 'public-s-max-age',
				label: 'public, s-max-age=300',
				code: 'Cache-Control: public, s-max-age=300',
				correct: false,
				feedback:
					"Public means the CDN caches it -- other users could see someone else's order history. This is a critical security issue for user-specific data.",
			},
			{
				id: 'private-swr',
				label: 'private, max-age=60, stale-while-revalidate=30',
				code: 'Cache-Control: private, max-age=60, stale-while-revalidate=30',
				correct: true,
			},
			{
				id: 'public-vary',
				label: 'public, max-age=60, Vary: Cookie',
				code: 'Cache-Control: public, max-age=60, Vary: Cookie',
				correct: false,
				feedback:
					'Vary: Cookie technically segments by cookie, but CDNs handle Vary poorly -- many will just bypass the cache entirely, defeating the purpose.',
			},
		],
	},
];

// --- HTTP Flow Visualization Data ---

interface HttpFlow {
	method: string;
	path: string;
	requestHeaders: string[];
	responseStatus: string;
	responseHeaders: string[];
	timing: string;
}

function getHttpFlowForStep(stepIndex: number, completed: boolean): HttpFlow[] {
	if (!completed) {
		return [
			{
				method: 'GET',
				path: stepIndex === 0 ? '/api/products' : stepIndex === 1 ? '/api/posts/42' : stepIndex === 2 ? '/assets/app-a1b2c3.js' : '/api/dashboard/orders',
				requestHeaders: ['Accept: application/json'],
				responseStatus: '200 OK',
				responseHeaders: ['Content-Type: application/json', '(no caching headers)'],
				timing: '200ms',
			},
		];
	}

	switch (stepIndex) {
		case 0:
			return [
				{
					method: 'GET',
					path: '/api/products',
					requestHeaders: ['Accept: application/json'],
					responseStatus: '200 OK',
					responseHeaders: [
						'Cache-Control: public, s-max-age=3600',
						'Content-Type: application/json',
					],
					timing: '200ms (origin)',
				},
				{
					method: 'GET',
					path: '/api/products',
					requestHeaders: ['Accept: application/json'],
					responseStatus: '200 OK (CDN)',
					responseHeaders: [
						'X-Cache: HIT',
						'Age: 1200',
					],
					timing: '5ms (CDN edge)',
				},
			];
		case 1:
			return [
				{
					method: 'GET',
					path: '/api/posts/42',
					requestHeaders: ['Accept: application/json'],
					responseStatus: '200 OK',
					responseHeaders: [
						'ETag: "abc123def456"',
						'Content-Type: application/json',
					],
					timing: '21ms',
				},
				{
					method: 'GET',
					path: '/api/posts/42',
					requestHeaders: [
						'If-None-Match: "abc123def456"',
					],
					responseStatus: '304 Not Modified',
					responseHeaders: [
						'ETag: "abc123def456"',
					],
					timing: '6ms (no body)',
				},
			];
		case 2:
			return [
				{
					method: 'GET',
					path: '/assets/app-a1b2c3.js',
					requestHeaders: ['Accept: */*'],
					responseStatus: '200 OK',
					responseHeaders: [
						'Cache-Control: public, max-age=31536000, immutable',
						'Content-Type: application/javascript',
					],
					timing: '50ms (first load)',
				},
				{
					method: 'GET',
					path: '/assets/app-a1b2c3.js',
					requestHeaders: ['(from disk cache)'],
					responseStatus: '200 OK (cached)',
					responseHeaders: [
						'(served from browser cache)',
					],
					timing: '0ms (instant)',
				},
			];
		case 3:
			return [
				{
					method: 'GET',
					path: '/api/dashboard/orders',
					requestHeaders: [
						'Authorization: Bearer xxx',
						'Accept: application/json',
					],
					responseStatus: '200 OK',
					responseHeaders: [
						'Cache-Control: private, max-age=60, stale-while-revalidate=30',
						'Content-Type: application/json',
					],
					timing: '45ms (origin)',
				},
				{
					method: 'GET',
					path: '/api/dashboard/orders',
					requestHeaders: [
						'Authorization: Bearer xxx',
					],
					responseStatus: '200 OK (browser)',
					responseHeaders: [
						'(served from browser cache)',
						'(CDN never caches this)',
					],
					timing: '0ms (browser)',
				},
			];
		default:
			return [];
	}
}

// --- Code Preview ---

function getCodePreviewForStep(stepIndex: number, completed: boolean) {
	const files = [];

	if (stepIndex === 0) {
		files.push({
			filename: 'products_controller.rb',
			language: 'ruby',
			code: completed
				? `class ProductsController < ApplicationController
  def index
    @products = Product.all

    # CDN + browser cache for 1 hour
    expires_in 1.hour, public: true,
      's-max-age': 3600

    render json: @products
  end
end`
				: `class ProductsController < ApplicationController
  def index
    @products = Product.all
    # No caching: every request hits the server
    render json: @products
  end
end`,
			highlight: completed ? [5, 6, 7] : [],
		});
	}

	if (stepIndex === 1) {
		files.push({
			filename: 'posts_controller.rb',
			language: 'ruby',
			code: completed
				? `class PostsController < ApplicationController
  def show
    @post = Post.find(params[:id])

    # ETag from post content
    # Returns 304 if unchanged
    if stale?(@post)
      render json: @post
    end
    # If not stale, Rails auto-returns 304
  end
end`
				: `class PostsController < ApplicationController
  def show
    @post = Post.find(params[:id])
    # No conditional GET: always re-serializes
    render json: @post
  end
end`,
			highlight: completed ? [6, 7, 8, 9] : [],
		});
	}

	if (stepIndex === 2) {
		files.push({
			filename: 'production.rb',
			language: 'ruby',
			code: completed
				? `# config/environments/production.rb
Rails.application.configure do
  # Fingerprinted assets are immutable
  config.public_file_server.headers = {
    "Cache-Control" => "public, max-age=31536000, immutable"
  }

  # Asset pipeline adds fingerprints:
  # app-a1b2c3.js  (new hash on each deploy)
  # style-d4e5f6.css
end`
				: `# config/environments/production.rb
Rails.application.configure do
  config.public_file_server.headers = {
    # No caching configured for assets
  }
end`,
			highlight: completed ? [4, 5] : [],
		});
	}

	if (stepIndex === 3) {
		files.push({
			filename: 'dashboard_controller.rb',
			language: 'ruby',
			code: completed
				? `class DashboardController < ApplicationController
  before_action :authenticate_user!

  def orders
    @orders = current_user.orders.recent

    # Private: browser only, no CDN
    # SWR: serve stale while fetching fresh
    expires_in 1.minute,
      private: true,
      stale_while_revalidate: 30.seconds

    render json: @orders
  end
end`
				: `class DashboardController < ApplicationController
  before_action :authenticate_user!

  def orders
    @orders = current_user.orders.recent
    # No caching: user data needs care
    render json: @orders
  end
end`,
			highlight: completed ? [8, 9, 10, 11] : [],
		});
	}

	return files;
}

// --- Component ---

export function Level31HTTPCaching({ onComplete }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [selectedOption, setSelectedOption] = useState<string | null>(null);

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const scenario = STEP_SCENARIOS[stepper.currentStep];
	const ScenarioIcon = scenario.icon;
	const httpFlows = getHttpFlowForStep(stepper.currentStep, isViewingCompletedStep);

	const handleOptionClick = (option: StepOption) => {
		if (isViewingCompletedStep) return;

		setSelectedOption(option.id);

		if (option.correct) {
			stepper.completeStep();
			setSelectedOption(null);
		} else {
			stepper.recordWrongAttempt(option.feedback!);
		}
	};

	const handleComplete = async () => {
		const success = await completeLevel('act4-level31-http-caching', {
			stars: stepper.starRating,
		});
		if (success) {
			onComplete({ stars: stepper.starRating });
		}
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
		return { valid: true, message: 'HTTP caching strategy configured!' };
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario */}
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your API serves every response from scratch. No caching headers,
							no ETags, no CDN. Time to configure HTTP caching for different
							endpoint types.
						</p>
					</div>

					{/* Step Progress */}
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

					{/* HTTP Request/Response Flow */}
					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							HTTP Flow
						</div>
						<div className="space-y-3">
							{httpFlows.map((flow, i) => (
								<div
									className="bg-secondary/50 rounded-lg border border-border overflow-hidden"
									key={`${stepper.currentStep}-${i}`}
								>
									{/* Request */}
									<div className="px-3 py-2 border-b border-border">
										<div className="flex items-center gap-2 mb-1">
											<ArrowRight className="w-3 h-3 text-primary" />
											<span className="text-xs font-mono font-semibold text-primary">
												{flow.method} {flow.path}
											</span>
										</div>
										{flow.requestHeaders.map((h) => (
											<div
												className="text-[10px] font-mono text-muted-foreground ml-5"
												key={h}
											>
												{h}
											</div>
										))}
									</div>
									{/* Response */}
									<div className="px-3 py-2">
										<div className="flex items-center gap-2 mb-1">
											<ArrowRight className="w-3 h-3 text-success rotate-180" />
											<span
												className={`text-xs font-mono font-semibold ${
													flow.responseStatus.includes('304')
														? 'text-warning'
														: flow.responseStatus.includes('CDN') ||
															  flow.responseStatus.includes('cached') ||
															  flow.responseStatus.includes('browser')
															? 'text-success'
															: 'text-foreground'
												}`}
											>
												{flow.responseStatus}
											</span>
											<span className="text-[10px] text-muted-foreground ml-auto">
												{flow.timing}
											</span>
										</div>
										{flow.responseHeaders.map((h) => (
											<div
												className="text-[10px] font-mono text-muted-foreground ml-5"
												key={h}
											>
												{h}
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="HTTP Caching"
					levelNumber={31}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Scenario Card */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-3">
								<div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
									<ScenarioIcon className="w-4 h-4 text-primary" />
								</div>
								<div>
									<div className="text-foreground font-semibold text-sm">
										{scenario.title}
									</div>
									<div className="text-xs text-muted-foreground">
										Step {stepper.currentStep + 1} of {STEP_DEFS.length}
									</div>
								</div>
							</div>
							<div className="p-4">
								<p className="text-sm text-muted-foreground leading-relaxed mb-4">
									{scenario.description}
								</p>
								{/* Code Context */}
								<pre className="bg-secondary/50 p-3 rounded-lg text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
									{scenario.context}
								</pre>
							</div>
						</div>

						{/* Options */}
						<div className="space-y-3">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Choose the right caching strategy
							</div>
							{scenario.options.map((option) => {
								const isCorrectAndCompleted =
									isViewingCompletedStep && option.correct;
								const isWrongAndCompleted =
									isViewingCompletedStep && !option.correct;

								return (
									<Button
										className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
											isCorrectAndCompleted
												? 'border-success bg-success/5'
												: isWrongAndCompleted
													? 'border-border bg-secondary/30 opacity-50'
													: selectedOption === option.id && !option.correct
														? 'border-destructive/50 bg-destructive/5'
														: 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'
										}`}
										disabled={isViewingCompletedStep}
										key={option.id}
										onClick={() => handleOptionClick(option)}
									>
										<div className="flex items-center gap-3">
											<div
												className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
													isCorrectAndCompleted
														? 'border-success bg-success/20'
														: 'border-border bg-secondary'
												}`}
											>
												{isCorrectAndCompleted ? (
													<Zap className="w-4 h-4 text-success" />
												) : (
													<Clock className="w-4 h-4 text-muted-foreground" />
												)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="font-mono text-sm text-foreground">
													{option.code}
												</div>
												<div className="text-xs text-muted-foreground mt-0.5">
													{option.label}
												</div>
											</div>
										</div>
									</Button>
								);
							})}
						</div>

						{/* Error Feedback */}
						<ErrorFeedback
							message={stepper.lastFeedback}
							onDismiss={stepper.clearFeedback}
						/>

						{/* Next Step Button */}
						{isViewingCompletedStep && hasNextStep && (
							<div className="flex justify-end">
								<Button onClick={stepper.nextStep}>
									Next Step <ArrowRight className="w-4 h-4 ml-2" />
								</Button>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodePreviewForStep(
						stepper.currentStep,
						isViewingCompletedStep,
					)}
					learningGoal="HTTP caching lets browsers and CDNs serve responses without hitting your server. The right Cache-Control header depends on who the data is for and how often it changes."
				>
					{/* Performance Comparison */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Performance Impact
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-3 rounded overflow-x-auto leading-relaxed">
							{`WITHOUT HTTP caching:
  First request:   200 OK  (21ms)
  Second request:  200 OK  (21ms)
  (same computation every time)

WITH ETag + stale?:
  First request:   200 OK  (21ms)
  Second request:  304      (6ms)
  -> 3.5x faster

WITH CDN (public data):
  Without CDN: 60-100ms (origin)
  With CDN:    ~5ms (edge server)
  -> 12-20x faster`}
						</pre>
					</div>

					{/* Cache-Control Cheat Sheet */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Cache-Control Directives
						</div>
						<div className="space-y-2.5 text-xs">
							<div className="flex items-start gap-2">
								<Globe className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
								<div>
									<span className="text-foreground font-medium font-mono">
										public
									</span>
									<span className="text-muted-foreground">
										{' '}-- CDN + browser can cache
									</span>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Lock className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
								<div>
									<span className="text-foreground font-medium font-mono">
										private
									</span>
									<span className="text-muted-foreground">
										{' '}-- browser only, no CDN
									</span>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
								<div>
									<span className="text-foreground font-medium font-mono">
										s-max-age
									</span>
									<span className="text-muted-foreground">
										{' '}-- CDN TTL (overrides max-age)
									</span>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Shield className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
								<div>
									<span className="text-foreground font-medium font-mono">
										immutable
									</span>
									<span className="text-muted-foreground">
										{' '}-- skip revalidation entirely
									</span>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Server className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
								<div>
									<span className="text-foreground font-medium font-mono">
										stale-while-revalidate
									</span>
									<span className="text-muted-foreground">
										{' '}-- serve stale, fetch in background
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Rails Helpers */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Rails Caching Helpers
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# Time-based expiration
expires_in 1.hour, public: true

# ETag (content-based)
stale?(@post)
fresh_when(@post)

# Conditional GET
if stale?(@post)
  render json: @post
end
# Auto 304 if ETag matches`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level31HTTPCaching;
