import { useState } from 'react';
import { login } from '@/lib/api';
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

export default function LoginForm() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setIsLoading(true);

		try {
			const response = await login(email, password);
			setAuth(response.user);
			if (hasGuestProgress()) {
				const confirmed = window.confirm(
					'You have guest progress on this device. Import it into your account?',
				);
				if (confirmed) {
					const result = await importGuestProgress();
					if (!result.success) {
						console.warn(result.message || 'Failed to import guest progress.');
					}
				}
			}
			window.location.href = '/acts';
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed');
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Card className="w-full max-w-md shadow-xl border-primary/10">
			<CardHeader>
				<CardTitle className="text-xl">Login</CardTitle>
				<CardDescription>
					Enter your credentials to access your account
				</CardDescription>
			</CardHeader>
			<form onSubmit={handleSubmit}>
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
							htmlFor="password"
						>
							Password
						</label>
						<Input
							autoComplete="current-password"
							disabled={isLoading}
							id="password"
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							required
							type="password"
							value={password}
						/>
					</div>
				</CardContent>

				<CardFooter className="flex flex-col gap-4">
					<Button className="w-full" disabled={isLoading} type="submit">
						{isLoading ? 'Signing in...' : 'Sign In'}
					</Button>
					<p className="text-center text-sm text-muted-foreground">
						New to RailsExpert?{' '}
						<a className="text-primary hover:underline" href="/signup">
							Create an account
						</a>
					</p>
				</CardFooter>
			</form>
		</Card>
	);
}
