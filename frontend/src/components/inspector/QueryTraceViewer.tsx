// Query trace viewer showing executed queries with N+1 highlighting

import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';

// Query trace type for debugging
export interface QueryTrace {
	id: string;
	sql: string;
	tableName: string;
	type: 'select' | 'insert' | 'update' | 'delete';
	latency: number;
	rowsAffected: number;
	usedIndex: boolean;
	indexName?: string;
	isNPlusOne: boolean;
	loopIteration?: number;
}

interface QueryTraceViewerProps {
	queries: QueryTrace[];
	maxQueries?: number;
	className?: string;
}

// Group queries by table and detect N+1 patterns
function analyzeQueries(queries: QueryTrace[]) {
	const byTable = new Map<string, QueryTrace[]>();

	for (const query of queries) {
		const existing = byTable.get(query.tableName) || [];
		existing.push(query);
		byTable.set(query.tableName, existing);
	}

	const nPlusOneGroups: string[] = [];
	for (const [tableName, tableQueries] of byTable) {
		if (tableQueries.filter((q) => q.isNPlusOne).length >= 3) {
			nPlusOneGroups.push(tableName);
		}
	}

	return { byTable, nPlusOneGroups };
}

// Single query row
function QueryRow({
	query,
	isNPlusOneTable,
}: {
	query: QueryTrace;
	isNPlusOneTable: boolean;
}) {
	const [expanded, setExpanded] = useState(false);

	const typeColors: Record<string, string> = {
		select: 'text-primary',
		insert: 'text-success',
		update: 'text-warning',
		delete: 'text-destructive',
	};

	return (
		<div
			className={`
        border-l-2 pl-2 py-1
        ${query.isNPlusOne ? 'border-destructive bg-destructive/20' : 'border-border'}
        ${isNPlusOneTable && !query.isNPlusOne ? 'border-warning' : ''}
      `}
		>
			<div
				className="flex items-center gap-2 cursor-pointer"
				onClick={() => setExpanded(!expanded)}
			>
				{/* Query type badge */}
				<span
					className={`text-xs font-mono uppercase ${typeColors[query.type] || 'text-muted-foreground'}`}
				>
					{query.type}
				</span>

				{/* Table name */}
				<span className="text-xs text-muted-foreground font-mono">
					{query.tableName}
				</span>

				{/* Latency */}
				<span
					className={`text-xs font-mono ml-auto ${
						query.latency > 50 ? 'text-warning' : 'text-muted-foreground'
					}`}
				>
					{query.latency.toFixed(1)}ms
				</span>

				{/* Index indicator */}
				{query.usedIndex ? (
					<span
						className="text-xs text-success"
						title={`Index: ${query.indexName}`}
					>
						IDX
					</span>
				) : (
					<span className="text-xs text-destructive" title="No index used">
						SCAN
					</span>
				)}

				{/* N+1 badge */}
				{query.isNPlusOne && (
					<span className="text-xs bg-destructive text-foreground px-1 rounded">
						N+1
					</span>
				)}
			</div>

			{/* Expanded details */}
			{expanded && (
				<div className="mt-2 pl-2 text-xs">
					<div className="font-mono text-foreground bg-background p-2 rounded overflow-x-auto">
						{query.sql}
					</div>
					<div className="flex gap-4 mt-1 text-muted-foreground">
						<span>Rows: {query.rowsAffected}</span>
						{query.loopIteration !== undefined && (
							<span className="text-destructive">
								Loop iteration: {query.loopIteration}
							</span>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

export function QueryTraceViewer({
	queries,
	maxQueries = 100,
	className = '',
}: QueryTraceViewerProps) {
	const [filter, setFilter] = useState<'all' | 'nplusone' | 'slow'>('all');
	const [groupByTable, setGroupByTable] = useState(false);

	const { byTable, nPlusOneGroups } = useMemo(
		() => analyzeQueries(queries),
		[queries],
	);

	// Filter queries
	const filteredQueries = useMemo(() => {
		let result = queries;

		if (filter === 'nplusone') {
			result = queries.filter((q) => q.isNPlusOne);
		} else if (filter === 'slow') {
			result = queries.filter((q) => q.latency > 50);
		}

		return result.slice(-maxQueries);
	}, [queries, filter, maxQueries]);

	// Stats
	const totalTime = queries.reduce((sum, q) => sum + q.latency, 0);
	const nPlusOneCount = queries.filter((q) => q.isNPlusOne).length;
	const noIndexCount = queries.filter(
		(q) => !q.usedIndex && q.type === 'select',
	).length;

	return (
		<div className={`bg-card rounded-lg overflow-hidden ${className}`}>
			{/* Header */}
			<div className="p-3 border-b border-border">
				<div className="flex items-center justify-between mb-2">
					<h3 className="font-semibold text-foreground">Query Trace</h3>
					<span className="text-xs text-muted-foreground">
						{queries.length} queries ({totalTime.toFixed(0)}ms total)
					</span>
				</div>

				{/* Stats row */}
				<div className="flex gap-4 text-xs">
					{nPlusOneCount > 0 && (
						<span className="text-destructive">
							{nPlusOneCount} N+1 queries
						</span>
					)}
					{noIndexCount > 0 && (
						<span className="text-warning">{noIndexCount} table scans</span>
					)}
				</div>

				{/* Filter buttons */}
				<div className="flex gap-2 mt-2">
					<Button
						onClick={() => setFilter('all')}
						size="sm"
						variant={filter === 'all' ? 'default' : 'secondary'}
					>
						All
					</Button>
					<Button
						color={filter === 'nplusone' ? 'destructive' : undefined}
						onClick={() => setFilter('nplusone')}
						size="sm"
						variant={filter === 'nplusone' ? 'default' : 'secondary'}
					>
						N+1 Only
					</Button>
					<Button
						onClick={() => setFilter('slow')}
						size="sm"
						variant={filter === 'slow' ? 'default' : 'secondary'}
					>
						Slow (&gt;50ms)
					</Button>
					<Button
						className="ml-auto"
						onClick={() => setGroupByTable(!groupByTable)}
						size="sm"
						variant={groupByTable ? 'default' : 'secondary'}
					>
						Group by Table
					</Button>
				</div>
			</div>

			{/* Query list */}
			<div className="max-h-96 overflow-y-auto p-2 space-y-1">
				{filteredQueries.length === 0 ? (
					<p className="text-muted-foreground text-center py-4 text-sm">
						No queries to display
					</p>
				) : groupByTable ? (
					// Grouped view
					Array.from(byTable.entries()).map(([tableName, tableQueries]) => (
						<div className="mb-3" key={tableName}>
							<div
								className={`text-xs font-semibold mb-1 flex items-center gap-2 ${
									nPlusOneGroups.includes(tableName)
										? 'text-destructive'
										: 'text-foreground'
								}`}
							>
								<span>{tableName}</span>
								<span className="text-muted-foreground">
									({tableQueries.length})
								</span>
								{nPlusOneGroups.includes(tableName) && (
									<span className="bg-destructive text-foreground px-1 rounded text-xs">
										N+1 PATTERN
									</span>
								)}
							</div>
							<div className="space-y-1">
								{tableQueries
									.filter((q) => {
										if (filter === 'nplusone') return q.isNPlusOne;
										if (filter === 'slow') return q.latency > 50;
										return true;
									})
									.slice(-20)
									.map((query) => (
										<QueryRow
											isNPlusOneTable={nPlusOneGroups.includes(tableName)}
											key={query.id}
											query={query}
										/>
									))}
							</div>
						</div>
					))
				) : (
					// Flat view
					filteredQueries.map((query) => (
						<QueryRow
							isNPlusOneTable={nPlusOneGroups.includes(query.tableName)}
							key={query.id}
							query={query}
						/>
					))
				)}
			</div>

			{/* N+1 explanation */}
			{nPlusOneGroups.length > 0 && (
				<div className="p-3 bg-destructive/30 border-t border-destructive">
					<h4 className="text-sm font-semibold text-destructive mb-1">
						N+1 Query Pattern Detected
					</h4>
					<p className="text-xs text-destructive">
						Tables affected: {nPlusOneGroups.join(', ')}
					</p>
					<p className="text-xs text-muted-foreground mt-1">
						Fix: Use{' '}
						<code className="bg-background px-1 rounded">
							includes(:association)
						</code>{' '}
						or{' '}
						<code className="bg-background px-1 rounded">
							preload(:association)
						</code>{' '}
						in your query.
					</p>
				</div>
			)}
		</div>
	);
}
