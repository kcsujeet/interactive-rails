import { atom, computed } from 'nanostores';
import { authClient } from '@/lib/auth-client';
import type { User } from '../../shared/types';

const USER_KEY = 'interactive_rails_user';

function getInitialUser(): User | null {
	if (typeof window === 'undefined') return null;
	const stored = localStorage.getItem(USER_KEY);
	return stored ? JSON.parse(stored) : null;
}

export const $user = atom<User | null>(
	typeof window !== 'undefined' ? getInitialUser() : null,
);
export const $isAuthenticated = computed($user, (user) => !!user);

// Initialize stores on client, verify session is still valid
export function initAuth() {
	const cached = getInitialUser();
	$user.set(cached);

	// Verify session with Better Auth
	if (cached) {
		authClient.getSession().then(({ data, error }) => {
			if (error || !data) {
				clearAuth();
			}
		});
	}
}

export function setAuth(user: User) {
	$user.set(user);
	localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
	$user.set(null);
	localStorage.removeItem(USER_KEY);
}
