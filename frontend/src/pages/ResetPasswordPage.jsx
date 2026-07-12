import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('This reset link is missing its token — please use the link from your email.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
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
          <p className="fc-text-dim text-sm">Choose a new password.</p>
        </div>

        {done ? (
          <div className="fc-card p-6 flex flex-col gap-4 text-center">
            <CheckCircle2 size={32} className="fc-turf mx-auto" />
            <p className="text-sm">Your password has been updated.</p>
            <button
              onClick={() => navigate('/login')}
              className="fc-btn-primary fc-focus rounded-lg py-2.5 font-display tracking-wide"
            >
              SIGN IN
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="fc-card p-6 flex flex-col gap-4">
            {!token && (
              <p className="text-sm fc-ember">
                No reset token found in this link. Request a new one from the{' '}
                <Link to="/forgot-password" className="fc-signal">forgot password</Link> page.
              </p>
            )}
            <div>
              <label className="text-xs fc-text-dim uppercase tracking-wide">New password</label>
              <input
                type="password"
                autoFocus
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="fc-input fc-focus w-full mt-1 px-3 py-2.5"
              />
            </div>
            <div>
              <label className="text-xs fc-text-dim uppercase tracking-wide">Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="fc-input fc-focus w-full mt-1 px-3 py-2.5"
              />
            </div>
            {error && <p className="text-sm fc-ember">{error}</p>}
            <button
              type="submit"
              disabled={busy || !password || !confirm}
              className="fc-btn-primary fc-focus rounded-lg py-2.5 font-display tracking-wide"
            >
              {busy ? 'UPDATING…' : 'UPDATE PASSWORD'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
