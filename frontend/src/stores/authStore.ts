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

// Initialize stores on client, verify session is still valid
export function initAuth() {
	const cached = getInitialUser();
	$user.set(cached);

	// Verify session with server — clear stale state on 401
	if (cached) {
		fetch('/api/auth/me', { credentials: 'include' })
			.then((res) => {
				if (res.status === 401) {
					clearAuth();
				}
			})
			.catch(() => {
				// Network error — keep cached state
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
