import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-center p-4" style={{ minHeight: '100vh' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="fc-display text-5xl fc-signal mb-2">
            FIT<span style={{ color: 'var(--chalk)' }}>CLASH</span>
          </div>
          <p className="fc-text-dim text-sm">Daily challenges. Real streaks. Bragging rights.</p>
        </div>
        <form onSubmit={handleSubmit} className="fc-card p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs fc-text-dim uppercase tracking-wide">Email</label>
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="fc-input fc-focus w-full mt-1 px-3 py-2.5"
            />
          </div>
          <div>
            <label className="text-xs fc-text-dim uppercase tracking-wide">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="fc-input fc-focus w-full mt-1 px-3 py-2.5"
            />
            <div className="text-right mt-1">
              <Link to="/forgot-password" className="text-xs fc-text-dim hover:fc-signal">Forgot password?</Link>
            </div>
          </div>
          {error && <p className="text-sm fc-ember">{error}</p>}
          <button type="submit" disabled={busy} className="fc-btn-primary fc-focus rounded-lg py-2.5 font-display tracking-wide">
            {busy ? 'SIGNING IN…' : 'ENTER THE ARENA'}
          </button>
          <p className="text-sm text-center fc-text-dim">
            New here? <Link to="/signup" className="fc-signal">Create an account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
