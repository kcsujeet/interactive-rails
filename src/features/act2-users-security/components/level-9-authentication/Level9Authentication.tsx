/**
 * Level 9: Authentication
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   inspect code, fire API probes to discover that anyone can hit any endpoint.
 *   Discovery gating controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 5 steps building Rails 8 built-in authentication.
 *   Step 0: Generate Auth Scaffolding (terminal)
 *   Step 1: Run Migrations (terminal)
 *   Step 2: Choose Password Strategy (OptionCard)
 *   Step 3: Create Session (terminal, irb> prompt)
 *   Step 4: Protect Endpoint (OptionCard)
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire request scenarios at the
 *   protected pipeline and watch authenticated/rejected results.
 *
 * Teaches: Rails 8 auth generator, has_secure_password, Bearer tokens,
 *   require_authentication concern
 *
 * ID: "act2-level9-authentication"
 */

import { ArrowRight, Check, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
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

registerLevelCode('act2-level9-authentication', () =>
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
	{ id: 'no-auth-layer', label: 'No authentication layer exists' },
	{ id: 'anonymous-delete', label: 'Anonymous users can delete products' },
	{ id: 'anonymous-create', label: 'Anonymous users can create products' },
	{ id: 'no-user-identity', label: 'No way to know who made a request' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'delete-no-token',
		label: 'DELETE without token',
		command: 'DELETE /api/v1/products/1 (no Authorization header)',
		responseLines: [
			{ text: 'HTTP/1.1 204 No Content', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'Product #1 deleted. No token was required.', color: 'yellow' },
			{
				text: 'Anyone on the internet can destroy your data.',
				color: 'red',
			},
		],
		story: [
			'An anonymous visitor sends a DELETE request to the products API.',
			'No Authorization header is included in the request.',
			'The controller does not check for a session or token.',
			'Product #1 is permanently destroyed. No identity was ever verified.',
		],
	},
	{
		id: 'create-no-token',
		label: 'POST without token',
		command: 'POST /api/v1/products (no Authorization header)',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{
				text: '{"id":99,"name":"Spam","user_id":null}',
				color: 'muted',
			},
			{
				text: 'Product created with no user attached. Who added it? Nobody knows.',
				color: 'yellow',
			},
		],
		story: [
			'A bot sends a POST request to create a new product.',
			'No login session or API token is attached to the request.',
			'The controller saves the product with user_id: null.',
			'A spam product now exists in the database with no traceable seller.',
		],
	},
	{
		id: 'check-identity',
		label: 'Check current_user',
		command: 'GET /api/v1/me (who am I?)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{
				text: '{"current_user":null}',
				color: 'muted',
			},
			{
				text: 'No user identity. The app cannot tell requests apart.',
				color: 'yellow',
			},
		],
		story: [
			'A logged-in user calls the /me endpoint to check their identity.',
			'The controller has no way to look up the current session.',
			'current_user returns null for every request.',
			'The app treats every visitor as the same anonymous entity.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'delete-no-token': 'anonymous-delete',
	'create-no-token': 'anonymous-create',
	'check-identity': 'no-user-identity',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ authSublabel: string; modelBadge: string }
> = {
	'delete-no-token': {
		authSublabel: 'DELETE anon',
		modelBadge: '204!',
	},
	'create-no-token': {
		authSublabel: 'POST anon',
		modelBadge: '201!',
	},
	'check-identity': {
		authSublabel: 'GET anon',
		modelBadge: 'null!',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	request: {
		stageId: 'request',
		title: 'Incoming Request',
		description:
			'HTTP requests arrive with no Authorization header. There is no way to identify who is making the request. Every request is anonymous.',
	},
	auth: {
		stageId: 'auth',
		title: 'Authentication (Missing!)',
		description:
			'This layer does not exist yet. There is no User model, no Session model, and no token verification. Requests pass straight through to the controller without any identity check.',
	},
	controller: {
		stageId: 'controller',
		title: 'ProductsController',
		description:
			'The controller processes every request blindly. It cannot tell if the requester is a logged-in user, an admin, or a random stranger. current_user is always nil.',
		code: `class ProductsController < ApplicationController
  def destroy
    product = Product.find(params[:id])
    product.destroy  # Who deleted this? No idea.
    head :no_content
  end
end`,
	},
	model: {
		stageId: 'model',
		title: 'Product Model',
		description:
			'The model executes every operation the controller asks for. Products are created with user_id: nil because there is no authenticated user to attach.',
	},
};

// Map stage IDs to discovery IDs they trigger.
// Pedagogy rule: every discovery should be unlocked by exactly one source.
// `no-user-identity` is owned by the check-identity probe; the controller
// stage only motivates the inspection, it does not duplicate-unlock.
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	auth: 'no-auth-layer',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'valid-get',
		label: 'GET with valid token',
		description: 'Authenticated user fetches products',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'user_1 (valid token)',
		expectedResult: 'allowed',
	},
	{
		id: 'valid-create',
		label: 'POST with valid token',
		description: 'Authenticated user creates a product',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'user_1 (valid token)',
		expectedResult: 'allowed',
	},
	{
		id: 'delete-no-token',
		label: 'DELETE without token',
		description: 'Anonymous request tries to delete',
		method: 'DELETE',
		path: '/api/v1/products/1',
		actor: 'anonymous (no token)',
		expectedResult: 'blocked',
	},
	{
		id: 'create-no-token',
		label: 'POST without token',
		description: 'Anonymous request tries to create a product',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'anonymous (no token)',
		expectedResult: 'blocked',
	},
	{
		id: 'check-identity',
		label: 'Check current_user',
		description: 'Anonymous request checks identity endpoint',
		method: 'GET',
		path: '/api/v1/me',
		actor: 'anonymous (no token)',
		expectedResult: 'blocked',
	},
	{
		id: 'expired-token',
		label: 'PATCH with expired token',
		description: 'Revoked session token tries to update',
		method: 'PATCH',
		path: '/api/v1/products/1',
		actor: 'user_2 (expired token)',
		expectedResult: 'blocked',
	},
	{
		id: 'valid-delete',
		label: 'DELETE with valid token',
		description: 'Authenticated user deletes own product',
		method: 'DELETE',
		path: '/api/v1/products/5',
		actor: 'user_1 (valid token)',
		expectedResult: 'allowed',
	},
];

// ──────────────────────────────────────────────
// Step definitions (build phase)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-auth', title: 'Generate Auth Scaffolding' },
	{ id: 'run-migrations', title: 'Run Migrations' },
	{ id: 'password-strategy', title: 'Choose Password Strategy' },
	{ id: 'create-session', title: 'Create Session' },
	{ id: 'protect-endpoint', title: 'Protect Endpoint' },
];

// ──────────────────────────────────────────────
// Step 0: Generate Auth Scaffolding (Terminal)
// ──────────────────────────────────────────────

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
		id: 'correct',
		label: 'bin/rails generate authentication',
		command: 'bin/rails generate authentication',
		correct: true,
	},
	{
		id: 'wrong-scaffold',
		label: 'rails generate scaffold User email password',
		command: 'rails generate scaffold User email password',
		correct: false,
		feedback:
			'That creates a full CRUD scaffold with plaintext password. Authentication needs secure password hashing, not a string column.',
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
		text: '      create  app/controllers/passwords_controller.rb',
		color: 'green',
	},
	{
		text: '      create  app/controllers/concerns/authentication.rb',
		color: 'cyan',
	},
	{ text: '      create  app/mailers/passwords_mailer.rb', color: 'green' },
	{ text: '        gsub  Gemfile', color: 'yellow' },
	{
		text: '        gsub  app/controllers/application_controller.rb',
		color: 'yellow',
	},
	{ text: '         run  bundle install --quiet', color: 'muted' },
	{
		text: '      create  db/migrate/<timestamp>_create_users.rb',
		color: 'green',
	},
	{
		text: '      create  db/migrate/<timestamp>_create_sessions.rb',
		color: 'green',
	},
	{ text: '      invoke  test_unit', color: 'muted' },
];

// ──────────────────────────────────────────────
// Step 1: Run Migrations (Terminal)
// ──────────────────────────────────────────────

const runMigrationsCommands: TerminalCommand[] = [
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		command: 'rails db:seed',
		correct: false,
		feedback:
			'Seeds populate data, but the tables do not exist yet. The generator created migration files that need to run first.',
	},
	{
		id: 'wrong-setup',
		label: 'rails db:setup',
		command: 'rails db:setup',
		correct: false,
		feedback:
			'db:setup creates the database from schema.rb. You already have a database. You need to run the new migration files the generator just created.',
	},
	{
		id: 'correct',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
];

const runMigrationsOutput: TerminalOutputLine[] = [
	{
		text: '== <timestamp> CreateUsers: migrating ===========================',
		color: 'green',
	},
	{
		text: '-- create_table(:users)',
		color: 'muted',
	},
	{ text: '   -> 0.0152s', color: 'muted' },
	{
		text: '-- add_index(:users, :email_address, {unique: true})',
		color: 'muted',
	},
	{ text: '   -> 0.0026s', color: 'muted' },
	{
		text: '== <timestamp> CreateSessions: migrating ========================',
		color: 'green',
	},
	{
		text: '-- create_table(:sessions)',
		color: 'muted',
	},
	{ text: '   -> 0.0135s', color: 'muted' },
];

// ──────────────────────────────────────────────
// Step 2: Choose Password Strategy (OptionCard)
// ──────────────────────────────────────────────

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
			"Devise is powerful but adds complexity. Rails 8 has built-in auth. Use the framework's own tools first.",
	},
	{
		id: 'manual-bcrypt',
		name: 'BCrypt::Password.create(password)',
		description: 'Manual bcrypt hashing in the controller',
		correct: false,
		feedback:
			'Manual bcrypt calls are error-prone. Rails wraps this in a single declarative method on the model.',
	},
	{
		id: 'has-secure-password',
		name: 'has_secure_password',
		description: 'Rails built-in bcrypt integration on the model',
		correct: true,
		feedback: '',
	},
];

// ──────────────────────────────────────────────
// Step 3: Create Session (Terminal, irb> prompt)
// ──────────────────────────────────────────────

const createSessionCommands: TerminalCommand[] = [
	{
		id: 'wrong-cookie',
		label: 'cookies[:user_id] = user.id',
		command: 'cookies[:user_id] = user.id',
		correct: false,
		feedback:
			'API-only Rails apps do not include cookie middleware by default. Even if they did, an API needs a token the client can attach to subsequent requests.',
	},
	{
		id: 'correct',
		label: 'session = user.sessions.create!',
		command: 'session = user.sessions.create!',
		correct: true,
	},
	{
		id: 'wrong-jwt',
		label: 'JWT.encode({ user_id: user.id }, secret)',
		command: 'JWT.encode({ user_id: user.id }, secret)',
		correct: false,
		feedback:
			'JWTs are stateless and hard to revoke. Rails 8 auth uses server-side sessions stored in the database.',
	},
];

const createSessionOutput: TerminalOutputLine[] = [
	{
		text: '=> #<Session id: 1, user_id: 1, token: "zLZXLu8KZiQTRbY...">',
		color: 'green',
	},
	{ text: '', color: 'muted' },
	{
		text: '# `before_create` on the Session model fills in the token via',
		color: 'cyan',
	},
	{
		text: '# SecureRandom.urlsafe_base64(32). The client sends it back as',
		color: 'cyan',
	},
	{
		text: '# `Authorization: Bearer <token>` on subsequent requests.',
		color: 'cyan',
	},
];

// ──────────────────────────────────────────────
// Step 4: Protect Endpoint (OptionCard)
// ──────────────────────────────────────────────

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
		id: 'manual-check',
		name: 'if current_user.nil? then head :unauthorized end',
		description: 'Manually check for a user in each action',
		correct: false,
		feedback:
			'Manual nil checks in every action are repetitive. Use a before_action to protect all endpoints at once.',
	},
	{
		id: 'before-action',
		name: 'before_action :require_authentication',
		description: 'Require valid session token via the Authentication concern',
		correct: true,
		feedback: '',
	},
];

// ──────────────────────────────────────────────
// Terminal step maps
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: generateAuthCommands, outputLines: generateAuthOutput },
	{ commands: runMigrationsCommands, outputLines: runMigrationsOutput },
];

const CONSOLE_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: createSessionCommands, outputLines: createSessionOutput },
];

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'auth', dots: 'mixed' },
	{ from: 'auth', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'model', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'auth', dots: 'mixed' },
	{ from: 'auth', to: 'controller', dots: 'clean' },
	{ from: 'controller', to: 'model', dots: 'clean' },
];

// All edges in the request lifecycle. Probes (observe) and stress scenarios
// (reward) both fire a single request that traverses the same path. Pass to
// `activeConnections` only when something has fired; otherwise pass `[]` so
// edges stay dormant per the dormant-edges-default rule.
const REQUEST_LIFECYCLE_EDGES: readonly string[] = [
	'request-auth',
	'auth-controller',
	'controller-model',
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the unprotected controller
	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/products_controller.rb',
			language: 'ruby',
			code: `class ProductsController < ApplicationController
  # No authentication. Anyone can do anything.

  def create
    product = Product.create!(product_params)
    render json: product, status: :created
  end

  def destroy
    Product.find(params[:id]).destroy
    head :no_content
  end
end`,
			highlight: [2],
		});
		return files;
	}

	// Build / reward phases: evolving code
	if (furthestStep <= 1) {
		files.push({
			filename: 'app/controllers/products_controller.rb',
			language: 'ruby',
			code: `class ProductsController < ApplicationController
  # No authentication. Anyone can do anything.

  def create
    product = Product.create!(product_params)
    render json: product, status: :created
  end

  def destroy
    Product.find(params[:id]).destroy
    head :no_content
  end
end`,
			highlight: [2],
		});
	}

	// After step 1 (db:migrate): User model from the auth generator. The
	// generator already includes has_secure_password (it adds bcrypt to the
	// Gemfile and the model line in one shot), plus a normalizes call on
	// email_address and the has_many :sessions association.
	if (furthestStep >= 2) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  normalizes :email_address, with: ->(e) { e.strip.downcase }
end`,
			highlight: [2],
		});
	}

	// After step 3 (create session): Session model with the customized
	// before_create token generator (the generator's default Session has no
	// token column; this level adds one + the callback).
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
  allow_unauthenticated_access only: :create

  def create
    user = User.authenticate_by(params.permit(:email_address, :password))

    if user
      session = user.sessions.create!(
        ip_address: request.remote_ip,
        user_agent: request.user_agent,
      )
      render json: { token: session.token }, status: :created
    else
      render json: { error: "Invalid email or password" }, status: :unauthorized
    end
  end

  def destroy
    Current.session.destroy
    head :no_content
  end
end`,
			highlight: [5, 12],
		});
	}

	// After step 4 (protect endpoint): the customized Authentication concern
	// that reads the bearer token from the Authorization header (replacing
	// the generator's cookie-based default, which does not work in API-only
	// mode without cookie middleware).
	if (furthestStep >= 4) {
		files.push({
			filename: 'app/controllers/concerns/authentication.rb',
			language: 'ruby',
			code: `module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
  end

  class_methods do
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private

  def require_authentication
    Current.session = find_session_by_bearer_token
    head :unauthorized unless Current.session
  end

  def find_session_by_bearer_token
    auth = request.headers["Authorization"]
    return nil unless auth&.start_with?("Bearer ")

    token = auth.delete_prefix("Bearer ")
    Session.find_by(token: token)
  end

  def current_user
    Current.session&.user
  end
end`,
			highlight: [5, 16, 21, 22, 23, 24, 25, 26],
		});
	}

	return files;
}

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
						Authenticated request (passes)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Unauthenticated request (rejected)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level9Authentication({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);
	// Increments on every probe / scenario fire so PipelineFlow re-runs the
	// single-pass dot animation. Default `activeConnections=[]` keeps edges
	// dormant until the player triggers something.
	const [animationTick, setAnimationTick] = useState(0);

	// ── Build observe stages dynamically (tracks inspected + last probe) ──
	const probeDisplay = lastProbeId ? PROBE_PIPELINE_MAP[lastProbeId] : null;
	const observeStages: PipelineStage[] = useMemo(
		() => [
			{
				id: 'request',
				label: 'Request',
				inspectable: true,
				inspected: inspectedStages.has('request'),
			},
			{
				id: 'auth',
				label: 'Auth',
				sublabel: probeDisplay ? probeDisplay.authSublabel : '(missing)',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('auth'),
			},
			{
				id: 'controller',
				label: 'Controller',
				sublabel: probeDisplay ? 'no current_user' : undefined,
				variant: probeDisplay ? ('danger' as const) : ('default' as const),
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'model',
				label: 'Model',
				badge: probeDisplay ? probeDisplay.modelBadge : undefined,
				variant: probeDisplay ? ('danger' as const) : ('default' as const),
				inspectable: true,
				inspected: inspectedStages.has('model'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		return [
			{ id: 'request', label: 'Request' },
			{
				id: 'auth',
				label: 'Auth',
				sublabel: wasBlocked ? '401 Unauthorized' : 'Token valid',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'BLOCKED' : undefined,
			},
			{ id: 'controller', label: 'Controller' },
			{ id: 'model', label: 'Model' },
		];
	}, [lastResult]);

	// ── Stage click handler (observe phase) ──
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

			// Trigger discovery if this stage has one
			const discoveryId = STAGE_DISCOVERY_MAP[stageId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, discoveryGating],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			setAnimationTick((t) => t + 1);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[discoveryGating],
	);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	// ── Step handlers ──
	const handlePasswordChoice = useCallback(
		(option: PasswordOption) => {
			if (stepper.isCurrentStepCompleted) return;
			if (option.correct) {
				stepper.completeStep();
			} else {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	const handleProtectChoice = useCallback(
		(option: ProtectOption) => {
			if (stepper.isCurrentStepCompleted) return;
			if (option.correct) {
				stepper.completeStep();
			} else {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			setAnimationTick((t) => t + 1);
		},
		[stressTest],
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
		return { valid: true, message: 'Authentication is ready!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;

	// Shuffle OptionCard options per step
	const shuffledPasswordOptions = useMemo(
		() => shuffleOptions(PASSWORD_OPTIONS, 2),
		[],
	);
	const shuffledProtectOptions = useMemo(
		() => shuffleOptions(PROTECT_OPTIONS, 4),
		[],
	);

	// Code preview index: show result of previous steps while working, current step after completing
	const codePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

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
							Your API has no authentication. Anyone can create, update, or
							delete products without identifying themselves. There is no User
							model, no sessions, and no token verification.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Rails 8 ships a built-in authentication generator that creates
							User and Session models, a bcrypt-backed password system, and a
							concern that protects your controllers.
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

					{/* Reward phase: legend + counters */}
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
					levelName="Authentication"
					levelNumber={9}
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
									activeConnections={
										lastProbeId ? [...REQUEST_LIFECYCLE_EDGES] : []
									}
									animationTick={animationTick}
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

							{/* Probe terminal */}
							<div className="px-6 pb-2">
								<ProbeTerminal
									onProbe={handleProbe}
									probes={PROBES}
									title="API Probe"
								/>
							</div>

							{/* Build the Fix button (discovery gated) */}
							{discoveryGating.isUnlocked && (
								<div className="p-4 flex justify-center animate-in fade-in duration-500">
									<Button
										className="gap-2"
										onClick={handleStartBuild}
										size="lg"
									>
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								</div>
							)}
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-6">
								{/* Step 0: Generate Auth Scaffolding (Terminal) */}
								{stepper.currentStep === 0 && (
									<TerminalChoiceStep
										commands={generateAuthCommands}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												Your API endpoints are wide open. Rails 8 includes a
												generator that creates everything you need: User model,
												Session model, controllers, and an Authentication
												concern. Run it.
											</p>
										}
										hasNext={hasNextStep}
										initialHistory={buildTerminalHistory(SHELL_STEP_MAP, 0)}
										onCorrect={() => stepper.completeStep()}
										onNext={stepper.nextStep}
										onWrong={(fb) => stepper.recordWrongAttempt(fb)}
										outputLines={generateAuthOutput}
										stepKey={stepper.currentStep}
										title="Generate Auth Scaffolding"
									/>
								)}

								{/* Step 1: Run Migrations (Terminal) */}
								{stepper.currentStep === 1 && (
									<TerminalChoiceStep
										commands={runMigrationsCommands}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												The generator created migration files for the users and
												sessions tables. The tables do not exist in the database
												yet. Run the migrations.
											</p>
										}
										hasNext={hasNextStep}
										initialHistory={buildTerminalHistory(SHELL_STEP_MAP, 1)}
										onCorrect={() => stepper.completeStep()}
										onNext={stepper.nextStep}
										onWrong={(fb) => stepper.recordWrongAttempt(fb)}
										outputLines={runMigrationsOutput}
										stepKey={stepper.currentStep}
										title="Run Migrations"
									/>
								)}

								{/* Step 2: Choose Password Strategy (OptionCard) */}
								{stepper.currentStep === 2 && (
									<div className="space-y-4">
										<h3 className="text-lg font-semibold text-foreground">
											Choose Password Strategy
										</h3>
										<p className="text-sm text-muted-foreground">
											The User model needs a way to hash and verify passwords.
											Pick the approach that keeps passwords secure with the
											least amount of manual code.
										</p>

										<div className="grid gap-2">
											{shuffledPasswordOptions.map((option) => (
												<OptionCard
													color="blue"
													description={option.description}
													disabled={isViewingCompletedStep}
													key={option.id}
													name={option.name}
													onClick={() => handlePasswordChoice(option)}
													selected={isViewingCompletedStep && option.correct}
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

								{/* Step 3: Create Session (Terminal, irb> prompt) */}
								{stepper.currentStep === 3 && (
									<TerminalChoiceStep
										commands={createSessionCommands}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												A user just authenticated with their email and password.
												Now create a server-side session that generates a Bearer
												token for subsequent API requests.
											</p>
										}
										hasNext={hasNextStep}
										initialHistory={buildTerminalHistory(CONSOLE_STEP_MAP, 0)}
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
								{stepper.currentStep === 4 && (
									<div className="space-y-4">
										<h3 className="text-lg font-semibold text-foreground">
											Protect Your Endpoints
										</h3>
										<p className="text-sm text-muted-foreground">
											Sessions are working. Now lock down your controllers so
											only authenticated users can access them. Pick the
											callback from the Authentication concern.
										</p>

										<div className="grid gap-2">
											{shuffledProtectOptions.map((option) => (
												<OptionCard
													color="blue"
													description={option.description}
													disabled={isViewingCompletedStep}
													key={option.id}
													mono
													name={option.name}
													onClick={() => handleProtectChoice(option)}
													selected={isViewingCompletedStep && option.correct}
												/>
											))}
										</div>

										<ErrorFeedback
											message={stepper.lastFeedback}
											onDismiss={stepper.clearFeedback}
										/>
										{isViewingCompletedStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={() => {
														setPhase('reward');
														stressTest.reset();
													}}
													size="sm"
												>
													Next Step
													<ArrowRight className="w-4 h-4" />
												</Button>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									activeConnections={
										lastResult ? [...REQUEST_LIFECYCLE_EDGES] : []
									}
									animationTick={animationTick}
									connections={REWARD_CONNECTIONS}
									stages={rewardStages}
								/>
							</div>

							{/* Stress test controls below pipeline */}
							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
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
						phase === 'reward' ? STEP_DEFS.length : codePreviewStep,
					)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level9Authentication;
