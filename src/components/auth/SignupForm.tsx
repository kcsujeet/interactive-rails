import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { hasGuestProgress, importGuestProgress } from '@/lib/progress';
import { setAuth } from '@/stores/authStore';
import { Button } from '../ui/Button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '../ui/Card';
import { Input } from '../ui/Input';

export default function SignupForm() {
	const [email, setEmail] = useState('');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		if (password !== confirmPassword) {
			setError('Passwords do not match');
			return;
		}

		if (password.length < 8) {
			setError('Password must be at least 8 characters');
			return;
		}

		if (!/^[a-zA-Z0-9_]+$/.test(username)) {
			setError('Username can only contain letters, numbers, and underscores');
			return;
		}

		setIsLoading(true);

		try {
			const { data, error: authError } = await authClient.signUp.email({
				name: username,
				email,
				password,
				username,
			});

			if (authError) {
				setError(authError.message ?? 'Signup failed');
				return;
			}

			if (data?.user) {
				setAuth({
					id: data.user.id,
					email: data.user.email,
					username: data.user.username ?? data.user.name,
				});
			}

			if (hasGuestProgress()) {
				const confirmed = window.confirm(
					'You have guest progress on this device. Import it into your new account?',
				);
				if (confirmed) {
					const result = await importGuestProgress();
					if (!result.success) {
						console.warn(result.message || 'Failed to import guest progress.');
					}
				}
			}
			window.location.href = '/acts';
		} catch (_err) {
			setError(
				'Unable to connect to the authentication server. Please try again.',
			);
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit}>
			<Card className="w-full max-w-md shadow-xl border-primary/10">
				<CardHeader>
					<CardTitle className="text-xl">Create Account</CardTitle>
					<CardDescription>
						Join Interactive Rails to start your learning journey
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{error && (
						<div className="p-3 rounded-lg bg-destructive/15 border border-destructive/50 text-sm text-destructive">
							{error}
						</div>
					)}

					<div className="space-y-2">
						<label
							className="text-sm font-medium text-foreground"
							htmlFor="email"
						>
							Email
						</label>
						<Input
							autoComplete="email"
							disabled={isLoading}
							id="email"
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							required
							type="email"
							value={email}
						/>
					</div>

					<div className="space-y-2">
						<label
							className="text-sm font-medium text-foreground"
							htmlFor="username"
						>
							Username
						</label>
						<Input
							autoComplete="username"
							disabled={isLoading}
							id="username"
							maxLength={20}
							minLength={3}
							onChange={(e) => setUsername(e.target.value)}
							pattern="[a-zA-Z0-9_]+"
							placeholder="railsdev"
							required
							type="text"
							value={username}
						/>
					</div>

					<div className="space-y-2">
						<label
							className="text-sm font-medium text-foreground"
							htmlFor="password"
						>
							Password
						</label>
						<Input
							autoComplete="new-password"
							disabled={isLoading}
							id="password"
							minLength={8}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Min 8 characters"
							required
							type="password"
							value={password}
						/>
					</div>

					<div className="space-y-2">
						<label
							className="text-sm font-medium text-foreground"
							htmlFor="confirmPassword"
						>
							Confirm Password
						</label>
						<Input
							autoComplete="new-password"
							disabled={isLoading}
							id="confirmPassword"
							onChange={(e) => setConfirmPassword(e.target.value)}
							placeholder="Repeat password"
							required
							type="password"
							value={confirmPassword}
						/>
					</div>
				</CardContent>

				<CardFooter className="flex flex-col gap-4">
					<Button className="w-full" disabled={isLoading} type="submit">
						{isLoading ? 'Creating account...' : 'Create Account'}
					</Button>
					<p className="text-center text-sm text-muted-foreground">
						Already have an account?{' '}
						<a className="text-primary hover:underline" href="/login">
							Sign in
						</a>
					</p>
				</CardFooter>
			</Card>
		</form>
	);
}
