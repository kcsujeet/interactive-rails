/**
 * Level 12: Authorization
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   inspect code, fire API probes to discover vulnerabilities. Discovery gating
 *   controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 7 steps (2 terminal + 5 OptionCard) building a Pundit ProductPolicy
 *   Step 0: bundle add pundit (terminal)
 *   Step 1: include Pundit::Authorization in ApplicationController (OptionCard)
 *   Step 2: rails generate pundit:install (terminal)
 *   Step 3: Choose the Policy Class (OptionCard)
 *   Step 4: Define the destroy? Method (OptionCard)
 *   Step 5: Wire Up the Controller (OptionCard)
 *   Step 6: Scope the Index Query (OptionCard)
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire request scenarios at the
 *   protected pipeline and watch allowed/blocked results.
 *
 * Teaches: Pundit policies, authorize, policy_scope, rescue_from
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
import { registerLevelCode } from '@/features/codebase-viewer/utils/codebase-registry';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act2-level12-authorization', () =>
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
	{ id: 'no-policy', label: 'No authorization policy exists' },
	{ id: 'any-delete', label: 'Any user can delete any post' },
	{ id: 'index-leaks', label: 'Index returns all products including drafts' },
	{ id: 'no-authorize', label: 'Controller has no authorize call' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'delete-nonowner',
		label: 'DELETE as non-owner',
		command: 'DELETE /api/v1/products/42 (as user_7, not the owner)',
		responseLines: [
			{ text: 'HTTP/1.1 204 No Content', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Product #42 deleted. user_7 was NOT the owner.',
				color: 'yellow',
			},
			{
				text: 'No permission check ran. Any user can delete any post.',
				color: 'red',
			},
		],
		story: [
			'user_7 sends a DELETE request for product #42, which belongs to user_3.',
			'The controller finds the product by ID but never checks ownership.',
			'Product.find(42).destroy! runs without any authorization gate.',
			"user_3's product is permanently deleted by someone who had no right to touch it.",
		],
	},
	{
		id: 'get-drafts',
		label: 'GET drafts as stranger',
		command: 'GET /api/v1/products (as visitor, no auth)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{
				text: '[{"id":1,"title":"Draft: Secret Launch","published":false},',
				color: 'muted',
			},
			{
				text: ' {"id":2,"title":"Internal Roadmap","published":false},',
				color: 'muted',
			},
			{
				text: ' {"id":3,"title":"Featured Product","published":true}]',
				color: 'muted',
			},
			{
				text: 'Product.all returns everything. Drafts are visible to anyone.',
				color: 'yellow',
			},
		],
		story: [
			'An unauthenticated visitor hits the products index endpoint.',
			'The controller runs Product.all with no scope filtering.',
			'Draft products ("Secret Launch", "Internal Roadmap") are included in the response.',
			'Confidential product listings are exposed to the public internet.',
		],
	},
	{
		id: 'patch-nonowner',
		label: 'PATCH as non-owner',
		command: 'PATCH /api/v1/products/42 (as user_7, body: {title: "Hacked"})',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{
				text: '{"id":42,"title":"Hacked","user_id":3}',
				color: 'muted',
			},
			{
				text: "user_7 edited user_3's post. No ownership check.",
				color: 'yellow',
			},
		],
		story: [
			'user_7 sends a PATCH request to update product #42, owned by user_3.',
			'The controller finds the product and applies the update without checking ownership.',
			'The title is overwritten to "Hacked" while user_id stays as user_3.',
			"Any authenticated user can modify any other user's product listings.",
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'delete-nonowner': 'any-delete',
	'get-drafts': 'index-leaks',
	'patch-nonowner': 'no-authorize',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ policySublabel: string; modelBadge: string }
> = {
	'delete-nonowner': {
		policySublabel: 'DELETE user_7',
		modelBadge: '204!',
	},
	'get-drafts': {
		policySublabel: 'GET visitor',
		modelBadge: '200!',
	},
	'patch-nonowner': {
		policySublabel: 'PATCH user_7',
		modelBadge: '200!',
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
			'HTTP requests arrive with a session cookie that identifies the user (authentication). But knowing WHO is requesting says nothing about whether they are ALLOWED to perform the action.',
	},
	controller: {
		stageId: 'controller',
		title: 'PostsController',
		description:
			'The controller finds the product and immediately runs the action. There is no authorize call. Any authenticated user can destroy, update, or read any record.',
		code: `def destroy
  post = Product.find(params[:id])
  product.destroy  # No permission check!
  head :no_content
end`,
	},
	policy: {
		stageId: 'policy',
		title: 'Policy (Missing!)',
		description:
			'This stage does not exist yet. There is no policy class to check permissions. Requests flow straight through to the model without any authorization gate.',
	},
	model: {
		stageId: 'model',
		title: 'Model (Unprotected)',
		description:
			'The model executes whatever the controller asks. Without a policy layer, every operation succeeds regardless of who requested it.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	policy: 'no-policy',
	controller: 'no-authorize',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'owner-edit',
		label: 'Owner edits own post',
		description: 'Product owner updates their own content',
		method: 'PATCH',
		path: '/api/v1/products/42',
		actor: 'owner (user_3)',
		expectedResult: 'allowed',
	},
	{
		id: 'admin-delete',
		label: 'Admin deletes flagged post',
		description: 'Admin removes a flagged post',
		method: 'DELETE',
		path: '/api/v1/products/99',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'stranger-delete',
		label: 'Stranger deletes post',
		description: "Random user tries to delete another user's post",
		method: 'DELETE',
		path: '/api/v1/products/42',
		actor: 'stranger (user_7)',
		expectedResult: 'blocked',
	},
	{
		id: 'stranger-update',
		label: 'Stranger updates post',
		description: "Random user tries to edit another user's post",
		method: 'PATCH',
		path: '/api/v1/products/42',
		actor: 'stranger (user_7)',
		expectedResult: 'blocked',
	},
	{
		id: 'visitor-index',
		label: 'Visitor sees published only',
		description: 'Unauthenticated visitor views the index',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'visitor (no auth)',
		expectedResult: 'allowed',
	},
];

// ──────────────────────────────────────────────
// Step definitions (7 steps: 2 terminal + 5 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-gem', title: 'Add the Pundit Gem' },
	{ id: 'include-module', title: 'Include Pundit in Controller' },
	{ id: 'generate-install', title: 'Generate ApplicationPolicy' },
	{ id: 'policy-class', title: 'Choose the Policy Class' },
	{ id: 'destroy-method', title: 'Define the destroy? Method' },
	{ id: 'controller-wire', title: 'Wire Up the Controller' },
	{ id: 'scope-query', title: 'Scope the Index Query' },
];

// Step type: 'terminal' or 'option', indexed by step number
const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add pundit
	'option', // 1: include Pundit::Authorization
	'terminal', // 2: rails g pundit:install
	'option', // 3: Choose the Policy Class
	'option', // 4: Define the destroy? Method
	'option', // 5: Wire Up the Controller
	'option', // 6: Scope the Index Query
];

// ──────────────────────────────────────────────
// Step 0: Add the Pundit Gem (Terminal)
// ──────────────────────────────────────────────

const addGemCommands: TerminalCommand[] = [
	{
		id: 'wrong-gem-install',
		label: 'gem install pundit',
		command: 'gem install pundit',
		correct: false,
		feedback:
			'That installs the gem system-wide, not into your project. You need it in the Gemfile so the app can load it.',
	},
	{
		id: 'wrong-npm',
		label: 'npm install pundit',
		command: 'npm install pundit',
		correct: false,
		feedback:
			'Pundit is a Ruby gem, not an npm package. Use the Ruby package manager.',
	},
	{
		id: 'correct',
		label: 'bundle add pundit',
		command: 'bundle add pundit',
		correct: true,
	},
];

const addGemOutput: TerminalOutputLine[] = [
	{ text: 'Fetching pundit 2.4.0', color: 'cyan' },
	{ text: 'Installing pundit 2.4.0', color: 'muted' },
	{ text: 'Bundle complete! 13 Gemfile dependencies.', color: 'green' },
];

// ──────────────────────────────────────────────
// OptionCard step data type
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

// ──────────────────────────────────────────────
// Step 1: Include Pundit in Controller (OptionCard)
// ──────────────────────────────────────────────

const INCLUDE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-cancancan',
		label: 'include CanCan::Ability',
		correct: false,
		feedback:
			'CanCan is a different authorization library. You installed Pundit, so use its module.',
	},
	{
		id: 'correct',
		label: 'include Pundit::Authorization',
		correct: true,
	},
	{
		id: 'wrong-devise',
		label: 'include Devise::Controllers::Helpers',
		correct: false,
		feedback:
			'Devise handles authentication, not authorization. Pundit provides its own controller module.',
	},
];

// ──────────────────────────────────────────────
// Step 2: Generate ApplicationPolicy (Terminal)
// ──────────────────────────────────────────────

const generateInstallCommands: TerminalCommand[] = [
	{
		id: 'wrong-policy-post',
		label: 'rails generate pundit:policy Product',
		command: 'rails generate pundit:policy Product',
		correct: false,
		feedback:
			'That generates a single policy file. You need the base setup first, which creates the ApplicationPolicy all policies inherit from.',
	},
	{
		id: 'correct',
		label: 'rails generate pundit:install',
		command: 'rails generate pundit:install',
		correct: true,
	},
	{
		id: 'wrong-scaffold',
		label: 'rails generate scaffold Policy',
		command: 'rails generate scaffold Policy',
		correct: false,
		feedback:
			'Policies are not Active Record models. Pundit has its own generator for the base policy class.',
	},
];

const generateInstallOutput: TerminalOutputLine[] = [
	{ text: '      create  app/policies/application_policy.rb', color: 'green' },
];

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addGemCommands, outputLines: addGemOutput },
	null, // step 1: OptionCard (include Pundit::Authorization)
	{ commands: generateInstallCommands, outputLines: generateInstallOutput },
];

// ──────────────────────────────────────────────
// Steps 3-6: OptionCard data
// ──────────────────────────────────────────────

const STEP_OPTIONS: StepOption[][] = [
	// Step 3: Choose the Policy Class
	[
		{
			id: 'action-policy',
			label: 'class ProductPolicy < ActionPolicy::Base\n  # ...\nend',
			correct: false,
			feedback:
				'ActionPolicy is a different gem. Pundit policies inherit from a shared base class in your app.',
		},
		{
			id: 'application-policy',
			label: 'class ProductPolicy < ApplicationPolicy\n  # ...\nend',
			correct: true,
		},
		{
			id: 'posts-policy',
			label: 'class PostsPolicy < ApplicationPolicy\n  # ...\nend',
			correct: false,
			feedback:
				'Pundit policy names are singular, matching the model name. Product, not Products.',
		},
	],
	// Step 4: Define the destroy? Method
	[
		{
			id: 'admin-only',
			label: 'def destroy?\n  user.admin?\nend',
			correct: false,
			feedback:
				'That only allows admins. Product owners should also be able to delete their own products.',
		},
		{
			id: 'allow-all',
			label: 'def destroy?\n  true\nend',
			correct: false,
			feedback:
				'That allows everyone to delete any post. Authorization needs a real permission check.',
		},
		{
			id: 'owner-or-admin',
			label: 'def destroy?\n  record.user == user || user.admin?\nend',
			correct: true,
		},
	],
	// Step 5: Wire Up the Controller
	[
		{
			id: 'inline-check',
			label:
				'if current_user.admin? || product.user == current_user\n  product.destroy\nend',
			correct: false,
			feedback:
				'Inline permission checks duplicate logic that belongs in the policy. The controller should delegate.',
		},
		{
			id: 'before-action',
			label: 'before_action :check_permissions',
			correct: false,
			feedback:
				'A generic before_action cannot check record-level permissions because the record has not been loaded yet.',
		},
		{
			id: 'authorize',
			label: 'authorize product',
			correct: true,
		},
	],
	// Step 6: Scope the Index Query
	[
		{
			id: 'where-user',
			label: 'Product.where(user: current_user)',
			correct: false,
			feedback:
				'Hardcoded queries in the controller bypass the policy. Scoping logic belongs in the policy class.',
		},
		{
			id: 'cancancan',
			label: 'Product.accessible_by(current_user)',
			correct: false,
			feedback:
				'That is a CanCanCan pattern, not Pundit. Pundit has its own scoping mechanism.',
		},
		{
			id: 'policy-scope',
			label: 'policy_scope(Product)',
			correct: true,
		},
	],
];

// Map from step index -> OptionCard data for option-type steps
// Steps 1, 3, 4, 5, 6 are OptionCard steps
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	1: {
		title: 'Include Pundit in Controller',
		description:
			'Pundit is installed. Now your ApplicationController needs to load the authorization module so controllers can call authorize and policy_scope.',
		options: INCLUDE_OPTIONS,
	},
	3: {
		title: 'Choose the Policy Class',
		description:
			'Pundit looks up a policy class by model name. Which class definition will Pundit find for the Product model?',
		options: STEP_OPTIONS[0],
	},
	4: {
		title: 'Define the destroy? Method',
		description:
			'Product owners and admins should be able to delete. Everyone else should be blocked. Which permission logic is correct?',
		options: STEP_OPTIONS[1],
	},
	5: {
		title: 'Wire Up the Controller',
		description:
			'Your ProductPolicy exists but the controller still runs product.destroy without checking permissions. Pundit infers the policy class from the record you pass: a Product instance resolves to ProductPolicy, calling destroy? automatically. How should the controller delegate?',
		options: STEP_OPTIONS[2],
	},
	6: {
		title: 'Scope the Index Query',
		description:
			'The index action does Product.all, leaking drafts and private posts. How do you filter the collection through the policy?',
		options: STEP_OPTIONS[3],
	},
};

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'policy', dots: 'mixed' },
	{ from: 'policy', to: 'model', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'policy', dots: 'mixed' },
	{ from: 'policy', to: 'model', dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the unprotected controller
	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def destroy
    product = Product.find(params[:id])
    product.destroy  # Any user can delete ANY post!
    head :no_content
  end
end`,
			highlight: [4],
		});
		return files;
	}

	// Build / reward phases: show evolving code
	// furthestStep 0: unprotected controller (before any step completed)
	// furthestStep 1: Gemfile after bundle add pundit
	// furthestStep 2: ApplicationController with include Pundit::Authorization
	// furthestStep 3: ApplicationPolicy after generator
	// furthestStep 4: ProductPolicy skeleton after choosing class
	// furthestStep 5: ProductPolicy with destroy? method
	// furthestStep 6: Controller with authorize
	// furthestStep 7: Controller with policy_scope + ApplicationController rescue_from

	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def destroy
    product = Product.find(params[:id])
    product.destroy  # Any user can delete ANY post!
    head :no_content
  end
end`,
			highlight: [4],
		});
	}

	if (furthestStep >= 1) {
		// After step 0: Gemfile shows pundit added
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `source "https://rubygems.org"

gem "rails", "~> 8.0.0"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "jbuilder"
gem "bcrypt", "~> 3.1.7"
gem "pundit"`,
			highlight: [8],
		});
	}

	if (furthestStep >= 2) {
		// After step 1: ApplicationController with include Pundit::Authorization
		files.push({
			filename: 'app/controllers/application_controller.rb',
			language: 'ruby',
			code:
				furthestStep >= 7
					? `class ApplicationController < ActionController::API
  include Pundit::Authorization

  rescue_from Pundit::NotAuthorizedError do |e|
    render json: { error: "Not authorized" },
           status: :forbidden
  end
end`
					: `class ApplicationController < ActionController::API
  include Pundit::Authorization
end`,
			highlight: furthestStep >= 7 ? [2, 4, 5, 6] : [2],
		});
	}

	if (furthestStep >= 3) {
		// After step 2: ApplicationPolicy from generator (matches pundit:install output)
		files.push({
			filename: 'app/policies/application_policy.rb',
			language: 'ruby',
			code: `class ApplicationPolicy
  attr_reader :user, :record

  def initialize(user, record)
    @user = user
    @record = record
  end

  def index?    = false
  def show?     = false
  def create?   = false
  def new?      = create?
  def update?   = false
  def edit?     = update?
  def destroy?  = false

  class Scope
    def initialize(user, scope)
      @user = user
      @scope = scope
    end

    def resolve
      raise NoMethodError,
        "You must define #resolve in #{self.class}"
    end

    private

    attr_reader :user, :scope
  end
end`,
			highlight: [9, 10, 11, 12, 13, 14, 15],
		});
	}

	if (furthestStep >= 4) {
		// After step 3: ProductPolicy skeleton
		files.push({
			filename: 'app/policies/post_policy.rb',
			language: 'ruby',
			code:
				furthestStep >= 7
					? `class ProductPolicy < ApplicationPolicy
  # user  - the signed-in user (from Pundit)
  # record - the Product instance being checked

  def destroy?
    record.user == user || user.admin?
  end

  class Scope < ApplicationPolicy::Scope
    def resolve
      if user.admin?
        scope.all
      else
        scope.where(published: true)
      end
    end
  end
end`
					: furthestStep >= 5
						? `class ProductPolicy < ApplicationPolicy
  # user  - the signed-in user (from Pundit)
  # record - the Product instance being checked

  def destroy?
    record.user == user || user.admin?
  end
end`
						: `class ProductPolicy < ApplicationPolicy
  # user  - the signed-in user (from Pundit)
  # record - the Product instance being checked
end`,
			highlight:
				furthestStep >= 7
					? [5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17]
					: furthestStep >= 5
						? [5, 6]
						: [],
		});
	}

	if (furthestStep >= 6) {
		// After step 5: controller with authorize
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code:
				furthestStep >= 7
					? `class Api::V1::ProductsController < ApplicationController
  def index
    products = policy_scope(Product)
    render json: ProductSerializer.new(products)
  end

  def destroy
    product = Product.find(params[:id])
    authorize product
    product.destroy
    head :no_content
  end
end`
					: `class Api::V1::ProductsController < ApplicationController
  def destroy
    product = Product.find(params[:id])
    authorize product
    product.destroy
    head :no_content
  end
end`,
			highlight: furthestStep >= 7 ? [3, 9] : [4],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend (matches Level 13 pattern)
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
					<span className="text-foreground">Authorized request (passes)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Unauthorized request (blocked)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level12Authorization({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
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
				id: 'controller',
				label: 'Controller',
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'policy',
				label: 'Policy',
				sublabel: probeDisplay ? probeDisplay.policySublabel : '(missing)',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('policy'),
			},
			{
				id: 'model',
				label: 'Model',
				badge: probeDisplay ? probeDisplay.modelBadge : 'BREACH',
				variant: (probeDisplay ? 'danger' : 'default') as 'danger' | 'default',
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
			{ id: 'controller', label: 'Controller' },
			{
				id: 'policy',
				label: 'Pundit',
				sublabel: wasBlocked ? '403 Forbidden' : 'authorize!',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'BLOCKED' : undefined,
			},
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
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[discoveryGating],
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

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleStartReward = () => {
		setPhase('reward');
		stressTest.reset();
	};

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
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
		return { valid: true, message: 'Authorization policy is deployed!' };
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
							Authentication tells you WHO is making the request. But nothing
							checks whether they are ALLOWED to do what they are asking. User A
							can delete User B's posts.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Rails deliberately does not ship built-in authorization. The
							community standard is{' '}
							<span className="text-foreground font-medium">Pundit</span>, a gem
							that gives each model a plain Ruby policy class. One class per
							model, one method per action, easy to test.
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
					levelName="Authorization"
					levelNumber={12}
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
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Terminal steps (0: gem install, 2: generator) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={addGemCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Pundit is a Ruby gem that adds policy-based
													authorization. Add it to your project's dependencies.
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
											title="Add the Pundit Gem"
										/>
									)}

								{currentStepType === 'terminal' &&
									stepper.currentStep === 2 && (
										<TerminalChoiceStep
											commands={generateInstallCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Pundit needs a base policy class that all your
													policies will inherit from. Run the install generator.
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
											outputLines={generateInstallOutput}
											stepKey={stepper.currentStep}
											title="Generate ApplicationPolicy"
										/>
									)}

								{/* OptionCard steps (1, 3, 4, 5, 6) */}
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

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
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

export default Level12Authorization;
