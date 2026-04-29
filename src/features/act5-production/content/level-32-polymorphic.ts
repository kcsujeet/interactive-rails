import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level32Polymorphic: Level = {
	id: 'act5-level32-polymorphic',
	actId: 5,
	levelNumber: 32,
	name: 'Polymorphic Associations',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Users want to review Products, ProductImages, AND ProductVideos. Three separate review tables with identical schemas exist. Polymorphic associations can unify them.',
	},
	startingPipeline: standardPipeline(),
	problem: {
		observation:
			'Three separate review tables exist: product_reviews, photo_reviews, video_reviews. Schema is duplicated, queries are scattered, and adding a new reviewable type means a new table and new controller.',
		rootCause:
			'Each reviewable model has its own dedicated reviews table instead of using a single polymorphic reviews table.',
		codeExample: `# Three separate service objects doing the same thing!
# app/services/create_product_review.rb
class CreateProductReview < ApplicationService
  Result = Data.define(:success?, :review, :errors)

  def initialize(product:, user:, params:)
    @product = product; @user = user; @params = params
  end

  def call
    v = ProductReviewContract.new.call(@params)
    return Result.new(success?: false,
      review: nil, errors: v.errors.to_h) if v.failure?
    review = @product.product_reviews.create!(
      user: @user, body: v[:body])
    Result.new(success?: true, review:, errors: [])
  end
end

# CreatePhotoReview, CreateVideoReview are identical copies!
# 3 tables, 3 models, 3 contracts, 3 services, 3 controllers
# Adding "review on Articles" means ANOTHER full set.`,
		goal: 'Replace three review tables with one polymorphic Review model that can belong to any reviewable resource. Build a single CreateReview service with contract validation.',
		thresholds: {},
	},
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Polymorphic Associations',
		goal: `In this level, you'll:\n- learn how polymorphic associations let a single model belong to multiple different parent types.\n- consolidate duplicate tables into one model that can belong to any reviewable resource.\n- understand when this pattern is the right choice versus separate tables.`,
		conceptExplanation: `Polymorphic associations let a model belong to more than one other model using a single association.

**How it works:**
- The child table stores two columns: \`reviewable_type\` (string) and \`reviewable_id\` (integer)
- \`reviewable_type\` holds the class name ("Product", "Photo", "Video")
- \`reviewable_id\` holds the foreign key
- Rails resolves the correct parent model at runtime

**When to use polymorphic:**
- Reviews on multiple types (Products, Photos, Videos)
- Taggings across models
- Attachments on different record types
- Activity logs referencing various models

**When NOT to use polymorphic:**
- When the number of types is fixed at 2 (just use two belongs_to)
- When you need database-level foreign key constraints

**Three patterns, one design space (don't confuse them):**

Rails has three different macros for "this thing has multiple types," and they solve three different problems. Knowing which one fits is half the work:

1. **\`polymorphic: true\`** (this level). One child model belongs to many *unrelated* parent types. The CHILDREN are uniform; the PARENTS differ. Reviews on Products / Photos / Videos all have the same review schema; the things being reviewed are the variety. Use when one child model needs to attach to many different parents.

2. **STI (Single Table Inheritance)**. One parent class, many subclasses, all rows in *one* wide table with a \`type\` column. Use only when subtypes share 90%+ of their columns (\`Vehicle\` → \`Car\`, \`Truck\`, same year, model, vin). Breaks down once subtypes need different columns: the table fills with NULLs and the schema rots.

3. **\`delegated_type\`** (Rails 6.1+, the modern fix for "STI is wrong here"). One parent record with the *common* columns plus a polymorphic association to a subtype record that holds the *specific* columns. Each subtype gets its own table, so no NULLs, but Rails still presents them as one polymorphic abstraction at the API level.
\`\`\`ruby
class Entry < ApplicationRecord
  delegated_type :entryable, types: %w[ Message Comment ]
end

class Message < ApplicationRecord
  has_one :entry, as: :entryable, touch: true
end

class Comment < ApplicationRecord
  has_one :entry, as: :entryable, touch: true
end
\`\`\`

**Quick decision:**
- One child, many parent types → **polymorphic** (this level).
- One parent, many subtypes that share most columns → STI.
- One parent, many subtypes with their own columns → **delegated_type**.

If you reach for STI but find yourself adding subtype-specific columns that mostly hold NULL, switch to \`delegated_type\` instead. The Rails Guides still show STI in many examples, it's the legacy default.`,
		railsCodeExample: `# Migration
class CreateReviews < ActiveRecord::Migration[8.0]
  def change
    create_table :reviews do |t|
      t.text :body, null: false
      t.references :reviewable, polymorphic: true, null: false
      t.references :user, null: false, foreign_key: true
      t.timestamps
    end
    add_index :reviews, [:reviewable_type, :reviewable_id]
  end
end

# app/models/review.rb
class Review < ApplicationRecord
  belongs_to :reviewable, polymorphic: true
  belongs_to :user
  validates :body, presence: true, length: { maximum: 10_000 }
end

# app/models/product.rb (same for Photo, Video)
class Product < ApplicationRecord
  has_many :reviews, as: :reviewable, dependent: :destroy
end

# app/contracts/review_contract.rb
class ReviewContract < Dry::Validation::Contract
  params do
    required(:body).filled(:string, max_size?: 10_000)
  end
end

# app/services/create_review.rb
class CreateReview < ApplicationService
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
      user: @user, body: v[:body])
    Result.new(success?: true, review:, errors: [])
  end
end

# app/controllers/api/v1/reviews_controller.rb
class Api::V1::ReviewsController < ApplicationController
  def create
    result = CreateReview.call(
      reviewable: find_reviewable,
      user: Current.user,
      params: params.expect(review: [:body]))
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
		commonMistakes: [
			'Not adding a composite index on [reviewable_type, reviewable_id]',
			'Forgetting that database-level foreign keys cannot enforce polymorphic associations',
			'Not using eager loading with polymorphic associations (causes N+1)',
			'Storing full namespaced class names when STI is involved',
			'Not validating that reviewable_type is in an allowed list',
		],
		whenToUse:
			'When the same child model (reviews, tags, attachments) needs to belong to multiple unrelated parent models with identical schemas. If you reach the opposite shape (one parent, many subtypes with their own columns), use `delegated_type` instead, see the concept explanation.',
		furtherReading: [
			{
				title: 'Rails Polymorphic Associations',
				url: 'https://guides.rubyonrails.org/association_basics.html#polymorphic-associations',
			},
			{
				title: 'Polymorphic Routes in Rails',
				url: 'https://api.rubyonrails.org/classes/ActionDispatch/Routing/PolymorphicRoutes.html',
			},
			{
				title: 'ActiveRecord delegated_type (Rails 6.1+)',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/DelegatedType.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a single Review model with polymorphic: true. Connect it to Product, ProductImage, and ProductVideo using `as: :reviewable`.',
	},
};
