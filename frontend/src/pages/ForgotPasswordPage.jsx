import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { api } from '../api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devUrl, setDevUrl] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.forgotPassword(email);
      setMessage(res.message);
      setDevUrl(res.dev_url || null);
      setSent(true);
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
          <p className="fc-text-dim text-sm">Reset your password.</p>
        </div>

        {!sent ? (
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
            {error && <p className="text-sm fc-ember">{error}</p>}
            <button type="submit" disabled={busy || !email.trim()} className="fc-btn-primary fc-focus rounded-lg py-2.5 font-display tracking-wide">
              {busy ? 'SENDING…' : 'SEND RESET LINK'}
            </button>
            <p className="text-sm text-center fc-text-dim">
              <Link to="/login" className="fc-signal">Back to sign in</Link>
            </p>
          </form>
        ) : (
          <div className="fc-card p-6 flex flex-col gap-4 text-center">
            <MailCheck size={32} className="fc-turf mx-auto" />
            <p className="text-sm">{message}</p>
            {devUrl && (
              <div className="fc-bg-ink3 rounded-lg p-3 text-left">
                <p className="text-xs fc-text-dim mb-2">
                  No email server is configured for this local instance, so here's your reset link directly:
                </p>
                <Link to={devUrl.replace(window.location.origin, '')} className="fc-signal text-xs break-all">
                  {devUrl}
                </Link>
              </div>
            )}
            <Link to="/login" className="fc-signal text-sm">Back to sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
}
