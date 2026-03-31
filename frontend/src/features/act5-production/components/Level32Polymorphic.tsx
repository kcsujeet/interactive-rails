/**
 * Level 32: Polymorphic Associations
 *
 * Sequential phase flow: intro -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - intro): Type 2 static intro. Annotated schema display showing
 *   three duplicate review table schemas side by side with colored annotations
 *   highlighting the duplication. "Build the Fix" button always visible (no gating).
 *   No probes, no discovery gating, no animations.
 *
 * Phase 2 (HOW - build): 6 steps (2 terminal + 4 OptionCard)
 *   Step 0: Generate polymorphic migration (terminal)
 *   Step 1: Run db:migrate (terminal)
 *   Step 2: Define Review model with polymorphic belongs_to (OptionCard)
 *   Step 3: Add has_many :reviews to parent models (OptionCard)
 *   Step 4: Create CreateReview service object (OptionCard)
 *   Step 5: Wire controller to use service (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Single unified Review table, connected to all
 *   3 parent models. Before/after comparison showing consolidation.
 *
 * Teaches: polymorphic: true, reviewable_type/id columns, has_many as:,
 *   service objects for review creation, contract validation
 */

import { ArrowRight, Database, Table2, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
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
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Table schema definitions (static intro display)
// ──────────────────────────────────────────────

const DUPLICATE_TABLES = [
	{
		name: 'post_reviews',
		fkColumn: 'product_id',
		borderColor: 'border-blue-300 dark:border-blue-600',
		headerBg: 'bg-blue-50 dark:bg-blue-900/30',
		textColor: 'text-blue-700 dark:text-blue-300',
		rows: [
			{ id: 1, body: 'Great post!', fk: 1, userId: 5, createdAt: 'Mar 12' },
			{ id: 2, body: 'Helpful guide', fk: 1, userId: 3, createdAt: 'Mar 13' },
			{ id: 3, body: 'Thanks!', fk: 2, userId: 8, createdAt: 'Mar 14' },
		],
	},
	{
		name: 'photo_reviews',
		fkColumn: 'photo_id',
		borderColor: 'border-purple-300 dark:border-purple-600',
		headerBg: 'bg-purple-50 dark:bg-purple-900/30',
		textColor: 'text-purple-700 dark:text-purple-300',
		rows: [
			{ id: 1, body: 'Beautiful shot!', fk: 3, userId: 5, createdAt: 'Mar 10' },
			{ id: 2, body: 'Nice angle', fk: 3, userId: 2, createdAt: 'Mar 11' },
			{ id: 3, body: 'Love the colors', fk: 7, userId: 1, createdAt: 'Mar 14' },
		],
	},
	{
		name: 'video_reviews',
		fkColumn: 'video_id',
		borderColor: 'border-amber-300 dark:border-amber-600',
		headerBg: 'bg-amber-50 dark:bg-amber-900/30',
		textColor: 'text-amber-700 dark:text-amber-300',
		rows: [
			{ id: 1, body: 'Great tutorial', fk: 2, userId: 4, createdAt: 'Mar 11' },
			{ id: 2, body: 'More like this!', fk: 5, userId: 5, createdAt: 'Mar 13' },
			{ id: 3, body: 'Subscribed!', fk: 5, userId: 9, createdAt: 'Mar 15' },
		],
	},
] as const;

// ──────────────────────────────────────────────
// Build step definitions
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-migration', title: 'Generate Migration' },
	{ id: 'run-migration', title: 'Run Migration' },
	{ id: 'review-model', title: 'Define Review Model' },
	{ id: 'parent-models', title: 'Update Parent Models' },
	{ id: 'create-service', title: 'Create Review Service' },
	{ id: 'wire-controller', title: 'Wire the Controller' },
];

// Terminal step 0: Generate polymorphic migration
const MIGRATION_COMMANDS = [
	{
		id: 'wrong-separate',
		label: 'rails g model Review body:text product:references',
		command: 'rails generate model Review body:text product:references',
		correct: false,
		feedback:
			'This creates a foreign key to posts only. You need a polymorphic reference that can point to any parent type.',
	},
	{
		id: 'correct-polymorphic',
		label: 'rails g model Review body:text reviewable:references{polymorphic}',
		command:
			'rails generate model Review body:text reviewable:references{polymorphic} user:references',
		correct: true,
	},
	{
		id: 'wrong-string-columns',
		label:
			'rails g model Review body:text reviewable_type:string reviewable_id:integer',
		command:
			'rails generate model Review body:text reviewable_type:string reviewable_id:integer',
		correct: false,
		feedback:
			'Adding columns manually works but misses the index. The {polymorphic} flag generates both columns AND the composite index automatically.',
	},
];

const MIGRATION_OUTPUT = [
	{ text: '  invoke  active_record', color: 'green' as const },
	{
		text: '  create    db/migrate/20250314_create_reviews.rb',
		color: 'green' as const,
	},
	{ text: '  create    app/models/review.rb', color: 'green' as const },
];

// Terminal step 1: Run migration
const RUN_MIGRATION_COMMANDS = [
	{
		id: 'wrong-setup',
		label: 'rails db:setup',
		command: 'rails db:setup',
		correct: false,
		feedback:
			'db:setup drops and recreates the database from schema.rb. You only need to run the pending migration.',
	},
	{
		id: 'correct-migrate',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		command: 'rails db:seed',
		correct: false,
		feedback:
			'db:seed populates sample data. The migration still needs to run first to create the reviews table.',
	},
];

const RUN_MIGRATION_OUTPUT = [
	{ text: '== CreateReviews: migrating ====', color: 'green' as const },
	{ text: '-- create_table(:reviews)', color: 'green' as const },
	{ text: '   -> 0.0045s', color: 'muted' as const },
	{
		text: '-- add_index(:reviews, [:reviewable_type, :reviewable_id])',
		color: 'green' as const,
	},
	{ text: '   -> 0.0012s', color: 'muted' as const },
	{
		text: '== CreateReviews: migrated (0.0057s) ====',
		color: 'green' as const,
	},
];

// Terminal step data map for buildTerminalHistory
const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: MIGRATION_COMMANDS, outputLines: MIGRATION_OUTPUT },
	{ commands: RUN_MIGRATION_COMMANDS, outputLines: RUN_MIGRATION_OUTPUT },
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
	null, // step 5: OptionCard
];

// OptionCard step 2: Review model
const COMMENT_MODEL_OPTIONS = [
	{
		id: 'wrong-sti',
		label: `class Review < ApplicationRecord
  belongs_to :product
  belongs_to :photo
  belongs_to :video
end`,
		correct: false,
		feedback:
			'Multiple belongs_to associations require all three foreign keys on every row. Most will be null. Polymorphic uses a single type/id pair instead.',
	},
	{
		id: 'correct-polymorphic',
		label: `class Review < ApplicationRecord
  belongs_to :reviewable, polymorphic: true
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
		correct: true,
	},
	{
		id: 'wrong-no-polymorphic',
		label: `class Review < ApplicationRecord
  belongs_to :reviewable
  belongs_to :user
end`,
		correct: false,
		feedback:
			'Without `polymorphic: true`, Rails expects a `reviewables` table to exist. The polymorphic flag tells Rails to use the type/id column pair instead.',
	},
];

// OptionCard step 3: Parent models
const PARENT_MODEL_OPTIONS = [
	{
		id: 'wrong-has-one',
		label: `class Product < ApplicationRecord
  has_one :review, as: :reviewable
end`,
		correct: false,
		feedback:
			'has_one limits each product to a single review. Posts can have many reviews, so has_many is the correct association.',
	},
	{
		id: 'wrong-no-as',
		label: `class Product < ApplicationRecord
  has_many :reviews, dependent: :destroy
end`,
		correct: false,
		feedback:
			'Without `as: :reviewable`, Rails looks for a `product_id` column on reviews. The `as:` option tells Rails to use the polymorphic reviewable_type/reviewable_id pair.',
	},
	{
		id: 'correct-as-reviewable',
		label: `class Product < ApplicationRecord
  has_many :reviews, as: :reviewable,
    dependent: :destroy
end
# Same for Photo and Video`,
		correct: true,
	},
];

// OptionCard step 4: CreateReview service
const SERVICE_OPTIONS = [
	{
		id: 'wrong-no-contract',
		label: `class CreateReview < ApplicationService
  Result = Data.define(:success?, :review, :errors)

  def initialize(reviewable:, user:, body:)
    @reviewable = reviewable
    @user = user
    @body = body
  end

  def call
    review = @reviewable.reviews.build(
      user: @user, body: @body
    )
    if review.save
      Result.new(success?: true, review:, errors: [])
    else
      Result.new(success?: false, review: nil,
        errors: review.errors.full_messages)
    end
  end
end`,
		correct: false,
		feedback:
			'Missing input validation via contract. Since L18, services must validate input through a Dry::Validation::Contract before business logic.',
	},
	{
		id: 'correct-with-contract',
		label: `class CreateReview < ApplicationService
  Result = Data.define(:success?, :review, :errors)

  def initialize(reviewable:, user:, params:)
    @reviewable = reviewable
    @user = user
    @params = params
  end

  def call
    v = ReviewContract.new.call(@params)
    return Result.new(success?: false,
      review: nil, errors: v.errors.to_h) if v.failure?

    review = @reviewable.reviews.create!(
      user: @user, body: v[:body]
    )
    Result.new(success?: true, review:, errors: [])
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-inline-validation',
		label: `class CreateReview < ApplicationService
  Result = Data.define(:success?, :review, :errors)

  def initialize(reviewable:, user:, params:)
    @reviewable = reviewable
    @user = user
    @params = params
  end

  def call
    if @params[:body].blank?
      return Result.new(success?: false,
        review: nil, errors: ["Body required"])
    end
    review = @reviewable.reviews.create!(
      user: @user, body: @params[:body]
    )
    Result.new(success?: true, review:, errors: [])
  end
end`,
		correct: false,
		feedback:
			'Inline validation checks in the service were replaced by Dry::Validation contracts in L18. Use a ReviewContract to validate input.',
	},
];

// OptionCard step 5: Wire controller
const CONTROLLER_OPTIONS = [
	{
		id: 'wrong-direct-create',
		label: `class Api::V1::ReviewsController < ApplicationController
  def create
    reviewable = find_reviewable
    review = reviewable.reviews.create!(
      review_params.merge(user: Current.user)
    )
    render json: ReviewSerializer.new(review),
      status: :created
  end
end`,
		correct: false,
		feedback:
			'Business logic belongs in service objects, not controllers. The controller should delegate to CreateReview.call and handle the result.',
	},
	{
		id: 'correct-service',
		label: `class Api::V1::ReviewsController < ApplicationController
  def create
    reviewable = find_reviewable
    result = CreateReview.call(
      reviewable:, user: Current.user,
      params: params.expect(review: [:body])
    )
    if result.success?
      render json: ReviewSerializer.new(result.review),
        status: :created
    else
      render json: { error: { code: "VALIDATION_FAILED",
        message: "Invalid review",
        details: result.errors } }, status: :unprocessable_entity
    end
  end
end`,
		correct: true,
	},
];

// OptionCard step config map
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: {
			id: string;
			label: string;
			correct: boolean;
			feedback?: string;
		}[];
	}
> = {
	2: {
		title: 'Define the Review Model',
		description:
			'Choose the correct polymorphic association declaration for the Review model.',
		options: COMMENT_MODEL_OPTIONS,
	},
	3: {
		title: 'Update Parent Models',
		description:
			'Add the polymorphic has_many association to Product, ProductImage, and ProductVideo.',
		options: PARENT_MODEL_OPTIONS,
	},
	4: {
		title: 'Create the Review Service',
		description:
			'Build a service object that creates reviews on any reviewable parent, using contract validation.',
		options: SERVICE_OPTIONS,
	},
	5: {
		title: 'Wire the Controller',
		description:
			'Connect the controller to the CreateReview service, following the established error response shape.',
		options: CONTROLLER_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview files
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	// Observe phase: show the problem (3 separate models)
	if (phase === 'intro') {
		return [
			{
				filename: 'app/models/post_review.rb',
				language: 'ruby',
				code: `class PostReview < ApplicationRecord
  belongs_to :product
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
			},
			{
				filename: 'app/models/photo_review.rb',
				language: 'ruby',
				code: `class PhotoReview < ApplicationRecord
  belongs_to :photo
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
			},
			{
				filename: 'app/models/video_review.rb',
				language: 'ruby',
				code: `class VideoReview < ApplicationRecord
  belongs_to :video
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
			},
			{
				filename: 'app/services/create_post_review.rb',
				language: 'ruby',
				code: `class CreatePostReview < ApplicationService
  Result = Data.define(:success?, :review, :errors)

  def initialize(post:, user:, params:)
    @product = post
    @user = user
    @params = params
  end

  def call
    v = PostReviewContract.new.call(@params)
    return Result.new(success?: false,
      review: nil, errors: v.errors.to_h) if v.failure?

    review = @post.post_reviews.create!(
      user: @user, body: v[:body]
    )
    Result.new(success?: true, review:, errors: [])
  end
end
# CreatePhotoReview and CreateVideoReview are
# identical copies with different model names!`,
			},
		];
	}

	// Build phase: code evolves with each step
	if (phase === 'build') {
		if (furthestStep <= 0) {
			return [
				{
					filename: 'db/migrate/..._create_reviews.rb (pending)',
					language: 'ruby',
					code: `# Migration will be generated in this step...
# Goal: single reviews table with polymorphic
# reference columns (reviewable_type, reviewable_id)`,
				},
			];
		}
		if (furthestStep === 1) {
			return [
				{
					filename: 'db/migrate/create_reviews.rb',
					language: 'ruby',
					code: `class CreateReviews < ActiveRecord::Migration[8.0]
  def change
    create_table :reviews do |t|
      t.text :body, null: false
      t.references :reviewable, polymorphic: true, null: false
      t.references :user, null: false, foreign_key: true
      t.timestamps
    end
    add_index :reviews,
      [:reviewable_type, :reviewable_id]
  end
end`,
					highlight: [5],
				},
			];
		}
		if (furthestStep === 2) {
			return [
				{
					filename: 'db/migrate/create_reviews.rb',
					language: 'ruby',
					code: `class CreateReviews < ActiveRecord::Migration[8.0]
  def change
    create_table :reviews do |t|
      t.text :body, null: false
      t.references :reviewable, polymorphic: true, null: false
      t.references :user, null: false, foreign_key: true
      t.timestamps
    end
    add_index :reviews,
      [:reviewable_type, :reviewable_id]
  end
end`,
				},
				{
					filename: 'app/models/review.rb (next step)',
					language: 'ruby',
					code: `# Define the Review model with
# polymorphic belongs_to...`,
				},
			];
		}
		if (furthestStep === 3) {
			return [
				{
					filename: 'app/models/review.rb',
					language: 'ruby',
					code: `class Review < ApplicationRecord
  belongs_to :reviewable, polymorphic: true
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
					highlight: [2],
				},
				{
					filename: 'app/models/product.rb (next step)',
					language: 'ruby',
					code: `class Product < ApplicationRecord
  # Add polymorphic has_many...
end`,
				},
			];
		}
		if (furthestStep === 4) {
			return [
				{
					filename: 'app/models/review.rb',
					language: 'ruby',
					code: `class Review < ApplicationRecord
  belongs_to :reviewable, polymorphic: true
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
				},
				{
					filename: 'app/models/product.rb',
					language: 'ruby',
					code: `class Product < ApplicationRecord
  has_many :reviews, as: :reviewable,
    dependent: :destroy
end

# app/models/photo.rb
class Photo < ApplicationRecord
  has_many :reviews, as: :reviewable,
    dependent: :destroy
end

# app/models/video.rb
class Video < ApplicationRecord
  has_many :reviews, as: :reviewable,
    dependent: :destroy
end`,
					highlight: [2, 8, 14],
				},
				{
					filename: 'app/services/create_review.rb (next step)',
					language: 'ruby',
					code: `# Build the service object for
# creating reviews on any parent...`,
				},
			];
		}
		if (furthestStep === 5) {
			return [
				{
					filename: 'app/models/review.rb',
					language: 'ruby',
					code: `class Review < ApplicationRecord
  belongs_to :reviewable, polymorphic: true
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
				},
				{
					filename: 'app/contracts/review_contract.rb',
					language: 'ruby',
					code: `class ReviewContract < Dry::Validation::Contract
  params do
    required(:body).filled(:string, max_size?: 10_000)
  end
end`,
				},
				{
					filename: 'app/services/create_review.rb',
					language: 'ruby',
					code: `class CreateReview < ApplicationService
  Result = Data.define(:success?, :review, :errors)

  def initialize(reviewable:, user:, params:)
    @reviewable = reviewable
    @user = user
    @params = params
  end

  def call
    v = ReviewContract.new.call(@params)
    return Result.new(success?: false,
      review: nil, errors: v.errors.to_h) if v.failure?

    review = @reviewable.reviews.create!(
      user: @user, body: v[:body]
    )
    Result.new(success?: true, review:, errors: [])
  end
end`,
					highlight: [1, 3, 11],
				},
				{
					filename: 'app/controllers/api/v1/reviews_controller.rb (next step)',
					language: 'ruby',
					code: `# Wire the controller to delegate to
# CreateReview.call...`,
				},
			];
		}
	}

	// Reward: complete solution
	return [
		{
			filename: 'app/models/review.rb',
			language: 'ruby',
			code: `class Review < ApplicationRecord
  belongs_to :reviewable, polymorphic: true
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
		},
		{
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  has_many :reviews, as: :reviewable,
    dependent: :destroy
end

# Photo, Video (same pattern)
# has_many :reviews, as: :reviewable`,
		},
		{
			filename: 'app/contracts/review_contract.rb',
			language: 'ruby',
			code: `class ReviewContract < Dry::Validation::Contract
  params do
    required(:body).filled(:string, max_size?: 10_000)
  end
end`,
		},
		{
			filename: 'app/services/create_review.rb',
			language: 'ruby',
			code: `class CreateReview < ApplicationService
  Result = Data.define(:success?, :review, :errors)

  def initialize(reviewable:, user:, params:)
    @reviewable = reviewable
    @user = user
    @params = params
  end

  def call
    v = ReviewContract.new.call(@params)
    return Result.new(success?: false,
      review: nil, errors: v.errors.to_h) if v.failure?

    review = @reviewable.reviews.create!(
      user: @user, body: v[:body]
    )
    Result.new(success?: true, review:, errors: [])
  end
end`,
		},
		{
			filename: 'app/controllers/api/v1/reviews_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ReviewsController < ApplicationController
  before_action :set_reviewable

  def create
    result = CreateReview.call(
      reviewable: @reviewable,
      user: Current.user,
      params: params.expect(review: [:body])
    )
    if result.success?
      render json: ReviewSerializer.new(result.review),
        status: :created
    else
      render json: { error: {
        code: "VALIDATION_FAILED",
        message: "Invalid review",
        details: result.errors
      } }, status: :unprocessable_entity
    end
  end

  private

  def set_reviewable
    resource, id = request.path.split("/")[3..4]
    @reviewable = resource.singularize.classify
      .constantize.find(id)
  end
end`,
		},
	];
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

export function Level32Polymorphic({ onComplete }: LevelComponentProps) {
	// Phase state
	const [phase, setPhase] = useState<Phase>('intro');

	// Gating hooks
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	// ── Build: option click handler ──
	const handleOptionClick = useCallback(
		(option: { correct: boolean; feedback?: string }) => {
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

	const handleComplete = async () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (phase !== 'reward') {
			return {
				valid: false,
				message: 'Complete all phases first',
				details: [
					'Finish the build phase and review the solution before submitting.',
				],
			};
		}
		return { valid: true, message: 'Polymorphic associations working!' };
	};

	// ── Derived state ──
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep] ?? null;
	const isTerminalStep = stepper.currentStep <= 1;

	// Reward: unified table rows (solution visualization)
	const UNIFIED_ROWS = [
		{
			id: 1,
			body: 'Great post!',
			type: 'Product',
			typeId: 1,
			userId: 5,
			createdAt: 'Mar 12',
		},
		{
			id: 2,
			body: 'Beautiful shot!',
			type: 'Photo',
			typeId: 3,
			userId: 5,
			createdAt: 'Mar 10',
		},
		{
			id: 3,
			body: 'Awesome video!',
			type: 'Video',
			typeId: 7,
			userId: 2,
			createdAt: 'Mar 11',
		},
		{
			id: 4,
			body: 'Nice analysis',
			type: 'Article',
			typeId: 2,
			userId: 8,
			createdAt: 'Mar 15',
		},
	];

	// ──────────────────────────────────────────
	// Main render
	// ──────────────────────────────────────────

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Replace three separate review tables with one polymorphic Review model."
					instructions={
						phase === 'intro'
							? [
									'Review the three duplicate review table schemas',
									'Notice the identical columns across all tables',
									'Click "Build the Fix" when ready to consolidate them',
								]
							: phase === 'build'
								? [
										'Generate the polymorphic migration',
										'Run the migration to create the table',
										'Define the Review model and parent associations',
										'Build a service object with contract validation',
										'Wire the controller to use the service',
									]
								: [
										'Compare the before (3 tables) and after (1 table)',
										'Notice the polymorphic columns replace separate foreign keys',
										'New types like Article need zero schema changes',
									]
					}
					scenario="Photos and Videos now need reviews alongside Posts. Three separate review tables with identical schemas, duplicated validations, and scattered queries. Polymorphic associations can unify them."
				>
					{/* Phase-specific sidebar content */}
					<div className="border-t border-border">
						{phase === 'intro' && (
							<div className="p-4 text-xs text-muted-foreground space-y-2">
								<p>
									Three models need reviews: Product, ProductImage, and
									ProductVideo. Each has its own review table with nearly
									identical schemas.
								</p>
								<p>
									Polymorphic associations replace all three with a single
									unified Review table.
								</p>
							</div>
						)}

						{phase === 'build' && (
							<div className="p-4">
								<StepProgress
									currentStep={stepper.currentStep}
									onStepClick={stepper.goToStep}
									steps={stepper.steps}
								/>
							</div>
						)}

						{phase === 'reward' && (
							<div className="p-4 text-xs text-muted-foreground space-y-2">
								<p>
									Three separate tables consolidated into one. The
									reviewable_type and reviewable_id columns replace product_id,
									photo_id, and video_id.
								</p>
								<p>Adding Article reviews required zero schema changes.</p>
							</div>
						)}
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Polymorphic Associations"
					levelNumber={32}
					onComplete={handleComplete}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col min-h-0">
					{/* ── INTRO PHASE (Type 2: static annotated code) ── */}
					{phase === 'intro' && (
						<div className="flex-1 overflow-y-auto overflow-x-auto p-6">
							<div className="mx-auto flex flex-col items-center gap-5">
								{/* Problem banner */}
								<div className="inline-flex items-center gap-2 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 rounded-lg px-3 py-1.5">
									<Table2 className="w-4 h-4 text-destructive" />
									<span className="text-sm font-semibold text-destructive">
										3 Separate Review Tables
									</span>
								</div>

								{/* Three database tables as grids */}
								<div className="grid grid-cols-3 gap-4 w-full min-w-[640px]">
									{DUPLICATE_TABLES.map((table) => (
										<div
											className={cn(
												'rounded-lg border overflow-hidden',
												table.borderColor,
											)}
											key={table.name}
										>
											{/* Table name header */}
											<div
												className={cn(
													'px-3 py-2 flex items-center gap-1.5 border-b border-border/30',
													table.headerBg,
												)}
											>
												<Database
													className={cn('w-3.5 h-3.5', table.textColor)}
												/>
												<span
													className={cn(
														'text-xs font-bold font-mono',
														table.textColor,
													)}
												>
													{table.name}
												</span>
											</div>

											{/* Column headers */}
											<div className="overflow-x-auto">
												<table className="w-full text-[11px] font-mono">
													<thead>
														<tr className="bg-muted/50 border-b border-border/30">
															<th className="px-2 py-1 text-left font-medium text-destructive bg-destructive/5">
																id
															</th>
															<th className="px-2 py-1 text-left font-medium text-destructive bg-destructive/5">
																body
															</th>
															<th
																className={cn(
																	'px-2 py-1 text-left font-bold',
																	table.textColor,
																)}
															>
																{table.fkColumn}
															</th>
															<th className="px-2 py-1 text-left font-medium text-destructive bg-destructive/5">
																user_id
															</th>
															<th className="px-2 py-1 text-left font-medium text-destructive bg-destructive/5">
																created_at
															</th>
														</tr>
													</thead>
													<tbody>
														{table.rows.map((row) => (
															<tr
																className="border-b border-border/20 last:border-b-0"
																key={row.id}
															>
																<td className="px-2 py-1 text-muted-foreground">
																	{row.id}
																</td>
																<td className="px-2 py-1 text-muted-foreground truncate max-w-[80px]">
																	{row.body}
																</td>
																<td
																	className={cn(
																		'px-2 py-1 font-medium',
																		table.textColor,
																	)}
																>
																	{row.fk}
																</td>
																<td className="px-2 py-1 text-muted-foreground">
																	{row.userId}
																</td>
																<td className="px-2 py-1 text-muted-foreground">
																	{row.createdAt}
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									))}
								</div>

								{/* Duplication callout */}
								<div className="w-full bg-destructive/5 dark:bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
									<p className="text-sm text-destructive font-medium">
										4 of 5 columns are identical across every table. Only the
										foreign key name differs. Adding a new reviewable type
										requires creating yet another table.
									</p>
								</div>

								{/* "Build the Fix" button */}
								<Button onClick={handleStartBuild} size="lg">
									Build the Fix
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						</div>
					)}

					{/* ── BUILD PHASE ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-y-auto p-6">
							{isTerminalStep ? (
								<TerminalChoiceStep
									commands={
										stepper.currentStep === 0
											? MIGRATION_COMMANDS
											: RUN_MIGRATION_COMMANDS
									}
									completed={isViewingCompletedStep}
									description={
										stepper.currentStep === 0 ? (
											<p className="text-sm text-muted-foreground">
												Generate a Review model with a polymorphic reference to
												any reviewable parent.
											</p>
										) : (
											<p className="text-sm text-muted-foreground">
												Run the migration to create the reviews table with
												polymorphic columns.
											</p>
										)
									}
									hasNext={hasNextStep}
									initialHistory={buildTerminalHistory(
										TERMINAL_STEP_MAP,
										stepper.currentStep,
									)}
									onCorrect={() => stepper.completeStep()}
									onNext={stepper.nextStep}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={
										stepper.currentStep === 0
											? MIGRATION_OUTPUT
											: RUN_MIGRATION_OUTPUT
									}
									stepKey={stepper.currentStep}
									title={STEP_DEFS[stepper.currentStep].title}
								/>
							) : currentOptionConfig ? (
								<div className="max-w-2xl mx-auto space-y-4">
									<div>
										<h3 className="text-lg font-semibold text-foreground">
											{currentOptionConfig.title}
										</h3>
										<p className="text-sm text-muted-foreground mt-1">
											{currentOptionConfig.description}
										</p>
									</div>

									<div className="space-y-3">
										{isViewingCompletedStep ? (
											currentOptionConfig.options.map((opt) => (
												<OptionCard
													disabled={!opt.correct}
													key={opt.id}
													mono
													name={opt.label}
													selected={opt.correct}
													size="sm"
												/>
											))
										) : (
											<>
												{currentOptionConfig.options.map((opt) => (
													<OptionCard
														key={opt.id}
														mono
														name={opt.label}
														onClick={() => handleOptionClick(opt)}
														size="sm"
													/>
												))}
												<ErrorFeedback
													message={stepper.lastFeedback}
													onDismiss={stepper.clearFeedback}
												/>
											</>
										)}
									</div>

									{isViewingCompletedStep && (
										<div className="flex justify-end">
											<Button
												onClick={
													hasNextStep
														? stepper.nextStep
														: () => setPhase('reward')
												}
												variant="outline"
											>
												Next Step
												<ArrowRight className="w-4 h-4" />
											</Button>
										</div>
									)}
								</div>
							) : null}
						</div>
					)}

					{/* ── REWARD PHASE (static before/after) ── */}
					{phase === 'reward' && (
						<div className="flex-1 overflow-y-auto overflow-x-auto p-6">
							<div className="mx-auto flex flex-col gap-6">
								{/* BEFORE: 3 separate tables (compact) */}
								<div className="flex flex-col items-center gap-3">
									<div className="inline-flex items-center gap-2 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 rounded-lg px-3 py-1.5">
										<Table2 className="w-4 h-4 text-destructive" />
										<span className="text-sm font-semibold text-destructive">
											Before: 3 Separate Tables
										</span>
									</div>
									<div className="grid grid-cols-3 gap-3 w-full min-w-[640px] opacity-60">
										{DUPLICATE_TABLES.map((table) => (
											<div
												className={cn(
													'rounded-lg border overflow-hidden',
													table.borderColor,
												)}
												key={table.name}
											>
												<div
													className={cn(
														'px-2.5 py-1.5 flex items-center gap-1.5 border-b border-border/30',
														table.headerBg,
													)}
												>
													<Database
														className={cn('w-3 h-3', table.textColor)}
													/>
													<span
														className={cn(
															'text-[11px] font-bold font-mono',
															table.textColor,
														)}
													>
														{table.name}
													</span>
												</div>
												<div className="px-2.5 py-1.5 flex flex-wrap gap-1 text-[10px] font-mono text-muted-foreground">
													<span>id</span>
													<span>body</span>
													<span className={cn('font-bold', table.textColor)}>
														{table.fkColumn}
													</span>
													<span>user_id</span>
													<span>created_at</span>
												</div>
											</div>
										))}
									</div>
								</div>

								{/* Arrow */}
								<div className="flex justify-center">
									<div className="flex flex-col items-center gap-1 text-emerald-600 dark:text-emerald-400">
										<ArrowRight className="w-6 h-6 rotate-90" />
										<span className="text-xs font-semibold">Consolidated</span>
									</div>
								</div>

								{/* AFTER: 1 unified table */}
								<div className="flex flex-col items-center gap-3">
									<div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 rounded-lg px-3 py-1.5">
										<Table2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
										<span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
											After: 1 Unified Table
										</span>
										<span className="text-[10px] font-mono bg-emerald-200 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5">
											polymorphic
										</span>
									</div>

									<div className="w-full min-w-[640px] rounded-lg border border-emerald-300 dark:border-emerald-600 overflow-hidden">
										<div className="px-3 py-2 flex items-center gap-1.5 border-b border-border/30 bg-emerald-50 dark:bg-emerald-900/30">
											<Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
											<span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300">
												reviews
											</span>
										</div>
										<div className="overflow-x-auto">
											<table className="w-full text-[11px] font-mono">
												<thead>
													<tr className="bg-muted/50 border-b border-border/30">
														<th className="px-2 py-1 text-left font-medium text-muted-foreground">
															id
														</th>
														<th className="px-2 py-1 text-left font-medium text-muted-foreground">
															body
														</th>
														<th className="px-2 py-1 text-left font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20">
															reviewable_type
														</th>
														<th className="px-2 py-1 text-left font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20">
															reviewable_id
														</th>
														<th className="px-2 py-1 text-left font-medium text-muted-foreground">
															user_id
														</th>
														<th className="px-2 py-1 text-left font-medium text-muted-foreground">
															created_at
														</th>
													</tr>
												</thead>
												<tbody>
													{UNIFIED_ROWS.map((row) => (
														<tr
															className="border-b border-border/20 last:border-b-0"
															key={row.id}
														>
															<td className="px-2 py-1 text-muted-foreground">
																{row.id}
															</td>
															<td className="px-2 py-1 text-muted-foreground">
																{row.body}
															</td>
															<td className="px-2 py-1 text-emerald-600 dark:text-emerald-400 font-bold">
																{row.type}
															</td>
															<td className="px-2 py-1 text-emerald-600 dark:text-emerald-400">
																{row.typeId}
															</td>
															<td className="px-2 py-1 text-muted-foreground">
																{row.userId}
															</td>
															<td className="px-2 py-1 text-muted-foreground">
																{row.createdAt}
															</td>
														</tr>
													))}
												</tbody>
											</table>
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
						phase === 'build' ? stepper.furthestStep : 0,
					)}
					learningGoal={
						phase === 'intro'
							? 'Three identical review tables duplicate schema, validations, and queries. Any new reviewable type requires another table.'
							: 'One polymorphic Review model handles all parent types. reviewable_type + reviewable_id columns replace three separate foreign keys.'
					}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-1.5">
								<Database className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>
									reviewable_type stores the model name ("Product", "Photo")
								</span>
							</li>
							<li className="flex items-start gap-1.5">
								<Table2 className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>reviewable_id stores the record ID</span>
							</li>
							<li className="flex items-start gap-1.5">
								<Zap className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>
									New types need only has_many :reviews, as: :reviewable
								</span>
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level32Polymorphic;
