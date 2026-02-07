/**
 * SimulationEngine
 *
 * Core tick-based simulation loop that processes the pipeline state.
 * All functions are pure - they take state and return new state.
 */

import type {
	Defense,
	Enemy,
	EnemyType,
	PipelineEdge,
	PipelineNode,
	Position,
	SimulationMetrics,
} from "@/stores";

// ============================================
// Types
// ============================================

export interface SimulationState {
	tick: number;
	elapsedTime: number;
	tickRate: number;
	nodes: PipelineNode[];
	edges: PipelineEdge[];
	metrics: SimulationMetrics;
	enemies: Enemy[];
	defenses: Defense[];
	stabilityScore: number;
	stabilityHistory: number[];
	objectiveProgress: number;
	objectiveMet: boolean;
}

export interface SimulationConfig {
	tickRate: number;
	requestsPerSecond: number;
	baseLatencyMs: number;
	queryLatencyMs: number;
	cacheLatencyMs: number;
	enemySpawnRate: number;
	stabilityThreshold: number;
	stabilityDuration: number;
}

// ============================================
// Constants
// ============================================

const ENEMY_STATS: Record<
	EnemyType,
	{ hp: number; damage: number; speed: number }
> = {
	query_swarm: { hp: 20, damage: 5, speed: 2 },
	memory_blob: { hp: 100, damage: 2, speed: 0.5 },
	callback_chain: { hp: 40, damage: 10, speed: 1.5 },
	timeout_wraith: { hp: 60, damage: 15, speed: 0.3 },
	error_spike: { hp: 30, damage: 25, speed: 3 },
	cache_phantom: { hp: 50, damage: 8, speed: 2 },
};

const DEFAULT_CONFIG: SimulationConfig = {
	tickRate: 60,
	requestsPerSecond: 10,
	baseLatencyMs: 10,
	queryLatencyMs: 50,
	cacheLatencyMs: 5,
	enemySpawnRate: 0.02,
	stabilityThreshold: 80,
	stabilityDuration: 300,
};

// ============================================
// Pure Functions - Metrics
// ============================================

export function calculateStabilityScore(metrics: SimulationMetrics): number {
	let score = 100;

	// Latency penalties
	if (metrics.latency.p95 > 500) score -= 20;
	else if (metrics.latency.p95 > 200) score -= 10;
	else if (metrics.latency.p95 > 100) score -= 5;

	// Query count penalties
	if (metrics.queries.perRequest > 20) score -= 25;
	else if (metrics.queries.perRequest > 10) score -= 15;
	else if (metrics.queries.perRequest > 5) score -= 5;

	// N+1 penalties
	if (metrics.queries.nPlusOneCount > 0) {
		score -= Math.min(30, metrics.queries.nPlusOneCount * 5);
	}

	// Error rate penalties
	if (metrics.errors.rate > 10) score -= 25;
	else if (metrics.errors.rate > 5) score -= 15;
	else if (metrics.errors.rate > 1) score -= 5;

	// Memory pressure penalties
	switch (metrics.memory.pressure) {
		case 'critical':
			score -= 20;
			break;
		case 'high':
			score -= 10;
			break;
		case 'medium':
			score -= 5;
			break;
	}

	// Cache hit rate bonus
	if (metrics.cache.hitRate >= 90) score += 5;
	else if (metrics.cache.hitRate < 50 && metrics.cache.size > 0) score -= 10;

	return Math.max(0, Math.min(100, score));
}

export function calculateStabilityTrend(
	history: number[],
): 'improving' | 'stable' | 'degrading' {
	if (history.length < 10) return 'stable';

	const recent = history.slice(-5);
	const older = history.slice(-10, -5);

	const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
	const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

	const diff = recentAvg - olderAvg;
	if (diff > 5) return 'improving';
	if (diff < -5) return 'degrading';
	return 'stable';
}

export function detectNPlusOne(
	nodes: PipelineNode[],
	edges: PipelineEdge[],
): number {
	let count = 0;
	const modelNodes = nodes.filter((n) => n.data.nodeType === 'model');
	const cacheNodes = nodes.filter((n) => n.data.nodeType === 'cache');

	for (const model of modelNodes) {
		const hasCache = edges.some(
			(e) => e.source === model.id && cacheNodes.some((c) => c.id === e.target),
		);
		if (!hasCache && (model.data.metrics?.queryCount || 0) > 1) {
			count += (model.data.metrics?.queryCount || 1) - 1;
		}
	}

	return count;
}

// ============================================
// Pure Functions - Enemy Management
// ============================================

function generateId(): string {
	return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function shouldSpawnEnemy(
	metrics: SimulationMetrics,
	config: SimulationConfig,
	tick: number,
): { spawn: boolean; type: EnemyType | null } {
	if (Math.random() > config.enemySpawnRate) {
		return { spawn: false, type: null };
	}

	if (metrics.queries.nPlusOneCount > 0 && tick % 120 === 0) {
		return { spawn: true, type: 'query_swarm' };
	}
	if (
		metrics.memory.pressure === 'high' ||
		metrics.memory.pressure === 'critical'
	) {
		return { spawn: true, type: 'memory_blob' };
	}
	if (metrics.latency.p95 > 500) {
		return { spawn: true, type: 'timeout_wraith' };
	}
	if (metrics.errors.rate > 5) {
		return { spawn: true, type: 'error_spike' };
	}
	if (metrics.cache.hitRate < 50 && metrics.cache.size > 0) {
		return { spawn: true, type: 'cache_phantom' };
	}

	return { spawn: false, type: null };
}

export function createEnemy(
	type: EnemyType,
	canvasWidth: number,
	canvasHeight: number,
): Enemy {
	const stats = ENEMY_STATS[type];
	const side = Math.floor(Math.random() * 4);

	let position: Position;
	switch (side) {
		case 0:
			position = { x: Math.random() * canvasWidth, y: 0 };
			break;
		case 1:
			position = { x: canvasWidth, y: Math.random() * canvasHeight };
			break;
		case 2:
			position = { x: Math.random() * canvasWidth, y: canvasHeight };
			break;
		default:
			position = { x: 0, y: Math.random() * canvasHeight };
	}

	return {
		id: `enemy_${generateId()}`,
		type,
		position,
		hp: stats.hp,
		maxHp: stats.hp,
		damage: stats.damage,
		speed: stats.speed,
		isActive: true,
	};
}

export function updateEnemyPositions(
	enemies: Enemy[],
	targetX: number,
	targetY: number,
): Enemy[] {
	return enemies.map((enemy) => {
		if (!enemy.isActive) return enemy;

		const dx = targetX - enemy.position.x;
		const dy = targetY - enemy.position.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist <= enemy.speed) return enemy;

		return {
			...enemy,
			position: {
				x: enemy.position.x + (dx / dist) * enemy.speed,
				y: enemy.position.y + (dy / dist) * enemy.speed,
			},
		};
	});
}

export function processDefenseAttacks(
	defenses: Defense[],
	enemies: Enemy[],
): { defenses: Defense[]; enemies: Enemy[]; damageDealt: number } {
	let totalDamage = 0;
	const updatedEnemies = [...enemies];

	const updatedDefenses = defenses.map((defense) => {
		if (defense.currentCooldown > 0) {
			return {
				...defense,
				currentCooldown: defense.currentCooldown - 1,
				isActive: false,
			};
		}

		for (let i = 0; i < updatedEnemies.length; i++) {
			const enemy = updatedEnemies[i];
			if (!enemy.isActive) continue;

			const dx = enemy.position.x - defense.position.x;
			const dy = enemy.position.y - defense.position.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist <= defense.range) {
				const newHp = enemy.hp - defense.power;
				totalDamage += defense.power;
				updatedEnemies[i] = {
					...enemy,
					hp: Math.max(0, newHp),
					isActive: newHp > 0,
				};
				return {
					...defense,
					currentCooldown: defense.cooldown,
					isActive: true,
				};
			}
		}

		return { ...defense, isActive: false };
	});

	return {
		defenses: updatedDefenses,
		enemies: updatedEnemies.filter((e) => e.isActive),
		damageDealt: totalDamage,
	};
}

// ============================================
// Main Tick Function
// ============================================

export function tick(
	state: SimulationState,
	config: SimulationConfig = DEFAULT_CONFIG,
): SimulationState {
	const newTick = state.tick + 1;
	const newElapsedTime = state.elapsedTime + 1000 / config.tickRate;

	// Update enemy positions
	const centerX = 400;
	const centerY = 300;
	let updatedEnemies = updateEnemyPositions(state.enemies, centerX, centerY);

	// Process defense attacks
	const attackResult = processDefenseAttacks(state.defenses, updatedEnemies);
	updatedEnemies = attackResult.enemies;
	const updatedDefenses = attackResult.defenses;

	// Spawn enemies
	const spawnCheck = shouldSpawnEnemy(state.metrics, config, newTick);
	if (spawnCheck.spawn && spawnCheck.type) {
		const newEnemy = createEnemy(spawnCheck.type, 800, 600);
		updatedEnemies = [...updatedEnemies, newEnemy];
	}

	// Update metrics
	const nPlusOneCount = detectNPlusOne(state.nodes, state.edges);
	const updatedMetrics: SimulationMetrics = {
		...state.metrics,
		queries: { ...state.metrics.queries, nPlusOneCount },
	};

	// Calculate stability
	const newStabilityScore = calculateStabilityScore(updatedMetrics);
	const newStabilityHistory = [
		...state.stabilityHistory,
		newStabilityScore,
	].slice(-300);

	// Check objective
	const objectiveHoldTicks =
		newStabilityScore >= config.stabilityThreshold
			? (state.objectiveProgress / 100) * config.stabilityDuration + 1
			: 0;
	const objectiveProgress = Math.min(
		100,
		(objectiveHoldTicks / config.stabilityDuration) * 100,
	);
	const objectiveMet = objectiveHoldTicks >= config.stabilityDuration;

	return {
		...state,
		tick: newTick,
		elapsedTime: newElapsedTime,
		enemies: updatedEnemies,
		defenses: updatedDefenses,
		metrics: updatedMetrics,
		stabilityScore: newStabilityScore,
		stabilityHistory: newStabilityHistory,
		objectiveProgress,
		objectiveMet,
	};
}

// ============================================
// Simulation Runner
// ============================================

export function createSimulationRunner(
	initialState: SimulationState,
	config: SimulationConfig = DEFAULT_CONFIG,
) {
	let state = initialState;
	let isRunning = false;
	let animationFrameId: number | null = null;

	return {
		getState: () => state,

		start: (onTick: (state: SimulationState) => void) => {
			isRunning = true;
			let lastTime = performance.now();

			const loop = (currentTime: number) => {
				if (!isRunning) return;

				const elapsed = currentTime - lastTime;
				const tickInterval = 1000 / state.tickRate;

				if (elapsed >= tickInterval) {
					state = tick(state, config);
					onTick(state);
					lastTime = currentTime;
				}

				animationFrameId = requestAnimationFrame(loop);
			};

			animationFrameId = requestAnimationFrame(loop);
		},

		stop: () => {
			isRunning = false;
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = null;
			}
		},

		step: () => {
			state = tick(state, config);
			return state;
		},

		reset: (newState: SimulationState) => {
			state = newState;
		},
	};
}

export { DEFAULT_CONFIG };
