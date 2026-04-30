// Shared types between frontend and worker.
// The full set of RPG-style types (Realm, Dungeon, Monster, Challenge, etc.)
// was removed alongside the legacy game layer. Only auth-related types
// remain because authStore + auth forms are still active.

export interface User {
	id: string;
	email: string;
	username: string;
}

export interface AuthResponse {
	user: User;
}
