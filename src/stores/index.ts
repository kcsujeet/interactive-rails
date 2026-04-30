/**
 * Zustand Store Exports
 *
 * This file exports all stores used in the application.
 * Stores follow the slice pattern and use immer for immutable updates.
 *
 * Store Architecture:
 * - pipelineStore: React Flow nodes/edges, selection, history, validation
 * - gameStore: Player progress, XP, unlocks, achievements, stats
 * - uiStore: Modals, panels, toasts, preferences, responsive state
 */

// Game Store - Player progression and unlocks
export {
	type Achievement,
	type GameState,
	type LevelCompletion,
	type PlayerStats,
	selectCanUnlockNode,
	selectLevelProgress,
	selectLockedAchievements,
	selectNodeUnlockLevel,
	selectTotalStars,
	selectUnlockedAchievements,
	useGameStore,
} from './game';
// Pipeline Store - Visual node editor state
export {
	type NodeType,
	type PipelineEdge,
	type PipelineNode,
	type PipelineNodeData,
	type PipelineState,
	selectCanRedo,
	selectCanUndo,
	selectNodeById,
	selectSelectedEdges,
	selectSelectedNodes,
	usePipelineStore,
} from './pipeline';
// UI Store - Interface state and preferences
export {
	type ConfirmDialogOptions,
	type ContextMenuItem,
	type ModalType,
	type PanelType,
	selectActiveToasts,
	selectCurrentTutorialStep,
	selectIsDarkMode,
	selectIsModalOpen,
	selectIsPanelOpen,
	selectPanelSize,
	selectShouldReduceMotion,
	selectTheme,
	selectTutorialProgress,
	type Toast,
	type ToastType,
	type TutorialStep,
	type UIPreferences,
	type UIState,
	useUIStore,
} from './ui';
