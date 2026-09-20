import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signup(name, email, password);
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
          <p className="fc-text-dim text-sm">Create your player card.</p>
        </div>
        <form onSubmit={handleSubmit} className="fc-card p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs fc-text-dim uppercase tracking-wide">Name</label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vinayak"
              className="fc-input fc-focus w-full mt-1 px-3 py-2.5"
            />
          </div>
          <div>
            <label className="text-xs fc-text-dim uppercase tracking-wide">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="fc-input fc-focus w-full mt-1 px-3 py-2.5"
            />
          </div>
          <div>
            <label className="text-xs fc-text-dim uppercase tracking-wide">Password</label>
            <PasswordInput
              required
              minLength={6}
              value={password}
              onChange={setPassword}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm fc-ember">{error}</p>}
          <button type="submit" disabled={busy} className="fc-btn-primary fc-focus rounded-lg py-2.5 font-display tracking-wide">
            {busy ? 'CREATING…' : 'CREATE PLAYER CARD'}
          </button>
          <p className="text-sm text-center fc-text-dim">
            Already playing? <Link to="/login" className="fc-signal">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
