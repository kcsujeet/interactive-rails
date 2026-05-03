import type { Level } from '@/types';

export const level26Pagination: Level = {
	id: 'act4-level26-pagination',
	actId: 4,
	levelNumber: 26,
	name: 'Pagination',
	trigger: {
		type: 'performance_alert',
		description:
			'GET /api/products returns all 50,000 products at once. The response is 12MB of JSON. Mobile clients crash.',
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
			'The ProductList service returns `Product.includes(:user)` as the scope with no limit. The controller renders the entire scope, loading 50K ActiveRecord objects into memory and sending a 12MB JSON array. There is no way for clients to request a specific page.',
		rootCause:
			'No pagination. The service scope loads the entire table and the controller renders it all.',
		codeExample: `# app/services/product_list.rb
class ProductList < ApplicationService
  Result = Data.define(:success?, :scope, :errors)
  def call
    validation = ListContract.new.call(page: @page)
    return Result.new(...) if validation.failure?
    scope = Product.includes(:user)  # No limit!
    Result.new(success?: true, scope: scope, errors: [])
  end
end

# Controller renders ALL of result.scope:
# render json: ProductSerializer.new(result.scope)
#
# Problems:
# 1. Database loads 50K rows into memory
# 2. Ruby serializes 50K objects (12MB JSON)
# 3. No pagination headers, no way to request "page 2"`,
		goal: 'Add pagination to your API with configurable page sizes and RFC 5988 Link headers so clients can navigate large result sets efficiently.',
		thresholds: { maxLatency: 100 },
	},
	successConditions: [{ type: 'pagination_implemented' }],
	requiresTests: true,
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Pagination: Pagy, Cursor-Based & Link Headers',
		goal: `In this level, you'll:\n- learn how to paginate API responses so clients don't download thousands of records at once.\n- compare offset pagination (simple page numbers) with cursor-based pagination (consistent performance on deep pages).\n- return standard pagination links in HTTP headers following RFC 5988.`,
		conceptExplanation: `Three pagination strategies, each with trade-offs:

**Offset pagination** (page numbers):
- \`LIMIT 25 OFFSET 50\`: page 3 of 25 items
- Simple, supports "jump to page 10"
- Performance degrades on deep pages (OFFSET 100000 still scans 100K rows)
- Records can shift between pages if data changes (duplicates or missed items)

**Cursor-based pagination** (keyset):
- \`WHERE id > last_seen_id LIMIT 25\`
- Consistent performance regardless of page depth
- No "page 5", only "next" and "previous"
- Best for infinite scroll, real-time feeds

**Production benchmarks (1,000 sequential page requests):**
\`\`\`
Offset-based: GET /products?page=500
  SQL:      SELECT * FROM products LIMIT 25 OFFSET 12475
            (DB must skip over 12,475 rows before returning 25)
  Time:     Real 1.097s | User 391.5ms

Cursor-based: GET /products?cursor=eyJpZCI6MTI0NzZ9
  SQL:      SELECT * FROM products WHERE id > 12476 LIMIT 25
            (DB uses index to jump directly to id=12476)
  Time:     Real 0.327s | User 163.1ms → 2.4x faster
\`\`\`

**Why cursor-based is faster:** \`OFFSET 12475\` tells the DB "skip the first 12,475 rows"; it still reads and discards them. \`WHERE id > last_seen_id\` gives the DB engine extra context to traverse the B-tree index directly, with no wasted reads regardless of page depth.

**Why cursor-based is more stable:** With offset pagination, inserting a new product shifts every page by one, so users see duplicates or miss products. With cursor-based, cursors point to specific records, and new inserts don't invalidate existing cursors.

**The timestamp gotcha:** IDs are unique, but timestamps are NOT. A bulk import of 10,000 products with identical \`created_at\` means \`WHERE created_at > X\` can skip records with duplicate values. Fix: always add a secondary sort key on a unique column: \`ORDER BY created_at DESC, id DESC\`.

**API pagination with Link headers:**
- Follow RFC 5988: pagination info in response headers, not body
- \`Link: <url?page=2>; rel="next", <url?page=100>; rel="last"\`
- Keeps the JSON body clean

**Pagy** is the recommended gem:
- 40x faster than Kaminari, 70x faster than will_paginate
- Tiny memory footprint
- Supports offset, cursor, and keyset pagination
- Built-in Link header support for APIs`,
		railsCodeExample: `# Gemfile
gem 'pagy', '~> 43.3'

# config/initializers/pagy.rb
Pagy::OPTIONS[:limit] = 25

# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  include Pagy::Method
end

# Service object provides the scope:
class ProductList < ApplicationService
  Result = Data.define(:success?, :scope, :errors)
  def call
    validation = ListContract.new.call(page: @page)
    return Result.new(success?: false, ...) if validation.failure?
    scope = Product.includes(:user)
    Result.new(success?: true, scope: scope, errors: [])
  end
end

# Controller paginates the service scope:
class Api::ProductsController < ApplicationController
  def index
    result = ProductList.call(page: params[:page])
    if result.success?
      @pagy, @products = pagy(:offset, result.scope)
      response.headers.merge!(@pagy.headers_hash)
      render json: ProductSerializer.new(@products)
    else
      render json: { errors: result.errors },
             status: :unprocessable_entity
    end
  end
end`,
		commonMistakes: [
			'Using offset pagination for deep pages on large tables (OFFSET 100000 is slow)',
			'Not including pagination metadata in the response (Link headers or meta object)',
			'Returning total count on every request (COUNT(*) on large tables is expensive)',
			'Not combining pagination with eager loading (paginate first, then eager load)',
			'Using Kaminari or will_paginate instead of Pagy (significantly slower)',
		],
		whenToUse:
			'Every list endpoint that could return more than ~50 items. Use offset for admin UIs with page numbers. Use cursor-based for feeds, timelines, and infinite scroll.',
		furtherReading: [
			{
				title: 'Pagy Gem',
				url: 'https://github.com/ddnexus/pagy',
			},
			{
				title: 'rails_cursor_pagination (Cursor-Based)',
				url: 'https://github.com/xing/rails_cursor_pagination',
			},
			{
				title: 'RFC 5988 - Web Linking',
				url: 'https://tools.ietf.org/html/rfc5988',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 4: Cursor-Based Pagination',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Server-side pagination needs two things at the same time: a slice of the records for the current page, and metadata (current page, total count) the client uses to render "next / prev". The library you reach for here returns both in one call.',
	},
};
