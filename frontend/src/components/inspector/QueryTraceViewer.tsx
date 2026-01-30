// Query trace viewer showing executed queries with N+1 highlighting

import { useState, useMemo } from 'react';

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
function QueryRow({ query, isNPlusOneTable }: { query: QueryTrace; isNPlusOneTable: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const typeColors: Record<string, string> = {
    select: 'text-blue-400',
    insert: 'text-green-400',
    update: 'text-amber-400',
    delete: 'text-red-400',
  };

  return (
    <div
      className={`
        border-l-2 pl-2 py-1
        ${query.isNPlusOne ? 'border-red-500 bg-red-900/20' : 'border-gray-600'}
        ${isNPlusOneTable && !query.isNPlusOne ? 'border-amber-500' : ''}
      `}
    >
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Query type badge */}
        <span
          className={`text-xs font-mono uppercase ${typeColors[query.type] || 'text-gray-400'}`}
        >
          {query.type}
        </span>

        {/* Table name */}
        <span className="text-xs text-gray-400 font-mono">{query.tableName}</span>

        {/* Latency */}
        <span
          className={`text-xs font-mono ml-auto ${
            query.latency > 50 ? 'text-amber-400' : 'text-gray-500'
          }`}
        >
          {query.latency.toFixed(1)}ms
        </span>

        {/* Index indicator */}
        {query.usedIndex ? (
          <span className="text-xs text-green-400" title={`Index: ${query.indexName}`}>
            IDX
          </span>
        ) : (
          <span className="text-xs text-red-400" title="No index used">
            SCAN
          </span>
        )}

        {/* N+1 badge */}
        {query.isNPlusOne && (
          <span className="text-xs bg-red-500 text-white px-1 rounded">N+1</span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 pl-2 text-xs">
          <div className="font-mono text-gray-300 bg-gray-900 p-2 rounded overflow-x-auto">
            {query.sql}
          </div>
          <div className="flex gap-4 mt-1 text-gray-400">
            <span>Rows: {query.rowsAffected}</span>
            {query.loopIteration !== undefined && (
              <span className="text-red-400">Loop iteration: {query.loopIteration}</span>
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

  const { byTable, nPlusOneGroups } = useMemo(() => analyzeQueries(queries), [queries]);

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
  const noIndexCount = queries.filter((q) => !q.usedIndex && q.type === 'select').length;

  return (
    <div className={`bg-gray-800 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-white">Query Trace</h3>
          <span className="text-xs text-gray-400">
            {queries.length} queries ({totalTime.toFixed(0)}ms total)
          </span>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 text-xs">
          {nPlusOneCount > 0 && (
            <span className="text-red-400">
              {nPlusOneCount} N+1 queries
            </span>
          )}
          {noIndexCount > 0 && (
            <span className="text-amber-400">
              {noIndexCount} table scans
            </span>
          )}
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 text-xs rounded ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('nplusone')}
            className={`px-2 py-1 text-xs rounded ${
              filter === 'nplusone' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            N+1 Only
          </button>
          <button
            onClick={() => setFilter('slow')}
            className={`px-2 py-1 text-xs rounded ${
              filter === 'slow' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            Slow (&gt;50ms)
          </button>
          <button
            onClick={() => setGroupByTable(!groupByTable)}
            className={`px-2 py-1 text-xs rounded ml-auto ${
              groupByTable ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            Group by Table
          </button>
        </div>
      </div>

      {/* Query list */}
      <div className="max-h-96 overflow-y-auto p-2 space-y-1">
        {filteredQueries.length === 0 ? (
          <p className="text-gray-400 text-center py-4 text-sm">No queries to display</p>
        ) : groupByTable ? (
          // Grouped view
          Array.from(byTable.entries()).map(([tableName, tableQueries]) => (
            <div key={tableName} className="mb-3">
              <div
                className={`text-xs font-semibold mb-1 flex items-center gap-2 ${
                  nPlusOneGroups.includes(tableName) ? 'text-red-400' : 'text-gray-300'
                }`}
              >
                <span>{tableName}</span>
                <span className="text-gray-500">({tableQueries.length})</span>
                {nPlusOneGroups.includes(tableName) && (
                  <span className="bg-red-500 text-white px-1 rounded text-xs">
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
                      key={query.id}
                      query={query}
                      isNPlusOneTable={nPlusOneGroups.includes(tableName)}
                    />
                  ))}
              </div>
            </div>
          ))
        ) : (
          // Flat view
          filteredQueries.map((query) => (
            <QueryRow
              key={query.id}
              query={query}
              isNPlusOneTable={nPlusOneGroups.includes(query.tableName)}
            />
          ))
        )}
      </div>

      {/* N+1 explanation */}
      {nPlusOneGroups.length > 0 && (
        <div className="p-3 bg-red-900/30 border-t border-red-700">
          <h4 className="text-sm font-semibold text-red-300 mb-1">N+1 Query Pattern Detected</h4>
          <p className="text-xs text-red-200">
            Tables affected: {nPlusOneGroups.join(', ')}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Fix: Use <code className="bg-gray-800 px-1 rounded">includes(:association)</code> or{' '}
            <code className="bg-gray-800 px-1 rounded">preload(:association)</code> in your query.
          </p>
        </div>
      )}
    </div>
  );
}
