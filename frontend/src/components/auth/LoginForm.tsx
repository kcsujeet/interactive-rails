import { useState } from 'react';
import { login } from '../../lib/api';
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
      window.location.href = '/acts';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Login</h2>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label className="label" htmlFor="email">Email</label>
        <input
          className="input"
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

      <div className="form-group">
        <label className="label" htmlFor="password">Password</label>
        <input
          className="input"
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

      <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Sign In'}
      </button>

      <p className="auth-switch">
        New to RailsExpert?{' '}
        <a href="/signup">Create an account</a>
      </p>
    </form>
  );
}
