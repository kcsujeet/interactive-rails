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
# - Each attribute has a type chosen to fit the kind of
#   content the column actually stores
#
# Each Rails column type maps to a specific SQL type with
# specific limits. "Short label" and "long body of text" are
# different SQL types under the hood. "Approximate" and "exact
# precision" are different SQL types under the hood.
#
# Your job: name the model, pick the right type for each
# field by what kind of data it stores, generate the model,
# and migrate the table into the database.`,
		goal: 'End with a Product table in the database that stores a short product name, a long description, and a price that handles money exactly.',
		thresholds: {},
	},
	successConditions: [{ type: 'node_present', nodeType: 'model' }],
	availableNodes: ['model'],
	unlockedNodes: [],
	learningContent: {
		title: 'ActiveRecord Models & Migrations',
		goal: `In this level, you'll:\n- define your first data model and learn how Rails maps Ruby classes to database tables.\n- use the model generator and pick the right column type for each field based on what it stores.\n- run your first migration to create the table in the database.`,
		conceptExplanation: `Models are the M in MVC. They represent your data and business logic.

**Key concepts:**
- Models map to database tables (Product -> products table).
- Each attribute becomes a database column with a specific type.
- Each Rails column type maps to a specific SQL type with specific limits, so the choice matters.
- Migrations are version-controlled database changes: a class describes a schema edit, and \`db:migrate\` applies it.

**Rails conventions:**
- Model names are singular (Product, User, Review).
- Table names are plural (products, users, reviews).
- Primary key is \`id\` (auto-generated).
- \`created_at\` and \`updated_at\` timestamp columns are added by \`t.timestamps\`.

**Picking column types:**
- Match the type to what the column actually stores. Short labels, long bodies of text, exact-precision numbers, and approximate floating-point numbers are different SQL types.
- Storing money in an approximating type drifts over time. Use the type designed for exact decimal arithmetic.
- "Short text" and "long text" map to different SQL types with different size limits. Choose by maximum length, not by feel.`,
		railsCodeExample: `# After completing this level you will have:
# 1. used the Rails model generator to create a model class
#    with attributes typed correctly for what each field stores
# 2. let Rails write the matching migration file under db/migrate/
# 3. applied the migration so the table physically exists in the database

# Verify (after the level):
rails db:schema:dump
# => products table with the chosen columns plus id and timestamps

# In Ruby code:
class Product < ApplicationRecord
  # Attributes are inferred from the products table:
  # id, name, description, price, created_at, updated_at
end`,
		commonMistakes: [
			'Picking a column type by gut feel instead of by what kind of data the field stores. Each Rails column type maps to a specific SQL type with specific limits.',
			'Treating "short label" and "long body of text" as the same thing. They are different SQL types in the underlying database.',
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
		text: 'Rails models use singular PascalCase names. For each attribute, ask: what kind of content does this field hold, and which SQL type matches it?',
	},
};
