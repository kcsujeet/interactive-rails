import { useState } from 'react';
import { login } from '../../lib/api';
import { hasGuestProgress, importGuestProgress } from '../../lib/progress';
import { setAuth } from '../../stores/authStore';

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
          'You have guest progress on this device. Import it into your account?'
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
    <form className="w-full max-w-md mx-auto" onSubmit={handleSubmit}>
      <div className="bg-game-surface rounded-xl border border-game-border p-8">
        <h2 className="text-xl font-semibold text-white mb-6">Login</h2>

        {error && (
          <div className="mb-5 p-3 bg-rose-950/50 border border-rose-900 rounded-lg text-sm text-rose-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="email">Email</label>
            <input
              className="w-full px-4 py-2.5 bg-game-bg text-white border border-game-border rounded-lg focus:border-sky-500 focus:outline-none transition-colors placeholder:text-slate-600"
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="password">Password</label>
            <input
              className="w-full px-4 py-2.5 bg-game-bg text-white border border-game-border rounded-lg focus:border-sky-500 focus:outline-none transition-colors placeholder:text-slate-600"
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full mt-6 px-4 py-3 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={isLoading}
        >
          {isLoading ? 'Logging in...' : 'Sign In'}
        </button>

        <p className="mt-6 text-center text-sm text-slate-500">
          New to RailsExpert?{' '}
          <a href="/signup" className="text-sky-400 hover:text-sky-300 transition-colors">Create an account</a>
        </p>
      </div>
    </form>
  );
}
