/**
 * Level 17: Concerns & Modules
 *
 * Sequential phase flow: intro -> build -> reward (Type 2: the problem
 * is code structure, visible by reading the two files side by side).
 *
 * Redesign (2026-07-10):
 *   - The shared behavior is now Flaggable (flag-count moderation with
 *     auto-hide on Product and Review), replacing the old polymorphic
 *     Taggable example, which pre-baked the polymorphic-associations
 *     level's concept (`as: :taggable`) thirteen levels early. Flaggable
 *     uses only concepts taught by L17: scopes, plain methods,
 *     increment!/update!.
 *   - Duplication is dramatized as DRIFT, not asserted: Product's copy
 *     was fixed after the spring spam wave (threshold 3 + auto-hide);
 *     Review's copy never got the fix (threshold 5, no auto-hide). A
 *     scam review survived the weekend at 4 flags while the same
 *     scammer's product listing auto-hid at 3. Extracting the concern
 *     keeps the FIXED behavior and kills the drift permanently.
 *   - Step 1 is no longer a longest-option giveaway: all three options
 *     are full-length concern definitions differing in mechanism (class
 *     macros at module level / everything inside the included block /
 *     the canonical split).
 *   - Models anchored to myapp level-15 (Product with validations,
 *     string enum, normalizes; Review with belongs_to :product).
 *   - The reward is interactive: scenarios replay the weekend incident
 *     with the fix and demonstrate change-once-applies-everywhere.
 *
 * Concern shape verified against the ActiveSupport::Concern API docs
 * (api.rubyonrails.org/classes/ActiveSupport/Concern.html): `included
 * do` evaluates in the including class for class macros; instance
 * methods live in the module body; prepend fires `prepended`, not
 * `included`.
 */

import { ArrowRight, Check, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';
import {
	type ConcernEdgeState,
	ConcernFlow,
	type ConcernVizState,
	type ModelKey,
	type ModelVizState,
} from './ConcernFlow';

registerLevelCode('act3-level17-concerns', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Annotated code sections (intro phase): the drift, side by side
// ──────────────────────────────────────────────

interface AnnotatedSection {
	id: string;
	label: string;
	variant: 'core' | 'copy' | 'drift';
	code: string;
}

const PRODUCT_SECTIONS: AnnotatedSection[] = [
	{
		id: 'product-core',
		label: 'Core',
		variant: 'core',
		code: 'belongs_to :user\nhas_many :reviews, dependent: :destroy\n# validations, enum, normalizes...',
	},
	{
		id: 'product-scopes',
		label: 'Copy A: scopes',
		variant: 'copy',
		code: 'scope :visible, -> { where(hidden: false) }\nscope :flagged, -> {\n  where("flags_count >= ?", 3)\n}',
	},
	{
		id: 'product-flag',
		label: 'Copy A: flag! (fixed after the spam wave)',
		variant: 'copy',
		code: 'def flag!\n  increment!(:flags_count)\n  update!(hidden: true) if flags_count >= 3\nend',
	},
];

const REVIEW_SECTIONS: AnnotatedSection[] = [
	{
		id: 'review-core',
		label: 'Core',
		variant: 'core',
		code: 'belongs_to :product',
	},
	{
		id: 'review-scopes',
		label: 'Copy B: threshold never updated',
		variant: 'drift',
		code: 'scope :visible, -> { where(hidden: false) }\nscope :flagged, -> {\n  where("flags_count >= ?", 5)\n}',
	},
	{
		id: 'review-flag',
		label: 'Copy B: auto-hide never arrived',
		variant: 'drift',
		code: 'def flag!\n  increment!(:flags_count)\nend',
	},
];

function AnnotatedCodeBlock({
	modelName,
	sections,
}: {
	modelName: string;
	sections: AnnotatedSection[];
}) {
	return (
		<div className="flex-1 space-y-1.5">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
				{modelName}
			</div>
			{sections.map((section) => {
				const style =
					section.variant === 'drift'
						? {
								border:
									'border-l-destructive bg-destructive/5 dark:bg-destructive/10',
								badge:
									'border-destructive/50 text-destructive bg-destructive/10',
							}
						: section.variant === 'copy'
							? {
									border: 'border-l-warning bg-warning/5 dark:bg-warning/10',
									badge: 'border-warning/50 text-warning bg-warning/10',
								}
							: {
									border:
										'border-l-zinc-400 dark:border-l-zinc-600 bg-muted/30',
									badge:
										'border-zinc-400/50 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800',
								};
				return (
					<div
						className={`border-l-2 rounded-r-md px-3 py-2 ${style.border}`}
						key={section.id}
					>
						<Badge
							className={`text-[10px] mb-1 ${style.badge}`}
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

export const STEP_DEFS: StepDef[] = [
	{ id: 'choose-pattern', title: 'Choose Extraction Pattern' },
	{ id: 'define-concern', title: 'Define the Concern' },
	{ id: 'include-concern', title: 'Adopt It in the Models' },
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

const PATTERN_OPTIONS: StepOption[] = [
	{
		id: 'plain-module',
		label: 'A plain Ruby module with a hand-written self.included(base) hook',
		correct: false,
		feedback:
			'A plain module can carry the methods, but the class-level pieces (the scopes) need hand-wired hooks and base.class_eval that every future reader has to decode. Rails ships a cleaner convention for exactly this shape.',
	},
	{
		id: 'base-class',
		label: 'A FlaggableRecord base class both models inherit from',
		correct: false,
		feedback:
			'Ruby has single inheritance, and both models already inherit from ApplicationRecord. Flagging is also not an is-a relationship: a Review is not a kind of FlaggableRecord.',
	},
	{
		id: 'concern',
		label:
			"Extract into ActiveSupport::Concern (Rails' shared-behavior module)",
		correct: true,
	},
];

const CONCERN_OPTIONS: StepOption[] = [
	{
		id: 'module-level-macros',
		label: `module Flaggable
  extend ActiveSupport::Concern

  FLAG_THRESHOLD = 3

  scope :visible, -> { where(hidden: false) }
  scope :flagged, -> {
    where("flags_count >= ?", FLAG_THRESHOLD)
  }

  def flag!
    increment!(:flags_count)
    update!(hidden: true) if flags_count >= FLAG_THRESHOLD
  end

  def visible?
    !hidden
  end
end`,
		correct: false,
		feedback:
			'scope is a class-level macro. Called at the module level it runs on the module itself, which has no such method, so this file raises NoMethodError the moment it loads. Class macros need somewhere that executes in the including class.',
	},
	{
		id: 'everything-in-block',
		label: `module Flaggable
  extend ActiveSupport::Concern

  included do
    FLAG_THRESHOLD = 3

    scope :visible, -> { where(hidden: false) }
    scope :flagged, -> {
      where("flags_count >= ?", FLAG_THRESHOLD)
    }

    def flag!
      increment!(:flags_count)
      update!(hidden: true) if flags_count >= FLAG_THRESHOLD
    end

    def visible?
      !hidden
    end
  end
end`,
		correct: false,
		feedback:
			'It runs, but everything here is re-evaluated into every including model: the constant lands on Product and Review separately, and tooling can no longer see where flag! is defined. The block exists for class macros, not for ordinary methods.',
	},
	{
		id: 'canonical-split',
		label: `module Flaggable
  extend ActiveSupport::Concern

  FLAG_THRESHOLD = 3

  included do
    scope :visible, -> { where(hidden: false) }
    scope :flagged, -> {
      where("flags_count >= ?", FLAG_THRESHOLD)
    }
  end

  def flag!
    increment!(:flags_count)
    update!(hidden: true) if flags_count >= FLAG_THRESHOLD
  end

  def visible?
    !hidden
  end
end`,
		correct: true,
	},
];

const INCLUDE_OPTIONS: StepOption[] = [
	{
		id: 'extend-module',
		label: `class Product < ApplicationRecord
  extend Flaggable
end`,
		correct: false,
		feedback:
			"extend attaches the module's methods as class methods: Product.flag! would exist while product.flag! would not, and the concern's class-level setup hook never fires.",
	},
	{
		id: 'prepend-module',
		label: `class Product < ApplicationRecord
  prepend Flaggable
end`,
		correct: false,
		feedback:
			"prepend inserts the module ahead of the class in method lookup and fires a different hook, so this concern's scopes are never defined on the model.",
	},
	{
		id: 'include-module',
		label: `class Product < ApplicationRecord
  include Flaggable

  belongs_to :user
  has_many :reviews, dependent: :destroy
end`,
		correct: true,
	},
];

export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	0: {
		title: 'Choose Extraction Pattern',
		description:
			'Product and Review each carry their own copy of the flagging behavior, and the copies have already drifted apart once. The behavior needs exactly one home that both models adopt. What shape should that home take?',
		options: PATTERN_OPTIONS,
	},
	1: {
		title: 'Define the Concern',
		description:
			'The concern carries two kinds of things: class-level macros (the scopes) and ordinary instance methods (flag!, visible?). All three definitions below contain the same FIXED behavior; only the structure differs. Which one is right?',
		options: CONCERN_OPTIONS,
	},
	2: {
		title: 'Adopt It in the Models',
		description:
			'Flaggable is defined with the fixed behavior. Now each model adopts it, deleting its own copy. How does a model take on a concern so the setup hook runs and the methods land as instance methods?',
		options: INCLUDE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Reward: scenarios + frames
// ──────────────────────────────────────────────

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'scam-review',
		label: 'A scam review collects its third flag',
		description: 'Auto-hide fires for reviews now, same as products',
		method: 'POST',
		path: '/reviews/81/flags',
		actor: 'customers',
		expectedResult: 'blocked',
		story: [
			'Same scam review as the weekend incident: "text the seller directly and save 20%".',
			'Three customers flag it. flag! now comes from Flaggable, the same method products use.',
			'The third flag crosses FLAG_THRESHOLD and auto-hide fires: hidden becomes true on the spot.',
			'The scam disappears from the storefront in seconds instead of surviving the weekend at four flags.',
		],
	},
	{
		id: 'browse-hidden',
		label: 'Customer opens a product with hidden reviews',
		description: 'The visible scope filters hidden rows on every model',
		method: 'GET',
		path: '/products/42',
		actor: 'customer',
		expectedResult: 'allowed',
		story: [
			'A customer opens a product whose review section once held the scam.',
			'The controller loads reviews through the visible scope the concern defines.',
			'Hidden rows never leave the database; the page renders only clean reviews.',
			'One scope definition serves every flaggable model identically.',
		],
	},
	{
		id: 'tighten-threshold',
		label: 'Tighten the threshold during a spam wave',
		description: 'One constant edited; every model changes together',
		method: 'EDIT',
		path: 'app/models/concerns/flaggable.rb',
		actor: 'on-call developer',
		expectedResult: 'allowed',
		story: [
			'A spam wave hits and moderation wants faster hiding: threshold 3 drops to 2.',
			'One constant changes, in one file.',
			'Products and reviews pick up the new threshold at the same moment. There is no second copy to chase, which is exactly how the weekend drift happened last time.',
			'The class of bug this level opened with is now structurally impossible.',
		],
	},
	{
		id: 'extend-answers',
		label: 'Give seller Q&A answers flagging next sprint',
		description: 'One include line; the whole behavior arrives at once',
		method: 'PLAN',
		path: 'app/models/answer.rb',
		actor: 'product team',
		expectedResult: 'allowed',
		story: [
			'Next sprint ships seller Q&A, and answers are user-generated content too.',
			'Flagging them is one line in the new model: adopt the concern.',
			'Scopes, flag!, auto-hide, and the threshold all arrive together, identical to products and reviews.',
			'No copy-paste, so no third copy to drift.',
		],
	},
];

export type RewardFrame = {
	models?: Partial<Record<ModelKey, Partial<ModelVizState>>>;
	concern?: Partial<ConcernVizState>;
	edges?: Partial<Record<ModelKey, Partial<ConcernEdgeState>>>;
};

export const REWARD_SCENARIO_FRAMES: Record<string, RewardFrame[]> = {
	'scam-review': [
		{
			models: {
				review: {
					sublabel: 'scam review reaches 3 flags',
					badge: '3/3',
					flash: 'amber',
				},
			},
			edges: {
				review: { active: true, reverse: false, label: 'flag!' },
			},
		},
		{
			concern: {
				sublabel: 'threshold crossed: auto-hide fires',
				badge: 'FLAG_THRESHOLD',
				flash: 'amber',
			},
			edges: { review: { active: false, label: '' } },
		},
		{
			models: {
				review: {
					sublabel: 'hidden: true, gone from the storefront',
					badge: 'HIDDEN',
					flash: 'red',
				},
			},
			concern: {
				sublabel: 'same behavior for every model, no copy to drift',
				badge: null,
				flash: 'green',
			},
			edges: {
				review: { active: true, reverse: true, label: 'update!(hidden: true)' },
			},
		},
	],
	'browse-hidden': [
		{
			models: {
				product: {
					sublabel: 'customer opens the product page',
					badge: 'GET',
					flash: 'amber',
				},
			},
			edges: {
				product: { active: true, reverse: false, label: 'Review.visible' },
			},
		},
		{
			concern: {
				sublabel: 'visible scope: where(hidden: false)',
				badge: 'SCOPE',
				flash: 'amber',
			},
			edges: { product: { active: false, label: '' } },
		},
		{
			models: {
				product: {
					sublabel: 'page renders only clean reviews',
					badge: '200',
					flash: 'green',
				},
				review: {
					sublabel: 'hidden rows never leave the database',
					badge: 'FILTERED',
					flash: 'green',
				},
			},
			concern: { sublabel: 'one scope serves every model', flash: 'green' },
			edges: {
				product: { active: true, reverse: true, label: 'clean reviews only' },
			},
		},
	],
	'tighten-threshold': [
		{
			concern: {
				sublabel: 'spam wave: threshold 3 drops to 2',
				badge: 'ONE EDIT',
				flash: 'amber',
			},
		},
		{
			models: {
				product: {
					sublabel: 'auto-hides at 2 flags now',
					badge: 'UPDATED',
					flash: 'green',
				},
				review: {
					sublabel: 'auto-hides at 2 flags now',
					badge: 'UPDATED',
					flash: 'green',
				},
			},
			edges: {
				product: { active: true, reverse: true, label: 'new threshold' },
				review: { active: true, reverse: true, label: 'new threshold' },
			},
		},
		{
			concern: {
				sublabel: 'one file changed, zero copies chased',
				badge: 'DONE',
				flash: 'green',
			},
			edges: {
				product: { active: false, label: '' },
				review: { active: false, label: '' },
			},
		},
	],
	'extend-answers': [
		{
			concern: {
				sublabel: 'seller Q&A answers need flagging next sprint',
				badge: 'NEW MODEL',
				flash: 'amber',
			},
		},
		{
			concern: {
				sublabel: 'one include line in the new model, whole behavior arrives',
				badge: 'x3',
				flash: 'green',
			},
			models: {
				product: { sublabel: 'unchanged', badge: null, flash: 'green' },
				review: { sublabel: 'unchanged', badge: null, flash: 'green' },
			},
		},
	],
};

const BASE_MODELS: Record<ModelKey, ModelVizState> = {
	product: {
		sublabel: 'listings on the storefront',
		badge: null,
		flash: 'idle',
	},
	review: { sublabel: 'customer reviews', badge: null, flash: 'idle' },
};

const BASE_CONCERN: ConcernVizState = {
	sublabel: 'flagging defined once',
	badge: null,
	flash: 'idle',
};

const IDLE_EDGE: ConcernEdgeState = {
	active: false,
	reverse: false,
	label: '',
};

const BASE_EDGES: Record<ModelKey, ConcernEdgeState> = {
	product: IDLE_EDGE,
	review: IDLE_EDGE,
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

// Anchored to myapp level-15, plus the flagging columns and code the
// moderation sprint added (the level's opening fiction).
const FAT_PRODUCT = `class Product < ApplicationRecord
  belongs_to :user
  has_many :reviews, dependent: :destroy

  normalizes :name, with: ->(n) { n.strip }

  validates :name, presence: true, length: { minimum: 3, maximum: 255 }
  validates :description, presence: true, length: { minimum: 10 }
  validates :price, presence: true, numericality: { greater_than: 0 }

  enum :status, draft: "draft", listed: "listed", sold: "sold"

  # Flagging (added when moderation shipped;
  # auto-hide added after the spring spam wave)
  scope :visible, -> { where(hidden: false) }
  scope :flagged, -> { where("flags_count >= ?", 3) }

  def flag!
    increment!(:flags_count)
    update!(hidden: true) if flags_count >= 3
  end

  def visible?
    !hidden
  end
end`;

const FAT_REVIEW = `class Review < ApplicationRecord
  belongs_to :product

  # Flagging (copy-pasted from Product when moderation shipped)
  scope :visible, -> { where(hidden: false) }
  scope :flagged, -> { where("flags_count >= ?", 5) }

  def flag!
    increment!(:flags_count)
  end

  def visible?
    !hidden
  end
end`;

const CONCERN_COMPLETE = `module Flaggable
  extend ActiveSupport::Concern

  FLAG_THRESHOLD = 3

  included do
    scope :visible, -> { where(hidden: false) }
    scope :flagged, -> {
      where("flags_count >= ?", FLAG_THRESHOLD)
    }
  end

  def flag!
    increment!(:flags_count)
    update!(hidden: true) if flags_count >= FLAG_THRESHOLD
  end

  def visible?
    !hidden
  end
end`;

export function getCodeFiles(phase: Phase, completedStep: number) {
	const files = [];

	if (phase === 'intro' || completedStep < 0) {
		return [
			{
				filename: 'app/models/product.rb',
				language: 'ruby',
				code: FAT_PRODUCT,
				highlight: [16, 17, 19, 20, 21, 22],
			},
			{
				filename: 'app/models/review.rb',
				language: 'ruby',
				code: FAT_REVIEW,
				highlight: [5, 6, 8, 9, 10],
			},
		];
	}

	if (completedStep === 0) {
		files.push({
			filename: 'app/models/concerns/flaggable.rb',
			language: 'ruby',
			code: `module Flaggable
  extend ActiveSupport::Concern

  # Two kinds of things need a home here:
  #   - the scopes (class-level macros)
  #   - flag! and visible? (instance methods)
  # Where does each one go?
end`,
			highlight: [4, 5, 6, 7],
		});
	}

	if (completedStep >= 1) {
		files.push({
			filename: 'app/models/concerns/flaggable.rb',
			language: 'ruby',
			code:
				completedStep >= 2
					? CONCERN_COMPLETE
					: `${CONCERN_COMPLETE}

# Both models still carry their own drifted copies.
# How do they adopt this instead?`,
			highlight: [4, 6, 7, 8, 9, 10, 11],
		});
	}

	if (completedStep < 2) {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: FAT_PRODUCT,
			highlight: [],
		});
		files.push({
			filename: 'app/models/review.rb',
			language: 'ruby',
			code: FAT_REVIEW,
			highlight: [],
		});
	} else {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  include Flaggable

  belongs_to :user
  has_many :reviews, dependent: :destroy

  normalizes :name, with: ->(n) { n.strip }

  validates :name, presence: true, length: { minimum: 3, maximum: 255 }
  validates :description, presence: true, length: { minimum: 10 }
  validates :price, presence: true, numericality: { greater_than: 0 }

  enum :status, draft: "draft", listed: "listed", sold: "sold"
end`,
			highlight: [2],
		});
		files.push({
			filename: 'app/models/review.rb',
			language: 'ruby',
			code: `class Review < ApplicationRecord
  include Flaggable

  belongs_to :product
end`,
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
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('intro');

	// ── Reward visualization state ──
	const [modelStates, setModelStates] = useState(BASE_MODELS);
	const [concernState, setConcernState] = useState(BASE_CONCERN);
	const [edgeStates, setEdgeStates] = useState(BASE_EDGES);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setModelStates(structuredClone(BASE_MODELS));
		setConcernState(structuredClone(BASE_CONCERN));
		setEdgeStates(structuredClone(BASE_EDGES));
	}, []);

	const applyFrame = useCallback((frame: RewardFrame) => {
		if (frame.models) {
			setModelStates((prev) => {
				const next = { ...prev };
				for (const [key, patch] of Object.entries(frame.models ?? {})) {
					next[key as ModelKey] = { ...next[key as ModelKey], ...patch };
				}
				return next;
			});
		}
		if (frame.concern) {
			setConcernState((prev) => ({ ...prev, ...frame.concern }));
		}
		if (frame.edges) {
			setEdgeStates((prev) => {
				const next = { ...prev };
				for (const [key, patch] of Object.entries(frame.edges ?? {})) {
					next[key as ModelKey] = { ...next[key as ModelKey], ...patch };
				}
				return next;
			});
		}
	}, []);

	const runAnimation = useCallback(
		(frames: RewardFrame[]) => {
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
			setVizAnimating(true);
			resetViz();

			for (const [i, frame] of frames.entries()) {
				const t = setTimeout(() => {
					applyFrame(frame);
					if (i === frames.length - 1) {
						const cleanup = setTimeout(() => {
							setEdgeStates((prev) => {
								const next = { ...prev };
								for (const key of Object.keys(next) as ModelKey[]) {
									next[key] = { ...next[key], active: false };
								}
								return next;
							});
							setVizAnimating(false);
						}, ANIMATION_DURATION_MS);
						timersRef.current.push(cleanup);
					}
				}, i * ANIMATION_DURATION_MS);
				timersRef.current.push(t);
			}
		},
		[applyFrame, resetViz],
	);

	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, []);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_SCENARIO_FRAMES[scenarioId];
			if (frames) runAnimation(frames);
		},
		[vizAnimating, stressTest, runAnimation],
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
		return {
			valid: true,
			message:
				'Behavior extracted: one concern, one threshold, one auto-hide rule; both models adopt it with a single line and the drift is gone for good.',
		};
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
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							When moderation shipped, the flagging code was written in Product
							and copy-pasted into Review. After the spring spam wave, Product
							got a fix: hide anything at 3 flags, automatically. Nobody
							remembered the copy in Review.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							This weekend a scam review ("text the seller directly, save 20%")
							collected four flags and stayed on the storefront. The same
							scammer's product listing auto-hid at three. Give the behavior one
							home so a fix can never miss a copy again.
						</p>
					</div>

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

					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<Check className="w-4 h-4 text-success shrink-0" />
										<span className="text-foreground">
											Handled by the shared behavior
										</span>
									</div>
									<div className="flex items-center gap-2">
										<X className="w-4 h-4 text-destructive shrink-0" />
										<span className="text-foreground">
											Blocked: content auto-hidden from the storefront
										</span>
									</div>
								</div>
							</div>
							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Handled</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Hidden</div>
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
					{/* ── Phase 1: Intro (WHY) ── */}
					{phase === 'intro' && (
						<div className="flex-1 flex flex-col overflow-auto">
							<div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 py-4">
								<div className="text-center">
									<h3 className="text-lg font-semibold text-foreground">
										The Problem: Two Copies, One Fix
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										The copies drifted: products auto-hide at 3 flags, reviews
										never got the fix
									</p>
								</div>

								<div className="w-full max-w-3xl flex gap-4">
									<AnnotatedCodeBlock
										modelName="app/models/product.rb"
										sections={PRODUCT_SECTIONS}
									/>
									<AnnotatedCodeBlock
										modelName="app/models/review.rb"
										sections={REVIEW_SECTIONS}
									/>
								</div>

								<div className="w-full max-w-3xl rounded-lg border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 p-3">
									<p className="text-sm text-destructive font-medium">
										The weekend damage: a scam review at 4 flags stayed on the
										storefront while the same scammer's product listing auto-hid
										at 3. One behavior, two copies, and the fix only landed in
										one of them.
									</p>
								</div>

								<Button
									className="gap-2"
									onClick={() => setPhase('build')}
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

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>

								<div className="space-y-2">
									{shuffledOptions.map((opt) =>
										isViewingCompletedStep ? (
											<OptionCard
												color="violet"
												disabled={!opt.correct}
												key={opt.id}
												mono
												name={opt.label}
												selected={opt.correct}
												size="lg"
											/>
										) : (
											<OptionCard
												color="violet"
												key={opt.id}
												mono
												name={opt.label}
												onClick={() => handleOptionClick(opt)}
												size="lg"
											/>
										),
									)}
								</div>

								{isViewingCompletedStep && (
									<div className="flex justify-end">
										<Button
											className="gap-2"
											onClick={
												hasNextStep
													? stepper.nextStep
													: () => {
															stressTest.reset();
															resetViz();
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
						<div className="flex-1 flex flex-col">
							<div className="flex-1 flex flex-col min-h-0">
								<ConcernFlow
									concern={concernState}
									edges={edgeStates}
									models={modelStates}
								/>
							</div>

							<div className="px-4 pb-4">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={vizAnimating}
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
							? STEP_DEFS.length
							: stepper.isCurrentStepCompleted
								? stepper.currentStep
								: stepper.currentStep - 1,
					)}
					learningGoal="Duplicated behavior does not stay identical: copies drift, and fixes land in one place but not the other. A concern gives shared model behavior exactly one home: class macros run in the including class via the setup block, instance methods travel from the module body, and every including model changes together the moment the concern does."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level17Concerns;
