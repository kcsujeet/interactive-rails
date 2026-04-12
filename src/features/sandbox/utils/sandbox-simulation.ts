/**
 * Sandbox Simulation Engine
 *
 * Tick-based simulation that generates request traffic through the production graph.
 * All behavior is driven by tunable parameters the user can adjust in real-time.
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

/** Tunable parameters the user can adjust to stress-test the system */
export interface SimParams {
	trafficRate: number;
	dbLatency: number;
	cacheHitPercent: number;
	errorInjectionPercent: number;
	stripeLatency: number;
	pumaThreads: number;
	rateLimitThreshold: number;
	queueProcessingRate: number;
}

export const DEFAULT_PARAMS: SimParams = {
	trafficRate: 100,
	dbLatency: 10,
	cacheHitPercent: 75,
	errorInjectionPercent: 0,
	stripeLatency: 250,
	pumaThreads: 5,
	rateLimitThreshold: 500,
	queueProcessingRate: 3,
};

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
 * Run one simulation tick. All behavior driven by params.
 */
export function simulationTick(
	nodeDataMap: Map<string, SandboxNodeData>,
	metrics: SimMetrics,
	params: SimParams,
): { nodeUpdates: Map<string, Partial<SandboxNodeData>>; metrics: SimMetrics } {
	const updates = new Map<string, Partial<SandboxNodeData>>();
	const hasNode = (id: string) => nodeDataMap.has(id);

	const requestsThisTick = params.trafficRate / 30;
	const newRequests =
		Math.random() < requestsThisTick
			? Math.ceil(requestsThisTick)
			: Math.floor(requestsThisTick);

	const m = { ...metrics };
	m.totalRequests += newRequests;

	// Users
	if (hasNode('users')) {
		updates.set('users', {
			status: 'active',
			metrics: { reqPerSec: params.trafficRate },
		});
	}

	// CDN: serves ~40% of requests (static assets)
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

	// Rate limiter: blocks traffic exceeding threshold
	const overThreshold = params.trafficRate > params.rateLimitThreshold;
	const rateLimitPercent =
		hasNode('rate-limiter') && overThreshold
			? Math.min(
					80,
					((params.trafficRate - params.rateLimitThreshold) /
						params.rateLimitThreshold) *
						100,
				)
			: 0;
	const rateLimited = Math.round(cdnMisses * (rateLimitPercent / 100));
	const passedRateLimit = cdnMisses - rateLimited;
	m.blockedByRateLimit += rateLimited;

	if (hasNode('rate-limiter')) {
		updates.set('rate-limiter', {
			status: overThreshold ? 'warning' : 'active',
			metrics: { blockedCount: m.blockedByRateLimit, reqPerSec: cdnMisses },
		});
	}

	// Load balancer
	const toApp1 = Math.ceil(passedRateLimit / 2);
	const toApp2 = passedRateLimit - toApp1;

	if (hasNode('lb')) {
		updates.set('lb', {
			status: 'active',
			metrics: { reqPerSec: passedRateLimit },
		});
	}

	// App servers: threads are a bottleneck
	const app1Busy = Math.min(params.pumaThreads, toApp1);
	const app2Busy = Math.min(params.pumaThreads, toApp2);
	const app1Saturated = toApp1 > params.pumaThreads;
	const app2Saturated = toApp2 > params.pumaThreads;
	const threadBackpressure = app1Saturated || app2Saturated;

	if (hasNode('app-1')) {
		updates.set('app-1', {
			status: app1Saturated
				? 'error'
				: app1Busy >= params.pumaThreads - 1
					? 'warning'
					: 'active',
			metrics: {
				threadsBusy: app1Busy,
				threadsTotal: params.pumaThreads,
				reqPerSec: toApp1,
			},
		});
	}

	if (hasNode('app-2')) {
		updates.set('app-2', {
			status: app2Saturated
				? 'error'
				: app2Busy >= params.pumaThreads - 1
					? 'warning'
					: 'active',
			metrics: {
				threadsBusy: app2Busy,
				threadsTotal: params.pumaThreads,
				reqPerSec: toApp2,
			},
		});
	}

	// Cache: hit rate driven by user param
	const totalAppRequests = toApp1 + toApp2;
	const effectiveCacheHitRate = hasNode('cache')
		? params.cacheHitPercent + Math.round(Math.random() * 5 - 2.5)
		: 0;
	const cacheHits = Math.round(
		totalAppRequests * (effectiveCacheHitRate / 100),
	);
	const cacheMisses = totalAppRequests - cacheHits;

	if (hasNode('cache')) {
		updates.set('cache', {
			status: effectiveCacheHitRate < 30 ? 'warning' : 'active',
			metrics: { hitRate: effectiveCacheHitRate, reqPerSec: totalAppRequests },
		});
	}

	// Database: latency driven by user param, load by cache misses
	const dbQueries = cacheMisses + Math.round(newRequests * 0.1);
	m.dbQueryCount += dbQueries;
	const dbOverloaded = dbQueries > 15;
	const effectiveDbLatency =
		params.dbLatency * (dbOverloaded ? 3 : 1) +
		Math.random() * params.dbLatency * 0.5;

	if (hasNode('db-primary')) {
		updates.set('db-primary', {
			status: dbOverloaded ? 'error' : dbQueries > 8 ? 'warning' : 'active',
			metrics: { queryCount: dbQueries, latency: effectiveDbLatency },
		});
	}

	if (hasNode('db-replica')) {
		const replicaQueries = Math.round(cacheMisses * 0.6);
		updates.set('db-replica', {
			status: 'active',
			metrics: {
				queryCount: replicaQueries,
				latency: effectiveDbLatency * 1.1,
			},
		});
	}

	// Errors: injected by user param + natural from overload
	const naturalErrorRate = threadBackpressure ? 5 + Math.random() * 10 : 0;
	const totalErrorPercent = Math.min(
		100,
		params.errorInjectionPercent + naturalErrorRate,
	);
	const erroredRequests = Math.round(newRequests * (totalErrorPercent / 100));
	m.failedRequests += erroredRequests;

	// Queue: depth grows if processing rate is lower than incoming jobs
	const newJobs = Math.round(newRequests * 0.1);
	const processed = Math.min(
		m.queueDepth + newJobs,
		params.queueProcessingRate,
	);
	const queueDepth = Math.max(0, (m.queueDepth || 0) + newJobs - processed);
	m.queueDepth = queueDepth;

	if (hasNode('queue')) {
		updates.set('queue', {
			status:
				queueDepth > 50 ? 'error' : queueDepth > 20 ? 'warning' : 'active',
			metrics: { queueDepth, reqPerSec: newJobs },
		});
	}

	// Stripe: latency driven by user param
	if (hasNode('stripe')) {
		const stripeJitter = params.stripeLatency * 0.3 * Math.random();
		updates.set('stripe', {
			status: params.stripeLatency > 500 ? 'warning' : 'active',
			metrics: {
				latency: params.stripeLatency + stripeJitter,
				reqPerSec: Math.round(newJobs * 0.3),
			},
		});
	}

	// Global metrics
	const baseLatency = hasNode('cache')
		? 15 + (100 - effectiveCacheHitRate) * 0.5
		: 80;
	const totalLatency =
		baseLatency + effectiveDbLatency + (threadBackpressure ? 200 : 0);

	m.completedRequests += cdnHits + passedRateLimit - erroredRequests;
	m.avgLatency = totalLatency;
	m.p95Latency = totalLatency * 1.8;
	m.cacheHitRate = effectiveCacheHitRate;
	m.errorRate =
		m.totalRequests > 0
			? Math.round((m.failedRequests / m.totalRequests) * 1000) / 10
			: 0;
	m.reqPerSec = params.trafficRate;

	return { nodeUpdates: updates, metrics: m };
}
