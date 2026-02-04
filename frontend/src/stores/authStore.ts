import { atom, computed } from 'nanostores';
import type { User } from '../../../shared/types';

const USER_KEY = 'railsexpert_user';

// Initialize user from localStorage (for display purposes only, not auth)
function getInitialUser(): User | null {
	if (typeof window === 'undefined') return null;
	const stored = localStorage.getItem(USER_KEY);
	return stored ? JSON.parse(stored) : null;
}

export const $user = atom<User | null>(
	typeof window !== 'undefined' ? getInitialUser() : null,
);
export const $isAuthenticated = computed($user, (user) => !!user);

// Initialize stores on client (call after checking auth with server)
export function initAuth() {
	$user.set(getInitialUser());
}

export function setAuth(user: User) {
	$user.set(user);
	localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
	$user.set(null);
	localStorage.removeItem(USER_KEY);
}
