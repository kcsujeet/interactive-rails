import type { Level } from '@/types';

export const level4Associations: Level = {
	id: 'act1-level4-associations',
	actId: 1,
	levelNumber: 4,
	name: 'Associations',
	trigger: {
		type: 'new_feature',
		description:
			'Your app has a Product model from L3, but only that one model. Customers want to leave reviews, and a second model on its own would still be unlinked to the first. Two records that belong together need a relationship Rails understands.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 460,
				y: 220,
				locked: true,
			},
			{
				id: 'product-model',
				type: 'model',
				x: 660,
				y: 220,
				locked: true,
				config: { label: 'Product' },
			},
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 460,
				y: 420,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 660, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{
				id: 'c2',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{
				id: 'c3',
				sourceNodeId: 'controller-node',
				targetNodeId: 'product-model',
			},
			{
				id: 'c4',
				sourceNodeId: 'product-model',
				targetNodeId: 'database-node',
			},
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c6',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'In the Rails console, Product is the only model that loads. Asking a product for related records raises NoMethodError, and the second model the storefront needs has not been built yet.',
		rootCause:
			'No second model exists and no association is defined linking Product to its children.',
		codeExample: `# Today: only one model exists.
#
# class Product < ApplicationRecord
#   # name, description, price -- nothing else
# end
#
# (no Review model exists yet, no reviews table either)
#
# Two questions you will answer along the way:
#   1. How does a child record remember which parent it belongs to?
#      (a column? an index? a database-level constraint? all three?)
#   2. When a parent is destroyed, what should happen to its children?
#      (Rails leaves this unspecified by default -- and that default
#      is almost never what you actually want.)`,
		goal: 'End with a second model linked to Product so a parent record can ask for its children in the console, and deleting a product cleans up its children automatically.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_count', nodeType: 'model', count: 2 },
		{ type: 'connection', sourceType: 'model', targetType: 'model' },
		{ type: 'decision_made', decisionValue: 'has_many' },
	],
	availableNodes: ['model'],
	unlockedNodes: [],
	decisionModals: [
		{
			trigger: { sourceType: 'model', targetType: 'model' },
			question: 'What type of relationship is this?',
			options: [
				{
					label: 'has_one',
					value: 'has_one',
					preview: 'Only one review per product will appear',
					consequence: 'This limits products to a single review',
					correct: false,
				},
				{
					label: 'has_many',
					value: 'has_many',
					preview: 'All reviews for a product will appear',
					consequence: 'Products can have unlimited reviews',
					correct: true,
				},
				{
					label: 'has_and_belongs_to_many',
					value: 'habtm',
					preview: 'Reviews shared between products',
					consequence: 'Creates a many-to-many relationship',
					correct: false,
				},
			],
		},
	],
	learningContent: {
		title: 'ActiveRecord Associations',
		goal: `In this level, you'll:\n- link two models so a parent can list its children and a child can name its parent.\n- pick the right cardinality (one-to-one, one-to-many, many-to-many) for the relationship.\n- understand where the foreign key column lives, and back it with a database-level constraint and an index.\n- decide what happens to children when the parent is destroyed, instead of leaving the default unspecified.`,
		conceptExplanation: `Associations define relationships between models:

**has_many**: A product has many reviews (one-to-many)
**belongs_to**: A review belongs to a product (the inverse)
**has_one**: A user has one profile (one-to-one)
**has_many :through**: Products have many categories through categorizations (many-to-many)

The foreign key (\`product_id\`) lives on the \`belongs_to\` side (reviews table).
Always add \`dependent: :destroy\` to clean up child records.

**Pick \`dependent:\` deliberately, never default:**
Four real choices, each one a different decision:
- \`:destroy\` runs callbacks on each child (use when children have their own cleanup like after_commit jobs).
- \`:delete_all\` issues a single \`DELETE FROM reviews WHERE product_id = ?\` and skips callbacks (faster, use when children have no cleanup logic).
- \`:nullify\` sets \`product_id = NULL\` on children (use when children should outlive their parent).
- \`:restrict_with_error\` blocks the parent's destroy if any children exist (use when orphans would corrupt invariants).

A bare \`has_many :reviews\` with no \`dependent:\` orphans the children silently when the parent is destroyed. Convention: every \`has_many\` and \`has_one\` ships with an explicit \`dependent:\`.

**Foreign key constraints AT THE DATABASE:**
The migration field type that links two tables (used in the build phase) gives you three things at once: the foreign key column, an index on it, and a database-level FK constraint. The FK constraint matters: without it, a stray \`Product.delete\` (skipping callbacks) leaves orphaned children and the database has no idea. The constraint makes Postgres refuse the delete, and Rails surfaces the error. Defense in depth: \`dependent:\` at the model layer, FK constraint at the database layer.`,
		railsCodeExample: `# After completing this level you will have:
# 1. generated a Review model linked to Product through a
#    migration field type that creates the foreign key column,
#    its index, and the database-level FK constraint at once
# 2. declared the parent->children association on Product with
#    an explicit cleanup behaviour so destroying a parent does
#    not leave orphaned children
# 3. declared the child->parent association on Review
# 4. exercised the link in the console:
#    product.reviews and product.reviews.create(body: "...")

# Verify (after the level):
product = Product.find(1)
product.reviews          # => collection of reviews for this product
product.destroy          # => reviews go with it, no orphans left behind`,
		commonMistakes: [
			'Picking the wrong relationship cardinality. A product might have one of something or many -- each is a different declaration, and the wrong one limits how the records can be related forever.',
			'Declaring a relationship without specifying what happens to the children when the parent is destroyed. Rails leaves it unspecified, the database leaves the orphans behind, and reports start to drift.',
			'Adding a foreign key column without adding the database-level constraint and the index. The relationship works in Ruby, but the database has no way to enforce it -- a stray delete corrupts the table silently.',
		],
		whenToUse: 'has_many when one record owns multiple of another type.',
		furtherReading: [
			{
				title: 'Rails Associations',
				url: 'https://guides.rubyonrails.org/association_basics.html',
			},
		],
		homework: [
			{
				task: 'Generate a Review model that references Product, and migrate.',
				commands: [
					'bin/rails generate model Review product:references rating:integer body:text',
					'bin/rails db:migrate',
				],
				verify:
					'The reviews table in db/schema.rb has a product_id column with an index and a foreign key.',
			},
			{
				task: 'Add `has_many :reviews, dependent: :destroy` to app/models/product.rb, then prove the cascade delete works in the console.',
				commands: [
					'bin/rails console',
					'product = Product.create!(name: "Mug", price: 12.5)',
					'product.reviews.create!(rating: 5, body: "Great")',
					'product.destroy',
					'Review.count',
				],
				verify:
					'Review.count returns 0 after the product is destroyed: the review went with it.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'When generating the child model, picking a field type that knows about the parent saves you three separate steps. A bare integer column would leave the database without an index, without a foreign key constraint, and the model without an automatic association.',
	},
};
