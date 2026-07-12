import type { Level } from '@/types';

export const level27Search: Level = {
	id: 'act4-level27-search',
	actId: 4,
	levelNumber: 27,
	name: 'Search',
	trigger: {
		type: 'new_feature',
		description:
			"Discover why LIKE '%query%' is killing search performance, then build proper full-text search with ranking, stemming, and fast index lookups.",
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
				y: 400,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 660, y: 400, locked: true },
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
			"`GET /api/products?q=rails` uses `LIKE '%rails%'` which forces a sequential scan. 3 seconds for 50K products. No relevance ranking.",
		rootCause:
			'LIKE with a leading wildcard cannot use B-tree indexes. Full-text search requires a different approach.',
		codeExample: `# app/services/product_search.rb
class ProductSearch < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def call
    validation = SearchContract.new.call(query: @query)
    return Result.new(...) if validation.failure?

    products = Product.where(
      "name LIKE :q OR description LIKE :q",
      q: "%#{@query}%"
    )
    Result.new(success?: true, products: products, errors: [])
  end
end

# EXPLAIN for LIKE '%rails%':
# Seq Scan on products  (cost=0.00..1250.00 rows=500 width=256)
#   Filter: ((name ~~ '%rails%') OR (description ~~ '%rails%'))
#   Rows Removed by Filter: 49500
#   Execution Time: 3,200ms
#
# Problems:
# 1. Full table scan (no index can help with leading %)
# 2. No relevance ranking (exact match = partial match)
# 3. No stemming ("running" won't match "run")`,
		goal: 'Replace slow pattern-matching queries with proper full-text search that supports ranking, stemming, and weighted columns.',
		thresholds: { maxLatency: 50 },
	},
	successConditions: [{ type: 'search_configured' }],
	requiresTests: true,
	availableNodes: ['search'],
	unlockedNodes: ['search'],
	learningContent: {
		title: 'Full-Text Search: PostgreSQL tsvector & pg_search',
		goal: `In this level, you'll:\n- discover why LIKE '%query%' forces sequential scans and has no ranking or stemming.\n- set up proper full-text search with a dedicated search column and index.\n- configure search scopes with weighted columns for relevance ranking.\n- wire the controller to use the new search.\n- stress-test the solution with varied search queries.`,
		conceptExplanation: `Relying on LIKE '%query%' for search is a common mistake. It cannot use indexes, has no relevance ranking, and gets slower as data grows.

**PostgreSQL full-text search:**
- Built into the database, no external service needed
- Uses \`tsvector\` (document) and \`tsquery\` (search query)
- Supports stemming ("running" matches "run"), ranking, and phrase matching
- GIN indexes make searches fast even on millions of rows

**SQLite FTS5 (for SQLite databases):**
- SQLite's built-in full-text search engine
- Virtual table approach: create a separate FTS table
- Supports prefix queries, phrase matching, and boolean operators
- Rails 8 makes this viable for production

**pg_search gem (recommended for PostgreSQL):**
- Simple DSL for PostgreSQL full-text search
- Handles tsvector, trigrams, and multi-table search
- Integrates with ActiveRecord scopes

**When to graduate to Elasticsearch/Meilisearch:**
- Autocomplete / "search as you type"
- Faceted search (filter by category, price range)
- Fuzzy matching across millions of documents
- Multi-language support`,
		railsCodeExample: `# === PostgreSQL Full-Text Search ===

# Migration: add tsvector column with GIN index
class AddSearchToProduct < ActiveRecord::Migration[8.0]
  def change
    add_column :products, :searchable, :tsvector
    add_index :products, :searchable, using: :gin

    # Trigger to auto-update searchable column
    execute <<-SQL
      CREATE TRIGGER products_searchable_update
      BEFORE INSERT OR UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION
        tsvector_update_trigger(searchable, 'pg_catalog.english', name, description);
    SQL

    # Backfill existing records
    execute <<-SQL
      UPDATE products SET searchable =
        to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''));
    SQL
  end
end

# app/models/product.rb (manual approach)
class Product < ApplicationRecord
  scope :search, ->(query) {
    sanitized = connection.quote(query)
    where("searchable @@ plainto_tsquery('english', ?)", query)
      .order(Arel.sql("ts_rank(searchable, plainto_tsquery('english', #{sanitized})) DESC"))
  }
end

# === Using pg_search gem (recommended) ===
# Gemfile
gem 'pg_search'

# app/models/product.rb
class Product < ApplicationRecord
  include PgSearch::Model

  pg_search_scope :search,
    against: { name: 'A', description: 'B' },  # A = highest weight
    using: {
      tsearch: { prefix: true, dictionary: 'english' },
      trigram: { threshold: 0.3 }  # fuzzy matching
    }
end

# Service object:
class ProductSearch < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def call
    validation = SearchContract.new.call(query: @query)
    return Result.new(success?: false, products: [], errors: validation.errors.to_h) if validation.failure?

    products = Product.search(@query)
    Result.new(success?: true, products: products, errors: [])
  end
end

# === SQLite FTS5 (for SQLite databases) ===
class CreateProductsSearchIndex < ActiveRecord::Migration[8.0]
  def up
    execute <<-SQL
      CREATE VIRTUAL TABLE products_fts USING fts5(name, description, content=products, content_rowid=id);
      INSERT INTO products_fts(rowid, name, description) SELECT id, name, description FROM products;
    SQL
  end
end

# Query FTS5:
Product.where(id: Product.connection.select_values(
  "SELECT rowid FROM products_fts WHERE products_fts MATCH ?", query
))`,
		commonMistakes: [
			"Using LIKE '%query%' for search (cannot use indexes, no ranking)",
			'Not adding GIN indexes on tsvector columns (search will be slow)',
			'Forgetting to backfill the search column for existing records',
			'Not weighting title higher than body in search results',
			'Building search without pagination (returning all matches)',
		],
		whenToUse:
			'PostgreSQL full-text search handles most search needs. Graduate to Elasticsearch/Meilisearch when you need autocomplete, facets, or fuzzy matching across millions of documents.\n\n**Before (LIKE):** 50K rows: ~3,200ms (sequential scan), no ranking, no stemming.\n**After (tsvector + GIN):** 50K rows: ~2ms (GIN index scan), ranked results, English stemming.\n**Improvement: 1,600x faster search on 50K rows.**',
		furtherReading: [
			{
				title: 'pg_search Gem',
				url: 'https://github.com/Casecommons/pg_search',
			},
			{
				title: 'PostgreSQL Full-Text Search',
				url: 'https://www.postgresql.org/docs/current/textsearch.html',
			},
			{
				title: 'SQLite FTS5',
				url: 'https://www.sqlite.org/fts5.html',
			},
			{
				title: 'Rails Scales! (Full-Text Search chapter)',
				url: 'https://railsscales.com',
			},
		],
		homework: [
			{
				task: 'Measure the LIKE baseline against your 50K seeded products: EXPLAIN a leading-wildcard search.',
				commands: [
					'bin/rails console',
					'Product.where("name LIKE :q OR description LIKE :q", q: "%seed%").explain',
				],
				verify:
					'The plan is a Seq Scan: a leading % wildcard cannot use a B-tree index, so every row is read and there is no relevance ranking.',
			},
			{
				task: "Install pg_search and add a search scope on Product weighting name ('A') above description ('B'), using tsearch with prefix: true and the english dictionary.",
				commands: ['bundle add pg_search'],
				verify:
					'Product.search("seed") returns matches with name hits ranked above description hits, and a stemmed query like "chairs" still finds products named "chair".',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Fire the search probes and inspect the controller code to discover why LIKE queries are slow. You need all 4 discoveries to unlock the build phase.',
	},
};
