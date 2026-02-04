// Pure metric calculation functions for the simulation engine

import type {
	EnemyType,
	SimulatedQuery,
	SimulatedRequest,
	SimulationMetrics,
	SimulationState,
} from '../../../shared/types/index';
import type {
	BaseNode,
	Connection,
	ModelConfig,
} from '../../../shared/types/pipeline';

// Calculate latency percentiles from completed requests
export function calculateLatencyMetrics(
	requests: SimulatedRequest[],
): SimulationMetrics['latency'] {
	if (requests.length === 0) {
		return { p50: 0, p95: 0, p99: 0, avg: 0, max: 0 };
	}

	const latencies = requests
		.filter((r) => r.status === 'completed')
		.map((r) => r.totalLatency)
		.sort((a, b) => a - b);

	if (latencies.length === 0) {
		return { p50: 0, p95: 0, p99: 0, avg: 0, max: 0 };
	}

	const p50Index = Math.floor(latencies.length * 0.5);
	const p95Index = Math.floor(latencies.length * 0.95);
	const p99Index = Math.floor(latencies.length * 0.99);

	const sum = latencies.reduce((a, b) => a + b, 0);

	return {
		p50: latencies[p50Index] || 0,
		p95: latencies[p95Index] || latencies[latencies.length - 1] || 0,
		p99: latencies[p99Index] || latencies[latencies.length - 1] || 0,
		avg: sum / latencies.length,
		max: latencies[latencies.length - 1] || 0,
	};
}

// Detect N+1 query patterns in a node's queries
export function detectNPlusOne(queries: SimulatedQuery[]): {
	isNPlusOne: boolean;
	count: number;
	pattern?: string;
} {
	if (queries.length < 2) {
		return { isNPlusOne: false, count: 0 };
	}

	// Group queries by table
	const queryGroups = new Map<string, SimulatedQuery[]>();
	for (const query of queries) {
		const existing = queryGroups.get(query.tableName) || [];
		existing.push(query);
		queryGroups.set(query.tableName, existing);
	}

	// Check for N+1 pattern: one query followed by N similar queries on a related table
	let nPlusOneCount = 0;
	let pattern: string | undefined;

	for (const [tableName, tableQueries] of queryGroups) {
		// If we have many similar SELECT queries on the same table, it's likely N+1
		const selectQueries = tableQueries.filter((q) => q.type === 'select');
		if (selectQueries.length > 3) {
			// Check if these look like N+1 (similar patterns, sequential)
			const hasLoopIterations = selectQueries.some(
				(q) => q.loopIteration !== undefined,
			);
			if (hasLoopIterations) {
				nPlusOneCount += selectQueries.length - 1; // First query is the "1", rest are the "N"
				pattern = `N+1 detected on ${tableName}: ${selectQueries.length} queries`;
			}
		}
	}

	return {
		isNPlusOne: nPlusOneCount > 0,
		count: nPlusOneCount,
		pattern,
	};
}

// Check if a model node is missing eager loading for its associations
export function checkMissingEagerLoading(
	modelNode: BaseNode,
	connections: Connection[],
	allNodes: Map<string, BaseNode>,
): string[] {
	const config = modelNode.config as ModelConfig;
	const missingIncludes: string[] = [];

	// Get outgoing connections to see what associations might be accessed
	const outgoingConnections = connections.filter(
		(c) => c.sourceNodeId === modelNode.id,
	);

	// Check if any associations are being accessed without eager loading
	for (const assoc of config.associations || []) {
		// If the association is being accessed (has outgoing data flow)
		// but isn't in defaultIncludes, flag it
		const isAccessed = outgoingConnections.some((c) => {
			const targetNode = allNodes.get(c.targetNodeId);
			if (!targetNode) return false;
			// Check if the connection carries this association's data
			return c.dataFlow && c.dataFlow.requestsPerSecond > 0;
		});

		const isEagerLoaded = config.defaultIncludes?.includes(assoc.name);

		if (isAccessed && !isEagerLoaded) {
			missingIncludes.push(assoc.name);
		}
	}

	return missingIncludes;
}

// Calculate overall stability score (0-100)
export function calculateStabilityScore(metrics: SimulationMetrics): number {
	let score = 100;

	// Latency penalties
	if (metrics.latency.p95 > 500) score -= 20;
	else if (metrics.latency.p95 > 200) score -= 10;
	else if (metrics.latency.p95 > 100) score -= 5;

	// Query count penalties
	if (metrics.queriesPerRequest > 20) score -= 25;
	else if (metrics.queriesPerRequest > 10) score -= 15;
	else if (metrics.queriesPerRequest > 5) score -= 5;

	// N+1 penalties (severe)
	if (metrics.nPlusOneCount > 0) {
		score -= Math.min(30, metrics.nPlusOneCount * 5);
	}

	// Error rate penalties
	if (metrics.errorRate > 10) score -= 25;
	else if (metrics.errorRate > 5) score -= 15;
	else if (metrics.errorRate > 1) score -= 5;

	// Memory pressure penalties
	if (metrics.memoryPressure === 'critical') score -= 20;
	else if (metrics.memoryPressure === 'high') score -= 10;
	else if (metrics.memoryPressure === 'medium') score -= 5;

	// Cache hit rate bonus/penalty
	if (metrics.cacheHitRate >= 90) score += 5;
	else if (metrics.cacheHitRate < 50 && metrics.cacheSize > 0) score -= 10;

	// Clamp to 0-100
	return Math.max(0, Math.min(100, score));
}

// Calculate throughput metrics
export function calculateThroughputMetrics(
	state: SimulationState,
	ticksPerSecond: number,
): SimulationMetrics['throughput'] {
	const completedInLastSecond = state.completedRequests.filter(
		(r) => r.endTick !== undefined && state.tick - r.endTick < ticksPerSecond,
	).length;

	const failedCount = state.completedRequests.filter(
		(r) => r.status === 'error',
	).length;

	return {
		requestsPerSecond: completedInLastSecond,
		completedRequests: state.completedRequests.filter(
			(r) => r.status === 'completed',
		).length,
		failedRequests: failedCount,
		pendingRequests: state.activeRequests.length,
	};
}

// Determine memory pressure level
export function calculateMemoryPressure(
	memoryUsage: number,
): SimulationMetrics['memoryPressure'] {
	if (memoryUsage >= 90) return 'critical';
	if (memoryUsage >= 70) return 'high';
	if (memoryUsage >= 50) return 'medium';
	return 'low';
}

// Determine what enemies should spawn based on current metrics
export function determineEnemySpawns(
	metrics: SimulationMetrics,
	thresholds: {
		nPlusOneCount: number;
		memoryPressure: number;
		callbackDepth: number;
		latencyMs: number;
		errorRate: number;
		cacheMissRate: number;
	},
): EnemyType[] {
	const spawns: EnemyType[] = [];

	// N+1 queries spawn query swarms
	if (metrics.nPlusOneCount >= thresholds.nPlusOneCount) {
		spawns.push('query_swarm');
	}

	// High memory spawns memory blobs
	if (metrics.memoryUsage >= thresholds.memoryPressure) {
		spawns.push('memory_blob');
	}

	// High latency spawns timeout wraiths
	if (metrics.latency.p95 >= thresholds.latencyMs) {
		spawns.push('timeout_wraith');
	}

	// High error rate spawns error spikes
	if (metrics.errorRate >= thresholds.errorRate) {
		spawns.push('error_spike');
	}

	// Low cache hit rate spawns cache phantoms
	const cacheMissRate = 100 - metrics.cacheHitRate;
	if (metrics.cacheSize > 0 && cacheMissRate >= thresholds.cacheMissRate) {
		spawns.push('cache_phantom');
	}

	return spawns;
}

// Calculate cache hit rate from requests
export function calculateCacheHitRate(requests: SimulatedRequest[]): number {
	const totalCacheAccesses = requests.reduce(
		(sum, r) => sum + r.cacheHits + r.cacheMisses,
		0,
	);

	if (totalCacheAccesses === 0) return 0;

	const totalHits = requests.reduce((sum, r) => sum + r.cacheHits, 0);
	return (totalHits / totalCacheAccesses) * 100;
}

// Calculate index usage rate from queries
export function calculateIndexUsageRate(queries: SimulatedQuery[]): number {
	if (queries.length === 0) return 100;

	const selectQueries = queries.filter((q) => q.type === 'select');
	if (selectQueries.length === 0) return 100;

	const indexedQueries = selectQueries.filter((q) => q.usedIndex);
	return (indexedQueries.length / selectQueries.length) * 100;
}

// Aggregate all queries from completed requests
export function aggregateQueries(
	requests: SimulatedRequest[],
): SimulatedQuery[] {
	return requests.flatMap((r) => r.queries);
}

// Calculate stability trend based on recent history
export function calculateStabilityTrend(
	currentScore: number,
	previousScores: number[],
): 'improving' | 'stable' | 'degrading' {
	if (previousScores.length < 3) return 'stable';

	const recentAvg =
		previousScores.slice(-5).reduce((a, b) => a + b, 0) /
		Math.min(5, previousScores.length);
	const olderAvg =
		previousScores.slice(-10, -5).reduce((a, b) => a + b, 0) /
		Math.min(5, previousScores.slice(-10, -5).length || 1);

	const diff = recentAvg - olderAvg;

	if (diff > 5) return 'improving';
	if (diff < -5) return 'degrading';
	return 'stable';
}

// Check if objective metrics are met
export function checkObjectiveMet(
	metrics: SimulationMetrics,
	stabilityScore: number,
	targetMetrics: {
		maxLatencyP95?: number;
		maxQueriesPerRequest?: number;
		minCacheHitRate?: number;
		maxErrorRate?: number;
		minStability?: number;
		maxMemoryUsage?: number;
	},
): boolean {
	if (targetMetrics.maxLatencyP95 !== undefined) {
		if (metrics.latency.p95 > targetMetrics.maxLatencyP95) return false;
	}

	if (targetMetrics.maxQueriesPerRequest !== undefined) {
		if (metrics.queriesPerRequest > targetMetrics.maxQueriesPerRequest)
			return false;
	}

	if (targetMetrics.minCacheHitRate !== undefined) {
		if (metrics.cacheHitRate < targetMetrics.minCacheHitRate) return false;
	}

	if (targetMetrics.maxErrorRate !== undefined) {
		if (metrics.errorRate > targetMetrics.maxErrorRate) return false;
	}

	if (targetMetrics.minStability !== undefined) {
		if (stabilityScore < targetMetrics.minStability) return false;
	}

	if (targetMetrics.maxMemoryUsage !== undefined) {
		if (metrics.memoryUsage > targetMetrics.maxMemoryUsage) return false;
	}

	return true;
}
