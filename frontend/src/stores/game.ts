/**
 * Game Store
 *
 * Manages player progression and game state including:
 * - Player level and XP
 * - Unlocked nodes and actions
 * - Level completion status
 * - Achievements and stats
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { NodeType } from './pipeline';
import type { DefenseType } from './simulation';

// ============================================
// Types
// ============================================

export interface LevelCompletion {
	levelId: string;
	starsEarned: 1 | 2 | 3;
	finalStability: number;
	timeToComplete: number; // milliseconds
	completedAt: string; // ISO date
}

export interface Achievement {
	id: string;
	name: string;
	description: string;
	unlockedAt: string | null;
	progress: number;
	maxProgress: number;
}

export interface PlayerStats {
	totalLevelsCompleted: number;
	totalXPEarned: number;
	totalPlayTime: number; // milliseconds
	perfectScores: number; // 3-star completions
	highestStabilityAchieved: number;
	enemiesDefeated: number;
	nodesPlaced: number;
	connectionsCreated: number;
}

export interface GameState {
	// Player identity
	playerId: string | null;
	playerName: string;

	// Progression
	level: number;
	xp: number;
	xpToNextLevel: number;

	// Unlocks
	unlockedNodes: NodeType[];
	unlockedDefenses: DefenseType[];
	unlockedActions: string[];

	// Level progress
	completedLevels: Map<string, LevelCompletion>;
	currentLevelId: string | null;

	// Achievements
	achievements: Achievement[];

	// Statistics
	stats: PlayerStats;

	// Session state
	sessionStartTime: number | null;
	isLoading: boolean;
	error: string | null;

	// Actions - Player
	setPlayer: (id: string, name: string) => void;
	clearPlayer: () => void;

	// Actions - XP & Level
	addXP: (amount: number) => void;
	calculateXPForLevel: (level: number) => number;

	// Actions - Unlocks
	unlockNode: (nodeType: NodeType) => void;
	unlockDefense: (defenseType: DefenseType) => void;
	unlockAction: (action: string) => void;
	isNodeUnlocked: (nodeType: NodeType) => boolean;
	isDefenseUnlocked: (defenseType: DefenseType) => boolean;

	// Actions - Levels
	setCurrentLevel: (levelId: string | null) => void;
	completeLevel: (completion: Omit<LevelCompletion, 'completedAt'>) => void;
	getLevelCompletion: (levelId: string) => LevelCompletion | undefined;
	isLevelCompleted: (levelId: string) => boolean;

	// Actions - Achievements
	updateAchievementProgress: (achievementId: string, progress: number) => void;
	unlockAchievement: (achievementId: string) => void;

	// Actions - Stats
	incrementStat: (stat: keyof PlayerStats, amount?: number) => void;
	recordPlayTime: () => void;

	// Actions - Session
	startSession: () => void;
	endSession: () => void;

	// Actions - Data
	loadFromServer: (data: Partial<GameState>) => void;
	reset: () => void;
}

// ============================================
// Constants
// ============================================

const INITIAL_UNLOCKED_NODES: NodeType[] = [
	'request',
	'response',
	'controller',
];
const INITIAL_UNLOCKED_DEFENSES: DefenseType[] = [];
const INITIAL_UNLOCKED_ACTIONS: string[] = [
	'drag_node',
	'connect_ports',
	'view_metrics',
];

const BASE_XP_PER_LEVEL = 100;
const XP_SCALING_FACTOR = 1.5;

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
	{
		id: 'first_level',
		name: 'First Steps',
		description: 'Complete your first level',
		unlockedAt: null,
		progress: 0,
		maxProgress: 1,
	},
	{
		id: 'perfect_score',
		name: 'Perfectionist',
		description: 'Get 3 stars on a level',
		unlockedAt: null,
		progress: 0,
		maxProgress: 1,
	},
	{
		id: 'five_levels',
		name: 'Level Master',
		description: 'Complete 5 levels',
		unlockedAt: null,
		progress: 0,
		maxProgress: 5,
	},
	{
		id: 'stability_master',
		name: 'Stability Master',
		description: 'Achieve 100% stability',
		unlockedAt: null,
		progress: 0,
		maxProgress: 100,
	},
	{
		id: 'enemy_slayer',
		name: 'Enemy Slayer',
		description: 'Defeat 100 enemies',
		unlockedAt: null,
		progress: 0,
		maxProgress: 100,
	},
	{
		id: 'pipeline_architect',
		name: 'Pipeline Architect',
		description: 'Place 50 nodes',
		unlockedAt: null,
		progress: 0,
		maxProgress: 50,
	},
	{
		id: 'level_10',
		name: 'Rising Star',
		description: 'Reach level 10',
		unlockedAt: null,
		progress: 0,
		maxProgress: 10,
	},
	{
		id: 'level_25',
		name: 'Veteran',
		description: 'Reach level 25',
		unlockedAt: null,
		progress: 0,
		maxProgress: 25,
	},
];

const DEFAULT_STATS: PlayerStats = {
	totalLevelsCompleted: 0,
	totalXPEarned: 0,
	totalPlayTime: 0,
	perfectScores: 0,
	highestStabilityAchieved: 0,
	enemiesDefeated: 0,
	nodesPlaced: 0,
	connectionsCreated: 0,
};

// Node unlock requirements by level
const NODE_UNLOCK_LEVELS: Record<NodeType, number> = {
	request: 1,
	response: 1,
	controller: 1,
	router: 3,
	model: 5,
	database: 7,
	cache: 10,
	view: 12,
	background_job: 15,
};

// Defense unlock requirements by level
const DEFENSE_UNLOCK_LEVELS: Record<DefenseType, number> = {
	index_turret: 5,
	cache_shield: 8,
	eager_loader: 12,
	rate_limiter: 15,
	worker_drone: 18,
	validator_wall: 20,
};

// ============================================
// Store
// ============================================

export const useGameStore = create<GameState>()(
	devtools(
		persist(
			subscribeWithSelector(
				immer((set, get) => ({
					// Initial state
					playerId: null,
					playerName: 'Player',
					level: 1,
					xp: 0,
					xpToNextLevel: BASE_XP_PER_LEVEL,
					unlockedNodes: [...INITIAL_UNLOCKED_NODES],
					unlockedDefenses: [...INITIAL_UNLOCKED_DEFENSES],
					unlockedActions: [...INITIAL_UNLOCKED_ACTIONS],
					completedLevels: new Map(),
					currentLevelId: null,
					achievements: [...DEFAULT_ACHIEVEMENTS],
					stats: { ...DEFAULT_STATS },
					sessionStartTime: null,
					isLoading: false,
					error: null,

					// Player
					setPlayer: (id, name) => {
						set((state) => {
							state.playerId = id;
							state.playerName = name;
						});
					},

					clearPlayer: () => {
						set((state) => {
							state.playerId = null;
							state.playerName = 'Player';
						});
					},

					// XP & Level
					addXP: (amount) => {
						set((state) => {
							state.xp += amount;
							state.stats.totalXPEarned += amount;

							// Check for level up
							while (state.xp >= state.xpToNextLevel) {
								state.xp -= state.xpToNextLevel;
								state.level += 1;
								state.xpToNextLevel = Math.floor(
									BASE_XP_PER_LEVEL * XP_SCALING_FACTOR ** (state.level - 1),
								);

								// Auto-unlock nodes and defenses at new level
								for (const [nodeType, requiredLevel] of Object.entries(
									NODE_UNLOCK_LEVELS,
								)) {
									if (
										requiredLevel === state.level &&
										!state.unlockedNodes.includes(nodeType as NodeType)
									) {
										state.unlockedNodes.push(nodeType as NodeType);
									}
								}

								for (const [defenseType, requiredLevel] of Object.entries(
									DEFENSE_UNLOCK_LEVELS,
								)) {
									if (
										requiredLevel === state.level &&
										!state.unlockedDefenses.includes(defenseType as DefenseType)
									) {
										state.unlockedDefenses.push(defenseType as DefenseType);
									}
								}

								// Update level achievements
								const levelAchievements = state.achievements.filter((a) =>
									a.id.startsWith('level_'),
								);
								for (const achievement of levelAchievements) {
									if (
										state.level >= achievement.maxProgress &&
										!achievement.unlockedAt
									) {
										achievement.unlockedAt = new Date().toISOString();
									}
									achievement.progress = Math.min(
										state.level,
										achievement.maxProgress,
									);
								}
							}
						});
					},

					calculateXPForLevel: (level) => {
						return Math.floor(
							BASE_XP_PER_LEVEL * XP_SCALING_FACTOR ** (level - 1),
						);
					},

					// Unlocks
					unlockNode: (nodeType) => {
						set((state) => {
							if (!state.unlockedNodes.includes(nodeType)) {
								state.unlockedNodes.push(nodeType);
							}
						});
					},

					unlockDefense: (defenseType) => {
						set((state) => {
							if (!state.unlockedDefenses.includes(defenseType)) {
								state.unlockedDefenses.push(defenseType);
							}
						});
					},

					unlockAction: (action) => {
						set((state) => {
							if (!state.unlockedActions.includes(action)) {
								state.unlockedActions.push(action);
							}
						});
					},

					isNodeUnlocked: (nodeType) => {
						return get().unlockedNodes.includes(nodeType);
					},

					isDefenseUnlocked: (defenseType) => {
						return get().unlockedDefenses.includes(defenseType);
					},

					// Levels
					setCurrentLevel: (levelId) => {
						set((state) => {
							state.currentLevelId = levelId;
						});
					},

					completeLevel: (completion) => {
						set((state) => {
							const fullCompletion: LevelCompletion = {
								...completion,
								completedAt: new Date().toISOString(),
							};

							const existing = state.completedLevels.get(completion.levelId);

							// Only update if new completion is better or first time
							if (!existing || completion.starsEarned > existing.starsEarned) {
								state.completedLevels.set(completion.levelId, fullCompletion);
							}

							// Update stats
							if (!existing) {
								state.stats.totalLevelsCompleted += 1;
							}

							if (
								completion.starsEarned === 3 &&
								(!existing || existing.starsEarned < 3)
							) {
								state.stats.perfectScores += 1;
							}

							if (
								completion.finalStability > state.stats.highestStabilityAchieved
							) {
								state.stats.highestStabilityAchieved =
									completion.finalStability;
							}

							// Update achievements
							const firstLevel = state.achievements.find(
								(a) => a.id === 'first_level',
							);
							if (firstLevel && !firstLevel.unlockedAt) {
								firstLevel.unlockedAt = new Date().toISOString();
								firstLevel.progress = 1;
							}

							if (completion.starsEarned === 3) {
								const perfectScore = state.achievements.find(
									(a) => a.id === 'perfect_score',
								);
								if (perfectScore && !perfectScore.unlockedAt) {
									perfectScore.unlockedAt = new Date().toISOString();
									perfectScore.progress = 1;
								}
							}

							const fiveLevels = state.achievements.find(
								(a) => a.id === 'five_levels',
							);
							if (fiveLevels) {
								fiveLevels.progress = state.stats.totalLevelsCompleted;
								if (
									fiveLevels.progress >= fiveLevels.maxProgress &&
									!fiveLevels.unlockedAt
								) {
									fiveLevels.unlockedAt = new Date().toISOString();
								}
							}

							const stabilityMaster = state.achievements.find(
								(a) => a.id === 'stability_master',
							);
							if (stabilityMaster) {
								stabilityMaster.progress = Math.max(
									stabilityMaster.progress,
									completion.finalStability,
								);
								if (
									stabilityMaster.progress >= stabilityMaster.maxProgress &&
									!stabilityMaster.unlockedAt
								) {
									stabilityMaster.unlockedAt = new Date().toISOString();
								}
							}
						});
					},

					getLevelCompletion: (levelId) => {
						return get().completedLevels.get(levelId);
					},

					isLevelCompleted: (levelId) => {
						return get().completedLevels.has(levelId);
					},

					// Achievements
					updateAchievementProgress: (achievementId, progress) => {
						set((state) => {
							const achievement = state.achievements.find(
								(a) => a.id === achievementId,
							);
							if (achievement && !achievement.unlockedAt) {
								achievement.progress = Math.min(
									progress,
									achievement.maxProgress,
								);
								if (achievement.progress >= achievement.maxProgress) {
									achievement.unlockedAt = new Date().toISOString();
								}
							}
						});
					},

					unlockAchievement: (achievementId) => {
						set((state) => {
							const achievement = state.achievements.find(
								(a) => a.id === achievementId,
							);
							if (achievement && !achievement.unlockedAt) {
								achievement.unlockedAt = new Date().toISOString();
								achievement.progress = achievement.maxProgress;
							}
						});
					},

					// Stats
					incrementStat: (stat, amount = 1) => {
						set((state) => {
							state.stats[stat] += amount;

							// Update related achievements
							if (stat === 'enemiesDefeated') {
								const enemySlayer = state.achievements.find(
									(a) => a.id === 'enemy_slayer',
								);
								if (enemySlayer) {
									enemySlayer.progress = Math.min(
										state.stats.enemiesDefeated,
										enemySlayer.maxProgress,
									);
									if (
										enemySlayer.progress >= enemySlayer.maxProgress &&
										!enemySlayer.unlockedAt
									) {
										enemySlayer.unlockedAt = new Date().toISOString();
									}
								}
							}

							if (stat === 'nodesPlaced') {
								const architect = state.achievements.find(
									(a) => a.id === 'pipeline_architect',
								);
								if (architect) {
									architect.progress = Math.min(
										state.stats.nodesPlaced,
										architect.maxProgress,
									);
									if (
										architect.progress >= architect.maxProgress &&
										!architect.unlockedAt
									) {
										architect.unlockedAt = new Date().toISOString();
									}
								}
							}
						});
					},

					recordPlayTime: () => {
						const { sessionStartTime } = get();
						if (sessionStartTime) {
							const elapsed = Date.now() - sessionStartTime;
							set((state) => {
								state.stats.totalPlayTime += elapsed;
								state.sessionStartTime = Date.now();
							});
						}
					},

					// Session
					startSession: () => {
						set((state) => {
							state.sessionStartTime = Date.now();
						});
					},

					endSession: () => {
						get().recordPlayTime();
						set((state) => {
							state.sessionStartTime = null;
						});
					},

					// Data
					loadFromServer: (data) => {
						set((state) => {
							if (data.playerId !== undefined) state.playerId = data.playerId;
							if (data.playerName !== undefined)
								state.playerName = data.playerName;
							if (data.level !== undefined) state.level = data.level;
							if (data.xp !== undefined) state.xp = data.xp;
							if (data.xpToNextLevel !== undefined)
								state.xpToNextLevel = data.xpToNextLevel;
							if (data.unlockedNodes !== undefined)
								state.unlockedNodes = data.unlockedNodes;
							if (data.unlockedDefenses !== undefined)
								state.unlockedDefenses = data.unlockedDefenses;
							if (data.unlockedActions !== undefined)
								state.unlockedActions = data.unlockedActions;
							if (data.stats !== undefined) state.stats = data.stats;
						});
					},

					reset: () => {
						set((state) => {
							state.playerId = null;
							state.playerName = 'Player';
							state.level = 1;
							state.xp = 0;
							state.xpToNextLevel = BASE_XP_PER_LEVEL;
							state.unlockedNodes = [...INITIAL_UNLOCKED_NODES];
							state.unlockedDefenses = [...INITIAL_UNLOCKED_DEFENSES];
							state.unlockedActions = [...INITIAL_UNLOCKED_ACTIONS];
							state.completedLevels = new Map();
							state.currentLevelId = null;
							state.achievements = [...DEFAULT_ACHIEVEMENTS];
							state.stats = { ...DEFAULT_STATS };
							state.sessionStartTime = null;
							state.isLoading = false;
							state.error = null;
						});
					},
				})),
			),
			{
				name: 'railsexpert-game',
				partialize: (state) => ({
					playerId: state.playerId,
					playerName: state.playerName,
					level: state.level,
					xp: state.xp,
					xpToNextLevel: state.xpToNextLevel,
					unlockedNodes: state.unlockedNodes,
					unlockedDefenses: state.unlockedDefenses,
					unlockedActions: state.unlockedActions,
					// Note: completedLevels is a Map, needs custom serialization
					stats: state.stats,
				}),
			},
		),
		{ name: 'game-store' },
	),
);

// ============================================
// Selectors
// ============================================

export const selectLevelProgress = (state: GameState) =>
	(state.xp / state.xpToNextLevel) * 100;

export const selectUnlockedAchievements = (state: GameState) =>
	state.achievements.filter((a) => a.unlockedAt !== null);

export const selectLockedAchievements = (state: GameState) =>
	state.achievements.filter((a) => a.unlockedAt === null);

export const selectTotalStars = (state: GameState) => {
	let total = 0;
	state.completedLevels.forEach((completion) => {
		total += completion.starsEarned;
	});
	return total;
};

export const selectCanUnlockNode = (nodeType: NodeType) => (state: GameState) =>
	state.level >= NODE_UNLOCK_LEVELS[nodeType];

export const selectCanUnlockDefense =
	(defenseType: DefenseType) => (state: GameState) =>
		state.level >= DEFENSE_UNLOCK_LEVELS[defenseType];

export const selectNodeUnlockLevel = (nodeType: NodeType) =>
	NODE_UNLOCK_LEVELS[nodeType];

export const selectDefenseUnlockLevel = (defenseType: DefenseType) =>
	DEFENSE_UNLOCK_LEVELS[defenseType];

// ============================================
// Backwards Compatibility Aliases
// ============================================

/** @deprecated Use LevelCompletion instead */
export type DungeonCompletion = LevelCompletion;
