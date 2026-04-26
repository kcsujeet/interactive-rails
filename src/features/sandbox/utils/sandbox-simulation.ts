/**
 * Sandbox Simulation Engine
 *
 * Models realistic cascading failures in a production Rails stack.
 * Every metric is emergent from architecture choices and chaos events.
 * Failures cascade: cache miss -> DB stress -> thread starvation -> errors.
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

export interface SimParams {
	trafficRate: number;
	appServerCount: number;
	pumaThreadsPerServer: number;
	dbReplicaCount: number;
	rateLimitThreshold: number;
	queueWorkers: number;
	cacheTtlSeconds: number;
}

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

let cacheWarmth = 50;

export function resetCacheWarmth(): void {
	cacheWarmth = 50;
}

type Status = 'idle' | 'active' | 'warning' | 'error' | 'critical';

function statusFromLoad(
	load: number,
	warnAt: number,
	errorAt: number,
	criticalAt: number,
): Status {
	if (load >= criticalAt) return 'critical';
	if (load >= errorAt) return 'error';
	if (load >= warnAt) return 'warning';
	return 'active';
}

export function simulationTick(
	nodeDataMap: Map<string, SandboxNodeData>,
	metrics: SimMetrics,
	params: SimParams,
	chaos: ChaosState,
): { nodeUpdates: Map<string, Partial<SandboxNodeData>>; metrics: SimMetrics } {
	const updates = new Map<string, Partial<SandboxNodeData>>();
	const hasNode = (id: string) => nodeDataMap.has(id);
	const m = { ...metrics };

	// ── Traffic ──
	const effectiveTraffic = chaos.ddosAttack
		? params.trafficRate * 10
		: params.trafficRate;
	const requestsThisTick = effectiveTraffic / 30;
	const newRequests =
		Math.random() < requestsThisTick % 1
			? Math.ceil(requestsThisTick)
			: Math.floor(requestsThisTick);
	m.totalRequests += newRequests;

	if (hasNode('users')) {
		updates.set('users', {
			status: chaos.ddosAttack ? 'critical' : 'active',
			metrics: { reqPerSec: effectiveTraffic },
		});
	}

	// ── CDN ── (serves ~40% static assets)
	const cdnHitRate = 40 + Math.round(Math.random() * 5);
	const cdnHits = Math.round(newRequests * (cdnHitRate / 100));
	const dynamicRequests = newRequests - cdnHits;

	if (hasNode('cdn')) {
		updates.set('cdn', {
			status: 'active',
			metrics: { hitRate: cdnHitRate, reqPerSec: newRequests },
		});
	}

	// ── Rate Limiter ──
	const overThreshold = effectiveTraffic > params.rateLimitThreshold;
	const rlOverflow = overThreshold
		? (effectiveTraffic - params.rateLimitThreshold) / params.rateLimitThreshold
		: 0;
	const rateLimitPercent = hasNode('rate-limiter')
		? Math.min(90, rlOverflow * 100)
		: 0;
	const rateLimited = Math.round(dynamicRequests * (rateLimitPercent / 100));
	const passedRequests = dynamicRequests - rateLimited;
	m.blockedByRateLimit += rateLimited;

	if (hasNode('rate-limiter')) {
		updates.set('rate-limiter', {
			status: statusFromLoad(rlOverflow, 0.3, 1.0, 2.0),
			metrics: {
				blockedCount: m.blockedByRateLimit,
				reqPerSec: dynamicRequests,
			},
		});
	}

	// ── Load Balancer ──
	if (hasNode('lb')) {
		updates.set('lb', {
			status: passedRequests > params.rateLimitThreshold ? 'warning' : 'active',
			metrics: { reqPerSec: passedRequests },
		});
	}

	// ── Cache ── (hit rate emerges from TTL and warmth)
	if (chaos.cacheFlush) cacheWarmth = 0;
	const ttlCeiling = Math.min(95, 40 + params.cacheTtlSeconds / 10);
	cacheWarmth = cacheWarmth + (ttlCeiling - cacheWarmth) * 0.02;
	const effectiveCacheHitRate = hasNode('cache')
		? Math.max(0, Math.round(cacheWarmth + Math.random() * 3 - 1.5))
		: 0;
	const cacheMisses = Math.round(
		passedRequests * ((100 - effectiveCacheHitRate) / 100),
	);

	if (hasNode('cache')) {
		updates.set('cache', {
			status: statusFromLoad(100 - effectiveCacheHitRate, 60, 80, 95),
			metrics: { hitRate: effectiveCacheHitRate, reqPerSec: passedRequests },
		});
	}

	// ── Database ── (load driven by cache misses + writes)
	// Replica partition: all reads go to primary, doubling its load
	const replicaActive = params.dbReplicaCount > 0 && !chaos.replicaPartition;
	const replicaOffloadFactor = replicaActive ? 0.4 : 0; // replica handles 40% of reads
	const primaryQueries =
		Math.round(cacheMisses * (1 - replicaOffloadFactor)) +
		Math.round(newRequests * 0.1);
	const replicaQueries = replicaActive
		? Math.round(cacheMisses * replicaOffloadFactor)
		: 0;
	m.dbQueryCount += primaryQueries + replicaQueries;

	const baseDbLatency = 5 + Math.random() * 5;
	const queryLoadMultiplier =
		primaryQueries > 20
			? 4
			: primaryQueries > 10
				? 2
				: primaryQueries > 5
					? 1.3
					: 1;
	const chaosDbMultiplier = chaos.dbLagSpike ? 10 : 1;
	const effectiveDbLatency =
		baseDbLatency * queryLoadMultiplier * chaosDbMultiplier;

	if (hasNode('db-primary')) {
		// DB stress comes from: query volume, cache miss ratio, and chaos
		const cacheMissRatio =
			passedRequests > 0 ? cacheMisses / passedRequests : 0;
		const dbLoad = Math.max(
			(primaryQueries / 10) * chaosDbMultiplier, // absolute query pressure
			cacheMissRatio * 1.5 * chaosDbMultiplier, // cache miss pressure (0-1.5)
		);
		updates.set('db-primary', {
			status: statusFromLoad(dbLoad, 0.5, 1.0, 1.5),
			metrics: { queryCount: primaryQueries, latency: effectiveDbLatency },
		});
	}

	if (hasNode('db-replica')) {
		updates.set('db-replica', {
			status: chaos.replicaPartition
				? 'critical'
				: replicaActive
					? 'active'
					: 'idle',
			metrics: replicaActive
				? { queryCount: replicaQueries, latency: effectiveDbLatency * 1.1 }
				: undefined,
		});
	}

	// ── App Servers ── (threads block on slow DB and Stripe)
	// Thread starvation: slow DB means threads hold longer, reducing effective capacity
	const dbLatencyFactor = Math.max(1, effectiveDbLatency / 15); // >15ms starts reducing capacity
	// Stripe down: payment threads hang for 30s, consuming threads
	const stripeHangingThreads = chaos.stripeDown
		? Math.min(2, params.pumaThreadsPerServer)
		: 0;
	const effectiveThreadsPerServer = Math.max(
		1,
		Math.round(params.pumaThreadsPerServer / dbLatencyFactor) -
			stripeHangingThreads,
	);
	const _totalEffectiveThreads =
		params.appServerCount * effectiveThreadsPerServer;
	const reqPerServer = Math.ceil(
		passedRequests / Math.max(1, params.appServerCount),
	);
	const busyPerServer = Math.min(effectiveThreadsPerServer, reqPerServer);
	const serversSaturated = reqPerServer > effectiveThreadsPerServer;
	const threadLoad = reqPerServer / Math.max(1, effectiveThreadsPerServer);

	for (let i = 1; i <= 2; i++) {
		const nodeId = `app-${i}`;
		if (hasNode(nodeId)) {
			const active = i <= params.appServerCount;
			updates.set(nodeId, {
				status: !active ? 'idle' : statusFromLoad(threadLoad, 0.7, 1.0, 1.5),
				metrics: active
					? {
							threadsBusy: busyPerServer,
							threadsTotal: effectiveThreadsPerServer,
							reqPerSec: reqPerServer,
						}
					: undefined,
			});
		}
	}

	// ── Errors ── (emerge from thread saturation and DB failures)
	const overflowErrors = serversSaturated
		? Math.round(
				((reqPerServer - effectiveThreadsPerServer) /
					effectiveThreadsPerServer) *
					40,
			)
		: 0;
	const dbTimeoutErrors =
		effectiveDbLatency > 100 ? 10 : effectiveDbLatency > 50 ? 3 : 0;
	const stripeErrors = chaos.stripeDown ? 5 : 0;
	const naturalErrorPercent = Math.min(
		90,
		overflowErrors + dbTimeoutErrors + stripeErrors,
	);
	const erroredRequests = Math.round(newRequests * (naturalErrorPercent / 100));
	m.failedRequests += erroredRequests;

	// ── Queue ── (depth grows; slow DB means jobs take longer too)
	const newJobs = Math.round(newRequests * 0.1);
	const effectiveQueueProcessing = Math.max(
		1,
		Math.round(params.queueWorkers / Math.max(1, effectiveDbLatency / 20)),
	);
	const processed = Math.min(m.queueDepth + newJobs, effectiveQueueProcessing);
	const queueDepth = Math.max(0, (m.queueDepth || 0) + newJobs - processed);
	m.queueDepth = queueDepth;

	if (hasNode('queue')) {
		updates.set('queue', {
			status: statusFromLoad(queueDepth, 15, 40, 80),
			metrics: { queueDepth, reqPerSec: newJobs },
		});
	}

	// ── Stripe ──
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

	// ── Global metrics (all emergent) ──
	const cacheLatencyContrib = hasNode('cache')
		? (100 - effectiveCacheHitRate) * 0.5
		: 50;
	const threadQueueLatency = serversSaturated ? (threadLoad - 1) * 300 : 0;
	const totalLatency =
		10 + cacheLatencyContrib + effectiveDbLatency + threadQueueLatency;

	m.completedRequests += Math.max(
		0,
		cdnHits + passedRequests - erroredRequests,
	);
	m.avgLatency = totalLatency;
	m.p95Latency = totalLatency * (1.5 + (serversSaturated ? 1.5 : 0));
	m.cacheHitRate = effectiveCacheHitRate;
	m.errorRate =
		m.totalRequests > 0
			? Math.round((m.failedRequests / m.totalRequests) * 1000) / 10
			: 0;
	m.reqPerSec = effectiveTraffic;

	return { nodeUpdates: updates, metrics: m };
}
