/**
 * Level 9: Authentication
 *
 * 4-step progression to add Rails 8 built-in authentication.
 * Steps: Generate Auth Scaffolding -> Choose Password Strategy ->
 *        Create Session -> Protect Endpoint
 *
 * ID: "act2-level9-authentication"
 */

import { ArrowRight, Lock, ShieldCheck, X } from 'lucide-react';
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
	{ id: 'generate-auth', title: 'Generate Auth Scaffolding' },
	{ id: 'password-strategy', title: 'Choose Password Strategy' },
	{ id: 'create-session', title: 'Create Session' },
	{ id: 'protect-endpoint', title: 'Protect Endpoint' },
];

// ---------------------------------------------------------------------------
// Step 1: Generate Auth Scaffolding (TerminalChoiceStep)
// ---------------------------------------------------------------------------

const generateAuthCommands: TerminalCommand[] = [
	{
		id: 'wrong-devise',
		label: 'rails generate devise:install',
		command: 'rails generate devise:install',
		correct: false,
		feedback:
			'Devise is a third-party gem. Rails 8 ships its own authentication generator built-in.',
	},
	{
		id: 'wrong-scaffold',
		label: 'rails generate scaffold User email password',
		command: 'rails generate scaffold User email password',
		correct: false,
		feedback:
			'That creates a full CRUD scaffold with plaintext password. Authentication needs secure password hashing, not a string column.',
	},
	{
		id: 'correct',
		label: 'bin/rails generate authentication',
		command: 'bin/rails generate authentication',
		correct: true,
	},
];

const generateAuthOutput: TerminalOutputLine[] = [
	{ text: '      create  app/models/user.rb', color: 'green' },
	{ text: '      create  app/models/session.rb', color: 'green' },
	{ text: '      create  app/models/current.rb', color: 'green' },
	{
		text: '      create  app/controllers/sessions_controller.rb',
		color: 'green',
	},
	{
		text: '      create  app/controllers/concerns/authentication.rb',
		color: 'cyan',
	},
	{
		text: '      create  db/migrate/20240101_create_users.rb',
		color: 'green',
	},
	{
		text: '      create  db/migrate/20240102_create_sessions.rb',
		color: 'green',
	},
	{ text: '      create  app/controllers/passwords_controller.rb', color: 'green' },
	{ text: '      invoke  test_unit', color: 'muted' },
];

// ---------------------------------------------------------------------------
// Step 2: Choose Password Strategy (OptionCard)
// ---------------------------------------------------------------------------

interface PasswordOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback: string;
}

const PASSWORD_OPTIONS: PasswordOption[] = [
	{
		id: 'devise',
		name: "gem 'devise'",
		description: 'Full-featured third-party authentication engine',
		correct: false,
		feedback:
			'Devise is powerful but adds complexity. Rails 8 has built-in auth. Use the framework\'s own tools first.',
	},
	{
		id: 'has-secure-password',
		name: 'has_secure_password',
		description: 'Rails built-in bcrypt integration on the model',
		correct: true,
		feedback: '',
	},
	{
		id: 'manual-bcrypt',
		name: 'BCrypt::Password.create(password)',
		description: 'Manual bcrypt hashing in the controller',
		correct: false,
		feedback:
			'Manual bcrypt calls are error-prone. Rails wraps this in a single declarative method on the model.',
	},
];

// ---------------------------------------------------------------------------
// Step 3: Create Session (TerminalChoiceStep with irb> prompt)
// ---------------------------------------------------------------------------

const createSessionCommands: TerminalCommand[] = [
	{
		id: 'wrong-cookie',
		label: 'cookies[:user_id] = user.id',
		command: 'cookies[:user_id] = user.id',
		correct: false,
		feedback:
			'Cookies are for browser apps. API clients need a token in the response body, not a cookie header.',
	},
	{
		id: 'wrong-jwt',
		label: 'JWT.encode({ user_id: user.id }, secret)',
		command: 'JWT.encode({ user_id: user.id }, secret)',
		correct: false,
		feedback:
			'JWTs are stateless and hard to revoke. Rails 8 auth uses server-side sessions stored in the database.',
	},
	{
		id: 'correct',
		label: 'session = user.sessions.create!',
		command: 'session = user.sessions.create!',
		correct: true,
	},
];

const createSessionOutput: TerminalOutputLine[] = [
	{
		text: '=> #<Session id: 1, user_id: 1, token: "abc123...def789">',
		color: 'green',
	},
	{ text: '', color: 'muted' },
	{
		text: '# Client sends: Authorization: Bearer abc123...def789',
		color: 'cyan',
	},
];

// ---------------------------------------------------------------------------
// Step 4: Protect Endpoint (OptionCard)
// ---------------------------------------------------------------------------

interface ProtectOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback: string;
}

const PROTECT_OPTIONS: ProtectOption[] = [
	{
		id: 'devise-method',
		name: 'authenticate_user!',
		description: 'Check authentication before each action',
		correct: false,
		feedback:
			"That's a Devise method. Rails 8's built-in auth concern uses a different callback name.",
	},
	{
		id: 'before-action',
		name: 'before_action :require_authentication',
		description: 'Require valid session token via the Authentication concern',
		correct: true,
		feedback: '',
	},
	{
		id: 'manual-check',
		name: 'if current_user.nil? then head :unauthorized end',
		description: 'Manually check for a user in each action',
		correct: false,
		feedback:
			'Manual nil checks in every action are repetitive. Use a before_action to protect all endpoints at once.',
	},
];

// ---------------------------------------------------------------------------
// Terminal step map (for building history across steps)
// ---------------------------------------------------------------------------

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: generateAuthCommands, outputLines: generateAuthOutput }, // step 0: terminal
	null, // step 1: OptionCard (password strategy)
	{ commands: createSessionCommands, outputLines: createSessionOutput }, // step 2: terminal
	null, // step 3: OptionCard (protect endpoint)
];

// ---------------------------------------------------------------------------
// Code preview files that evolve with progress
// ---------------------------------------------------------------------------

function getCodeFiles(furthestStep: number) {
	const files = [];

	// Initial state: unprotected model
	if (furthestStep === 0) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  # No authentication yet.
  # Endpoints are wide open.
end`,
			highlight: [],
		});
	}

	// After step 1: User model skeleton from generator
	if (furthestStep >= 1) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code:
				furthestStep >= 2
					? `class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  normalizes :email_address,
    with: ->(e) { e.strip.downcase }
end`
					: `class User < ApplicationRecord
  has_many :sessions, dependent: :destroy

  normalizes :email_address,
    with: ->(e) { e.strip.downcase }
end`,
			highlight: furthestStep >= 2 ? [2] : [],
		});
	}

	// After step 3: Session model + controller
	if (furthestStep >= 3) {
		files.push({
			filename: 'app/models/session.rb',
			language: 'ruby',
			code: `class Session < ApplicationRecord
  belongs_to :user

  before_create do
    self.token = SecureRandom.urlsafe_base64(32)
  end
end`,
			highlight: [4, 5],
		});

		files.push({
			filename: 'app/controllers/sessions_controller.rb',
			language: 'ruby',
			code: `class SessionsController < ApplicationController
  def create
    user = User.find_by(
      email_address: params[:email_address]
    )

    if user&.authenticate(params[:password])
      session = user.sessions.create!
      render json: { token: session.token }
    else
      render json: { error: "Invalid credentials" },
             status: :unauthorized
    end
  end
end`,
			highlight: [8, 9],
		});
	}

	// After step 4: Authentication concern with before_action
	if (furthestStep >= 4) {
		files.push({
			filename: 'app/controllers/concerns/authentication.rb',
			language: 'ruby',
			code: `module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
  end

  private

  def require_authentication
    session = Session.find_by(
      token: request.headers["Authorization"]
               &.delete_prefix("Bearer ")
    )
    resume_session(session)
  end

  def resume_session(session)
    Current.session = session
  end

  def current_user
    Current.session&.user
  end
end`,
			highlight: [5, 11, 12, 13, 14],
		});
	}

	return files;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Level9Authentication({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;

	// Step 2: password strategy selection
	const handlePasswordChoice = (option: PasswordOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// Step 4: protect endpoint selection
	const handleProtectChoice = (option: ProtectOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
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
		return { valid: true, message: 'Authentication is ready!' };
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your API has no authentication. Anyone can create, update,
							or delete posts without identifying themselves. Rails 8
							ships a built-in authentication generator that creates
							User and Session models, a bcrypt-backed password system,
							and a concern that protects your controllers.
						</p>
					</div>

					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress
							currentStep={stepper.currentStep}
							onStepClick={stepper.goToStep}
							steps={stepper.steps}
						/>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Authentication"
					levelNumber={9}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Generate Auth Scaffolding (TerminalChoiceStep) */}
						{stepper.currentStep === 0 && (
							<TerminalChoiceStep
								commands={generateAuthCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										Your API endpoints are wide open. Rails 8 includes
										a generator that creates everything you need:
										User model, Session model, controllers, and an
										Authentication concern. Run it.
									</p>
								}
								hasNext={hasNextStep}
								initialHistory={buildTerminalHistory(
									TERMINAL_STEP_MAP,
									stepper.currentStep,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={generateAuthOutput}
								stepKey={stepper.currentStep}
								title="Generate Auth Scaffolding"
							/>
						)}

						{/* Step 2: Choose Password Strategy (OptionCard) */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Choose Password Strategy
								</h3>
								<p className="text-sm text-muted-foreground">
									The User model needs a way to hash and verify
									passwords. Pick the approach that keeps passwords
									secure with the least amount of manual code.
								</p>

								<div className="grid gap-2">
									{PASSWORD_OPTIONS.map((option) => (
										<OptionCard
											color="blue"
											description={option.description}
											disabled={isViewingCompletedStep}
											key={option.id}
											name={option.name}
											onClick={() => handlePasswordChoice(option)}
											selected={
												isViewingCompletedStep && option.correct
											}
										/>
									))}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
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
						)}

						{/* Step 3: Create Session (TerminalChoiceStep with irb> prompt) */}
						{stepper.currentStep === 2 && (
							<TerminalChoiceStep
								commands={createSessionCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										A user just authenticated with their email and
										password. Now create a server-side session that
										generates a Bearer token for subsequent API requests.
									</p>
								}
								hasNext={hasNextStep}
								initialHistory={buildTerminalHistory(
									TERMINAL_STEP_MAP,
									stepper.currentStep,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={createSessionOutput}
								prompt="irb>"
								stepKey={stepper.currentStep}
								terminalTitle="Rails Console"
								title="Create a Session"
							/>
						)}

						{/* Step 4: Protect Endpoint (OptionCard) */}
						{stepper.currentStep === 3 && !stepper.isComplete && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Protect Your Endpoints
								</h3>
								<p className="text-sm text-muted-foreground">
									Sessions are working. Now lock down your controllers
									so only authenticated users can access them. Pick
									the callback from the Authentication concern.
								</p>

								<div className="grid gap-2">
									{PROTECT_OPTIONS.map((option) => (
										<OptionCard
											color="blue"
											description={option.description}
											disabled={isViewingCompletedStep}
											key={option.id}
											mono
											name={option.name}
											onClick={() => handleProtectChoice(option)}
											selected={
												isViewingCompletedStep && option.correct
											}
										/>
									))}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
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
										Authentication Added!
									</h3>
									<p className="text-sm text-muted-foreground">
										Your API now requires a valid session token.
										Unauthenticated requests are rejected.
									</p>
								</div>

								{/* Before / After comparison */}
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<div className="flex items-center gap-1.5 text-sm font-semibold text-red-400">
											<X className="w-4 h-4" />
											Before
										</div>
										<div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
											<div className="text-zinc-400">
												$ curl -X DELETE /api/v1/posts/1
											</div>
											<div className="text-zinc-300 mt-1">
												HTTP/1.1 204 No Content
											</div>
											<div className="text-red-400 mt-2">
												# Deleted! No token needed.
											</div>
										</div>
									</div>

									<div className="space-y-2">
										<div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
											<ShieldCheck className="w-4 h-4" />
											After
										</div>
										<div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
											<div className="text-zinc-400">
												$ curl -X DELETE /api/v1/posts/1
											</div>
											<div className="text-emerald-400 mt-1">
												HTTP/1.1 401 Unauthorized
											</div>
											<div className="text-zinc-500 mt-2">
												# Token required. Post is safe.
											</div>
										</div>
									</div>
								</div>

								{/* Key takeaways */}
								<div className="bg-card border border-border rounded-lg p-4 space-y-3">
									<div className="text-sm font-semibold text-foreground flex items-center gap-2">
										<Lock className="w-4 h-4 text-primary" />
										What Rails 8 Auth Gives You
									</div>
									<div className="text-xs text-muted-foreground space-y-1.5">
										<div>
											<span className="font-mono text-primary">has_secure_password</span>:
											bcrypt hashing with{' '}
											<span className="font-mono">authenticate</span> method
										</div>
										<div>
											<span className="font-mono text-primary">Session</span> model:
											database-backed tokens, easy to revoke
										</div>
										<div>
											<span className="font-mono text-primary">Authentication</span> concern:
											one before_action protects all endpoints
										</div>
										<div>
											<span className="font-mono text-primary">Current</span> model:
											thread-safe access to the current user
										</div>
									</div>
								</div>

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
				<CodePreviewPanel files={getCodeFiles(stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level9Authentication;
