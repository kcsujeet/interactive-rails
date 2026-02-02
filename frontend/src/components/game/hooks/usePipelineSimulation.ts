/**
 * Pipeline Simulation Hook
 *
 * Real simulation engine that calculates metrics based on pipeline structure.
 * Uses node behavior definitions to determine latency, query counts, etc.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlacedNode, Connection, LiveMetrics, QueryParticle, GameState, Incident } from '../types';
import {
  NODE_BEHAVIORS,
  calculatePathLatency,
  detectNPlusOnePattern,
  calculateMemoryUsage,
} from '../../../engine/nodeBehavior';
import { createIncident, generateRandomIncident } from '../../inspector/IncidentFeed';

export interface UsePipelineSimulationReturn {
  simulationRunning: boolean;
  setSimulationRunning: React.Dispatch<React.SetStateAction<boolean>>;
  liveMetrics: LiveMetrics;
  setLiveMetrics: React.Dispatch<React.SetStateAction<LiveMetrics>>;
  queryParticles: QueryParticle[];
  incidents: Incident[];
  clearIncidents: () => void;
}

// Calculate the critical path through the pipeline
function findCriticalPath(nodes: PlacedNode[], connections: Connection[]): string[] {
  // Find start node (request) and end node (response)
  const startNode = nodes.find(n => n.type === 'request');
  const endNode = nodes.find(n => n.type === 'response');

  if (!startNode || !endNode) return [];

  // Build adjacency list
  const adjacency: Record<string, string[]> = {};
  for (const node of nodes) {
    adjacency[node.id] = [];
  }
  for (const conn of connections) {
    adjacency[conn.sourceNodeId]?.push(conn.targetNodeId);
  }

  // BFS to find path from start to end
  const queue: Array<{ nodeId: string; path: string[] }> = [
    { nodeId: startNode.id, path: [startNode.id] }
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;

    if (nodeId === endNode.id) {
      return path;
    }

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    for (const nextId of adjacency[nodeId] || []) {
      if (!visited.has(nextId)) {
        queue.push({ nodeId: nextId, path: [...path, nextId] });
      }
    }
  }

  return [];
}

// Calculate metrics based on pipeline structure
function calculatePipelineMetrics(
  nodes: PlacedNode[],
  connections: Connection[],
  hasSolutionNode: boolean,
  solutionNodeType: string,
): LiveMetrics {
  // Find the path through the pipeline
  const path = findCriticalPath(nodes, connections);
  const pathTypes = path.map(id => nodes.find(n => n.id === id)?.type || 'unknown');

  // Calculate base latency from path
  let baseLatency = calculatePathLatency(pathTypes);

  // Detect N+1 patterns
  const nPlusOneResult = detectNPlusOnePattern(
    nodes.map(n => ({ type: n.type, id: n.id })),
    connections.map(c => ({ sourceId: c.sourceNodeId, targetId: c.targetNodeId }))
  );

  // Count queries
  let queryCount = 0;
  let queriesPerRequest = 1;

  // Each model->database connection without eager load = potential N+1
  const modelNodes = nodes.filter(n => n.type === 'model');
  const hasEagerLoad = nodes.some(n => n.type === 'eager_load');
  const hasCache = nodes.some(n => n.type === 'cache');
  const hasIndex = nodes.some(n => n.type === 'index');

  if (nPlusOneResult.hasNPlusOne && !hasEagerLoad) {
    // Simulate N+1: 1 base query + N queries for associations
    queriesPerRequest = 50 + Math.floor(Math.random() * 50); // 50-100 queries
    baseLatency += queriesPerRequest * 20; // 20ms per extra query
  } else if (hasEagerLoad) {
    queriesPerRequest = 2; // Just the base query + 1 includes query
  } else {
    queriesPerRequest = modelNodes.length;
  }

  // Index reduces query latency
  if (hasIndex) {
    baseLatency = Math.max(10, baseLatency * 0.1);
  }

  // Cache reduces everything after first request
  if (hasCache) {
    baseLatency = Math.max(5, baseLatency * 0.1);
    queriesPerRequest = Math.max(0, queriesPerRequest - 1);
  }

  // Apply solution node effects
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

  // Add some randomness
  const latency = baseLatency + (Math.random() - 0.5) * baseLatency * 0.2;

  // Calculate memory usage
  const memoryUsage = calculateMemoryUsage(nodes);

  // Calculate loads based on query count and latency
  const cpuLoad = Math.min(100, 10 + queriesPerRequest * 2 + latency / 100);
  const dbLoad = Math.min(100, queriesPerRequest * 5 + (nPlusOneResult.hasNPlusOne ? 50 : 0));

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
  solutionNodeType: 'eager_load' | 'index' | 'cache' | 'multiple' = 'eager_load'
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

    const dbNode = placedNodes.find(n => n.type === 'database');
    if (!dbNode) return;

    // Calculate metrics based on pipeline structure
    const baseMetrics = calculatePipelineMetrics(
      placedNodes,
      connections,
      hasSolutionNode,
      solutionNodeType
    );

    // Configuration based on solution state
    const getParticleConfig = () => {
      if (hasSolutionNode) {
        return { particleCount: 1, spawnRate: 1000, speed: 0.08 };
      }

      switch (solutionNodeType) {
        case 'eager_load':
          return { particleCount: 15, spawnRate: 300, speed: 0.15 };
        case 'index':
          return { particleCount: 1, spawnRate: 800, speed: 0.03 };
        case 'cache':
          return { particleCount: 3, spawnRate: 500, speed: 0.12 };
        case 'multiple':
          return { particleCount: 10, spawnRate: 250, speed: 0.15 };
        default:
          return { particleCount: 5, spawnRate: 400, speed: 0.1 };
      }
    };

    const config = getParticleConfig();

    // Find connections to database for particle visualization
    const connectionsToDb = connections.filter(c => {
      const target = placedNodes.find(n => n.id === c.targetNodeId);
      return target?.type === 'database';
    });

    const spawnInterval = setInterval(() => {
      const newParticles: QueryParticle[] = [];

      // Spawn particles along database connections
      for (const conn of connectionsToDb) {
        const sourceNode = placedNodes.find(n => n.id === conn.sourceNodeId);
        if (!sourceNode) continue;

        const particleCount = Math.ceil(config.particleCount / Math.max(1, connectionsToDb.length));

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

      // Also spawn cache hit particles if cache exists
      if (hasSolutionNode && solutionNodeType === 'cache') {
        const cacheNode = placedNodes.find(n => n.type === 'cache');
        const modelNode = placedNodes.find(n => n.type === 'model');
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
        setQueryParticles(prev => [...prev.slice(-80), ...newParticles]);
      }

      // Update metrics with some variation
      setLiveMetrics(prev => ({
        ...baseMetrics,
        queryCount: prev.queryCount + (baseMetrics.queriesPerRequest || 1),
        latency: baseMetrics.latency + (Math.random() - 0.5) * 50,
        cpuLoad: baseMetrics.cpuLoad + (Math.random() - 0.5) * 5,
        dbLoad: baseMetrics.dbLoad + (Math.random() - 0.5) * 5,
      }));

      // Generate incidents based on metrics
      const now = Date.now();
      if (now - lastIncidentTimeRef.current > 2000) {
        // Check for N+1
        const nPlusOneResult = detectNPlusOnePattern(
          placedNodes.map(n => ({ type: n.type, id: n.id })),
          connections.map(c => ({ sourceId: c.sourceNodeId, targetId: c.targetNodeId }))
        );

        if (nPlusOneResult.hasNPlusOne && !hasSolutionNode) {
          setIncidents(prev => [
            ...prev.slice(-49),
            createIncident(
              'n_plus_one_detected',
              `N+1 detected: ${nPlusOneResult.affectedNodes.length} model queries without eager loading`,
              'error',
              nPlusOneResult.affectedNodes
            ),
          ]);
          lastIncidentTimeRef.current = now;
        } else if (baseMetrics.latency > 1000) {
          setIncidents(prev => [
            ...prev.slice(-49),
            createIncident(
              'slow_query',
              `Slow response: ${baseMetrics.latency}ms (threshold: 1000ms)`,
              'warning'
            ),
          ]);
          lastIncidentTimeRef.current = now;
        } else if (Math.random() < 0.1) {
          // Random incidents for variety
          setIncidents(prev => [...prev.slice(-49), generateRandomIncident()]);
          lastIncidentTimeRef.current = now;
        }
      }
    }, config.spawnRate);

    const animationInterval = setInterval(() => {
      setQueryParticles(prev =>
        prev
          .map(p => ({
            ...p,
            progress: p.progress + config.speed,
            x: p.x + (p.targetX - p.x) * config.speed,
            y: p.y + (p.targetY - p.y) * config.speed,
          }))
          .filter(p => p.progress < 1)
      );
    }, 50);

    return () => {
      clearInterval(spawnInterval);
      clearInterval(animationInterval);
    };
  }, [gameState, simulationRunning, hasSolutionNode, solutionNodeType, placedNodes, connections, isPipelineBroken]);

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
