import type { Level } from '@/types';

export const level3Model: Level = {
	id: 'act1-level3-model',
	actId: 1,
	levelNumber: 3,
	name: 'The Model',
	trigger: {
		type: 'new_feature',
		description:
			'The Rails server boots, but every request you could send it has nothing to fetch. The database is empty -- no tables, no schema. You need to teach Rails what a Product looks like.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation:
			'Empty application with no data structure. You need to define what a Product looks like.',
		rootCause: 'No models defined yet.',
		codeExample: `# Rails model conventions:
# - Model names are singular PascalCase (not plural)
# - Table names are plural snake_case (auto-generated)
# - Each attribute has a type: string, text, integer,
#   boolean, datetime, float, decimal...

# string vs text:
#   string  - short content (titles, names), VARCHAR(255)
#   text    - long content (descriptions, bios), unlimited

# decimal vs float:
#   decimal - exact precision (prices, money), NUMERIC
#   float   - approximate (scientific data), not for money

# Your job: name the model, pick the right types,
# generate it, and migrate.`,
		goal: 'End with a Product table in the database that stores a short product name, a long description, and a price that handles money exactly.',
		thresholds: {},
	},
	successConditions: [{ type: 'node_present', nodeType: 'model' }],
	availableNodes: ['model'],
	unlockedNodes: [],
	learningContent: {
		title: 'ActiveRecord Models & Migrations',
		goal: `In this level, you'll:\n- define your first data model and learn how Rails maps Ruby classes to database tables.\n- use the model generator and choose the right column types (string, text, decimal).\n- run your first migration to create the table in PostgreSQL.`,
		conceptExplanation: `Models are the M in MVC. They represent your data and business logic.

**Key concepts:**
- Models map to database tables (Product → products table)
- Attributes become database columns
- Each attribute has a type (string, text, integer, decimal, boolean, datetime)
- Migrations are version-controlled database changes

**Rails conventions:**
- Model names are singular (Product, User, Review)
- Table names are plural (products, users, reviews)
- Primary key is \`id\` (auto-generated)
- \`created_at\` and \`updated_at\` are added by \`t.timestamps\``,
		railsCodeExample: `# Generate a model with attributes
rails generate model Product name:string description:text price:decimal

# This creates:
# - app/models/product.rb
# - db/migrate/xxx_create_products.rb

# app/models/product.rb
class Product < ApplicationRecord
  # Attributes: name, description, price, created_at, updated_at
end

# Run the migration
rails db:migrate

# Check the schema
rails db:schema:dump`,
		commonMistakes: [
			'Picking a column type by gut feel instead of by what kind of data the field stores. Each Rails column type maps to a specific SQL type with specific limits.',
			'Treating "text" and "short text" as the same thing. They are different SQL types in the underlying database.',
			'Storing money in a type that approximates instead of one that holds exact precision. Reports will drift over time.',
			'Generating the migration file but forgetting to apply it. The class exists but the table does not.',
		],
		whenToUse: 'Create a model for each entity in your domain.',
		furtherReading: [
			{
				title: 'Active Record Basics',
				url: 'https://guides.rubyonrails.org/active_record_basics.html',
			},
			{
				title: 'Active Record Migrations',
				url: 'https://guides.rubyonrails.org/active_record_migrations.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Rails models use singular PascalCase names. For attributes, think about what type of content each field stores.',
	},
};
