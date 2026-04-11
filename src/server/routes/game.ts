/**
 * Game Routes
 * Handles realms, dungeons, challenges, and battle mechanics
 */

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { InternalError, NotFoundError } from '../errors';
import { authMiddleware } from '../middleware/auth';
import { ProgressRepository } from '../repositories/progressRepository';
import {
	getChallenge,
	getDungeonChallenges,
	realms,
} from '../services/content';
import {
	calculateDamage,
	calculateHpLost,
	calculateTimeBonus,
	calculateXpForLevel,
	getMaxHp,
} from '../services/game';
import type { DungeonProgress, Env } from '../types';
import { logger } from '../utils/logger';

const gameRoutes = new Hono<{ Bindings: Env }>();

// ==================== Validation Schemas ====================

const attemptSchema = z.object({
	answer: z.string(),
	timeTakenMs: z.number().int().positive(),
});

// ==================== Helper Functions ====================

interface RealmStatus {
	id: string;
	name: string;
	description: string;
	order: number;
	isUnlocked: boolean;
	dungeonsCompleted: number;
	totalDungeons: number;
}

function buildRealmsWithStatus(
	progress: { level: number } | null,
	completedMap: Map<string, number>,
): RealmStatus[] {
	return realms.map((realm, index) => {
		// First realm is always unlocked, others require previous realm completion or level
		const isUnlocked =
			index === 0 ||
			(realm.unlockRequirement?.level !== undefined &&
				progress !== null &&
				progress.level >= realm.unlockRequirement.level) ||
			(realm.unlockRequirement?.realm !== undefined &&
				completedMap.has(realm.unlockRequirement.realm));

		return {
			id: realm.id,
			name: realm.name,
			description: realm.description,
			order: realm.order,
			isUnlocked,
			dungeonsCompleted: completedMap.get(realm.id) ?? 0,
			totalDungeons: realm.dungeons.length,
		};
	});
}

// ==================== Routes ====================

/**
 * GET /api/game/realms
 * Get all realms with user's unlock status
 */
gameRoutes.get('/realms', authMiddleware, async (c) => {
	const userId = c.get('userId');
	const progressRepo = new ProgressRepository(c.env.DB);

	const [progress, completedMap] = await Promise.all([
		progressRepo.findByUserId(userId),
		progressRepo.getCompletedDungeonsByRealm(userId),
	]);

	const realmsWithStatus = buildRealmsWithStatus(progress, completedMap);

	return c.json({
		success: true,
		data: {
			realms: realmsWithStatus,
		},
		meta: {
			requestId: c.get('requestId'),
			timestamp: new Date().toISOString(),
		},
	});
});

/**
 * GET /api/game/realms/:realmId/dungeons
 * Get dungeons for a realm with user's progress
 */
gameRoutes.get('/realms/:realmId/dungeons', authMiddleware, async (c) => {
	const { realmId } = c.req.param();
	const userId = c.get('userId');
	const progressRepo = new ProgressRepository(c.env.DB);

	const realm = realms.find((r) => r.id === realmId);
	if (!realm) {
		throw new NotFoundError('Realm');
	}

	const dungeonProgress = await progressRepo.getDungeonProgress(
		userId,
		realmId,
	);
	const progressMap = new Map<string, DungeonProgress>(
		dungeonProgress.map((d) => [d.dungeon_id, d]),
	);

	const dungeons = realm.dungeons.map((dungeonId, index) => {
		const progress = progressMap.get(dungeonId);
		const isCompleted = progress?.is_completed ?? false;
		// First dungeon is unlocked, others require previous dungeon completion
		// Also unlock if the dungeon itself is already completed (player has played it before)
		const previousDungeonId = index > 0 ? realm.dungeons[index - 1] : undefined;
		const isUnlocked =
			index === 0 ||
			isCompleted ||
			(previousDungeonId !== undefined &&
				progressMap.get(previousDungeonId)?.is_completed === true);

		return {
			id: dungeonId,
			name: `Dungeon ${index + 1}`,
			isUnlocked,
			isCompleted,
			challengesCompleted: progress?.challenges_completed ?? 0,
			totalChallenges: progress?.total_challenges ?? 10,
			bestScore: progress?.best_score ?? 0,
		};
	});

	return c.json({
		success: true,
		data: {
			realm: {
				id: realm.id,
				name: realm.name,
				description: realm.description,
			},
			dungeons,
		},
		meta: {
			requestId: c.get('requestId'),
			timestamp: new Date().toISOString(),
		},
	});
});

/**
 * GET /api/game/dungeons/:dungeonId/challenges
 * Get challenges for a dungeon (start a battle session)
 */
gameRoutes.get('/dungeons/:dungeonId/challenges', authMiddleware, async (c) => {
	const { dungeonId } = c.req.param();

	const challenges = getDungeonChallenges(dungeonId);
	if (!challenges || challenges.length === 0) {
		throw new NotFoundError('Dungeon');
	}

	// Return challenges without correct answers (prevent cheating)
	const sanitizedChallenges = challenges.map(
		({ correct_answer: _correct, explanation: _explain, ...rest }) => rest,
	);

	return c.json({
		success: true,
		data: {
			dungeonId,
			challenges: sanitizedChallenges,
		},
		meta: {
			requestId: c.get('requestId'),
			timestamp: new Date().toISOString(),
		},
	});
});

/**
 * POST /api/game/challenges/:challengeId/attempt
 * Submit an answer to a challenge
 */
gameRoutes.post(
	'/challenges/:challengeId/attempt',
	authMiddleware,
	zValidator('json', attemptSchema),
	async (c) => {
		const { challengeId } = c.req.param();
		const { answer, timeTakenMs } = c.req.valid('json');
		const userId = c.get('userId');
		const progressRepo = new ProgressRepository(c.env.DB);

		const challenge = getChallenge(challengeId);
		if (!challenge) {
			throw new NotFoundError('Challenge');
		}

		const isCorrect = answer === challenge.correct_answer;

		// Parse realm and dungeon from challenge ID (format: realm-dungeon-challenge)
		const challengeParts = challengeId.split('-');
		const realmId = challengeParts[0] ?? 'unknown';
		const dungeonId = challengeParts[1] ?? 'unknown';

		// Record the attempt
		await progressRepo.recordAttempt({
			userId,
			challengeId,
			realmId,
			dungeonId,
			isCorrect,
			timeTakenMs,
			answerGiven: answer,
		});

		// Get current user progress
		const progress = await progressRepo.findByUserId(userId);
		if (!progress) {
			throw new InternalError('User progress not found');
		}

		let xpGained = 0;
		let newLevel = progress.level;
		let newHp = progress.current_hp;
		let damage = 0;

		if (isCorrect) {
			// Award XP based on difficulty and time
			const timeBonus = calculateTimeBonus(timeTakenMs);
			xpGained = Math.floor(challenge.xp_reward * timeBonus);

			const newXp = progress.xp + xpGained;
			const xpForNextLevel = calculateXpForLevel(progress.level + 1);

			if (newXp >= xpForNextLevel) {
				newLevel = progress.level + 1;
				// Heal on level up
				newHp = getMaxHp(newLevel);

				logger.info('Player leveled up', {
					requestId: c.get('requestId'),
					userId,
					newLevel,
				});
			}

			await progressRepo.addXp(userId, xpGained, newLevel, newHp);
			damage = calculateDamage(challenge.difficulty, timeTakenMs);
		} else {
			// Monster attacks - lose HP
			const hpLost = calculateHpLost(challenge.difficulty);
			newHp = Math.max(0, progress.current_hp - hpLost);
			await progressRepo.reduceHp(userId, newHp);
		}

		logger.info('Challenge attempt completed', {
			requestId: c.get('requestId'),
			userId,
			challengeId,
			isCorrect,
			xpGained,
		});

		return c.json({
			success: true,
			data: {
				isCorrect,
				correctAnswer: challenge.correct_answer,
				explanation: challenge.explanation,
				xpGained,
				newLevel,
				currentHp: newHp,
				damage,
				leveledUp: newLevel > progress.level,
			},
			meta: {
				requestId: c.get('requestId'),
				timestamp: new Date().toISOString(),
			},
		});
	},
);

export { gameRoutes };
