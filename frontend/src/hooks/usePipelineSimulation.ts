/**
 * Pipeline Simulation Hook
 *
 * Orchestrates the simulation loop: metrics, particles, and incidents.
 * Pure logic lives in src/engine/.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
	createIncident,
	generateRandomIncident,
} from '@/components/inspector/IncidentFeed';
import type {
	Connection,
	GameState,
	Incident,
	LiveMetrics,
	PlacedNode,
	QueryParticle,
} from '@/types';
import {
	calculateMemoryUsage,
	calculatePathLatency,
	detectNPlusOnePattern,
	findCriticalPath,
	getParticleConfig,
} from '@/utils/nodeBehavior';

export interface UsePipelineSimulationReturn {
	simulationRunning: boolean;
	setSimulationRunning: React.Dispatch<React.SetStateAction<boolean>>;
	liveMetrics: LiveMetrics;
	setLiveMetrics: React.Dispatch<React.SetStateAction<LiveMetrics>>;
	queryParticles: QueryParticle[];
	incidents: Incident[];
	clearIncidents: () => void;
}

// Calculate metrics based on pipeline structure
function calculatePipelineMetrics(
	nodes: PlacedNode[],
	connections: Connection[],
	hasSolutionNode: boolean,
	solutionNodeType: string,
): LiveMetrics {
	const path = findCriticalPath(nodes, connections);
	const pathTypes = path.map(
		(id) => nodes.find((n) => n.id === id)?.type || 'unknown',
	);

	let baseLatency = calculatePathLatency(pathTypes);

	const nPlusOneResult = detectNPlusOnePattern(
		nodes.map((n) => ({ type: n.type, id: n.id })),
		connections.map((c) => ({
			sourceId: c.sourceNodeId,
			targetId: c.targetNodeId,
		})),
	);

	const queryCount = 0;
	let queriesPerRequest = 1;

	const modelNodes = nodes.filter((n) => n.type === 'model');
	const hasEagerLoad = nodes.some((n) => n.type === 'eager_load');
	const hasCache = nodes.some((n) => n.type === 'cache');
	const hasIndex = nodes.some((n) => n.type === 'index');

	if (nPlusOneResult.hasNPlusOne && !hasEagerLoad) {
		queriesPerRequest = 50 + Math.floor(Math.random() * 50);
		baseLatency += queriesPerRequest * 20;
	} else if (hasEagerLoad) {
		queriesPerRequest = 2;
	} else {
		queriesPerRequest = modelNodes.length;
	}

	if (hasIndex) {
		baseLatency = Math.max(10, baseLatency * 0.1);
	}

	if (hasCache) {
		baseLatency = Math.max(5, baseLatency * 0.1);
		queriesPerRequest = Math.max(0, queriesPerRequest - 1);
	}

	if (hasSolutionNode) {
		switch (solutionNodeType) {
			case 'eager_load':
				queriesPerRequest = 2;
				baseLatency = Math.min(baseLatency, 100);
				break;
			case 'index':
				baseLatency = Math.min(baseLatency, 50);
				break;
			case 'cache':
				baseLatency = Math.min(baseLatency, 30);
				queriesPerRequest = Math.max(1, queriesPerRequest - 2);
				break;
		}
	}

	const latency = baseLatency + (Math.random() - 0.5) * baseLatency * 0.2;
	const memoryUsage = calculateMemoryUsage(nodes);
	const cpuLoad = Math.min(100, 10 + queriesPerRequest * 2 + latency / 100);
	const dbLoad = Math.min(
		100,
		queriesPerRequest * 5 + (nPlusOneResult.hasNPlusOne ? 50 : 0),
	);

	return {
		queryCount,
		latency: Math.round(latency),
		cpuLoad: Math.round(cpuLoad),
		dbLoad: Math.round(dbLoad),
		queriesPerRequest,
		cacheHitRate: hasCache ? 85 + Math.random() * 10 : 0,
		errorRate: dbLoad > 90 ? 5 + Math.random() * 10 : 0,
		memoryUsage: memoryUsage,
	};
}

export function usePipelineSimulation(
	gameState: GameState,
	placedNodes: PlacedNode[],
	connections: Connection[],
	isPipelineBroken: boolean,
	hasSolutionNode: boolean,
	solutionNodeType?: 'eager_load' | 'index' | 'cache' | 'multiple',
): UsePipelineSimulationReturn {
	const [simulationRunning, setSimulationRunning] = useState(true);
	const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>({
		queryCount: 0,
		latency: 0,
		cpuLoad: 0,
		dbLoad: 0,
	});
	const [queryParticles, setQueryParticles] = useState<QueryParticle[]>([]);
	const [incidents, setIncidents] = useState<Incident[]>([]);
	const particleIdRef = useRef(0);
	const lastIncidentTimeRef = useRef(0);

	const clearIncidents = useCallback(() => {
		setIncidents([]);
	}, []);

	useEffect(() => {
		if (gameState !== 'playing' || !simulationRunning) return;

		if (isPipelineBroken) {
			setLiveMetrics({
				queryCount: 0,
				latency: 0,
				cpuLoad: 5,
				dbLoad: 0,
			});
			setQueryParticles([]);
			return;
		}

		const dbNode = placedNodes.find((n) => n.type === 'database');
		if (!dbNode) return;

		const baseMetrics = calculatePipelineMetrics(
			placedNodes,
			connections,
			hasSolutionNode,
			solutionNodeType ?? '',
		);

		// Non-performance levels: no particles, just metrics
		const config = getParticleConfig(solutionNodeType, hasSolutionNode);
		if (!config) {
			setLiveMetrics(baseMetrics);
			setQueryParticles([]);
			return;
		}

		// Find connections to database for particle visualization
		const connectionsToDb = connections.filter((c) => {
			const target = placedNodes.find((n) => n.id === c.targetNodeId);
			return target?.type === 'database';
		});

		const spawnInterval = setInterval(() => {
			const newParticles: QueryParticle[] = [];

			for (const conn of connectionsToDb) {
				const sourceNode = placedNodes.find((n) => n.id === conn.sourceNodeId);
				if (!sourceNode) continue;

				const particleCount = Math.ceil(
					config.particleCount / Math.max(1, connectionsToDb.length),
				);

				for (let i = 0; i < particleCount; i++) {
					newParticles.push({
						id: particleIdRef.current++,
						x: sourceNode.x + (Math.random() - 0.5) * 30,
						y: sourceNode.y + (Math.random() - 0.5) * 30,
						targetX: dbNode.x + (Math.random() - 0.5) * 40,
						targetY: dbNode.y + (Math.random() - 0.5) * 40,
						progress: 0,
						type: 'query',
					});
				}
			}

			if (hasSolutionNode && solutionNodeType === 'cache') {
				const cacheNode = placedNodes.find((n) => n.type === 'cache');
				const modelNode = placedNodes.find((n) => n.type === 'model');
				if (cacheNode && modelNode) {
					for (let i = 0; i < 2; i++) {
						newParticles.push({
							id: particleIdRef.current++,
							x: modelNode.x + (Math.random() - 0.5) * 30,
							y: modelNode.y + (Math.random() - 0.5) * 30,
							targetX: cacheNode.x + (Math.random() - 0.5) * 40,
							targetY: cacheNode.y + (Math.random() - 0.5) * 40,
							progress: 0,
							type: 'cache_hit',
							color: '#22c55e',
						});
					}
				}
			}

			if (newParticles.length > 0) {
				setQueryParticles((prev) => [...prev.slice(-80), ...newParticles]);
			}

			setLiveMetrics((prev) => ({
				...baseMetrics,
				queryCount: prev.queryCount + (baseMetrics.queriesPerRequest || 1),
				latency: baseMetrics.latency + (Math.random() - 0.5) * 50,
				cpuLoad: baseMetrics.cpuLoad + (Math.random() - 0.5) * 5,
				dbLoad: baseMetrics.dbLoad + (Math.random() - 0.5) * 5,
			}));

			// Generate incidents based on metrics
			const now = Date.now();
			if (now - lastIncidentTimeRef.current > 2000) {
				const nPlusOneResult = detectNPlusOnePattern(
					placedNodes.map((n) => ({ type: n.type, id: n.id })),
					connections.map((c) => ({
						sourceId: c.sourceNodeId,
						targetId: c.targetNodeId,
					})),
				);

				if (nPlusOneResult.hasNPlusOne && !hasSolutionNode) {
					setIncidents((prev) => [
						...prev.slice(-49),
						createIncident(
							'n_plus_one_detected',
							`N+1 detected: ${nPlusOneResult.affectedNodes.length} model queries without eager loading`,
							'error',
							nPlusOneResult.affectedNodes,
						),
					]);
					lastIncidentTimeRef.current = now;
				} else if (baseMetrics.latency > 1000) {
					setIncidents((prev) => [
						...prev.slice(-49),
						createIncident(
							'slow_query',
							`Slow response: ${baseMetrics.latency}ms (threshold: 1000ms)`,
							'warning',
						),
					]);
					lastIncidentTimeRef.current = now;
				} else if (Math.random() < 0.1) {
					setIncidents((prev) => [
						...prev.slice(-49),
						generateRandomIncident(),
					]);
					lastIncidentTimeRef.current = now;
				}
			}
		}, config.spawnRate);

		const animationInterval = setInterval(() => {
			setQueryParticles((prev) =>
				prev
					.map((p) => ({
						...p,
						progress: p.progress + config.speed,
						x: p.x + (p.targetX - p.x) * config.speed,
						y: p.y + (p.targetY - p.y) * config.speed,
					}))
					.filter((p) => p.progress < 1),
			);
		}, 50);

		return () => {
			clearInterval(spawnInterval);
			clearInterval(animationInterval);
		};
	}, [
		gameState,
		simulationRunning,
		hasSolutionNode,
		solutionNodeType,
		placedNodes,
		connections,
		isPipelineBroken,
	]);

	return {
		simulationRunning,
		setSimulationRunning,
		liveMetrics,
		setLiveMetrics,
		queryParticles,
		incidents,
		clearIncidents,
	};
}
