import type { Level } from '@/types';

export const level8Associations: Level = {
	id: 'act1-level8-associations',
	actId: 1,
	levelNumber: 8,
	name: 'Associations',
	trigger: {
		type: 'new_feature',
		description:
			'Products need reviews! Generate the Review model, choose the right association type, configure cascade deletion, and test the relationship.',
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
			'Products load correctly, but there is no way to include reviews in the API response.',
		rootCause:
			'No Review model exists and no association is defined between Product and Review.',
		codeExample: `# Associations link models together:
#   has_many    - one-to-many (parent side)
#   belongs_to  - inverse (child side)
#   has_one     - one-to-one
#   has_and_belongs_to_many - many-to-many
#
# The foreign key lives on the belongs_to side.
# Using "product:references" in a generator adds:
#   - Foreign key column (product_id)
#   - Database index
#   - belongs_to association (automatic!)
#
# When a parent is destroyed, what happens to children?
#   dependent: :destroy, :nullify, :restrict_with_error
#
# Your job: generate Review, set up the relationship,
# and handle cascade deletion.`,
		goal: 'Generate the Review model with product:references, choose the right relationship type, configure dependent destruction, and test the association.',
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
		goal: `In this level, you'll:\n- link models together using ActiveRecord associations.\n- learn how has_many and belongs_to create one-to-many relationships.\n- understand where the foreign key lives.\n- set up dependent: :destroy so deleting a product automatically cleans up its reviews.`,
		conceptExplanation: `Associations define relationships between models:

**has_many**: A product has many reviews (one-to-many)
**belongs_to**: A review belongs to a product (the inverse)
**has_one**: A user has one profile (one-to-one)
**has_many :through**: Products have many categories through categorizations (many-to-many)

The foreign key (\`product_id\`) lives on the \`belongs_to\` side (reviews table).
Always add \`dependent: :destroy\` to clean up child records.`,
		railsCodeExample: `# app/models/product.rb
class Product < ApplicationRecord
  has_many :reviews, dependent: :destroy
end

# app/models/review.rb
class Review < ApplicationRecord
  belongs_to :product
end

# Migration for reviews:
create_table :reviews do |t|
  t.references :product, null: false, foreign_key: true
  t.text :body
  t.integer :rating
  t.timestamps
end

# Usage:
product = Product.find(1)
product.reviews                    # All reviews for this product
product.reviews.create(body: "Great laptop!", rating: 5)

# In serializer:
class ProductSerializer < BaseSerializer
  attribute :name
  attribute :description
  has_many :reviews, serializer: ReviewSerializer
end`,
		commonMistakes: [
			'Using has_one when you need has_many',
			'Forgetting dependent: :destroy (orphaned records)',
			'Not adding a foreign key index',
			'Not including associations in the serializer',
		],
		whenToUse: 'has_many when one record owns multiple of another type.',
		furtherReading: [
			{
				title: 'Rails Associations',
				url: 'https://guides.rubyonrails.org/association_basics.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Use product:references in the generator to automatically add the foreign key, index, and belongs_to. Products have many reviews, not just one.',
	},
};
