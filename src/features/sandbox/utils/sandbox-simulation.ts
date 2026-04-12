/**
 * Sandbox Simulation Engine
 *
 * Tick-based simulation that generates request traffic through the production graph.
 * Updates node metrics and edge animation states each tick.
 */

import type { SandboxNodeData } from './sandbox-layout';

export interface SimMetrics {
	totalRequests: number;
	completedRequests: number;
	failedRequests: number;
	avgLatency: number;
	p95Latency: number;
	cacheHitRate: number;
	errorRate: number;
	reqPerSec: number;
	dbQueryCount: number;
	queueDepth: number;
	blockedByRateLimit: number;
}

const INITIAL_METRICS: SimMetrics = {
	totalRequests: 0,
	completedRequests: 0,
	failedRequests: 0,
	avgLatency: 0,
	p95Latency: 0,
	cacheHitRate: 0,
	errorRate: 0,
	reqPerSec: 0,
	dbQueryCount: 0,
	queueDepth: 0,
	blockedByRateLimit: 0,
};

export function createInitialMetrics(): SimMetrics {
	return { ...INITIAL_METRICS };
}

/**
 * Run one simulation tick. Returns updated node data and global metrics.
 * Pure function: takes current state, returns next state.
 */
export function simulationTick(
	nodeDataMap: Map<string, SandboxNodeData>,
	metrics: SimMetrics,
	tickNumber: number,
	trafficRate: number,
): { nodeUpdates: Map<string, Partial<SandboxNodeData>>; metrics: SimMetrics } {
	const updates = new Map<string, Partial<SandboxNodeData>>();
	const hasNode = (id: string) => nodeDataMap.has(id);

	// Traffic generation
	const requestsThisTick = trafficRate / 30; // 30 ticks per second
	const newRequests = Math.random() < requestsThisTick ? Math.ceil(requestsThisTick) : Math.floor(requestsThisTick);

	const m = { ...metrics };
	m.totalRequests += newRequests;

	// Users node
	if (hasNode('users')) {
		updates.set('users', {
			status: 'active',
			metrics: { reqPerSec: trafficRate },
		});
	}

	// CDN: serves 40% of requests (static assets)
	const cdnHits = Math.round(newRequests * 0.4);
	const cdnMisses = newRequests - cdnHits;
	if (hasNode('cdn')) {
		updates.set('cdn', {
			status: 'active',
			metrics: {
				hitRate: 40 + Math.round(Math.random() * 10),
				reqPerSec: newRequests,
			},
		});
	}

	// Rate limiter: blocks ~5% of remaining traffic
	const rateLimited = hasNode('rate-limiter')
		? Math.round(cdnMisses * 0.05)
		: 0;
	const passedRateLimit = cdnMisses - rateLimited;
	m.blockedByRateLimit += rateLimited;

	if (hasNode('rate-limiter')) {
		updates.set('rate-limiter', {
			status: rateLimited > 0 ? 'warning' : 'active',
			metrics: { blockedCount: m.blockedByRateLimit, reqPerSec: cdnMisses },
		});
	}

	// Load balancer: distributes to app servers
	const toApp1 = Math.ceil(passedRateLimit / 2);
	const toApp2 = passedRateLimit - toApp1;

	if (hasNode('lb')) {
		updates.set('lb', {
			status: 'active',
			metrics: { reqPerSec: passedRateLimit },
		});
	}

	// App servers: process requests
	const app1Threads = hasNode('app-1') ? Math.min(5, toApp1) : 0;
	const app2Threads = hasNode('app-2') ? Math.min(5, toApp2) : 0;

	if (hasNode('app-1')) {
		updates.set('app-1', {
			status: app1Threads >= 4 ? 'warning' : 'active',
			metrics: {
				threadsBusy: app1Threads,
				threadsTotal: 5,
				reqPerSec: toApp1,
			},
		});
	}

	if (hasNode('app-2')) {
		updates.set('app-2', {
			status: app2Threads >= 4 ? 'warning' : 'active',
			metrics: {
				threadsBusy: app2Threads,
				threadsTotal: 5,
				reqPerSec: toApp2,
			},
		});
	}

	// Cache: hit rate depends on whether cache node exists
	const totalAppRequests = toApp1 + toApp2;
	const cacheHitRate = hasNode('cache') ? 70 + Math.round(Math.random() * 15) : 0;
	const cacheHits = Math.round(totalAppRequests * (cacheHitRate / 100));
	const cacheMisses = totalAppRequests - cacheHits;

	if (hasNode('cache')) {
		updates.set('cache', {
			status: 'active',
			metrics: { hitRate: cacheHitRate, reqPerSec: totalAppRequests },
		});
	}

	// Database: handles cache misses + writes
	const dbQueries = cacheMisses + Math.round(newRequests * 0.1); // 10% are writes
	m.dbQueryCount += dbQueries;

	const baseLatency = hasNode('cache') ? 25 : 80; // No cache = much higher latency
	const dbLatency = hasNode('db-primary') ? 5 + Math.random() * 15 : 50;
	const totalLatency = baseLatency + (cacheMisses > 0 ? dbLatency : 0);

	if (hasNode('db-primary')) {
		updates.set('db-primary', {
			status: dbQueries > 10 ? 'warning' : 'active',
			metrics: { queryCount: dbQueries, latency: dbLatency },
		});
	}

	if (hasNode('db-replica')) {
		const replicaQueries = Math.round(cacheMisses * 0.6); // 60% of reads go to replica
		updates.set('db-replica', {
			status: 'active',
			metrics: { queryCount: replicaQueries, latency: dbLatency * 1.1 },
		});
	}

	// Background jobs: ~10% of requests enqueue a job
	const newJobs = Math.round(newRequests * 0.1);
	const queueDepth = Math.max(0, (m.queueDepth || 0) + newJobs - 2); // processes 2 per tick
	m.queueDepth = queueDepth;

	if (hasNode('queue')) {
		updates.set('queue', {
			status: queueDepth > 20 ? 'warning' : 'active',
			metrics: { queueDepth, reqPerSec: newJobs },
		});
	}

	if (hasNode('stripe')) {
		const stripeLatency = 200 + Math.random() * 300;
		updates.set('stripe', {
			status: 'active',
			metrics: { latency: stripeLatency, reqPerSec: Math.round(newJobs * 0.3) },
		});
	}

	// Global metrics
	m.completedRequests += cdnHits + passedRateLimit;
	m.failedRequests += rateLimited;
	m.avgLatency = totalLatency;
	m.p95Latency = totalLatency * 1.8;
	m.cacheHitRate = cacheHitRate;
	m.errorRate =
		m.totalRequests > 0
			? Math.round((m.failedRequests / m.totalRequests) * 1000) / 10
			: 0;
	m.reqPerSec = trafficRate;

	return { nodeUpdates: updates, metrics: m };
}
