import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { api } from '../api';

function validateCode(value) {
  const code = value.trim();
  if (!code) return 'Enter an invite code.';
  if (code.length < 4) return 'That code looks too short.';
  return '';
}

export default function JoinCommunityPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const codeError = validateCode(code);
    if (codeError) {
      setError(codeError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const group = await api.joinGroup(code.trim());
      navigate(`/communities/${group.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="fc-text-dim text-sm flex items-center gap-1 mb-4 fc-focus"
      >
        <ChevronLeft size={18} /> Back
      </button>
      <h1 className="fc-display text-2xl mb-4">Join a community</h1>
      <form onSubmit={handleSubmit} className="fc-card p-5 flex flex-col gap-4">
        <div>
          <label className="text-xs fc-text-dim uppercase tracking-wide">Invite code</label>
          <input
            autoFocus
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(''); }}
            placeholder="e.g. 7K2XQP"
            className="fc-input fc-focus fc-mono w-full mt-1 px-3 py-2.5 tracking-widest uppercase"
          />
        </div>
        {error && <p className="text-sm fc-ember">{error}</p>}
        <button type="submit" disabled={!code.trim() || busy} className="fc-btn-primary fc-focus py-2.5">
          {busy ? 'Joining…' : 'Join community'}
        </button>
      </form>
    </div>
  );
}
