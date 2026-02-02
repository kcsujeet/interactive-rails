/**
 * Zustand Store Exports
 *
 * This file exports all stores used in the application.
 * Stores follow the slice pattern and use immer for immutable updates.
 *
 * Store Architecture:
 * - pipelineStore: React Flow nodes/edges, selection, history, validation
 * - simulationStore: Tick loop, metrics, enemies, defenses, stability
 * - gameStore: Player progress, XP, unlocks, achievements, stats
 * - uiStore: Modals, panels, toasts, preferences, responsive state
 */

// Pipeline Store - Visual node editor state
export {
  usePipelineStore,
  type PipelineState,
  type PipelineNode,
  type PipelineEdge,
  type PipelineNodeData,
  type NodeType,
  selectSelectedNodes,
  selectSelectedEdges,
  selectNodeById,
  selectCanUndo,
  selectCanRedo,
} from './pipeline';

// Simulation Store - Real-time simulation engine state
export {
  useSimulationStore,
  type SimulationStoreState,
  type SimulationMetrics,
  type SimulationConfig,
  type SimulationStatus,
  type Enemy,
  type EnemyType,
  type Defense,
  type DefenseType,
  type Position,
  selectIsRunning,
  selectIsPaused,
  selectActiveEnemies,
  selectActiveDefenses,
  selectLatencyColor,
  selectStabilityColor,
} from './simulation';

// Game Store - Player progression and unlocks
export {
  useGameStore,
  type GameState,
  type LevelCompletion,
  type Achievement,
  type PlayerStats,
  selectLevelProgress,
  selectUnlockedAchievements,
  selectLockedAchievements,
  selectTotalStars,
  selectCanUnlockNode,
  selectCanUnlockDefense,
  selectNodeUnlockLevel,
  selectDefenseUnlockLevel,
} from './game';

// UI Store - Interface state and preferences
export {
  useUIStore,
  type UIState,
  type UIPreferences,
  type ModalType,
  type PanelType,
  type Toast,
  type ToastType,
  type TutorialStep,
  type ContextMenuItem,
  type ConfirmDialogOptions,
  selectIsModalOpen,
  selectIsPanelOpen,
  selectPanelSize,
  selectActiveToasts,
  selectTheme,
  selectIsDarkMode,
  selectShouldReduceMotion,
  selectTutorialProgress,
  selectCurrentTutorialStep,
} from './ui';
