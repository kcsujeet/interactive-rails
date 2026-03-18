/**
 * Level 41: Middleware & Rack
 *
 * 4-step progression to understand the Rack middleware stack,
 * write custom middleware, and insert it correctly.
 * Steps: Identify Position -> Write Middleware -> Choose Purpose -> Insert Middleware
 */

import { ArrowRight, CheckCircle, Layers, XCircle } from 'lucide-react';
import { useState } from 'react';
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

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_DEFS: StepDef[] = [
	{ id: 'identify-position', title: 'Identify Middleware Position' },
	{ id: 'write-middleware', title: 'Write Middleware' },
	{ id: 'choose-purpose', title: 'Choose Middleware Purpose' },
	{ id: 'insert-middleware', title: 'Insert Middleware' },
];

// ---------------------------------------------------------------------------
// Step 1: Identify Middleware Position (OptionCard, correct NOT first)
// ---------------------------------------------------------------------------

interface PositionOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback: string;
}

const POSITION_OPTIONS: PositionOption[] = [
	{
		id: 'after-executor',
		name: 'After ActionDispatch::Executor',
		description: 'Inside the Rails executor boundary',
		correct: false,
		feedback:
			'Placing it after the executor means it runs inside Rails. Cross-cutting concerns like request tracking should intercept requests before Rails processes them.',
	},
	{
		id: 'after-router',
		name: 'After the router',
		description: 'After ActionDispatch::Routing',
		correct: false,
		feedback:
			'After routing is too late. The request has already been dispatched to a controller. Middleware should process requests before they reach application code.',
	},
	{
		id: 'top-of-stack',
		name: 'Before ActionDispatch::HostAuthorization',
		description: 'At the top of the middleware stack',
		correct: true,
		feedback: '',
	},
];

// ---------------------------------------------------------------------------
// Step 2: Write Middleware (OptionCard with code, correct NOT first)
// ---------------------------------------------------------------------------

interface MiddlewareOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback: string;
}

const MIDDLEWARE_OPTIONS: MiddlewareOption[] = [
	{
		id: 'short-circuit',
		name: `def call(env)\n  [200, {}, ["OK"]]\nend`,
		description: 'Return a fixed response immediately',
		correct: false,
		feedback:
			'This short-circuits the entire stack. Every request returns 200 OK without ever reaching your app. Middleware must call the next app in the chain.',
	},
	{
		id: 'correct-pattern',
		name: `def call(env)\n  status, headers, body = @app.call(env)\n  headers["X-Request-Id"] = SecureRandom.uuid\n  [status, headers, body]\nend`,
		description: 'Call the next app, then modify the response',
		correct: true,
		feedback: '',
	},
	{
		id: 'rack-response',
		name: `def call(env)\n  response = env['rack.response']\n  response.headers["X-Request-Id"] = SecureRandom.uuid\n  response\nend`,
		description: 'Access the response from the env hash',
		correct: false,
		feedback:
			'There is no rack.response in the env hash. The env hash contains request data. Call @app.call(env) to get the response triplet.',
	},
];

// ---------------------------------------------------------------------------
// Step 3: Choose Middleware Purpose (OptionCard, correct NOT first)
// ---------------------------------------------------------------------------

interface PurposeOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback: string;
}

const PURPOSE_OPTIONS: PurposeOption[] = [
	{
		id: 'before-action',
		name: 'before_action :track_time in ApplicationController',
		description: 'Controller callback for timing',
		correct: false,
		feedback:
			'Controller callbacks only measure controller execution, not the full Rack pipeline. Middleware captures the complete request lifecycle including other middleware.',
	},
	{
		id: 'rack-runtime',
		name: 'Rack::Runtime',
		description: 'Built-in X-Runtime header middleware',
		correct: false,
		feedback:
			'Rack::Runtime is already in the stack but only sets X-Runtime. You need a custom middleware for structured logging with request ID correlation.',
	},
	{
		id: 'custom-middleware',
		name: 'Custom middleware wrapping @app.call(env)',
		description: 'Full lifecycle timing with structured logging',
		correct: true,
		feedback: '',
	},
];

// ---------------------------------------------------------------------------
// Step 4: Insert Middleware (TerminalChoiceStep, correct NOT first)
// ---------------------------------------------------------------------------

const insertCommands: TerminalCommand[] = [
	{
		id: 'use',
		label: 'config.middleware.use RequestTimer',
		command: 'config.middleware.use RequestTimer',
		correct: false,
		feedback:
			'`use` appends to the end of the stack. For request tracking, you need it near the top to capture the full lifecycle.',
	},
	{
		id: 'insert-after',
		label: 'config.middleware.insert_after 0, RequestTimer',
		command: 'config.middleware.insert_after 0, RequestTimer',
		correct: false,
		feedback:
			'`insert_after` takes a middleware class name, not an index. Use the class to specify position.',
	},
	{
		id: 'insert-before',
		label: 'config.middleware.insert_before 0, RequestTimer',
		command: 'config.middleware.insert_before 0, RequestTimer',
		correct: true,
	},
];

const insertOutput: TerminalOutputLine[] = [
	{ text: 'use RequestTimer', color: 'green' },
	{ text: 'use ActionDispatch::HostAuthorization', color: 'muted' },
	{ text: 'use Rack::Sendfile', color: 'muted' },
	{ text: 'use ActionDispatch::Executor', color: 'muted' },
	{ text: 'use ActionDispatch::Callbacks', color: 'muted' },
	{ text: 'use ActiveRecord::Migration::CheckPending', color: 'muted' },
	{ text: 'use ActionDispatch::Routing::RouteSet', color: 'muted' },
	{ text: '', color: 'muted' },
	{ text: 'RequestTimer is now at the top of the stack.', color: 'green' },
];

// ---------------------------------------------------------------------------
// Terminal step map for building history
// ---------------------------------------------------------------------------

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	null, // step 0: OptionCard (position)
	null, // step 1: OptionCard (write middleware)
	null, // step 2: OptionCard (purpose)
	{ commands: insertCommands, outputLines: insertOutput }, // step 3: terminal
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Level41Middleware({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;

	// Track selections for code preview
	const [selectedPosition, setSelectedPosition] = useState<string | null>(
		null,
	);
	const [selectedMiddleware, setSelectedMiddleware] = useState<string | null>(
		null,
	);
	const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);

	// Step 1: Position selection
	const handleSelectPosition = (option: PositionOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			setSelectedPosition(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// Step 2: Write middleware selection
	const handleSelectMiddleware = (option: MiddlewareOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			setSelectedMiddleware(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// Step 3: Purpose selection
	const handleSelectPurpose = (option: PurposeOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			setSelectedPurpose(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// Completion
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
		return { valid: true, message: 'Middleware stack is configured!' };
	};

	// Code preview that evolves with progress
	const getCodeFiles = () => {
		const files = [];

		// Initially: default middleware stack
		if (stepper.furthestStep === 0) {
			files.push({
				filename: 'bin/rails middleware',
				language: 'ruby',
				code: `# Default Rails 8 middleware stack
use ActionDispatch::HostAuthorization
use Rack::Sendfile
use ActionDispatch::Static
use ActionDispatch::Executor
use ActionDispatch::ServerTiming
use ActiveSupport::Cache::Strategy::LocalCache
use Rack::Runtime
use ActionDispatch::RequestId
use ActionDispatch::RemoteIp
use Rails::Rack::Logger
use ActionDispatch::ShowExceptions
use ActionDispatch::Callbacks
use ActiveRecord::Migration::CheckPending
use ActionDispatch::Cookies
use ActionDispatch::Session::CookieStore
use ActionDispatch::Flash
use ActionDispatch::ContentSecurityPolicy::Middleware
use ActionDispatch::PermissionsPolicy::Middleware
use Rack::Head
use Rack::ConditionalGet
use Rack::ETag
use Rack::TempfileReaper
run MyApp::Application.routes`,
				highlight: [],
			});
		}

		// After step 1: show where custom middleware goes
		if (stepper.furthestStep >= 1 && stepper.furthestStep < 2) {
			files.push({
				filename: 'bin/rails middleware',
				language: 'ruby',
				code: `# Custom middleware goes at the TOP
use RequestTimer              # <-- HERE (before everything)
use ActionDispatch::HostAuthorization
use Rack::Sendfile
use ActionDispatch::Static
use ActionDispatch::Executor
use Rack::Runtime
use ActionDispatch::RequestId
use Rails::Rack::Logger
use ActionDispatch::ShowExceptions
use ActionDispatch::Callbacks
use ActiveRecord::Migration::CheckPending
# ... rest of stack
run MyApp::Application.routes`,
				highlight: [2],
			});
		}

		// After step 2: full RequestTimer middleware class
		if (stepper.furthestStep >= 2) {
			files.push({
				filename: 'app/middleware/request_timer.rb',
				language: 'ruby',
				code: `class RequestTimer
  def initialize(app)
    @app = app
  end

  def call(env)
    start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    request_id = SecureRandom.uuid

    # Pass request down the stack
    status, headers, body = @app.call(env)

    # Measure total time
    duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start

    # Attach tracking headers
    headers["X-Request-Id"] = request_id
    headers["X-Request-Time"] = "%.4f" % duration

    [status, headers, body]
  end
end`,
				highlight: [6, 7, 8, 11, 14, 17, 18],
			});
		}

		// After step 3: add RequestLogger middleware
		if (stepper.furthestStep >= 3) {
			files.push({
				filename: 'app/middleware/request_logger.rb',
				language: 'ruby',
				code: `class RequestLogger
  def initialize(app)
    @app = app
  end

  def call(env)
    start = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    status, headers, body = @app.call(env)

    duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start

    # Structured JSON logging
    Rails.logger.info({
      method: env["REQUEST_METHOD"],
      path: env["PATH_INFO"],
      status: status,
      duration_ms: (duration * 1000).round(2),
      request_id: headers["X-Request-Id"],
      ip: env["REMOTE_ADDR"]
    }.to_json)

    [status, headers, body]
  end
end`,
				highlight: [14, 15, 16, 17, 18, 19, 20, 21, 22],
			});
		}

		// After step 4: config/application.rb with insert_before
		if (stepper.furthestStep >= 4) {
			files.push({
				filename: 'config/application.rb',
				language: 'ruby',
				code: `module MyApp
  class Application < Rails::Application
    config.load_defaults 8.0

    # Insert custom middleware at the top of the stack
    config.middleware.insert_before 0, RequestTimer
    config.middleware.insert_before 0, RequestLogger

    config.api_only = true
  end
end`,
				highlight: [6, 7],
			});
		}

		return files;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<div className="flex items-center gap-2 mb-2">
							<Layers className="w-4 h-4 text-primary" />
							<span className="text-xs font-semibold text-primary uppercase tracking-wider">
								The Problem
							</span>
						</div>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your Rails app has no request tracking, no structured
							logging, and no way to correlate logs across services.
							Bots slip through undetected. When something breaks,
							debugging is a nightmare because there is no request ID
							to trace.
						</p>
					</div>

					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress steps={stepper.steps} />
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Middleware & Rack"
					levelNumber={40}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Identify Middleware Position */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Identify Middleware Position
								</h3>
								<p className="text-sm text-muted-foreground">
									Where in the Rack stack should custom request tracking
									middleware go?
								</p>

								<div className="grid gap-2">
									{POSITION_OPTIONS.map((opt) => (
										<OptionCard
											color="blue"
											description={opt.description}
											disabled={isViewingCompletedStep}
											key={opt.id}
											name={opt.name}
											onClick={() => handleSelectPosition(opt)}
											selected={selectedPosition === opt.id}
										/>
									))}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button onClick={stepper.nextStep}>
											Next Step <ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 2: Write Middleware */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Write Middleware
								</h3>
								<p className="text-sm text-muted-foreground">
									A Rack middleware receives an env hash and must return a
									response triplet: [status, headers, body]. Pick the
									correct <span className="font-mono text-primary">call(env)</span> pattern
									that adds a custom header without breaking the chain.
								</p>

								<div className="grid gap-2">
									{MIDDLEWARE_OPTIONS.map((opt) => (
										<OptionCard
											color="blue"
											description={opt.description}
											disabled={isViewingCompletedStep}
											key={opt.id}
											mono
											name={opt.name}
											onClick={() => handleSelectMiddleware(opt)}
											selected={selectedMiddleware === opt.id}
										/>
									))}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button onClick={stepper.nextStep}>
											Next Step <ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 3: Choose Middleware Purpose */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Choose Middleware Purpose
								</h3>
								<p className="text-sm text-muted-foreground">
									You need full request lifecycle timing with structured
									logging and request ID correlation. Which approach
									captures the complete Rack pipeline, not just the
									controller?
								</p>

								<div className="grid gap-2">
									{PURPOSE_OPTIONS.map((opt) => (
										<OptionCard
											color="blue"
											description={opt.description}
											disabled={isViewingCompletedStep}
											key={opt.id}
											mono
											name={opt.name}
											onClick={() => handleSelectPurpose(opt)}
											selected={selectedPurpose === opt.id}
										/>
									))}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button onClick={stepper.nextStep}>
											Next Step <ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 4: Insert Middleware */}
						{stepper.currentStep === 3 && (
							<TerminalChoiceStep
								commands={insertCommands}
								completed={stepper.currentStep < stepper.furthestStep}
								description={
									<p className="text-sm text-muted-foreground">
										Your RequestTimer middleware is written. Now register
										it in config/application.rb. You want it at the very
										top of the stack so it captures the full request
										lifecycle.
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
								outputLines={insertOutput}
								stepKey={stepper.currentStep}
								title="Insert Middleware"
							/>
						)}

						{/* ADVANTAGE phase: Before/After comparison */}
						{stepper.isComplete && (
							<div className="space-y-6 py-6">
								<div className="text-center space-y-2">
									<div className="text-4xl">
										{'★'.repeat(stepper.starRating)}
										{'☆'.repeat(3 - stepper.starRating)}
									</div>
									<h3 className="text-xl font-bold text-foreground">
										Middleware Stack Configured!
									</h3>
								</div>

								{/* Before / After comparison */}
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<div className="flex items-center gap-1.5 text-sm font-semibold text-red-400">
											<XCircle className="w-4 h-4" />
											Before
										</div>
										<div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
											<div className="text-zinc-400">
												HTTP/1.1 200 OK
											</div>
											<div className="text-zinc-500">
												Content-Type: application/json
											</div>
											<div className="text-zinc-500">
												Cache-Control: no-cache
											</div>
											<div className="text-zinc-600 mt-2 text-[11px]">
												No request ID. No timing. No structured log.
											</div>
											<div className="text-zinc-600 text-[11px]">
												Debugging requires searching raw logs manually.
											</div>
										</div>
									</div>

									<div className="space-y-2">
										<div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
											<CheckCircle className="w-4 h-4" />
											After
										</div>
										<div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
											<div className="text-zinc-400">
												HTTP/1.1 200 OK
											</div>
											<div className="text-emerald-400">
												X-Request-Id: a3f8b2c1-...
											</div>
											<div className="text-emerald-400">
												X-Request-Time: 0.0234
											</div>
											<div className="text-zinc-500">
												Content-Type: application/json
											</div>
											<div className="text-zinc-300 mt-2 text-[11px]">
												Structured log:
											</div>
											<div className="text-amber-400 text-[11px] ml-2">
												{`{"method":"GET","path":"/api/v1/products",`}
											</div>
											<div className="text-amber-400 text-[11px] ml-2">
												{` "status":200,"duration_ms":23.4,`}
											</div>
											<div className="text-amber-400 text-[11px] ml-2">
												{` "request_id":"a3f8b2c1-..."}`}
											</div>
										</div>
									</div>
								</div>

								<p className="text-sm text-muted-foreground text-center">
									Every request now has a unique ID, precise timing, and
									a structured JSON log line. Correlate logs across
									services, trace slow requests, and detect anomalies
									automatically.
								</p>

								<div className="flex justify-center">
									<Button onClick={handleComplete}>
										Complete Level
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles()}>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Rack Middleware Basics
						</div>
						<ul className="text-xs text-muted-foreground space-y-2">
							<li>
								<span className="font-mono text-primary">initialize(app)</span>{' '}
								stores reference to the next middleware
							</li>
							<li>
								<span className="font-mono text-primary">call(env)</span>{' '}
								receives the request env hash
							</li>
							<li>
								<span className="font-mono text-primary">@app.call(env)</span>{' '}
								passes request down the chain
							</li>
							<li>
								<span className="font-mono text-primary">[status, headers, body]</span>{' '}
								the response triplet
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Middleware Insertion
						</div>
						<ul className="text-xs text-muted-foreground space-y-2">
							<li>
								<span className="font-mono text-primary">insert_before</span>{' '}
								add before a specific middleware
							</li>
							<li>
								<span className="font-mono text-primary">insert_after</span>{' '}
								add after a specific middleware
							</li>
							<li>
								<span className="font-mono text-primary">use</span>{' '}
								append to the end of the stack
							</li>
							<li>
								<span className="font-mono text-primary">delete</span>{' '}
								remove a middleware from the stack
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Common Middleware
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>
								<span className="text-primary">Rack::Runtime</span>{' '}
								adds X-Runtime header
							</li>
							<li>
								<span className="text-primary">ActionDispatch::RequestId</span>{' '}
								sets X-Request-Id
							</li>
							<li>
								<span className="text-primary">Rails::Rack::Logger</span>{' '}
								request logging
							</li>
							<li>
								<span className="text-primary">Rack::Sendfile</span>{' '}
								efficient file serving
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level41Middleware;
