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
			'When moderation shipped, the flagging code was written in Product and copy-pasted into Review. After the spring spam wave, Product got a fix: auto-hide at 3 flags. Nobody remembered the copy in Review, and this weekend a scam review collected four flags and stayed on the storefront all weekend. Give the behavior one home.',
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
			'Product and Review each carry their own copy of the flagging behavior, and the copies have drifted: Product hides content automatically at 3 flags, Review still waits for a threshold of 5 and never auto-hides at all. A scam review ("text the seller directly, save 20%") survived the weekend at four flags while the same scammer\'s product listing auto-hid at three.',
		rootCause:
			'Shared behavior was duplicated by copy-paste instead of being given a single home. Duplicated code does not stay identical: fixes land in one copy and miss the other, and the miss is invisible until a customer finds it. DRY is about knowledge, and this knowledge (when content gets hidden) now has two contradicting versions.',
		codeExample: `# app/models/product.rb (got the fix)
scope :flagged, -> { where("flags_count >= ?", 3) }

def flag!
  increment!(:flags_count)
  update!(hidden: true) if flags_count >= 3   # auto-hide
end

# app/models/review.rb (the forgotten copy)
scope :flagged, -> { where("flags_count >= ?", 5) }

def flag!
  increment!(:flags_count)
  # ... and that is all it does. No auto-hide.
end

# The weekend incident:
#   Scam review: 4 flags -> still visible (threshold 5, no hide)
#   Scam product: 3 flags -> auto-hidden
# Same behavior, two copies, one fix, one miss.`,
		goal: 'Move the flagging behavior into a single shared home that both models adopt with one line each, keeping the fixed version (threshold 3, auto-hide) so a future change can never miss a copy again.',
		thresholds: {},
	},
	successConditions: [{ type: 'concerns_configured' }],
	availableNodes: ['concern'],
	unlockedNodes: ['concern'],
	learningContent: {
		title: 'ActiveSupport::Concern & Shared Behavior',
		goal: `In this level, you'll:\n- see how copy-pasted behavior drifts, and why the drift is invisible until a customer finds it.\n- extract shared model behavior into a module with exactly one definition of the rule.\n- learn what goes in the included block (class macros) versus the module body (instance methods).\n- adopt the shared behavior in each model with a single include line.`,
		conceptExplanation: `A concern is a Ruby module, upgraded by ActiveSupport::Concern so it can carry everything a model needs: associations, scopes, validations, and plain methods.

**The two halves of a concern** (per the [ActiveSupport::Concern docs](https://api.rubyonrails.org/classes/ActiveSupport/Concern.html)):
- The \`included do ... end\` block is evaluated in the context of the including class. This is where class-level macros go: \`scope\`, \`has_many\`, \`validates\`. They need a real model class to run against, and the block gives them one at include time.
- Ordinary instance methods live in the module body, exactly like any Ruby module. \`include\` mixes them in, so \`review.flag!\` works and tools can still see where \`flag!\` is defined.
- A \`class_methods do ... end\` block exists for class-level methods, when you need them.

**Why include (not extend, not prepend):** \`include\` mixes instance methods in and fires the concern's included hook. \`extend\` would attach everything as class methods. \`prepend\` changes method lookup order and fires a different hook (\`prepended\`), so the included block never runs.

**What the extraction buys:**
- The rule ("hide at 3 flags") exists ONCE. The next change lands everywhere at the same moment, which makes the drift class of bug structurally impossible.
- The next model that needs flagging adopts it with one line.
- One file to read, test, and review.

**When NOT to use concerns:**
- Kitchen-sink concerns bundling unrelated behaviors (keep each one narrow and named for what it does)
- Behavior used by exactly one model (just leave it in the model)
- Hiding a god model's complexity by splitting 500 lines into 5 concerns (the complexity is still there, now with extra indirection)
- Multi-step workflows with side effects (that is service territory, the previous level's tool: concerns share BEHAVIOR, services own WORKFLOWS)`,
		railsCodeExample: `# app/models/concerns/flaggable.rb
module Flaggable
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
end

# app/models/product.rb -- one line adopts the whole behavior
class Product < ApplicationRecord
  include Flaggable

  belongs_to :user
  has_many :reviews, dependent: :destroy
  # validations, enum, normalizes unchanged...
end

# app/models/review.rb -- identical behavior, guaranteed
class Review < ApplicationRecord
  include Flaggable

  belongs_to :product
end

# Test the concern once, through any including model:
# test/models/concerns/flaggable_test.rb
class FlaggableTest < ActiveSupport::TestCase
  test "auto-hides at the threshold" do
    review = reviews(:scam)

    (Flaggable::FLAG_THRESHOLD - 1).times { review.flag! }
    assert review.visible?

    review.flag!
    refute review.visible?
  end

  test "visible scope excludes hidden content" do
    hidden = reviews(:scam).tap { |r| r.update!(hidden: true) }
    refute_includes Review.visible, hidden
  end
end`,
		commonMistakes: [
			'Copy-pasting shared behavior instead of extracting it (the copies WILL drift; the miss shows up as a customer-facing incident, not a code review comment)',
			'Putting instance methods inside the included block (it runs, but every def is re-evaluated into each model and tooling loses track of where methods live)',
			'Putting class macros like scope in the module body (there is no class to define them on; the file blows up at load)',
			'Using extend or prepend to adopt a concern (class methods instead of instance methods, or a hook that never fires)',
			'Kitchen-sink concerns that bundle unrelated behaviors into one module',
			'Extracting behavior only one model uses (a concern with a single includer is indirection without payoff)',
		],
		whenToUse:
			'When two or more models share the same behavior, especially cross-cutting rules like flagging, visibility, or auditing. The moment you catch yourself copy-pasting model code, that is the signal.',
		furtherReading: [
			{
				title: 'ActiveSupport::Concern (API docs)',
				url: 'https://api.rubyonrails.org/classes/ActiveSupport/Concern.html',
			},
			{
				title: 'Rails Guides: Active Support Core Extensions',
				url: 'https://guides.rubyonrails.org/active_support_core_extensions.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Two models need the same behavior, and the fix that missed Review proves why one home matters. Where in app/models/ does Rails expect shared model behavior to live so each model can adopt it with a single line? Keep the version with the auto-hide when you extract.',
	},
};
