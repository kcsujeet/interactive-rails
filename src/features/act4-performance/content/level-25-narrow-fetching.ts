import type { Level } from '@/types';

export const level25NarrowFetching: Level = {
	id: 'act4-level25-narrow-fetching',
	actId: 4,
	levelNumber: 25,
	name: 'Narrow Fetching',
	trigger: {
		type: 'performance_alert',
		description:
			'Multiple endpoints are eating memory. Explore the Data Table Heatmap to see how SELECT * loads 30 columns when only 2 are needed, then choose the right fetching strategy for each scenario.',
	},
	problem: {
		observation:
			'Several endpoints use SELECT * when they only need a few columns. A CSV export loads 50K full objects for just id and email. A dropdown fetches 10K AR objects for simple key-value pairs. A nightly sync loads everything at once instead of batching.',
		rootCause:
			'SELECT * fetches every column including large TEXT fields. No narrow fetching (pluck/select) or batch processing (find_in_batches).',
		codeExample: `# app/services/user_export.rb
class UserExport < ApplicationService
  Result = Data.define(:success?, :csv, :errors)

  def call
    validation = ExportContract.new.call({})
    return Result.new(...) if validation.failure?

    # SELECT * FROM users -- loads ALL 30 columns for 2 values
    users = User.all
    csv = CSV.generate { |csv| users.each { |u| csv << [u.id, u.email] } }
    Result.new(success?: true, csv: csv, errors: [])
  end
end
# Memory: 681 MB (only needed 2 columns!)

# Dropdown -- full AR objects for key-value pairs
categories = Category.all
categories.map { |c| [c.id, c.name] }
# Creates 10K AR objects for simple data

# Nightly sync -- loads 50K records at once
User.all.each { |u| SyncService.process(u) }
# Entire dataset in memory simultaneously`,
		goal: 'Explore the data table to discover why SELECT * wastes memory, then choose the right fetching strategy for each scenario.',
		thresholds: { maxMemoryUsage: 50 },
	},
	startingPipeline: { nodes: [], connections: [] },
	successConditions: [{ type: 'queries_optimized' }],
	requiresTests: true,
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Narrow Fetching: pluck, select & find_in_batches',
		goal: `In this level, you'll:\n- learn how to fetch only the data you actually need.\n- choose between raw arrays and lightweight model objects for different use cases.\n- process large datasets in manageable chunks instead of loading everything into memory.`,
		conceptExplanation: `After fixing N+1 and adding eager loading, the next performance win is fetching less data: not just fewer queries, but fewer columns and smaller batches.

**Production benchmarks (10K products with 75KB description column):**
\`\`\`
Product.all (wide):           212ms | 681 MB  | 149,000 objects
Product.select(:id, :name):  53ms |  12 MB  | 107,000 objects → 4x faster, 56x less memory
Product.pluck(:id, :name):   18ms |   2 MB  |  45,000 objects → 12x faster, 290x less memory
\`\`\`

**Real-world endpoint comparison at scale:**
\`\`\`
Product.all (wide):     1,101ms (742ms in DB)
Product.pluck (narrow): 76ms → 14x improvement
\`\`\`

**Three tools for narrow fetching:**

**\`pluck(:col1, :col2)\`** returns plain Ruby arrays:
- No ActiveRecord objects created, lowest memory possible
- Returns \`[[1, "Laptop"], [2, "Phone"]]\` not AR objects
- Use when you only need data values (CSV export, dropdown options, IDs for queries)

**\`select(:col1, :col2)\`** returns lightweight AR objects:
- Still creates AR objects, but skips unused columns
- Use when you need model methods (validations, associations, callbacks)
- Accessing an unselected column raises \`ActiveModel::MissingAttributeError\`

**\`find_in_batches(batch_size: 1000)\`** processes huge datasets:
- Generates \`LIMIT 1000 WHERE id > last_seen_id\` queries
- Only 1,000 records in memory at a time instead of 50,000
- Essential for exports, backfills, and data migrations

**Rule of thumb:**
- Prefer \`pluck\` when you only need data values
- Use \`select\` only when you need model methods
- Use \`find_in_batches\` when processing huge datasets

**Real-world story:** An unpaginated endpoint returning only \`id\` and \`name\` was timing out. Root cause: table had 30+ columns including serialized objects in TEXT fields. One user had stored the entire U.S. Constitution in a text field. The \`SELECT *\` forced the DB to write to disk mid-response.`,
		railsCodeExample: `# === pluck: raw arrays, minimal memory ===
Product.where(published: true).pluck(:id, :name)
# => [[1, "Laptop"], [2, "Phone"]]
# SELECT id, name FROM products WHERE published = true
# No AR objects! Just arrays.

# === select: lightweight AR objects ===
Product.select(:id, :name, :user_id).includes(:user)
# SELECT id, name, user_id FROM products
# AR objects with only 3 columns loaded
# product.description → raises ActiveModel::MissingAttributeError

# === find_in_batches: process huge datasets ===
Product.find_in_batches(batch_size: 1000) do |batch|
  csv_rows = batch.pluck(:id, :name).map { |r| r.join(",") }
  File.open("export.csv", "a") { |f| f.write(csv_rows.join("\\n")) }
end
# Generates: SELECT * FROM products WHERE id > 0 LIMIT 1000
#            SELECT * FROM products WHERE id > 1000 LIMIT 1000
#            ... (1000 records at a time, not 50K at once)

# === Combine for maximum efficiency ===
# Export endpoint (production-safe):
def export
  headers["Content-Type"] = "text/csv"
  headers["Content-Disposition"] = "attachment; filename=products.csv"

  # Stream CSV in batches, never loads all records at once
  Product.active.find_in_batches(batch_size: 2000) do |batch|
    rows = batch.pluck(:id, :name, :created_at)
    response.stream.write(rows.map { |r| r.join(",") }.join("\\n") + "\\n")
  end
ensure
  response.stream.close
end

# === For dropdown/autocomplete: pluck, don't load objects ===
# BAD: loads full AR objects just for a dropdown
User.all.map { |u| [u.id, u.name] }
# GOOD: returns just the data you need
User.pluck(:id, :name)`,
		commonMistakes: [
			'Using Product.all when you only need 2-3 columns (loads all 30 columns)',
			'Not using find_in_batches for large dataset processing (memory explosion)',
			'Using .length on a collection to get count (loads all records, use .count)',
			'Forgetting that select raises MissingAttributeError for unselected columns',
			'Using pluck inside a loop (N+1 pluck calls; batch the query instead)',
		],
		whenToUse:
			'Any endpoint that returns data from wide tables (10+ columns) or processes large datasets (1K+ records). CSV exports, admin dashboards, dropdown data, background data processing.',
		furtherReading: [
			{
				title: 'ActiveRecord pluck',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Calculations.html#method-i-pluck',
			},
			{
				title: 'ActiveRecord find_in_batches',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Batches.html',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 2: Wide vs Narrow Fetching',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Click column headers and fire probes to explore the waste. The big_text_column header reveals why TEXT columns dominate memory.',
	},
};
