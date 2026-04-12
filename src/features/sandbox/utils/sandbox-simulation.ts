/**
 * Sandbox Simulation Engine
 *
 * Tick-based simulation modeling a real production Rails stack.
 * Parameters reflect things you actually control in real life.
 * Metrics emerge from the architecture, not from sliders.
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

/** Things you actually control in a real project */
export interface SimParams {
	trafficRate: number;
	appServerCount: number;
	pumaThreadsPerServer: number;
	dbReplicaCount: number;
	rateLimitThreshold: number;
	queueWorkers: number;
	cacheTtlSeconds: number;
}

/** Chaos events that happen to you */
export interface ChaosState {
	stripeDown: boolean;
	dbLagSpike: boolean;
	ddosAttack: boolean;
	cacheFlush: boolean;
	replicaPartition: boolean;
}

export const DEFAULT_PARAMS: SimParams = {
	trafficRate: 100,
	appServerCount: 2,
	pumaThreadsPerServer: 5,
	dbReplicaCount: 1,
	rateLimitThreshold: 500,
	queueWorkers: 3,
	cacheTtlSeconds: 300,
};

export const DEFAULT_CHAOS: ChaosState = {
	stripeDown: false,
	dbLagSpike: false,
	ddosAttack: false,
	cacheFlush: false,
	replicaPartition: false,
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

// Internal: tracks cache warmth (0-100), grows over time with TTL
let cacheWarmth = 50;

export function resetCacheWarmth(): void {
	cacheWarmth = 50;
}

export function simulationTick(
	nodeDataMap: Map<string, SandboxNodeData>,
	metrics: SimMetrics,
	params: SimParams,
	chaos: ChaosState,
): { nodeUpdates: Map<string, Partial<SandboxNodeData>>; metrics: SimMetrics } {
	const updates = new Map<string, Partial<SandboxNodeData>>();
	const hasNode = (id: string) => nodeDataMap.has(id);

	// Effective traffic (DDoS multiplies it)
	const effectiveTraffic = chaos.ddosAttack
		? params.trafficRate * 10
		: params.trafficRate;
	const requestsThisTick = effectiveTraffic / 30;
	const newRequests =
		Math.random() < requestsThisTick
			? Math.ceil(requestsThisTick)
			: Math.floor(requestsThisTick);

	const m = { ...metrics };
	m.totalRequests += newRequests;

	// Users
	if (hasNode('users')) {
		updates.set('users', {
			status: chaos.ddosAttack ? 'error' : 'active',
			metrics: { reqPerSec: effectiveTraffic },
		});
	}

	// CDN: static assets (~40%)
	const cdnHits = Math.round(newRequests * 0.4);
	const dynamicRequests = newRequests - cdnHits;
	if (hasNode('cdn')) {
		updates.set('cdn', {
			status: 'active',
			metrics: {
				hitRate: 40 + Math.round(Math.random() * 5),
				reqPerSec: newRequests,
			},
		});
	}

	// Rate limiter
	const overThreshold = effectiveTraffic > params.rateLimitThreshold;
	const rateLimitPercent =
		hasNode('rate-limiter') && overThreshold
			? Math.min(
					90,
					((effectiveTraffic - params.rateLimitThreshold) /
						params.rateLimitThreshold) *
						100,
				)
			: 0;
	const rateLimited = Math.round(dynamicRequests * (rateLimitPercent / 100));
	const passedRequests = dynamicRequests - rateLimited;
	m.blockedByRateLimit += rateLimited;

	if (hasNode('rate-limiter')) {
		const rlRatio = effectiveTraffic / Math.max(1, params.rateLimitThreshold);
		updates.set('rate-limiter', {
			status:
				rlRatio > 3
					? 'critical'
					: rlRatio > 1.5
						? 'error'
						: overThreshold
							? 'warning'
							: 'active',
			metrics: {
				blockedCount: m.blockedByRateLimit,
				reqPerSec: dynamicRequests,
			},
		});
	}

	// Load balancer
	if (hasNode('lb')) {
		updates.set('lb', {
			status: 'active',
			metrics: { reqPerSec: passedRequests },
		});
	}

	// App servers: distribute evenly, threads are the bottleneck
	const reqPerServer = Math.ceil(
		passedRequests / Math.max(1, params.appServerCount),
	);
	const busyPerServer = Math.min(params.pumaThreadsPerServer, reqPerServer);
	const serversSaturated = reqPerServer > params.pumaThreadsPerServer;

	// Update app server nodes (app-1 and app-2 always exist, show based on count)
	for (let i = 1; i <= 2; i++) {
		const nodeId = `app-${i}`;
		if (hasNode(nodeId)) {
			const active = i <= params.appServerCount;
			const threadRatio =
				reqPerServer / Math.max(1, params.pumaThreadsPerServer);
			updates.set(nodeId, {
				status: !active
					? 'idle'
					: threadRatio > 2
						? 'critical'
						: serversSaturated
							? 'error'
							: busyPerServer >= params.pumaThreadsPerServer - 1
								? 'warning'
								: 'active',
				metrics: active
					? {
							threadsBusy: busyPerServer,
							threadsTotal: params.pumaThreadsPerServer,
							reqPerSec: reqPerServer,
						}
					: undefined,
			});
		}
	}

	// Cache: hit rate emerges from TTL and warmth (not directly controlled)
	if (chaos.cacheFlush) cacheWarmth = 0;
	// Warmth grows toward a ceiling based on TTL (higher TTL = higher ceiling)
	const ttlCeiling = Math.min(95, 40 + params.cacheTtlSeconds / 10);
	cacheWarmth = cacheWarmth + (ttlCeiling - cacheWarmth) * 0.02;
	const effectiveCacheHitRate = hasNode('cache')
		? Math.round(cacheWarmth + Math.random() * 3 - 1.5)
		: 0;
	const cacheMisses = Math.round(
		passedRequests * ((100 - effectiveCacheHitRate) / 100),
	);

	if (hasNode('cache')) {
		updates.set('cache', {
			status:
				effectiveCacheHitRate < 10
					? 'critical'
					: effectiveCacheHitRate < 30
						? 'warning'
						: 'active',
			metrics: { hitRate: effectiveCacheHitRate, reqPerSec: passedRequests },
		});
	}

	// Database: latency emerges from load (cache misses) and chaos
	const dbQueries = cacheMisses + Math.round(newRequests * 0.1);
	m.dbQueryCount += dbQueries;
	const baseDbLatency = 5 + Math.random() * 10;
	const loadMultiplier = dbQueries > 15 ? 3 : dbQueries > 8 ? 1.5 : 1;
	const chaosMultiplier = chaos.dbLagSpike ? 10 : 1;
	const effectiveDbLatency = baseDbLatency * loadMultiplier * chaosMultiplier;

	if (hasNode('db-primary')) {
		const dbStress =
			effectiveDbLatency > 100 || (chaos.dbLagSpike && dbQueries > 10);
		updates.set('db-primary', {
			status: dbStress
				? 'critical'
				: chaos.dbLagSpike
					? 'error'
					: dbQueries > 15
						? 'error'
						: dbQueries > 8
							? 'warning'
							: 'active',
			metrics: { queryCount: dbQueries, latency: effectiveDbLatency },
		});
	}

	// DB Replica: offloads reads if available and not partitioned
	const replicaActive = params.dbReplicaCount > 0 && !chaos.replicaPartition;
	if (hasNode('db-replica')) {
		const replicaQueries = replicaActive ? Math.round(cacheMisses * 0.6) : 0;
		updates.set('db-replica', {
			status: chaos.replicaPartition
				? 'error'
				: replicaActive
					? 'active'
					: 'idle',
			metrics: replicaActive
				? { queryCount: replicaQueries, latency: effectiveDbLatency * 1.1 }
				: undefined,
		});
	}

	// Errors: emerge from overload, not from a slider
	const threadOverflow = serversSaturated
		? Math.round(
				((reqPerServer - params.pumaThreadsPerServer) /
					params.pumaThreadsPerServer) *
					30,
			)
		: 0;
	const dbErrors = chaos.dbLagSpike ? 5 : 0;
	const naturalErrorPercent = Math.min(80, threadOverflow + dbErrors);
	const erroredRequests = Math.round(newRequests * (naturalErrorPercent / 100));
	m.failedRequests += erroredRequests;

	// Queue: depth grows based on incoming jobs vs worker capacity
	const newJobs = Math.round(newRequests * 0.1);
	const processed = Math.min(m.queueDepth + newJobs, params.queueWorkers);
	const queueDepth = Math.max(0, (m.queueDepth || 0) + newJobs - processed);
	m.queueDepth = queueDepth;

	if (hasNode('queue')) {
		updates.set('queue', {
			status:
				queueDepth > 100
					? 'critical'
					: queueDepth > 50
						? 'error'
						: queueDepth > 20
							? 'warning'
							: 'active',
			metrics: { queueDepth, reqPerSec: newJobs },
		});
	}

	// Stripe: latency and availability based on chaos
	if (hasNode('stripe')) {
		const stripeLatency = chaos.stripeDown ? 30000 : 200 + Math.random() * 100;
		updates.set('stripe', {
			status: chaos.stripeDown ? 'critical' : 'active',
			metrics: {
				latency: stripeLatency,
				reqPerSec: chaos.stripeDown ? 0 : Math.round(newJobs * 0.3),
			},
		});
	}

	// Global metrics (all emergent)
	const cacheBonus = hasNode('cache')
		? (100 - effectiveCacheHitRate) * 0.5
		: 50;
	const totalLatency =
		10 + cacheBonus + effectiveDbLatency + (serversSaturated ? 200 : 0);

	m.completedRequests += cdnHits + passedRequests - erroredRequests;
	m.avgLatency = totalLatency;
	m.p95Latency = totalLatency * 1.8;
	m.cacheHitRate = effectiveCacheHitRate;
	m.errorRate =
		m.totalRequests > 0
			? Math.round((m.failedRequests / m.totalRequests) * 1000) / 10
			: 0;
	m.reqPerSec = effectiveTraffic;

	return { nodeUpdates: updates, metrics: m };
}
