/**
 * Level 17: Concerns & Modules
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Code Duplication" visualization.
 *   Two model zones side by side (Post, Comment), each containing
 *   identical tagging code blocks. Player clicks each model to inspect
 *   the duplicated code, fires probes to see both models behave
 *   identically. A dashed "Missing Concern" zone below highlights
 *   the absence of shared behavior extraction.
 * Phase 2 (HOW - build): 3 OptionCard steps
 *   Step 0: Choose where to put shared behavior (ActiveSupport::Concern)
 *   Step 1: Define the concern's included block (has_many + scope)
 *   Step 2: Include the concern in models (include Taggable)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Concern" button
 * Phase 4 (ADVANTAGE - reward): Three-zone layout: Post and Comment models
 *   both connect down to the shared Taggable concern. Stress test fires
 *   tagging operations and shows the shared behavior working.
 *
 * Visualization approach: Custom zone layout (refactoring concept, code duplication).
 * Two side-by-side model zones with highlighted identical code blocks,
 * not a PipelineFlow request chain.
 *
 * Teaches: ActiveSupport::Concern, DRY, included block, module extraction
 */

import {
	ArrowRight,
	Check,
	Play,
	Search,
	Star,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { FlowConnector } from '@/components/levels/FlowConnector';
import { ScenarioCards, type ScenarioConfig } from '@/components/levels/ScenarioCards';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Duplicated code lines shown inside each model zone
// ──────────────────────────────────────────────

const DUPLICATED_CODE_LINES = [
	'has_many :taggings, as: :taggable',
	'has_many :tags, through: :taggings',
	'scope :tagged_with, ->(name) { ... }',
	'def tag_list ... end',
];

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'post-tagging', label: 'Identical tagging code in Post' },
	{ id: 'comment-tagging', label: 'Identical tagging code in Comment' },
	{ id: 'dry-violation', label: 'DRY violation detected' },
	{ id: 'identical-behavior', label: 'Both models behave identically' },
];

// ──────────────────────────────────────────────
// Scenario configurations (observe phase)
// ──────────────────────────────────────────────

const SCENARIOS: ScenarioConfig[] = [
	{
		id: 'fix-tagged-with',
		title: 'Fix tagged_with for multi-word tags',
		consequence: 'Must fix identical code in both Post and Comment. Forget one and behavior diverges.',
	},
	{
		id: 'add-article-model',
		title: 'Add Article model with tagging',
		consequence: 'Copy-paste the same 4 methods a third time? The duplication grows with every new model.',
	},
	{
		id: 'compare-implementations',
		title: 'Audit all tagging code for consistency',
		consequence: 'Scattered across multiple files. No single source of truth to review or test.',
	},
];

// Map scenario IDs to discovery IDs they trigger
const SCENARIO_DISCOVERY_MAP: Record<string, string> = {
	'fix-tagged-with': 'dry-violation',
	'add-article-model': 'identical-behavior',
	'compare-implementations': 'post-tagging',
};

// Flow messages per scenario: [postMessage, commentMessage]
const OBSERVE_FLOW: Record<string, [string, string]> = {
	'fix-tagged-with': ['Fix here too!', 'Fix here too!'],
	'add-article-model': ['Copy these 4 methods', 'Copy these 4 methods'],
	'compare-implementations': ['has_many + scope + tag_list', 'has_many + scope + tag_list (identical!)'],
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	post: {
		stageId: 'post',
		title: 'Post Model',
		description:
			'The Post model defines tagging associations, a tagged_with scope, and a tag_list method directly in the model file. This is the same code that also exists in the Comment model.',
		code: `class Post < ApplicationRecord
  belongs_to :user
  has_many :comments

  # Tagging (duplicated in Comment!)
  has_many :taggings, as: :taggable
  has_many :tags, through: :taggings

  scope :tagged_with, ->(name) {
    joins(:tags).where(tags: { name: name })
  }

  def tag_list
    tags.map(&:name).join(", ")
  end
end`,
	},
	comment: {
		stageId: 'comment',
		title: 'Comment Model',
		description:
			'The Comment model has the exact same tagging code as Post. Every line of tagging logic is duplicated: the associations, the scope, and the instance method.',
		code: `class Comment < ApplicationRecord
  belongs_to :post
  belongs_to :user

  # Tagging (duplicated in Post!)
  has_many :taggings, as: :taggable
  has_many :tags, through: :taggings

  scope :tagged_with, ->(name) {
    joins(:tags).where(tags: { name: name })
  }

  def tag_list
    tags.map(&:name).join(", ")
  end
end`,
	},
	concern: {
		stageId: 'concern',
		title: 'Concern (Missing!)',
		description:
			'There is no shared module for tagging behavior. Each model defines the same associations, scopes, and methods independently. When a bug is found or a feature added, every model must be updated separately.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	post: 'post-tagging',
	comment: 'comment-tagging',
	concern: 'dry-violation',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'post-tagged-with',
		label: 'Post.tagged_with("rails")',
		description: 'Query posts by tag via shared concern',
		method: 'GET',
		path: '/posts?tag=rails',
		actor: 'Post model',
		expectedResult: 'allowed',
	},
	{
		id: 'comment-tagged-with',
		label: 'Comment.tagged_with("ruby")',
		description: 'Query comments by tag via shared concern',
		method: 'GET',
		path: '/comments?tag=ruby',
		actor: 'Comment model',
		expectedResult: 'allowed',
	},
	{
		id: 'post-tag-list',
		label: 'Post.first.tag_list',
		description: 'Get tag list from Post via concern',
		method: 'GET',
		path: '/posts/1/tags',
		actor: 'Post model',
		expectedResult: 'allowed',
	},
	{
		id: 'comment-tag-list',
		label: 'Comment.first.tag_list',
		description: 'Get tag list from Comment via concern',
		method: 'GET',
		path: '/comments/1/tags',
		actor: 'Comment model',
		expectedResult: 'allowed',
	},
	{
		id: 'post-add-tag',
		label: 'Post.first.tag_list = "new"',
		description: 'Set tags on Post via concern setter',
		method: 'PATCH',
		path: '/posts/1',
		actor: 'Post model',
		expectedResult: 'allowed',
	},
	{
		id: 'concern-bug-fix',
		label: 'Fix bug in Taggable concern',
		description: 'One fix applies to all models automatically',
		method: 'PATCH',
		path: '/concerns/taggable',
		actor: 'developer',
		expectedResult: 'allowed',
	},
];

// Reward flow: [postMsg, concernMsg, commentMsg]
const REWARD_FLOW: Record<string, [string, string, string]> = {
	'post-tagged-with': ['Post.tagged_with', 'Taggable scope runs', ''],
	'comment-tagged-with': ['', 'Taggable scope runs', 'Comment.tagged_with'],
	'post-tag-list': ['Post.tag_list', 'Taggable#tag_list', ''],
	'comment-tag-list': ['', 'Taggable#tag_list', 'Comment.tag_list'],
	'post-add-tag': ['Post.tag_list=', 'Taggable setter', ''],
	'concern-bug-fix': ['Auto-updated', 'Bug fixed here', 'Auto-updated'],
};

// ──────────────────────────────────────────────
// Step definitions (3 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-pattern', title: 'Choose Extraction Pattern' },
	{ id: 'define-included', title: 'Define the Included Block' },
	{ id: 'include-concern', title: 'Include in Models' },
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

// Step 0: Choose extraction pattern
const PATTERN_OPTIONS: StepOption[] = [
	{
		id: 'plain-module',
		label: 'Plain Ruby module with self.included(base)',
		correct: false,
		feedback:
			'A plain module works but requires manual hook wiring. Rails provides a more ergonomic pattern that handles included blocks and class methods automatically.',
	},
	{
		id: 'base-class',
		label: 'Create a TaggableRecord base class',
		correct: false,
		feedback:
			'Ruby only supports single inheritance. Post already inherits from ApplicationRecord, so it cannot also inherit from TaggableRecord.',
	},
	{
		id: 'concern',
		label: 'ActiveSupport::Concern with extend and included block',
		correct: true,
	},
	{
		id: 'mixin-eval',
		label: 'Module with class_eval in self.included',
		correct: false,
		feedback:
			'class_eval is fragile and hard to debug. Rails concerns provide the same capability with a clean, declarative API.',
	},
];

// Step 1: Define the included block
const INCLUDED_OPTIONS: StepOption[] = [
	{
		id: 'only-methods',
		label: `module Taggable
  extend ActiveSupport::Concern

  def tag_list
    tags.map(&:name).join(", ")
  end
end`,
		correct: false,
		feedback:
			'Instance methods alone are not enough. The associations (has_many) and scopes need to be evaluated in the model class context, which requires an included block.',
	},
	{
		id: 'no-scope',
		label: `module Taggable
  extend ActiveSupport::Concern

  included do
    has_many :taggings, as: :taggable
    has_many :tags, through: :taggings
  end
end`,
		correct: false,
		feedback:
			'The associations are correct, but the tagged_with scope and tag_list method are also duplicated. Extract everything that is shared.',
	},
	{
		id: 'full-concern',
		label: `module Taggable
  extend ActiveSupport::Concern

  included do
    has_many :taggings, as: :taggable
    has_many :tags, through: :taggings
    scope :tagged_with, ->(name) {
      joins(:tags).where(tags: { name: name })
    }
  end

  def tag_list
    tags.map(&:name).join(", ")
  end
end`,
		correct: true,
	},
];

// Step 2: Include the concern in models
const INCLUDE_OPTIONS: StepOption[] = [
	{
		id: 'require-extend',
		label: `class Post < ApplicationRecord
  require "taggable"
  extend Taggable
end`,
		correct: false,
		feedback:
			'extend adds module methods as class methods, not instance methods. And Rails auto-loads concerns from app/models/concerns, so require is unnecessary.',
	},
	{
		id: 'prepend',
		label: `class Post < ApplicationRecord
  prepend Taggable
end`,
		correct: false,
		feedback:
			'prepend changes method lookup order but does not trigger the included block. The concern needs include to run its associations and scopes.',
	},
	{
		id: 'include-taggable',
		label: `class Post < ApplicationRecord
  include Taggable

  belongs_to :user
  has_many :comments
end`,
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
		title: 'Choose Extraction Pattern',
		description:
			'Post and Comment have identical tagging code. You need to extract this shared behavior into a reusable module. What pattern does Rails provide for this?',
		options: PATTERN_OPTIONS,
	},
	1: {
		title: 'Define the Included Block',
		description:
			'The Taggable concern needs to set up associations, scopes, and methods when included. Which definition correctly extracts all the shared tagging behavior?',
		options: INCLUDED_OPTIONS,
	},
	2: {
		title: 'Include in Models',
		description:
			'The Taggable concern is defined. Now each model needs to use it. How do you wire the concern into a model so the included block runs and methods are available?',
		options: INCLUDE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show duplicated code in both models
	if (phase === 'observe') {
		files.push({
			filename: 'app/models/post.rb',
			language: 'ruby',
			code: `class Post < ApplicationRecord
  belongs_to :user
  has_many :comments

  # Tagging (duplicated!)
  has_many :taggings, as: :taggable
  has_many :tags, through: :taggings

  scope :tagged_with, ->(name) {
    joins(:tags).where(tags: { name: name })
  }

  def tag_list
    tags.map(&:name).join(", ")
  end
end`,
			highlight: [6, 7, 9, 10, 13, 14],
		});
		files.push({
			filename: 'app/models/comment.rb',
			language: 'ruby',
			code: `class Comment < ApplicationRecord
  belongs_to :post
  belongs_to :user

  # Tagging (duplicated!)
  has_many :taggings, as: :taggable
  has_many :tags, through: :taggings

  scope :tagged_with, ->(name) {
    joins(:tags).where(tags: { name: name })
  }

  def tag_list
    tags.map(&:name).join(", ")
  end
end`,
			highlight: [6, 7, 9, 10, 13, 14],
		});
		return files;
	}

	// Build / activate / reward phases: show evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/models/post.rb',
			language: 'ruby',
			code: `class Post < ApplicationRecord
  belongs_to :user
  has_many :comments

  # Tagging (duplicated!)
  has_many :taggings, as: :taggable
  has_many :tags, through: :taggings

  scope :tagged_with, ->(name) {
    joins(:tags).where(tags: { name: name })
  }

  def tag_list
    tags.map(&:name).join(", ")
  end
end`,
			highlight: [6, 7, 9, 10, 13, 14],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/models/concerns/taggable.rb',
			language: 'ruby',
			code:
				furthestStep >= 2
					? `# app/models/concerns/taggable.rb
module Taggable
  extend ActiveSupport::Concern

  included do
    has_many :taggings, as: :taggable
    has_many :tags, through: :taggings

    scope :tagged_with, ->(name) {
      joins(:tags).where(tags: { name: name })
    }
  end

  def tag_list
    tags.map(&:name).join(", ")
  end
end`
					: `# app/models/concerns/taggable.rb
module Taggable
  extend ActiveSupport::Concern

  included do
    # What goes in the included block?
  end

  # Instance methods go here
end`,
			highlight:
				furthestStep >= 2 ? [5, 6, 7, 9, 10, 14, 15] : [5],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/models/post.rb',
			language: 'ruby',
			code: `class Post < ApplicationRecord
  include Taggable

  belongs_to :user
  has_many :comments
end

# Clean! All tagging logic lives in
# the Taggable concern.`,
			highlight: [2],
		});
		files.push({
			filename: 'app/models/comment.rb',
			language: 'ruby',
			code: `class Comment < ApplicationRecord
  include Taggable

  belongs_to :post
  belongs_to :user
end

# Clean! Same concern, same behavior,
# one source of truth.`,
			highlight: [2],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Legend (reward phase left panel)
// ──────────────────────────────────────────────

function ConcernLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Architecture Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">
						Shared behavior via Taggable concern
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Duplicated code (eliminated)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Observe phase: Model Zone component
// ──────────────────────────────────────────────

interface ModelZoneProps {
	id: string;
	name: string;
	inspected: boolean;
	highlighted: boolean;
	flowMessage?: string;
	showFlowMessage: boolean;
	disabled: boolean;
	onClick: (id: string) => void;
}

function ModelZone({
	id,
	name,
	inspected,
	highlighted,
	flowMessage,
	showFlowMessage,
	disabled,
	onClick,
}: ModelZoneProps) {
	return (
		<button
			type="button"
			className={`flex-1 border-2 rounded-lg p-4 text-left transition-all duration-300 cursor-pointer hover:ring-2 hover:ring-ring/30 ${
				highlighted
					? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
					: 'border-destructive/30 bg-card'
			} ${!inspected && !highlighted ? 'ring-1 ring-primary/20' : ''}`}
			disabled={disabled}
			onClick={() => onClick(id)}
		>
			<div className="flex items-center justify-between mb-2">
				<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
					{name}
				</span>
				{!inspected && !disabled && (
					<Search className="w-3.5 h-3.5 text-primary animate-pulse" />
				)}
			</div>

			{/* Duplicated code lines */}
			<div className="space-y-1">
				{DUPLICATED_CODE_LINES.map((line) => (
					<div
						key={line}
						className="text-xs font-mono text-destructive/80 bg-destructive/5 dark:bg-destructive/10 rounded px-2 py-1 border border-destructive/20"
					>
						{line}
					</div>
				))}
			</div>

			{/* Flow message */}
			{flowMessage && showFlowMessage && (
				<div
					className={`text-xs font-medium mt-2 text-destructive ${
						highlighted ? 'animate-in fade-in duration-300' : 'opacity-70'
					}`}
				>
					{flowMessage}
				</div>
			)}
		</button>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level17Concerns({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] =
		useState<StageInspectorData | null>(null);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	// ── Flow animation state (observe phase) ──
	const [flowPhase, setFlowPhase] = useState(-1);
	const [flowMessages, setFlowMessages] = useState<[string, string]>(['', '']);
	const flowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearFlow = useCallback(() => {
		for (const t of flowTimeoutsRef.current) clearTimeout(t);
		flowTimeoutsRef.current = [];
	}, []);

	const runFlow = useCallback(
		(messages: [string, string]) => {
			clearFlow();
			setFlowMessages(messages);
			// Phase 0: highlight Post, Phase 1: highlight Comment
			setFlowPhase(0);
			const t1 = setTimeout(() => setFlowPhase(1), 1000);
			const t2 = setTimeout(() => setFlowPhase(-1), 2500);
			flowTimeoutsRef.current.push(t1, t2);
		},
		[clearFlow],
	);

	useEffect(() => {
		return () => clearFlow();
	}, [clearFlow]);

	// ── Reward flow animation ──
	const [rewardFlowPhase, setRewardFlowPhase] = useState(-1);
	const [rewardFlowMessages, setRewardFlowMessages] = useState<[string, string, string]>(['', '', '']);
	const rewardFlowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearRewardFlow = useCallback(() => {
		for (const t of rewardFlowTimeoutsRef.current) clearTimeout(t);
		rewardFlowTimeoutsRef.current = [];
	}, []);

	const runRewardFlow = useCallback(
		(messages: [string, string, string]) => {
			clearRewardFlow();
			setRewardFlowMessages(messages);
			// Phase 0: models highlight, Phase 1: connectors, Phase 2: concern highlights
			setRewardFlowPhase(0);
			const t1 = setTimeout(() => setRewardFlowPhase(1), 600);
			const t2 = setTimeout(() => setRewardFlowPhase(2), 1200);
			const t3 = setTimeout(() => setRewardFlowPhase(-1), 2400);
			rewardFlowTimeoutsRef.current.push(t1, t2, t3);
		},
		[clearRewardFlow],
	);

	useEffect(() => {
		return () => clearRewardFlow();
	}, [clearRewardFlow]);

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

	// ── Stage click handler (observe phase) ──
	const handleStageClick = useCallback(
		(stageId: string) => {
			if (phase !== 'observe') return;
			if (flowPhase !== -1) return;

			const data = STAGE_INSPECTOR_MAP[stageId];
			if (!data) return;

			setInspectorData(data);
			setInspectedStages((prev) => {
				if (prev.has(stageId)) return prev;
				const next = new Set(prev);
				next.add(stageId);
				return next;
			});

			const discoveryId = STAGE_DISCOVERY_MAP[stageId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, flowPhase, discoveryGating],
	);

	// ── Scenario handler (observe phase) ──
	const handleScenario = useCallback(
		(scenarioId: string) => {
			const discoveryId = SCENARIO_DISCOVERY_MAP[scenarioId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
			const messages = OBSERVE_FLOW[scenarioId];
			if (messages) runFlow(messages);
		},
		[discoveryGating, runFlow],
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

	const handleActivateConcern = () => {
		setPhase('reward');
		stressTest.reset();
	};

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const messages = REWARD_FLOW[scenarioId];
			if (messages) runRewardFlow(messages);
		},
		[stressTest, runRewardFlow],
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
		return { valid: true, message: 'Concern extracted and included!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// Latest stress test result
	const lastResult = stressTest.results[stressTest.results.length - 1];

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your Post and Comment models both need tagging. Right
							now, both define the exact same{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								has_many :taggings
							</code>
							,{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								tagged_with
							</code>{' '}
							scope, and{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								tag_list
							</code>{' '}
							method. Every line is copy-pasted.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Extract the shared tagging behavior into a reusable
							ActiveSupport::Concern so both models stay DRY.
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

					{/* Reward phase: legend + counters */}
					{phase === 'reward' && (
						<>
							<ConcernLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Shared Ops</div>
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
					actNumber={3}
					levelName="Concerns & Modules"
					levelNumber={17}
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
							{/* Two model zones side by side + missing concern below */}
							<div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 relative">
								{/* Side-by-side model zones */}
								<div className="w-full max-w-2xl flex gap-4">
									<ModelZone
										id="post"
										name="Post Model"
										inspected={inspectedStages.has('post')}
										highlighted={flowPhase === 0}
										flowMessage={flowMessages[0]}
										showFlowMessage={flowPhase >= 0}
										disabled={flowPhase !== -1}
										onClick={handleStageClick}
									/>
									<ModelZone
										id="comment"
										name="Comment Model"
										inspected={inspectedStages.has('comment')}
										highlighted={flowPhase === 1}
										flowMessage={flowMessages[1]}
										showFlowMessage={flowPhase >= 1}
										disabled={flowPhase !== -1}
										onClick={handleStageClick}
									/>
								</div>

								{/* Missing Concern zone (dashed) */}
								<button
									type="button"
									className={`w-full max-w-2xl border-2 border-dashed rounded-lg p-3 text-center transition-all duration-300 cursor-pointer hover:ring-2 hover:ring-ring/30 ${
										inspectedStages.has('concern')
											? 'border-muted-foreground/30 bg-muted/20 dark:bg-muted/10'
											: 'border-muted-foreground/30 bg-muted/20 dark:bg-muted/10 ring-1 ring-primary/20'
									}`}
									disabled={flowPhase !== -1}
									onClick={() => handleStageClick('concern')}
								>
									<div className="flex items-center justify-center gap-2">
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											Shared Module
										</span>
										<span className="text-xs text-destructive font-medium">
											(missing!)
										</span>
										{!inspectedStages.has('concern') && flowPhase === -1 && (
											<Search className="w-3.5 h-3.5 text-primary animate-pulse" />
										)}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										No concern exists. Each model duplicates the same code.
									</p>
								</button>

								{/* Stage Inspector overlay */}
								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							{/* Scenario cards */}
							<div className="px-6 pb-2">
								<ScenarioCards
									scenarios={SCENARIOS}
									onSelect={handleScenario}
									disabled={flowPhase !== -1}
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
									The Taggable concern is extracted. Both models now share
									one source of truth for tagging behavior.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateConcern}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Concern
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward (ADVANTAGE sub-phase b) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							{/* Three-zone layout: models -> concern */}
							<div className="flex-1 flex flex-col items-center justify-center px-6 gap-3">
								{/* Model zones side by side (now clean) */}
								<div className="w-full max-w-2xl flex gap-4">
									{/* Post Model (clean) */}
									<div
										className={`flex-1 border-2 rounded-lg p-4 transition-all duration-300 ${
											rewardFlowPhase === 0 && rewardFlowMessages[0]
												? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10 border-success/50'
												: 'border-success/30 bg-success/5 dark:bg-success/10'
										}`}
									>
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											Post Model
										</div>
										<pre className="text-xs font-mono text-foreground">
											include Taggable
										</pre>
										<div className="mt-1 text-xs text-success font-medium">
											Clean (6 lines)
										</div>
										{rewardFlowMessages[0] && rewardFlowPhase >= 0 && (
											<div
												className={`text-xs font-medium mt-1.5 text-primary ${
													rewardFlowPhase === 0
														? 'animate-in fade-in duration-300'
														: 'opacity-70'
												}`}
											>
												{rewardFlowMessages[0]}
											</div>
										)}
									</div>

									{/* Comment Model (clean) */}
									<div
										className={`flex-1 border-2 rounded-lg p-4 transition-all duration-300 ${
											rewardFlowPhase === 0 && rewardFlowMessages[2]
												? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10 border-success/50'
												: 'border-success/30 bg-success/5 dark:bg-success/10'
										}`}
									>
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											Comment Model
										</div>
										<pre className="text-xs font-mono text-foreground">
											include Taggable
										</pre>
										<div className="mt-1 text-xs text-success font-medium">
											Clean (6 lines)
										</div>
										{rewardFlowMessages[2] && rewardFlowPhase >= 0 && (
											<div
												className={`text-xs font-medium mt-1.5 text-primary ${
													rewardFlowPhase === 0
														? 'animate-in fade-in duration-300'
														: 'opacity-70'
												}`}
											>
												{rewardFlowMessages[2]}
											</div>
										)}
									</div>
								</div>

								{/* Flow connectors (both models down to concern) */}
								<div className="flex gap-4 w-full max-w-2xl">
									<div className="flex-1 flex justify-center">
										<FlowConnector
											active={rewardFlowPhase === 1}
											dotColor="bg-success"
										/>
									</div>
									<div className="flex-1 flex justify-center">
										<FlowConnector
											active={rewardFlowPhase === 1}
											dotColor="bg-success"
										/>
									</div>
								</div>

								{/* Taggable Concern zone */}
								<div
									className={`w-full max-w-2xl border-2 rounded-lg p-4 text-center transition-all duration-300 ${
										rewardFlowPhase === 2
											? 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success/50 bg-success/5 dark:bg-success/10'
											: 'border-success/30 bg-success/5 dark:bg-success/10'
									}`}
								>
									<div className="flex items-center justify-center gap-2 mb-2">
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											Taggable Concern
										</span>
										{lastResult && (
											<span className="text-xs font-mono text-success font-bold">
												DRY
											</span>
										)}
									</div>
									<div className="flex flex-wrap gap-1.5 justify-center">
										{DUPLICATED_CODE_LINES.map((line) => (
											<div
												key={line}
												className="text-xs font-mono text-success/80 bg-success/5 dark:bg-success/10 rounded px-2 py-1 border border-success/20"
											>
												{line}
											</div>
										))}
									</div>
									{rewardFlowMessages[1] && rewardFlowPhase >= 2 && (
										<div
											className={`text-xs font-medium mt-2 text-success ${
												rewardFlowPhase === 2
													? 'animate-in fade-in duration-300'
													: 'opacity-70'
											}`}
										>
											{rewardFlowMessages[1]}
										</div>
									)}
								</div>
							</div>

							{/* Stress test controls */}
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
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level17Concerns;
