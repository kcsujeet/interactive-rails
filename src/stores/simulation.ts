/**
 * Simulation Store
 *
 * Manages the real-time simulation state including:
 * - Simulation lifecycle (start, pause, stop)
 * - Metrics tracking
 * - Enemy and defense management
 * - Stability calculation
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================
// Types
// ============================================

export type EnemyType =
	| 'query_swarm'
	| 'memory_blob'
	| 'callback_chain'
	| 'timeout_wraith'
	| 'error_spike'
	| 'cache_phantom';

export type DefenseType =
	| 'index_turret'
	| 'cache_shield'
	| 'eager_loader'
	| 'rate_limiter'
	| 'worker_drone'
	| 'validator_wall';

export interface Position {
	x: number;
	y: number;
}

export interface Enemy {
	id: string;
	type: EnemyType;
	position: Position;
	hp: number;
	maxHp: number;
	damage: number;
	speed: number;
	isActive: boolean;
	targetNodeId?: string;
}

export interface Defense {
	id: string;
	type: DefenseType;
	position: Position;
	power: number;
	range: number;
	cooldown: number;
	currentCooldown: number;
	isActive: boolean;
}

export interface SimulationMetrics {
	latency: {
		p50: number;
		p95: number;
		p99: number;
		avg: number;
	};
	throughput: {
		requestsPerSecond: number;
		completedRequests: number;
		failedRequests: number;
	};
	queries: {
		total: number;
		perRequest: number;
		nPlusOneCount: number;
	};
	cache: {
		hitRate: number;
		size: number;
	};
	memory: {
		usage: number;
		pressure: 'low' | 'medium' | 'high' | 'critical';
	};
	errors: {
		rate: number;
		types: Record<string, number>;
	};
}

export interface SimulationConfig {
	tickRate: number;
	requestsPerSecond: number;
	baseLatencyMs: number;
	enemySpawnRate: number;
	stabilityThreshold: number;
	stabilityDuration: number;
}

export type SimulationStatus =
	| 'idle'
	| 'running'
	| 'paused'
	| 'completed'
	| 'failed';

export interface SimulationStoreState {
	// Simulation state
	status: SimulationStatus;
	tick: number;
	elapsedTime: number;

	// Configuration
	config: SimulationConfig;

	// Metrics
	metrics: SimulationMetrics;
	metricsHistory: SimulationMetrics[];

	// Stability
	stabilityScore: number;
	stabilityTrend: 'improving' | 'stable' | 'degrading';
	stabilityHistory: number[];
	objectiveHoldTicks: number;

	// Entities
	enemies: Enemy[];
	defenses: Defense[];

	// Objective
	objectiveProgress: number;
	objectiveMet: boolean;

	// Actions - Lifecycle
	start: () => void;
	pause: () => void;
	resume: () => void;
	stop: () => void;
	reset: () => void;

	// Actions - Simulation
	processTick: () => void;
	setConfig: (config: Partial<SimulationConfig>) => void;

	// Actions - Entities
	spawnEnemy: (type: EnemyType, position: Position) => string;
	damageEnemy: (enemyId: string, damage: number) => void;
	removeEnemy: (enemyId: string) => void;

	addDefense: (type: DefenseType, position: Position) => string;
	removeDefense: (defenseId: string) => void;

	// Actions - Metrics
	updateMetrics: (metrics: Partial<SimulationMetrics>) => void;
	recordMetricsSnapshot: () => void;

	// Actions - Stability
	updateStability: (score: number) => void;
	checkObjective: () => void;
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: SimulationConfig = {
	tickRate: 60,
	requestsPerSecond: 10,
	baseLatencyMs: 10,
	enemySpawnRate: 0.5,
	stabilityThreshold: 80,
	stabilityDuration: 300, // 5 seconds at 60 ticks/sec
};

const DEFAULT_METRICS: SimulationMetrics = {
	latency: { p50: 0, p95: 0, p99: 0, avg: 0 },
	throughput: { requestsPerSecond: 0, completedRequests: 0, failedRequests: 0 },
	queries: { total: 0, perRequest: 0, nPlusOneCount: 0 },
	cache: { hitRate: 0, size: 0 },
	memory: { usage: 0, pressure: 'low' },
	errors: { rate: 0, types: {} },
};

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

const DEFENSE_STATS: Record<
	DefenseType,
	{ power: number; range: number; cooldown: number }
> = {
	index_turret: { power: 30, range: 150, cooldown: 30 },
	cache_shield: { power: 20, range: 200, cooldown: 60 },
	eager_loader: { power: 50, range: 100, cooldown: 45 },
	rate_limiter: { power: 15, range: 300, cooldown: 120 },
	worker_drone: { power: 25, range: 250, cooldown: 90 },
	validator_wall: { power: 35, range: 100, cooldown: 20 },
};

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
	return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function calculateStabilityScore(metrics: SimulationMetrics): number {
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

function calculateStabilityTrend(
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

// ============================================
// Store
// ============================================

export const useSimulationStore = create<SimulationStoreState>()(
	devtools(
		subscribeWithSelector(
			immer((set, get) => ({
				// Initial state
				status: 'idle',
				tick: 0,
				elapsedTime: 0,
				config: DEFAULT_CONFIG,
				metrics: DEFAULT_METRICS,
				metricsHistory: [],
				stabilityScore: 100,
				stabilityTrend: 'stable',
				stabilityHistory: [],
				objectiveHoldTicks: 0,
				enemies: [],
				defenses: [],
				objectiveProgress: 0,
				objectiveMet: false,

				// Lifecycle
				start: () => {
					set((state) => {
						state.status = 'running';
					});
				},

				pause: () => {
					set((state) => {
						if (state.status === 'running') {
							state.status = 'paused';
						}
					});
				},

				resume: () => {
					set((state) => {
						if (state.status === 'paused') {
							state.status = 'running';
						}
					});
				},

				stop: () => {
					set((state) => {
						state.status = 'idle';
					});
				},

				reset: () => {
					set((state) => {
						state.status = 'idle';
						state.tick = 0;
						state.elapsedTime = 0;
						state.metrics = DEFAULT_METRICS;
						state.metricsHistory = [];
						state.stabilityScore = 100;
						state.stabilityTrend = 'stable';
						state.stabilityHistory = [];
						state.objectiveHoldTicks = 0;
						state.enemies = [];
						state.defenses = [];
						state.objectiveProgress = 0;
						state.objectiveMet = false;
					});
				},

				// Simulation
				processTick: () => {
					const state = get();
					if (state.status !== 'running') return;

					set((state) => {
						state.tick += 1;
						state.elapsedTime += 1000 / state.config.tickRate;

						// Update enemy positions
						for (const enemy of state.enemies) {
							if (!enemy.isActive) continue;

							// Move toward center (simplified)
							const dx = 400 - enemy.position.x;
							const dy = 300 - enemy.position.y;
							const dist = Math.sqrt(dx * dx + dy * dy);

							if (dist > 0) {
								enemy.position.x += (dx / dist) * enemy.speed;
								enemy.position.y += (dy / dist) * enemy.speed;
							}
						}

						// Process defense attacks
						for (const defense of state.defenses) {
							if (defense.currentCooldown > 0) {
								defense.currentCooldown -= 1;
								continue;
							}

							// Find enemies in range
							for (const enemy of state.enemies) {
								if (!enemy.isActive) continue;

								const dx = enemy.position.x - defense.position.x;
								const dy = enemy.position.y - defense.position.y;
								const dist = Math.sqrt(dx * dx + dy * dy);

								if (dist <= defense.range) {
									enemy.hp -= defense.power;
									defense.currentCooldown = defense.cooldown;
									defense.isActive = true;

									if (enemy.hp <= 0) {
										enemy.isActive = false;
									}
									break;
								}
							}
						}

						// Clean up dead enemies
						state.enemies = state.enemies.filter((e) => e.isActive);

						// Update stability
						const score = calculateStabilityScore(state.metrics);
						state.stabilityScore = score;
						state.stabilityHistory.push(score);
						if (state.stabilityHistory.length > 300) {
							state.stabilityHistory.shift();
						}
						state.stabilityTrend = calculateStabilityTrend(
							state.stabilityHistory,
						);

						// Check objective
						if (score >= state.config.stabilityThreshold) {
							state.objectiveHoldTicks += 1;
						} else {
							state.objectiveHoldTicks = 0;
						}

						state.objectiveProgress = Math.min(
							100,
							(state.objectiveHoldTicks / state.config.stabilityDuration) * 100,
						);
						state.objectiveMet =
							state.objectiveHoldTicks >= state.config.stabilityDuration;

						if (state.objectiveMet) {
							state.status = 'completed';
						}
					});
				},

				setConfig: (config) => {
					set((state) => {
						state.config = { ...state.config, ...config };
					});
				},

				// Entities
				spawnEnemy: (type, position) => {
					const id = `enemy_${generateId()}`;
					const stats = ENEMY_STATS[type];

					set((state) => {
						state.enemies.push({
							id,
							type,
							position,
							hp: stats.hp,
							maxHp: stats.hp,
							damage: stats.damage,
							speed: stats.speed,
							isActive: true,
						});
					});

					return id;
				},

				damageEnemy: (enemyId, damage) => {
					set((state) => {
						const enemy = state.enemies.find((e) => e.id === enemyId);
						if (enemy) {
							enemy.hp = Math.max(0, enemy.hp - damage);
							if (enemy.hp <= 0) {
								enemy.isActive = false;
							}
						}
					});
				},

				removeEnemy: (enemyId) => {
					set((state) => {
						state.enemies = state.enemies.filter((e) => e.id !== enemyId);
					});
				},

				addDefense: (type, position) => {
					const id = `defense_${generateId()}`;
					const stats = DEFENSE_STATS[type];

					set((state) => {
						state.defenses.push({
							id,
							type,
							position,
							power: stats.power,
							range: stats.range,
							cooldown: stats.cooldown,
							currentCooldown: 0,
							isActive: false,
						});
					});

					return id;
				},

				removeDefense: (defenseId) => {
					set((state) => {
						state.defenses = state.defenses.filter((d) => d.id !== defenseId);
					});
				},

				// Metrics
				updateMetrics: (metrics) => {
					set((state) => {
						state.metrics = { ...state.metrics, ...metrics };
					});
				},

				recordMetricsSnapshot: () => {
					const { metrics, metricsHistory } = get();
					set((state) => {
						state.metricsHistory = [
							...metricsHistory.slice(-99),
							{ ...metrics },
						];
					});
				},

				// Stability
				updateStability: (score) => {
					set((state) => {
						state.stabilityScore = score;
						state.stabilityHistory.push(score);
						if (state.stabilityHistory.length > 300) {
							state.stabilityHistory.shift();
						}
						state.stabilityTrend = calculateStabilityTrend(
							state.stabilityHistory,
						);
					});
				},

				checkObjective: () => {
					const { stabilityScore, config, objectiveHoldTicks } = get();

					set((state) => {
						if (stabilityScore >= config.stabilityThreshold) {
							state.objectiveHoldTicks = objectiveHoldTicks + 1;
						} else {
							state.objectiveHoldTicks = 0;
						}

						state.objectiveProgress = Math.min(
							100,
							(state.objectiveHoldTicks / config.stabilityDuration) * 100,
						);
						state.objectiveMet =
							state.objectiveHoldTicks >= config.stabilityDuration;
					});
				},
			})),
		),
		{ name: 'simulation-store' },
	),
);

// ============================================
// Selectors
// ============================================

export const selectIsRunning = (state: SimulationStoreState) =>
	state.status === 'running';

export const selectIsPaused = (state: SimulationStoreState) =>
	state.status === 'paused';

export const selectActiveEnemies = (state: SimulationStoreState) =>
	state.enemies.filter((e) => e.isActive);

export const selectActiveDefenses = (state: SimulationStoreState) =>
	state.defenses.filter((d) => d.isActive);

export const selectLatencyColor = (state: SimulationStoreState) => {
	const p95 = state.metrics.latency.p95;
	if (p95 > 500) return 'text-red-400';
	if (p95 > 200) return 'text-amber-400';
	return 'text-green-400';
};

export const selectStabilityColor = (state: SimulationStoreState) => {
	const score = state.stabilityScore;
	if (score >= 80) return 'text-green-400';
	if (score >= 50) return 'text-amber-400';
	return 'text-red-400';
};
