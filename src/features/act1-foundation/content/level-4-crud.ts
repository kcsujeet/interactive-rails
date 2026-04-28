import type { Level } from '@/types';

export const level4CRUD: Level = {
	id: 'act1-level4-crud',
	actId: 1,
	levelNumber: 4,
	name: 'CRUD Operations',
	trigger: {
		type: 'new_feature',
		description:
			'The Product model exists but the database is empty. Use the Rails console to create, read, update, and destroy your first records.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'model-node',
				type: 'model',
				x: 400,
				y: 250,
				locked: true,
				config: { label: 'Product' },
			},
			{ id: 'database-node', type: 'database', x: 600, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'Model exists but no data. The console shows Product.count => 0.',
		rootCause: 'No records have been created yet.',
		codeExample: `# ActiveRecord has methods for each operation:
#
# CREATE - save a new record to the database
#   .create  vs  .new  vs  .insert
#
# READ - fetch records by ID or attributes
#   .find  vs  .select  vs  .where
#
# UPDATE - change and persist attributes
#   .update  vs  assignment  vs  .update_column
#
# DELETE - remove from database
#   .destroy  vs  .delete
#
# Some methods skip validations or callbacks.
# Your job: pick the right one each time.`,
		goal: 'Run each CRUD operation in the Rails console: create a product, read it back, update it, destroy it, and verify it is gone.',
		thresholds: {},
	},
	successConditions: [{ type: 'crud_complete', modelType: 'Product' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'ActiveRecord CRUD',
		goal: `In this level, you'll:\n- learn the four fundamental database operations: creating, reading, updating, and destroying records.\n- work in the Rails console using ActiveRecord methods like create, find, where, update, and destroy.\n- interact with your Product model directly through CRUD operations.`,
		conceptExplanation: `CRUD = Create, Read, Update, Destroy. Every database-backed app needs these four operations.

**Create:** \`Product.create(attrs)\` or \`Product.new(attrs)\` + \`product.save\`
**Read:** \`Product.all\`, \`Product.find(id)\`, \`Product.where(conditions)\`, \`Product.find_by(attr)\`
**Update:** \`product.update(attrs)\` or \`product.attribute = value\` + \`product.save\`
**Destroy:** \`product.destroy\` (removes from DB)

ActiveRecord translates these into SQL queries automatically.

**Bang vs non-bang (\`save\` vs \`save!\`, \`create\` vs \`create!\`):**
Almost every write method has two forms. \`create\` returns the record whether or not it was actually saved (you have to check \`record.persisted?\` or \`record.errors.any?\` to know). \`create!\` raises \`ActiveRecord::RecordInvalid\` if validations fail. Same for \`save\` / \`save!\` and \`update\` / \`update!\`.

The rule:
- **Use the bang form** in scripts, the console, seeds, migrations, and anywhere you EXPECT the write to succeed. Failure should crash loud, not return a quiet invalid record that propagates downstream.
- **Use the non-bang form** in controllers and any code that explicitly handles validation failure (\`if product.save; ...; else; render :unprocessable_entity; end\`).

Returning a silently-invalid record is the source of "the record didn't save and I can't figure out why" bugs. Default to bang; switch to non-bang only when you have a branch for the failure path.`,
		railsCodeExample: `# CREATE - two ways
product = Product.create(name: "Laptop", description: "16-inch display", price: 999.99)
# or
product = Product.new(name: "Laptop", description: "16-inch display", price: 999.99)
product.save

# READ - many ways
Product.all                          # SELECT * FROM products
Product.find(1)                      # SELECT * FROM products WHERE id = 1
Product.where("price > ?", 100)      # SELECT * FROM products WHERE price > 100
Product.find_by(name: "Laptop")      # LIMIT 1
Product.order(created_at: :desc)     # ORDER BY created_at DESC
Product.first                        # LIMIT 1 ORDER BY id ASC
Product.last                         # LIMIT 1 ORDER BY id DESC

# UPDATE
product.update(price: 899.99)        # UPDATE products SET price = 899.99 WHERE id = 1

# DESTROY
product.destroy                      # DELETE FROM products WHERE id = 1
Product.destroy_all                  # DELETE FROM products (careful!)`,
		commonMistakes: [
			'Using Product.delete instead of Product.destroy (skips callbacks)',
			'Not checking if save/update returns false',
			'Using find when find_by would be safer (find raises on not found)',
			'Calling destroy_all without conditions',
			'Using create / save / update in scripts and seeds where you expect success. The non-bang form returns silently on validation failure; use create! / save! / update! so failure crashes loud',
			'Passing Float literals like price: 999.99 to a decimal column. Floats lose precision at large magnitudes; pass BigDecimal("999.99") or "999.99" so the value reaches the database without going through Float',
			'Using update_column or update_columns to "skip a callback." It also skips validations AND the updated_at timestamp, leaving rows that fail later validations and break audit trails. Almost always the wrong tool',
		],
		whenToUse: 'These are the building blocks of every Rails feature.',
		furtherReading: [
			{
				title: 'Active Record Query Interface',
				url: 'https://guides.rubyonrails.org/active_record_querying.html',
			},
		],
	},
	hint: {
		delay: 15,
		text: 'Pick the right ActiveRecord method for each operation. Watch for methods that skip callbacks or only work in memory.',
	},
};
