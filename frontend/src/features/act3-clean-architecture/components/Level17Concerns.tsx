/**
 * Level 17: Concerns & Modules
 *
 * Sequential phase flow: intro -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - intro): Static annotated code display (Type 2).
 *   Side-by-side annotated code blocks showing identical tagging methods
 *   in Product and Review with destructive left borders. Callout states
 *   the structural problem. "Build the Fix" always visible (no gating).
 * Phase 2 (HOW - build): 3 OptionCard steps
 *   Step 0: Choose where to put shared behavior (ActiveSupport::Concern)
 *   Step 1: Define the concern's included block (has_many + scope + methods)
 *   Step 2: Include the concern in models (include Taggable)
 * Phase 3 (ADVANTAGE - reward): Same side-by-side layout as intro, now
 *   showing clean models with "include Taggable" (green borders) and the
 *   extracted Taggable concern below. "Problems Solved" checklist.
 *
 * Visualization approach: Type 2 static intro (refactoring concept).
 * The code duplication is self-evident by reading the two files.
 *
 * Teaches: ActiveSupport::Concern, DRY, included block, module extraction
 */

import { ArrowRight, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { shuffleOptions } from '@/lib/shuffleOptions';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Annotated code sections (intro + reward)
// ──────────────────────────────────────────────

interface AnnotatedSection {
	id: string;
	label: string;
	variant: 'core' | 'duplicated';
	code: string;
}

const POST_SECTIONS: AnnotatedSection[] = [
	{
		id: 'post-core',
		label: 'Core',
		variant: 'core',
		code: 'belongs_to :user\nhas_many :reviews',
	},
	{
		id: 'post-tagging-assoc',
		label: 'Duplicated: Associations',
		variant: 'duplicated',
		code: 'has_many :taggings, as: :taggable\nhas_many :tags, through: :taggings',
	},
	{
		id: 'post-tagging-scope',
		label: 'Duplicated: Scope',
		variant: 'duplicated',
		code: 'scope :tagged_with, ->(name) {\n  joins(:tags).where(tags: { name: name })\n}',
	},
	{
		id: 'post-tagging-methods',
		label: 'Duplicated: Methods',
		variant: 'duplicated',
		code: 'def tag_list\n  tags.map(&:name).join(", ")\nend\n\ndef tag_list=(names)\n  self.tags = names.split(",").map { |n|\n    Tag.find_or_create_by(name: n.strip)\n  }\nend',
	},
];

const COMMENT_SECTIONS: AnnotatedSection[] = [
	{
		id: 'review-core',
		label: 'Core',
		variant: 'core',
		code: 'belongs_to :product\nbelongs_to :user',
	},
	{
		id: 'review-tagging-assoc',
		label: 'Duplicated: Associations',
		variant: 'duplicated',
		code: 'has_many :taggings, as: :taggable\nhas_many :tags, through: :taggings',
	},
	{
		id: 'review-tagging-scope',
		label: 'Duplicated: Scope',
		variant: 'duplicated',
		code: 'scope :tagged_with, ->(name) {\n  joins(:tags).where(tags: { name: name })\n}',
	},
	{
		id: 'review-tagging-methods',
		label: 'Duplicated: Methods',
		variant: 'duplicated',
		code: 'def tag_list\n  tags.map(&:name).join(", ")\nend\n\ndef tag_list=(names)\n  self.tags = names.split(",").map { |n|\n    Tag.find_or_create_by(name: n.strip)\n  }\nend',
	},
];

function AnnotatedCodeBlock({
	modelName,
	sections,
	borderColor,
}: {
	modelName: string;
	sections: AnnotatedSection[];
	borderColor: 'destructive' | 'success';
}) {
	const isDestructive = borderColor === 'destructive';
	return (
		<div className="flex-1 space-y-1.5">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
				{modelName}
			</div>
			{sections.map((section) => {
				const isDuplicated = section.variant === 'duplicated';
				const borderClass = isDuplicated
					? isDestructive
						? 'border-l-destructive bg-destructive/5 dark:bg-destructive/10'
						: 'border-l-success bg-success/5 dark:bg-success/10'
					: 'border-l-zinc-400 dark:border-l-zinc-600 bg-muted/30';
				const badgeClass = isDuplicated
					? isDestructive
						? 'border-destructive/50 text-destructive bg-destructive/10'
						: 'border-success/50 text-success bg-success/10'
					: 'border-zinc-400/50 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800';

				return (
					<div
						className={`border-l-2 rounded-r-md px-3 py-2 ${borderClass}`}
						key={section.id}
					>
						<Badge
							className={`text-[10px] mb-1 ${badgeClass}`}
							variant="outline"
						>
							{section.label}
						</Badge>
						<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
							{section.code}
						</pre>
					</div>
				);
			})}
		</div>
	);
}

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
			'Ruby only supports single inheritance. Product already inherits from ApplicationRecord, so it cannot also inherit from TaggableRecord.',
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
			'The associations are correct, but the tagged_with scope, tag_list, and tag_list= methods are also duplicated. Extract everything that is shared.',
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

  def tag_list=(names)
    self.tags = names.split(",").map { |n|
      Tag.find_or_create_by(name: n.strip)
    }
  end
end`,
		correct: true,
	},
];

// Step 2: Include the concern in models
const INCLUDE_OPTIONS: StepOption[] = [
	{
		id: 'require-extend',
		label: `class Product < ApplicationRecord
  require "taggable"
  extend Taggable
end`,
		correct: false,
		feedback:
			'extend adds module methods as class methods, not instance methods. And Rails auto-loads concerns from app/models/concerns, so require is unnecessary.',
	},
	{
		id: 'prepend',
		label: `class Product < ApplicationRecord
  prepend Taggable
end`,
		correct: false,
		feedback:
			'prepend changes method lookup order but does not trigger the included block. The concern needs include to run its associations and scopes.',
	},
	{
		id: 'include-taggable',
		label: `class Product < ApplicationRecord
  include Taggable

  belongs_to :user
  has_many :reviews
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
			'Product and Review have identical tagging code. You need to extract this shared behavior into a reusable module. What pattern does Rails provide for this?',
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

	// Intro phase: show duplicated code in both models
	if (phase === 'intro') {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  belongs_to :user
  has_many :reviews

  # Tagging (duplicated!)
  has_many :taggings, as: :taggable
  has_many :tags, through: :taggings

  scope :tagged_with, ->(name) {
    joins(:tags).where(tags: { name: name })
  }

  def tag_list
    tags.map(&:name).join(", ")
  end

  def tag_list=(names)
    self.tags = names.split(",").map { |n|
      Tag.find_or_create_by(name: n.strip)
    }
  end
end`,
			highlight: [6, 7, 9, 10, 13, 14, 17, 18, 19, 20],
		});
		files.push({
			filename: 'app/models/review.rb',
			language: 'ruby',
			code: `class Review < ApplicationRecord
  belongs_to :product
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

  def tag_list=(names)
    self.tags = names.split(",").map { |n|
      Tag.find_or_create_by(name: n.strip)
    }
  end
end`,
			highlight: [6, 7, 9, 10, 13, 14, 17, 18, 19, 20],
		});
		return files;
	}

	// Build / reward phases: show evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  belongs_to :user
  has_many :reviews

  # Tagging (duplicated!)
  has_many :taggings, as: :taggable
  has_many :tags, through: :taggings

  scope :tagged_with, ->(name) {
    joins(:tags).where(tags: { name: name })
  }

  def tag_list
    tags.map(&:name).join(", ")
  end

  def tag_list=(names)
    self.tags = names.split(",").map { |n|
      Tag.find_or_create_by(name: n.strip)
    }
  end
end`,
			highlight: [6, 7, 9, 10, 13, 14, 17, 18, 19, 20],
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

  def tag_list=(names)
    self.tags = names.split(",").map { |n|
      Tag.find_or_create_by(name: n.strip)
    }
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
				furthestStep >= 2 ? [5, 6, 7, 9, 10, 14, 15, 18, 19, 20, 21] : [5],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  include Taggable

  belongs_to :user
  has_many :reviews
end

# Clean! All tagging logic lives in
# the Taggable concern.`,
			highlight: [2],
		});
		files.push({
			filename: 'app/models/review.rb',
			language: 'ruby',
			code: `class Review < ApplicationRecord
  include Taggable

  belongs_to :product
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
// Component
// ──────────────────────────────────────────────

export function Level17Concerns({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [phase, setPhase] = useState<Phase>('intro');

	// ── OptionCard step handler ──
	const handleOptionClick = (option: StepOption) => {
		if (option.correct) {
			stepper.completeStep();
		} else if (option.feedback) {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
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
		return { valid: true, message: 'Concern extracted and included!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
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
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your Product and Review models both need tagging. Right now, both
							define the exact same{' '}
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

					{/* Build phases: step progress */}
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
					{/* ── Phase 1: Intro (WHY) ── */}
					{phase === 'intro' && (
						<div className="flex-1 flex flex-col overflow-auto">
							<div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
								{/* Header */}
								<div className="text-center">
									<h3 className="text-lg font-semibold text-foreground">
										The Problem: Duplicated Tagging Code
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										Two models, same 4 methods, same bugs to fix twice
									</p>
								</div>

								{/* Side-by-side annotated code */}
								<div className="w-full max-w-3xl flex gap-4">
									<AnnotatedCodeBlock
										borderColor="destructive"
										modelName="app/models/product.rb"
										sections={POST_SECTIONS}
									/>
									<AnnotatedCodeBlock
										borderColor="destructive"
										modelName="app/models/review.rb"
										sections={COMMENT_SECTIONS}
									/>
								</div>

								{/* Callout */}
								<div className="w-full max-w-3xl rounded-lg border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 p-3">
									<p className="text-sm text-destructive font-medium">
										Same 4 methods in both models. Fix a bug? Fix it twice. Add
										a third model? Copy-paste again. No single source of truth
										to test or review.
									</p>
								</div>

								{/* Build the Fix button (always visible) */}
								<Button className="gap-2" onClick={handleStartBuild} size="lg">
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

								{isViewingCompletedStep && (
									<div className="flex justify-end">
										<Button
											className="gap-2"
											onClick={
												hasNextStep
													? stepper.nextStep
													: () => {
															setPhase('reward');
														}
											}
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

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col overflow-auto">
							<div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
								{/* Header */}
								<div className="text-center">
									<h3 className="text-lg font-semibold text-foreground">
										The Fix: Taggable Concern
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										Shared behavior extracted, models stay clean
									</p>
								</div>

								{/* Side-by-side clean models */}
								<div className="w-full max-w-3xl flex gap-4">
									{/* Product (clean) */}
									<div className="flex-1 space-y-1.5">
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											app/models/product.rb
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-3 py-2">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Delegates to Concern
											</Badge>
											<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
												include Taggable
											</pre>
										</div>
										<div className="border-l-2 border-l-zinc-400 dark:border-l-zinc-600 bg-muted/30 rounded-r-md px-3 py-2">
											<Badge
												className="text-[10px] mb-1 border-zinc-400/50 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800"
												variant="outline"
											>
												Core
											</Badge>
											<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
												belongs_to :user{'\n'}has_many :reviews
											</pre>
										</div>
										<div className="mt-1 text-xs text-success font-medium px-3">
											Clean (6 lines)
										</div>
									</div>

									{/* Review (clean) */}
									<div className="flex-1 space-y-1.5">
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											app/models/review.rb
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-3 py-2">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Delegates to Concern
											</Badge>
											<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
												include Taggable
											</pre>
										</div>
										<div className="border-l-2 border-l-zinc-400 dark:border-l-zinc-600 bg-muted/30 rounded-r-md px-3 py-2">
											<Badge
												className="text-[10px] mb-1 border-zinc-400/50 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800"
												variant="outline"
											>
												Core
											</Badge>
											<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
												belongs_to :product{'\n'}belongs_to :user
											</pre>
										</div>
										<div className="mt-1 text-xs text-success font-medium px-3">
											Clean (6 lines)
										</div>
									</div>
								</div>

								{/* Taggable Concern zone */}
								<div className="w-full max-w-3xl border-2 border-success/30 bg-success/5 dark:bg-success/10 rounded-lg p-4">
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">
										app/models/concerns/taggable.rb
									</div>
									<div className="grid grid-cols-3 gap-2">
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-2 py-1.5">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Associations
											</Badge>
											<pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">
												has_many :taggings{'\n'}has_many :tags
											</pre>
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-2 py-1.5">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Scope
											</Badge>
											<pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">
												scope :tagged_with
											</pre>
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-2 py-1.5">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Methods
											</Badge>
											<pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">
												def tag_list{'\n'}def tag_list=
											</pre>
										</div>
									</div>
								</div>

								{/* Problems Solved checklist */}
								<div className="w-full max-w-3xl rounded-lg border border-success/30 bg-success/5 dark:bg-success/10 p-3">
									<div className="text-xs font-semibold text-success uppercase tracking-wider mb-2">
										Problems Solved
									</div>
									<div className="space-y-2">
										<div className="flex items-start gap-2">
											<Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
											<p className="text-sm text-foreground">
												<span className="font-medium">
													Fix once, applies everywhere.
												</span>{' '}
												<span className="text-muted-foreground">
													Change the Taggable concern, both Product and Review
													update automatically.
												</span>
											</p>
										</div>
										<div className="flex items-start gap-2">
											<Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
											<p className="text-sm text-foreground">
												<span className="font-medium">
													Add Article model with tagging.
												</span>{' '}
												<span className="text-muted-foreground">
													Just{' '}
													<code className="text-xs bg-muted px-1 py-0.5 rounded">
														include Taggable
													</code>
													, done. No copy-paste.
												</span>
											</p>
										</div>
										<div className="flex items-start gap-2">
											<Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
											<p className="text-sm text-foreground">
												<span className="font-medium">
													One file to audit and test.
												</span>{' '}
												<span className="text-muted-foreground">
													All tagging logic lives in{' '}
													<code className="text-xs bg-muted px-1 py-0.5 rounded">
														app/models/concerns/taggable.rb
													</code>
													.
												</span>
											</p>
										</div>
									</div>
								</div>
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
							? STEP_DEFS.length
							: stepper.isCurrentStepCompleted
								? stepper.currentStep
								: stepper.currentStep - 1,
					)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level17Concerns;
