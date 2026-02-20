/**
 * Level 24: Database Indexing
 *
 * EXPLAIN plan visualizer that teaches database indexing.
 * Player adds indexes to eliminate sequential scans and speed up queries.
 */

import {
	ArrowDown,
	Database,
	Key,
	Search,
	Table2,
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

// --- Types ---

type IndexType = 'btree' | 'unique' | 'composite' | 'partial';
type ScanType = 'seq_scan' | 'index_scan';

interface IndexOption {
	id: string;
	column: string;
	type: IndexType;
	added: boolean;
	label: string;
	description: string;
	indexName: string;
	migrationCode: string;
}

interface QueryConfig {
	id: number;
	title: string;
	code: string;
	table: string;
	columns: string[];
	totalRows: number;
	baseTime: number;
	optimizedTime: number;
	matchingIndexId: string;
	explainBefore: string;
	explainAfter: string;
	indexName: string;
}

// --- Initial Data ---

const INITIAL_INDEXES: IndexOption[] = [
	{
		id: 'unique-email',
		column: 'users.email',
		type: 'unique',
		added: false,
		label: 'Unique index on users.email',
		description: 'Enforces uniqueness and enables fast lookups by email',
		indexName: 'index_users_on_email',
		migrationCode:
			'add_index :users, :email, unique: true, algorithm: :concurrently',
	},
	{
		id: 'btree-user-id',
		column: 'posts.user_id',
		type: 'btree',
		added: false,
		label: 'B-tree index on posts.user_id',
		description: 'Speeds up foreign key lookups for user posts',
		indexName: 'index_posts_on_user_id',
		migrationCode: 'add_index :posts, :user_id, algorithm: :concurrently',
	},
	{
		id: 'composite-published-created',
		column: 'posts.[published, created_at]',
		type: 'composite',
		added: false,
		label: 'Composite index on posts.[published, created_at]',
		description: 'Covers both the WHERE filter and ORDER BY in one index',
		indexName: 'index_posts_on_published_and_created_at',
		migrationCode:
			'add_index :posts, [:published, :created_at], algorithm: :concurrently',
	},
	{
		id: 'partial-created-at',
		column: 'posts.created_at',
		type: 'partial',
		added: false,
		label: 'Partial index on posts.created_at WHERE published',
		description: 'Only indexes published posts, smaller and faster',
		indexName: 'index_posts_on_created_at_where_published',
		migrationCode:
			'add_index :posts, :created_at, where: "published = true", algorithm: :concurrently',
	},
];

const QUERIES: QueryConfig[] = [
	{
		id: 0,
		title: 'Find user by email',
		code: 'User.find_by(email: "alice@example.com")',
		table: 'users',
		columns: ['id', 'email', 'name', 'created_at'],
		totalRows: 10000,
		baseTime: 820,
		optimizedTime: 0.05,
		matchingIndexId: 'unique-email',
		explainBefore: `Seq Scan on users  (cost=0.00..245.00 rows=1 width=72)
  Filter: ((email)::text = 'alice@example.com'::text)
  Rows Removed by Filter: 9999
  Planning Time: 0.08 ms
  Execution Time: 820.00 ms`,
		explainAfter: `Index Scan using index_users_on_email on users  (cost=0.29..8.31 rows=1 width=72)
  Index Cond: ((email)::text = 'alice@example.com'::text)
  Planning Time: 0.07 ms
  Execution Time: 0.05 ms`,
		indexName: 'index_users_on_email',
	},
	{
		id: 1,
		title: 'Load user posts',
		code: 'Post.where(user_id: user.id)',
		table: 'posts',
		columns: ['id', 'user_id', 'title', 'body', 'published', 'created_at'],
		totalRows: 50000,
		baseTime: 450,
		optimizedTime: 0.1,
		matchingIndexId: 'btree-user-id',
		explainBefore: `Seq Scan on posts  (cost=0.00..1125.00 rows=25 width=128)
  Filter: (user_id = 42)
  Rows Removed by Filter: 49975
  Planning Time: 0.09 ms
  Execution Time: 450.00 ms`,
		explainAfter: `Index Scan using index_posts_on_user_id on posts  (cost=0.29..12.45 rows=25 width=128)
  Index Cond: (user_id = 42)
  Planning Time: 0.06 ms
  Execution Time: 0.10 ms`,
		indexName: 'index_posts_on_user_id',
	},
	{
		id: 2,
		title: 'Published posts sorted',
		code: 'Post.where(published: true).order(:created_at)',
		table: 'posts',
		columns: ['id', 'user_id', 'title', 'body', 'published', 'created_at'],
		totalRows: 50000,
		baseTime: 650,
		optimizedTime: 0.2,
		matchingIndexId: 'composite-published-created',
		explainBefore: `Sort  (cost=1850.00..1862.50 rows=25000 width=128)
  Sort Key: created_at
  ->  Seq Scan on posts  (cost=0.00..1125.00 rows=25000 width=128)
        Filter: (published = true)
        Rows Removed by Filter: 25000
  Planning Time: 0.10 ms
  Execution Time: 650.00 ms`,
		explainAfter: `Index Scan using index_posts_on_published_and_created_at on posts  (cost=0.29..650.00 rows=25000 width=128)
  Index Cond: (published = true)
  Planning Time: 0.08 ms
  Execution Time: 0.20 ms`,
		indexName: 'index_posts_on_published_and_created_at',
	},
];

// --- Helper Functions ---

function getIndexTypeColor(type: IndexType): string {
	switch (type) {
		case 'unique':
			return 'text-purple-400';
		case 'btree':
			return 'text-primary';
		case 'composite':
			return 'text-warning';
		case 'partial':
			return 'text-muted-foreground';
	}
}

function getIndexTypeBadgeClass(type: IndexType): string {
	switch (type) {
		case 'unique':
			return 'bg-purple-400/20 text-purple-400 border-purple-400/30';
		case 'btree':
			return 'bg-primary/20 text-primary border-primary/30';
		case 'composite':
			return 'bg-warning/20 text-warning border-warning/30';
		case 'partial':
			return 'bg-muted/40 text-muted-foreground border-border';
	}
}

function getScanTypeForQuery(
	query: QueryConfig,
	indexes: IndexOption[],
): ScanType {
	const matchingIndex = indexes.find((idx) => idx.id === query.matchingIndexId);
	return matchingIndex?.added ? 'index_scan' : 'seq_scan';
}

function getQueryTime(query: QueryConfig, indexes: IndexOption[]): number {
	const matchingIndex = indexes.find((idx) => idx.id === query.matchingIndexId);
	return matchingIndex?.added ? query.optimizedTime : query.baseTime;
}

function buildMigrationCode(indexes: IndexOption[]): string {
	const addedIndexes = indexes.filter((idx) => idx.added);
	if (addedIndexes.length === 0) {
		return `class AddIndexes < ActiveRecord::Migration[7.1]
  # No indexes added yet.
  # Add indexes to speed up slow queries!
  #
  # Key index types:
  #   B-tree:    default, for = and range queries
  #   Unique:    enforces uniqueness + fast lookups
  #   Composite: multi-column, order matters
  #   Partial:   indexes a subset of rows
end`;
	}

	const lines = addedIndexes.map((idx) => `    ${idx.migrationCode}`);
	return `class AddIndexes < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def change
${lines.join('\n')}
  end
end

# Always use algorithm: :concurrently
# in production to avoid locking tables!`;
}

// --- Component ---

export function Level26Indexing({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [indexes, setIndexes] = useState<IndexOption[]>(INITIAL_INDEXES);
	const [selectedQuery, setSelectedQuery] = useState(0);

	const currentQuery = QUERIES[selectedQuery];
	const currentScanType = getScanTypeForQuery(currentQuery, indexes);
	const currentQueryTime = getQueryTime(currentQuery, indexes);
	const isOptimized = currentScanType === 'index_scan';

	const optimizedCount = QUERIES.filter(
		(q) => getScanTypeForQuery(q, indexes) === 'index_scan',
	).length;

	const overallPerformance = QUERIES.reduce((sum, q) => {
		const time = getQueryTime(q, indexes);
		return sum + (time < 10 ? 1 : 0);
	}, 0);

	const toggleIndex = (indexId: string) => {
		setIndexes((prev) =>
			prev.map((idx) =>
				idx.id === indexId ? { ...idx, added: !idx.added } : idx,
			),
		);
	};

	const validateSolution = (): ValidationResult => {
		if (optimizedCount < 2) {
			return {
				valid: false,
				message: `Optimize at least 2 of 3 queries! (${optimizedCount}/2)`,
				details: QUERIES.filter(
					(q) => getScanTypeForQuery(q, indexes) === 'seq_scan',
				).map((q) => `"${q.title}" still uses Seq Scan`),
			};
		}

		const slowQueries = QUERIES.filter((q) => {
			const scan = getScanTypeForQuery(q, indexes);
			if (scan === 'seq_scan') return false;
			return getQueryTime(q, indexes) >= 10;
		});

		if (slowQueries.length > 0) {
			return {
				valid: false,
				message: 'Indexed queries must be under 10ms!',
				details: slowQueries.map(
					(q) => `"${q.title}" is ${getQueryTime(q, indexes)}ms`,
				),
			};
		}

		return {
			valid: true,
			message: 'Queries optimized with proper indexes!',
		};
	};

	const handleComplete = async () => {
		const stars = optimizedCount === 3 ? 3 : 2;
		const success = await completeLevel('act4-level26-database-indexing', {
			stars,
		});
		if (success) {
			onComplete({ stars });
		}
	};

	const handleReset = () => {
		setIndexes(INITIAL_INDEXES);
		setSelectedQuery(0);
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Add database indexes to eliminate sequential scans and speed up queries."
					instructions={[
						'Identify slow queries (Seq Scan)',
						'Choose the right index type',
						'Add indexes to speed up lookups',
						'Verify with EXPLAIN (Index Scan)',
					]}
					scenario="GET /api/users?email=alice@example.com takes 820ms. EXPLAIN shows a sequential scan across 10,000 rows. Time to index."
				>
					{/* Query Selector */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Queries to Optimize
						</div>
						<div className="space-y-2">
							{QUERIES.map((query) => {
								const isActive = selectedQuery === query.id;
								const scanType = getScanTypeForQuery(query, indexes);
								const isQueryOptimized = scanType === 'index_scan';

								return (
									<Button
										className={`w-full p-3 h-auto rounded-lg text-left justify-start flex-col items-start ${
											isActive
												? 'bg-primary/20 border border-primary'
												: 'bg-secondary border border-border hover:border-muted-foreground'
										}`}
										key={query.id}
										onClick={() => setSelectedQuery(query.id)}
										variant={isActive ? 'default' : 'outline'}
									>
										<div className="flex justify-between items-center w-full">
											<span
												className={`text-sm font-medium ${isQueryOptimized ? 'text-success' : 'text-foreground'}`}
											>
												{query.title}
											</span>
											{isQueryOptimized && (
												<Zap className="w-3.5 h-3.5 text-success" />
											)}
										</div>
										<code className="text-xs text-muted-foreground font-mono mt-1 block truncate w-full">
											{query.code}
										</code>
										<div className="flex items-center gap-2 mt-1.5">
											<span
												className={`text-xs ${isQueryOptimized ? 'text-success' : 'text-destructive'}`}
											>
												{getQueryTime(query, indexes)}ms
											</span>
											<span
												className={`text-xs px-1.5 py-0.5 rounded ${
													isQueryOptimized
														? 'bg-success/20 text-success'
														: 'bg-destructive/20 text-destructive'
												}`}
											>
												{scanType === 'index_scan' ? 'Index Scan' : 'Seq Scan'}
											</span>
										</div>
									</Button>
								);
							})}
						</div>
					</div>

					{/* Index Palette */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Available Indexes
						</div>
						<div className="space-y-2">
							{indexes.map((idx) => (
								<button
									className={`w-full p-3 rounded-lg border text-left transition-all ${
										idx.added
											? 'bg-success/10 border-success/40'
											: 'bg-secondary/50 border-border hover:border-muted-foreground'
									}`}
									key={idx.id}
									onClick={() => toggleIndex(idx.id)}
									type="button"
								>
									<div className="flex items-center justify-between mb-1">
										<div className="flex items-center gap-2">
											<Key
												className={`w-3.5 h-3.5 ${idx.added ? 'text-success' : getIndexTypeColor(idx.type)}`}
											/>
											<span
												className={`text-xs font-mono ${idx.added ? 'text-success' : 'text-foreground'}`}
											>
												{idx.column}
											</span>
										</div>
										<span
											className={`text-xs px-1.5 py-0.5 rounded border ${getIndexTypeBadgeClass(idx.type)}`}
										>
											{idx.type}
										</span>
									</div>
									<div className="text-xs text-muted-foreground">
										{idx.description}
									</div>
									{idx.added && (
										<div className="text-xs text-success mt-1 flex items-center gap-1">
											<Zap className="w-3 h-3" />
											Index added
										</div>
									)}
								</button>
							))}
						</div>
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Queries optimized</span>
							<span
								className={
									optimizedCount >= 2 ? 'text-success' : 'text-foreground'
								}
							>
								{optimizedCount} / {QUERIES.length}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all duration-500"
								style={{
									width: `${(optimizedCount / QUERIES.length) * 100}%`,
								}}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Database Indexing"
					levelNumber={26}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-3xl mx-auto space-y-6">
						{/* Current Query Display */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
								<Search className="w-4 h-4 text-primary" />
								<span className="text-foreground font-semibold">
									Query: {currentQuery.title}
								</span>
							</div>
							<div className="p-4">
								<pre className="bg-secondary/50 p-3 rounded-lg text-sm font-mono text-primary overflow-x-auto">
									<code>{currentQuery.code}</code>
								</pre>
								<div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
									<span className="flex items-center gap-1">
										<Table2 className="w-3.5 h-3.5" />
										Table: {currentQuery.table}
									</span>
									<span className="flex items-center gap-1">
										<Database className="w-3.5 h-3.5" />
										{currentQuery.totalRows.toLocaleString()} rows
									</span>
								</div>
							</div>
						</div>

						{/* EXPLAIN Plan Visualization */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Timer className="w-4 h-4 text-muted-foreground" />
									<span className="text-foreground font-semibold">
										EXPLAIN ANALYZE
									</span>
								</div>
								<span
									className={`text-xs font-mono px-2 py-1 rounded ${
										isOptimized
											? 'bg-success/20 text-success'
											: 'bg-destructive/20 text-destructive'
									}`}
								>
									{currentQueryTime}ms
								</span>
							</div>

							<div className="p-4">
								{/* Scan Type Indicator */}
								<div
									className={`p-4 rounded-lg border-2 mb-4 transition-all duration-500 ${
										isOptimized
											? 'border-success bg-success/5'
											: 'border-destructive bg-destructive/5'
									}`}
								>
									<div className="flex items-center gap-3 mb-3">
										{isOptimized ? (
											<Zap className="w-5 h-5 text-success" />
										) : (
											<Search className="w-5 h-5 text-destructive" />
										)}
										<div>
											<div
												className={`font-semibold ${isOptimized ? 'text-success' : 'text-destructive'}`}
											>
												{isOptimized
													? `Index Scan using ${currentQuery.indexName}`
													: `Seq Scan on ${currentQuery.table}`}
											</div>
											<div className="text-xs text-muted-foreground">
												{isOptimized
													? 'Jumps directly to matching rows via index'
													: `Reads all ${currentQuery.totalRows.toLocaleString()} rows sequentially`}
											</div>
										</div>
									</div>

									{/* EXPLAIN output */}
									<pre className="text-xs font-mono bg-background/50 p-3 rounded overflow-x-auto text-muted-foreground leading-relaxed">
										{isOptimized
											? currentQuery.explainAfter
											: currentQuery.explainBefore}
									</pre>
								</div>

								{/* Table Rows Visualization */}
								<div className="mb-4">
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
										Row Access Pattern
									</div>
									<div className="flex items-center gap-1">
										{Array.from({ length: 20 }).map((_, i) => {
											const isTarget = i === 7;
											const isScanned = !isOptimized || isTarget;
											return (
												<div
													className={`h-8 flex-1 rounded-sm transition-all duration-300 flex items-center justify-center ${
														isTarget
															? 'bg-primary ring-2 ring-primary/50'
															: isScanned && !isOptimized
																? 'bg-destructive/30'
																: 'bg-secondary'
													}`}
													key={i}
												>
													{isTarget && (
														<ArrowDown className="w-3 h-3 text-primary-foreground" />
													)}
												</div>
											);
										})}
									</div>
									<div className="flex justify-between text-xs text-muted-foreground mt-1">
										<span>Row 1</span>
										<span>
											{isOptimized ? (
												<span className="text-success">
													Direct lookup via index
												</span>
											) : (
												<span className="text-destructive">
													Scanning all rows...
												</span>
											)}
										</span>
										<span>Row {currentQuery.totalRows.toLocaleString()}</span>
									</div>
								</div>

								{/* Timing Bar */}
								<div>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
										Execution Time
									</div>
									<div className="relative h-8 bg-secondary rounded-lg overflow-hidden">
										<div
											className={`h-full transition-all duration-700 ease-out rounded-lg ${
												isOptimized ? 'bg-success' : 'bg-destructive'
											}`}
											style={{
												width: isOptimized
													? '1%'
													: `${Math.min((currentQuery.baseTime / 1000) * 100, 100)}%`,
											}}
										/>
										<div className="absolute inset-0 flex items-center justify-center">
											<span
												className={`text-xs font-bold ${
													isOptimized
														? 'text-success'
														: 'text-destructive-foreground'
												}`}
											>
												{currentQueryTime}ms
												{isOptimized && (
													<span className="ml-2 text-success">
														(
														{Math.round(
															currentQuery.baseTime /
																currentQuery.optimizedTime,
														)}
														x faster)
													</span>
												)}
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Table Column Visualization */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
								<Table2 className="w-4 h-4 text-muted-foreground" />
								<span className="text-foreground font-semibold">
									Table: {currentQuery.table}
								</span>
							</div>
							<div className="p-4">
								<div className="flex gap-2 flex-wrap">
									{currentQuery.columns.map((col) => {
										const hasIndex = indexes.some(
											(idx) =>
												idx.added &&
												(idx.column.includes(col) ||
													idx.column.includes(`${currentQuery.table}.${col}`)),
										);
										return (
											<div
												className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm ${
													hasIndex
														? 'bg-success/10 border-success/40 text-success'
														: 'bg-secondary/50 border-border text-muted-foreground'
												}`}
												key={col}
											>
												{hasIndex && <Key className="w-3.5 h-3.5" />}
												<span className="font-mono">{col}</span>
											</div>
										);
									})}
								</div>
							</div>
						</div>

						{/* Query Cost Meter */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
								<TrendingDown className="w-4 h-4 text-muted-foreground" />
								<span className="text-foreground font-semibold">
									Overall Query Performance
								</span>
							</div>
							<div className="p-4">
								<div className="flex gap-3">
									{QUERIES.map((query) => {
										const time = getQueryTime(query, indexes);
										const scan = getScanTypeForQuery(query, indexes);
										const isGood = scan === 'index_scan';
										return (
											<div className="flex-1" key={query.id}>
												<div className="text-xs text-muted-foreground mb-1 truncate">
													{query.title}
												</div>
												<div className="h-6 bg-secondary rounded overflow-hidden">
													<div
														className={`h-full transition-all duration-500 rounded ${
															isGood ? 'bg-success' : 'bg-destructive'
														}`}
														style={{
															width: isGood
																? '2%'
																: `${Math.min((time / 1000) * 100, 100)}%`,
														}}
													/>
												</div>
												<div
													className={`text-xs mt-1 font-mono ${isGood ? 'text-success' : 'text-destructive'}`}
												>
													{time}ms
												</div>
											</div>
										);
									})}
								</div>
								<div className="mt-4 flex items-center justify-between">
									<div className="flex items-center gap-3 text-xs">
										<div className="flex items-center gap-1.5">
											<div className="w-3 h-3 rounded bg-destructive" />
											<span className="text-muted-foreground">
												Seq Scan (slow)
											</span>
										</div>
										<div className="flex items-center gap-1.5">
											<div className="w-3 h-3 rounded bg-success" />
											<span className="text-muted-foreground">
												Index Scan (fast)
											</span>
										</div>
									</div>
									<div
										className={`text-sm font-semibold ${
											overallPerformance === QUERIES.length
												? 'text-success'
												: overallPerformance > 0
													? 'text-warning'
													: 'text-destructive'
										}`}
									>
										{overallPerformance}/{QUERIES.length} under 10ms
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'db/migrate/add_indexes.rb',
							language: 'ruby',
							code: buildMigrationCode(indexes),
							highlight: indexes
								.filter((idx) => idx.added)
								.map((_, i) => i + 5),
						},
					]}
					learningGoal="An index is like a book's table of contents. Without it, the database reads every row (Seq Scan). With it, it jumps directly to matching rows (Index Scan)."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Index Types
						</div>
						<div className="space-y-2.5 text-xs">
							<div className="flex justify-between items-start">
								<span className="text-primary font-medium">B-tree</span>
								<span className="text-muted-foreground text-right ml-4">
									Default. For = and range queries
								</span>
							</div>
							<div className="flex justify-between items-start">
								<span className="text-purple-400 font-medium">Unique</span>
								<span className="text-muted-foreground text-right ml-4">
									Enforces uniqueness + faster lookups
								</span>
							</div>
							<div className="flex justify-between items-start">
								<span className="text-warning font-medium">Composite</span>
								<span className="text-muted-foreground text-right ml-4">
									Column order matters (leftmost prefix)
								</span>
							</div>
							<div className="flex justify-between items-start">
								<span className="text-muted-foreground font-medium">
									Partial
								</span>
								<span className="text-muted-foreground text-right ml-4">
									Indexes a subset of rows (WHERE)
								</span>
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Production Tips
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# Always use concurrently
# to avoid locking tables:
add_index :users, :email,
  algorithm: :concurrently

# Composite index order matters!
# WHERE published AND ORDER BY created_at
# -> [:published, :created_at]
# NOT [:created_at, :published]

# Check if index is being used:
EXPLAIN ANALYZE <your query>`}
						</pre>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">
							When NOT to Index
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li className="flex items-start gap-1">
								<span className="text-destructive">-</span>
								Small tables (under ~1000 rows)
							</li>
							<li className="flex items-start gap-1">
								<span className="text-destructive">-</span>
								Columns rarely used in WHERE/ORDER
							</li>
							<li className="flex items-start gap-1">
								<span className="text-destructive">-</span>
								High-write, low-read tables
							</li>
							<li className="flex items-start gap-1">
								<span className="text-destructive">-</span>
								Columns with very low cardinality
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level26Indexing;
