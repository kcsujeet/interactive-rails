/**
 * Act 3: Performance
 * "Making Rails Fast"
 *
 * Levels 16-21: N+1 Problem, Eager Loading, Query Optimization, Pagination, Caching, Background Jobs
 */

import type { Act, Level } from "@/components/game/types";

// ============================================
// Level 16: N+1 Problem
// ============================================

const level16N1Problem: Level = {
	id: 'act3-level16-n1-problem',
	actId: 3,
	levelNumber: 16,
	name: 'N+1 Problem',
	trigger: {
		type: 'performance_alert',
		description:
			'Page load is 5 seconds. Database shows 101 queries for 100 posts.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: '101 database queries for a page with 100 posts.',
		rootCause: 'N+1 query pattern: 1 query for posts + N queries for authors.',
		codeExample: `# BAD: N+1 queries
@posts = Post.all
# In view:
<% @posts.each do |post| %>
  <%= post.author.name %>  # +1 query each!
<% end %>`,
		goal: 'Identify and understand the N+1 query problem.',
		thresholds: { maxQueriesPerRequest: 5 },
	},
	successConditions: [{ type: 'n1_identified' }],
	availableNodes: [],
	unlockedNodes: ['eager_load'],
	learningContent: {
		title: 'The N+1 Query Problem',
		conceptExplanation: `N+1 occurs when you load N records and then make 1 additional query for each.

**Example:**
- 1 query: SELECT * FROM posts
- N queries: SELECT * FROM authors WHERE id = ? (for each post)

This scales linearly with data size - disaster!`,
		railsCodeExample: `# This code causes N+1:
@posts = Post.all

# In view - each iteration triggers a query:
@posts.each do |post|
  puts post.author.name
end

# Result: 1 + N queries
# 100 posts = 101 queries!`,
		commonMistakes: ['Not monitoring query counts', 'Ignoring in development'],
		whenToUse: 'Always check for N+1 when iterating over associations.',
		furtherReading: [
			{ title: 'Bullet Gem', url: 'https://github.com/flyerhzm/bullet' },
		],
	},
	hint: { delay: 20, text: 'Count the queries - one per post is too many!' },
};

// ============================================
// Level 17: Eager Loading
// ============================================

const level17EagerLoading: Level = {
	id: 'act3-level17-eager-loading',
	actId: 3,
	levelNumber: 17,
	name: 'Eager Loading',
	trigger: {
		type: 'optimization',
		description: 'Fix the N+1 problem with eager loading.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'N+1 identified, need to fix with eager loading.',
		rootCause: 'Associations not preloaded.',
		codeExample: `# Solution: Use includes
@posts = Post.includes(:author)

# Now only 2 queries:
# SELECT * FROM posts
# SELECT * FROM authors WHERE id IN (1, 2, 3...)`,
		goal: 'Apply the correct eager loading strategy for each scenario.',
		thresholds: { maxQueriesPerRequest: 3 },
	},
	successConditions: [{ type: 'eager_loading_applied' }],
	availableNodes: ['eager_load'],
	unlockedNodes: [],
	learningContent: {
		title: 'Eager Loading Strategies',
		conceptExplanation: `Rails provides three eager loading methods:

**includes** - Smart default, uses separate query or JOIN
**preload** - Always separate queries
**eager_load** - Always LEFT OUTER JOIN`,
		railsCodeExample: `# includes (recommended default)
Post.includes(:author)
# 2 queries: posts, then authors

# preload (force separate queries)
Post.preload(:author)
# Always 2 separate queries

# eager_load (force JOIN)
Post.eager_load(:author)
# 1 query with LEFT OUTER JOIN

# Nested associations
Post.includes(comments: :user)`,
		commonMistakes: [
			'Using eager_load when includes works',
			'Loading too much data',
		],
		whenToUse:
			'includes is usually right. eager_load when filtering on associations.',
		furtherReading: [
			{
				title: 'ActiveRecord Querying',
				url: 'https://guides.rubyonrails.org/active_record_querying.html#eager-loading-associations',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Use includes for most cases, eager_load when filtering.',
	},
};

// ============================================
// Level 18: Query Optimization
// ============================================

const level18QueryOptimization: Level = {
	id: 'act3-level18-query-optimization',
	actId: 3,
	levelNumber: 18,
	name: 'Query Optimization',
	trigger: {
		type: 'performance_alert',
		description: 'Database queries are slow even with eager loading.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Queries returning too much data. Missing indexes.',
		rootCause: 'Inefficient queries and missing database indexes.',
		codeExample: `# BAD: Loading full records when not needed
Post.all.map(&:title)  # Loads everything

# GOOD: Select only what you need
Post.pluck(:title)  # Only loads titles`,
		goal: 'Optimize queries with select, pluck, and proper indexes.',
		thresholds: {},
	},
	successConditions: [{ type: 'queries_optimized' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Query Optimization Techniques',
		conceptExplanation: `Optimize what you load and how you query.

**Loading less data:**
- select: Load specific columns (returns models)
- pluck: Get raw values (no model objects)

**Smarter queries:**
- exists?: Check if records exist (faster than count > 0)
- count: Count in database, not Ruby

**Indexes:**
- Add indexes for WHERE clauses
- Add indexes for foreign keys`,
		railsCodeExample: `# select - partial model (less memory)
Post.select(:id, :title).where(published: true)

# pluck - raw values (even less memory)
Post.where(published: true).pluck(:title)
# => ["Post 1", "Post 2"]

# exists? instead of count > 0
Post.where(author: user).exists?  # LIMIT 1, fast!

# count in database
Post.where(published: true).count  # SQL COUNT(*)

# Add index in migration
add_index :posts, :author_id
add_index :posts, [:published, :created_at]`,
		commonMistakes: [
			'SELECT * when you need one column',
			'Missing indexes on foreign keys',
			'Using .count when you need .exists?',
		],
		whenToUse: 'Always for large datasets or performance-critical paths.',
		furtherReading: [
			{
				title: 'Rails Performance',
				url: 'https://www.speedshop.co/2019/01/10/three-activerecord-mistakes.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Use pluck for values, add indexes for slow queries.',
	},
};

// ============================================
// Level 19: Pagination
// ============================================

const level19Pagination: Level = {
	id: 'act3-level19-pagination',
	actId: 3,
	levelNumber: 19,
	name: 'Pagination',
	trigger: {
		type: 'performance_alert',
		description: 'Loading 10,000 posts crashes the page. Time to paginate.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Loading all records into memory causes crashes.',
		rootCause: 'No pagination implemented.',
		codeExample: `# BAD: Load all records
@posts = Post.all  # 10,000 records in memory!

# GOOD: Paginate
@posts = Post.page(params[:page]).per(25)`,
		goal: 'Implement efficient pagination strategies.',
		thresholds: {},
	},
	successConditions: [{ type: 'pagination_implemented' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Pagination Strategies',
		conceptExplanation: `Three pagination approaches:

**Offset** - Simple, page numbers (bad for large data)
**Cursor** - Use ID for next/prev (good for infinite scroll)
**Keyset** - WHERE id > last_id (best performance)`,
		railsCodeExample: `# Offset pagination (Kaminari/Pagy)
Post.page(params[:page]).per(25)
# LIMIT 25 OFFSET 50

# Cursor pagination
Post.where('id > ?', params[:after]).limit(25)

# Keyset with ordering
Post.where('created_at < ?', params[:before])
    .order(created_at: :desc)
    .limit(25)

# Using Pagy (recommended)
@pagy, @posts = pagy(Post.all, items: 25)`,
		commonMistakes: [
			'Offset pagination on millions of rows',
			'Not using database for pagination',
		],
		whenToUse: 'Any list with more than ~50 items.',
		furtherReading: [{ title: 'Pagy', url: 'https://github.com/ddnexus/pagy' }],
	},
	hint: { delay: 20, text: 'Use cursor pagination for large datasets.' },
};

// ============================================
// Level 20: Caching
// ============================================

const level20Caching: Level = {
	id: 'act3-level20-caching',
	actId: 3,
	levelNumber: 20,
	name: 'Caching',
	trigger: {
		type: 'scaling',
		description: 'Database cannot handle the traffic. Add caching.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Same expensive queries run repeatedly.',
		rootCause: 'No caching layer in place.',
		codeExample: `# Without caching: DB hit every request
Post.popular  # Runs full query

# With caching: DB hit only on cache miss
Rails.cache.fetch('popular_posts', expires_in: 1.hour) do
  Post.popular.to_a
end`,
		goal: 'Enable at least 2 caching layers to reduce database load.',
		thresholds: {},
	},
	successConditions: [{ type: 'caching_configured' }],
	availableNodes: ['cache'],
	unlockedNodes: ['cache'],
	learningContent: {
		title: 'Rails Caching Strategies',
		conceptExplanation: `Multiple caching layers:

**HTTP Caching** - Browser/CDN level
**Fragment Caching** - Partial HTML
**Low-Level Caching** - Ruby objects
**Query Caching** - Automatic within request`,
		railsCodeExample: `# Fragment caching in views
<% cache @post do %>
  <%= render @post %>
<% end %>

# Low-level caching
Rails.cache.fetch("user_#{id}_stats", expires_in: 1.hour) do
  calculate_expensive_stats
end

# Russian doll caching
<% cache ['v1', @post] do %>
  <% @post.comments.each do |comment| %>
    <% cache comment do %>
      <%= render comment %>
    <% end %>
  <% end %>
<% end %>

# HTTP caching
expires_in 1.hour, public: true
stale?(@post)`,
		commonMistakes: ['Caching dynamic content', 'Not invalidating caches'],
		whenToUse: 'Expensive computations or frequently accessed data.',
		furtherReading: [
			{
				title: 'Rails Caching Guide',
				url: 'https://guides.rubyonrails.org/caching_with_rails.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Start with fragment caching, add Redis for low-level.',
	},
};

// ============================================
// Level 21: Background Jobs
// ============================================

const level21BackgroundJobs: Level = {
	id: 'act3-level21-background-jobs',
	actId: 3,
	levelNumber: 21,
	name: 'Background Jobs',
	trigger: {
		type: 'incident',
		description:
			'PDF generation blocks requests for 30 seconds. Users are frustrated.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Slow operations block the request cycle.',
		rootCause: 'Long-running tasks not moved to background.',
		codeExample: `# BAD: Blocking request
def create
  @report = Report.create(params)
  @report.generate_pdf  # Takes 30 seconds!
  redirect_to @report
end`,
		goal: 'Move slow operations to background jobs.',
		thresholds: {},
	},
	successConditions: [{ type: 'background_jobs_configured' }],
	availableNodes: ['background_job', 'redis'],
	unlockedNodes: ['background_job', 'redis'],
	learningContent: {
		title: 'Background Jobs with Sidekiq',
		conceptExplanation: `Move slow work out of the request cycle.

**Use for:**
- Email sending
- File processing
- API calls
- Report generation`,
		railsCodeExample: `# app/jobs/pdf_generation_job.rb
class PdfGenerationJob < ApplicationJob
  queue_as :default

  def perform(report_id)
    report = Report.find(report_id)
    report.generate_pdf
    ReportMailer.ready(report).deliver_later
  end
end

# In controller
def create
  @report = Report.create(params)
  PdfGenerationJob.perform_later(@report.id)
  redirect_to @report, notice: 'Generating PDF...'
end

# config/sidekiq.yml
:queues:
  - [critical, 3]
  - [default, 2]
  - [low, 1]`,
		commonMistakes: ['Passing ActiveRecord objects', 'Not handling failures'],
		whenToUse: 'Any operation that takes more than 100ms.',
		furtherReading: [{ title: 'Sidekiq', url: 'https://sidekiq.org/' }],
	},
	hint: {
		delay: 20,
		text: 'Use perform_later for async, pass IDs not objects.',
	},
};

// ============================================
// Act 3 Definition
// ============================================

export const actThree: Act = {
	id: 3,
	name: 'Performance',
	tagline: 'Making Rails Fast',
	description:
		'Master Rails performance: fix N+1 queries, implement caching, optimize database queries, and use background jobs.',
	levels: [
		level16N1Problem,
		level17EagerLoading,
		level18QueryOptimization,
		level19Pagination,
		level20Caching,
		level21BackgroundJobs,
	],
	unlockedNodes: ['eager_load', 'cache', 'background_job', 'redis'],
	metricsVisible: true,
};
