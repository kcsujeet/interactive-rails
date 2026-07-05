import type { Level } from '@/types';

export const level4CRUD: Level = {
	id: 'act1-level4-crud',
	actId: 1,
	levelNumber: 4,
	name: 'CRUD Operations',
	trigger: {
		type: 'new_feature',
		description:
			'Your Product table exists but holds zero rows. Open the Rails console and use ActiveRecord directly to put something in, find it again, change it, and remove it.',
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
		codeExample: `# ActiveRecord exposes more than one method for each
# of the four database operations: create, read, update,
# delete. The variants are not interchangeable.
#
# - Some methods run validations and callbacks; others skip
#   them silently and leave invalid rows in the database.
# - Some methods raise on failure; others quietly return an
#   unsaved object that downstream code mistakes for saved.
# - Some methods only mutate the in-memory object and never
#   touch the database at all unless you save afterwards.
#
# Your job: in the Rails console, pick the right method
# for each step (create, read, update, delete) and confirm
# the table is empty at the end.`,
		goal: 'End the level having put a record in the database, fetched it back, updated it, removed it, and confirmed the table is empty -- all from the Rails console.',
		thresholds: {},
	},
	successConditions: [{ type: 'crud_complete', modelType: 'Product' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'ActiveRecord CRUD',
		goal: `In this level, you'll:\n- exercise the four fundamental database operations -- create, read, update, destroy -- on a real model from the Rails console.\n- recognise that ActiveRecord exposes more than one method per operation, and pick the variant that runs validations and callbacks instead of the one that bypasses them.\n- confirm the table is empty after a destroy by counting rows.`,
		conceptExplanation: `CRUD = Create, Read, Update, Destroy. Every database-backed app needs these four operations, and ActiveRecord translates them into SQL automatically.

**Each operation has more than one method, and the differences matter:**
- For Create: there are methods that build an in-memory object without touching the database, methods that build-and-save, and low-level methods that bypass Rails entirely (skipping validations, callbacks, and timestamps).
- For Read: there are finders that take a primary key and raise if missing, finders that filter by arbitrary conditions, and lazy-vs-eager variants.
- For Update: there are methods that run validations and update timestamps, and methods that skip both for a one-column nudge.
- For Destroy: there are methods that run \`before_destroy\` / \`after_destroy\` callbacks and methods that issue a raw \`DELETE\` and skip them.

Pick the higher-level, validation-respecting variant by default. Reach for the lower-level one only when you specifically need to bypass the lifecycle.

**Bang vs non-bang (\`save\` vs \`save!\`, \`create\` vs \`create!\`):**
Almost every write method has two forms. The non-bang form returns the record whether or not it was actually saved (you have to check \`record.persisted?\` or \`record.errors.any?\` to know). The bang form raises \`ActiveRecord::RecordInvalid\` if validations fail.

The rule:
- **Use the bang form** in scripts, the console, seeds, migrations, and anywhere you EXPECT the write to succeed. Failure should crash loud, not return a quiet invalid record that propagates downstream.
- **Use the non-bang form** in controllers and any code that explicitly handles validation failure (\`if product.save; ...; else; render :unprocessable_entity; end\`).

Returning a silently-invalid record is the source of "the record did not save and I cannot figure out why" bugs. Default to bang; switch to non-bang only when you have a branch for the failure path.`,
		railsCodeExample: `# After completing this level you will have, from the Rails console:
# 1. inserted a row by calling the validation-respecting Create method
# 2. fetched the row back by primary key
# 3. updated one of its attributes through a method that runs validations
# 4. destroyed the row through a method that runs lifecycle callbacks
# 5. confirmed the table is empty by counting rows

# Each method ActiveRecord exposes maps to a SQL query, e.g.:
#   reading by primary key  -> SELECT ... WHERE id = ?
#   updating one attribute  -> UPDATE products SET ... WHERE id = ?
#   destroying one row      -> DELETE FROM products WHERE id = ?
# Picking the wrong variant of any of these can skip validations,
# callbacks, or the updated_at timestamp without warning.`,
		commonMistakes: [
			'Reaching for the lower-level method that bypasses Rails lifecycle hooks when the higher-level one would do exactly what you want. The lower-level method silently skips validations and callbacks.',
			'Not checking the boolean return value of a non-bang write method. The record looks like it saved; in fact it failed validation and downstream code now uses an unsaved object.',
			'In scripts, seeds, and the console: using the non-bang variant where you actually expect success. The bang form crashes loud on validation failure; the non-bang form returns the invalid record and downstream code gets confused.',
			'Putting `Float` literals like `price: 999.99` into a decimal column. Floats lose precision at large magnitudes; let Rails coerce a `String` ("999.99") or use `BigDecimal` so the value never goes through Float at all.',
			'Using a "skip just one callback" method. It also skips validations and the `updated_at` timestamp, leaving rows that fail later validations and break audit trails. Almost always the wrong tool.',
		],
		whenToUse: 'These are the building blocks of every Rails feature.',
		furtherReading: [
			{
				title: 'Active Record Query Interface',
				url: 'https://guides.rubyonrails.org/active_record_querying.html',
			},
		],
		homework: [
			{
				task: 'Run the full create-read-update-destroy cycle by hand in the Rails console.',
				commands: [
					'bin/rails console',
					'p = Product.create!(name: "Desk", price: 199.0)',
					'Product.count',
					'p.update!(price: 149.0)',
					'p.reload.price',
					'p.destroy!',
					'Product.count',
				],
				verify:
					'The count goes up after create and back down after destroy, and reload shows the updated price in between.',
			},
		],
	},
	hint: {
		delay: 15,
		text: 'Pick the right ActiveRecord method for each operation. Watch for methods that skip callbacks or only work in memory.',
	},
};
