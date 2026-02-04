/**
 * Pipeline Progress Repository
 * Handles database operations for pipeline builder progress (v2 schema)
 */

export interface CreatePlayerProgressData {
	userId: string;
}

export interface UpdatePlayerProgressData {
	level?: number;
	xp?: number;
	unlockedActions?: string[];
	unlockedNodes?: string[];
	unlockedDefenses?: string[];
	stackChoices?: { database: string; frontend: string } | null;
	guestImportedAt?: string | null;
}

export class PipelineProgressRepository {
	constructor(private db: D1Database) {}

	async createPlayerProgress(data: CreatePlayerProgressData): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO player_progress (user_id, level, xp, unlocked_actions, unlocked_nodes, unlocked_defenses)
         VALUES (?, 1, 0, '[]', '["request","router","controller","view","response"]', '["index_turret"]')`,
			)
			.bind(data.userId)
			.run();
	}

	async getPlayerProgress(userId: string): Promise<{ user_id: string } | null> {
		return this.db
			.prepare('SELECT user_id FROM player_progress WHERE user_id = ?')
			.bind(userId)
			.first<{ user_id: string }>();
	}

	async updatePlayerProgress(
		userId: string,
		data: UpdatePlayerProgressData,
	): Promise<void> {
		const sets: string[] = [];
		const values: (string | number | null)[] = [];

		if (data.level !== undefined) {
			sets.push('level = ?');
			values.push(data.level);
		}
		if (data.xp !== undefined) {
			sets.push('xp = ?');
			values.push(data.xp);
		}
		if (data.unlockedActions !== undefined) {
			sets.push('unlocked_actions = ?');
			values.push(JSON.stringify(data.unlockedActions));
		}
		if (data.unlockedNodes !== undefined) {
			sets.push('unlocked_nodes = ?');
			values.push(JSON.stringify(data.unlockedNodes));
		}
		if (data.unlockedDefenses !== undefined) {
			sets.push('unlocked_defenses = ?');
			values.push(JSON.stringify(data.unlockedDefenses));
		}
		if (data.stackChoices !== undefined) {
			sets.push('stack_choices = ?');
			values.push(data.stackChoices ? JSON.stringify(data.stackChoices) : null);
		}
		if (data.guestImportedAt !== undefined) {
			sets.push('guest_imported_at = ?');
			values.push(data.guestImportedAt);
		}

		if (sets.length === 0) return;

		sets.push('updated_at = CURRENT_TIMESTAMP');
		values.push(userId);

		await this.db
			.prepare(
				`UPDATE player_progress SET ${sets.join(', ')} WHERE user_id = ?`,
			)
			.bind(...values)
			.run();
	}
}
