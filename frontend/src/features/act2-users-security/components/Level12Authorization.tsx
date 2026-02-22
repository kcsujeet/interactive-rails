/**
 * Level 12: Authorization
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Watch hackers breach through unprotected pipeline
 * Phase 2 (HOW - build): 7 steps (2 terminal + 5 OptionCard) building a Pundit PostPolicy
 *   Step 0: bundle add pundit (terminal)
 *   Step 1: include Pundit::Authorization in ApplicationController (OptionCard)
 *   Step 2: rails generate pundit:install (terminal)
 *   Step 3: Choose the Policy Class (OptionCard)
 *   Step 4: Define the destroy? Method (OptionCard)
 *   Step 5: Wire Up the Controller (OptionCard)
 *   Step 6: Scope the Index Query (OptionCard)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Protection" button
 * Phase 4 (ADVANTAGE - reward): Policy blocks hackers in the animation
 *
 * Teaches: Pundit policies, authorize, policy_scope, rescue_from
 */

import { ArrowRight, Play, Shield, ShieldAlert, ShieldCheck, Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
// Step definitions (6 steps: 2 terminal + 4 OptionCard)
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
	'option',   // 1: include Pundit::Authorization
	'terminal', // 2: rails g pundit:install
	'option',   // 3: Choose the Policy Class
	'option',   // 4: Define the destroy? Method
	'option',   // 5: Wire Up the Controller
	'option',   // 6: Scope the Index Query
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
		feedback: 'CanCan is a different authorization library. You installed Pundit, so use its module.',
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
		feedback: 'Devise handles authentication, not authorization. Pundit provides its own controller module.',
	},
];

// ──────────────────────────────────────────────
// Step 2: Generate ApplicationPolicy (Terminal)
// ──────────────────────────────────────────────

const generateInstallCommands: TerminalCommand[] = [
	{
		id: 'wrong-policy-post',
		label: 'rails generate pundit:policy Post',
		command: 'rails generate pundit:policy Post',
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
			label: 'class PostPolicy < ActionPolicy::Base\n  # ...\nend',
			correct: false,
			feedback: 'ActionPolicy is a different gem. Pundit policies inherit from a shared base class in your app.',
		},
		{
			id: 'application-policy',
			label: 'class PostPolicy < ApplicationPolicy\n  # ...\nend',
			correct: true,
		},
		{
			id: 'posts-policy',
			label: 'class PostsPolicy < ApplicationPolicy\n  # ...\nend',
			correct: false,
			feedback: 'Pundit policy names are singular, matching the model name. Post, not Posts.',
		},
	],
	// Step 4: Define the destroy? Method
	[
		{
			id: 'admin-only',
			label: 'def destroy?\n  user.admin?\nend',
			correct: false,
			feedback: 'That only allows admins. Post owners should also be able to delete their own posts.',
		},
		{
			id: 'allow-all',
			label: 'def destroy?\n  true\nend',
			correct: false,
			feedback: 'That allows everyone to delete any post. Authorization needs a real permission check.',
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
			label: 'if current_user.admin? || post.user == current_user\n  post.destroy\nend',
			correct: false,
			feedback: 'Inline permission checks duplicate logic that belongs in the policy. The controller should delegate.',
		},
		{
			id: 'before-action',
			label: 'before_action :check_permissions',
			correct: false,
			feedback: 'A generic before_action cannot check record-level permissions because the record has not been loaded yet.',
		},
		{
			id: 'authorize',
			label: 'authorize post',
			correct: true,
		},
	],
	// Step 6: Scope the Index Query
	[
		{
			id: 'where-user',
			label: 'Post.where(user: current_user)',
			correct: false,
			feedback: 'Hardcoded queries in the controller bypass the policy. Scoping logic belongs in the policy class.',
		},
		{
			id: 'cancancan',
			label: 'Post.accessible_by(current_user)',
			correct: false,
			feedback: 'That is a CanCanCan pattern, not Pundit. Pundit has its own scoping mechanism.',
		},
		{
			id: 'policy-scope',
			label: 'policy_scope(Post)',
			correct: true,
		},
	],
];

// Map from step index -> OptionCard data for option-type steps
// Steps 1, 3, 4, 5, 6 are OptionCard steps
const OPTION_STEP_CONFIG: Record<number, {
	title: string;
	description: string;
	options: StepOption[];
}> = {
	1: {
		title: 'Include Pundit in Controller',
		description: 'Pundit is installed. Now your ApplicationController needs to load the authorization module so controllers can call authorize and policy_scope.',
		options: INCLUDE_OPTIONS,
	},
	3: {
		title: 'Choose the Policy Class',
		description: 'Pundit looks up a policy class by model name. Which class definition will Pundit find for the Post model?',
		options: STEP_OPTIONS[0],
	},
	4: {
		title: 'Define the destroy? Method',
		description: 'Post owners and admins should be able to delete. Everyone else should be blocked. Which permission logic is correct?',
		options: STEP_OPTIONS[1],
	},
	5: {
		title: 'Wire Up the Controller',
		description: 'Your PostPolicy exists but the controller still runs post.destroy without checking permissions. How should the controller delegate to the policy?',
		options: STEP_OPTIONS[2],
	},
	6: {
		title: 'Scope the Index Query',
		description: 'The index action does Post.all, leaking drafts and private posts. How do you filter the collection through the policy?',
		options: STEP_OPTIONS[3],
	},
};

// ──────────────────────────────────────────────
// Simulation types
// ──────────────────────────────────────────────

interface SimRequest {
	id: number;
	x: number;
	y: number;
	type: 'admin' | 'user' | 'hacker';
	action: 'view' | 'delete';
	blocked: boolean;
	breached: boolean;
}

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the unprotected controller
	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::PostsController < ApplicationController
  def destroy
    post = Post.find(params[:id])
    post.destroy  # Any user can delete ANY post!
    head :no_content
  end
end`,
			highlight: [4],
		});
		return files;
	}

	// Build / activate / reward phases: show evolving code
	// furthestStep 0: unprotected controller (before any step completed)
	// furthestStep 1: Gemfile after bundle add pundit
	// furthestStep 2: ApplicationController with include Pundit::Authorization
	// furthestStep 3: ApplicationPolicy after generator
	// furthestStep 4: PostPolicy skeleton after choosing class
	// furthestStep 5: PostPolicy with destroy? method
	// furthestStep 6: Controller with authorize
	// furthestStep 7: Controller with policy_scope + ApplicationController rescue_from

	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::PostsController < ApplicationController
  def destroy
    post = Post.find(params[:id])
    post.destroy  # Any user can delete ANY post!
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
			code: furthestStep >= 7
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
        "You must define #resolve in \#{self.class}"
    end

    private

    attr_reader :user, :scope
  end
end`,
			highlight: [9, 10, 11, 12, 13, 14, 15],
		});
	}

	if (furthestStep >= 4) {
		// After step 3: PostPolicy skeleton
		files.push({
			filename: 'app/policies/post_policy.rb',
			language: 'ruby',
			code: furthestStep >= 7
				? `class PostPolicy < ApplicationPolicy
  # user  - the signed-in user (from Pundit)
  # record - the Post instance being checked

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
					? `class PostPolicy < ApplicationPolicy
  # user  - the signed-in user (from Pundit)
  # record - the Post instance being checked

  def destroy?
    record.user == user || user.admin?
  end
end`
					: `class PostPolicy < ApplicationPolicy
  # user  - the signed-in user (from Pundit)
  # record - the Post instance being checked
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
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: furthestStep >= 7
				? `class Api::V1::PostsController < ApplicationController
  def index
    posts = policy_scope(Post)
    render json: PostSerializer.new(posts)
  end

  def destroy
    post = Post.find(params[:id])
    authorize post
    post.destroy
    head :no_content
  end
end`
				: `class Api::V1::PostsController < ApplicationController
  def destroy
    post = Post.find(params[:id])
    authorize post
    post.destroy
    head :no_content
  end
end`,
			highlight: furthestStep >= 7 ? [3, 9] : [4],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// SVG Pipeline Visualization
// ──────────────────────────────────────────────

function PipelineVisualization({
	requests,
	policyDeployed,
	getRequestColor,
	getRequestIcon,
}: {
	requests: SimRequest[];
	policyDeployed: boolean;
	getRequestColor: (type: SimRequest['type']) => string;
	getRequestIcon: (type: SimRequest['type'], action: SimRequest['action']) => string;
}) {
	return (
		<svg className="w-full h-full" preserveAspectRatio="xMidYMid meet" viewBox="0 0 600 400">
			{/* Controller */}
			<rect fill="#374151" height="160" rx="8" width="80" x="40" y="120" />
			<text fill="#9ca3af" fontSize="12" textAnchor="middle" x="80" y="210">
				Controller
			</text>

			{/* Policy (always visible, but dimmed when not deployed) */}
			<rect
				fill={policyDeployed ? '#8b5cf6' : '#374151'}
				height="120"
				opacity={policyDeployed ? 1 : 0.3}
				rx="8"
				stroke={policyDeployed ? '#8b5cf6' : '#4b5563'}
				strokeDasharray={policyDeployed ? 'none' : '4,4'}
				strokeWidth="1"
				width="60"
				x="270"
				y="140"
			/>
			<text
				fill={policyDeployed ? 'white' : '#6b7280'}
				fontSize="11"
				textAnchor="middle"
				x="300"
				y="205"
			>
				Policy
			</text>
			{policyDeployed && (
				<text fill="white" fontSize="9" textAnchor="middle" x="300" y="220">
					authorize!
				</text>
			)}
			{!policyDeployed && (
				<text fill="#6b7280" fontSize="9" textAnchor="middle" x="300" y="220">
					(missing)
				</text>
			)}

			{/* Model */}
			<rect fill="#374151" height="160" rx="8" width="80" x="440" y="120" />
			<text fill="#9ca3af" fontSize="12" textAnchor="middle" x="480" y="210">
				Model
			</text>

			{/* Connection lines */}
			<line
				stroke="#4b5563"
				strokeDasharray="5,5"
				strokeWidth="2"
				x1="120"
				x2="270"
				y1="200"
				y2="200"
			/>
			<line
				stroke={policyDeployed ? '#8b5cf6' : '#4b5563'}
				strokeDasharray={policyDeployed ? 'none' : '5,5'}
				strokeWidth="2"
				x1="330"
				x2="440"
				y1="200"
				y2="200"
			/>

			{/* Requests */}
			{requests.map((r) => {
				if (r.blocked && r.x > 320) return null;

				return (
					<g key={r.id}>
						<circle
							cx={r.x}
							cy={r.y}
							fill={getRequestColor(r.type)}
							opacity={r.blocked ? 0.5 : 1}
							r="10"
						/>
						<text
							fill="white"
							fontSize="9"
							fontWeight="bold"
							textAnchor="middle"
							x={r.x}
							y={r.y + 3}
						>
							{getRequestIcon(r.type, r.action)}
						</text>
					</g>
				);
			})}

			{/* Block effects (policy deployed) */}
			{policyDeployed &&
				requests
					.filter((r) => r.blocked && r.x >= 280 && r.x < 350)
					.map((r) => (
						<text
							fill="#ef4444"
							fontSize="9"
							fontWeight="bold"
							key={`block-${r.id}`}
							textAnchor="middle"
							x={r.x}
							y={r.y - 16}
						>
							DENIED
						</text>
					))}

			{/* Breach effects (no policy) */}
			{!policyDeployed &&
				requests
					.filter((r) => r.breached && r.x >= 440 && r.x < 520)
					.map((r) => (
						<text
							fill="#ef4444"
							fontSize="9"
							fontWeight="bold"
							key={`breach-${r.id}`}
							textAnchor="middle"
							x={r.x}
							y={r.y - 16}
						>
							BREACH
						</text>
					))}
		</svg>
	);
}

// ──────────────────────────────────────────────
// Request Legend (reused in multiple phases)
// ──────────────────────────────────────────────

function RequestLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Request Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<ShieldCheck className="w-4 h-4 text-success" />
					<span className="text-foreground">Admin (can delete)</span>
				</div>
				<div className="flex items-center gap-2">
					<Shield className="w-4 h-4 text-primary" />
					<span className="text-foreground">User (view only)</span>
				</div>
				<div className="flex items-center gap-2">
					<ShieldAlert className="w-4 h-4 text-destructive" />
					<span className="text-foreground">Hacker (unauthorized)</span>
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
	const [phase, setPhase] = useState<Phase>('observe');
	const [showBuildButton, setShowBuildButton] = useState(false);
	const [requests, setRequests] = useState<SimRequest[]>([]);
	const [blockedCount, setBlockedCount] = useState(0);
	const [allowedCount, setAllowedCount] = useState(0);

	// Track whether animation should run (only in observe and reward phases)
	const animationActive = phase === 'observe' || phase === 'reward';
	const policyDeployed = phase === 'reward';

	// Ref to track latest policyDeployed for animation intervals
	const policyDeployedRef = useRef(policyDeployed);
	policyDeployedRef.current = policyDeployed;

	// ── "Build the Fix" button fade-in after 3 seconds ──
	useEffect(() => {
		if (phase !== 'observe') return;
		const timer = setTimeout(() => setShowBuildButton(true), 3000);
		return () => clearTimeout(timer);
	}, [phase]);

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

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

	// ── Animation: spawn requests (only when animation is active) ──
	useEffect(() => {
		if (!animationActive) return;

		const interval = setInterval(() => {
			const id = Date.now() + Math.random();
			const rand = Math.random();
			let type: SimRequest['type'];
			let action: SimRequest['action'];

			if (rand < 0.3) {
				type = 'admin';
				action = Math.random() > 0.5 ? 'view' : 'delete';
			} else if (rand < 0.6) {
				type = 'user';
				action = 'view';
			} else {
				type = 'hacker';
				action = 'delete';
			}

			setRequests((prev) => [
				...prev.slice(-12),
				{ id, x: 50, y: 140 + Math.random() * 120, type, action, blocked: false, breached: false },
			]);
		}, 800);

		return () => clearInterval(interval);
	}, [animationActive]);

	// ── Animation: move requests (only when animation is active) ──
	useEffect(() => {
		if (!animationActive) return;

		const interval = setInterval(() => {
			setRequests((prev) =>
				prev
					.map((r) => {
						const newX = r.x + 3;

						if (policyDeployedRef.current) {
							// Policy checkpoint at x=290
							if (newX >= 290 && newX < 300 && !r.blocked) {
								const shouldBlock =
									r.type === 'hacker' ||
									(r.action === 'delete' && r.type !== 'admin');

								if (shouldBlock) {
									setBlockedCount((c) => c + 1);
									return { ...r, x: newX, blocked: true };
								}
								setAllowedCount((c) => c + 1);
							}
						} else {
							// No policy: hackers breach through at model (x=440)
							if (newX >= 440 && newX < 450 && !r.breached && r.type === 'hacker') {
								return { ...r, x: newX, breached: true };
							}
						}

						return { ...r, x: newX };
					})
					.filter((r) => {
						if (r.x >= 560) return false;
						if (r.blocked && r.x > 340) return false;
						return true;
					}),
			);
		}, 50);

		return () => clearInterval(interval);
	}, [animationActive]);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
		setRequests([]);
	};

	const handleActivatePolicy = () => {
		setPhase('reward');
		setRequests([]);
		setBlockedCount(0);
		setAllowedCount(0);
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
		return { valid: true, message: 'Authorization policy is deployed!' };
	};

	// ── Helpers ──
	const getRequestColor = (type: SimRequest['type']) => {
		switch (type) {
			case 'admin':
				return '#22c55e';
			case 'user':
				return '#3b82f6';
			case 'hacker':
				return '#ef4444';
		}
	};

	const getRequestIcon = (type: SimRequest['type'], action: SimRequest['action']) => {
		if (type === 'hacker') return '!';
		if (action === 'delete') return '-';
		return '?';
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
							Authentication tells you WHO is making the request. But nothing
							checks whether they are ALLOWED to do what they are asking.
							User A can delete User B's posts.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Rails deliberately does not ship built-in authorization.
							The community standard is{' '}
							<span className="text-foreground font-medium">Pundit</span>,
							a gem that gives each model a plain Ruby policy class.
							One class per model, one method per action, easy to test.
						</p>
					</div>

					{/* Observe phase: legend only */}
					{phase === 'observe' && <RequestLegend />}

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

					{/* Reward phase: legend + counters */}
					{phase === 'reward' && (
						<>
							<RequestLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{allowedCount}
										</div>
										<div className="text-xs text-success/70">Allowed</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{blockedCount}
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
								<PipelineVisualization
									getRequestColor={getRequestColor}
									getRequestIcon={getRequestIcon}
									policyDeployed={false}
									requests={requests}
								/>
							</div>
							{showBuildButton && (
								<div className="p-6 flex justify-center animate-in fade-in duration-500">
									<Button className="gap-2" onClick={handleStartBuild} size="lg">
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
								{currentStepType === 'terminal' && stepper.currentStep === 0 && (
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

								{currentStepType === 'terminal' && stepper.currentStep === 2 && (
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
												{currentOptionConfig.options.map((opt) => (
													<OptionCard
														key={opt.id}
														color="violet"
														disabled={!opt.correct}
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
															key={opt.id}
															color="violet"
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
											key={s}
											className={`w-8 h-8 ${
												s <= stepper.starRating
													? 'text-yellow-400 fill-yellow-400'
													: 'text-muted-foreground/30'
											}`}
										/>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									Your Pundit policy is ready. See the
									red hackers get blocked at the Policy checkpoint.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivatePolicy}
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
								<PipelineVisualization
									getRequestColor={getRequestColor}
									getRequestIcon={getRequestIcon}
									policyDeployed={true}
									requests={requests}
								/>
							</div>
							<div className="p-4 text-center">
								<p className="text-sm text-muted-foreground">
									Policy active. Unauthorized deletes and hacker requests
									are now blocked. Click Submit to complete the level.
								</p>
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level12Authorization;
