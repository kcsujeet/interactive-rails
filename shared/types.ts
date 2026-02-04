// Shared types between frontend and worker

export interface User {
	id: string;
	email: string;
	username: string;
}

export interface AuthResponse {
	user: User;
}

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
}

export interface ChallengeResult {
	isCorrect: boolean;
	correctAnswer: string;
	explanation: string;
	xpGained: number;
	newLevel: number;
	currentHp: number;
	damage: number;
	leveledUp: boolean;
}

export interface Realm {
	id: string;
	name: string;
	description: string;
	order: number;
	isUnlocked: boolean;
	dungeonsCompleted: number;
	totalDungeons: number;
}

export interface Dungeon {
	id: string;
	name: string;
	isUnlocked: boolean;
	isCompleted: boolean;
	challengesCompleted: number;
	totalChallenges: number;
	bestScore: number;
}

export interface Progress {
	xp: number;
	level: number;
	currentHp: number;
	maxHp: number;
	dailyStreak: number;
	currentRealm: string;
	lastPlayedAt: string | null;
	stats: {
		dungeonsCompleted: number;
		totalDungeons: number;
		challengesAttempted: number;
		challengesCorrect: number;
		accuracy: number;
		realmsCompleted: number;
	};
}

export interface Achievement {
	id: string;
	name: string;
	description: string;
	icon: string;
	unlocked: boolean;
	unlockedAt: string | null;
}
