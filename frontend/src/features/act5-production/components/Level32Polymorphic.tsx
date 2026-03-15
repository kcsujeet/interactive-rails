/**
 * Level 32: Polymorphic Associations
 *
 * Sequential phase flow: intro -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - intro): Type 2 static intro. Annotated schema display showing
 *   three duplicate comment table schemas side by side with colored annotations
 *   highlighting the duplication. "Build the Fix" button always visible (no gating).
 *   No probes, no discovery gating, no animations.
 *
 * Phase 2 (HOW - build): 6 steps (2 terminal + 4 OptionCard)
 *   Step 0: Generate polymorphic migration (terminal)
 *   Step 1: Run db:migrate (terminal)
 *   Step 2: Define Comment model with polymorphic belongs_to (OptionCard)
 *   Step 3: Add has_many :comments to parent models (OptionCard)
 *   Step 4: Create CreateComment service object (OptionCard)
 *   Step 5: Wire controller to use service (OptionCard)
 *
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Polymorphic" button
 * Phase 4 (ADVANTAGE - reward): Single unified Comment table, connected to all
 *   3 parent models. StressTestPanel fires comment creation scenarios on
 *   different parent types, including a new Article type to show extensibility.
 *
 * Teaches: polymorphic: true, commentable_type/id columns, has_many as:,
 *   service objects for comment creation, contract validation
 */

import { ArrowRight, Database, Play, Star, Table2, Zap } from 'lucide-react';
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
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Table schema definitions (static intro display)
// ──────────────────────────────────────────────

const DUPLICATE_TABLES = [
	{
		name: 'post_comments',
		fkColumn: 'post_id',
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
		name: 'photo_comments',
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
		name: 'video_comments',
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
	{ id: 'comment-model', title: 'Define Comment Model' },
	{ id: 'parent-models', title: 'Update Parent Models' },
	{ id: 'create-service', title: 'Create Comment Service' },
	{ id: 'wire-controller', title: 'Wire the Controller' },
];

// Terminal step 0: Generate polymorphic migration
const MIGRATION_COMMANDS = [
	{
		id: 'wrong-separate',
		label: 'rails g model Comment body:text post:references',
		command: 'rails generate model Comment body:text post:references',
		correct: false,
		feedback:
			'This creates a foreign key to posts only. You need a polymorphic reference that can point to any parent type.',
	},
	{
		id: 'correct-polymorphic',
		label:
			'rails g model Comment body:text commentable:references{polymorphic}',
		command:
			'rails generate model Comment body:text commentable:references{polymorphic} user:references',
		correct: true,
	},
	{
		id: 'wrong-string-columns',
		label:
			'rails g model Comment body:text commentable_type:string commentable_id:integer',
		command:
			'rails generate model Comment body:text commentable_type:string commentable_id:integer',
		correct: false,
		feedback:
			'Adding columns manually works but misses the index. The {polymorphic} flag generates both columns AND the composite index automatically.',
	},
];

const MIGRATION_OUTPUT = [
	{ text: '  invoke  active_record', color: 'green' as const },
	{
		text: '  create    db/migrate/20250314_create_comments.rb',
		color: 'green' as const,
	},
	{ text: '  create    app/models/comment.rb', color: 'green' as const },
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
			'db:seed populates sample data. The migration still needs to run first to create the comments table.',
	},
];

const RUN_MIGRATION_OUTPUT = [
	{ text: '== CreateComments: migrating ====', color: 'green' as const },
	{ text: '-- create_table(:comments)', color: 'green' as const },
	{ text: '   -> 0.0045s', color: 'muted' as const },
	{
		text: '-- add_index(:comments, [:commentable_type, :commentable_id])',
		color: 'green' as const,
	},
	{ text: '   -> 0.0012s', color: 'muted' as const },
	{
		text: '== CreateComments: migrated (0.0057s) ====',
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

// OptionCard step 2: Comment model
const COMMENT_MODEL_OPTIONS = [
	{
		id: 'wrong-sti',
		label: `class Comment < ApplicationRecord
  belongs_to :post
  belongs_to :photo
  belongs_to :video
end`,
		correct: false,
		feedback:
			'Multiple belongs_to associations require all three foreign keys on every row. Most will be null. Polymorphic uses a single type/id pair instead.',
	},
	{
		id: 'correct-polymorphic',
		label: `class Comment < ApplicationRecord
  belongs_to :commentable, polymorphic: true
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
		correct: true,
	},
	{
		id: 'wrong-no-polymorphic',
		label: `class Comment < ApplicationRecord
  belongs_to :commentable
  belongs_to :user
end`,
		correct: false,
		feedback:
			'Without `polymorphic: true`, Rails expects a `commentables` table to exist. The polymorphic flag tells Rails to use the type/id column pair instead.',
	},
];

// OptionCard step 3: Parent models
const PARENT_MODEL_OPTIONS = [
	{
		id: 'wrong-has-one',
		label: `class Post < ApplicationRecord
  has_one :comment, as: :commentable
end`,
		correct: false,
		feedback:
			'has_one limits each post to a single comment. Posts can have many comments, so has_many is the correct association.',
	},
	{
		id: 'wrong-no-as',
		label: `class Post < ApplicationRecord
  has_many :comments, dependent: :destroy
end`,
		correct: false,
		feedback:
			'Without `as: :commentable`, Rails looks for a `post_id` column on comments. The `as:` option tells Rails to use the polymorphic commentable_type/commentable_id pair.',
	},
	{
		id: 'correct-as-commentable',
		label: `class Post < ApplicationRecord
  has_many :comments, as: :commentable,
    dependent: :destroy
end
# Same for Photo and Video`,
		correct: true,
	},
];

// OptionCard step 4: CreateComment service
const SERVICE_OPTIONS = [
	{
		id: 'wrong-no-contract',
		label: `class CreateComment < ApplicationService
  Result = Data.define(:success?, :comment, :errors)

  def initialize(commentable:, user:, body:)
    @commentable = commentable
    @user = user
    @body = body
  end

  def call
    comment = @commentable.comments.build(
      user: @user, body: @body
    )
    if comment.save
      Result.new(success?: true, comment:, errors: [])
    else
      Result.new(success?: false, comment: nil,
        errors: comment.errors.full_messages)
    end
  end
end`,
		correct: false,
		feedback:
			'Missing input validation via contract. Since L18, services must validate input through a Dry::Validation::Contract before business logic.',
	},
	{
		id: 'correct-with-contract',
		label: `class CreateComment < ApplicationService
  Result = Data.define(:success?, :comment, :errors)

  def initialize(commentable:, user:, params:)
    @commentable = commentable
    @user = user
    @params = params
  end

  def call
    v = CommentContract.new.call(@params)
    return Result.new(success?: false,
      comment: nil, errors: v.errors.to_h) if v.failure?

    comment = @commentable.comments.create!(
      user: @user, body: v[:body]
    )
    Result.new(success?: true, comment:, errors: [])
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-inline-validation',
		label: `class CreateComment < ApplicationService
  Result = Data.define(:success?, :comment, :errors)

  def initialize(commentable:, user:, params:)
    @commentable = commentable
    @user = user
    @params = params
  end

  def call
    if @params[:body].blank?
      return Result.new(success?: false,
        comment: nil, errors: ["Body required"])
    end
    comment = @commentable.comments.create!(
      user: @user, body: @params[:body]
    )
    Result.new(success?: true, comment:, errors: [])
  end
end`,
		correct: false,
		feedback:
			'Inline validation checks in the service were replaced by Dry::Validation contracts in L18. Use a CommentContract to validate input.',
	},
];

// OptionCard step 5: Wire controller
const CONTROLLER_OPTIONS = [
	{
		id: 'wrong-direct-create',
		label: `class Api::V1::CommentsController < ApplicationController
  def create
    commentable = find_commentable
    comment = commentable.comments.create!(
      comment_params.merge(user: Current.user)
    )
    render json: CommentSerializer.new(comment),
      status: :created
  end
end`,
		correct: false,
		feedback:
			'Business logic belongs in service objects, not controllers. The controller should delegate to CreateComment.call and handle the result.',
	},
	{
		id: 'correct-service',
		label: `class Api::V1::CommentsController < ApplicationController
  def create
    commentable = find_commentable
    result = CreateComment.call(
      commentable:, user: Current.user,
      params: params.expect(comment: [:body])
    )
    if result.success?
      render json: CommentSerializer.new(result.comment),
        status: :created
    else
      render json: { error: { code: "VALIDATION_FAILED",
        message: "Invalid comment",
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
		title: 'Define the Comment Model',
		description:
			'Choose the correct polymorphic association declaration for the Comment model.',
		options: COMMENT_MODEL_OPTIONS,
	},
	3: {
		title: 'Update Parent Models',
		description:
			'Add the polymorphic has_many association to Post, Photo, and Video.',
		options: PARENT_MODEL_OPTIONS,
	},
	4: {
		title: 'Create the Comment Service',
		description:
			'Build a service object that creates comments on any commentable parent, using contract validation.',
		options: SERVICE_OPTIONS,
	},
	5: {
		title: 'Wire the Controller',
		description:
			'Connect the controller to the CreateComment service, following the established error response shape.',
		options: CONTROLLER_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'comment-on-post',
		label: 'POST comment on Post',
		description: 'Create a comment on a blog post',
		method: 'POST',
		path: '/api/v1/posts/1/comments',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '201 Created', color: 'green' },
			{ text: 'commentable_type: "Post", commentable_id: 1', color: 'cyan' },
		],
	},
	{
		id: 'comment-on-photo',
		label: 'POST comment on Photo',
		description: 'Create a comment on a photo',
		method: 'POST',
		path: '/api/v1/photos/3/comments',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '201 Created', color: 'green' },
			{ text: 'commentable_type: "Photo", commentable_id: 3', color: 'cyan' },
		],
	},
	{
		id: 'comment-on-video',
		label: 'POST comment on Video',
		description: 'Create a comment on a video',
		method: 'POST',
		path: '/api/v1/videos/7/comments',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '201 Created', color: 'green' },
			{ text: 'commentable_type: "Video", commentable_id: 7', color: 'cyan' },
		],
	},
	{
		id: 'list-all-comments',
		label: 'GET all user comments',
		description: 'Query all comments by current user across all types',
		method: 'GET',
		path: '/api/v1/comments?user=me',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: 'Comment.where(user: Current.user) => 14 results',
				color: 'cyan',
			},
			{ text: 'Single query across all commentable types!', color: 'green' },
		],
	},
	{
		id: 'comment-on-article',
		label: 'POST comment on Article (new type)',
		description: 'Comment on a new commentable type with zero schema changes',
		method: 'POST',
		path: '/api/v1/articles/2/comments',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '201 Created', color: 'green' },
			{ text: 'commentable_type: "Article", commentable_id: 2', color: 'cyan' },
			{
				text: 'No new table needed. Just add has_many to Article!',
				color: 'green',
			},
		],
	},
	{
		id: 'invalid-parent',
		label: 'POST comment on missing parent',
		description: 'Try to comment on a non-existent record',
		method: 'POST',
		path: '/api/v1/posts/999/comments',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '404 Not Found', color: 'red' },
			{ text: '{ error: { code: "NOT_FOUND" } }', color: 'red' },
		],
	},
	{
		id: 'empty-body',
		label: 'POST comment with empty body',
		description: 'Submit a comment without a body',
		method: 'POST',
		path: '/api/v1/posts/1/comments',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{ text: 'CommentContract: body is missing', color: 'yellow' },
		],
	},
];

// ──────────────────────────────────────────────
// Code preview files
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	// Observe phase: show the problem (3 separate models)
	if (phase === 'intro') {
		return [
			{
				filename: 'app/models/post_comment.rb',
				language: 'ruby',
				code: `class PostComment < ApplicationRecord
  belongs_to :post
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
			},
			{
				filename: 'app/models/photo_comment.rb',
				language: 'ruby',
				code: `class PhotoComment < ApplicationRecord
  belongs_to :photo
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
			},
			{
				filename: 'app/models/video_comment.rb',
				language: 'ruby',
				code: `class VideoComment < ApplicationRecord
  belongs_to :video
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
			},
			{
				filename: 'app/services/create_post_comment.rb',
				language: 'ruby',
				code: `class CreatePostComment < ApplicationService
  Result = Data.define(:success?, :comment, :errors)

  def initialize(post:, user:, params:)
    @post = post
    @user = user
    @params = params
  end

  def call
    v = PostCommentContract.new.call(@params)
    return Result.new(success?: false,
      comment: nil, errors: v.errors.to_h) if v.failure?

    comment = @post.post_comments.create!(
      user: @user, body: v[:body]
    )
    Result.new(success?: true, comment:, errors: [])
  end
end
# CreatePhotoComment and CreateVideoComment are
# identical copies with different model names!`,
			},
		];
	}

	// Build phase: code evolves with each step
	if (phase === 'build') {
		if (furthestStep <= 0) {
			return [
				{
					filename: 'db/migrate/..._create_comments.rb (pending)',
					language: 'ruby',
					code: `# Migration will be generated in this step...
# Goal: single comments table with polymorphic
# reference columns (commentable_type, commentable_id)`,
				},
			];
		}
		if (furthestStep === 1) {
			return [
				{
					filename: 'db/migrate/create_comments.rb',
					language: 'ruby',
					code: `class CreateComments < ActiveRecord::Migration[8.0]
  def change
    create_table :comments do |t|
      t.text :body, null: false
      t.references :commentable, polymorphic: true, null: false
      t.references :user, null: false, foreign_key: true
      t.timestamps
    end
    add_index :comments,
      [:commentable_type, :commentable_id]
  end
end`,
					highlight: [5],
				},
			];
		}
		if (furthestStep === 2) {
			return [
				{
					filename: 'db/migrate/create_comments.rb',
					language: 'ruby',
					code: `class CreateComments < ActiveRecord::Migration[8.0]
  def change
    create_table :comments do |t|
      t.text :body, null: false
      t.references :commentable, polymorphic: true, null: false
      t.references :user, null: false, foreign_key: true
      t.timestamps
    end
    add_index :comments,
      [:commentable_type, :commentable_id]
  end
end`,
				},
				{
					filename: 'app/models/comment.rb (next step)',
					language: 'ruby',
					code: `# Define the Comment model with
# polymorphic belongs_to...`,
				},
			];
		}
		if (furthestStep === 3) {
			return [
				{
					filename: 'app/models/comment.rb',
					language: 'ruby',
					code: `class Comment < ApplicationRecord
  belongs_to :commentable, polymorphic: true
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
					highlight: [2],
				},
				{
					filename: 'app/models/post.rb (next step)',
					language: 'ruby',
					code: `class Post < ApplicationRecord
  # Add polymorphic has_many...
end`,
				},
			];
		}
		if (furthestStep === 4) {
			return [
				{
					filename: 'app/models/comment.rb',
					language: 'ruby',
					code: `class Comment < ApplicationRecord
  belongs_to :commentable, polymorphic: true
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
				},
				{
					filename: 'app/models/post.rb',
					language: 'ruby',
					code: `class Post < ApplicationRecord
  has_many :comments, as: :commentable,
    dependent: :destroy
end

# app/models/photo.rb
class Photo < ApplicationRecord
  has_many :comments, as: :commentable,
    dependent: :destroy
end

# app/models/video.rb
class Video < ApplicationRecord
  has_many :comments, as: :commentable,
    dependent: :destroy
end`,
					highlight: [2, 8, 14],
				},
				{
					filename: 'app/services/create_comment.rb (next step)',
					language: 'ruby',
					code: `# Build the service object for
# creating comments on any parent...`,
				},
			];
		}
		if (furthestStep === 5) {
			return [
				{
					filename: 'app/models/comment.rb',
					language: 'ruby',
					code: `class Comment < ApplicationRecord
  belongs_to :commentable, polymorphic: true
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
				},
				{
					filename: 'app/contracts/comment_contract.rb',
					language: 'ruby',
					code: `class CommentContract < Dry::Validation::Contract
  params do
    required(:body).filled(:string, max_size?: 10_000)
  end
end`,
				},
				{
					filename: 'app/services/create_comment.rb',
					language: 'ruby',
					code: `class CreateComment < ApplicationService
  Result = Data.define(:success?, :comment, :errors)

  def initialize(commentable:, user:, params:)
    @commentable = commentable
    @user = user
    @params = params
  end

  def call
    v = CommentContract.new.call(@params)
    return Result.new(success?: false,
      comment: nil, errors: v.errors.to_h) if v.failure?

    comment = @commentable.comments.create!(
      user: @user, body: v[:body]
    )
    Result.new(success?: true, comment:, errors: [])
  end
end`,
					highlight: [1, 3, 11],
				},
				{
					filename: 'app/controllers/api/v1/comments_controller.rb (next step)',
					language: 'ruby',
					code: `# Wire the controller to delegate to
# CreateComment.call...`,
				},
			];
		}
	}

	// Activate + reward: complete solution
	return [
		{
			filename: 'app/models/comment.rb',
			language: 'ruby',
			code: `class Comment < ApplicationRecord
  belongs_to :commentable, polymorphic: true
  belongs_to :user

  validates :body, presence: true,
    length: { maximum: 10_000 }
end`,
		},
		{
			filename: 'app/models/post.rb',
			language: 'ruby',
			code: `class Post < ApplicationRecord
  has_many :comments, as: :commentable,
    dependent: :destroy
end

# Photo, Video (same pattern)
# has_many :comments, as: :commentable`,
		},
		{
			filename: 'app/contracts/comment_contract.rb',
			language: 'ruby',
			code: `class CommentContract < Dry::Validation::Contract
  params do
    required(:body).filled(:string, max_size?: 10_000)
  end
end`,
		},
		{
			filename: 'app/services/create_comment.rb',
			language: 'ruby',
			code: `class CreateComment < ApplicationService
  Result = Data.define(:success?, :comment, :errors)

  def initialize(commentable:, user:, params:)
    @commentable = commentable
    @user = user
    @params = params
  end

  def call
    v = CommentContract.new.call(@params)
    return Result.new(success?: false,
      comment: nil, errors: v.errors.to_h) if v.failure?

    comment = @commentable.comments.create!(
      user: @user, body: v[:body]
    )
    Result.new(success?: true, comment:, errors: [])
  end
end`,
		},
		{
			filename: 'app/controllers/api/v1/comments_controller.rb',
			language: 'ruby',
			code: `class Api::V1::CommentsController < ApplicationController
  before_action :set_commentable

  def create
    result = CreateComment.call(
      commentable: @commentable,
      user: Current.user,
      params: params.expect(comment: [:body])
    )
    if result.success?
      render json: CommentSerializer.new(result.comment),
        status: :created
    else
      render json: { error: {
        code: "VALIDATION_FAILED",
        message: "Invalid comment",
        details: result.errors
      } }, status: :unprocessable_entity
    end
  end

  private

  def set_commentable
    resource, id = request.path.split("/")[3..4]
    @commentable = resource.singularize.classify
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
	const stressTest = useStressTest(STRESS_SCENARIOS);

	// Reward visualization state
	const [vizAnimating, setVizAnimating] = useState(false);
	const [rewardHighlight, setRewardHighlight] = useState<{
		parentKey: string | null;
		result: 'allowed' | 'blocked';
	} | null>(null);
	const animTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// ── Cleanup timers ──
	const clearTimers = useCallback(() => {
		for (const t of animTimerRef.current) clearTimeout(t);
		animTimerRef.current = [];
	}, []);

	useEffect(() => () => clearTimers(), [clearTimers]);

	// ── Phase transitions ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

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

	// ── Reward: fire scenario handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);

			const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			if (!scenario) return;

			// Map scenario to parent model for visualization
			const parentMap: Record<string, string> = {
				'comment-on-post': 'post',
				'comment-on-photo': 'photo',
				'comment-on-video': 'video',
				'comment-on-article': 'article',
				'list-all-comments': 'all',
			};
			const parentKey = parentMap[scenarioId] ?? null;

			setVizAnimating(true);
			setRewardHighlight({
				parentKey,
				result: scenario.expectedResult,
			});

			const timer = setTimeout(() => {
				setVizAnimating(false);
			}, ANIMATION_DURATION_MS);
			animTimerRef.current.push(timer);
		},
		[vizAnimating, stressTest],
	);

	const handleToggleAutoFire = useCallback(
		(onFire: (id: string) => void) => {
			stressTest.toggleAutoFire(onFire);
		},
		[stressTest],
	);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleActivateReward = () => {
		setPhase('reward');
		setRewardHighlight(null);
	};

	const handleComplete = async () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (phase !== 'reward') {
			return {
				valid: false,
				message: 'Complete all phases first',
				details: ['Finish the observe and build phases before submitting.'],
			};
		}
		if (stressTest.results.length < 3) {
			return {
				valid: false,
				message: 'Test more scenarios',
				details: [
					'Fire at least 3 stress test scenarios to verify your solution works.',
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

	// Reward: unified table rows
	const UNIFIED_ROWS = [
		{ id: 1, body: 'Great post!', type: 'Post', typeId: 1, userId: 5 },
		{ id: 2, body: 'Beautiful shot!', type: 'Photo', typeId: 3, userId: 5 },
		{ id: 3, body: 'Awesome video!', type: 'Video', typeId: 7, userId: 2 },
		{ id: 4, body: 'Nice analysis', type: 'Article', typeId: 2, userId: 8 },
	];

	const renderRewardVisualization = () => {
		const lastResult =
			stressTest.results[stressTest.results.length - 1] ?? null;
		const lastScenario = lastResult
			? STRESS_SCENARIOS.find((s) => s.id === lastResult.scenarioId)
			: null;

		return (
			<div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
				{/* Banner */}
				<div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 rounded-lg px-3 py-1.5">
					<Table2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
					<span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
						1 Unified Comment Table
					</span>
					<span className="text-[10px] font-mono bg-emerald-200 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5">
						polymorphic
					</span>
				</div>

				{/* Unified database table */}
				<div
					className={cn(
						'w-full max-w-2xl rounded-lg border overflow-hidden transition-colors',
						lastResult?.result === 'allowed'
							? 'border-emerald-400 dark:border-emerald-600'
							: lastResult?.result === 'blocked'
								? 'border-destructive'
								: 'border-border',
					)}
				>
					{/* Column headers */}
					<table className="w-full text-xs font-mono">
						<thead>
							<tr className="bg-muted border-b border-border">
								<th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-8">
									id
								</th>
								<th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
									body
								</th>
								<th className="px-2 py-1.5 text-left font-medium text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20">
									commentable_type
								</th>
								<th className="px-2 py-1.5 text-left font-medium text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 w-12">
									..._id
								</th>
								<th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-12">
									user_id
								</th>
							</tr>
						</thead>
						<tbody>
							{UNIFIED_ROWS.map((row) => {
								const isActive =
									rewardHighlight?.parentKey === row.type.toLowerCase() ||
									rewardHighlight?.parentKey === 'all';
								return (
									<tr
										className={cn(
											'border-b border-border/30 last:border-b-0 transition-colors',
											isActive &&
												rewardHighlight?.result === 'allowed' &&
												'bg-emerald-50 dark:bg-emerald-950/30',
											isActive &&
												rewardHighlight?.result === 'blocked' &&
												'bg-destructive/10',
										)}
										key={row.id}
									>
										<td className="px-2 py-1.5 text-muted-foreground">
											{row.id}
										</td>
										<td className="px-2 py-1.5 text-muted-foreground truncate max-w-[120px]">
											{row.body}
										</td>
										<td className="px-2 py-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
											{row.type}
										</td>
										<td className="px-2 py-1.5 text-emerald-600 dark:text-emerald-400">
											{row.typeId}
										</td>
										<td className="px-2 py-1.5 text-muted-foreground">
											{row.userId}
										</td>
									</tr>
								);
							})}

							{/* Dynamic result row */}
							{lastScenario && lastResult && (
								<tr
									className={cn(
										'border-t-2 transition-colors',
										lastResult.result === 'allowed'
											? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40'
											: 'border-destructive/30 bg-destructive/5 dark:bg-destructive/10',
									)}
								>
									<td
										className={cn(
											'px-2 py-1.5 font-bold',
											lastResult.result === 'allowed'
												? 'text-emerald-600 dark:text-emerald-400'
												: 'text-destructive',
										)}
									>
										{lastResult.result === 'allowed' ? '+' : '\u00d7'}
									</td>
									<td
										className={cn(
											'px-2 py-1.5 col-span-4',
											lastResult.result === 'allowed'
												? 'text-emerald-600 dark:text-emerald-400'
												: 'text-destructive',
										)}
										colSpan={4}
									>
										{lastResult.result === 'allowed'
											? `commentable_type: "${rewardHighlight?.parentKey === 'all' ? '*' : (rewardHighlight?.parentKey?.replace(/^\w/, (c) => c.toUpperCase()) ?? '?')}"`
											: lastScenario.id === 'empty-body'
												? 'CommentContract validation failed'
												: 'Record not found'}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		);
	};

	// ──────────────────────────────────────────
	// Main render
	// ──────────────────────────────────────────

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Replace three separate comment tables with one polymorphic Comment model."
					instructions={
						phase === 'intro'
							? [
									'Review the three duplicate comment table schemas',
									'Notice the identical columns across all tables',
									'Click "Build the Fix" when ready to consolidate them',
								]
							: phase === 'build'
								? [
										'Generate the polymorphic migration',
										'Run the migration to create the table',
										'Define the Comment model and parent associations',
										'Build a service object with contract validation',
										'Wire the controller to use the service',
									]
								: phase === 'reward'
									? [
											'Fire scenarios to test comment creation on different types',
											'Try the new Article type (zero schema changes needed)',
											'Verify validation and error handling work correctly',
										]
									: ['Review your star rating and visualize the solution']
					}
					scenario="Photos and Videos now need comments alongside Posts. Three separate comment tables with identical schemas, duplicated validations, and scattered queries. Polymorphic associations can unify them."
				>
					{/* Phase-specific sidebar content */}
					<div className="border-t border-border">
						{phase === 'intro' && (
							<div className="p-4 text-xs text-muted-foreground space-y-2">
								<p>
									Three models need comments: Post, Photo, and Video. Each has
									its own comment table with nearly identical schemas.
								</p>
								<p>
									Polymorphic associations replace all three with a single
									unified Comment table.
								</p>
							</div>
						)}

						{(phase === 'build' || phase === 'activate') && (
							<div className="p-4">
								<StepProgress
									currentStep={stepper.currentStep}
									onStepClick={stepper.goToStep}
									steps={stepper.steps}
								/>
							</div>
						)}

						{phase === 'reward' && (
							<div className="p-4 space-y-3">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									Results
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="bg-success/10 dark:bg-success/20 rounded-lg p-2 text-center">
										<div className="text-lg font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success">Created</div>
									</div>
									<div className="bg-destructive/10 dark:bg-destructive/20 rounded-lg p-2 text-center">
										<div className="text-lg font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive">Rejected</div>
									</div>
								</div>
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

				<div className="flex-1 flex flex-col">
					{/* ── INTRO PHASE (Type 2: static annotated code) ── */}
					{phase === 'intro' && (
						<div className="flex-1 overflow-y-auto overflow-x-auto p-6">
							<div className="mx-auto flex flex-col items-center gap-5">
								{/* Problem banner */}
								<div className="inline-flex items-center gap-2 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 rounded-lg px-3 py-1.5">
									<Table2 className="w-4 h-4 text-destructive" />
									<span className="text-sm font-semibold text-destructive">
										3 Separate Comment Tables
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
										foreign key name differs. Adding a new commentable type
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
												Generate a Comment model with a polymorphic reference to
												any commentable parent.
											</p>
										) : (
											<p className="text-sm text-muted-foreground">
												Run the migration to create the comments table with
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

									{isViewingCompletedStep && hasNextStep && (
										<div className="flex justify-end">
											<Button onClick={stepper.nextStep} variant="outline">
												Next Step
												<ArrowRight className="w-4 h-4" />
											</Button>
										</div>
									)}
								</div>
							) : null}
						</div>
					)}

					{/* ── ACTIVATE PHASE ── */}
					{phase === 'activate' && (
						<div className="flex-1 flex flex-col items-center justify-center gap-6">
							<div className="flex items-center gap-1">
								{[1, 2, 3].map((s) => (
									<Star
										className={cn(
											'w-8 h-8',
											s <= stepper.starRating
												? 'text-yellow-500 fill-yellow-500'
												: 'text-muted-foreground',
										)}
										key={s}
									/>
								))}
							</div>
							<p className="text-muted-foreground text-sm">
								{stepper.starRating === 3
									? 'Perfect! No wrong attempts.'
									: stepper.starRating === 2
										? 'Good work! A couple of missteps.'
										: 'Complete! Room for improvement.'}
							</p>
							<Button onClick={handleActivateReward} size="lg">
								<Play className="w-4 h-4" />
								Visualize Polymorphic Comments
							</Button>
						</div>
					)}

					{/* ── REWARD PHASE ── */}
					{phase === 'reward' && (
						<>
							{renderRewardVisualization()}

							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={vizAnimating}
									isAutoFiring={stressTest.isAutoFiring}
									onFire={handleFireScenario}
									onToggleAutoFire={handleToggleAutoFire}
									results={stressTest.results}
									scenarios={STRESS_SCENARIOS}
								/>
							</div>
						</>
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
							? 'Three identical comment tables duplicate schema, validations, and queries. Any new commentable type requires another table.'
							: 'One polymorphic Comment model handles all parent types. commentable_type + commentable_id columns replace three separate foreign keys.'
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
									commentable_type stores the model name ("Post", "Photo")
								</span>
							</li>
							<li className="flex items-start gap-1.5">
								<Table2 className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>commentable_id stores the record ID</span>
							</li>
							<li className="flex items-start gap-1.5">
								<Zap className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>
									New types need only has_many :comments, as: :commentable
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
