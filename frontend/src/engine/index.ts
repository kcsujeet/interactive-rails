// Export all engine modules
export {
  tick,
  createSimulationRunner,
  calculateStabilityScore,
  calculateStabilityTrend,
  detectNPlusOne,
  createEnemy,
  DEFAULT_CONFIG,
  type SimulationState,
  type SimulationConfig,
} from './SimulationEngine';

// Export node behavior definitions
export {
  NODE_BEHAVIORS,
  CONNECTION_COSTS,
  getNodeBehavior,
  isConnectionAllowed,
  calculatePathLatency,
  detectNPlusOnePattern,
  calculateMemoryUsage,
  getNodesForAct,
  getNodeUnlockAct,
  type NodeBehavior,
  type FailureMode,
  type ConnectionCost,
} from './nodeBehavior';
