/// <reference types="@cloudflare/workers-types" />
// Server types for the Hono API running inside Astro's Cloudflare adapter

export interface Env {
	DB: D1Database;
	ENVIRONMENT: string;
	JWT_SECRET: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
}

export interface User {
	id: string;
	email: string;
	username: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
}

export interface UserProgress {
	id: string;
	user_id: string;
	xp: number;
	level: number;
	current_hp: number;
	max_hp: number;
	current_realm: string;
	daily_streak: number;
	last_played_at: string | null;
	created_at: string;
}

export interface ChallengeAttempt {
	id: string;
	user_id: string;
	challenge_id: string;
	realm_id: string;
	dungeon_id: string;
	is_correct: boolean;
	time_taken_ms: number;
	answer_given: string;
	attempted_at: string;
}

export interface DungeonProgress {
	id: string;
	user_id: string;
	realm_id: string;
	dungeon_id: string;
	challenges_completed: number;
	total_challenges: number;
	is_completed: boolean;
	best_score: number;
	completed_at: string | null;
}

export interface UserAchievement {
	id: string;
	user_id: string;
	achievement_id: string;
	unlocked_at: string;
}

export interface Session {
	id: string;
	user_id: string;
	token: string;
	expires_at: string;
	created_at: string;
}

// Challenge types from content JSON
export interface Monster {
	name: string;
	image?: string;
	sprite?: string;
	hp: number;
}

export interface ChallengeOption {
	id: string;
	text: string;
}

export interface Challenge {
	id: string;
	type: 'multiple_choice' | 'fill_in_blank' | 'code_analysis';
	difficulty: number;
	xp_reward: number;
	monster: Monster;
	question: string;
	code_snippet?: string;
	options?: ChallengeOption[];
	correct_answer: string;
	explanation: string;
}

export interface Dungeon {
	id: string;
	name: string;
	description: string;
	challenges: string[]; // challenge IDs
}

export interface Realm {
	id: string;
	name: string;
	description: string;
	order: number;
	dungeons: string[]; // dungeon IDs
	unlockRequirement?: {
		realm?: string;
		level?: number;
	};
}

// API response types
export interface AuthResponse {
	user: Omit<User, 'password_hash'>;
	// Note: Token is now stored in HttpOnly cookie, not returned in response
}

export interface ProgressResponse {
	xp: number;
	level: number;
	current_hp: number;
	max_hp: number;
	daily_streak: number;
	realms_completed: number;
	dungeons_completed: number;
	challenges_completed: number;
}
