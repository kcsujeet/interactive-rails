import { useState } from 'react';
import { signup } from '../../lib/api';
import { setAuth } from '../../stores/authStore';

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

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Validate username
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    setIsLoading(true);

    try {
      const response = await signup(email, username, password);
      setAuth(response.user);
      window.location.href = '/acts';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Create Account</h2>

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
        <label className="label" htmlFor="username">Username</label>
        <input
          className="input"
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={isLoading}
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          autoComplete="username"
          placeholder="your_username"
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
          minLength={8}
          autoComplete="new-password"
          placeholder="Min 8 characters"
        />
      </div>

      <div className="form-group">
        <label className="label" htmlFor="confirmPassword">Confirm Password</label>
        <input
          className="input"
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isLoading}
          autoComplete="new-password"
          placeholder="Repeat password"
        />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Account'}
      </button>

      <p className="auth-switch">
        Already have an account?{' '}
        <a href="/login">Sign in</a>
      </p>
    </form>
  );
}
