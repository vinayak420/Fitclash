import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { user, refreshUser } = useAuth();

  const [state, setState] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is missing its token.');
      return;
    }
    (async () => {
      try {
        const res = await api.verifyEmail(token);
        setMessage(res.message);
        setState('success');
        if (user) await refreshUser();
      } catch (err) {
        setMessage(err.message);
        setState('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex items-center justify-center p-4" style={{ minHeight: '100vh' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="fc-display text-5xl fc-signal mb-2">
            FIT<span style={{ color: 'var(--chalk)' }}>CLASH</span>
          </div>
        </div>
        <div className="fc-card p-6 flex flex-col gap-4 text-center">
          {state === 'loading' && (
            <>
              <Loader2 size={32} className="fc-signal mx-auto animate-spin" />
              <p className="text-sm fc-text-dim">Verifying your email…</p>
            </>
          )}
          {state === 'success' && (
            <>
              <CheckCircle2 size={32} className="fc-turf mx-auto" />
              <p className="text-sm">{message}</p>
            </>
          )}
          {state === 'error' && (
            <>
              <XCircle size={32} className="fc-ember mx-auto" />
              <p className="text-sm">{message}</p>
            </>
          )}
          <Link to={user ? '/' : '/login'} className="fc-signal text-sm">
            {user ? 'Back to your dashboard' : 'Back to sign in'}
          </Link>
        </div>
      </div>
    </div>
  );
}
