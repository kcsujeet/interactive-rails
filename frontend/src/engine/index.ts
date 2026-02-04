// Export all engine modules

// Export node behavior definitions
export {
	CONNECTION_COSTS,
	type ConnectionCost,
	calculateMemoryUsage,
	calculatePathLatency,
	detectNPlusOnePattern,
	type FailureMode,
	getNodeBehavior,
	getNodesForAct,
	getNodeUnlockAct,
	isConnectionAllowed,
	NODE_BEHAVIORS,
	type NodeBehavior,
} from './nodeBehavior';
export {
	calculateStabilityScore,
	calculateStabilityTrend,
	createEnemy,
	createSimulationRunner,
	DEFAULT_CONFIG,
	detectNPlusOne,
	type SimulationConfig,
	type SimulationState,
	tick,
} from './SimulationEngine';
