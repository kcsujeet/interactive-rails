import type { Level } from '@/types';

export const level17Concerns: Level = {
	id: 'act3-level17-concerns',
	actId: 3,
	levelNumber: 17,
	name: 'Concerns & Modules',
	requiresTests: true,
	trigger: {
		type: 'code_review',
		description:
			'Tagging logic is copy-pasted across Product and Review models. Two copies of the same 40 lines. DRY it up with a Taggable concern.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'product-model',
				type: 'model',
				x: 200,
				y: 150,
				locked: true,
				config: { label: 'Product' },
			},
			{
				id: 'review-model',
				type: 'model',
				x: 200,
				y: 300,
				locked: true,
				config: { label: 'Review' },
			},
			{ id: 'database-node', type: 'database', x: 500, y: 225, locked: true },
		],
		connections: [
			{
				id: 'c1',
				sourceNodeId: 'product-model',
				targetNodeId: 'database-node',
			},
			{
				id: 'c2',
				sourceNodeId: 'review-model',
				targetNodeId: 'database-node',
			},
		],
	},
	problem: {
		observation:
			'Two models have identical tagging code: has_many :taggings, has_many :tags, scope :tagged_with, and #tag_list. 80 lines of duplication across Product and Review.',
		rootCause:
			'Shared behavior is duplicated across models instead of being extracted into an ActiveSupport::Concern.',
		codeExample: `# app/models/product.rb
class Product < ApplicationRecord
  has_many :taggings, as: :taggable, dependent: :destroy
  has_many :tags, through: :taggings

  scope :tagged_with, ->(tag_name) {
    joins(:tags).where(tags: { name: tag_name })
  }

  def tag_list
    tags.pluck(:name).join(", ")
  end

  def tag_list=(names)
    self.tags = names.split(",").map(&:strip).uniq.map { |n|
      Tag.find_or_create_by(name: n)
    }
  end
end

# app/models/review.rb -- EXACT SAME CODE
class Review < ApplicationRecord
  has_many :taggings, as: :taggable, dependent: :destroy
  has_many :tags, through: :taggings
  # ... identical 40 lines ...
end`,
		goal: 'Extract the shared tagging behavior into a Taggable concern and include it in both models.',
		thresholds: {},
	},
	successConditions: [{ type: 'concerns_configured' }],
	availableNodes: ['concern'],
	unlockedNodes: ['concern'],
	learningContent: {
		title: 'ActiveSupport::Concern & Shared Behavior',
		goal: `In this level, you'll:\n- learn how to eliminate code duplication across models using ActiveSupport::Concern.\n- extract shared behavior like tagging into a reusable module.\n- understand the included and class_methods blocks.\n- include the same concern in multiple models so changes only need to happen in one place.`,
		conceptExplanation: `Concerns extract shared behavior into reusable modules that can be included in multiple models or controllers.

**ActiveSupport::Concern provides:**
- \`included\` block for associations, scopes, and validations
- \`class_methods\` block for class-level methods
- Automatic dependency resolution between concerns
- Clean syntax that avoids the Ruby \`def self.included\` boilerplate

**When to use:**
- Same code in 2+ models (DRY principle)
- Behavior that is conceptually separate from the model's core responsibility
- Polymorphic patterns (tagging, reviewing, auditing, soft-deletes)

**When NOT to use:**
- Kitchen-sink concerns that bundle unrelated behaviors
- Concerns that are only used by one model (just put it in the model)
- As a way to hide a god model's complexity (splitting a 500-line model into 5 concerns does not reduce complexity)`,
		railsCodeExample: `# app/models/concerns/taggable.rb
module Taggable
  extend ActiveSupport::Concern

  included do
    has_many :taggings, as: :taggable, dependent: :destroy
    has_many :tags, through: :taggings

    scope :tagged_with, ->(tag_name) {
      joins(:tags).where(tags: { name: tag_name })
    }
  end

  def tag_list
    tags.pluck(:name).join(", ")
  end

  def tag_list=(names)
    self.tags = names.split(",").map(&:strip).uniq.map { |n|
      Tag.find_or_create_by(name: n)
    }
  end

  class_methods do
    def most_tagged(limit = 10)
      joins(:taggings)
        .group(:id)
        .order("COUNT(taggings.id) DESC")
        .limit(limit)
    end
  end
end

# app/models/product.rb -- clean!
class Product < ApplicationRecord
  include Taggable

  belongs_to :author, class_name: "User"
  has_many :reviews, dependent: :destroy
end

# app/models/review.rb -- clean!
class Review < ApplicationRecord
  include Taggable

  belongs_to :product
  belongs_to :user
end

# Test the concern independently:
# test/models/concerns/taggable_test.rb
class TaggableTest < ActiveSupport::TestCase
  test "tag_list returns comma-separated tags" do
    product = Product.create!(title: "Test", body: "Body", author: users(:alice))
    product.tag_list = "ruby, rails, api"

    assert_equal 3, product.tags.count
    assert_includes product.tag_list, "ruby"
  end

  test "tagged_with scope returns matching records" do
    product = products(:tagged_product)
    product.tag_list = "ruby, rails"

    results = Product.tagged_with("ruby")
    assert_includes results, product
  end

  test "most_tagged returns records ordered by tag count" do
    popular = Product.create!(title: "Popular", body: "Body", author: users(:alice))
    popular.tag_list = "ruby, rails, api, testing"

    top = Product.most_tagged(1).first
    assert_equal popular, top
  end
end`,
		commonMistakes: [
			'Creating "god concerns" that bundle unrelated behaviors (Searchable + Publishable + Notifiable all in one)',
			'Using concerns to hide complexity instead of reducing it',
			'Not testing concerns independently from the host model',
			"Concerns with dependencies on the host model's specific attributes (breaks when included elsewhere)",
			'Forgetting the `extend ActiveSupport::Concern` line (included block silently breaks)',
		],
		whenToUse:
			'When 2+ models share identical behavior, especially polymorphic patterns like tagging, auditing, reviewing, or soft-deletes.',
		furtherReading: [
			{
				title: 'ActiveSupport::Concern',
				url: 'https://api.rubyonrails.org/classes/ActiveSupport/Concern.html',
			},
			{
				title: 'Rails Guides: Active Record Basics',
				url: 'https://guides.rubyonrails.org/active_record_basics.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Two models need the same behavior. Where in app/ does Rails expect shared model behavior to live so it can be `include`d into each model class with one line?',
	},
};
