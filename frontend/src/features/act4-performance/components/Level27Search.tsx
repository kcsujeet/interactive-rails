/**
 * Level 27: Search
 *
 * Teaches full-text search vs LIKE queries in PostgreSQL.
 * Player compares LIKE pattern matching with tsvector + GIN index search.
 * Teaches: tsvector, tsquery, GIN indexes, pg_search gem
 */

import {
	ArrowRight,
	Database,
	Filter,
	Search,
	Star,
	Timer,
	TrendingDown,
	Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

interface Post {
	id: number;
	title: string;
	body: string;
}

interface SearchResult {
	id: number;
	title: string;
	body: string;
	score?: number;
	highlighted?: boolean;
}

interface QueryPlan {
	type: 'seq_scan' | 'gin_index_scan';
	time: number;
}

type SearchMode = 'like' | 'fulltext';

const POSTS: Post[] = [
	{
		id: 1,
		title: 'Getting Started with Ruby on Rails',
		body: 'Rails is a powerful framework for building web applications...',
	},
	{
		id: 2,
		title: 'Running Tests in RSpec',
		body: 'Testing is essential for production apps. Run your tests...',
	},
	{
		id: 3,
		title: 'Database Optimization Tips',
		body: 'Optimize your database queries for better performance...',
	},
	{
		id: 4,
		title: 'Ruby Metaprogramming Guide',
		body: 'Learn about define_method, method_missing, and more...',
	},
	{
		id: 5,
		title: 'API Design Best Practices',
		body: 'Build RESTful APIs that developers love to use...',
	},
];

// Stemming map: maps stems to words that should match
const STEM_MAP: Record<string, string[]> = {
	run: ['run', 'running', 'runs', 'runner'],
	test: ['test', 'testing', 'tests', 'tested'],
	build: ['build', 'building', 'builds', 'built'],
	optim: ['optimize', 'optimization', 'optimizing', 'optimized'],
	learn: ['learn', 'learning', 'learns', 'learned'],
	start: ['start', 'started', 'starting', 'starts', 'getting'],
	app: ['app', 'apps', 'application', 'applications'],
	develop: ['develop', 'developer', 'developers', 'developing'],
	perform: ['perform', 'performance', 'performing'],
	query: ['query', 'queries', 'querying'],
	power: ['power', 'powerful', 'powers'],
	product: ['product', 'production', 'productive'],
	practic: ['practice', 'practices', 'practical'],
	design: ['design', 'designing', 'designs'],
	framework: ['framework', 'frameworks'],
	databas: ['database', 'databases'],
};

function getStem(word: string): string | null {
	const lower = word.toLowerCase();
	for (const [stem, words] of Object.entries(STEM_MAP)) {
		if (words.includes(lower)) {
			return stem;
		}
	}
	return null;
}

function matchesFullText(text: string, query: string): boolean {
	const textLower = text.toLowerCase();
	const queryWords = query
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 0);

	return queryWords.some((queryWord) => {
		const stem = getStem(queryWord);
		if (stem) {
			const stemWords = STEM_MAP[stem] || [];
			return stemWords.some((sw) => textLower.includes(sw));
		}
		return textLower.includes(queryWord);
	});
}

function matchesLike(text: string, query: string): boolean {
	return text.toLowerCase().includes(query.toLowerCase());
}

function computeRelevanceScore(post: Post, query: string): number {
	let score = 0;
	const queryWords = query
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 0);

	for (const word of queryWords) {
		const stem = getStem(word);
		const wordsToCheck = stem ? STEM_MAP[stem] || [word] : [word];

		for (const w of wordsToCheck) {
			// Title matches are worth more
			if (post.title.toLowerCase().includes(w)) score += 3;
			if (post.body.toLowerCase().includes(w)) score += 1;
		}
	}

	return Math.round(score * 10) / 10;
}

export function Level27Search({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [searchQuery, setSearchQuery] = useState('');
	const [searchMode, setSearchMode] = useState<SearchMode>('like');
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [queryPlan, setQueryPlan] = useState<QueryPlan | null>(null);
	const [ginIndexAdded, setGinIndexAdded] = useState(false);
	const [hasSearchedLike, setHasSearchedLike] = useState(false);
	const [hasSearchedFullText, setHasSearchedFullText] = useState(false);

	const performSearch = (query: string, mode: SearchMode) => {
		if (!query.trim()) {
			setSearchResults([]);
			setQueryPlan(null);
			return;
		}

		if (mode === 'like') {
			setHasSearchedLike(true);
			const results: SearchResult[] = POSTS.filter(
				(post) =>
					matchesLike(post.title, query) || matchesLike(post.body, query),
			).map((post) => ({
				id: post.id,
				title: post.title,
				body: post.body,
			}));

			setSearchResults(results);
			setQueryPlan({ type: 'seq_scan', time: 3200 });
		} else {
			setHasSearchedFullText(true);
			const results: SearchResult[] = POSTS.filter(
				(post) =>
					matchesFullText(post.title, query) ||
					matchesFullText(post.body, query),
			)
				.map((post) => ({
					id: post.id,
					title: post.title,
					body: post.body,
					score: computeRelevanceScore(post, query),
					highlighted: true,
				}))
				.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

			setSearchResults(results);
			setQueryPlan({
				type: ginIndexAdded ? 'gin_index_scan' : 'seq_scan',
				time: ginIndexAdded ? 2 : 800,
			});
		}
	};

	const handleSearchInput = (value: string) => {
		setSearchQuery(value);
		performSearch(value, searchMode);
	};

	const handleModeSwitch = (mode: SearchMode) => {
		setSearchMode(mode);
		performSearch(searchQuery, mode);
	};

	const handleAddGinIndex = () => {
		setGinIndexAdded(true);
		if (searchQuery.trim() && searchMode === 'fulltext') {
			performSearch(searchQuery, 'fulltext');
		}
	};

	// Re-run search after GIN index added (need fresh queryPlan)
	const handleAddGinAndReSearch = () => {
		handleAddGinIndex();
		// Force re-evaluation with gin
		if (searchQuery.trim() && searchMode === 'fulltext') {
			setSearchResults((prev) => [...prev]);
			setQueryPlan({ type: 'gin_index_scan', time: 2 });
		}
	};

	const validateSolution = (): ValidationResult => {
		const issues: string[] = [];

		if (!hasSearchedLike) {
			issues.push('Try a search using LIKE mode first');
		}
		if (!hasSearchedFullText) {
			issues.push('Try a search using full-text mode');
		}
		if (!ginIndexAdded) {
			issues.push('Add a GIN index in full-text mode');
		}

		if (issues.length > 0) {
			return {
				valid: false,
				message: 'Complete all search tasks to proceed!',
				details: issues,
			};
		}

		return {
			valid: true,
			message: 'Full-text search with GIN index implemented!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act4-level27-search', { stars: 3 });
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const handleReset = () => {
		setSearchQuery('');
		setSearchMode('like');
		setSearchResults([]);
		setQueryPlan(null);
		setGinIndexAdded(false);
		setHasSearchedLike(false);
		setHasSearchedFullText(false);
	};

	const likeQueryDisplay = searchQuery.trim()
		? `WHERE title LIKE '%${searchQuery}%' OR body LIKE '%${searchQuery}%'`
		: "WHERE title LIKE '%...%' OR body LIKE '%...%'";

	const fullTextQueryDisplay = searchQuery.trim()
		? `WHERE searchable @@ plainto_tsquery('english', '${searchQuery}')`
		: "WHERE searchable @@ plainto_tsquery('english', '...')";

	const getModelCode = (): string => {
		if (searchMode === 'like') {
			return `class Post < ApplicationRecord
  # LIKE-based search (slow!)
  scope :search, ->(query) {
    where(
      "title LIKE :q OR body LIKE :q",
      q: "%#{query}%"
    )
  }
end

# Usage in controller:
# @posts = Post.search(params[:q])
#
# Problems:
# - Cannot use indexes (always Seq Scan)
# - No relevance ranking
# - No stemming ("run" != "running")
# - Case-sensitive by default`;
		}

		if (ginIndexAdded) {
			return `class Post < ApplicationRecord
  include PgSearch::Model

  pg_search_scope :search,
    against: { title: 'A', body: 'B' },
    using: {
      tsearch: {
        dictionary: 'english',
        tsvector_column: 'searchable'
      }
    }
end

# Results are ranked by relevance
# Stemming: "run" matches "running"
# GIN index: 2ms instead of 3,200ms`;
		}

		return `class Post < ApplicationRecord
  include PgSearch::Model

  pg_search_scope :search,
    against: { title: 'A', body: 'B' },
    using: {
      tsearch: {
        dictionary: 'english'
      }
    }
end

# Without GIN index: still uses Seq Scan
# Add index for fast lookups!`;
	};

	const getMigrationCode = (): string => {
		if (searchMode === 'like') {
			return `# No special migration needed for LIKE
# But also no way to optimize it!
#
# LIKE '%query%' forces a sequential scan
# every single time, on every single row.
#
# On 50,000 posts: ~3,200ms per search
# On 500,000 posts: ~32,000ms per search`;
		}

		if (ginIndexAdded) {
			return `class AddSearchToPost < ActiveRecord::Migration[7.1]
  def change
    # Add tsvector column
    add_column :posts, :searchable, :tsvector

    # Add GIN index for fast lookups
    add_index :posts, :searchable,
              using: :gin

    # Auto-update tsvector on changes
    execute <<-SQL
      CREATE TRIGGER posts_search_update
      BEFORE INSERT OR UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION
        tsvector_update_trigger(
          searchable, 'pg_catalog.english',
          title, body
        );
    SQL
  end
end`;
		}

		return `class AddSearchToPost < ActiveRecord::Migration[7.1]
  def change
    # Add tsvector column
    add_column :posts, :searchable, :tsvector

    # TODO: Add GIN index!
    # Without it, full-text still does Seq Scan
    #
    # add_index :posts, :searchable,
    #           using: :gin
  end
end`;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Replace slow LIKE queries with proper full-text search using PostgreSQL tsvector and GIN indexes."
					instructions={[
						'Try a LIKE search and see the slow Seq Scan',
						'Switch to full-text search mode',
						'Add a GIN index for fast lookups',
						'Compare: ranking, stemming, speed',
					]}
					scenario="Users want to search posts by keyword. LIKE '%query%' takes 3 seconds on 50K posts, has no ranking, and can't use indexes."
				>
					{/* Mode Toggle */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Search Mode
						</div>
						<div className="grid grid-cols-2 gap-2">
							<Button
								className={`text-sm py-2 ${
									searchMode === 'like'
										? 'bg-destructive/20 border-destructive text-destructive'
										: 'bg-secondary border-border text-muted-foreground'
								}`}
								onClick={() => handleModeSwitch('like')}
								variant={searchMode === 'like' ? 'default' : 'outline'}
							>
								<TrendingDown className="w-3.5 h-3.5 mr-1.5" />
								LIKE
							</Button>
							<Button
								className={`text-sm py-2 ${
									searchMode === 'fulltext'
										? 'bg-success/20 border-success text-success'
										: 'bg-secondary border-border text-muted-foreground'
								}`}
								onClick={() => handleModeSwitch('fulltext')}
								variant={searchMode === 'fulltext' ? 'default' : 'outline'}
							>
								<Zap className="w-3.5 h-3.5 mr-1.5" />
								Full-Text
							</Button>
						</div>
					</div>

					{/* GIN Index Button */}
					{searchMode === 'fulltext' && !ginIndexAdded && (
						<div className="p-4 border-t border-border">
							<Button
								className="w-full py-2 bg-primary/20 border-primary text-primary hover:bg-primary/30"
								onClick={handleAddGinAndReSearch}
								variant="outline"
							>
								<Database className="w-4 h-4 mr-2" />
								Add GIN Index
							</Button>
							<p className="text-xs text-muted-foreground mt-2">
								Create a Generalized Inverted Index for fast full-text lookups
							</p>
						</div>
					)}

					{searchMode === 'fulltext' && ginIndexAdded && (
						<div className="p-4 border-t border-border">
							<div className="flex items-center gap-2 text-success text-sm">
								<Database className="w-4 h-4" />
								GIN Index Active
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								Inverted index enables sub-millisecond lookups on tsvector
								columns
							</p>
						</div>
					)}

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Progress
						</div>
						<div className="space-y-2 text-xs">
							<div className="flex items-center gap-2">
								<div
									className={`w-4 h-4 rounded-full flex items-center justify-center ${hasSearchedLike ? 'bg-success text-white' : 'bg-secondary text-muted-foreground'}`}
								>
									{hasSearchedLike ? (
										<span className="text-[10px]">1</span>
									) : (
										<span className="text-[10px]">1</span>
									)}
								</div>
								<span
									className={
										hasSearchedLike ? 'text-success' : 'text-muted-foreground'
									}
								>
									Tried LIKE search
								</span>
							</div>
							<div className="flex items-center gap-2">
								<div
									className={`w-4 h-4 rounded-full flex items-center justify-center ${hasSearchedFullText ? 'bg-success text-white' : 'bg-secondary text-muted-foreground'}`}
								>
									<span className="text-[10px]">2</span>
								</div>
								<span
									className={
										hasSearchedFullText
											? 'text-success'
											: 'text-muted-foreground'
									}
								>
									Tried full-text search
								</span>
							</div>
							<div className="flex items-center gap-2">
								<div
									className={`w-4 h-4 rounded-full flex items-center justify-center ${ginIndexAdded ? 'bg-success text-white' : 'bg-secondary text-muted-foreground'}`}
								>
									<span className="text-[10px]">3</span>
								</div>
								<span
									className={
										ginIndexAdded ? 'text-success' : 'text-muted-foreground'
									}
								>
									Added GIN index
								</span>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Search"
					levelNumber={27}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto space-y-4">
						{/* Search Input */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="p-4">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
									<input
										className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
										onChange={(e) => handleSearchInput(e.target.value)}
										placeholder='Try searching "rails", "run", "database"...'
										type="text"
										value={searchQuery}
									/>
								</div>
								<div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
									<Filter className="w-3.5 h-3.5" />
									<span>
										Searching {POSTS.length} posts (simulating 50K rows)
									</span>
								</div>
							</div>
						</div>

						{/* SQL Query Display */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-2.5 border-b border-border flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground flex items-center gap-2">
									<Database className="w-4 h-4 text-primary" />
									Generated SQL
								</div>
								<span
									className={`text-xs px-2 py-0.5 rounded-full ${
										searchMode === 'like'
											? 'bg-destructive/20 text-destructive'
											: 'bg-success/20 text-success'
									}`}
								>
									{searchMode === 'like' ? 'LIKE Query' : 'Full-Text Query'}
								</span>
							</div>
							<div className="p-4">
								<pre className="text-sm font-mono text-muted-foreground bg-secondary/50 rounded-lg p-3 overflow-x-auto">
									{searchMode === 'like'
										? likeQueryDisplay
										: fullTextQueryDisplay}
								</pre>
							</div>
						</div>

						{/* EXPLAIN / Query Plan */}
						{queryPlan && (
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-secondary px-4 py-2.5 border-b border-border">
									<div className="text-sm font-semibold text-foreground flex items-center gap-2">
										<Timer className="w-4 h-4 text-primary" />
										EXPLAIN ANALYZE
									</div>
								</div>
								<div className="p-4">
									<div
										className={`flex items-center justify-between p-3 rounded-lg border ${
											queryPlan.type === 'gin_index_scan'
												? 'bg-success/10 border-success/30'
												: queryPlan.time <= 800
													? 'bg-warning/10 border-warning/30'
													: 'bg-destructive/10 border-destructive/30'
										}`}
									>
										<div className="flex items-center gap-3">
											<div
												className={`w-8 h-8 rounded-full flex items-center justify-center ${
													queryPlan.type === 'gin_index_scan'
														? 'bg-success/20'
														: queryPlan.time <= 800
															? 'bg-warning/20'
															: 'bg-destructive/20'
												}`}
											>
												{queryPlan.type === 'gin_index_scan' ? (
													<Zap className="w-4 h-4 text-success" />
												) : (
													<TrendingDown className="w-4 h-4 text-destructive" />
												)}
											</div>
											<div>
												<div
													className={`text-sm font-semibold ${
														queryPlan.type === 'gin_index_scan'
															? 'text-success'
															: queryPlan.time <= 800
																? 'text-warning'
																: 'text-destructive'
													}`}
												>
													{queryPlan.type === 'gin_index_scan'
														? 'Bitmap Heap Scan (GIN Index Scan)'
														: 'Seq Scan on posts'}
												</div>
												<div className="text-xs text-muted-foreground">
													{queryPlan.type === 'gin_index_scan'
														? 'Using GIN index on searchable column'
														: 'Full table scan - checking every row'}
												</div>
											</div>
										</div>
										<div
											className={`text-lg font-bold ${
												queryPlan.type === 'gin_index_scan'
													? 'text-success'
													: queryPlan.time <= 800
														? 'text-warning'
														: 'text-destructive'
											}`}
										>
											{queryPlan.time.toLocaleString()}ms
										</div>
									</div>

									{/* Comparison bar */}
									<div className="mt-4 space-y-2">
										<div className="flex items-center gap-3 text-xs">
											<span className="w-24 text-muted-foreground">
												LIKE query
											</span>
											<div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
												<div
													className="h-full bg-destructive rounded-full"
													style={{ width: '100%' }}
												/>
											</div>
											<span className="text-destructive font-mono w-16 text-right">
												3,200ms
											</span>
										</div>
										<div className="flex items-center gap-3 text-xs">
											<span className="w-24 text-muted-foreground">
												FTS (no idx)
											</span>
											<div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
												<div
													className="h-full bg-warning rounded-full"
													style={{ width: '25%' }}
												/>
											</div>
											<span className="text-warning font-mono w-16 text-right">
												800ms
											</span>
										</div>
										<div className="flex items-center gap-3 text-xs">
											<span className="w-24 text-muted-foreground">
												FTS + GIN
											</span>
											<div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
												<div
													className="h-full bg-success rounded-full"
													style={{ width: '0.5%', minWidth: '4px' }}
												/>
											</div>
											<span className="text-success font-mono w-16 text-right">
												2ms
											</span>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Search Results */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-2.5 border-b border-border flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground flex items-center gap-2">
									<Search className="w-4 h-4 text-primary" />
									Results ({searchResults.length})
								</div>
								{searchMode === 'fulltext' && searchResults.length > 0 && (
									<span className="text-xs text-success flex items-center gap-1">
										<Star className="w-3 h-3" />
										Ranked by relevance
									</span>
								)}
							</div>

							<div className="divide-y divide-border">
								{searchResults.length === 0 && searchQuery.trim() ? (
									<div className="p-6 text-center text-muted-foreground text-sm">
										No results found for &quot;{searchQuery}&quot;
										{searchMode === 'like' && (
											<div className="mt-2 text-xs">
												LIKE is case-sensitive by default. Try switching to
												full-text search for stemming support.
											</div>
										)}
									</div>
								) : searchResults.length === 0 ? (
									<div className="p-6 text-center text-muted-foreground text-sm">
										Type a search query above to see results
									</div>
								) : (
									searchResults.map((result) => (
										<div
											className="p-4 hover:bg-secondary/30 transition-colors"
											key={result.id}
										>
											<div className="flex items-start justify-between">
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<h4 className="text-sm font-semibold text-foreground truncate">
															{result.title}
														</h4>
														{result.highlighted && (
															<Zap className="w-3.5 h-3.5 text-success shrink-0" />
														)}
													</div>
													<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
														{result.body}
													</p>
												</div>
												{result.score !== undefined && (
													<div className="ml-4 shrink-0 text-right">
														<div className="text-xs text-muted-foreground">
															Score
														</div>
														<div className="text-sm font-bold text-success">
															{result.score}
														</div>
													</div>
												)}
											</div>
										</div>
									))
								)}
							</div>

							{/* Mode-specific notes */}
							{searchQuery.trim() && (
								<div className="px-4 py-3 bg-secondary/30 border-t border-border">
									{searchMode === 'like' ? (
										<div className="text-xs text-muted-foreground space-y-1">
											<div className="flex items-center gap-1.5 text-destructive">
												<TrendingDown className="w-3 h-3" />
												<span className="font-semibold">LIKE Limitations:</span>
											</div>
											<ul className="ml-5 space-y-0.5">
												<li>
													<ArrowRight className="w-3 h-3 inline mr-1" />
													No relevance ranking - results are unordered
												</li>
												<li>
													<ArrowRight className="w-3 h-3 inline mr-1" />
													No stemming - &quot;run&quot; won&apos;t match
													&quot;running&quot;
												</li>
												<li>
													<ArrowRight className="w-3 h-3 inline mr-1" />
													Cannot use indexes - always sequential scan
												</li>
												<li>
													<ArrowRight className="w-3 h-3 inline mr-1" />
													Case-sensitive matching by default
												</li>
											</ul>
										</div>
									) : (
										<div className="text-xs text-muted-foreground space-y-1">
											<div className="flex items-center gap-1.5 text-success">
												<Zap className="w-3 h-3" />
												<span className="font-semibold">
													Full-Text Benefits:
												</span>
											</div>
											<ul className="ml-5 space-y-0.5">
												<li>
													<ArrowRight className="w-3 h-3 inline mr-1" />
													Ranked results by relevance score
												</li>
												<li>
													<ArrowRight className="w-3 h-3 inline mr-1" />
													Stemming - &quot;run&quot; matches
													&quot;running&quot;, &quot;runs&quot;
												</li>
												<li>
													<ArrowRight className="w-3 h-3 inline mr-1" />
													{ginIndexAdded
														? 'GIN index enables sub-millisecond lookups'
														: 'Add GIN index for fast index scans'}
												</li>
												<li>
													<ArrowRight className="w-3 h-3 inline mr-1" />
													Language-aware (English dictionary)
												</li>
											</ul>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/models/post.rb',
							language: 'ruby',
							code: getModelCode(),
							highlight:
								searchMode === 'fulltext'
									? ginIndexAdded
										? [4, 5, 6, 7, 8, 9, 10, 11]
										: [4, 5, 6]
									: [3, 4, 5, 6, 7],
						},
						{
							filename: 'db/migrate/add_search.rb',
							language: 'ruby',
							code: getMigrationCode(),
							highlight: ginIndexAdded ? [5, 6, 7] : [],
						},
					]}
					learningGoal="LIKE '%query%' cannot use indexes and has no ranking. PostgreSQL full-text search with tsvector + GIN index gives you fast, ranked, stemmed search results."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<div className="space-y-3 text-xs">
							<div>
								<div className="text-foreground font-semibold flex items-center gap-1.5">
									<Database className="w-3 h-3 text-primary" />
									tsvector
								</div>
								<p className="text-muted-foreground mt-0.5">
									Document representation optimized for search. Stores
									normalized lexemes with position info.
								</p>
							</div>
							<div>
								<div className="text-foreground font-semibold flex items-center gap-1.5">
									<Search className="w-3 h-3 text-primary" />
									tsquery
								</div>
								<p className="text-muted-foreground mt-0.5">
									Search query representation. Supports AND, OR, NOT operators
									and prefix matching.
								</p>
							</div>
							<div>
								<div className="text-foreground font-semibold flex items-center gap-1.5">
									<Zap className="w-3 h-3 text-primary" />
									GIN Index
								</div>
								<p className="text-muted-foreground mt-0.5">
									Generalized Inverted Index. Maps each lexeme to the rows
									containing it for O(1) lookups.
								</p>
							</div>
							<div>
								<div className="text-foreground font-semibold flex items-center gap-1.5">
									<Star className="w-3 h-3 text-primary" />
									pg_search
								</div>
								<p className="text-muted-foreground mt-0.5">
									Ruby gem providing clean ActiveRecord integration for
									PostgreSQL full-text search.
								</p>
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Performance Comparison
						</div>
						<div className="text-xs space-y-2">
							<div className="flex justify-between text-muted-foreground">
								<span>LIKE on 50K rows</span>
								<span className="text-destructive font-mono">~3,200ms</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span>FTS without index</span>
								<span className="text-warning font-mono">~800ms</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span>FTS with GIN index</span>
								<span className="text-success font-mono">~2ms</span>
							</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level27Search;
