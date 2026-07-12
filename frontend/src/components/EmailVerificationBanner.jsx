import React, { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { api } from '../api';

export default function EmailVerificationBanner() {
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [devUrl, setDevUrl] = useState(null);
  const [error, setError] = useState('');

  async function handleResend() {
    setStatus('sending');
    setError('');
    try {
      const res = await api.resendVerification();
      setDevUrl(res.dev_url || null);
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  return (
    <div className="fc-card p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <MailWarning size={20} className="fc-signal shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-semibold">Verify your email</span>{' '}
        <span className="fc-text-dim">to keep full access to your account.</span>
        {status === 'sent' && (
          <div className="mt-1 text-xs fc-turf">
            Verification email sent{devUrl ? ' — since no email server is configured locally, use the link below:' : '.'}
            {devUrl && (
              <div className="mt-1">
                <a href={devUrl.replace(window.location.origin, '')} className="fc-signal break-all">{devUrl}</a>
              </div>
            )}
          </div>
        )}
        {status === 'error' && <div className="mt-1 text-xs fc-ember">{error}</div>}
      </div>
      <button
        onClick={handleResend}
        disabled={status === 'sending' || status === 'sent'}
        className="fc-btn-ghost fc-focus rounded-lg px-4 py-2 text-xs whitespace-nowrap"
      >
        {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Sent' : 'Resend email'}
      </button>
    </div>
  );
}
